interface Props {
  score: number | null;
  size?: number;
  scanning?: boolean;
}

export function HealthGauge({ score, size = 180, scanning = false }: Props) {
  const r = 70;
  const cx = 100;
  const cy = 100;
  const circumference = 2 * Math.PI * r;
  const gaugeArc = circumference * (270 / 360);

  const filled = score !== null ? gaugeArc * (Math.max(0, Math.min(100, score)) / 100) : 0;

  const arcColor =
    score === null
      ? 'var(--surface-2)'
      : score >= 80
      ? 'var(--c-ok)'
      : score >= 50
      ? 'var(--c-high)'
      : 'var(--c-critical)';

  const label =
    score === null
      ? '—'
      : String(score);

  const sublabel =
    score === null
      ? 'not scanned'
      : score >= 80
      ? 'healthy'
      : score >= 50
      ? 'needs attention'
      : 'critical issues';

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        style={{ width: size, height: size }}
      >
        {/* Outer ring track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="8"
          strokeDasharray={`${gaugeArc} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {/* Fill arc */}
        {score !== null && (
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={arcColor}
            strokeWidth="8"
            strokeDasharray={`${filled} ${circumference}`}
            strokeLinecap="round"
            transform={`rotate(135 ${cx} ${cy})`}
            style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s ease' }}
          />
        )}
        {/* Score number */}
        <text
          x={cx} y={cy - 6}
          textAnchor="middle"
          fill="var(--text-1)"
          fontSize="34"
          fontWeight="600"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {scanning ? '…' : label}
        </text>
        {/* Sub-label */}
        <text
          x={cx} y={cy + 16}
          textAnchor="middle"
          fill="var(--text-2)"
          fontSize="11"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Inter', sans-serif"
        >
          {scanning ? 'scanning' : sublabel}
        </text>
      </svg>
    </div>
  );
}
