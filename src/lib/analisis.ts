import { supabase } from './supabase';
import { type AdminObjectDef, type ObjectFieldDef, type AnalisisPresetDef, fieldMap } from './objectCatalog';
import {
  type FilterCriterion, type LogicNode, CURRENT_USER_TOKEN,
  parseLogic, validateFilterLogic, rangoCriterioFecha, parseFechaLocal,
  fetchListViews, fetchPrefs, viewToCriteria,
} from './listViews';
import { cargarConsulta, guardarConsulta, type CriteriosEfectivos } from './objectState';
import type { SheetData } from 'write-excel-file/universal';

// ---------------- Tipos ----------------
export type ModoAnalisis = 'fecha' | 'campo';
export type Granularidad = 'day' | 'week' | 'month' | 'year';
export type TipoMedida = 'conteo' | 'suma' | 'promedio';
export type Periodo = 'todo' | 'ult7' | 'ult30' | 'ult90' | 'este_mes' | 'mes_pasado' | 'este_anio' | 'personalizado';

export interface AnalisisConfig {
  modo: ModoAnalisis;
  campoFecha: string;
  granularidad: Granularidad;
  campoGrupo: string | null;
  top: number;
  medida: { tipo: TipoMedida; campo: string | null };
  periodo: Periodo;
  desde: string | null;   // 'YYYY-MM-DD' (periodo personalizado)
  hasta: string | null;   // 'YYYY-MM-DD' inclusive (periodo personalizado)
  comparar: boolean;
}

export interface FilaAnalisis {
  clave: string | null;
  registros: number;
  medida: number | null;
  ant_registros?: number | null;
  ant_medida?: number | null;
}

export interface ResultadoAnalisis {
  kpis: { registros: number; medida: number | null; periodos: number; fecha_min: string | null; fecha_max: string | null };
  kpis_anterior: { registros: number; medida: number | null } | null;
  filas: FilaAnalisis[];
  otros: { grupos: number; registros: number; medida: number | null } | null;
  total_grupos: number;
}

export const GRANULARIDADES: { id: Granularidad; label: string; plural: string }[] = [
  { id: 'day', label: 'Día', plural: 'Días' },
  { id: 'week', label: 'Semana', plural: 'Semanas' },
  { id: 'month', label: 'Mes', plural: 'Meses' },
  { id: 'year', label: 'Año', plural: 'Años' },
];

export const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'todo', label: 'Todo' },
  { id: 'ult7', label: 'Últimos 7 días' },
  { id: 'ult30', label: 'Últimos 30 días' },
  { id: 'ult90', label: 'Últimos 90 días' },
  { id: 'este_mes', label: 'Este mes' },
  { id: 'mes_pasado', label: 'Mes pasado' },
  { id: 'este_anio', label: 'Este año' },
  { id: 'personalizado', label: 'Personalizado' },
];

// ---------------- Campos disponibles por tipo ----------------
export const camposFecha = (def: AdminObjectDef) => def.fields.filter(f => f.dataType === 'date' || f.dataType === 'datetime');
export const camposAgrupables = (def: AdminObjectDef) => def.fields.filter(f => ['text', 'picklist', 'boolean', 'user'].includes(f.dataType));
export const camposNumericos = (def: AdminObjectDef) => def.fields.filter(f => f.dataType === 'number' || f.dataType === 'currency');

export function configInicial(def: AdminObjectDef): AnalisisConfig {
  const fechas = camposFecha(def);
  const campoFecha = def.analisis?.fecha && fechas.some(f => f.key === def.analisis!.fecha) ? def.analisis.fecha : (fechas[0]?.key ?? 'created_at');
  return {
    modo: 'fecha', campoFecha, granularidad: 'day', campoGrupo: camposAgrupables(def)[0]?.key ?? null, top: 15,
    medida: { tipo: 'conteo', campo: null }, periodo: 'todo', desde: null, hasta: null, comparar: false,
  };
}

/** Normaliza una configuración guardada (favorito o consulta) contra los campos actuales del objeto. */
export function normalizarConfig(def: AdminObjectDef, raw: unknown): AnalisisConfig {
  const base = configInicial(def);
  const c = { ...base, ...((raw as Partial<AnalisisConfig>) || {}) };
  if (!camposFecha(def).some(f => f.key === c.campoFecha)) c.campoFecha = base.campoFecha;
  if (c.campoGrupo && !camposAgrupables(def).some(f => f.key === c.campoGrupo)) c.campoGrupo = base.campoGrupo;
  if (c.medida?.tipo !== 'conteo' && !(c.medida?.campo && camposNumericos(def).some(f => f.key === c.medida.campo))) c.medida = { tipo: 'conteo', campo: null };
  if (!GRANULARIDADES.some(g => g.id === c.granularidad)) c.granularidad = 'day';
  if (!PERIODOS.some(p => p.id === c.periodo)) c.periodo = 'todo';
  c.top = Math.min(50, Math.max(5, Number(c.top) || 15));
  return c;
}

export function aplicarPreset(def: AdminObjectDef, actual: AnalisisConfig, p: AnalisisPresetDef): AnalisisConfig {
  return normalizarConfig(def, {
    ...actual,
    modo: p.modo,
    campoFecha: p.campoFecha ?? actual.campoFecha,
    granularidad: p.granularidad ?? actual.granularidad,
    campoGrupo: p.campoGrupo ?? actual.campoGrupo,
    medida: p.medida ? { tipo: p.medida.tipo, campo: p.medida.campo ?? null } : { tipo: 'conteo', campo: null },
  });
}

// ---------------- Periodos (fechas locales) ----------------
const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sumarDias = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sumarMeses = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export interface Rango { desde: Date | null; hasta: Date | null }

/** Rango [desde, hasta) del periodo elegido. "Este mes" y "Este año" llegan hasta hoy. */
export function rangoPeriodo(cfg: AnalisisConfig): Rango {
  const hoy = inicioDia(new Date());
  const manana = sumarDias(hoy, 1);
  switch (cfg.periodo) {
    case 'ult7': return { desde: sumarDias(hoy, -6), hasta: manana };
    case 'ult30': return { desde: sumarDias(hoy, -29), hasta: manana };
    case 'ult90': return { desde: sumarDias(hoy, -89), hasta: manana };
    case 'este_mes': return { desde: new Date(hoy.getFullYear(), hoy.getMonth(), 1), hasta: manana };
    case 'mes_pasado': return { desde: new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: new Date(hoy.getFullYear(), hoy.getMonth(), 1) };
    case 'este_anio': return { desde: new Date(hoy.getFullYear(), 0, 1), hasta: manana };
    case 'personalizado': {
      const d = cfg.desde ? parseFechaLocal(cfg.desde) : null;
      const h = cfg.hasta ? parseFechaLocal(cfg.hasta) : null;
      return { desde: d ? inicioDia(d) : null, hasta: h ? sumarDias(inicioDia(h), 1) : null };
    }
    default: return { desde: null, hasta: null };
  }
}

/** Periodo anterior comparable. Mes y año: el mismo tramo del mes / año anterior. */
export function rangoAnterior(cfg: AnalisisConfig, r: Rango): { desde: Date; hasta: Date } | null {
  if (!r.desde || !r.hasta) return null;
  if (cfg.periodo === 'este_mes' || cfg.periodo === 'mes_pasado') return { desde: sumarMeses(r.desde, -1), hasta: sumarMeses(r.hasta, -1) };
  if (cfg.periodo === 'este_anio') return { desde: sumarMeses(r.desde, -12), hasta: sumarMeses(r.hasta, -12) };
  const ms = r.hasta.getTime() - r.desde.getTime();
  return { desde: new Date(r.desde.getTime() - ms), hasta: new Date(r.desde) };
}

export function etiquetaComparacion(cfg: AnalisisConfig): string {
  switch (cfg.periodo) {
    case 'ult7': return 'vs. 7 días anteriores';
    case 'ult30': return 'vs. 30 días anteriores';
    case 'ult90': return 'vs. 90 días anteriores';
    case 'este_mes': return 'vs. mismo periodo del mes pasado';
    case 'mes_pasado': return 'vs. el mes anterior';
    case 'este_anio': return 'vs. mismo periodo del año pasado';
    default: return 'vs. periodo anterior';
  }
}

export function etiquetaPeriodo(cfg: AnalisisConfig): string {
  if (cfg.periodo !== 'personalizado') return PERIODOS.find(p => p.id === cfg.periodo)?.label ?? 'Todo';
  const f = (s: string | null) => (s ? fechaCorta(parseFechaLocal(s)) : '…');
  return `${f(cfg.desde)} – ${f(cfg.hasta)}`;
}

// ---------------- Filtros de la lista → árbol JSON (mismo resultado que buildPostgrestFilter) ----------------
export type Nodo = { and: Nodo[] } | { or: Nodo[] } | { campo: string; op: string; valor?: string };

const patronLike = (v: string) => v.replace(/[%_]/g, m => `\\${m}`);

export function nodoCriterio(c: FilterCriterion, f: ObjectFieldDef, userId: string | null): Nodo | null {
  const col = f.key;
  const v = c.value ?? '';
  if (f.dataType === 'text') {
    if (c.operator === 'is_empty') return { campo: col, op: 'empty' };
    if (c.operator === 'not_empty') return { campo: col, op: 'not_empty' };
    if (!v.trim()) return null;
    switch (c.operator) {
      case 'equals': return { campo: col, op: 'ilike', valor: patronLike(v) };
      case 'not_equal': return { campo: col, op: 'not_ilike', valor: patronLike(v) };
      case 'contains': return { campo: col, op: 'ilike', valor: `%${patronLike(v)}%` };
      case 'not_contains': return { campo: col, op: 'not_ilike', valor: `%${patronLike(v)}%` };
      case 'starts_with': return { campo: col, op: 'ilike', valor: `${patronLike(v)}%` };
      default: return null;
    }
  }
  if (f.dataType === 'number' || f.dataType === 'currency') {
    const n = parseFloat(v);
    if (isNaN(n) || !['eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(c.operator)) return null;
    return { campo: col, op: c.operator, valor: String(n) };
  }
  if (f.dataType === 'date' || f.dataType === 'datetime') {
    const r = rangoCriterioFecha(v);
    if (!r) return null;
    const s = r.start.toISOString(), e = r.end.toISOString();
    switch (c.operator) {
      case 'equals': return { and: [{ campo: col, op: 'gte', valor: s }, { campo: col, op: 'lt', valor: e }] };
      case 'before': return { campo: col, op: 'lt', valor: s };
      case 'after': return { campo: col, op: 'gte', valor: e };
      case 'on_or_before': return { campo: col, op: 'lt', valor: e };
      case 'on_or_after': return { campo: col, op: 'gte', valor: s };
      default: return null;
    }
  }
  if (f.dataType === 'picklist' || f.dataType === 'user') {
    let val = v;
    if (f.dataType === 'user' && val === CURRENT_USER_TOKEN) {
      if (!userId) return null;
      val = userId;
    }
    if (!val) return null;
    return { campo: col, op: c.operator === 'not_equal' ? 'neq' : 'eq', valor: val };
  }
  if (f.dataType === 'boolean') {
    // Igual que en la lista: vacío cuenta como Sí
    const b = v !== 'false';
    const esVerdadero = c.operator === 'not_equal' ? !b : b;
    return { campo: col, op: esVerdadero ? 'is_true' : 'is_false' };
  }
  return null;
}

export function arbolFiltros(def: AdminObjectDef, ef: CriteriosEfectivos, search: string, userId: string | null): Nodo | null {
  const fm = fieldMap(def);
  const conds = ef.criteria.map(c => { const f = fm.get(c.field); return f ? nodoCriterio(c, f, userId) : null; });
  const validos = conds.filter((x): x is Nodo => !!x);
  let criterios: Nodo | null = null;
  if (validos.length > 0) {
    const arbol = ef.logic.trim() && !validateFilterLogic(ef.logic, ef.criteria.length) ? parseLogic(ef.logic) : null;
    if (!arbol) criterios = validos.length === 1 ? validos[0] : { and: validos };
    else {
      const ser = (n: LogicNode): Nodo | null => {
        if (n.type === 'leaf') return conds[n.n - 1] ?? null;
        const partes = n.children.map(ser).filter((x): x is Nodo => !!x);
        if (partes.length === 0) return null;
        if (partes.length === 1) return partes[0];
        return n.type === 'and' ? { and: partes } : { or: partes };
      };
      criterios = ser(arbol);
    }
  }
  const partes: Nodo[] = [];
  if (criterios) partes.push(criterios);
  if (ef.ownerScope === 'mine' && def.ownerField && userId) partes.push({ campo: def.ownerField, op: 'eq', valor: userId });
  const t = search.trim();
  if (t) partes.push({ or: def.searchFields.map(col => ({ campo: col, op: 'ilike', valor: `%${patronLike(t)}%` })) });
  if (partes.length === 0) return null;
  return partes.length === 1 ? partes[0] : { and: partes };
}

// ---------------- Consulta ----------------
export async function ejecutarAnalisis(
  def: AdminObjectDef, cfg: AnalisisConfig, ef: CriteriosEfectivos, search: string, userId: string | null,
): Promise<ResultadoAnalisis> {
  const r = rangoPeriodo(cfg);
  const ant = cfg.comparar ? rangoAnterior(cfg, r) : null;
  const p_config = {
    modo: cfg.modo,
    campo_fecha: cfg.campoFecha,
    granularidad: cfg.modo === 'campo' ? 'day' : cfg.granularidad,
    campo_grupo: cfg.modo === 'campo' ? cfg.campoGrupo : null,
    top: cfg.top,
    medida: cfg.medida.tipo === 'conteo' ? { tipo: 'conteo' } : { tipo: cfg.medida.tipo, campo: cfg.medida.campo },
    rango: { desde: r.desde?.toISOString() ?? null, hasta: r.hasta?.toISOString() ?? null },
    rango_anterior: ant ? { desde: ant.desde.toISOString(), hasta: ant.hasta.toISOString() } : null,
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
    filtros: arbolFiltros(def, ef, search, userId),
  };
  const { data, error } = await supabase.rpc('analisis_objeto', { p_objeto: def.id, p_config });
  if (error) throw new Error(error.message);
  return data as ResultadoAnalisis;
}

/** Filtros de Registros. Si el usuario nunca abrió la lista en este objeto, se derivan de su vista. */
export async function resolverEfectivos(def: AdminObjectDef, userId: string | null): Promise<{ efectivos: CriteriosEfectivos; search: string; viewId: string | null }> {
  const c = await cargarConsulta(def.id);
  if (c.efectivos) return { efectivos: c.efectivos, search: c.search ?? '', viewId: c.viewId ?? null };
  const [vs, prefs] = await Promise.all([
    fetchListViews(def.id),
    userId ? fetchPrefs(userId, def.id) : Promise.resolve({ pinned_list_view_id: null, recent_list_view_ids: [] }),
  ]);
  const v = vs.find(x => x.id === c.viewId) || vs.find(x => x.id === prefs.pinned_list_view_id) || vs.find(x => x.id === def.systemViewId) || vs[0] || null;
  const vc = v ? viewToCriteria(v, def) : { criteria: [], logic: '', ownerScope: 'all' as const };
  const efectivos: CriteriosEfectivos = { criteria: vc.criteria, logic: vc.logic, ownerScope: vc.ownerScope, viewName: v?.name ?? null };
  guardarConsulta(def.id, { efectivos, viewId: v?.id ?? null });
  return { efectivos, search: c.search ?? '', viewId: v?.id ?? null };
}

// ---------------- Etiquetas y formato ----------------
export function fechaCorta(d: Date | null): string {
  return d ? d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
}

export function fechaHora(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}

/** "09 ago – 30 sep 2026" (el año solo una vez si coincide). */
export function rangoFechasCorto(min: string | null, max: string | null): string {
  if (!min || !max) return '—';
  const a = new Date(min), b = new Date(max);
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return '—';
  const izq = a.getFullYear() === b.getFullYear() ? fechaCorta(a).replace(/\s*\d{4}$/, '') : fechaCorta(a);
  return `${izq} – ${fechaCorta(b)}`;
}

export function etiquetaPeriodoFila(g: Granularidad, clave: string | null): string {
  if (!clave) return 'Sin fecha';
  const d = parseFechaLocal(clave);
  if (!d) return clave;
  switch (g) {
    case 'week': return `Sem. ${d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`;
    case 'month': return d.toLocaleDateString('es-MX', { month: 'short', year: 'numeric' });
    case 'year': return String(d.getFullYear());
    default: return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}

export function etiquetaValor(f: ObjectFieldDef | undefined, clave: string | null, usuarios: Map<string, string>): string {
  if (clave === null || clave === '') return f?.dataType === 'user' ? 'Importación / sistema' : '(vacío)';
  if (f?.dataType === 'boolean') return clave === 'true' ? 'Sí' : 'No';
  if (f?.dataType === 'user') return usuarios.get(clave) ?? 'Usuario sin acceso';
  return clave;
}

export function formatoMedida(def: AdminObjectDef, cfg: AnalisisConfig, v: number | null | undefined): string {
  if (v === null || v === undefined) return '—';
  const f = cfg.medida.campo ? fieldMap(def).get(cfg.medida.campo) : undefined;
  if (f?.dataType === 'currency') return Number(v).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
  return Number(v).toLocaleString('es-MX', { maximumFractionDigits: 2 });
}

export function etiquetaMedida(def: AdminObjectDef, cfg: AnalisisConfig): string {
  if (cfg.medida.tipo === 'conteo' || !cfg.medida.campo) return 'Registros';
  const label = fieldMap(def).get(cfg.medida.campo)?.label ?? cfg.medida.campo;
  return `${cfg.medida.tipo === 'suma' ? 'Suma' : 'Promedio'} de ${label}`;
}

/** Variación porcentual; null si no hay base para comparar. */
export function variacion(actual: number | null | undefined, anterior: number | null | undefined): number | null {
  if (actual === null || actual === undefined || anterior === null || anterior === undefined || Number(anterior) === 0) return null;
  return ((Number(actual) - Number(anterior)) / Math.abs(Number(anterior))) * 100;
}

// ---------------- Clic en una barra → filtro para Registros ----------------
export function criteriosDrill(
  def: AdminObjectDef, cfg: AnalisisConfig, fila: FilaAnalisis, usuarios: Map<string, string>,
): { criteria: FilterCriterion[]; etiqueta: string } | null {
  const fm = fieldMap(def);
  const campoFecha = fm.get(cfg.campoFecha);
  const r = rangoPeriodo(cfg);
  const nuevo = (field: string, operator: string, value: string): FilterCriterion => ({ id: crypto.randomUUID(), field, operator, value });

  if (cfg.modo === 'fecha') {
    if (!fila.clave) return null;
    const ini = parseFechaLocal(fila.clave);
    if (!ini) return null;
    let fin = cfg.granularidad === 'day' ? sumarDias(ini, 1)
      : cfg.granularidad === 'week' ? sumarDias(ini, 7)
      : cfg.granularidad === 'month' ? sumarMeses(ini, 1)
      : sumarMeses(ini, 12);
    let desde = ini;
    if (r.desde && r.desde > desde) desde = r.desde;
    if (r.hasta && r.hasta < fin) fin = r.hasta;
    const criteria = sumarDias(desde, 1).getTime() === fin.getTime()
      ? [nuevo(cfg.campoFecha, 'equals', ymd(desde))]
      : [nuevo(cfg.campoFecha, 'on_or_after', ymd(desde)), nuevo(cfg.campoFecha, 'before', ymd(fin))];
    return { criteria, etiqueta: `${campoFecha?.label ?? cfg.campoFecha}: ${etiquetaPeriodoFila(cfg.granularidad, fila.clave)}` };
  }

  const f = cfg.campoGrupo ? fm.get(cfg.campoGrupo) : undefined;
  if (!f) return null;
  let criterio: FilterCriterion | null = null;
  if (fila.clave === null || fila.clave === '') {
    if (f.dataType === 'text') criterio = nuevo(f.key, 'is_empty', '');
  } else {
    criterio = nuevo(f.key, 'equals', fila.clave);
  }
  if (!criterio) return null;
  const criteria = [criterio];
  if (r.desde) criteria.push(nuevo(cfg.campoFecha, 'on_or_after', ymd(r.desde)));
  if (r.hasta) criteria.push(nuevo(cfg.campoFecha, 'before', ymd(r.hasta)));
  const periodo = r.desde || r.hasta ? ` · ${etiquetaPeriodo(cfg)}` : '';
  return { criteria, etiqueta: `${f.label} = ${etiquetaValor(f, fila.clave, usuarios)}${periodo}` };
}

// ---------------- Análisis guardados (favoritos) ----------------
export interface FavoritoConfig {
  analisis: AnalisisConfig;
  viewId: string | null;
  search: string;
  efectivos: CriteriosEfectivos;
}

export interface AnalisisGuardado {
  id: string;
  objeto: string;
  nombre: string;
  config: FavoritoConfig;
  created_at: string;
}

export async function listarGuardados(objeto: string): Promise<AnalisisGuardado[]> {
  const { data, error } = await supabase.from('analisis_guardados').select('id, objeto, nombre, config, created_at').eq('objeto', objeto).order('nombre');
  if (error) throw new Error(error.message);
  return (data as AnalisisGuardado[]) || [];
}

export async function guardarAnalisis(objeto: string, nombre: string, config: FavoritoConfig): Promise<AnalisisGuardado> {
  const { data, error } = await supabase.from('analisis_guardados').insert({ objeto, nombre: nombre.trim(), config }).select('id, objeto, nombre, config, created_at').single();
  if (error) throw new Error(error.message);
  return data as AnalisisGuardado;
}

export async function eliminarGuardado(id: string): Promise<void> {
  const { error } = await supabase.from('analisis_guardados').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------------- Exportar a Excel ----------------
export async function exportarExcel(
  def: AdminObjectDef, cfg: AnalisisConfig, res: ResultadoAnalisis, contexto: string, usuarios: Map<string, string>,
): Promise<void> {
  const { default: writeExcelFile } = await import('write-excel-file/universal');
  const fm = fieldMap(def);
  const txt = (value: string, negrita = false) => ({ value, ...(negrita ? { fontWeight: 'bold' as const } : {}) });
  const enc = (value: string) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#EAF5FE' });
  const num = (value: number | null | undefined, format: string) =>
    value === null || value === undefined ? null : { value: Number(value), type: Number, format };
  const conMedida = cfg.medida.tipo !== 'conteo';
  const comparar = cfg.modo === 'campo' && !!res.kpis_anterior;
  const total = res.kpis.registros || 0;
  const campoGrupo = fm.get(cfg.campoGrupo ?? '');
  const agrupacion = cfg.modo === 'fecha'
    ? `${fm.get(cfg.campoFecha)?.label ?? cfg.campoFecha} por ${GRANULARIDADES.find(g => g.id === cfg.granularidad)?.label.toLowerCase()}`
    : `Por ${campoGrupo?.label ?? cfg.campoGrupo} (top ${cfg.top})`;

  const hoja: SheetData = [
    [txt(`Análisis · ${def.label}`, true)],
    [txt(contexto)],
    [txt(`${agrupacion} · ${etiquetaMedida(def, cfg)} · Periodo: ${etiquetaPeriodo(cfg)}`)],
    [txt(`Generado: ${new Date().toLocaleString('es-MX')}`)],
    [],
    [enc('Registros'), ...(conMedida ? [enc(etiquetaMedida(def, cfg))] : []), enc('Fecha más antigua'), enc('Fecha más reciente')],
    [num(total, '#,##0'), ...(conMedida ? [num(res.kpis.medida, '#,##0.00')] : []), txt(fechaHora(res.kpis.fecha_min)), txt(fechaHora(res.kpis.fecha_max))],
    [],
    [
      enc(cfg.modo === 'fecha' ? 'Periodo' : (campoGrupo?.label ?? 'Valor')),
      enc('Registros'), enc('% del total'),
      ...(conMedida ? [enc(etiquetaMedida(def, cfg))] : []),
      ...(comparar ? [enc('Registros periodo anterior'), enc('Variación %')] : []),
    ],
  ];
  const ordenadas = cfg.modo === 'fecha' ? [...res.filas].reverse() : res.filas;
  for (const fila of ordenadas) {
    const etiqueta = cfg.modo === 'fecha' ? etiquetaPeriodoFila(cfg.granularidad, fila.clave) : etiquetaValor(campoGrupo, fila.clave, usuarios);
    const v = variacion(fila.registros, fila.ant_registros);
    hoja.push([
      txt(etiqueta),
      num(fila.registros, '#,##0'),
      num(total ? fila.registros / total : 0, '0.0%'),
      ...(conMedida ? [num(fila.medida, '#,##0.00')] : []),
      ...(comparar ? [num(fila.ant_registros ?? 0, '#,##0'), num(v === null ? null : v / 100, '0.0%')] : []),
    ]);
  }
  if (res.otros) {
    hoja.push([
      txt(`Otros (${res.otros.grupos} valores)`),
      num(res.otros.registros, '#,##0'),
      num(total ? res.otros.registros / total : 0, '0.0%'),
      ...(conMedida ? [num(res.otros.medida, '#,##0.00')] : []),
    ]);
  }
  const blob = await writeExcelFile(hoja, {
    sheet: 'Análisis',
    columns: [{ width: 34 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 22 }, { width: 14 }],
  }).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analisis_${def.id}_${ymd(new Date())}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
