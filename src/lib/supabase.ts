import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Enlace de acceso a prueba de escaneres: #/auth/confirm?token_hash=...&type=recovery
 * Se lee ANTES de crear el cliente para conservar los parametros.
 */
function readConfirmLink(): { tokenHash: string; type: 'recovery' | 'invite' } | null {
  const m = window.location.hash.match(/^#\/auth\/confirm\?(.*)$/);
  if (!m) return null;
  const p = new URLSearchParams(m[1]);
  const tokenHash = p.get('token_hash');
  if (!tokenHash) return null;
  const type = p.get('type') === 'invite' ? 'invite' : 'recovery';
  return { tokenHash, type };
}

export const confirmLinkParams = readConfirmLink();

// Capturamos la intencion de invitacion/recuperacion ANTES de crear el cliente.
// createClient (detectSessionInUrl) procesa y LIMPIA el hash de la URL de
// inmediato; si lo leyeramos despues (en un useEffect) ya estaria borrado, y por
// eso la pantalla "Define tu contrasena" no aparecia.
export const isPasswordSetupRedirect =
  !confirmLinkParams &&
  (/type=(recovery|invite)/.test(window.location.hash) ||
    /type=(recovery|invite)/.test(window.location.search));

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
