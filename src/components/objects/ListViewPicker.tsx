import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Pin, PinOff, Search, Check } from 'lucide-react';
import type { ListView } from '../../lib/listViews';

interface Props {
  views: ListView[];
  activeView: ListView | null;
  pinnedId: string | null;
  recentIds: string[];
  onSelect: (view: ListView) => void;
  onTogglePin: () => void;
  subtitle: string;
}

export default function ListViewPicker({ views, activeView, pinnedId, recentIds, onSelect, onTogglePin, subtitle }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setSearch(''); } };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const q = search.trim().toLowerCase();
  const filtered = q ? views.filter(v => v.name.toLowerCase().includes(q)) : views;
  const recent = recentIds.map(id => views.find(v => v.id === id)).filter((v): v is ListView => !!v).slice(0, 4);
  const recentSet = new Set(recent.map(v => v.id));
  const others = filtered.filter(v => q || !recentSet.has(v.id));
  const isPinned = !!activeView && pinnedId === activeView.id;

  const Item = ({ v }: { v: ListView }) => (
    <button onClick={() => { setOpen(false); setSearch(''); onSelect(v); }} className="w-full flex items-center justify-between px-4 py-2 hover:bg-rule-soft text-left">
      <span className="text-sm text-ink">{v.name}{v.is_system && <span className="ml-2 text-[10px] text-ink-faint">Sistema</span>}{!v.is_system && v.visibility === 'public' && <span className="ml-2 text-[10px] text-ink-faint">Pública</span>}</span>
      {activeView?.id === v.id && <Check className="w-4 h-4 text-brand" />}
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-2">
        <div className="relative" ref={ref}>
          <button onClick={() => setOpen(o => !o)} className="flex items-center gap-1.5 text-lg font-bold text-ink hover:text-brand transition-colors">
            {activeView?.name || 'Vistas'}
            <ChevronDown className={`w-5 h-5 text-ink-faint transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <div className="absolute top-full left-0 mt-2 w-80 bg-white border border-rule rounded-card shadow-lg z-40 overflow-hidden">
              <div className="p-3 border-b border-rule-soft">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-faint" />
                  <input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar vistas…" className="w-full h-9 pl-8 pr-3 text-sm border border-rule rounded-lg focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft" />
                </div>
              </div>
              <div className="max-h-[360px] overflow-y-auto py-1">
                {!q && recent.length > 0 && (
                  <>
                    <div className="px-4 pt-2 pb-1 text-[10px] font-bold tracking-[0.12em] text-ink-faint uppercase">Vistas recientes</div>
                    {recent.map(v => <Item key={v.id} v={v} />)}
                  </>
                )}
                <div className="px-4 pt-2 pb-1 text-[10px] font-bold tracking-[0.12em] text-ink-faint uppercase">{q ? 'Resultados' : 'Todas las vistas'}</div>
                {others.map(v => <Item key={v.id} v={v} />)}
                {others.length === 0 && <p className="px-4 py-4 text-sm text-ink-faint text-center">Sin vistas.</p>}
              </div>
            </div>
          )}
        </div>
        <button onClick={onTogglePin} title={isPinned ? 'Quitar vista fijada' : 'Fijar como vista por default'} className={`p-1.5 rounded-md transition-colors ${isPinned ? 'text-brand bg-brand-soft' : 'text-ink-faint hover:text-ink hover:bg-rule-soft'}`}>
          {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
        </button>
      </div>
      <p className="mt-1 text-xs text-ink-faint">{subtitle}</p>
    </div>
  );
}
