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

/** Busca cuentas en Salesforce con el mismo servicio que usa la captura de la cotización. */
export async function buscarCuentasSalesforce(userEmail: string, texto: string): Promise<CuentaSalesforce[]> {
  const res = await fetch(RAILWAY_ACCOUNTS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userEmail, query: texto.trim() }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || 'Error buscando cuentas');
  return (json.records || []) as CuentaSalesforce[];
}

/** Por qué ya no se puede cambiar el cliente; null si todavía se puede. */
export function motivoBloqueoCliente(enviadaSalesforce: boolean, pdfGenerado: boolean): string | null {
  if (enviadaSalesforce) return 'El cliente ya no se puede cambiar: la cotización se envió a Salesforce.';
  if (pdfGenerado) return 'El cliente ya no se puede cambiar: la cotización ya generó su PDF.';
  return null;
}
