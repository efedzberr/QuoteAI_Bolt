import { useState, useEffect } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ListView, ListViewColumn, ListViewFilter, ListViewSort } from '../../lib/listViews';

export type ViewModalType = 'new' | 'clone' | 'rename' | 'sharing' | 'delete' | null;

interface Props {
  modalType: ViewModalType;
  object: string;
  onClose: () => void;
  activeView: ListView | null;
  userId: string | null;
  isAdmin: boolean;
  effectiveColumns: ListViewColumn[];
  effectiveSorting: ListViewSort[];
  effectiveFilters: ListViewFilter[];
  effectiveFilterLogic: string;
  onViewCreated: (v: ListView) => void;
  onViewUpdated: (v: ListView) => void;
  onViewDeleted: (id: string) => void;
}

const field = 'w-full h-10 px-3 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition';
const label = 'block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5';
const primaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const secondaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 transition-colors';

export default function ListViewModals(p: Props) {
  const { modalType, object, onClose, activeView, userId, isAdmin } = p;
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public'>('private');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!modalType) return;
    setError(null); setSaving(false);
    if (modalType === 'new') { setName(''); setVisibility('private'); }
    else if (modalType === 'clone') { setName(`Copia de ${activeView?.name || ''}`); setVisibility('private'); }
    else if (modalType === 'rename') setName(activeView?.name || '');
    else if (modalType === 'sharing') setVisibility(activeView?.visibility === 'public' ? 'public' : 'private');
  }, [modalType, activeView]);

  if (!modalType) return null;

  async function validateName(n: string): Promise<string | null> {
    if (!n.trim()) return 'El nombre es obligatorio.';
    if (n.trim().length > 80) return 'Máximo 80 caracteres.';
    const { data } = await supabase.from('list_views').select('id').eq('object', object).ilike('name', n.trim());
    if ((data || []).some(v => v.id !== activeView?.id)) return 'Ya existe una vista con ese nombre.';
    return null;
  }

  async function createOrClone() {
    const err = await validateName(name);
    if (err) { setError(err); return; }
    setSaving(true);
    const { data, error: dbErr } = await supabase.from('list_views').insert({
      name: name.trim(), object, owner_user_id: userId,
      visibility: isAdmin && visibility === 'public' ? 'public' : 'private', is_system: false,
      columns: p.effectiveColumns, sorting: p.effectiveSorting, filters: p.effectiveFilters, filter_logic: p.effectiveFilterLogic || null,
    }).select().single();
    if (dbErr || !data) { setError(dbErr?.message || 'No se pudo crear la vista.'); setSaving(false); return; }
    p.onViewCreated(data as ListView);
    onClose();
  }

  async function rename() {
    if (!activeView) return;
    const err = await validateName(name);
    if (err) { setError(err); return; }
    setSaving(true);
    const { error: dbErr } = await supabase.from('list_views').update({ name: name.trim() }).eq('id', activeView.id);
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    p.onViewUpdated({ ...activeView, name: name.trim() });
    onClose();
  }

  async function share() {
    if (!activeView) return;
    setSaving(true);
    const v = isAdmin && visibility === 'public' ? 'public' : 'private';
    const { error: dbErr } = await supabase.from('list_views').update({ visibility: v }).eq('id', activeView.id);
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    p.onViewUpdated({ ...activeView, visibility: v });
    onClose();
  }

  async function remove() {
    if (!activeView) return;
    setSaving(true);
    const { error: dbErr } = await supabase.from('list_views').delete().eq('id', activeView.id);
    if (dbErr) { setError(dbErr.message); setSaving(false); return; }
    p.onViewDeleted(activeView.id);
    onClose();
  }

  const titles: Record<string, string> = { new: 'Nueva vista de lista', clone: 'Clonar vista de lista', rename: 'Renombrar vista', sharing: 'Compartir vista', delete: 'Eliminar vista' };
  const showName = modalType === 'new' || modalType === 'clone' || modalType === 'rename';
  const showVisibility = modalType === 'new' || modalType === 'clone' || modalType === 'sharing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-ink">{titles[modalType]}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-bad-soft border border-bad/20 rounded-lg text-sm text-bad font-medium">{error}</div>}
        {modalType === 'delete' ? (
          <div className="flex items-start gap-2 text-sm text-ink-soft mb-5">
            <AlertTriangle className="w-4 h-4 mt-0.5 text-warn flex-shrink-0" />
            <span>Se eliminará la vista <strong>{activeView?.name}</strong>. Los registros no se ven afectados.</span>
          </div>
        ) : (
          <div className="space-y-4">
            {showName && (
              <div>
                <label className={label}>Nombre de la vista *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={field} autoFocus maxLength={80} />
              </div>
            )}
            {(modalType === 'new' || modalType === 'clone') && (
              <p className="text-xs text-ink-faint">Se guardan las columnas, el orden y los filtros que tienes aplicados ahora.</p>
            )}
            {showVisibility && (
              <div>
                <label className={label}>Quién puede ver esta vista</label>
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer"><input type="radio" checked={visibility === 'private'} onChange={() => setVisibility('private')} className="mt-1 accent-[#0176D3]" /><span className="text-sm text-ink">Solo yo</span></label>
                  <label className={`flex items-start gap-2 ${isAdmin ? 'cursor-pointer' : 'opacity-50'}`}><input type="radio" disabled={!isAdmin} checked={visibility === 'public'} onChange={() => setVisibility('public')} className="mt-1 accent-[#0176D3]" /><span className="text-sm text-ink">Todos los usuarios{!isAdmin && <span className="block text-xs text-ink-faint">Solo un administrador puede crear vistas públicas.</span>}</span></label>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className={secondaryBtn} disabled={saving}>Cancelar</button>
          {modalType === 'delete' ? (
            <button onClick={remove} disabled={saving} className="inline-flex items-center gap-2 h-10 px-4 bg-bad text-white font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-60">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Eliminar</button>
          ) : (
            <button onClick={modalType === 'rename' ? rename : modalType === 'sharing' ? share : createOrClone} disabled={saving} className={primaryBtn}>
              {saving && <Loader2 className="w-4 h-4 animate-spin" />} {modalType === 'rename' ? 'Guardar' : modalType === 'sharing' ? 'Guardar' : modalType === 'clone' ? 'Clonar' : 'Crear'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
