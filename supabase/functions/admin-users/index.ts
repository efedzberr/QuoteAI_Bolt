import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const RESEND_FROM = Deno.env.get("RESEND_FROM") ?? "";
const APP_URL_ENV = (Deno.env.get("APP_URL") ?? "").replace(/\/+$/, "");

type Json = Record<string, unknown>;

function jsonResponse(body: Json, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeJwtPayload(token: string): Json {
  try {
    const part = token.split(".")[1] || "";
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Json;
  } catch {
    return {};
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cleanStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

// ------------------------------------------------------------
// Autorización: caller autenticado, con aal2 y administrador activo
// ------------------------------------------------------------
async function requireAdmin(req: Request, serviceClient: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return { error: jsonResponse({ error: "No autenticado" }, 401) };

  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: { user }, error } = await anonClient.auth.getUser(token);
  if (error || !user) return { error: jsonResponse({ error: "Sesión inválida" }, 401) };

  const payload = decodeJwtPayload(token);
  if (payload.aal !== "aal2") {
    return { error: jsonResponse({ error: "Se requiere verificación 2FA (aal2)" }, 403) };
  }

  const { data: profile } = await serviceClient
    .from("user_profiles")
    .select("is_admin, is_active, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile || !profile.is_admin || !profile.is_active) {
    return { error: jsonResponse({ error: "Solo administradores" }, 403) };
  }

  return {
    caller: {
      id: user.id,
      email: user.email || "",
      name: (profile.full_name as string | null) || user.email || "Administrador",
    },
  };
}

// ------------------------------------------------------------
// Enlace de acceso (a prueba de escáneres) + correos
// ------------------------------------------------------------
function appBaseUrl(req: Request, body: Json): string {
  const fromBody = cleanStr(body.app_url);
  const origin = req.headers.get("origin") || "";
  const base = fromBody || origin || APP_URL_ENV;
  return base.replace(/\/+$/, "");
}

async function buildAccessLink(
  serviceClient: ReturnType<typeof createClient>,
  email: string,
  baseUrl: string,
): Promise<{ link: string | null; error: string | null }> {
  const { data, error } = await serviceClient.auth.admin.generateLink({ type: "recovery", email });
  if (error) return { link: null, error: error.message };
  const hashed = (data?.properties?.hashed_token as string | undefined) || null;
  if (hashed && baseUrl) {
    return { link: `${baseUrl}/#/auth/confirm?token_hash=${hashed}&type=recovery`, error: null };
  }
  return { link: (data?.properties?.action_link as string | undefined) || null, error: null };
}

async function sendEmail(to: string, subject: string, html: string): Promise<{ sent: boolean; error: string | null }> {
  if (!RESEND_API_KEY || !RESEND_FROM) {
    return { sent: false, error: "Resend no está configurado (RESEND_API_KEY / RESEND_FROM)" };
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { sent: false, error: `Resend ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { sent: true, error: null };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function emailShell(inner: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;background:#F3F3F3;font-family:Manrope,Segoe UI,Roboto,Arial,sans-serif;color:#181818;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F3F3;padding:32px 12px;"><tr><td align="center">
    <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #E5E5E5;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#032D60;padding:20px 28px;color:#ffffff;font-size:18px;font-weight:800;letter-spacing:-0.01em;">Cotizador</td></tr>
      <tr><td style="padding:28px;font-size:14px;line-height:1.6;">${inner}</td></tr>
      <tr><td style="padding:16px 28px;border-top:1px solid #F0F0F0;font-size:11px;color:#747474;">Cotizador · Impulsora Monterrey · Acceso restringido</td></tr>
    </table>
  </td></tr></table></body></html>`;
}

function userEmail(mode: "invite" | "recovery", fullName: string | null, link: string, tempPassword: string | null): { subject: string; html: string } {
  const name = escapeHtml(fullName || "");
  const greeting = name ? `Hola ${name},` : "Hola,";
  const button = `<p style="margin:24px 0;"><a href="${link}" style="display:inline-block;background:#0176D3;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:8px;">${mode === "invite" ? "Activar mi cuenta" : "Restablecer contraseña"}</a></p>`;
  const expiry = `<p style="color:#747474;font-size:12px;">El enlace es de un solo uso y vence 24 horas después de haberse enviado. Si no lo solicitaste, ignora este correo.</p>`;
  const fallback = `<p style="color:#747474;font-size:12px;word-break:break-all;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br>${link}</p>`;
  if (mode === "invite") {
    const pwd = tempPassword
      ? `<p>Tu administrador definió una contraseña inicial: <code style="background:#F0F0F0;padding:2px 6px;border-radius:4px;">${escapeHtml(tempPassword)}</code>. También puedes usar el botón para definir tu propia contraseña.</p>`
      : "";
    return {
      subject: "Tu acceso a Cotizador",
      html: emailShell(`<p>${greeting}</p><p>Se creó tu cuenta en <strong>Cotizador</strong>, la plataforma de cotizaciones de Impulsora Monterrey. Presiona el botón para definir tu contraseña y configurar la verificación en dos pasos.</p>${pwd}${button}${expiry}${fallback}`),
    };
  }
  return {
    subject: "Restablecer tu contraseña de Cotizador",
    html: emailShell(`<p>${greeting}</p><p>Recibimos una solicitud para restablecer tu contraseña de <strong>Cotizador</strong>. Presiona el botón para definir una nueva.</p>${button}${expiry}${fallback}`),
  };
}

function adminCopyEmail(mode: "invite" | "recovery", adminName: string, targetEmail: string, fullName: string | null, link: string, sentToUser: boolean, sendError: string | null): { subject: string; html: string } {
  const label = mode === "invite" ? "Invitación" : "Enlace de restablecimiento";
  const status = sentToUser
    ? `<p style="color:#2E844A;">✔ El correo fue enviado al usuario.</p>`
    : `<p style="color:#BA0517;">✖ No se pudo enviar el correo al usuario${sendError ? ` (${escapeHtml(sendError)})` : ""}. Compártele el enlace manualmente.</p>`;
  return {
    subject: `[Copia] ${label} enviada a ${targetEmail}`,
    html: emailShell(`<p>Hola ${escapeHtml(adminName)},</p><p>Esta es tu copia de la acción que realizaste en Cotizador.</p>
      <table cellpadding="0" cellspacing="0" style="font-size:13px;margin:12px 0;"><tr><td style="color:#747474;padding:3px 12px 3px 0;">Usuario</td><td>${escapeHtml(fullName || "—")}</td></tr><tr><td style="color:#747474;padding:3px 12px 3px 0;">Correo</td><td>${escapeHtml(targetEmail)}</td></tr><tr><td style="color:#747474;padding:3px 12px 3px 0;">Acción</td><td>${label}</td></tr></table>
      ${status}
      <p style="font-size:12px;color:#747474;">Enlace de acceso (un solo uso, vence en 24 h). Cualquier persona con el enlace puede entrar a la cuenta; compártelo solo con el usuario:</p>
      <p style="font-size:12px;word-break:break-all;background:#F3F3F3;padding:10px;border-radius:6px;">${link}</p>`),
  };
}

async function sendAccessLink(
  serviceClient: ReturnType<typeof createClient>,
  caller: { id: string; email: string; name: string },
  baseUrl: string,
  target: { email: string; full_name: string | null; never_signed_in: boolean },
  tempPassword: string | null = null,
) {
  const mode: "invite" | "recovery" = target.never_signed_in ? "invite" : "recovery";
  const { link, error: linkError } = await buildAccessLink(serviceClient, target.email, baseUrl);
  if (!link) {
    return { mode, link: null, sent_user: false, sent_admin: false, error: linkError || "No se pudo generar el enlace" };
  }
  const u = userEmail(mode, target.full_name, link, tempPassword);
  const userRes = await sendEmail(target.email, u.subject, u.html);
  let adminRes = { sent: false, error: null as string | null };
  if (caller.email) {
    const a = adminCopyEmail(mode, caller.name, target.email, target.full_name, link, userRes.sent, userRes.error);
    adminRes = await sendEmail(caller.email, a.subject, a.html);
  }
  return {
    mode,
    link,
    sent_user: userRes.sent,
    sent_admin: adminRes.sent,
    error: userRes.error || adminRes.error,
  };
}

// ------------------------------------------------------------
// user_permissions (ver_inventario) — leer y escribir sin asumir índice único
// ------------------------------------------------------------
async function setVerInventario(serviceClient: ReturnType<typeof createClient>, userId: string, value: boolean) {
  const { data: existing } = await serviceClient.from("user_permissions").select("user_id").eq("user_id", userId).limit(1);
  if (existing && existing.length > 0) {
    await serviceClient.from("user_permissions").update({ ver_inventario: value }).eq("user_id", userId);
  } else {
    await serviceClient.from("user_permissions").insert({ user_id: userId, ver_inventario: value });
  }
}

// ------------------------------------------------------------
// Handlers
// ------------------------------------------------------------
async function handleList(serviceClient: ReturnType<typeof createClient>) {
  const { data: usersData, error } = await serviceClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) return jsonResponse({ error: error.message }, 500);
  const users = usersData?.users || [];
  const ids = users.map((u) => u.id);

  const { data: profiles } = await serviceClient.from("user_profiles").select("*").in("id", ids);
  const { data: perms } = await serviceClient.from("user_permissions").select("user_id, ver_inventario").in("user_id", ids);
  const profileById = new Map((profiles || []).map((p: Json) => [p.id as string, p]));
  const permById = new Map((perms || []).map((p: Json) => [p.user_id as string, p.ver_inventario === true]));

  const mfaById = new Map<string, boolean>();
  await Promise.all(users.map(async (u) => {
    try {
      const { data } = await serviceClient.auth.admin.mfa.listFactors({ userId: u.id });
      const factors = (data?.factors || []) as { status?: string }[];
      mfaById.set(u.id, factors.some((f) => f.status === "verified"));
    } catch {
      mfaById.set(u.id, false);
    }
  }));

  const rows = users.map((u) => {
    const p = (profileById.get(u.id) || {}) as Json;
    const bannedUntil = (u as unknown as { banned_until?: string | null }).banned_until || null;
    const banned = !!bannedUntil && new Date(bannedUntil).getTime() > Date.now();
    return {
      id: u.id,
      email: u.email || (p.email as string) || "",
      full_name: (p.full_name as string | null) ?? ((u.user_metadata as Json)?.full_name as string | null) ?? null,
      phone: (p.phone as string | null) ?? null,
      salesforce_id: (p.salesforce_id as string | null) ?? null,
      is_admin: p.is_admin === true,
      is_active: p.is_active !== false && !banned,
      ver_inventario: permById.get(u.id) === true,
      mfa_enrolled: mfaById.get(u.id) === true,
      last_sign_in_at: u.last_sign_in_at || null,
      created_at: u.created_at,
    };
  });
  rows.sort((a, b) => (a.full_name || a.email).localeCompare(b.full_name || b.email, "es"));
  return jsonResponse({ users: rows });
}

async function handleCreate(
  req: Request,
  serviceClient: ReturnType<typeof createClient>,
  caller: { id: string; email: string; name: string },
  body: Json,
) {
  const email = (cleanStr(body.email) || "").toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonResponse({ error: "Correo inválido" }, 400);
  const full_name = cleanStr(body.full_name);
  if (!full_name) return jsonResponse({ error: "El nombre completo es obligatorio" }, 400);
  const phone = cleanStr(body.phone);
  const salesforce_id = cleanStr(body.salesforce_id);
  const is_admin = body.is_admin === true;
  const ver_inventario = body.ver_inventario === true;
  const password = cleanStr(body.password);
  if (password !== null && password.length < 8) return jsonResponse({ error: "La contraseña debe tener al menos 8 caracteres" }, 400);

  const { data: created, error: createErr } = await serviceClient.auth.admin.createUser({
    email,
    email_confirm: true,
    password: password || undefined,
    user_metadata: { full_name, phone: phone || undefined },
  });
  if (createErr || !created?.user) {
    const msg = createErr?.message || "No se pudo crear el usuario";
    const status = /already|registered|exists/i.test(msg) ? 409 : 500;
    return jsonResponse({ error: status === 409 ? "Ya existe un usuario con ese correo" : msg }, status);
  }
  const userId = created.user.id;

  // El trigger crea la fila; aseguramos los datos completos
  await serviceClient.from("user_profiles").upsert({ id: userId, email, full_name, phone, salesforce_id, is_admin, is_active: true }, { onConflict: "id" });
  await setVerInventario(serviceClient, userId, ver_inventario);

  const baseUrl = appBaseUrl(req, body);
  const notify = await sendAccessLink(serviceClient, caller, baseUrl, { email, full_name, never_signed_in: true }, password);

  return jsonResponse({ success: true, user_id: userId, email, ...notify });
}

async function handleUpdate(
  serviceClient: ReturnType<typeof createClient>,
  caller: { id: string; email: string; name: string },
  body: Json,
) {
  const userId = cleanStr(body.user_id);
  if (!userId) return jsonResponse({ error: "user_id es obligatorio" }, 400);
  const { data: { user }, error: getErr } = await serviceClient.auth.admin.getUserById(userId);
  if (getErr || !user) return jsonResponse({ error: "Usuario no encontrado" }, 404);

  const patch: Json = {};
  if ("full_name" in body) {
    const v = cleanStr(body.full_name);
    if (!v) return jsonResponse({ error: "El nombre completo es obligatorio" }, 400);
    patch.full_name = v;
  }
  if ("phone" in body) patch.phone = cleanStr(body.phone);
  if ("salesforce_id" in body) patch.salesforce_id = cleanStr(body.salesforce_id);
  if ("is_admin" in body) {
    if (userId === caller.id && body.is_admin !== true) return jsonResponse({ error: "No puedes quitarte a ti mismo el rol de administrador" }, 400);
    patch.is_admin = body.is_admin === true;
  }
  if ("is_active" in body) {
    if (userId === caller.id && body.is_active !== true) return jsonResponse({ error: "No puedes desactivar tu propia cuenta" }, 400);
    patch.is_active = body.is_active !== false;
  }

  const newEmail = "email" in body ? (cleanStr(body.email) || "").toLowerCase() : null;
  const authPatch: Json = {};
  if (newEmail && newEmail !== (user.email || "").toLowerCase()) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) return jsonResponse({ error: "Correo inválido" }, 400);
    authPatch.email = newEmail;
    authPatch.email_confirm = true;
    patch.email = newEmail;
  }
  if ("full_name" in patch || "phone" in patch) {
    authPatch.user_metadata = { ...(user.user_metadata || {}), full_name: patch.full_name ?? user.user_metadata?.full_name, phone: patch.phone ?? null };
  }
  if ("is_active" in patch) {
    authPatch.ban_duration = patch.is_active ? "none" : "876000h";
  }
  if (Object.keys(authPatch).length > 0) {
    const { error: updErr } = await serviceClient.auth.admin.updateUserById(userId, authPatch);
    if (updErr) return jsonResponse({ error: updErr.message }, 500);
  }
  if (Object.keys(patch).length > 0) {
    const { error: pErr } = await serviceClient.from("user_profiles").upsert({ id: userId, email: newEmail || user.email, ...patch }, { onConflict: "id" });
    if (pErr) return jsonResponse({ error: pErr.message }, 500);
  }
  if ("ver_inventario" in body) {
    await setVerInventario(serviceClient, userId, body.ver_inventario === true);
  }
  return jsonResponse({ success: true });
}

async function handleSendLink(
  req: Request,
  serviceClient: ReturnType<typeof createClient>,
  caller: { id: string; email: string; name: string },
  body: Json,
) {
  const userId = cleanStr(body.user_id);
  if (!userId) return jsonResponse({ error: "user_id es obligatorio" }, 400);
  const { data: { user }, error } = await serviceClient.auth.admin.getUserById(userId);
  if (error || !user || !user.email) return jsonResponse({ error: "Usuario no encontrado" }, 404);
  const { data: profile } = await serviceClient.from("user_profiles").select("full_name").eq("id", userId).maybeSingle();
  const baseUrl = appBaseUrl(req, body);
  const notify = await sendAccessLink(serviceClient, caller, baseUrl, {
    email: user.email,
    full_name: (profile?.full_name as string | null) ?? null,
    never_signed_in: !user.last_sign_in_at,
  });
  return jsonResponse({ success: true, email: user.email, ...notify });
}

async function handleResetMfa(serviceClient: ReturnType<typeof createClient>, body: Json) {
  const userId = cleanStr(body.user_id);
  if (!userId) return jsonResponse({ error: "user_id es obligatorio" }, 400);
  const { data, error } = await serviceClient.auth.admin.mfa.listFactors({ userId });
  if (error) return jsonResponse({ error: error.message }, 500);
  const factors = (data?.factors || []) as { id: string }[];
  for (const f of factors) {
    const { error: delErr } = await serviceClient.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (delErr) return jsonResponse({ error: delErr.message }, 500);
  }
  return jsonResponse({ success: true, removed: factors.length });
}

async function handleDelete(
  serviceClient: ReturnType<typeof createClient>,
  caller: { id: string; email: string; name: string },
  body: Json,
) {
  const userId = cleanStr(body.user_id);
  if (!userId) return jsonResponse({ error: "user_id es obligatorio" }, 400);
  if (userId === caller.id) return jsonResponse({ error: "No puedes eliminar tu propia cuenta" }, 400);
  await serviceClient.from("user_permissions").delete().eq("user_id", userId);
  const { error } = await serviceClient.auth.admin.deleteUser(userId);
  if (error) return jsonResponse({ error: error.message }, 500);
  await serviceClient.from("user_profiles").delete().eq("id", userId);
  return jsonResponse({ success: true });
}

// ------------------------------------------------------------
// Router
// ------------------------------------------------------------
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Método no permitido" }, 405);

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return jsonResponse({ error: "JSON inválido" }, 400);
  }

  const serviceClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const auth = await requireAdmin(req, serviceClient);
  if ("error" in auth) return auth.error;
  const caller = auth.caller;

  try {
    switch (body.action) {
      case "list":
        return await handleList(serviceClient);
      case "create":
        return await handleCreate(req, serviceClient, caller, body);
      case "update_user":
        return await handleUpdate(serviceClient, caller, body);
      case "send_link":
        return await handleSendLink(req, serviceClient, caller, body);
      case "reset_mfa":
        return await handleResetMfa(serviceClient, body);
      case "delete_user":
        return await handleDelete(serviceClient, caller, body);
      default:
        return jsonResponse({ error: "Acción desconocida" }, 400);
    }
  } catch (e) {
    console.error("admin-users error:", e);
    return jsonResponse({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
