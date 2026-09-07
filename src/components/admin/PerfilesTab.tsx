import { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Plus, Trash2, Loader2, Lock, Save } from 'lucide-react';
import {
  OBJETOS, ACCIONES, PERMISOS_SISTEMA,
  fetchPerfiles, createPerfil, updatePerfil, savePermisosObjeto, deletePerfil, fetchConteoUsuarios,
  type Perfil, type PermisoObjeto, type PermisoSistema,
} from '../../lib/seguridad';

interface Props { onToast: (message: string, type: 'success' | 'error') => void }

const field = 'w-full h-10 px-3 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition disabled:bg-rule-soft disabled:text-ink-faint';
const label = 'block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5';
const primaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60 disabled:cursor-not-allowed transition-colors';
const secondaryBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60 transition-colors';
const dangerBtn = 'inline-flex items-center justify-center gap-2 h-10 px-4 bg-white text-bad font-semibold text-sm rounded-lg border border-bad/30 hover:bg-bad-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

type Draft = {
  name: string;
  description: string;
  sistema: Record<PermisoSistema, boolean>;
  objetos: Record<string, PermisoObjeto>;
};

function toDraft(p: Perfil, permisos: PermisoObjeto[]): Draft {
  const objetos: Record<string, PermisoObjeto> = {};
  for (const o of OBJETOS) {
    const found = permisos.find(x => x.perfil_id === p.id && x.object_name === o.id);
    objetos[o.id] = found || { perfil_id: p.id, object_name: o.id, can_read: false, can_create: false, can_edit: false, can_delete: false };
  }
  return {
    name: p.name,
    description: p.description || '',
    sistema: {
      ver_todos_datos: p.ver_todos_datos,
      modificar_todos_datos: p.modificar_todos_datos,
      administrar_usuarios: p.administrar_usuarios,
      administrar_configuracion: p.administrar_configuracion,
      ver_inventario: p.ver_inventario,
    },
    objetos,
  };
}

export default function PerfilesTab({ onToast }: Props) {
  const [perfiles, setPerfiles] = useState<Perfil[]>([]);
  const [permisos, setPermisos] = useState<PermisoObjeto[]>([]);
  const [conteo, setConteo] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ perfiles: ps, permisos: pm }, c] = await Promise.all([fetchPerfiles(), fetchConteoUsuarios()]);
      setPerfiles(ps); setPermisos(pm); setConteo(c.porPerfil);
      setSelectedId(prev => prev && ps.some(p => p.id === prev) ? prev : (ps[0]?.id ?? null));
    } catch (e: any) {
      onToast(e.message || 'No se pudieron cargar los perfiles.', 'error');
    } finally {
      setLoading(false);
    }
  }, [onToast]);

  useEffect(() => { load(); }, [load]);

  const selected = perfiles.find(p => p.id === selectedId) || null;

  useEffect(() => {
    if (selected) { setDraft(toDraft(selected, permisos)); setDirty(false); }
    else setDraft(null);
  }, [selected, permisos]);

  const select = (id: string) => {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return;
    setSelectedId(id);
  };

  const patch = (fn: (d: Draft) => Draft) => { setDraft(d => d ? fn(d) : d); setDirty(true); };

  const save = async () => {
    if (!selected || !draft) return;
    if (!draft.name.trim()) { onToast('El nombre del perfil es obligatorio.', 'error'); return; }
    setSaving(true);
    try {
      await updatePerfil(selected.id, {
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        ...draft.sistema,
      });
      await savePermisosObjeto(Object.values(draft.objetos));
      onToast('Perfil guardado', 'success');
      await load();
    } catch (e: any) {
      onToast(e.message || 'No se pudo guardar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const create = async () => {
    if (!newName.trim()) { onToast('Escribe un nombre para el perfil.', 'error'); return; }
    setSaving(true);
    try {
      const p = await createPerfil(newName, newDesc.trim() || null);
      setShowNew(false); setNewName(''); setNewDesc('');
      onToast(`Perfil "${p.name}" creado`, 'success');
      await load();
      setSelectedId(p.id);
    } catch (e: any) {
      onToast(e.message || 'No se pudo crear el perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await deletePerfil(selected.id);
      setConfirmDelete(false);
      onToast('Perfil eliminado', 'success');
      setSelectedId(null);
      await load();
    } catch (e: any) {
      onToast(e.message || 'No se pudo eliminar el perfil.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const usuariosDelPerfil = selected ? (conteo[selected.id] || 0) : 0;
  const locked = !!selected?.is_system;

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><ShieldCheck className="w-5 h-5 text-brand" /> Perfiles</h2>
          <p className="text-sm text-ink-faint mt-1">El perfil define <strong>qué puede hacer</strong> un usuario. Los roles definen qué puede ver.</p>
        </div>
        <button onClick={() => setShowNew(true)} className={primaryBtn}><Plus className="w-4 h-4" /> Nuevo perfil</button>
      </div>

      <div className="flex gap-5 items-start">
        {/* Lista */}
        <div className="w-[260px] flex-shrink-0 border border-rule rounded-card overflow-hidden">
          {loading && perfiles.length === 0 ? (
            <p className="px-4 py-6 text-sm text-ink-faint">Cargando…</p>
          ) : perfiles.map(p => (
            <button
              key={p.id}
              onClick={() => select(p.id)}
              className={`w-full text-left px-4 py-3 border-b border-rule-soft last:border-0 transition-colors ${selectedId === p.id ? 'bg-brand-soft' : 'hover:bg-rule-soft'}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${selectedId === p.id ? 'text-brand' : 'text-ink'}`}>{p.name}</span>
                {p.is_system && <Lock className="w-3.5 h-3.5 text-ink-faint" />}
              </div>
              <div className="text-xs text-ink-faint mt-0.5">{conteo[p.id] || 0} usuario{(conteo[p.id] || 0) === 1 ? '' : 's'}</div>
            </button>
          ))}
        </div>

        {/* Editor */}
        <div className="flex-1 min-w-0">
          {!selected || !draft ? (
            <div className="border-2 border-dashed border-rule rounded-card p-12 text-center text-sm text-ink-faint">Selecciona un perfil o crea uno nuevo.</div>
          ) : (
            <div className="space-y-6">
              {locked && (
                <div className="flex items-start gap-2 text-sm text-ink-soft bg-rule-soft border border-rule rounded-lg px-3 py-2">
                  <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-ink-faint" />
                  <span>Este es el perfil de sistema. Tiene todos los permisos, ignora la jerarquía de roles y no se puede editar ni eliminar. Solo puedes cambiar su descripción.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Nombre *</label>
                  <input value={draft.name} disabled={locked} onChange={e => patch(d => ({ ...d, name: e.target.value }))} className={field} />
                </div>
                <div>
                  <label className={label}>Descripción</label>
                  <input value={draft.description} onChange={e => patch(d => ({ ...d, description: e.target.value }))} className={field} placeholder="Para qué sirve este perfil" />
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-ink mb-2">Permisos de sistema</h3>
                <div className="border border-rule rounded-card divide-y divide-rule-soft">
                  {PERMISOS_SISTEMA.map(ps => (
                    <label key={ps.id} className={`flex items-start gap-3 px-4 py-3 ${locked ? 'opacity-70' : 'cursor-pointer hover:bg-rule-soft/50'}`}>
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={draft.sistema[ps.id]}
                        onChange={e => patch(d => ({ ...d, sistema: { ...d.sistema, [ps.id]: e.target.checked } }))}
                        className="mt-0.5 w-4 h-4 accent-[#0176D3]"
                      />
                      <span>
                        <span className="block text-sm font-medium text-ink">{ps.label}</span>
                        <span className="block text-xs text-ink-faint">{ps.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-ink mb-2">Permisos por objeto</h3>
                <div className="border border-rule rounded-card overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-rule-soft border-b border-rule">
                      <tr>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">Objeto</th>
                        {ACCIONES.map(a => <th key={a.id} className="text-center px-3 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider w-24">{a.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {OBJETOS.map(o => {
                        const row = draft.objetos[o.id];
                        return (
                          <tr key={o.id} className="border-b border-rule-soft last:border-0">
                            <td className="px-4 py-3">
                              <div className="font-medium text-ink">{o.label}</div>
                              <div className="text-xs text-ink-faint">{o.hint}</div>
                            </td>
                            {ACCIONES.map(a => (
                              <td key={a.id} className="text-center px-3 py-3">
                                <input
                                  type="checkbox"
                                  disabled={locked}
                                  checked={row[a.col]}
                                  onChange={e => patch(d => ({ ...d, objetos: { ...d.objetos, [o.id]: { ...d.objetos[o.id], [a.col]: e.target.checked } } }))}
                                  className="w-4 h-4 accent-[#0176D3]"
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-xs text-ink-faint">Los permisos por objeto aplican sobre los registros que el usuario puede ver según su rol. "Modificar todos los datos" otorga Leer / Editar / Eliminar sobre todo, sin importar el rol.</p>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-rule-soft">
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={locked || usuariosDelPerfil > 0 || saving}
                  className={dangerBtn}
                  title={locked ? 'Perfil de sistema' : usuariosDelPerfil > 0 ? 'Reasigna primero a los usuarios de este perfil' : 'Eliminar perfil'}
                >
                  <Trash2 className="w-4 h-4" /> Eliminar perfil
                </button>
                <div className="flex gap-2">
                  <button onClick={() => { setDraft(toDraft(selected, permisos)); setDirty(false); }} disabled={!dirty || saving} className={secondaryBtn}>Descartar</button>
                  <button onClick={save} disabled={!dirty || saving} className={primaryBtn}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cambios
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowNew(false)} />
          <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-ink mb-1">Nuevo perfil</h3>
            <p className="text-sm text-ink-faint mb-4">Se crea sin permisos; los defines en la siguiente pantalla.</p>
            <div className="space-y-3">
              <div>
                <label className={label}>Nombre *</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} className={field} placeholder="Ej. Gerente, Ejecutivo…" autoFocus />
              </div>
              <div>
                <label className={label}>Descripción</label>
                <input value={newDesc} onChange={e => setNewDesc(e.target.value)} className={field} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowNew(false)} className={secondaryBtn} disabled={saving}>Cancelar</button>
              <button onClick={create} className={primaryBtn} disabled={saving}>{saving && <Loader2 className="w-4 h-4 animate-spin" />} Crear perfil</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(false)} />
          <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-ink mb-1">Eliminar perfil</h3>
            <p className="text-sm text-ink-soft mb-5">Se eliminará el perfil <strong>{selected.name}</strong> y sus permisos. Esta acción no se puede deshacer.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDelete(false)} className={secondaryBtn} disabled={saving}>Cancelar</button>
              <button onClick={remove} disabled={saving} className="inline-flex items-center gap-2 h-10 px-4 bg-bad text-white font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-60"><Trash2 className="w-4 h-4" /> Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
