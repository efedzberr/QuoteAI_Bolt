interface Segment {
  key: string;
  label: string;
  count: number;
  colorClass: string;
}

interface StatusSplitBarProps {
  segments: Segment[];
}

function StatusSplitBar({ segments }: StatusSplitBarProps) {
  const total = segments.reduce((s, x) => s + x.count, 0) || 1;

  return (
    <div>
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full bg-rule-soft"
        role="img"
        aria-label="Distribución de items por estado"
      >
        {segments.map((seg) => {
          const pct = (seg.count / total) * 100;
          if (pct <= 0) return null;
          return (
            <div
              key={seg.key}
              className={`${seg.colorClass} transition-all`}
              style={{ width: `${pct}%` }}
              title={`${seg.label}: ${seg.count}`}
            />
          );
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        {segments.map((seg) => (
          <li key={seg.key} className="flex items-center gap-2 text-[12px] text-ink-soft">
            <span className={`w-2.5 h-2.5 rounded-sm ${seg.colorClass}`} aria-hidden />
            <span className="flex-1 truncate">{seg.label}</span>
            <span className="font-bold text-ink tabular-nums">{seg.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default StatusSplitBar;
