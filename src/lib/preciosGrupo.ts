import { supabase } from './supabase';
import { obtenerGrupoCotizacion } from './disponibilidad';

/**
 * Precio efectivo por código de artículo en el grupo de la cotización abierta
 * (promo > 0, si no precio del grupo; si no hay, grupo Mostrador).
 * Los artículos sin precio en precio_grupo NO aparecen: el llamador conserva el precio de lista.
 * NUNCA lanza: si la consulta falla regresa {} y la búsqueda sigue con el precio de lista.
 */
export async function preciosEfectivos(
  codigos: string[],
  grupo: string | null = obtenerGrupoCotizacion()
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const unicos = Array.from(new Set(codigos.map((c) => (c || '').trim()).filter(Boolean)));
  if (unicos.length === 0) return out;
  try {
    const { data, error } = await supabase.rpc('precios_efectivos_articulos', { p_codigos: unicos, p_grupo: grupo });
    if (error) { console.error('[preciosGrupo] precios_efectivos_articulos:', error); return out; }
    for (const fila of (data as { codigo_art?: string; precio?: number | string }[] | null) || []) {
      const codigo = String(fila?.codigo_art || '').trim();
      const precio = Number(fila?.precio);
      if (codigo && Number.isFinite(precio) && precio > 0) out[codigo] = precio;
    }
  } catch (e) {
    console.error('[preciosGrupo] precios_efectivos_articulos:', e);
  }
  return out;
}
