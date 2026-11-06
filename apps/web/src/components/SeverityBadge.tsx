import type { FindingSeverity } from '@sightline/shared';

const styles: Record<FindingSeverity, string> = {
  critical: 'bg-red-500/15 text-red-400 ring-1 ring-red-500/30',
  high: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30',
  medium: 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30',
  low: 'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/30',
  info: 'bg-zinc-500/15 text-zinc-400 ring-1 ring-zinc-500/30',
};

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${styles[severity]}`}>
      {severity}
    </span>
  );
}
