interface ConfidenceBadgeProps {
  value: number;
  isApproved?: boolean;
  badgeType?: 'auto' | 'manual' | 'producto_nuevo';
}

export default function ConfidenceBadge({ value, isApproved, badgeType }: ConfidenceBadgeProps) {
  let label: string;
  let bgColor: string;
  let textColor: string;

  if (badgeType === 'manual') {
    label = 'Manual';
    bgColor = '#EAF5FE';
    textColor = '#0176D3';
  } else if (badgeType === 'producto_nuevo') {
    label = 'Producto nuevo';
    bgColor = '#FEF1DC';
    textColor = '#B86C00';
  } else if (isApproved) {
    label = 'OK';
    bgColor = '#DEF5E5';
    textColor = '#2E844A';
  } else if (value >= 0.9) {
    label = `${Math.round(value * 100)}%`;
    bgColor = '#DEF5E5';
    textColor = '#2E844A';
  } else if (value >= 0.75) {
    label = `${Math.round(value * 100)}%`;
    bgColor = '#EAF5FE';
    textColor = '#0176D3';
  } else if (value >= 0.5) {
    label = `${Math.round(value * 100)}%`;
    bgColor = '#FEF1DC';
    textColor = '#B86C00';
  } else {
    label = 'Sin match';
    bgColor = '#FEDED7';
    textColor = '#BA0517';
  }

  return (
    <div className="flex items-center justify-center">
      <span
        className="inline-flex items-center gap-1 rounded-full"
        style={{
          backgroundColor: bgColor,
          color: textColor,
          fontSize: 11,
          fontWeight: 700,
          padding: '3px 9px',
          fontVariantNumeric: 'tabular-nums',
          fontFamily: "'Manrope', sans-serif",
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            backgroundColor: textColor,
            display: 'inline-block',
          }}
        />
        {label}
      </span>
    </div>
  );
}
