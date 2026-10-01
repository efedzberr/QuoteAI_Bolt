import { supabase } from './supabase';
import type { FilterCriterion, ListViewColumn, ListViewSort, OwnerScope } from './listViews';

/**
 * Consulta persistente por usuario y objeto de Ajustes > Objetos y campos.
 * Guarda lo que el usuario dejo (vista, busqueda, filtros temporales, orden, pestana y
 * analisis) en user_list_view_preferences.consulta para restaurarlo en cualquier equipo.
 * Se mantiene una copia en memoria para que el cambio de objeto o de pestana sea inmediato.
 */

export type ObjectTab = 'records' | 'fields' | 'analysis';

export interface SessionOverrides {
  criteria: FilterCriterion[];
  logic: string;
  ownerScope: OwnerScope;
  columns: ListViewColumn[] | null;
  sorting: ListViewSort[] | null;
  /** Filtro temporal enviado desde la pestana Analisis (clic en una barra). */
  drill?: { etiqueta: string; previo: SessionOverrides | null; efectivosPrevios?: CriteriosEfectivos | null } | null;
}

/** Filtros efectivos de la lista (vista + filtros temporales). Los usa la pestana Analisis. */
export interface CriteriosEfectivos {
  criteria: FilterCriterion[];
  logic: string;
  ownerScope: OwnerScope;
  viewName: string | null;
}

export interface ObjectConsulta {
  tab?: ObjectTab;
  viewId?: string | null;
  search?: string;
  session?: SessionOverrides | null;
  efectivos?: CriteriosEfectivos | null;
  analisis?: Record<string, unknown> | null;
}

const memoria = new Map<string, ObjectConsulta>();
const pendientes = new Map<string, ReturnType<typeof setTimeout>>();
let uidActual: string | null = null;

supabase.auth.onAuthStateChange((_evento, sesion) => {
  uidActual = sesion?.user?.id ?? null;
});

async function obtenerUid(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  uidActual = data.session?.user?.id ?? null;
  return uidActual;
}

const clave = (uid: string, objeto: string) => `${uid}|${objeto}`;

/** Lee la consulta guardada (memoria primero, despues Supabase). */
export async function cargarConsulta(objeto: string): Promise<ObjectConsulta> {
  const uid = await obtenerUid();
  if (!uid) return {};
  const k = clave(uid, objeto);
  const enMemoria = memoria.get(k);
  if (enMemoria) return enMemoria;
  const { data, error } = await supabase
    .from('user_list_view_preferences')
    .select('consulta')
    .eq('user_id', uid)
    .eq('object', objeto)
    .maybeSingle();
  if (error) console.error('[objectState] No se pudo leer la consulta guardada:', error);
  if (!memoria.has(k)) memoria.set(k, ((data?.consulta as ObjectConsulta | null) ?? {}));
  return memoria.get(k)!;
}

/** Lectura inmediata (solo memoria); null si aun no se ha cargado. */
export function leerConsulta(objeto: string): ObjectConsulta | null {
  return uidActual ? memoria.get(clave(uidActual, objeto)) ?? null : null;
}

/** Actualiza la consulta en memoria y la guarda en Supabase 800 ms despues del ultimo cambio. */
export function guardarConsulta(objeto: string, cambios: Partial<ObjectConsulta>): void {
  if (!uidActual) return;
  const uid = uidActual;
  const k = clave(uid, objeto);
  const previa = memoria.get(k) ?? {};
  const siguiente = { ...previa, ...cambios };
  if (JSON.stringify(siguiente) === JSON.stringify(previa)) return;
  memoria.set(k, siguiente);
  const t = pendientes.get(k);
  if (t) clearTimeout(t);
  pendientes.set(k, setTimeout(() => { void persistir(uid, objeto); }, 800));
}

async function persistir(uid: string, objeto: string): Promise<void> {
  const k = clave(uid, objeto);
  pendientes.delete(k);
  const consulta = memoria.get(k) ?? {};
  const { error } = await supabase
    .from('user_list_view_preferences')
    .upsert({ user_id: uid, object: objeto, consulta }, { onConflict: 'user_id,object' });
  if (error) console.error('[objectState] No se pudo guardar la consulta:', error);
}

/** Guarda de inmediato lo que este pendiente (al cerrar o recargar la pestana del navegador). */
export function guardarPendientes(): void {
  for (const [k, t] of pendientes) {
    clearTimeout(t);
    const i = k.indexOf('|');
    void persistir(k.slice(0, i), k.slice(i + 1));
  }
}

if (typeof window !== 'undefined') window.addEventListener('beforeunload', guardarPendientes);

/**
 * Filtro enviado desde Analisis: agrega criterios temporales a lo que hoy filtra la lista,
 * deja la pestana en Registros y recuerda el estado previo para poder quitarlo.
 */
export function aplicarDrill(objeto: string, extra: FilterCriterion[], etiqueta: string, viewId?: string | null): void {
  const c = leerConsulta(objeto) ?? {};
  const previo = c.session?.drill ? c.session.drill.previo : (c.session ?? null);
  const efectivosPrevios = c.session?.drill ? (c.session.drill.efectivosPrevios ?? null) : (c.efectivos ?? null);
  const base: SessionOverrides = c.session ?? {
    criteria: c.efectivos?.criteria ?? [],
    logic: c.efectivos?.logic ?? '',
    ownerScope: c.efectivos?.ownerScope ?? 'all',
    columns: null,
    sorting: null,
  };
  const n = base.criteria.length;
  const criteria = [...base.criteria, ...extra];
  const logic = base.logic.trim() ? `(${base.logic}) AND ${extra.map((_, i) => n + i + 1).join(' AND ')}` : '';
  const session: SessionOverrides = {
    criteria, logic, ownerScope: base.ownerScope, columns: base.columns, sorting: base.sorting,
    drill: { etiqueta, previo, efectivosPrevios },
  };
  guardarConsulta(objeto, {
    tab: 'records',
    viewId: c.viewId ?? viewId ?? null,
    session,
    efectivos: { criteria, logic, ownerScope: base.ownerScope, viewName: c.efectivos?.viewName ?? null },
  });
}

/** Quita el filtro enviado desde Analisis y regresa la lista a como estaba antes. */
export function quitarDrill(objeto: string): void {
  const c = leerConsulta(objeto);
  const d = c?.session?.drill;
  if (!c || !d) return;
  guardarConsulta(objeto, { session: d.previo, efectivos: d.efectivosPrevios ?? c.efectivos ?? null });
}
