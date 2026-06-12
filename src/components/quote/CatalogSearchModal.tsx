import { useEffect, useRef, useState } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import type { CatalogProduct } from '../../types/quote';
import { searchProducts } from '../../lib/productDatabase';

async function searchCatalog(query: string): Promise<CatalogProduct[]> {
  const products = await searchProducts(query, 'ALL', 'ALL');
  return products.map((p) => ({
    codigoArt: p.ProductCode,
    descCortaArt: p.ProductName,
    marca: p.Manufacturer,
    ump: p.UnitOfMeasure,
    deptoArt: p.Department,
    categoriaArt: p.Category,
    precio: p.UnitPrice,
  }));
}

interface CatalogSearchModalProps {
  rawText: string;
  onClose: () => void;
  onSelect: (product: CatalogProduct) => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function CatalogSearchModal({ rawText, onClose, onSelect }: CatalogSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchCatalog(query);
      if (!cancelled) {
        setResults(r);
        setActiveIdx(0);
        setLoading(false);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
      } else if (e.key === 'Enter') {
        if (results[activeIdx]) {
          e.preventDefault();
          onSelect(results[activeIdx]);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [results, activeIdx, onSelect, onClose]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-search-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="relative w-full sm:max-w-[600px] sm:max-h-[80vh] max-h-full h-full sm:h-auto bg-white sm:rounded-[12px] shadow-md flex flex-col overflow-hidden"
        style={{ animation: 'rise-in 0.18s ease-out both' }}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-rule">
          <div className="min-w-0">
            <h3 id="catalog-search-title" className="text-[15px] font-bold text-ink">
              Buscar producto en catálogo
            </h3>
            <p className="mt-0.5 text-[12px] text-ink-faint">
              Selecciona el producto que corresponde al item detectado
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="w-8 h-8 rounded-md flex items-center justify-center text-ink-soft hover:bg-rule-soft focus-visible:ring-2 focus-visible:ring-brand transition-colors flex-shrink-0"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div
            className="text-[10px] uppercase font-bold text-ink-faint mb-1.5"
            style={{ letterSpacing: '0.08em' }}
          >
            Texto detectado
          </div>
          <div
            className="font-mono text-[12px] text-ink bg-rule-soft rounded-md px-3 py-2 break-words"
          >
            {rawText}
          </div>
        </div>

        <div className="px-5 pt-4">
          <div className="relative">
            <Search
              size={16}
              strokeWidth={2}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por código, descripción o categoría…"
              className="w-full border border-rule rounded-md bg-white text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition"
              style={{ padding: '10px 12px 10px 38px' }}
            />
            {loading && (
              <Loader2
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand animate-spin"
              />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 min-h-[200px]">
          {results.length === 0 && !loading ? (
            <div className="text-center py-12">
              <p className="text-[13px] text-ink-faint">
                Sin coincidencias para “{query}”
              </p>
            </div>
          ) : (
            <ul ref={listRef} className="space-y-1.5">
              {results.map((p, i) => {
                const active = i === activeIdx;
                return (
                  <li key={p.codigoArt}>
                    <button
                      data-idx={i}
                      onClick={() => onSelect(p)}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full text-left rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                        active ? 'bg-brand-soft' : 'hover:bg-rule-soft'
                      }`}
                      style={{ padding: '10px 12px' }}
                    >
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] text-ink-faint tabular-nums">
                              {p.codigoArt}
                            </span>
                            <span className="text-[14px] font-bold text-ink">
                              {p.descCortaArt}
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-bold uppercase">
                              {p.marca}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[12px] text-ink-faint">
                            {p.categoriaArt}
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-[14px] font-bold text-ink tabular-nums">
                            {formatCurrency(p.precio)}
                          </div>
                          <div className="text-[11px] text-ink-faint">por {p.ump}</div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="px-5 py-3 border-t border-rule flex justify-end">
          <button
            onClick={onClose}
            className="inline-flex items-center h-9 px-4 rounded-md bg-white border border-rule text-ink text-[13px] font-semibold hover:bg-rule-soft focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

export default CatalogSearchModal;
