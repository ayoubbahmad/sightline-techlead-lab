import type {
  Project,
  ScanRun,
  Finding,
  ProjectHealth,
  CommitInfo,
  ScanProgressEvent,
} from '@sightline/shared';

const BASE = '/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  projects: {
    list: () => request<Project[]>('/projects'),
    get: (id: string) => request<Project & { branch: string; lastCommit: { hash: string; author: string; message: string; date: string } | null }>(`/projects/${id}`),
    add: (path: string) => request<Project>('/projects', { method: 'POST', body: JSON.stringify({ path }) }),
    remove: (id: string) => request<void>(`/projects/${id}`, { method: 'DELETE' }),
    enableWatch: (id: string) => request<{ watchEnabled: boolean }>(`/projects/${id}/watch`, { method: 'POST' }),
    disableWatch: (id: string) => request<{ watchEnabled: boolean }>(`/projects/${id}/watch`, { method: 'DELETE' }),
    health: (id: string) => request<ProjectHealth>(`/projects/${id}/health`),
    commits: (id: string) => request<CommitInfo[]>(`/projects/${id}/commits`),
  },
  scans: {
    trigger: (projectId: string) => request<ScanRun>(`/projects/${projectId}/scans`, { method: 'POST' }),
    list: (projectId: string) => request<ScanRun[]>(`/projects/${projectId}/scans`),
    get: (scanId: string) => request<ScanRun & { toolRuns: import('@sightline/shared').ToolRun[] }>(`/scans/${scanId}`),
  },
  findings: {
    list: (projectId: string, params?: Record<string, string>) => {
      const qs = params ? '?' + new URLSearchParams(params).toString() : '';
      return request<Finding[]>(`/projects/${projectId}/findings${qs}`);
    },
    update: (id: string, body: { status?: 'open' | 'ignored'; ignoreReason?: string }) =>
      request<Finding>(`/findings/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
};

export function subscribeScanProgress(
  scanRunId: string,
  onEvent: (e: ScanProgressEvent) => void,
  onDone: () => void,
): () => void {
  const es = new EventSource(`/api/scans/${scanRunId}/progress`);
  es.onmessage = (e) => {
    const event = JSON.parse(e.data as string) as ScanProgressEvent;
    onEvent(event);
    if (event.type === 'scan_done') {
      es.close();
      onDone();
    }
  };
  es.onerror = () => {
    es.close();
    onDone();
  };
  return () => es.close();
}
