import { useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AdminObjectDef } from '../../lib/objectCatalog';

type Row = Record<string, unknown>;

interface Props { def: AdminObjectDef; row: Row | null; onClose: () => void; onSaved: () => void }

const field = 'w-full h-10 px-3 border border-rule rounded-lg text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition disabled:bg-rule-soft disabled:text-ink-faint';
const label = 'block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5';

export default function RecordFormModal({ def, row, onClose, onSaved }: Props) {
  const editing = !!row;
  const editableFields = def.fields.filter(f => f.editable || (!def.pkIsGenerated && f.key === def.pk));
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of editableFields) init[f.key] = row?.[f.key] === null || row?.[f.key] === undefined ? '' : String(row?.[f.key]);
    return init;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError('');
    const payload: Row = {};
    for (const f of editableFields) {
      if (editing && f.key === def.pk) continue;
      const raw = (form[f.key] ?? '').trim();
      if (f.required && !raw) { setError(`${f.label} es obligatorio.`); return; }
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
        ? await supabase.from(def.table).update(payload).eq(def.pk, row![def.pk] as string)
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
            <div key={f.key} className={f.dataType === 'text' && f.key === def.pk ? 'col-span-2' : ''}>
              <label className={label}>{f.label}{f.required && ' *'}</label>
              {f.dataType === 'picklist' ? (
                <select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} disabled={editing && f.key === def.pk} className={field}>
                  <option value="">—</option>
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
                  disabled={editing && f.key === def.pk}
                  className={`${field} ${f.key === def.pk || f.dataType !== 'text' ? 'font-mono' : ''}`}
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
