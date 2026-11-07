import { useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ScanRun } from '@sightline/shared';
import { api } from '../api/client.js';
import { HealthGauge } from '../components/HealthGauge.js';
import { ScoreCard } from '../components/ScoreCard.js';
import { FindingsTable } from '../components/FindingsTable.js';
import { ScanProgress } from '../components/ScanProgress.js';

function computeScore(categorySummary: { critical: number; high: number; medium: number; low: number }[]): number {
  const totals = categorySummary.reduce(
    (acc, c) => ({
      critical: acc.critical + c.critical,
      high: acc.high + c.high,
      medium: acc.medium + c.medium,
      low: acc.low + c.low,
    }),
    { critical: 0, high: 0, medium: 0, low: 0 },
  );
  return Math.max(0, Math.round(100 - (totals.critical * 10 + totals.high * 5 + totals.medium * 2 + totals.low * 0.5)));
}

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [showFindings, setShowFindings] = useState(false);

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  });

  const { data: health } = useQuery({
    queryKey: ['health', id],
    queryFn: () => api.projects.health(id!),
    enabled: !!id,
  });

  const { data: findings } = useQuery({
    queryKey: ['findings', id],
    queryFn: () => api.findings.list(id!),
    enabled: !!id,
  });

  const { data: commits } = useQuery({
    queryKey: ['commits', id],
    queryFn: () => api.projects.commits(id!),
    enabled: !!id,
  });

  const scanMutation = useMutation({
    mutationFn: () => api.scans.trigger(id!),
    onSuccess: (scan) => setActiveScanId(scan.id),
  });

  const handleScanDone = useCallback(() => {
    setActiveScanId(null);
    void queryClient.invalidateQueries({ queryKey: ['project', id] });
    void queryClient.invalidateQueries({ queryKey: ['health', id] });
    void queryClient.invalidateQueries({ queryKey: ['health-summary', id] });
    void queryClient.invalidateQueries({ queryKey: ['findings', id] });
  }, [id, queryClient]);

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--surface-0)' }}>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Loading…</p>
      </div>
    );
  }

  const score = health ? computeScore(health.categorySummary) : null;
  const isScanning = !!activeScanId;

  const totalIssues = health?.categorySummary.reduce(
    (sum, c) => sum + c.critical + c.high + c.medium + c.low + c.info,
    0,
  ) ?? 0;

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--surface-0)' }}>
      {/* Page header */}
      <header
        className="sticky top-0 z-10 flex items-center gap-4 px-8 py-4 border-b"
        style={{ background: 'var(--surface-0)', borderColor: 'var(--border)' }}
      >
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate" style={{ color: 'var(--text-1)' }}>
            {project.name}
          </h1>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs capitalize" style={{ color: 'var(--text-3)' }}>{project.framework}</span>
            {project.rnVersion && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>RN {project.rnVersion}</span>
            )}
            {project.expoSdkVersion && (
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>Expo {project.expoSdkVersion}</span>
            )}
            <span className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>{project.packageManager}</span>
            {'branch' in project && (
              <span className="text-xs font-mono" style={{ color: 'var(--text-2)' }}>
                {project.branch as string}
              </span>
            )}
            {'lastCommit' in project && project.lastCommit && (
              <span
                className="text-xs font-mono"
                style={{ color: 'var(--text-3)' }}
                title={(project.lastCommit as { message: string }).message}
              >
                {(project.lastCommit as { hash: string }).hash.slice(0, 7)}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => scanMutation.mutate()}
          disabled={isScanning || scanMutation.isPending}
          className="shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40"
          style={{ background: 'var(--text-1)', color: 'var(--surface-0)' }}
        >
          {isScanning ? 'Scanning…' : 'Scan now'}
        </button>
      </header>

      <div className="px-8 py-8 space-y-8 max-w-5xl">
        {/* Scan in progress */}
        {activeScanId && (
          <ScanProgress scanRunId={activeScanId} onDone={handleScanDone} />
        )}

        {/* Hero: gauge + category cards */}
        <div className="flex gap-6 items-start">
          {/* Left: gauge panel */}
          <div
            className="shrink-0 rounded-2xl border flex flex-col items-center px-8 py-8 gap-4"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border)', width: 220 }}
          >
            <HealthGauge score={score} size={180} scanning={isScanning} />
            <div className="text-center">
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {health?.latestScan
                  ? `Last scan ${formatRelative(health.latestScan.startedAt)}`
                  : 'Not scanned yet'}
              </p>
              {totalIssues > 0 && (
                <p className="text-xs mt-1 tabular" style={{ color: 'var(--text-2)' }}>
                  {totalIssues} open {totalIssues === 1 ? 'issue' : 'issues'}
                </p>
              )}
            </div>
          </div>

          {/* Right: category cards */}
          {health && health.categorySummary.length > 0 ? (
            <div className="flex-1 grid grid-cols-2 gap-3">
              {health.categorySummary.map((summary) => (
                <ScoreCard key={summary.category} summary={summary} />
              ))}
            </div>
          ) : (
            <div
              className="flex-1 rounded-2xl border flex items-center justify-center py-16"
              style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
            >
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                Run a scan to see category health
              </p>
            </div>
          )}
        </div>

        {/* Recent commits */}
        {commits && commits.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Since your last scan</SectionLabel>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {commits.map((commit) => (
                <div
                  key={commit.hash}
                  className="flex items-center gap-3 px-4 py-2.5 border-b last:border-0"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <span
                    className="shrink-0 text-xs font-mono w-14"
                    style={{ color: 'var(--text-3)' }}
                  >
                    {commit.hash.slice(0, 7)}
                  </span>
                  <span
                    className="flex-1 text-sm truncate"
                    style={{ color: 'var(--text-1)' }}
                  >
                    {commit.message}
                  </span>
                  <span className="shrink-0 text-xs tabular" style={{ color: 'var(--text-3)' }}>
                    {commit.filesChanged} files
                  </span>
                  <span className="shrink-0 text-xs" style={{ color: 'var(--text-3)' }}>
                    {commit.author}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Findings */}
        {health?.latestScan && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Findings</SectionLabel>
              {!showFindings && totalIssues > 0 && (
                <button
                  onClick={() => setShowFindings(true)}
                  className="text-xs transition-colors"
                  style={{ color: 'var(--text-3)' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)'; }}
                >
                  Show all
                </button>
              )}
            </div>
            {showFindings || totalIssues === 0 ? (
              <FindingsTable findings={findings ?? []} projectId={id!} />
            ) : (
              <button
                onClick={() => setShowFindings(true)}
                className="w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors"
                style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-raised)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; }}
              >
                {totalIssues} {totalIssues === 1 ? 'finding' : 'findings'} — click to expand
              </button>
            )}
          </section>
        )}

        {/* Scan history */}
        {health && health.recentScans.length > 0 && (
          <section className="space-y-3">
            <SectionLabel>Scan history</SectionLabel>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border)' }}>
              {health.recentScans.map((scan) => (
                <ScanHistoryRow key={scan.id} scan={scan} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {!health?.latestScan && !isScanning && (
          <div className="flex flex-col items-center py-20 gap-4">
            <div
              className="w-16 h-16 rounded-2xl border flex items-center justify-center"
              style={{ borderColor: 'var(--border)', borderStyle: 'dashed' }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="var(--text-3)" strokeWidth="1.5" fill="none" />
                <circle cx="12" cy="12" r="3" fill="var(--text-3)" />
              </svg>
            </div>
            <div className="text-center space-y-1">
              <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>No scans yet</p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                Run a scan to analyze {project.name}
              </p>
            </div>
            <button
              onClick={() => scanMutation.mutate()}
              disabled={scanMutation.isPending}
              className="mt-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--text-1)', color: 'var(--surface-0)' }}
            >
              Scan now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium" style={{ color: 'var(--text-3)', letterSpacing: '0.03em' }}>
      {children}
    </p>
  );
}

function ScanHistoryRow({ scan }: { scan: ScanRun }) {
  const { data: detail } = useQuery({
    queryKey: ['scan', scan.id],
    queryFn: () => api.scans.get(scan.id),
  });

  const statusColor: Record<string, string> = {
    done: 'var(--c-ok)',
    failed: 'var(--c-critical)',
    running: 'var(--c-accent)',
    queued: 'var(--text-3)',
  };

  return (
    <div
      className="px-4 py-3 border-b last:border-0"
      style={{ borderColor: 'var(--border)' }}
    >
      <div className="flex items-center gap-4">
        <span
          className="text-xs font-medium capitalize w-12 shrink-0"
          style={{ color: statusColor[scan.status] ?? 'var(--text-3)' }}
        >
          {scan.status}
        </span>
        <span className="text-xs tabular flex-1" style={{ color: 'var(--text-2)' }}>
          {new Date(scan.startedAt).toLocaleString()}
        </span>
        {scan.newFindingCount > 0 && (
          <span className="text-xs tabular" style={{ color: 'var(--c-high)' }}>
            +{scan.newFindingCount} new
          </span>
        )}
        {scan.fixedFindingCount > 0 && (
          <span className="text-xs tabular" style={{ color: 'var(--c-ok)' }}>
            {scan.fixedFindingCount} fixed
          </span>
        )}
        {scan.completedAt && (
          <span className="text-xs tabular" style={{ color: 'var(--text-3)' }}>
            {formatDuration(scan.startedAt, scan.completedAt)}
          </span>
        )}
      </div>
      {detail?.toolRuns && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 pl-16">
          {detail.toolRuns.map((tr) => (
            <span key={tr.id} className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
              {tr.tool}
              {tr.durationMs != null && ` ${(Math.round(tr.durationMs / 100) / 10).toFixed(1)}s`}
              {tr.status === 'failed' && <span style={{ color: 'var(--c-critical)' }}> ✗</span>}
              {tr.status === 'unavailable' && ' —'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const s = Math.round(ms / 1000);
  return `${s}s`;
}
