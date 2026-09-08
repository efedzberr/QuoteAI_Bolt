import { supabase } from './supabase';
import type { AdminObjectDef, FieldDataType, ObjectFieldDef } from './objectCatalog';
import { fieldMap } from './objectCatalog';

// ---------------- Tipos ----------------
export interface ListViewFilter { field?: string; operator?: string; value?: string }
export interface ListViewColumn { field: string; label: string }
export interface ListViewSort { field: string; direction: 'asc' | 'desc' }

export interface ListView {
  id: string;
  name: string;
  object: string;
  owner_user_id: string | null;
  visibility: 'private' | 'public';
  is_system: boolean;
  filters: ListViewFilter[];
  filter_logic: string | null;
  columns: ListViewColumn[];
  sorting: ListViewSort[];
}

export interface FilterCriterion { id: string; field: string; operator: string; value: string }
export type OwnerScope = 'all' | 'mine';
export const CURRENT_USER_TOKEN = '$CURRENT_USER';

// ---------------- Operadores ----------------
export const TEXT_OPERATORS = [
  { value: 'equals', label: 'igual a' },
  { value: 'not_equal', label: 'distinto de' },
  { value: 'contains', label: 'contiene' },
  { value: 'not_contains', label: 'no contiene' },
  { value: 'starts_with', label: 'empieza con' },
  { value: 'is_empty', label: 'está vacío' },
  { value: 'not_empty', label: 'no está vacío' },
];
export const NUMBER_OPERATORS = [
  { value: 'eq', label: '=' }, { value: 'neq', label: '≠' }, { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' }, { value: 'gt', label: '>' }, { value: 'gte', label: '≥' },
];
export const DATE_OPERATORS = [
  { value: 'equals', label: 'igual a' }, { value: 'before', label: 'antes de' }, { value: 'after', label: 'después de' },
  { value: 'on_or_before', label: 'hasta' }, { value: 'on_or_after', label: 'desde' },
];
export const PICKLIST_OPERATORS = [{ value: 'equals', label: 'igual a' }, { value: 'not_equal', label: 'distinto de' }];

export function getOperatorsForType(t: FieldDataType) {
  switch (t) {
    case 'number': case 'currency': return NUMBER_OPERATORS;
    case 'date': case 'datetime': return DATE_OPERATORS;
    case 'picklist': case 'user': case 'boolean': return PICKLIST_OPERATORS;
    default: return TEXT_OPERATORS;
  }
}

// ---------------- Fechas relativas ----------------
export const RELATIVE_TOKENS: { token: string; label: string; takesN: boolean }[] = [
  { token: 'HOY', label: 'Hoy', takesN: false },
  { token: 'AYER', label: 'Ayer', takesN: false },
  { token: 'ESTA_SEMANA', label: 'Esta semana', takesN: false },
  { token: 'SEMANA_PASADA', label: 'Semana pasada', takesN: false },
  { token: 'ESTE_MES', label: 'Este mes', takesN: false },
  { token: 'MES_PASADO', label: 'Mes pasado', takesN: false },
  { token: 'ESTE_ANIO', label: 'Este año', takesN: false },
  { token: 'ULTIMOS_N_DIAS', label: 'Últimos N días', takesN: true },
  { token: 'PROXIMOS_N_DIAS', label: 'Próximos N días', takesN: true },
];

export function parseRelativeValue(v: string): { token: string; n?: number } | null {
  const m = /^([A-Z_]+)(?::(\d+))?$/.exec(v.trim());
  if (!m || !RELATIVE_TOKENS.some(t => t.token === m[1])) return null;
  return { token: m[1], n: m[2] ? parseInt(m[2], 10) : undefined };
}
export function serializeRelativeValue(token: string, n?: number): string {
  return n !== undefined ? `${token}:${n}` : token;
}

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

export function resolveRelativeRange(token: string, n = 1): { start: Date; end: Date } {
  const today = startOfDay(new Date());
  const dow = (today.getDay() + 6) % 7; // lunes = 0
  const weekStart = addDays(today, -dow);
  switch (token) {
    case 'HOY': return { start: today, end: addDays(today, 1) };
    case 'AYER': return { start: addDays(today, -1), end: today };
    case 'ESTA_SEMANA': return { start: weekStart, end: addDays(weekStart, 7) };
    case 'SEMANA_PASADA': return { start: addDays(weekStart, -7), end: weekStart };
    case 'ESTE_MES': return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: new Date(today.getFullYear(), today.getMonth() + 1, 1) };
    case 'MES_PASADO': return { start: new Date(today.getFullYear(), today.getMonth() - 1, 1), end: new Date(today.getFullYear(), today.getMonth(), 1) };
    case 'ESTE_ANIO': return { start: new Date(today.getFullYear(), 0, 1), end: new Date(today.getFullYear() + 1, 0, 1) };
    case 'ULTIMOS_N_DIAS': return { start: addDays(today, -(n - 1)), end: addDays(today, 1) };
    case 'PROXIMOS_N_DIAS': return { start: today, end: addDays(today, n + 1) };
    default: return { start: today, end: addDays(today, 1) };
  }
}

// ---------------- Lógica de filtro: "1 AND (2 OR 3)" ----------------
function tokenize(expr: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }
    if (ch === '(' || ch === ')') { out.push(ch); i++; continue; }
    let w = '';
    while (i < expr.length && expr[i] !== ' ' && expr[i] !== '(' && expr[i] !== ')') { w += expr[i]; i++; }
    if (w) out.push(w);
  }
  return out;
}

export function validateFilterLogic(expression: string, count: number): string | null {
  if (!expression.trim()) return null;
  const tokens = tokenize(expression);
  if (tokens.length === 0) return 'Expresión inválida.';
  let depth = 0;
  let expectOperand = true;
  for (const t of tokens) {
    if (t === '(') { depth++; continue; }
    if (t === ')') { depth--; if (depth < 0) return 'Paréntesis desbalanceados.'; expectOperand = false; continue; }
    const up = t.toUpperCase();
    if (up === 'AND' || up === 'OR' || up === 'Y' || up === 'O') {
      if (expectOperand) return `"${t}" inesperado: se esperaba un número de filtro.`;
      expectOperand = true; continue;
    }
    const n = parseInt(t, 10);
    if (isNaN(n)) return `"${t}" no es válido. Usa números de filtro, AND, OR y paréntesis.`;
    if (n < 1 || n > count) return `El filtro #${n} no existe. Tienes ${count} filtro(s).`;
    expectOperand = false;
  }
  if (depth !== 0) return 'Paréntesis desbalanceados.';
  if (expectOperand) return 'La expresión termina de forma inesperada.';
  return null;
}

export function rewriteFilterLogicOnRemove(expression: string, removedIndex: number, totalBefore: number): string | null {
  if (!expression.trim()) return '';
  const out: string[] = [];
  for (const t of tokenize(expression)) {
    const n = parseInt(t, 10);
    if (!isNaN(n)) {
      if (n === removedIndex) return null;
      out.push(String(n > removedIndex ? n - 1 : n));
    } else out.push(t);
  }
  const rewritten = out.join(' ');
  return validateFilterLogic(rewritten, totalBefore - 1) ? null : rewritten;
}

type LogicNode = { type: 'leaf'; n: number } | { type: 'and' | 'or'; children: LogicNode[] };

function parseLogic(expression: string): LogicNode | null {
  const tokens = tokenize(expression);
  if (tokens.length === 0) return null;
  const ctx = { pos: 0 };
  const parsePrimary = (): LogicNode => {
    if (tokens[ctx.pos] === '(') { ctx.pos++; const v = parseOr(); if (tokens[ctx.pos] === ')') ctx.pos++; return v; }
    const n = parseInt(tokens[ctx.pos++], 10);
    return { type: 'leaf', n };
  };
  const parseAnd = (): LogicNode => {
    const children = [parsePrimary()];
    while (ctx.pos < tokens.length && ['AND', 'Y'].includes(tokens[ctx.pos]?.toUpperCase())) { ctx.pos++; children.push(parsePrimary()); }
    return children.length === 1 ? children[0] : { type: 'and', children };
  };
  const parseOr = (): LogicNode => {
    const children = [parseAnd()];
    while (ctx.pos < tokens.length && ['OR', 'O'].includes(tokens[ctx.pos]?.toUpperCase())) { ctx.pos++; children.push(parseAnd()); }
    return children.length === 1 ? children[0] : { type: 'or', children };
  };
  return parseOr();
}

// ---------------- Traducción a PostgREST ----------------
function pgQuote(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}
function pgLikePattern(v: string): string {
  return v.replace(/[%_]/g, m => `\\${m}`);
}

export function criterionToPostgrest(c: FilterCriterion, f: ObjectFieldDef, userId: string | null): string | null {
  const col = f.key;
  const v = c.value ?? '';
  if (f.dataType === 'text') {
    switch (c.operator) {
      case 'is_empty': return `or(${col}.is.null,${col}.eq.${pgQuote('')})`;
      case 'not_empty': return `and(${col}.not.is.null,${col}.neq.${pgQuote('')})`;
    }
    if (!v.trim()) return null;
    switch (c.operator) {
      case 'equals': return `${col}.ilike.${pgQuote(pgLikePattern(v))}`;
      case 'not_equal': return `${col}.not.ilike.${pgQuote(pgLikePattern(v))}`;
      case 'contains': return `${col}.ilike.${pgQuote(`*${pgLikePattern(v)}*`)}`;
      case 'not_contains': return `${col}.not.ilike.${pgQuote(`*${pgLikePattern(v)}*`)}`;
      case 'starts_with': return `${col}.ilike.${pgQuote(`${pgLikePattern(v)}*`)}`;
      default: return null;
    }
  }
  if (f.dataType === 'number' || f.dataType === 'currency') {
    const n = parseFloat(v);
    if (isNaN(n)) return null;
    if (!['eq', 'neq', 'lt', 'lte', 'gt', 'gte'].includes(c.operator)) return null;
    return `${col}.${c.operator}.${n}`;
  }
  if (f.dataType === 'date' || f.dataType === 'datetime') {
    if (!v.trim()) return null;
    const rel = parseRelativeValue(v);
    let start: Date, end: Date;
    if (rel) ({ start, end } = resolveRelativeRange(rel.token, rel.n ?? 1));
    else {
      const d = new Date(v);
      if (isNaN(d.getTime())) return null;
      start = startOfDay(d); end = addDays(start, 1);
    }
    const s = start.toISOString(), e = end.toISOString();
    switch (c.operator) {
      case 'equals': return `and(${col}.gte.${pgQuote(s)},${col}.lt.${pgQuote(e)})`;
      case 'before': return `${col}.lt.${pgQuote(s)}`;
      case 'after': return `${col}.gte.${pgQuote(e)}`;
      case 'on_or_before': return `${col}.lt.${pgQuote(e)}`;
      case 'on_or_after': return `${col}.gte.${pgQuote(s)}`;
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
    return c.operator === 'not_equal' ? `${col}.neq.${pgQuote(val)}` : `${col}.eq.${pgQuote(val)}`;
  }
  if (f.dataType === 'boolean') {
    const b = v === 'true';
    return c.operator === 'not_equal' ? `${col}.is.${!b}` : `${col}.is.${b}`;
  }
  return null;
}

export function buildPostgrestFilter(criteria: FilterCriterion[], logic: string, def: AdminObjectDef, userId: string | null): string | null {
  const fm = fieldMap(def);
  const conds: (string | null)[] = criteria.map(c => {
    const f = fm.get(c.field);
    return f ? criterionToPostgrest(c, f, userId) : null;
  });
  const valid = conds.filter((x): x is string => !!x);
  if (valid.length === 0) return null;
  const tree = logic.trim() && !validateFilterLogic(logic, criteria.length) ? parseLogic(logic) : null;
  if (!tree) return valid.length === 1 ? valid[0] : `and(${valid.join(',')})`;
  const ser = (node: LogicNode): string | null => {
    if (node.type === 'leaf') return conds[node.n - 1] ?? null;
    const parts = node.children.map(ser).filter((x): x is string => !!x);
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    return `${node.type}(${parts.join(',')})`;
  };
  return ser(tree);
}

export function buildSearchFilter(term: string, def: AdminObjectDef): string | null {
  const t = term.trim();
  if (!t) return null;
  return def.searchFields.map(col => `${col}.ilike.${pgQuote(`*${pgLikePattern(t)}*`)}`).join(',');
}

// ---------------- Conversión vista ⇄ criterios ----------------
export function viewToCriteria(view: ListView, def: AdminObjectDef): { criteria: FilterCriterion[]; logic: string; ownerScope: OwnerScope } {
  const criteria: FilterCriterion[] = [];
  let ownerScope: OwnerScope = 'all';
  for (const f of view.filters || []) {
    if (!f.field || !f.operator) continue;
    if (def.ownerField && f.field === def.ownerField && f.operator === 'equals' && f.value === CURRENT_USER_TOKEN) { ownerScope = 'mine'; continue; }
    criteria.push({ id: crypto.randomUUID(), field: f.field, operator: f.operator, value: f.value ?? '' });
  }
  return { criteria, logic: view.filter_logic || '', ownerScope };
}

export function criteriaToViewFilters(criteria: FilterCriterion[], ownerScope: OwnerScope, def: AdminObjectDef): ListViewFilter[] {
  const out: ListViewFilter[] = criteria.map(c => ({ field: c.field, operator: c.operator, value: c.value }));
  if (ownerScope === 'mine' && def.ownerField) out.unshift({ field: def.ownerField, operator: 'equals', value: CURRENT_USER_TOKEN });
  return out;
}

// ---------------- Acceso a datos ----------------
export async function fetchListViews(object: string): Promise<ListView[]> {
  const { data, error } = await supabase.from('list_views').select('*').eq('object', object).order('name');
  if (error) throw new Error(error.message);
  return (data as ListView[]) || [];
}

export async function fetchListView(id: string): Promise<ListView | null> {
  const { data } = await supabase.from('list_views').select('*').eq('id', id).maybeSingle();
  return (data as ListView | null) ?? null;
}

export interface ListViewPrefs { pinned_list_view_id: string | null; recent_list_view_ids: string[] }

export async function fetchPrefs(userId: string, object: string): Promise<ListViewPrefs> {
  const { data } = await supabase.from('user_list_view_preferences').select('pinned_list_view_id, recent_list_view_ids').eq('user_id', userId).eq('object', object).maybeSingle();
  return { pinned_list_view_id: (data?.pinned_list_view_id as string | null) ?? null, recent_list_view_ids: ((data?.recent_list_view_ids as string[]) || []) };
}

export async function savePrefs(userId: string, object: string, prefs: ListViewPrefs): Promise<void> {
  await supabase.from('user_list_view_preferences').upsert({ user_id: userId, object, ...prefs }, { onConflict: 'user_id,object' });
}

export function sortLabel(sorting: ListViewSort[], def: AdminObjectDef): string {
  if (!sorting || sorting.length === 0) return '';
  return fieldMap(def).get(sorting[0].field)?.label || sorting[0].field;
}
