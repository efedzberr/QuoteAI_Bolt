import { supabase } from './supabase';

export type OrigenEnvioSf = 'automatico' | 'manual';
export type OperacionEnvioSf = 'crear' | 'actualizar';
export type ResultadoEnvioSf = 'exito' | 'exito_con_aviso' | 'error';
export type FaseEnvioSf = 'productos' | 'oportunidad' | 'pdf';

/** Lo que se manda a la RPC registrar_envio_sf. El usuario lo resuelve el servidor. */
export interface RegistroEnvioSf {
  job_id?: string | null;
  referencia: string;
  nombre_proyecto?: string | null;
  cliente?: string | null;
  no_cliente?: string | null;
  sf_account_id?: string | null;
  origen: OrigenEnvioSf;
  operacion: OperacionEnvioSf;
  resultado: ResultadoEnvioSf;
  fase?: FaseEnvioSf | null;
  lineas: number;
  total: number;
  productos_nuevos?: number;
  intentos?: number;
  http_status?: number | null;
  mensaje?: string | null;
  sf_opportunity_id?: string | null;
  sf_quote_id?: string | null;
  pdf_adjuntado?: boolean | null;
  duracion_ms?: number;
  payload_enviado?: unknown;
  respuesta_sf?: unknown;
}

/** Registra un intento en sf_envios_log. NUNCA lanza: si el log falla, solo console.error. */
export async function registrarEnvioSf(r: RegistroEnvioSf): Promise<void> {
  try {
    const { error } = await supabase.rpc('registrar_envio_sf', { p: r });
    if (error) console.error('[sfEnvios] registrar_envio_sf:', error);
  } catch (e) {
    console.error('[sfEnvios] registrar_envio_sf:', e);
  }
}

/** Referencias con un envío en curso en esta pestaña. Evita dobles envíos aunque el componente se vuelva a montar. */
export const enviosEnCurso = new Set<string>();

/** Copia del body para el log: sin el PDF en base64. */
export function payloadParaLog(body: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!body) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { pdfBase64: _omitido, ...resto } = body as Record<string, unknown> & { pdfBase64?: unknown };
  return resto;
}

/** URL para abrir un registro en Salesforce a partir de la URL base de la org. */
export function urlRegistroSf(instanceUrl: string | null | undefined, id: string | null | undefined): string | null {
  const base = (instanceUrl || '').trim().replace(/\/+$/, '');
  if (!base || !id) return null;
  if (!/^https:\/\//i.test(base)) return null;
  return `${base}/${id}`;
}
