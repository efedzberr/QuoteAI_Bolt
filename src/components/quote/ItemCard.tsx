import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, RefreshCw, CreditCard as Edit3, Trash2, Loader2, Search } from 'lucide-react';
import type { LineItem } from '../../types/quote';

function ConfidenceChip({ value }: { value: number }) {
  const cls = value >= 85
    ? 'bg-good-soft text-good'
    : value >= 60
      ? 'bg-warn-soft text-warn'
      : 'bg-bad-soft text-bad';
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${cls}`}>
      {value}%
    </span>
  );
}

interface ItemCardProps {
  item: LineItem;
  onPatch: (patch: Partial<LineItem>) => void;
  onOpenSearch: () => void;
  onRemove: () => void;
  syncState: 'idle' | 'syncing' | 'error';
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n);
}

function borderColor(item: LineItem): string {
  if (item.source === 'manual') return '#0176D3';
  if (!item.matchedProduct || item.source === 'unmatched') return '#BA0517';
  if (item.source === 'matched' && item.confidence >= 95) return '#2E844A';
  return '#B86C00';
}

function ItemCard({ item, onPatch, onOpenSearch, onRemove, syncState }: ItemCardProps) {
  const basePrice = item.matchedProduct?.precio ?? 0;
  const effectivePrice = item.customPrice ?? basePrice;
  const subtotal = item.matchedProduct ? item.quantity * effectivePrice : 0;

  const [qtyInput, setQtyInput] = useState(String(item.quantity));
  const [priceInput, setPriceInput] = useState(String(effectivePrice));
  const [showNotes, setShowNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(item.notes ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const qtyTimer = useRef<number | null>(null);
  const priceTimer = useRef<number | null>(null);
  const notesTimer = useRef<number | null>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(() => {
    setQtyInput(String(item.quantity));
  }, [item.quantity]);

  useEffect(() => {
    setPriceInput(String(item.customPrice ?? basePrice));
  }, [item.customPrice, basePrice]);

  useEffect(() => {
    return () => {
      if (qtyTimer.current) clearTimeout(qtyTimer.current);
      if (priceTimer.current) clearTimeout(priceTimer.current);
      if (notesTimer.current) clearTimeout(notesTimer.current);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    };
  }, []);

  const handleQtyChange = (v: string) => {
    setQtyInput(v);
    if (qtyTimer.current) clearTimeout(qtyTimer.current);
    qtyTimer.current = window.setTimeout(() => {
      const n = parseFloat(v);
      if (!isNaN(n) && n > 0) onPatch({ quantity: n });
    }, 400);
  };

  const handlePriceChange = (v: string) => {
    setPriceInput(v);
    if (priceTimer.current) clearTimeout(priceTimer.current);
    priceTimer.current = window.setTimeout(() => {
      const n = parseFloat(v);
      if (!isNaN(n) && n >= 0) {
        onPatch({ customPrice: n === basePrice ? undefined : n });
      }
    }, 400);
  };

  const handleNotesChange = (v: string) => {
    setNotesDraft(v);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = window.setTimeout(() => {
      onPatch({ notes: v });
    }, 400);
  };

  const handleDeleteClick = () => {
    if (confirmDelete) {
      onRemove();
      return;
    }
    setConfirmDelete(true);
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    confirmTimer.current = window.setTimeout(() => setConfirmDelete(false), 3000);
  };

  const isPriceAdjusted = item.customPrice !== undefined && item.customPrice !== basePrice;

  return (
    <article
      className="relative bg-white border border-rule rounded-[10px] shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      style={{ borderLeft: `6px solid ${borderColor(item)}` }}
    >
      {syncState === 'syncing' && (
        <div className="absolute top-3 right-3 text-brand" aria-label="Sincronizando">
          <Loader2 size={12} className="animate-spin" strokeWidth={2.25} />
        </div>
      )}
      {syncState === 'error' && (
        <button
          onClick={() => onPatch({})}
          className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bad-soft text-bad text-[11px] font-bold hover:bg-bad/15"
        >
          No guardado · reintentar
        </button>
      )}

      <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-[1fr_56px] gap-4">
        <div className="min-w-0">
          <div>
            <div
              className="text-[10px] uppercase font-bold text-ink-faint"
              style={{ letterSpacing: '0.08em' }}
            >
              Texto detectado
            </div>
            <div className="mt-1 font-mono text-[12px] text-ink bg-rule-soft rounded px-2.5 py-1.5 break-words inline-block max-w-full">
              {item.rawText}
            </div>
          </div>

          <div className="mt-3">
            {item.matchedProduct ? (
              <div>
                <div
                  className="text-[10px] uppercase font-bold text-ink-faint"
                  style={{ letterSpacing: '0.08em' }}
                >
                  Coincidencia en catálogo
                </div>
                <div className="mt-1 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[12px] text-ink-faint tabular-nums">
                    {item.matchedProduct.codigoArt}
                  </span>
                  <span className="text-[14px] font-bold text-ink">
                    {item.matchedProduct.descCortaArt}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-bold uppercase">
                    {item.matchedProduct.marca}
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-ink-faint flex items-center gap-2 flex-wrap">
                  <span>{item.matchedProduct.categoriaArt}</span>
                  <span aria-hidden>•</span>
                  <span className="font-semibold text-ink-soft tabular-nums">
                    {formatCurrency(basePrice)} / {item.matchedProduct.ump}
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-bad-soft rounded-md px-3 py-3 flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-bad flex-shrink-0 mt-0.5" strokeWidth={2} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-bad">
                    No encontramos este producto en el catálogo
                  </p>
                  <button
                    onClick={onOpenSearch}
                    className="mt-2 inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-white border border-bad/30 text-bad text-[12px] font-semibold hover:bg-bad/10 focus-visible:ring-2 focus-visible:ring-bad focus-visible:ring-offset-1 transition-colors"
                  >
                    <Search size={12} strokeWidth={2.25} />
                    Buscar manualmente
                  </button>
                </div>
              </div>
            )}
          </div>

          {item.matchedProduct && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-end sm:flex-wrap gap-3">
              <div>
                <label
                  className="block text-[10px] uppercase font-bold text-ink-faint mb-1"
                  style={{ letterSpacing: '0.08em' }}
                >
                  Cantidad
                </label>
                <input
                  type="number"
                  min={1}
                  value={qtyInput}
                  onChange={(e) => handleQtyChange(e.target.value)}
                  className="w-20 border border-rule rounded-md bg-white text-[14px] text-ink text-right focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition tabular-nums"
                  style={{ padding: '8px 10px' }}
                  aria-label="Cantidad"
                />
              </div>
              <div className="flex items-center pb-1.5">
                <span className="inline-flex items-center px-2 py-1 rounded bg-rule-soft text-ink-soft text-[11px] font-bold uppercase">
                  {item.unit}
                </span>
              </div>
              <div className="flex items-center pb-2 text-ink-faint" aria-hidden>
                ×
              </div>
              <div>
                <label
                  className="block text-[10px] uppercase font-bold text-ink-faint mb-1"
                  style={{ letterSpacing: '0.08em' }}
                >
                  Precio unitario
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={priceInput}
                    onChange={(e) => handlePriceChange(e.target.value)}
                    className={`w-28 rounded-md bg-white text-[14px] text-ink text-right focus:outline-none focus:ring-2 focus:ring-brand-soft transition tabular-nums ${
                      isPriceAdjusted ? 'border-brand border-2' : 'border border-rule'
                    } focus:border-brand`}
                    style={{ padding: '8px 10px' }}
                    aria-label="Precio unitario"
                  />
                  {isPriceAdjusted && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-brand-soft text-brand text-[10px] font-bold uppercase">
                      Precio ajustado
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center pb-2 text-ink-faint" aria-hidden>
                =
              </div>
              <div className="flex-1 sm:text-right pb-1">
                <div
                  className="text-[10px] uppercase font-bold text-ink-faint mb-1"
                  style={{ letterSpacing: '0.08em' }}
                >
                  Subtotal
                </div>
                <div
                  className="text-[16px] font-bold text-ink tabular-nums"
                  aria-live="polite"
                >
                  {formatCurrency(subtotal)}
                </div>
              </div>
            </div>
          )}

          {showNotes && (
            <div className="mt-4">
              <label
                htmlFor={`notes-${item.id}`}
                className="block text-[10px] uppercase font-bold text-ink-faint mb-1"
                style={{ letterSpacing: '0.08em' }}
              >
                Notas internas
              </label>
              <textarea
                id={`notes-${item.id}`}
                value={notesDraft}
                onChange={(e) => handleNotesChange(e.target.value)}
                placeholder="Comentarios sobre este item…"
                rows={2}
                className="w-full border border-rule rounded-md bg-white text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand-soft transition resize-y"
                style={{ padding: '8px 10px' }}
              />
            </div>
          )}
        </div>

        <div className="flex sm:flex-col items-end sm:items-center gap-2 sm:gap-2 sm:pt-1">
          <ConfidenceChip value={item.confidence} />
          <div className="flex sm:flex-col gap-1.5 ml-auto sm:ml-0">
            <button
              onClick={onOpenSearch}
              aria-label="Cambiar producto"
              title="Cambiar producto"
              className="w-9 h-9 rounded-md flex items-center justify-center text-ink-soft border border-rule bg-white hover:bg-brand-soft hover:text-brand hover:border-brand/30 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 transition-colors"
            >
              <RefreshCw size={14} strokeWidth={2} />
            </button>
            <button
              onClick={() => setShowNotes((v) => !v)}
              aria-label="Notas internas"
              aria-pressed={showNotes}
              title="Notas"
              className={`w-9 h-9 rounded-md flex items-center justify-center border focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 transition-colors ${
                showNotes
                  ? 'bg-brand-soft text-brand border-brand/30'
                  : 'text-ink-soft border-rule bg-white hover:bg-rule-soft'
              }`}
            >
              <Edit3 size={14} strokeWidth={2} />
            </button>
            <button
              onClick={handleDeleteClick}
              aria-label={confirmDelete ? 'Confirmar eliminación' : 'Eliminar item'}
              title={confirmDelete ? '¿Confirmar?' : 'Eliminar'}
              className={`h-9 rounded-md flex items-center justify-center border focus-visible:ring-2 focus-visible:ring-bad focus-visible:ring-offset-1 transition-colors ${
                confirmDelete
                  ? 'bg-bad text-white border-bad px-3 text-[11px] font-bold'
                  : 'w-9 text-ink-soft border-rule bg-white hover:bg-bad-soft hover:text-bad hover:border-bad/30'
              }`}
            >
              {confirmDelete ? '¿Confirmar?' : <Trash2 size={14} strokeWidth={2} />}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default ItemCard;
