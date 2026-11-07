import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Finding, FindingSeverity } from '@sightline/shared';
import { SeverityBadge } from './SeverityBadge.js';
import { api } from '../api/client.js';

interface Props {
  findings: Finding[];
  projectId: string;
}

type FilterKey = 'category' | 'severity' | 'tool' | 'status';

const severityBorderColors: Record<FindingSeverity, string> = {
  critical: 'var(--c-critical)',
  high:     'var(--c-high)',
  medium:   'var(--c-medium)',
  low:      'var(--c-low)',
  info:     'var(--c-info)',
};

export function FindingsTable({ findings, projectId }: Props) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [groupByFile, setGroupByFile] = useState(true);

  const ignoreMutation = useMutation({
    mutationFn: (id: string) => api.findings.update(id, { status: 'ignored', ignoreReason: 'Manually ignored' }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['findings', projectId] }),
  });

  const setFilter = (key: FilterKey, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: prev[key] === value ? undefined : value }));

  const filtered = findings.filter((f) => {
    if (filters.category && f.category !== filters.category) return false;
    if (filters.severity && f.severity !== filters.severity) return false;
    if (filters.tool && f.tool !== filters.tool) return false;
    if (filters.status && f.status !== filters.status) return false;
    return true;
  });

  const categories = [...new Set(findings.map((f) => f.category))];
  const severities: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const tools = [...new Set(findings.map((f) => f.tool))];
  const statuses = ['open', 'fixed', 'ignored'] as const;

  const grouped = groupByFile
    ? grouped_by(filtered, (f) => f.file ?? '(no file)')
    : grouped_by(filtered, () => 'All');

  if (findings.length === 0) {
    return (
      <p className="text-sm py-4" style={{ color: 'var(--text-3)' }}>
        No findings yet. Run a scan to get started.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <FilterGroup label="Category" values={categories} active={filters.category} onToggle={(v) => setFilter('category', v)} />
        <FilterGroup label="Severity" values={severities.filter((s) => findings.some((f) => f.severity === s))} active={filters.severity} onToggle={(v) => setFilter('severity', v)} />
        <FilterGroup label="Tool" values={tools} active={filters.tool} onToggle={(v) => setFilter('tool', v)} />
        <FilterGroup label="Status" values={[...statuses].filter((s) => findings.some((f) => f.status === s))} active={filters.status} onToggle={(v) => setFilter('status', v)} />
        <button
          onClick={() => setGroupByFile((x) => !x)}
          className="ml-auto px-2.5 py-1 rounded-lg border text-xs transition-colors"
          style={{
            borderColor: groupByFile ? 'var(--border-raised)' : 'var(--border)',
            color: groupByFile ? 'var(--text-1)' : 'var(--text-3)',
          }}
        >
          Group by file
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-3)' }}>
        {filtered.length} {filtered.length === 1 ? 'finding' : 'findings'}
      </p>

      {/* Groups */}
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          {groupByFile && (
            <div
              className="px-4 py-2 border-b"
              style={{ background: 'var(--surface-2)', borderColor: 'var(--border)' }}
            >
              <span className="text-xs font-mono" style={{ color: 'var(--text-2)' }}>{group}</span>
              <span className="ml-2 text-xs" style={{ color: 'var(--text-3)' }}>({items.length})</span>
            </div>
          )}
          {items.map((finding) => (
            <FindingRow
              key={finding.id}
              finding={finding}
              showFile={!groupByFile}
              onIgnore={() => ignoreMutation.mutate(finding.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function FindingRow({
  finding,
  showFile,
  onIgnore,
}: {
  finding: Finding;
  showFile: boolean;
  onIgnore: () => void;
}) {
  return (
    <div
      className="flex items-start gap-0 border-b last:border-0 group"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Severity stripe — the signature detail */}
      <div
        className="w-0.5 self-stretch shrink-0"
        style={{ background: severityBorderColors[finding.severity] ?? 'transparent' }}
      />
      <div className="flex items-center gap-3 flex-1 px-4 py-2.5 min-w-0">
        <span className="shrink-0 w-16">
          <SeverityBadge severity={finding.severity} />
        </span>
        <span className="shrink-0 w-20 text-xs font-mono" style={{ color: 'var(--text-3)' }}>
          {finding.tool}
        </span>
        <span className="flex-1 text-sm truncate" style={{ color: 'var(--text-1)' }}>
          {finding.message}
        </span>
        {showFile && finding.file && (
          <span className="shrink-0 text-xs font-mono" style={{ color: 'var(--text-3)' }}>
            {finding.file}
          </span>
        )}
        {finding.line != null && (
          <span className="shrink-0 text-xs font-mono tabular" style={{ color: 'var(--text-3)' }}>
            :{finding.line}
          </span>
        )}
        <div className="shrink-0 w-16 text-right">
          {finding.status === 'open' && (
            <button
              onClick={onIgnore}
              className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--text-3)' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; }}
            >
              Ignore
            </button>
          )}
          {finding.status === 'ignored' && (
            <span className="text-xs" style={{ color: 'var(--text-3)' }}>Ignored</span>
          )}
          {finding.status === 'fixed' && (
            <span className="text-xs" style={{ color: 'var(--c-ok)' }}>Fixed</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  values,
  active,
  onToggle,
}: {
  label: string;
  values: string[];
  active: string | undefined;
  onToggle: (v: string) => void;
}) {
  if (values.length === 0) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</span>
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          className="px-2 py-0.5 rounded-lg border text-xs capitalize transition-colors"
          style={{
            borderColor: active === v ? 'var(--border-raised)' : 'var(--border)',
            color: active === v ? 'var(--text-1)' : 'var(--text-3)',
            background: active === v ? 'var(--surface-2)' : 'transparent',
          }}
        >
          {v}
        </button>
      ))}
    </div>
  );
}

function grouped_by<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    (result[k] ??= []).push(item);
  }
  return result;
}
