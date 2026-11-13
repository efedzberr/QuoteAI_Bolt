import { supabase } from './supabase';

export type FuenteTc = 'banxico' | 'dof' | 'ecb' | 'market';
export const FUENTES_TC: FuenteTc[] = ['banxico', 'dof', 'ecb', 'market'];

export interface Moneda {
  codigo: string;
  nombre: string;
  simbolo: string;
  decimales: number;
  es_base: boolean;
  activa: boolean;
  /** Pesos (MXN) por 1 unidad de la moneda. La base vale 1. */
  tipo_cambio: number | null;
  tc_fuente: string | null;
  tc_fecha: string | null;
  tc_actualizado_at: string | null;
  tc_es_auto: boolean;
  auto_actualizar: boolean;
  auto_fuente: FuenteTc;
  orden: number;
}

/** Moneda y tipo de cambio fijados en una propuesta. */
export interface MonedaPropuesta {
  moneda: string;
  tipoCambio: number | null;
  fuente: string | null;
  fecha: string | null;
}

export const MONEDA_PROPUESTA_BASE: MonedaPropuesta = { moneda: 'MXN', tipoCambio: null, fuente: null, fecha: null };

const COLUMNAS = 'codigo, nombre, simbolo, decimales, es_base, activa, tipo_cambio, tc_fuente, tc_fecha, tc_actualizado_at, tc_es_auto, auto_actualizar, auto_fuente, orden';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const aMoneda = (r: any): Moneda => ({
  ...r,
  decimales: Number(r.decimales ?? 2),
  tipo_cambio: r.tipo_cambio === null || r.tipo_cambio === undefined ? null : Number(r.tipo_cambio),
});

/** Todas las monedas del catálogo (para Ajustes). */
export async function cargarMonedas(): Promise<Moneda[]> {
  const { data, error } = await supabase.from('monedas').select(COLUMNAS).order('orden').order('codigo');
  if (error) { console.error('[monedas] cargarMonedas:', error); return []; }
  return (data || []).map(aMoneda);
}

/** Monedas que el ejecutivo puede elegir: activas y con tipo de cambio. */
export async function cargarMonedasActivas(): Promise<Moneda[]> {
  const todas = await cargarMonedas();
  return todas.filter((m) => m.activa && (m.es_base || (m.tipo_cambio !== null && m.tipo_cambio > 0)));
}

export function nombreFuenteTc(fuente: string | null | undefined): string {
  switch ((fuente || '').toLowerCase()) {
    case 'banxico': return 'Banxico FIX';
    case 'dof': return 'Diario Oficial (DOF)';
    case 'ecb': return 'Banco Central Europeo';
    case 'market': return 'Mercado';
    case 'manual': return 'Manual';
    default: return fuente || '';
  }
}

/** "aaaa-mm-dd" → "dd/mm/aaaa". */
export function fechaTc(fecha: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

export function formatoTc(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Precio en pesos → precio en la moneda de la propuesta (2 decimales). Sin tipo de cambio regresa el mismo valor. */
export function precioEnMoneda(precioMxn: number | null | undefined, tc: number | null): number | null {
  if (precioMxn === null || precioMxn === undefined) return null;
  const n = Number(precioMxn);
  if (!Number.isFinite(n)) return null;
  return tc && tc > 0 ? round2(n / tc) : n;
}

/** Copia de las líneas con los precios en la moneda de la propuesta. NO usar para guardar ni para Salesforce. */
export function lineasEnMoneda<T extends { matched_unit_price?: number | null }>(lineas: T[], tc: number | null): T[] {
  if (!tc || tc <= 0) return lineas;
  return lineas.map((l) => {
    const copia: Record<string, unknown> = { ...l, matched_unit_price: precioEnMoneda(l.matched_unit_price, tc), tc_aplicado: tc };
    const lista = (l as Record<string, unknown>).precio_lista;
    if (typeof lista === 'number') copia.precio_lista = precioEnMoneda(lista, tc);
    return copia as T;
  });
}

/** Subtotal en la moneda de la propuesta: suma de cantidad × precio ya convertido y redondeado. */
export function subtotalEnMoneda(lineas: { quantity?: number | null; matched_unit_price?: number | null; ignored?: boolean }[], tc: number | null): number {
  return round2(lineas.reduce((suma, l) => {
    if (l.ignored) return suma;
    return suma + (Number(l.quantity) || 0) * (precioEnMoneda(l.matched_unit_price, tc) || 0);
  }, 0));
}

/** Variación porcentual del tipo de cambio vigente contra el de la propuesta (positivo = subió). */
export function variacionTc(dePropuesta: number, vigente: number): number {
  return dePropuesta > 0 ? ((vigente - dePropuesta) / dePropuesta) * 100 : 0;
}

/** Fija en la propuesta la moneda y el tipo de cambio vigente. También sirve para actualizarlo. */
export async function fijarMonedaCotizacion(referencia: string, codigo: string): Promise<{ data: MonedaPropuesta | null; error: string | null }> {
  const { data, error } = await supabase.rpc('cotizacion_fijar_moneda', { p_referencia: referencia, p_moneda: codigo });
  if (error) return { data: null, error: error.message || 'No se pudo cambiar la moneda.' };
  const d = (data || {}) as { moneda?: string; tipo_cambio?: number | string | null; tc_fuente?: string | null; tc_fecha?: string | null };
  return {
    data: {
      moneda: String(d.moneda || 'MXN'),
      tipoCambio: d.tipo_cambio === null || d.tipo_cambio === undefined ? null : Number(d.tipo_cambio),
      fuente: d.tc_fuente ?? null,
      fecha: d.tc_fecha ?? null,
    },
    error: null,
  };
}

// ── Administración ──────────────────────────────────────────────────────────

export async function actualizarMoneda(codigo: string, cambios: Partial<Pick<Moneda, 'activa' | 'auto_actualizar' | 'auto_fuente'>>): Promise<string | null> {
  const { error } = await supabase.from('monedas').update(cambios).eq('codigo', codigo);
  return error ? error.message : null;
}

export async function fijarTipoCambio(codigo: string, tipoCambio: number, fuente: FuenteTc | 'manual', fecha: string | null): Promise<string | null> {
  const { error } = await supabase
    .from('monedas')
    .update({ tipo_cambio: tipoCambio, tc_fuente: fuente, tc_fecha: fecha, tc_es_auto: false })
    .eq('codigo', codigo);
  return error ? error.message : null;
}

export interface HistorialTc {
  id: number;
  moneda: string;
  tipo_cambio: number;
  fuente: string | null;
  fecha_fuente: string | null;
  es_auto: boolean;
  created_at: string;
}

export async function cargarHistorialTc(codigo: string): Promise<HistorialTc[]> {
  const { data, error } = await supabase
    .from('tipo_cambio_historial')
    .select('id, moneda, tipo_cambio, fuente, fecha_fuente, es_auto, created_at')
    .eq('moneda', codigo)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) { console.error('[monedas] cargarHistorialTc:', error); return []; }
  return ((data || []) as HistorialTc[]).map((r) => ({ ...r, tipo_cambio: Number(r.tipo_cambio) }));
}

export interface CotizacionFuente { source: FuenteTc; ok: boolean; rate: number | null; date: string | null; url: string; error: string | null }
export interface SugerenciaTc {
  currency_code: string;
  sources: CotizacionFuente[];
  advice: { recommended: FuenteTc; explanation: string } | null;
  advice_error: string | null;
}

function urlExchangeRates(): string {
  return `${import.meta.env.VITE_SUPABASE_URL as string}/functions/v1/exchange-rates`;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function llamarExchangeRates(body: Record<string, unknown>): Promise<{ ok: boolean; json: any }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    const res = await fetch(urlExchangeRates(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    return { ok: res.ok, json };
  } catch (e) {
    console.error('[monedas] exchange-rates:', e);
    return { ok: false, json: {} };
  }
}

/** Consulta las tres fuentes y la recomendación de la IA para una moneda. */
export async function consultarFuentesTc(codigo: string): Promise<SugerenciaTc | null> {
  const { ok, json } = await llamarExchangeRates({ action: 'suggest', currency_code: codigo });
  return ok && Array.isArray(json?.sources) ? (json as SugerenciaTc) : null;
}

/** "Actualizar ahora": corre la actualización automática sin esperar al trabajo diario. */
export async function actualizarTiposDeCambioAhora(): Promise<{ updated: number; failed: number } | null> {
  const { ok, json } = await llamarExchangeRates({ action: 'auto' });
  return ok ? { updated: Number(json?.updated) || 0, failed: Number(json?.failed) || 0 } : null;
}

/** Prefijo con que se escribe un importe: MX$ para pesos, US$ para dólares; otras monedas, su código. */
export function prefijoMoneda(codigo: string | null | undefined): string {
  const c = (codigo || 'MXN').toUpperCase();
  if (c === 'MXN') return 'MX$';
  if (c === 'USD') return 'US$';
  return `${c} `;
}

/** Importe con el prefijo de su moneda y 2 decimales: "US$1,721.38", "MX$426.50", "EUR 98.10". */
export function formatoImporte(valor: number | null | undefined, codigo: string | null | undefined): string {
  const n = Number(valor);
  const numero = (Number.isFinite(n) ? Math.abs(n) : 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${Number.isFinite(n) && n < 0 ? '-' : ''}${prefijoMoneda(codigo)}${numero}`;
}

/** Prefijo para el PDF: vacío en pesos (el PDF en pesos no cambia), "US$" en dólares, código en las demás. */
export function prefijoMonedaPdf(codigo: string | null | undefined): string {
  const c = (codigo || 'MXN').toUpperCase();
  return c === 'MXN' ? '' : prefijoMoneda(c);
}
