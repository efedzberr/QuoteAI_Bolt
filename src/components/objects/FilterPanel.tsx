import { useState, useEffect } from 'react';
import { Trash2, Plus, AlertCircle, X } from 'lucide-react';
import type { AdminObjectDef, ObjectFieldDef } from '../../lib/objectCatalog';
import {
  type FilterCriterion, type OwnerScope, getOperatorsForType, validateFilterLogic, rewriteFilterLogicOnRemove,
  RELATIVE_TOKENS, parseRelativeValue, serializeRelativeValue, CURRENT_USER_TOKEN,
} from '../../lib/listViews';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  def: AdminObjectDef;
  criteria: FilterCriterion[];
  filterLogic: string;
  ownerScope: OwnerScope;
  users: { id: string; label: string }[];
  isReadOnly: boolean;
  onSave: (criteria: FilterCriterion[], logic: string, scope: OwnerScope) => void;
}

const sel = 'h-9 px-2 border border-rule rounded-lg text-sm text-ink bg-white focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft';
const inp = 'h-9 px-2 border border-rule rounded-lg text-sm text-ink focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft';

export default function FilterPanel({ isOpen, onClose, def, criteria, filterLogic, ownerScope, users, isReadOnly, onSave }: Props) {
  const [local, setLocal] = useState<FilterCriterion[]>(criteria);
  const [logic, setLogic] = useState(filterLogic);
  const [scope, setScope] = useState<OwnerScope>(ownerScope);
  const [showLogic, setShowLogic] = useState(filterLogic.trim().length > 0);
  const [logicError, setLogicError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { setLocal(criteria); setLogic(filterLogic); setScope(ownerScope); setShowLogic(filterLogic.trim().length > 0); setLogicError(null); }
  }, [isOpen, criteria, filterLogic, ownerScope]);

  useEffect(() => { setLogicError(logic.trim() ? validateFilterLogic(logic, local.length) : null); }, [logic, local.length]);

  if (!isOpen) return null;

  const filterableFields = def.fields.filter(f => f.dataType !== 'user' || users.length > 0);

  const add = () => {
    const f = filterableFields[0];
    setLocal([...local, { id: crypto.randomUUID(), field: f.key, operator: getOperatorsForType(f.dataType)[0].value, value: '' }]);
  };
  const remove = (i: number) => {
    if (logic.trim()) {
      const r = rewriteFilterLogicOnRemove(logic, i + 1, local.length);
      if (r === null) { setLogic(''); setShowLogic(false); } else setLogic(r);
    }
    setLocal(local.filter((_, idx) => idx !== i));
  };
  const update = (i: number, patch: Partial<FilterCriterion>) => {
    setLocal(local.map((c, idx) => {
      if (idx !== i) return c;
      const u = { ...c, ...patch };
      if (patch.field && patch.field !== c.field) {
        const nf = def.fields.find(f => f.key === patch.field);
        u.operator = nf ? getOperatorsForType(nf.dataType)[0].value : '';
        u.value = '';
      }
      return u;
    }));
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-[440px] bg-white shadow-lg flex flex-col h-full border-l border-rule">
        <div className="flex items-center justify-between px-5 py-4 border-b border-rule">
          <h2 className="text-base font-bold text-ink">Filtros</h2>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="h-8 px-3 text-xs font-semibold text-ink-soft hover:bg-rule-soft rounded-lg">Cancelar</button>
            <button onClick={() => { if (!logicError) { onSave(local, logic, scope); onClose(); } }} disabled={!!logicError} className="h-8 px-3 text-xs font-semibold text-white bg-brand rounded-lg hover:bg-brand-deep disabled:opacity-50">Guardar</button>
            <button onClick={onClose} className="text-ink-faint hover:text-ink ml-1"><X className="w-4 h-4" /></button>
          </div>
        </div>
        {isReadOnly && (
          <div className="px-5 py-2 bg-warn-soft border-b border-warn/20 text-[11px] text-warn">Esta vista es de solo lectura: los filtros aplican solo en esta sesión. Clona la vista para guardarlos.</div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {def.ownerField && (
            <div>
              <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Filtrar por propietario</label>
              <div className="flex gap-2">
                {(['all', 'mine'] as OwnerScope[]).map(s => (
                  <button key={s} onClick={() => setScope(s)} className={`h-8 px-3 rounded-lg text-xs font-semibold border transition-colors ${scope === s ? 'bg-brand-soft border-brand text-brand' : 'bg-white border-rule text-ink-soft hover:bg-rule-soft'}`}>
                    {s === 'all' ? `Todas las ${def.label.toLowerCase()}` : 'Mis registros'}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wide mb-2">Criterios</label>
            {local.length === 0 && <p className="text-xs text-ink-faint italic">Sin filtros.</p>}
            <div className="space-y-3">
              {local.map((c, i) => {
                const f = def.fields.find(x => x.key === c.field) || def.fields[0];
                return (
                  <div key={c.id} className="border border-rule rounded-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-ink-faint uppercase tracking-wider">Filtro {i + 1}</span>
                      <button onClick={() => remove(i)} className="text-ink-faint hover:text-bad"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <select value={c.field} onChange={e => update(i, { field: e.target.value })} className={sel}>
                        {filterableFields.map(ff => <option key={ff.key} value={ff.key}>{ff.label}</option>)}
                      </select>
                      <select value={c.operator} onChange={e => update(i, { operator: e.target.value })} className={sel}>
                        {getOperatorsForType(f.dataType).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <ValueInput f={f} c={c} users={users} onChange={v => update(i, { value: v })} />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <button onClick={add} className="text-xs font-semibold text-brand hover:text-brand-deep flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar filtro</button>
              {local.length > 0 && <button onClick={() => { setLocal([]); setLogic(''); setShowLogic(false); }} className="text-xs font-semibold text-bad hover:opacity-80">Quitar todos</button>}
            </div>
          </div>
          {local.length >= 2 && (
            <div>
              {!showLogic ? (
                <button onClick={() => setShowLogic(true)} className="text-xs font-semibold text-brand hover:text-brand-deep">Agregar lógica de filtro</button>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-ink-soft uppercase tracking-wide">Lógica de filtro</label>
                    <button onClick={() => { setShowLogic(false); setLogic(''); }} className="text-[10px] text-ink-faint hover:text-ink">Quitar lógica</button>
                  </div>
                  <p className="text-[11px] text-ink-faint mb-1.5">Por default se cumplen todos (AND). Usa números, AND / OR y paréntesis, p. ej. "1 AND (2 OR 3)".</p>
                  <input value={logic} onChange={e => setLogic(e.target.value)} placeholder="1 AND (2 OR 3)" className={`w-full ${inp} ${logicError ? 'border-bad' : ''}`} />
                  {logicError && <p className="mt-1 text-[11px] text-bad flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {logicError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ValueInput({ f, c, users, onChange }: { f: ObjectFieldDef; c: FilterCriterion; users: { id: string; label: string }[]; onChange: (v: string) => void }) {
  if (f.dataType === 'text' && (c.operator === 'is_empty' || c.operator === 'not_empty')) return null;
  if (f.dataType === 'picklist') {
    return (
      <select value={c.value} onChange={e => onChange(e.target.value)} className={`w-full ${sel}`}>
        <option value="">— Selecciona —</option>
        {(f.picklist || []).map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }
  if (f.dataType === 'user') {
    return (
      <select value={c.value} onChange={e => onChange(e.target.value)} className={`w-full ${sel}`}>
        <option value="">— Selecciona —</option>
        <option value={CURRENT_USER_TOKEN}>Usuario actual</option>
        {users.map(u => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
    );
  }
  if (f.dataType === 'boolean') {
    return (
      <select value={c.value} onChange={e => onChange(e.target.value)} className={`w-full ${sel}`}>
        <option value="true">Sí</option><option value="false">No</option>
      </select>
    );
  }
  if (f.dataType === 'number' || f.dataType === 'currency') {
    return <input type="number" step="any" value={c.value} onChange={e => onChange(e.target.value)} className={`w-full ${inp}`} placeholder="Valor" />;
  }
  if (f.dataType === 'date' || f.dataType === 'datetime') {
    const rel = parseRelativeValue(c.value);
    const mode: 'specific' | 'relative' = rel ? 'relative' : 'specific';
    const tokenDef = rel ? RELATIVE_TOKENS.find(t => t.token === rel.token) : null;
    return (
      <div className="space-y-2">
        <div className="flex gap-2">
          <button onClick={() => onChange('')} className={`h-7 px-2 rounded-md text-[11px] font-semibold border ${mode === 'specific' ? 'bg-brand-soft border-brand text-brand' : 'bg-white border-rule text-ink-soft'}`}>Fecha</button>
          <button onClick={() => onChange('HOY')} className={`h-7 px-2 rounded-md text-[11px] font-semibold border ${mode === 'relative' ? 'bg-brand-soft border-brand text-brand' : 'bg-white border-rule text-ink-soft'}`}>Relativa</button>
        </div>
        {mode === 'specific' ? (
          <input type="date" value={c.value} onChange={e => onChange(e.target.value)} className={`w-full ${inp}`} />
        ) : (
          <div className="flex gap-2">
            <select value={rel?.token || 'HOY'} onChange={e => { const t = RELATIVE_TOKENS.find(x => x.token === e.target.value); onChange(serializeRelativeValue(e.target.value, t?.takesN ? (rel?.n ?? 7) : undefined)); }} className={`flex-1 ${sel}`}>
              {RELATIVE_TOKENS.map(t => <option key={t.token} value={t.token}>{t.label}</option>)}
            </select>
            {tokenDef?.takesN && (
              <input type="number" min={1} max={365} value={rel?.n ?? 7} onChange={e => onChange(serializeRelativeValue(rel!.token, Math.max(1, parseInt(e.target.value || '1', 10))))} className={`w-20 ${inp}`} />
            )}
          </div>
        )}
      </div>
    );
  }
  return <input value={c.value} onChange={e => onChange(e.target.value)} className={`w-full ${inp}`} placeholder="Valor" />;
}
