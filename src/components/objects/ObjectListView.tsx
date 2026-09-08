import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, Settings, RefreshCw, Filter, ArrowUp, ArrowDown, Plus, Pencil, Trash2, Loader2, FilePlus, Copy, Share2, Columns3, RotateCcw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { fetchUsuariosVisibles } from '../../lib/seguridad';
import { type AdminObjectDef, fieldMap, formatCell } from '../../lib/objectCatalog';
import {
  type ListView, type ListViewColumn, type ListViewSort, type FilterCriterion, type OwnerScope,
  fetchListViews, fetchPrefs, savePrefs, viewToCriteria, criteriaToViewFilters,
  buildPostgrestFilter, buildSearchFilter, sortLabel,
} from '../../lib/listViews';
import ListViewPicker from './ListViewPicker';
import ListViewModals, { type ViewModalType } from './ListViewModals';
import FilterPanel from './FilterPanel';
import SelectFieldsModal from './SelectFieldsModal';
import RecordFormModal from './RecordFormModal';

type Row = Record<string, unknown>;
const PAGE_SIZE = 50;

interface Props { def: AdminObjectDef; onToast: (message: string, type: 'success' | 'error') => void }

function relTime(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 10) return 'hace unos segundos';
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `hace ${h} h` : `hace ${Math.floor(h / 24)} d`;
}

export default function ObjectListView({ def, onToast }: Props) {
  const perms = usePermissions();
  const fm = useMemo(() => fieldMap(def), [def]);

  const [userId, setUserId] = useState<string | null>(null);
  const [views, setViews] = useState<ListView[]>([]);
  const [activeView, setActiveView] = useState<ListView | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);

  const [rows, setRows] = useState<Row[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [, setTick] = useState(0);

  const [criteria, setCriteria] = useState<FilterCriterion[]>([]);
  const [logic, setLogic] = useState('');
  const [ownerScope, setOwnerScope] = useState<OwnerScope>('all');
  const [session, setSession] = useState<{ criteria: FilterCriterion[]; logic: string; ownerScope: OwnerScope; columns: ListViewColumn[] | null; sorting: ListViewSort[] | null } | null>(null);
  const [readOnlyNotice, setReadOnlyNotice] = useState(false);

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [gearOpen, setGearOpen] = useState(false);
  const [viewModal, setViewModal] = useState<ViewModalType>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [formRow, setFormRow] = useState<Row | null | 'new'>(null);
  const [deleteRow, setDeleteRow] = useState<Row | null>(null);
  const [deleting, setDeleting] = useState(false);

  const gearRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const seqRef = useRef(0);

  const canCreate = !def.readOnly && !!def.permObject && perms.can(def.permObject, 'crear');
  const canEdit = !def.readOnly && !!def.permObject && perms.can(def.permObject, 'editar');
  const canDelete = !def.readOnly && !!def.permObject && perms.can(def.permObject, 'eliminar');

  const effCriteria = session?.criteria ?? criteria;
  const effLogic = session?.logic ?? logic;
  const effScope = session?.ownerScope ?? ownerScope;
  const effColumns: ListViewColumn[] = useMemo(() => session?.columns ?? activeView?.columns ?? [], [session, activeView]);
  const effSorting: ListViewSort[] = useMemo(() => session?.sorting ?? activeView?.sorting ?? [], [session, activeView]);

  const canEditView = (v: ListView | null) => !!v && !v.is_system && (v.owner_user_id === userId || (v.visibility === 'public' && perms.isAdmin));

  // ---------- init ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const uid = user?.id || null;
        if (cancelled) return;
        setUserId(uid);
        const [vs, prefs] = await Promise.all([fetchListViews(def.id), uid ? fetchPrefs(uid, def.id) : Promise.resolve({ pinned_list_view_id: null, recent_list_view_ids: [] })]);
        if (cancelled) return;
        setViews(vs);
        setPinnedId(prefs.pinned_list_view_id);
        setRecentIds(prefs.recent_list_view_ids);
        const initial = vs.find(v => v.id === prefs.pinned_list_view_id) || vs.find(v => v.id === def.systemViewId) || vs[0] || null;
        applyView(initial);
        if (def.ownerField) {
          try { setUsers((await fetchUsuariosVisibles()).map(u => ({ id: u.id, label: u.full_name || u.email }))); } catch { /* sin permiso: sin lista */ }
        }
      } catch (e: unknown) {
        if (!cancelled) { setErrorState(e instanceof Error ? e.message : 'No se pudieron cargar las vistas.'); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.id]);

  function applyView(v: ListView | null) {
    setActiveView(v);
    setSession(null);
    setReadOnlyNotice(false);
    if (v) {
      const c = viewToCriteria(v, def);
      setCriteria(c.criteria); setLogic(c.logic); setOwnerScope(c.ownerScope);
    } else { setCriteria([]); setLogic(''); setOwnerScope('all'); }
  }

  // ---------- data ----------
  const buildQuery = useCallback((offset: number) => {
    let q = supabase.from(def.table).select(def.select, { count: 'exact' });
    const f = buildPostgrestFilter(effCriteria, effLogic, def, userId);
    if (f) q = q.or(f);
    if (effScope === 'mine' && def.ownerField && userId) q = q.eq(def.ownerField, userId);
    const s = buildSearchFilter(debounced, def);
    if (s) q = q.or(s);
    const sort = effSorting[0];
    const sortField = sort && fm.get(sort.field)?.sortable !== false ? sort.field : null;
    if (sortField) q = q.order(sortField, { ascending: sort.direction === 'asc', nullsFirst: false });
    if (sortField !== def.pk) q = q.order(def.pk, { ascending: true });
    return q.range(offset, offset + PAGE_SIZE - 1);
  }, [def, effCriteria, effLogic, effScope, effSorting, debounced, userId, fm]);

  const load = useCallback(async (isRefresh = false) => {
    if (!activeView) return;
    const seq = ++seqRef.current;
    if (!isRefresh) setLoading(true);
    setErrorState(null);
    try {
      const { data, count, error } = await buildQuery(0);
      if (error) throw new Error(error.message);
      if (seq !== seqRef.current) return;
      const list = (data as unknown as Row[]) || [];
      setRows(list);
      setTotalCount(count || 0);
      setHasMore(list.length < (count || 0));
      setLastUpdated(new Date());
    } catch (e: unknown) {
      if (seq === seqRef.current) setErrorState(e instanceof Error ? e.message : 'No se pudieron cargar los registros.');
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [activeView, buildQuery]);

  useEffect(() => { load(); }, [load]);

  const loadMoreRef = useRef(async () => {});
  loadMoreRef.current = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data, count, error } = await buildQuery(rows.length);
      if (error) throw new Error(error.message);
      const existing = new Set(rows.map(r => String(r[def.pk])));
      const merged = [...rows, ...((data as unknown as Row[]) || []).filter(r => !existing.has(String(r[def.pk])))];
      setRows(merged);
      setTotalCount(count || 0);
      setHasMore(merged.length < (count || 0));
    } catch (e: unknown) {
      onToast(e instanceof Error ? e.message : 'No se pudieron cargar más registros.', 'error');
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!sentinelRef.current) return;
    const ob = new IntersectionObserver(entries => { if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loading) loadMoreRef.current(); }, { rootMargin: '200px' });
    ob.observe(sentinelRef.current);
    return () => ob.disconnect();
  }, [hasMore, loadingMore, loading]);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!gearOpen) return;
    const onDown = (e: MouseEvent) => { if (gearRef.current && !gearRef.current.contains(e.target as Node)) setGearOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [gearOpen]);

  // ---------- vistas ----------
  const selectView = async (v: ListView) => {
    applyView(v);
    if (!userId) return;
    const next = [v.id, ...recentIds.filter(id => id !== v.id)].slice(0, 6);
    setRecentIds(next);
    await savePrefs(userId, def.id, { pinned_list_view_id: pinnedId, recent_list_view_ids: next });
  };
  const togglePin = async () => {
    if (!activeView || !userId) return;
    const next = pinnedId === activeView.id ? null : activeView.id;
    setPinnedId(next);
    await savePrefs(userId, def.id, { pinned_list_view_id: next, recent_list_view_ids: recentIds });
  };
  const persistView = async (patch: Partial<ListView>) => {
    if (!activeView) return;
    const updated = { ...activeView, ...patch };
    setActiveView(updated);
    setViews(vs => vs.map(v => v.id === updated.id ? updated : v));
    const { error } = await supabase.from('list_views').update(patch).eq('id', activeView.id);
    if (error) onToast(error.message, 'error');
  };

  const handleFiltersSave = (c: FilterCriterion[], l: string, s: OwnerScope) => {
    if (canEditView(activeView)) {
      setCriteria(c); setLogic(l); setOwnerScope(s); setSession(null); setReadOnlyNotice(false);
      persistView({ filters: criteriaToViewFilters(c, s, def), filter_logic: l || null });
    } else {
      setSession(prev => ({ criteria: c, logic: l, ownerScope: s, columns: prev?.columns ?? null, sorting: prev?.sorting ?? null }));
      setReadOnlyNotice(true);
    }
  };
  const handleColumnsSave = (cols: ListViewColumn[]) => {
    if (canEditView(activeView)) { setSession(prev => prev ? { ...prev, columns: null } : null); persistView({ columns: cols }); }
    else { setSession(prev => ({ criteria: prev?.criteria ?? criteria, logic: prev?.logic ?? logic, ownerScope: prev?.ownerScope ?? ownerScope, columns: cols, sorting: prev?.sorting ?? null })); setReadOnlyNotice(true); }
  };
  const handleSort = (fieldKey: string) => {
    if (fm.get(fieldKey)?.sortable === false) return;
    const cur = effSorting[0];
    const next: ListViewSort[] = [{ field: fieldKey, direction: cur?.field === fieldKey && cur.direction === 'asc' ? 'desc' : 'asc' }];
    if (canEditView(activeView)) { setSession(prev => prev ? { ...prev, sorting: null } : null); persistView({ sorting: next }); }
    else { setSession(prev => ({ criteria: prev?.criteria ?? criteria, logic: prev?.logic ?? logic, ownerScope: prev?.ownerScope ?? ownerScope, columns: prev?.columns ?? null, sorting: next })); setReadOnlyNotice(true); }
  };
  const resetSorting = () => { setGearOpen(false); setSession(prev => prev ? { ...prev, sorting: null } : null); };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    const { error } = await supabase.from(def.table).delete().eq(def.pk, deleteRow[def.pk] as string);
    setDeleting(false);
    setDeleteRow(null);
    if (error) onToast(error.message, 'error');
    else { onToast(`${def.singular.charAt(0).toUpperCase() + def.singular.slice(1)} eliminado`, 'success'); load(true); }
  };

  // ---------- render ----------
  const filterCount = effCriteria.length + (effScope === 'mine' ? 1 : 0);
  const subtitleParts = [`${totalCount.toLocaleString('es-MX')} registro${totalCount === 1 ? '' : 's'}`];
  if (effSorting.length > 0) subtitleParts.push(`ordenado por ${sortLabel(effSorting, def)}`);
  if (filterCount > 0) subtitleParts.push(`${filterCount} filtro${filterCount === 1 ? '' : 's'}`);
  if (debounced.trim()) subtitleParts.push('filtrado por búsqueda');
  if (lastUpdated) subtitleParts.push(`actualizado ${relTime(lastUpdated)}`);

  const iconBtn = 'h-9 w-9 flex items-center justify-center rounded-lg border border-rule bg-white text-ink-soft hover:bg-rule-soft transition-colors';
  const menuItem = (enabled: boolean, danger = false) => `w-full flex items-center gap-2 px-4 py-2 text-sm text-left ${enabled ? (danger ? 'text-bad hover:bg-bad-soft' : 'text-ink hover:bg-rule-soft') : 'text-ink-faint cursor-not-allowed'}`;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <ListViewPicker views={views} activeView={activeView} pinnedId={pinnedId} recentIds={recentIds} onSelect={selectView} onTogglePin={togglePin} subtitle={subtitleParts.join(' \u2022 ')} />
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative">
            <Search className="w-4 h-4 text-ink-faint absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar en esta lista\u2026" className="h-9 w-64 pl-8 pr-3 text-sm border border-rule rounded-lg focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft" />
          </div>
          <div className="relative" ref={gearRef}>
            <button onClick={() => setGearOpen(o => !o)} className={iconBtn} title="Controles de la vista"><Settings className="w-4 h-4" /></button>
            {gearOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-rule rounded-card shadow-md z-30 py-1">
                <button onClick={() => { setGearOpen(false); setViewModal('new'); }} className={menuItem(true)}><FilePlus className="w-4 h-4 text-ink-faint" /> Nueva vista</button>
                <button onClick={() => { setGearOpen(false); setViewModal('clone'); }} className={menuItem(true)}><Copy className="w-4 h-4 text-ink-faint" /> Clonar</button>
                <button disabled={!canEditView(activeView)} onClick={() => { setGearOpen(false); setViewModal('rename'); }} className={menuItem(canEditView(activeView))}><Pencil className="w-4 h-4 text-ink-faint" /> Renombrar</button>
                <button disabled={!canEditView(activeView)} onClick={() => { setGearOpen(false); setViewModal('sharing'); }} className={menuItem(canEditView(activeView))}><Share2 className="w-4 h-4 text-ink-faint" /> Compartir</button>
                <div className="my-1 border-t border-rule-soft" />
                <button onClick={() => { setGearOpen(false); setFieldsOpen(true); }} className={menuItem(true)}><Columns3 className="w-4 h-4 text-ink-faint" /> Seleccionar campos</button>
                <button onClick={resetSorting} className={menuItem(true)}><RotateCcw className="w-4 h-4 text-ink-faint" /> Restablecer orden</button>
                <div className="my-1 border-t border-rule-soft" />
                <button disabled={!canEditView(activeView)} onClick={() => { setGearOpen(false); setViewModal('delete'); }} className={menuItem(canEditView(activeView), true)}><Trash2 className="w-4 h-4" /> Eliminar vista</button>
              </div>
            )}
          </div>
          <button onClick={() => setFilterOpen(true)} className={`${iconBtn} relative`} title="Filtros">
            <Filter className="w-4 h-4" />
            {filterCount > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand text-white text-[10px] font-bold flex items-center justify-center">{filterCount}</span>}
          </button>
          <button onClick={() => load(true)} className={iconBtn} title="Actualizar"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
          {canCreate && <button onClick={() => setFormRow('new')} className="inline-flex items-center gap-2 h-9 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep"><Plus className="w-4 h-4" /> Nuevo</button>}
        </div>
      </div>

      {readOnlyNotice && (
        <div className="mb-3 px-3 py-2 text-xs text-warn bg-warn-soft border border-warn/20 rounded-lg">Esta vista es de solo lectura: los cambios aplican solo en esta sesi\u00f3n. Usa <strong>Clonar</strong> para guardarlos en una vista tuya.</div>
      )}
      {errorState && <div className="mb-3 px-3 py-2 text-sm text-bad bg-bad-soft border border-bad/20 rounded-lg">{errorState}</div>}

      <div className="border border-rule rounded-card overflow-auto max-h-[calc(100vh-300px)]">
        <table className="w-full text-sm">
          <thead className="bg-rule-soft border-b border-rule sticky top-0 z-10">
            <tr>
              {effColumns.map(col => {
                const f = fm.get(col.field);
                const sortable = f?.sortable !== false;
                const active = effSorting[0]?.field === col.field;
                return (
                  <th key={col.field} onClick={() => sortable && handleSort(col.field)} className={`px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider whitespace-nowrap select-none ${f?.align === 'right' ? 'text-right' : 'text-left'} ${sortable ? 'cursor-pointer hover:text-ink' : ''}`}>
                    <span className="inline-flex items-center gap-1">
                      {f?.label || col.label}
                      {active && (effSorting[0].direction === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />)}
                    </span>
                  </th>
                );
              })}
              {(canEdit || canDelete) && <th className="w-24" />}
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr><td colSpan={effColumns.length + 1} className="px-4 py-10 text-center text-ink-faint">Cargando\u2026</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={effColumns.length + 1} className="px-4 py-10 text-center text-ink-faint">Sin registros para esta vista.</td></tr>
            ) : rows.map(r => (
              <tr key={String(r[def.pk])} className="border-b border-rule-soft last:border-0 hover:bg-rule-soft/50">
                {effColumns.map(col => {
                  const f = fm.get(col.field);
                  return (
                    <td key={col.field} className={`px-4 py-2.5 text-ink whitespace-nowrap max-w-[320px] truncate ${f?.align === 'right' ? 'text-right font-mono text-xs' : ''}`} title={f ? formatCell(f, r[col.field], r) : ''}>
                      {f ? formatCell(f, r[col.field], r) : String(r[col.field] ?? '')}
                    </td>
                  );
                })}
                {(canEdit || canDelete) && (
                  <td className="px-2 py-2 text-right whitespace-nowrap">
                    {canEdit && <button onClick={() => setFormRow(r)} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-faint hover:bg-rule-soft hover:text-ink" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>}
                    {canDelete && <button onClick={() => setDeleteRow(r)} className="w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-faint hover:bg-bad-soft hover:text-bad" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <div ref={sentinelRef} className="h-6 flex items-center justify-center text-xs text-ink-faint">
          {loadingMore && <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Cargando m\u00e1s\u2026</>}
          {!hasMore && rows.length > 0 && <span>Fin de la lista \u00b7 {rows.length.toLocaleString('es-MX')} de {totalCount.toLocaleString('es-MX')}</span>}
        </div>
      </div>

      <FilterPanel isOpen={filterOpen} onClose={() => setFilterOpen(false)} def={def} criteria={effCriteria} filterLogic={effLogic} ownerScope={effScope} users={users} isReadOnly={!canEditView(activeView)} onSave={handleFiltersSave} />
      <SelectFieldsModal isOpen={fieldsOpen} onClose={() => setFieldsOpen(false)} def={def} columns={effColumns} isReadOnly={!canEditView(activeView)} onSave={handleColumnsSave} />
      <ListViewModals
        modalType={viewModal} object={def.id} onClose={() => setViewModal(null)} activeView={activeView} userId={userId} isAdmin={perms.isAdmin}
        effectiveColumns={effColumns} effectiveSorting={effSorting} effectiveFilters={criteriaToViewFilters(effCriteria, effScope, def)} effectiveFilterLogic={effLogic}
        onViewCreated={v => { setViews(vs => [...vs, v].sort((a, b) => a.name.localeCompare(b.name, 'es'))); selectView(v); onToast(`Vista "${v.name}" creada`, 'success'); }}
        onViewUpdated={v => { setViews(vs => vs.map(x => x.id === v.id ? v : x)); setActiveView(v); }}
        onViewDeleted={id => { const rest = views.filter(v => v.id !== id); setViews(rest); applyView(rest.find(v => v.id === def.systemViewId) || rest[0] || null); onToast('Vista eliminada', 'success'); }}
      />
      {formRow !== null && (
        <RecordFormModal def={def} row={formRow === 'new' ? null : formRow} onClose={() => setFormRow(null)} onSaved={() => { setFormRow(null); onToast(formRow === 'new' ? 'Registro creado' : 'Registro actualizado', 'success'); load(true); }} />
      )}
      {deleteRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteRow(null)} />
          <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-ink mb-1">Eliminar {def.singular}</h3>
            <p className="text-sm text-ink-soft mb-1">Esta acci\u00f3n es permanente y no se puede deshacer.</p>
            <p className="text-xs text-ink-faint font-mono mb-5">{def.pk}: {String(deleteRow[def.pk])}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteRow(null)} disabled={deleting} className="inline-flex items-center h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft">Cancelar</button>
              <button onClick={confirmDelete} disabled={deleting} className="inline-flex items-center gap-2 h-10 px-4 bg-bad text-white font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-60">{deleting && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
