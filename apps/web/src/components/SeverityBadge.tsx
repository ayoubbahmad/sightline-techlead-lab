import type { FindingSeverity } from '@sightline/shared';

const colors: Record<FindingSeverity, string> = {
  critical: 'var(--c-critical)',
  high:     'var(--c-high)',
  medium:   'var(--c-medium)',
  low:      'var(--c-low)',
  info:     'var(--c-info)',
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span
      className="inline-flex items-center text-xs font-medium tabular"
      style={{ color: colors[severity] }}
    >
      {severity}
    </span>
  );
}
