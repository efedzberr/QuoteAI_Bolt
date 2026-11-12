import { supabase } from './supabase';

/** Campos de conversión que viajan en cada línea (job_lines y estado de la pantalla). */
export interface CamposConversion {
  cantidad_original?: number | null;
  conv_factor?: number | null;
  conv_unidad_cliente?: string | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/** Factor de la línea, o null si no está convertida. */
export function factorDe(linea: CamposConversion | null | undefined): number | null {
  const f = num(linea?.conv_factor);
  return f !== null && f > 0 ? f : null;
}

export function esLineaConvertida(linea: CamposConversion | null | undefined): boolean {
  return factorDe(linea) !== null;
}

/** Cantidad en unidad del cliente que corresponde a una cantidad de catálogo (máx. 3 decimales). */
export function cantidadCliente(cantidadCatalogo: unknown, factor: number): number {
  const c = num(cantidadCatalogo) ?? 0;
  return Math.round((c / factor) * 1000) / 1000;
}

/** Precio por unidad del cliente a partir del precio por unidad de catálogo. */
export function precioCliente(precioCatalogo: unknown, factor: number): number | null {
  const p = num(precioCatalogo);
  return p === null ? null : p * factor;
}

/** Cantidad de catálogo para una cantidad del cliente: SIEMPRE hacia arriba a entero (mínimo 1). */
export function cantidadCatalogoDesdeCliente(cantidadDelCliente: unknown, factor: number): number {
  const c = num(cantidadDelCliente) ?? 0;
  return Math.max(1, Math.ceil(Math.round(c * factor * 1e6) / 1e6));
}

/** "10.152", "45", "0.5": sin ceros de relleno. */
export function formatoCantidad(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 3 });
}

/** "1 KG = 5.319 PZ" */
export function textoEquivalencia(factor: number, unidadCliente: string, unidadCatalogo: string): string {
  const f = factor >= 100 ? factor.toLocaleString('en-US', { maximumFractionDigits: 2 })
    : factor >= 1 ? factor.toLocaleString('en-US', { maximumFractionDigits: 4 })
    : factor.toLocaleString('en-US', { maximumSignificantDigits: 4 });
  return `1 ${unidadCliente} = ${f} ${unidadCatalogo}`;
}

export interface ConversionResuelta {
  factor: number;
  unidadCliente: string;
  unidadCatalogo: string;
}

/** Pregunta a Supabase si hay conversión para ese artículo y esa unidad del cliente. NUNCA lanza: sin conversión o con error regresa null. */
export async function resolverConversionUm(codigoArt: string | null | undefined, unidadCliente: string | null | undefined): Promise<ConversionResuelta | null> {
  const codigo = (codigoArt || '').trim();
  const unidad = (unidadCliente || '').trim();
  if (!codigo || !unidad) return null;
  try {
    const { data, error } = await supabase.rpc('conversion_um_resolver', { p_codigo_art: codigo, p_unidad_cliente: unidad });
    if (error) { console.error('[conversionUm] conversion_um_resolver:', error); return null; }
    const fila = Array.isArray(data) ? data[0] : data;
    const factor = num(fila?.factor);
    if (!fila || factor === null || factor <= 0) return null;
    return { factor, unidadCliente: String(fila.unidad_cliente_codigo || unidad).toUpperCase(), unidadCatalogo: String(fila.unidad_catalogo || '') };
  } catch (e) {
    console.error('[conversionUm] conversion_um_resolver:', e);
    return null;
  }
}

/** Unidad en la que se puede cotizar un artículo. factor = unidades de catálogo por 1 de esta unidad. */
export interface OpcionUnidadLinea {
  unidad: string;
  descripcion: string;
  factor: number;
  esCatalogo: boolean;
}

/** Unidades disponibles por código de artículo (catálogo + conversiones de JD Edwards). NUNCA lanza. */
export async function unidadesConvertibles(codigos: string[]): Promise<Record<string, OpcionUnidadLinea[]>> {
  const out: Record<string, OpcionUnidadLinea[]> = {};
  const unicos = Array.from(new Set(codigos.map((c) => (c || '').trim()).filter(Boolean)));
  for (let i = 0; i < unicos.length; i += 150) {
    const lote = unicos.slice(i, i + 150);
    try {
      const { data, error } = await supabase.rpc('conversion_um_unidades_lote', { p_codigos: lote });
      if (error) { console.error('[conversionUm] conversion_um_unidades_lote:', error); continue; }
      for (const c of lote) out[c] = out[c] || [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const fila of (data as any[]) || []) {
        const factor = num(fila?.factor);
        const codigo = String(fila?.codigo_art || '').trim();
        if (!codigo || factor === null || factor <= 0) continue;
        (out[codigo] = out[codigo] || []).push({
          unidad: String(fila.unidad || '').toUpperCase(),
          descripcion: String(fila.descripcion || fila.unidad || ''),
          factor,
          esCatalogo: fila.es_catalogo === true,
        });
      }
    } catch (e) {
      console.error('[conversionUm] conversion_um_unidades_lote:', e);
    }
  }
  for (const c of Object.keys(out)) out[c].sort((a, b) => Number(b.esCatalogo) - Number(a.esCatalogo) || a.unidad.localeCompare(b.unidad));
  return out;
}
