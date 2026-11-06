import { useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client.js';
import { ScoreCard } from '../components/ScoreCard.js';
import { FindingsTable } from '../components/FindingsTable.js';
import { ScanProgress } from '../components/ScanProgress.js';

export function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [activeScanId, setActiveScanId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  });

  const { data: health, isLoading: healthLoading } = useQuery({
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
    void queryClient.invalidateQueries({ queryKey: ['findings', id] });
    void queryClient.invalidateQueries({ queryKey: ['health-summary', id] });
  }, [id, queryClient]);

  if (projectLoading) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center">
        <p className="text-zinc-500">Loading…</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-[var(--surface-0)] flex items-center justify-center">
        <p className="text-zinc-500">Project not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto">
          <Link to="/" className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
            ← All projects
          </Link>
          <div className="flex items-start justify-between mt-2">
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">{project.name}</h1>
              <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
                <span className="capitalize">{project.framework}</span>
                {project.rnVersion && <span>RN {project.rnVersion}</span>}
                {project.expoSdkVersion && <span>Expo SDK {project.expoSdkVersion}</span>}
                <span className="font-mono">{project.packageManager}</span>
                {'branch' in project && <span className="font-mono text-zinc-400">{project.branch as string}</span>}
                {'lastCommit' in project && project.lastCommit && (
                  <span className="font-mono" title={(project.lastCommit as { message: string }).message}>
                    {(project.lastCommit as { hash: string }).hash}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => scanMutation.mutate()}
              disabled={!!activeScanId || scanMutation.isPending}
              className="px-3 py-1.5 text-sm rounded-md bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors disabled:opacity-40"
            >
              {activeScanId ? 'Scanning…' : 'Run scan'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-10">
        {/* Scan progress */}
        {activeScanId && (
          <ScanProgress scanRunId={activeScanId} onDone={handleScanDone} />
        )}

        {/* Commits since last visit */}
        {commits && commits.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Since your last visit</h2>
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              {commits.map((commit) => (
                <div key={commit.hash} className="flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800 last:border-0 text-sm">
                  <span className="font-mono text-xs text-zinc-500 w-14 shrink-0">{commit.hash}</span>
                  <span className="text-zinc-200 flex-1 truncate">{commit.message}</span>
                  <span className="text-zinc-600 text-xs shrink-0">{commit.filesChanged} files</span>
                  <span className="text-zinc-600 text-xs shrink-0">{commit.author}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Score cards */}
        {!healthLoading && health && (
          <section>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Health summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {health.categorySummary.map((summary) => (
                <ScoreCard key={summary.category} summary={summary} />
              ))}
            </div>
          </section>
        )}

        {/* Findings */}
        <section>
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Findings</h2>
          <FindingsTable findings={findings ?? []} projectId={id!} />
        </section>

        {/* Scan history */}
        {health && health.recentScans.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-300 mb-3">Scan history</h2>
            <div className="border border-zinc-800 rounded-lg overflow-hidden">
              {health.recentScans.map((scan) => (
                <ScanHistoryRow key={scan.id} scanId={scan.id} scan={scan} />
              ))}
            </div>
          </section>
        )}

        {!health?.latestScan && !activeScanId && (
          <div className="text-center py-16 text-zinc-600">
            <p>No scans yet. Run your first scan to see results.</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ScanHistoryRow({ scanId, scan }: { scanId: string; scan: import('@sightline/shared').ScanRun }) {
  const { data: detail } = useQuery({
    queryKey: ['scan', scanId],
    queryFn: () => api.scans.get(scanId),
  });

  const statusColor: Record<string, string> = {
    done: 'text-green-400',
    failed: 'text-red-400',
    running: 'text-blue-400',
    queued: 'text-zinc-400',
  };

  return (
    <div className="px-4 py-3 border-b border-zinc-800 last:border-0">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${statusColor[scan.status] ?? 'text-zinc-400'}`}>{scan.status}</span>
          <span className="text-zinc-400 text-xs">{new Date(scan.startedAt).toLocaleString()}</span>
          {scan.newFindingCount > 0 && <span className="text-orange-400 text-xs">+{scan.newFindingCount} new</span>}
          {scan.fixedFindingCount > 0 && <span className="text-green-500 text-xs">{scan.fixedFindingCount} fixed</span>}
        </div>
      </div>
      {detail?.toolRuns && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {detail.toolRuns.map((tr) => (
            <span key={tr.id} className="text-xs font-mono text-zinc-600">
              {tr.tool}
              {tr.durationMs != null && ` ${Math.round(tr.durationMs / 100) / 10}s`}
              {tr.status === 'failed' && ' ✗'}
              {tr.status === 'unavailable' && ' —'}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
