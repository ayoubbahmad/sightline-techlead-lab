import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { Finding, FindingCategory, FindingSeverity } from '@sightline/shared';
import { SeverityBadge } from './SeverityBadge.js';
import { api } from '../api/client.js';

interface Props {
  findings: Finding[];
  projectId: string;
}

type FilterKey = 'category' | 'severity' | 'tool' | 'status';

export function FindingsTable({ findings, projectId }: Props) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Partial<Record<FilterKey, string>>>({});
  const [groupByFile, setGroupByFile] = useState(true);

  const ignoreMutation = useMutation({
    mutationFn: (id: string) => api.findings.update(id, { status: 'ignored', ignoreReason: 'Manually ignored' }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['findings', projectId] });
    },
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

  // Unique values for filter pills
  const categories = [...new Set(findings.map((f) => f.category))];
  const severities: FindingSeverity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const tools = [...new Set(findings.map((f) => f.tool))];
  const statuses = ['open', 'fixed', 'ignored'] as const;

  // Group by file
  const grouped = groupByFile
    ? grouped_by(filtered, (f) => f.file ?? '(no file)')
    : grouped_by(filtered, () => 'All');

  if (findings.length === 0) {
    return <p className="text-zinc-500 text-sm py-4">No findings yet. Run a scan to get started.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 text-xs">
        <FilterGroup label="Category" values={categories} active={filters.category} onToggle={(v) => setFilter('category', v)} />
        <FilterGroup label="Severity" values={severities.filter((s) => findings.some((f) => f.severity === s))} active={filters.severity} onToggle={(v) => setFilter('severity', v)} />
        <FilterGroup label="Tool" values={tools} active={filters.tool} onToggle={(v) => setFilter('tool', v)} />
        <FilterGroup label="Status" values={[...statuses].filter((s) => findings.some((f) => f.status === s))} active={filters.status} onToggle={(v) => setFilter('status', v)} />
        <button
          onClick={() => setGroupByFile((x) => !x)}
          className={`ml-auto px-2 py-1 rounded border text-xs ${groupByFile ? 'border-zinc-600 text-zinc-300' : 'border-zinc-800 text-zinc-500'}`}
        >
          Group by file
        </button>
      </div>

      <p className="text-xs text-zinc-500">{filtered.length} finding{filtered.length !== 1 ? 's' : ''}</p>

      {/* Groups */}
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="border border-zinc-800 rounded-lg overflow-hidden">
          {groupByFile && (
            <div className="px-3 py-2 bg-[var(--surface-2)] border-b border-zinc-800">
              <span className="text-xs font-mono text-zinc-400">{group}</span>
              <span className="ml-2 text-xs text-zinc-600">({items.length})</span>
            </div>
          )}
          <table className="w-full text-sm">
            <tbody>
              {items.map((finding) => (
                <tr key={finding.id} className="border-b border-zinc-800 last:border-0 hover:bg-[var(--surface-2)] transition-colors">
                  <td className="px-3 py-2.5 w-24"><SeverityBadge severity={finding.severity} /></td>
                  <td className="px-3 py-2.5 w-24 text-zinc-500 font-mono text-xs">{finding.tool}</td>
                  <td className="px-3 py-2.5 text-zinc-200">{finding.message}</td>
                  {!groupByFile && (
                    <td className="px-3 py-2.5 text-zinc-500 font-mono text-xs">{finding.file ?? ''}</td>
                  )}
                  {finding.line && (
                    <td className="px-3 py-2.5 text-zinc-600 font-mono text-xs w-16">:{finding.line}</td>
                  )}
                  <td className="px-3 py-2.5 w-20">
                    {finding.status === 'open' && (
                      <button
                        onClick={() => ignoreMutation.mutate(finding.id)}
                        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        Ignore
                      </button>
                    )}
                    {finding.status === 'ignored' && (
                      <span className="text-xs text-zinc-600">Ignored</span>
                    )}
                    {finding.status === 'fixed' && (
                      <span className="text-xs text-green-600">Fixed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
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
      <span className="text-zinc-600">{label}:</span>
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onToggle(v)}
          className={`px-2 py-0.5 rounded border capitalize transition-colors ${
            active === v
              ? 'border-zinc-500 text-zinc-200 bg-zinc-800'
              : 'border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400'
          }`}
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
