import type { CategorySummary } from '@sightline/shared';

interface Props {
  summary: CategorySummary;
}

export function ScoreCard({ summary }: Props) {
  const total = summary.critical + summary.high + summary.medium + summary.low + summary.info;

  return (
    <div className="rounded-lg border border-zinc-800 bg-[var(--surface-1)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-zinc-300 capitalize">{summary.category}</h3>
        {summary.newSinceLastScan > 0 && (
          <span className="text-xs text-orange-400">+{summary.newSinceLastScan} new</span>
        )}
      </div>
      {total === 0 ? (
        <p className="text-sm text-zinc-500">No issues</p>
      ) : (
        <div className="space-y-1">
          {summary.critical > 0 && <Row label="critical" count={summary.critical} color="text-red-400" />}
          {summary.high > 0 && <Row label="high" count={summary.high} color="text-orange-400" />}
          {summary.medium > 0 && <Row label="medium" count={summary.medium} color="text-yellow-400" />}
          {summary.low > 0 && <Row label="low" count={summary.low} color="text-blue-400" />}
          {summary.info > 0 && <Row label="info" count={summary.info} color="text-zinc-400" />}
        </div>
      )}
    </div>
  );
}

function Row({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-zinc-500">{label}</span>
      <span className={`font-mono font-medium ${color}`}>{count}</span>
    </div>
  );
}
