import {
  Code2,
  Share2,
  Package,
  Shield,
  BookOpen,
  Zap,
} from 'lucide-react';
import type { CategorySummary, FindingCategory } from '@sightline/shared';

interface Props {
  summary: CategorySummary;
}

const icons: Record<FindingCategory, React.FC<{ size: number; color: string }>> = {
  quality:      ({ size, color }) => <Code2 size={size} color={color} />,
  architecture: ({ size, color }) => <Share2 size={size} color={color} />,
  dependencies: ({ size, color }) => <Package size={size} color={color} />,
  security:     ({ size, color }) => <Shield size={size} color={color} />,
  docs:         ({ size, color }) => <BookOpen size={size} color={color} />,
  performance:  ({ size, color }) => <Zap size={size} color={color} />,
};

const severityOrder = ['critical', 'high', 'medium', 'low', 'info'] as const;
const severityColors: Record<string, string> = {
  critical: 'var(--c-critical)',
  high:     'var(--c-high)',
  medium:   'var(--c-medium)',
  low:      'var(--c-low)',
  info:     'var(--c-info)',
};

export function ScoreCard({ summary }: Props) {
  const total = summary.critical + summary.high + summary.medium + summary.low + summary.info;
  const Icon = icons[summary.category];
  const isClean = total === 0;

  const dominantSeverity = severityOrder.find(
    (s) => summary[s as keyof CategorySummary] as number > 0
  );
  const iconColor = isClean
    ? 'var(--c-ok)'
    : dominantSeverity
    ? severityColors[dominantSeverity] ?? 'var(--text-2)'
    : 'var(--text-2)';

  return (
    <div
      className="rounded-xl p-5 border flex flex-col gap-4"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--surface-2)' }}
        >
          <Icon size={15} color={iconColor} />
        </div>
        <span
          className="text-sm font-medium capitalize flex-1"
          style={{ color: 'var(--text-1)' }}
        >
          {summary.category}
        </span>
        {summary.newSinceLastScan > 0 && (
          <span className="text-xs tabular" style={{ color: 'var(--c-high)' }}>
            +{summary.newSinceLastScan} new
          </span>
        )}
      </div>

      {/* Count */}
      <div>
        <span
          className="text-3xl font-semibold tabular leading-none"
          style={{ color: isClean ? 'var(--c-ok)' : 'var(--text-1)' }}
        >
          {total}
        </span>
        <span className="text-xs ml-1.5" style={{ color: 'var(--text-2)' }}>
          {isClean ? 'clean' : total === 1 ? 'issue' : 'issues'}
        </span>
      </div>

      {/* Severity bars */}
      {!isClean && (
        <div className="space-y-2">
          {severityOrder.map((s) => {
            const count = summary[s as keyof CategorySummary] as number;
            if (count === 0) return null;
            const pct = Math.max(4, (count / total) * 100);
            return (
              <div key={s} className="flex items-center gap-2">
                <div
                  className="h-1 rounded-full shrink-0"
                  style={{ width: `${pct}%`, maxWidth: '60%', background: severityColors[s] }}
                />
                <span className="text-xs tabular" style={{ color: 'var(--text-2)' }}>
                  {count} {s}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
