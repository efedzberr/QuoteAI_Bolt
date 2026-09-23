import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { type AdminObjectDef, type ObjectFieldDef, isPkField, pkMatch } from '../../lib/objectCatalog';
import { fetchGrupoNombres, type GrupoNombre } from '../../lib/seguridad';

type Row = Record<string, unknown>;

interface Props { def: AdminObjectDef; row: Row | null; onClose: () => void; onSaved: () => void }

const field = 'w-full h-10 px-3 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition disabled:bg-rule-soft disabled:text-ink-faint';
const label = 'block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5';
const OTHER = '__otro__';

export default function RecordFormModal({ def, row, onClose, onSaved }: Props) {
  const editing = !!row;
  const editableFields = def.fields.filter(f => f.editable || (!def.pkIsGenerated && isPkField(def, f.key)));
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of editableFields) init[f.key] = row?.[f.key] === null || row?.[f.key] === undefined ? '' : String(row?.[f.key]);
    return init;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [grupos, setGrupos] = useState<GrupoNombre[]>([]);
  const [gruposLoading, setGruposLoading] = useState(false);
  const [writingNew, setWritingNew] = useState<Record<string, boolean>>({});

  const needsGrupos = editableFields.some(f => f.lookup === 'grupos');
  useEffect(() => {
    if (!needsGrupos) return;
    let cancelled = false;
    setGruposLoading(true);
    fetchGrupoNombres()
      .then(g => { if (!cancelled) setGrupos(g); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'No se pudieron cargar los grupos.'); })
      .finally(() => { if (!cancelled) setGruposLoading(false); });
    return () => { cancelled = true; };
  }, [needsGrupos]);

  const isLocked = (f: ObjectFieldDef) => editing && isPkField(def, f.key);

  const submit = async () => {
    setError('');
    const payload: Row = {};
    for (const f of editableFields) {
      if (isLocked(f)) continue;
      const raw = (form[f.key] ?? '').trim();
      if (f.required && !raw) { setError(`${f.label} es obligatorio.`); return; }
      if (f.lookup === 'grupos' && raw && !f.lookupAllowNew && !grupos.some(g => g.group_name === raw)) {
        setError(`${f.label}: "${raw}" no existe en Grupos.`); return;
      }
      if (f.dataType === 'number' || f.dataType === 'currency') {
        if (!raw) { payload[f.key] = null; continue; }
        const n = Number(raw);
        if (isNaN(n)) { setError(`${f.label} debe ser numérico.`); return; }
        payload[f.key] = n;
      } else if (f.dataType === 'boolean') {
        payload[f.key] = raw === 'true';
      } else {
        payload[f.key] = raw || null;
      }
    }
    setSaving(true);
    try {
      const { error: dbErr } = editing
        ? await supabase.from(def.table).update(payload).match(pkMatch(def, row!))
        : await supabase.from(def.table).insert(payload);
      if (dbErr) throw new Error(dbErr.message);
      onSaved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo guardar.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const renderLookup = (f: ObjectFieldDef) => {
    const value = form[f.key] ?? '';
    const inList = grupos.some(g => g.group_name === value);
    const showText = !!f.lookupAllowNew && (writingNew[f.key] || (!!value && !inList && !gruposLoading));
    const selectValue = showText ? OTHER : value;
    return (
      <div className="space-y-2">
        <select
          value={selectValue}
          disabled={isLocked(f) || gruposLoading}
          onChange={e => {
            if (e.target.value === OTHER) { setWritingNew({ ...writingNew, [f.key]: true }); setForm({ ...form, [f.key]: '' }); }
            else { setWritingNew({ ...writingNew, [f.key]: false }); setForm({ ...form, [f.key]: e.target.value }); }
          }}
          className={field}
        >
          <option value="">{gruposLoading ? 'Cargando grupos\u2026' : '\u2014 Selecciona un grupo existente \u2014'}</option>
          {grupos.map(g => <option key={g.group_name} value={g.group_name}>{g.group_name} ({g.clientes.toLocaleString('es-MX')} cliente{g.clientes === 1 ? '' : 's'})</option>)}
          {f.lookupAllowNew && <option value={OTHER}>Otro (escribir nuevo grupo)…</option>}
        </select>
        {showText && (
          <input
            value={value}
            onChange={e => setForm({ ...form, [f.key]: e.target.value })}
            disabled={isLocked(f)}
            className={field}
            placeholder="Nombre del grupo nuevo"
            autoFocus
          />
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-lg mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-bold text-ink">{editing ? `Editar ${def.singular}` : `Nuevo ${def.singular}`}</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        {error && <div className="mb-4 p-3 bg-bad-soft border border-bad/20 rounded-lg text-sm text-bad font-medium">{error}</div>}
        <div className="grid grid-cols-2 gap-3">
          {editableFields.map(f => (
            <div key={f.key} className={f.lookup || (f.dataType === 'text' && isPkField(def, f.key)) ? 'col-span-2' : ''}>
              <label className={label}>{f.label}{f.required && ' *'}</label>
              {f.lookup === 'grupos' ? renderLookup(f) : f.dataType === 'picklist' ? (
                <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} disabled={isLocked(f)} className={field}>
                  <option value="">--</option>
                  {(f.picklist || []).map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ) : f.dataType === 'boolean' ? (
                <select value={form[f.key] || 'false'} onChange={e => setForm({ ...form, [f.key]: e.target.value })} className={field}>
                  <option value="true">Sí</option><option value="false">No</option>
                </select>
              ) : (
                <input
                  type={f.dataType === 'number' || f.dataType === 'currency' ? 'number' : 'text'}
                  step="any"
                  value={form[f.key]}
                  onChange={e => setForm({ ...form, [f.key]: e.target.value })}
                  disabled={isLocked(f)}
                  className={`${field} ${isPkField(def, f.key) || f.dataType !== 'text' ? 'font-mono' : ''}`}
                />
              )}
              {f.notes && <p className="mt-1 text-[11px] text-ink-faint">{f.notes}</p>}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} disabled={saving} className="inline-flex items-center h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft disabled:opacity-60">Cancelar</button>
          <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 h-10 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} {editing ? 'Guardar cambios' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}
