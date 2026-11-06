import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '@sightline/shared';
import { api } from '../api/client.js';

export function ProjectsPage() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: api.projects.list,
  });

  const addMutation = useMutation({
    mutationFn: api.projects.add,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      setAdding(false);
      setPath('');
      setAddError(null);
    },
    onError: (err) => {
      setAddError(err instanceof Error ? err.message : 'Failed to add project');
    },
  });

  const removeMutation = useMutation({
    mutationFn: api.projects.remove,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  return (
    <div className="min-h-screen bg-[var(--surface-0)]">
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-100">Sightline</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Code quality for AI-assisted projects</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="px-3 py-1.5 text-sm rounded-md bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors"
          >
            Add project
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isLoading && <p className="text-zinc-500 text-sm">Loading…</p>}

        {!isLoading && projects?.length === 0 && (
          <div className="text-center py-16">
            <p className="text-zinc-400">No projects yet.</p>
            <p className="text-zinc-600 text-sm mt-1">Add a React Native project to get started.</p>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Project</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Framework</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Last scan</th>
                  <th className="px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">Issues</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onRemove={() => removeMutation.mutate(project.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {adding && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setAdding(false)}>
          <div
            className="bg-[var(--surface-1)] border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-base font-semibold mb-4">Add project</h2>
            <label className="block text-xs text-zinc-400 mb-1.5">Absolute path to repo</label>
            <input
              autoFocus
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMutation.mutate(path); }}
              placeholder="/Users/you/projects/my-app"
              className="w-full bg-[var(--surface-2)] border border-zinc-700 rounded-md px-3 py-2 text-sm font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
            {addError && <p className="text-xs text-red-400 mt-2">{addError}</p>}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setAdding(false); setAddError(null); }}
                className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => addMutation.mutate(path)}
                disabled={!path.trim() || addMutation.isPending}
                className="px-3 py-1.5 text-sm rounded-md bg-zinc-100 text-zinc-900 font-medium hover:bg-white transition-colors disabled:opacity-40"
              >
                {addMutation.isPending ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectRow({ project, onRemove }: { project: Project; onRemove: () => void }) {
  const { data: health } = useQuery({
    queryKey: ['health-summary', project.id],
    queryFn: () => api.projects.health(project.id),
    enabled: !!project.lastScannedAt,
  });

  const critical = health?.categorySummary.reduce((s, c) => s + c.critical, 0) ?? 0;
  const high = health?.categorySummary.reduce((s, c) => s + c.high, 0) ?? 0;

  return (
    <tr className="border-b border-zinc-800 last:border-0 hover:bg-[var(--surface-1)] transition-colors">
      <td className="px-4 py-3">
        <Link to={`/projects/${project.id}`} className="font-medium text-zinc-100 hover:text-white">
          {project.name}
        </Link>
        <p className="text-xs text-zinc-600 font-mono mt-0.5 truncate max-w-xs">{project.path}</p>
      </td>
      <td className="px-4 py-3 text-zinc-400">
        <span className="capitalize">{project.framework}</span>
        {project.rnVersion && <span className="text-zinc-600 ml-1">v{project.rnVersion}</span>}
      </td>
      <td className="px-4 py-3 text-zinc-500 text-xs">
        {project.lastScannedAt ? new Date(project.lastScannedAt).toLocaleDateString() : 'Never'}
      </td>
      <td className="px-4 py-3">
        {project.lastScannedAt ? (
          <div className="flex items-center gap-2 text-xs">
            {critical > 0 && <span className="text-red-400 font-medium">{critical} critical</span>}
            {high > 0 && <span className="text-orange-400">{high} high</span>}
            {critical === 0 && high === 0 && <span className="text-green-500">Clean</span>}
          </div>
        ) : (
          <span className="text-zinc-600 text-xs">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onRemove}
          className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
        >
          Remove
        </button>
      </td>
    </tr>
  );
}
