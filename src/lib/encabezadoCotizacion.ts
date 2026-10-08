import { supabase } from './supabase';

/** Cuenta de Salesforce tal como la regresa el servicio de cuentas (/accounts/search). */
export interface CuentaSalesforce {
  id: string;
  noCliente: string | null;
  name: string;
  estado?: string | null;
  calle?: string | null;
  ownerId?: string | null;
  [campo: string]: unknown;
}

/** Campos del encabezado que el ejecutivo edita directo (texto libre). */
export type CampoEncabezado = 'nombre_proyecto' | 'transporte' | 'orden_compra';

/** Largo máximo de cada campo; transporte y orden de compra coinciden con la restricción de la base. */
export const LARGO_CAMPO_ENCABEZADO: Record<CampoEncabezado, number> = {
  nombre_proyecto: 120,
  transporte: 60,
  orden_compra: 40,
};

/** Resumen que devuelve cambiar_cliente_cotizacion (QA_ENC1), tanto al calcular como al aplicar. */
export interface ResumenCambioCliente {
  aplicado: boolean;
  cliente: string;
  cliente_anterior: string | null;
  no_cliente: string | null;
  grupo: string;
  grupo_anterior: string | null;
  status: string;
  regresa_a_validar: boolean;
  lineas: number;
  lineas_con_cambio: number;
  lineas_sin_precio: number;
  subtotal_anterior: number;
  subtotal_nuevo: number;
}

const RAILWAY_ACCOUNTS_URL = 'https://quoteai-production.up.railway.app/accounts/search';

/**
 * Guarda proyecto, transporte u orden de compra de una cotización.
 * Devuelve null si se guardó, o el mensaje de error para mostrarlo junto al campo.
 */
export async function guardarCampoEncabezado(
  referencia: string,
  campo: CampoEncabezado,
  valor: string
): Promise<string | null> {
  const limpio = valor.trim();
  if (campo === 'nombre_proyecto' && !limpio) return 'El proyecto no puede quedar vacío.';
  if (limpio.length > LARGO_CAMPO_ENCABEZADO[campo]) {
    return `Máximo ${LARGO_CAMPO_ENCABEZADO[campo]} caracteres.`;
  }
  const { data, error } = await supabase
    .from('jobs')
    .update({ [campo]: limpio || null, updated_at: new Date().toISOString() })
    .eq('referencia', referencia)
    .select('id');
  if (error) {
    console.error('[encabezado] guardarCampoEncabezado error:', error);
    return 'No se pudo guardar. Intenta de nuevo.';
  }
  if (!data || data.length === 0) return 'No tienes permiso para modificar esta cotización.';
  return null;
}

/**
 * Cambia el cliente de una cotización y recalcula sus precios (RPC cambiar_cliente_cotizacion).
 * Con `aplicar` en false solo calcula el resumen para la confirmación; no modifica nada.
 * `cuenta` es la cuenta de Salesforce elegida, o null si el cliente se escribió a mano.
 */
export async function cambiarClienteCotizacion(
  referencia: string,
  cliente: string,
  cuenta: CuentaSalesforce | null,
  aplicar: boolean
): Promise<{ resumen: ResumenCambioCliente | null; error: string | null }> {
  const { data, error } = await supabase.rpc('cambiar_cliente_cotizacion', {
    p_referencia: referencia,
    p_cliente: cliente,
    p_cuenta: cuenta,
    p_aplicar: aplicar,
  });
  if (error) {
    console.error('[encabezado] cambiar_cliente_cotizacion error:', error);
    return { resumen: null, error: error.message || 'No se pudo cambiar el cliente.' };
  }
  return { resumen: data as ResumenCambioCliente, error: null };
}

/** Convierte cualquier valor de error del servidor en texto legible. */
function textoDeError(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map((d: any) => d?.msg || d?.message || JSON.stringify(d)).join('; ');
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return String(o.message || o.msg || o.error_description || o.error || JSON.stringify(o));
  }
  return String(v);
}

/** Explicación en lenguaje claro según el código HTTP. */
function causaPorStatus(status: number): string {
  if (status === 401 || status === 403) return 'Salesforce rechazó la autenticación (sesión o credenciales de la integración vencidas).';
  if (status === 404) return 'El usuario no tiene acceso configurado a Salesforce o la ruta de búsqueda no existe.';
  if (status === 400 || status === 422) return 'La solicitud de búsqueda no es válida.';
  if (status === 502 || status === 503 || status === 504) return 'El servidor de Railway no está respondiendo (puede estar reiniciándose).';
  if (status >= 500) return 'Error interno del servidor al consultar Salesforce.';
  return 'Salesforce no pudo completar la búsqueda.';
}

/**
 * Busca cuentas en Salesforce con el mismo servicio que usa la captura de la cotización.
 * Si falla, lanza un Error cuyo mensaje incluye: causa + detalle del servidor + HTTP + respuesta cruda.
 */
export async function buscarCuentasSalesforce(userEmail: string, texto: string): Promise<CuentaSalesforce[]> {
  let res: Response;
  try {
    res = await fetch(RAILWAY_ACCOUNTS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userEmail, query: texto.trim() }),
    });
  } catch (netErr: any) {
    console.error('[accounts/search] Error de red:', netErr);
    throw new Error(
      `No se pudo conectar con el servicio de cuentas en Railway. Revisa tu conexión e intenta de nuevo. (Detalle técnico: ${netErr?.message || String(netErr)})`
    );
  }

  const cuerpo = await res.text();
  let json: any = null;
  try {
    json = cuerpo ? JSON.parse(cuerpo) : null;
  } catch {
    json = null;
  }

  if (res.ok && json && json.success !== false) {
    return (json.records || []) as CuentaSalesforce[];
  }

  const detalle =
    textoDeError(json?.message) ||
    textoDeError(json?.error) ||
    textoDeError(json?.detail) ||
    textoDeError(json?.errors) ||
    textoDeError(json?.msg) ||
    textoDeError(json?.reason);

  const causa = res.ok
    ? 'Salesforce no pudo completar la búsqueda.'
    : causaPorStatus(res.status);

  const crudo = (json ? JSON.stringify(json) : cuerpo.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())
    .substring(0, 300);

  console.error('[accounts/search] Falla', { status: res.status, cuerpo: cuerpo.substring(0, 2000) });

  const partes = [causa];
  if (detalle) partes.push(`Motivo: ${detalle}.`);
  partes.push(`(HTTP ${res.status})`);
  if (!detalle) partes.push(`Respuesta del servidor: ${crudo || '(vacía)'}`);

  throw new Error(partes.join(' '));
}

/** Por qué ya no se puede cambiar el cliente; null si todavía se puede. */
export function motivoBloqueoCliente(enviadaSalesforce: boolean, pdfGenerado: boolean): string | null {
  if (enviadaSalesforce) return 'El cliente ya no se puede cambiar: la cotización se envió a Salesforce.';
  if (pdfGenerado) return 'El cliente ya no se puede cambiar: la cotización ya generó su PDF.';
  return null;
}
