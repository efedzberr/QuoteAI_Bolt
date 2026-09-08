import { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft, ChevronUp, ChevronDown, X } from 'lucide-react';
import type { AdminObjectDef } from '../../lib/objectCatalog';
import type { ListViewColumn } from '../../lib/listViews';

interface Props { isOpen: boolean; onClose: () => void; def: AdminObjectDef; columns: ListViewColumn[]; isReadOnly: boolean; onSave: (cols: ListViewColumn[]) => void }

export default function SelectFieldsModal({ isOpen, onClose, def, columns, isReadOnly, onSave }: Props) {
  const [selected, setSelected] = useState<ListViewColumn[]>(columns);
  const [availSel, setAvailSel] = useState<string | null>(null);
  const [selSel, setSelSel] = useState<string | null>(null);

  useEffect(() => { if (isOpen) { setSelected(columns); setAvailSel(null); setSelSel(null); } }, [isOpen, columns]);
  if (!isOpen) return null;

  const selectedKeys = new Set(selected.map(c => c.field));
  const available = def.fields.filter(f => !selectedKeys.has(f.key));
  const move = (dir: -1 | 1) => {
    const i = selected.findIndex(c => c.field === selSel);
    if (i < 0 || i + dir < 0 || i + dir >= selected.length) return;
    const next = [...selected]; [next[i], next[i + dir]] = [next[i + dir], next[i]]; setSelected(next);
  };
  const listCls = 'border border-rule rounded-card h-72 overflow-y-auto';
  const itemCls = (active: boolean) => `w-full text-left px-3 py-1.5 text-sm ${active ? 'bg-brand-soft text-brand font-semibold' : 'text-ink hover:bg-rule-soft'}`;
  const iconBtn = 'w-8 h-8 flex items-center justify-center rounded-lg border border-rule text-ink-soft hover:bg-rule-soft disabled:opacity-40';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-hero shadow-lg border border-rule-soft w-full max-w-2xl mx-4 p-6">
        <div className="flex items-start justify-between mb-1">
          <h3 className="text-lg font-bold text-ink">Seleccionar campos a mostrar</h3>
          <button onClick={onClose} className="text-ink-faint hover:text-ink"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-ink-faint mb-4">{isReadOnly ? 'Esta vista es de solo lectura: el cambio aplica solo en esta sesión.' : 'El orden de la lista de la derecha es el orden de las columnas.'}</p>
        <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-3 items-center">
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">Campos disponibles</p>
            <div className={listCls}>{available.map(f => <button key={f.key} onClick={() => setAvailSel(f.key)} className={itemCls(availSel === f.key)}>{f.label}</button>)}</div>
          </div>
          <div className="flex flex-col gap-2">
            <button className={iconBtn} disabled={!availSel} onClick={() => { const f = def.fields.find(x => x.key === availSel); if (f) { setSelected([...selected, { field: f.key, label: f.label }]); setAvailSel(null); } }}><ChevronRight className="w-4 h-4" /></button>
            <button className={iconBtn} disabled={!selSel || selected.length <= 1} onClick={() => { setSelected(selected.filter(c => c.field !== selSel)); setSelSel(null); }}><ChevronLeft className="w-4 h-4" /></button>
          </div>
          <div>
            <p className="text-xs font-semibold text-ink-soft uppercase tracking-wide mb-1.5">Campos visibles</p>
            <div className={listCls}>{selected.map(c => <button key={c.field} onClick={() => setSelSel(c.field)} className={itemCls(selSel === c.field)}>{c.label}</button>)}</div>
          </div>
          <div className="flex flex-col gap-2">
            <button className={iconBtn} disabled={!selSel} onClick={() => move(-1)}><ChevronUp className="w-4 h-4" /></button>
            <button className={iconBtn} disabled={!selSel} onClick={() => move(1)}><ChevronDown className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="inline-flex items-center h-10 px-4 bg-white text-ink-soft font-semibold text-sm rounded-lg border border-rule hover:bg-rule-soft">Cancelar</button>
          <button onClick={() => { onSave(selected); onClose(); }} disabled={selected.length === 0} className="inline-flex items-center h-10 px-4 bg-brand text-white font-semibold text-sm rounded-lg hover:bg-brand-deep disabled:opacity-60">Guardar</button>
        </div>
      </div>
    </div>
  );
}
