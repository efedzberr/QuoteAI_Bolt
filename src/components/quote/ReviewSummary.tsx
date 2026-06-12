import { ArrowRight } from 'lucide-react';
import StatusSplitBar from './StatusSplitBar';
import type { LineItem } from '../../types/quote';

interface ReviewSummaryProps {
  items: LineItem[];
  onGenerate: () => void;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2,
  }).format(n);
}

function lineSubtotal(item: LineItem): number {
  if (!item.matchedProduct) return 0;
  const price = item.customPrice ?? item.matchedProduct.precio;
  return item.quantity * price;
}

function ReviewSummary({ items, onGenerate }: ReviewSummaryProps) {
  const matched = items.filter((i) => i.source === 'matched' && i.confidence >= 90);
  const fuzzy = items.filter((i) => i.source === 'fuzzy' || (i.source === 'matched' && i.confidence < 90));
  const unmatched = items.filter((i) => i.source === 'unmatched' || !i.matchedProduct);
  const manual = items.filter((i) => i.source === 'manual');

  const subtotal = items.reduce((s, it) => s + lineSubtotal(it), 0);
  const unresolvedCount = unmatched.length;
  const canGenerate = unresolvedCount === 0 && items.length > 0;

  return (
    <div className="space-y-4">
      <section className="bg-white border border-rule rounded-card shadow-sm p-5">
        <h3 className="text-[14px] font-bold text-ink">Resumen de la cotización</h3>
        <dl className="mt-4 space-y-2.5">
          {[
            ['Productos detectados', items.length],
            ['Coincidencias automáticas', matched.length],
            ['Requieren revisión', fuzzy.length],
            ['Sin identificar', unmatched.length],
          ].map(([label, value]) => (
            <div key={label as string} className="flex items-center justify-between text-[13px]">
              <dt className="text-ink-soft">{label}</dt>
              <dd className="font-semibold text-ink tabular-nums">{value as number}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between text-[13px] pt-2">
            <dt className="text-ink-soft">Subtotal estimado</dt>
            <dd className="font-semibold text-ink tabular-nums">{formatCurrency(subtotal)}</dd>
          </div>
        </dl>

        <div className="my-4 border-t border-rule-soft" />

        <div>
          <div
            className="text-[11px] uppercase font-bold text-ink-faint"
            style={{ letterSpacing: '0.08em' }}
          >
            Total estimado
          </div>
          <div
            className="mt-1 font-bold text-ink tabular-nums"
            style={{ fontSize: 24, letterSpacing: '-0.02em', lineHeight: 1.1 }}
          >
            {formatCurrency(subtotal)}
          </div>
        </div>
      </section>

      <section className="bg-white border border-rule rounded-card shadow-sm p-5">
        <h3 className="text-[14px] font-bold text-ink">Estado por item</h3>
        <div className="mt-4">
          <StatusSplitBar
            segments={[
              { key: 'matched', label: 'Identificados', count: matched.length, colorClass: 'bg-good' },
              { key: 'fuzzy', label: 'Requieren revisión', count: fuzzy.length, colorClass: 'bg-warn' },
              { key: 'unmatched', label: 'Sin identificar', count: unmatched.length, colorClass: 'bg-bad' },
              { key: 'manual', label: 'Manuales', count: manual.length, colorClass: 'bg-brand' },
            ]}
          />
        </div>
      </section>

      <div className="relative group">
        <button
          onClick={onGenerate}
          disabled={!canGenerate}
          className={`w-full inline-flex items-center justify-center gap-2 rounded-md text-white text-[15px] font-bold shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
            canGenerate ? 'bg-brand hover:bg-brand-deep' : 'bg-brand opacity-50 cursor-not-allowed'
          }`}
          style={{ padding: '14px 20px' }}
          aria-disabled={!canGenerate}
        >
          Generar cotización
          <ArrowRight size={16} strokeWidth={2.25} />
        </button>
        {!canGenerate && unresolvedCount > 0 && (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-md bg-ink text-white text-[12px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
          >
            Resuelve {unresolvedCount} {unresolvedCount === 1 ? 'item sin identificar' : 'items sin identificar'} antes de continuar
          </div>
        )}
      </div>
    </div>
  );
}

export default ReviewSummary;
