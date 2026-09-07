import { useState, useEffect, useCallback, useMemo } from 'react';
import { Network, Plus, Pencil, Trash2, Loader2, ChevronRight, ChevronDown, CornerDownRight, Users } from 'lucide-react';
import { fetchRoles, createRol, updateRol, deleteRol, fetchConteoUsuarios, type Rol } from '../../lib/seguridad';

interface Props { onToast: (message: string, type: 'success' | 'error') => void }

const field = 'w-full h-10 px-3 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition';
const label = 'block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5';
const primaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const secondaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 transition-colors';

type FormState = { mode: 'create' | 'edit'; rol?: Rol; parentId: string | null; name: string; description: string };

function descendants(roles: Rol[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (pid: string) => roles.filter(r => r.parent_id === pid).forEach(r => { out.add(r.id); walk(r.id); });
  walk(id);
  return out;
}

export default function RolesTab({ onToast }: Props) {
  const [roles, setRoles] = useState<Rol[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<FormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Rol | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rs, c] = await Promise.all([fetchRoles(), fetchConteoUsuarios()]);
      setRoles(rs); setConteo(c.porRol);
    } catch (e: any) {
      onToast(e.message || 'No se pudieron cargar los roles.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const children = useMemo(() => {
    const map: Record<string, Rol[]> = {};
    for (const r of roles) { const k = r.parent_id || 'root'; (map[k] ||= []).push(r); }
    return map;
  }, [roles]);

  const toggle = (id: string) => setCollapsed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const submit = async () => {
    if (!form) return;
    if (!form.name.trim()) { onToast('El nombre del rol es obligatorio.', 'error'); return; }
    setSaving(true);
    try {
      if (form.mode === 'create') {
        await createRol(form.name, form.parentId, form.description.trim() || null);
        onToast('Rol creado', 'success');
      } else if (form.rol) {
        await updateRol(form.rol.id, { name: form.name.trim(), parent_id: form.parentId, description: form.description.trim() || null });
        onToast('Rol actualizado', 'success');
      }
      setForm(null);
      await load();
    } catch (e: any) {
      onToast(e.message || 'No se pudo guardar el rol.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await deleteRol(deleteTarget.id);
      setDeleteTarget(null);
      onToast('Rol eliminado', 'success');
      await load();
    } catch (e: any) {
      onToast(e.message || 'No se pudo eliminar el rol.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = useMemo(() => {
    if (!form) return [];
    const excluded = form.mode === 'edit' && form.rol ? new Set([form.rol.id, ...descendants(roles, form.rol.id)]) : new Set<string>();
    const out: { id: string; label: string }[] = [];
    const walk = (pid: string | null, depth: number) => {
      (children[pid || 'root'] || []).forEach(r => {
        if (!excluded.has(r.id)) out.push({ id: r.id, label: `${'— '.repeat(depth)}${r.name}` });
        walk(r.id, depth + 1);
      });
    };
    walk(null, 0);
    return out;
  }, [form, roles, children]);

  const renderNode = (r: Rol, depth: number) => {
    const kids = children[r.id] || [];
    const isCollapsed = collapsed.has(r.id);
    const users = conteo[r.id] || 0;
    return (
      <div key={r.id}>
        <div className="group flex items-center gap-2 py-2 pr-3 border-b border-rule-soft hover:bg-rule-soft/50" style={{ paddingLeft: 12 + depth * 24 }}>
          <button onClick={() => toggle(r.id)} className={`w-5 h-5 flex items-center justify-center text-ink-faint ${kids.length === 0 ? 'invisible' : ''}`}>
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {depth > 0 && <CornerDownRight className="w-3.5 h-3.5 text-ink-faint" />}
          <span className="text-sm font-semibold text-ink">{r.name}</span>
          {r.description && <span className="text-xs text-ink-faint truncate">— {r.description}</span>}
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-faint"><Users className="w-3.5 h-3.5" /> {users}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => setForm({ mode: 'create', parentId: r.id, name: '', description: '' })} className="w-7 h-7 flex items-center justify-center rounded-md text-ink-faint hover:bg-brand-soft hover:text-brand" title="Agregar rol debajo"><Plus className="w-4 h-4" /></button>
            <button onClick={() => setForm({ mode: 'edit', rol: r, parentId: r.parent_id, name: r.name, description: r.description || '' })} className="w-7 h-7 flex items-center justify-center rounded-md text-ink-faint hover:bg-rule-soft hover:text-ink" title="Editar"><Pencil className="w-4 h-4" /></button>
            <button
              onClick={() => setDeleteTarget(r)}
              disabled={kids.length > 0 || users > 0}
              className="w-7 h-7 flex items-center justify-center rounded-md text-ink-faint hover:bg-bad-soft hover:text-bad disabled:opacity-30 disabled:cursor-not-allowed"
              title={kids.length > 0 ? 'Tiene roles debajo' : users > 0 ? 'Tiene usuarios asignados' : 'Eliminar'}
            ><Trash2 className="w-4 h-4" /></button>
          </div>
        </div>
        {!isCollapsed && kids.map(k => renderNode(k, depth + 1))}
      </div>
    );
  };

  const roots = children['root'] || [];

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Network className="w-5 h-5 text-brand" /> Roles y jerarquía</h2>
          <p className="text-sm text-ink-faint mt-1">El rol define <strong>qué puede ver</strong> un usuario: sus propias cotizaciones y las de todos los que están debajo de él en la jerarquía.</p>
        </div>
        <button onClick={() => setForm({ mode: 'create', parentId: null, name: '', description: '' })} className={primaryBtn}><Plus className="w-4 h-4" /> Nuevo rol raíz</button>
      </div>

      <div className="border border-rule rounded-card overflow-hidden">
        {loading && roles.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-faint">Cargando…</p>
        ) : roots.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-ink">Aún no hay roles.</p>
            <p className="text-sm text-ink-faint mt-1">Crea el rol más alto (por ejemplo, Director General) y después agrega los que dependen de él.</p>
          </div>
        ) : roots.map(r => renderNode(r, 0))}
      </div>
      <p className="mt-2 text-xs text-ink-faint">Los usuarios sin rol solo ven sus propias cotizaciones. Los perfiles con "Ver todos los datos" ignoran la jerarquía.</p>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setForm(null)} />
          <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-ink mb-4">{form.mode === 'create' ? 'Nuevo rol' : 'Editar rol'}</h3>
            <div className="space-y-3">
              <div>
                <label className={label}>Nombre *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={field} placeholder="Ej. Director de Ventas" autoFocus />
              </div>
              <div>
                <label className={label}>Reporta a</label>
                <select value={form.parentId || ''} onChange={e => setForm({ ...form, parentId: e.target.value || null })} className={field}>
                  <option value="">— Ninguno (rol raíz) —</option>
                  {parentOptions.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className={label}>Descripción</label>
                <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className={field} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setForm(null)} className={secondaryBtn} disabled={saving}>Cancelar</button>
              <button onClick={submit} className={primaryBtn} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} {form.mode === 'create' ? 'Crear rol' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-ink mb-1">Eliminar rol</h3>
            <p className="text-sm text-ink-soft mb-5">Se eliminará el rol <strong>{deleteTarget.name}</strong>. Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className={secondaryBtn} disabled={saving}>Cancelar</button>
              <button onClick={remove} disabled={saving} className="inline-flex items-center gap-2 h-10 px-4 bg-bad text-white font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-60"><Trash2 className="w-4 h-4" /> Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
