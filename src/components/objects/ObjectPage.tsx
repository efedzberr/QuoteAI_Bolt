import { useState, useEffect } from 'react';
import { Database } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { adminObjectFor, isPkField } from '../../lib/objectCatalog';
import ObjectListView from './ObjectListView';

interface Props { objectId: string; onToast: (message: string, type: 'success' | 'error') => void }

const TYPE_LABEL: Record<string, string> = { text: 'Texto', number: 'Número', currency: 'Moneda', date: 'Fecha', datetime: 'Fecha y hora', picklist: 'Lista', user: 'Usuario', boolean: 'Casilla' };

export default function ObjectPage({ objectId, onToast }: Props) {
  const def = adminObjectFor(objectId);
  const [tab, setTab] = useState<'records' | 'fields'>('records');
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    setTab('records');
    setCount(null);
    if (!def) return;
    let cancelled = false;
    supabase.from(def.table).select(def.pk, { count: 'exact', head: true }).then(({ count: c }) => { if (!cancelled) setCount(c ?? null); });
    return () => { cancelled = true; };
  }, [def, objectId]);

  if (!def) return <p className="text-sm text-ink-faint">Objeto no encontrado.</p>;

  const tabCls = (active: boolean) => `pb-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${active ? 'border-brand text-brand' : 'border-transparent text-ink-soft hover:text-ink'}`;

  return (
    <div>
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-xl font-bold text-ink"><Database className="w-5 h-5 text-brand" /> {def.label}</h2>
        <p className="mt-1 text-xs text-ink-faint">
          Tabla <span className="font-mono">{def.table}</span>
          {count !== null && <> &middot; {count.toLocaleString('es-MX')} registro{count === 1 ? '' : 's'}</>}
          {def.readOnly && <> &middot; Solo lectura</>}
          {def.note && <> &middot; {def.note}</>}
        </p>
      </div>
      <div className="flex gap-6 border-b border-rule mb-5">
        <button onClick={() => setTab('records')} className={tabCls(tab === 'records')}>Registros</button>
        <button onClick={() => setTab('fields')} className={tabCls(tab === 'fields')}>Campos <span className="ml-1 text-xs text-ink-faint">({def.fields.length})</span></button>
      </div>
      {tab === 'records' ? (
        <ObjectListView key={def.id} def={def} onToast={onToast} />
      ) : (
        <div className="border border-rule rounded-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-rule-soft border-b border-rule">
              <tr>
                {['Etiqueta', 'Columna', 'Tipo', 'Requerido', 'Editable', 'Notas'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-ink-soft uppercase tracking-wider">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {def.fields.map(f => (
                <tr key={f.key} className="border-b border-rule-soft last:border-0 hover:bg-rule-soft/50">
                  <td className="px-4 py-2.5 text-ink font-medium">{f.label}{isPkField(def, f.key) && <span className="ml-2 text-[10px] text-ink-faint">PK</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-ink-soft">{f.key}</td>
                  <td className="px-4 py-2.5"><span className="inline-block px-2 py-0.5 text-xs rounded-full bg-rule-soft border border-rule text-ink-soft">{TYPE_LABEL[f.dataType] || f.dataType}</span></td>
                  <td className="px-4 py-2.5 text-xs">{f.required ? <span className="text-bad font-semibold">S\u00ed</span> : <span className="text-ink-faint">No</span>}</td>
                  <td className="px-4 py-2.5 text-xs">{!def.readOnly && f.editable ? <span className="text-good font-semibold">S\u00ed</span> : <span className="text-ink-faint">No</span>}</td>
                  <td className="px-4 py-2.5 text-xs text-ink-faint">{f.notes || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
