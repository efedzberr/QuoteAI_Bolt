import { supabase } from './supabase';

export interface AlmacenExistencia {
  almacen_id: string;
  almacen_nombre: string;
  cantidad: number;
}

export interface InventarioArticulo {
  inventario_total: number;
  inventario_almacenes: AlmacenExistencia[];
}

export async function fetchInventarioArticulos(
  codigos: string[]
): Promise<Record<string, InventarioArticulo> | null> {
  const unicos = Array.from(new Set(codigos.map((c) => c.trim()).filter(Boolean)));
  if (unicos.length === 0) return {};
  const { data, error } = await supabase.rpc('inventario_articulos', { p_codigos: unicos });
  if (error) {
    console.error('[inventario] inventario_articulos error:', error);
    return null;
  }
  return (data as Record<string, InventarioArticulo> | null) ?? null;
}
