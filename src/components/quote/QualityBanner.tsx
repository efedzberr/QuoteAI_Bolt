import { Sparkles } from 'lucide-react';

interface QualityBannerProps {
  total: number;
  highCount: number;
  needsReviewCount: number;
  overallConfidence: number;
}

function QualityBanner({ total, highCount, needsReviewCount, overallConfidence }: QualityBannerProps) {
  const pct = Math.max(0, Math.min(100, Math.round(overallConfidence)));
  const radius = 32;
  const circ = 2 * Math.PI * radius;
  const dash = (pct / 100) * circ;

  const ringColor =
    pct >= 90 ? '#2E844A' : pct >= 75 ? '#B86C00' : '#BA0517';

  return (
    <div
      className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5"
      style={{
        background: 'linear-gradient(135deg, #EAF5FE 0%, rgba(234,245,254,0) 100%)',
        border: '1px solid rgba(1,118,211,0.20)',
        borderRadius: 12,
        padding: '20px 24px',
      }}
    >
      <div className="flex items-start gap-4 min-w-0">
        <div className="flex-shrink-0 w-11 h-11 rounded-full bg-brand-soft border border-brand/20 flex items-center justify-center text-brand">
          <Sparkles size={20} strokeWidth={2} />
        </div>
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold text-ink leading-tight">
            Procesamiento completado
          </h2>
          <p className="mt-1 text-[13px] text-ink-soft leading-relaxed">
            Identificamos <span className="font-semibold text-ink">{total}</span> items en tu archivo.{' '}
            <span className="font-semibold text-good">{highCount}</span> con alta confianza y{' '}
            <span className="font-semibold text-warn">{needsReviewCount}</span> requieren revisión.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="relative" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden>
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke="#E5E5E5"
              strokeWidth="6"
            />
            <circle
              cx="40"
              cy="40"
              r={radius}
              fill="none"
              stroke={ringColor}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
              transform="rotate(-90 40 40)"
              style={{ transition: 'stroke-dasharray 0.6s ease' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[16px] font-bold text-ink tabular-nums">{pct}%</span>
          </div>
        </div>
        <div className="text-[11px] uppercase tracking-wide font-bold text-ink-faint max-w-[80px] leading-tight">
          Confianza global
        </div>
      </div>
    </div>
  );
}

export default QualityBanner;
