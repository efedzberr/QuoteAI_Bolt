import { supabase } from './supabase';

/**
 * Disponibilidad de un artículo según la RPC disponibilidad_articulos (QA_DISP1).
 * Un artículo es especial cuando su precio en el grupo del cliente está inactivo
 * (precio_grupo.activo = falso). En pantalla lleva el badge «ESP».
 */
export interface DisponibilidadArticulo {
  /** false = el precio del artículo está inactivo en el grupo: lleva el badge ESP. */
  disponible: boolean;
  /** Grupo de precios que se evaluó. */
  grupo: string | null;
}

export type MapaDisponibilidad = Record<string, DisponibilidadArticulo>;

// Grupo de precios de la cotización abierta. Lo fija Validar productos al cargar la
// cotización y lo usan los buscadores de producto (solo hay una cotización abierta a la vez).
let grupoCotizacion: string | null = null;

export function fijarGrupoCotizacion(grupo: string | null): void {
  grupoCotizacion = grupo && grupo.trim() ? grupo.trim() : null;
}

/**
 * Disponibilidad de una lista de códigos de artículo en un grupo de precios. Devuelve un mapa
 * codigo -> disponibilidad solo con los artículos que tienen precio en ese grupo.
 * Sin grupo no hay nada que evaluar: devuelve un mapa vacío sin consultar.
 * Devuelve null si la consulta falla o el usuario no tiene permiso; en ese caso no se marca nada.
 */
export async function fetchDisponibilidadArticulos(
  codigos: string[],
  grupo: string | null = grupoCotizacion
): Promise<MapaDisponibilidad | null> {
  const unicos = Array.from(new Set(codigos.map((c) => (c || '').trim()).filter(Boolean)));
  const grupoLimpio = grupo && grupo.trim() ? grupo.trim() : null;
  if (unicos.length === 0 || !grupoLimpio) return {};
  const { data, error } = await supabase.rpc('disponibilidad_articulos', { p_codigos: unicos, p_grupo: grupoLimpio });
  if (error) {
    console.error('[disponibilidad] disponibilidad_articulos error:', error);
    return null;
  }
  return (data as MapaDisponibilidad | null) ?? null;
}

/** Texto emergente del badge ESP. */
export function motivoEspecial(d: DisponibilidadArticulo): string {
  return `Artículo especial (ESP): su precio está inactivo en Precio grupo${d.grupo ? ` (${d.grupo})` : ''}.`;
}
