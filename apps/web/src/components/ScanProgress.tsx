import { useEffect, useRef, useState } from 'react';
import { subscribeScanProgress } from '../api/client.js';
import type { ScanProgressEvent, ToolRunStatus } from '@sightline/shared';

interface ToolState {
  status: ToolRunStatus | 'pending';
  durationMs: number | undefined;
  error: string | undefined;
}

interface Props {
  scanRunId: string;
  onDone: () => void;
}

const TOOLS = ['tsc', 'eslint', 'knip', 'dep-cruiser', 'outdated', 'security'];

const statusIcon: Record<string, string> = {
  pending: '·',
  running: '◌',
  done: '✓',
  failed: '✗',
  unavailable: '—',
};

const statusColor: Record<string, string> = {
  pending: 'text-zinc-600',
  running: 'text-blue-400 animate-pulse',
  done: 'text-green-400',
  failed: 'text-red-400',
  unavailable: 'text-zinc-500',
};

export function ScanProgress({ scanRunId, onDone }: Props) {
  const [toolStates, setToolStates] = useState<Record<string, ToolState>>(
    Object.fromEntries(TOOLS.map((t) => [t, { status: 'pending' as const, durationMs: undefined, error: undefined }])),
  );
  const doneRef = useRef(false);

  useEffect(() => {
    const unsub = subscribeScanProgress(
      scanRunId,
      (event: ScanProgressEvent) => {
        if (event.tool) {
          setToolStates((prev) => ({
            ...prev,
            [event.tool!]: {
              status: event.type === 'tool_start' ? 'running' : (event.toolStatus ?? 'done'),
              durationMs: event.durationMs ?? undefined,
              error: event.error ?? undefined,
            },
          }));
        }
      },
      () => {
        if (!doneRef.current) {
          doneRef.current = true;
          onDone();
        }
      },
    );
    return unsub;
  }, [scanRunId, onDone]);

  return (
    <div className="rounded-lg border border-zinc-800 bg-[var(--surface-1)] p-4">
      <p className="text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Scan in progress</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {TOOLS.map((tool) => {
          const state = toolStates[tool] ?? { status: 'pending' };
          return (
            <div key={tool} className="flex items-center gap-2 text-sm">
              <span className={`font-mono text-base leading-none ${statusColor[state.status] ?? 'text-zinc-500'}`}>
                {statusIcon[state.status] ?? '·'}
              </span>
              <span className="text-zinc-300 font-mono">{tool}</span>
              {'durationMs' in state && state.durationMs != null && (
                <span className="text-zinc-600 text-xs ml-auto">{Math.round(state.durationMs / 100) / 10}s</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
