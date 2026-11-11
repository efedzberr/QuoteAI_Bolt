import { supabase } from './supabase';

const RAILWAY_UNITS_URL = 'https://quoteai-production.up.railway.app/units/resolve';

export type OrigenUnidad = 'exacta' | 'diccionario' | 'ia' | 'sin_resolver' | 'ejecutivo';

export interface OpcionUnidad { codigo: string; descripcion: string; clase: 'unidad' | 'familia'; }

export interface UnidadReconocida {
  texto: string;
  codigo: string | null;
  descripcion: string | null;
  origen: OrigenUnidad;
}

/** Lo que viaja a Railway en /match/start: { TEXTO: { codigo, origen } }. codigo null = "No sé". */
export type UnidadesResueltas = Record<string, { codigo: string | null; origen: Exclude<OrigenUnidad, 'sin_resolver'> }>;

export interface EstadoUnidades {
  resueltas: UnidadesResueltas;
  pendientes: number;   // unidades distintas que el ejecutivo todavía debe elegir
  cargando: boolean;    // se está consultando el reconocimiento
}

export const ESTADO_UNIDADES_VACIO: EstadoUnidades = { resueltas: {}, pendientes: 0, cargando: false };

/** Misma normalización que Railway y Supabase: mayúsculas, sin espacios de más. */
export function normUnidad(u: unknown): string {
  return String(u ?? '').replace(/\s+/g, ' ').trim().toUpperCase().slice(0, 40);
}

export interface RespuestaUnidades {
  disponible: boolean;
  opciones: OpcionUnidad[];
  unidades: UnidadReconocida[];
}

/** Reconoce las unidades en Railway. Lanza si la red o el servicio fallan (el panel lo maneja). */
export async function resolverUnidades(textos: string[]): Promise<RespuestaUnidades> {
  const resp = await fetch(RAILWAY_UNITS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ unidades: textos }),
  });
  if (!resp.ok) throw new Error(`units/resolve respondió ${resp.status}`);
  const data = await resp.json();
  return {
    disponible: data?.disponible !== false,
    opciones: Array.isArray(data?.opciones) ? data.opciones : [],
    unidades: Array.isArray(data?.unidades) ? data.unidades : [],
  };
}

/** Guarda en el diccionario la unidad que eligió el ejecutivo. NUNCA lanza. */
export async function aprenderUnidad(texto: string, codigo: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('aprender_unidad', { p_unidad_cliente: texto, p_codigo: codigo });
    if (error) console.error('[unidadesMedida] aprender_unidad:', error);
  } catch (e) {
    console.error('[unidadesMedida] aprender_unidad:', e);
  }
}

/** Al validar la cotización: lo que interpretó la IA pasa al diccionario. NUNCA lanza. */
export async function aprenderUnidadesIa(referencia: string | null | undefined): Promise<void> {
  if (!referencia) return;
  try {
    const { error } = await supabase.rpc('aprender_unidades_job', { p_referencia: referencia });
    if (error) console.error('[unidadesMedida] aprender_unidades_job:', error);
  } catch (e) {
    console.error('[unidadesMedida] aprender_unidades_job:', e);
  }
}
