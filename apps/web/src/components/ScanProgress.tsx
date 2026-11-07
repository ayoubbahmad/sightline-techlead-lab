import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle, Minus, Loader } from 'lucide-react';
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
    <div
      className="rounded-xl border p-5"
      style={{ background: 'var(--surface-1)', borderColor: 'var(--border)' }}
    >
      <p className="text-xs font-medium mb-4" style={{ color: 'var(--text-2)' }}>Scanning</p>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        {TOOLS.map((tool) => {
          const state = toolStates[tool] ?? { status: 'pending', durationMs: undefined, error: undefined };
          return (
            <ToolRow key={tool} tool={tool} state={state} />
          );
        })}
      </div>
    </div>
  );
}

function ToolRow({ tool, state }: { tool: string; state: ToolState }) {
  const icon =
    state.status === 'done'        ? <CheckCircle2 size={13} style={{ color: 'var(--c-ok)' }} /> :
    state.status === 'failed'      ? <XCircle size={13} style={{ color: 'var(--c-critical)' }} /> :
    state.status === 'unavailable' ? <Minus size={13} style={{ color: 'var(--text-3)' }} /> :
    state.status === 'running'     ? <SpinnerIcon /> :
                                     <span className="w-[13px] h-[13px] rounded-full border inline-block shrink-0" style={{ borderColor: 'var(--surface-2)' }} />;

  return (
    <div className="flex items-center gap-2.5">
      <span className="shrink-0 flex items-center">{icon}</span>
      <span
        className="text-sm font-mono flex-1"
        style={{ color: state.status === 'pending' ? 'var(--text-3)' : 'var(--text-1)' }}
      >
        {tool}
      </span>
      {'durationMs' in state && state.durationMs != null && (
        <span className="text-xs tabular" style={{ color: 'var(--text-3)' }}>
          {(Math.round(state.durationMs / 100) / 10).toFixed(1)}s
        </span>
      )}
    </div>
  );
}

function SpinnerIcon() {
  return (
    <Loader
      size={13}
      style={{ color: 'var(--c-accent)', animation: 'spin 1s linear infinite' }}
    />
  );
}
