import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, FolderGit2 } from 'lucide-react';
import type { Project } from '@sightline/shared';
import { api } from '../api/client.js';

export function Sidebar() {
  const { id: activeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [path, setPath] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: api.projects.list,
  });

  const addMutation = useMutation({
    mutationFn: api.projects.add,
    onSuccess: (project) => {
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      setAdding(false);
      setPath('');
      setAddError(null);
      navigate(`/projects/${project.id}`);
    },
    onError: (err) => {
      setAddError(err instanceof Error ? err.message : 'Failed to add project');
    },
  });

  return (
    <>
      <aside
        className="flex flex-col shrink-0 overflow-hidden border-r"
        style={{
          width: 236,
          background: 'var(--surface-1)',
          borderColor: 'var(--border)',
        }}
      >
        {/* Logo */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'var(--c-accent)', opacity: 0.9 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <circle cx="7" cy="7" r="5.5" stroke="white" strokeWidth="1.5" fill="none" />
                <circle cx="7" cy="7" r="2" fill="white" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Sightline</span>
          </div>
        </div>

        {/* Section label */}
        <p
          className="px-5 pb-2 text-xs font-medium"
          style={{ color: 'var(--text-3)', letterSpacing: '0.04em' }}
        >
          Projects
        </p>

        {/* Project list */}
        <nav className="flex-1 overflow-y-auto px-2">
          {projects.length === 0 ? (
            <p className="px-3 py-2 text-xs" style={{ color: 'var(--text-3)' }}>
              No projects yet
            </p>
          ) : (
            projects.map((project) => (
              <ProjectNavItem
                key={project.id}
                project={project}
                active={project.id === activeId}
              />
            ))
          )}
        </nav>

        {/* Add project */}
        <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs transition-colors"
            style={{ color: 'var(--text-2)' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-1)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)'; }}
          >
            <Plus size={14} />
            Add project
          </button>
        </div>
      </aside>

      {/* Add project modal */}
      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => { setAdding(false); setAddError(null); }}
        >
          <div
            className="rounded-2xl p-6 w-full max-w-md border shadow-2xl"
            style={{ background: 'var(--surface-1)', borderColor: 'var(--border-raised)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--surface-2)' }}
              >
                <FolderGit2 size={16} style={{ color: 'var(--text-2)' }} />
              </div>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>Add project</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>Paste the absolute path to a React Native repo</p>
              </div>
            </div>

            <input
              autoFocus
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addMutation.mutate(path); }}
              placeholder="/Users/you/projects/my-app"
              className="w-full rounded-xl px-4 py-2.5 text-sm font-mono border outline-none transition-colors"
              style={{
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-1)',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--border-raised)'; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; }}
            />
            {addError && (
              <p className="text-xs mt-2" style={{ color: 'var(--c-critical)' }}>{addError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => { setAdding(false); setAddError(null); }}
                className="px-4 py-2 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--text-2)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => addMutation.mutate(path)}
                disabled={!path.trim() || addMutation.isPending}
                className="px-4 py-2 rounded-lg text-xs font-medium transition-opacity disabled:opacity-40"
                style={{ background: 'var(--text-1)', color: 'var(--surface-0)' }}
              >
                {addMutation.isPending ? 'Adding…' : 'Add project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ProjectNavItem({ project, active }: { project: Project; active: boolean }) {
  const { data: health } = useQuery({
    queryKey: ['health-summary', project.id],
    queryFn: () => api.projects.health(project.id),
    enabled: !!project.lastScannedAt,
  });

  const critical = health?.categorySummary.reduce((s, c) => s + c.critical, 0) ?? 0;
  const high = health?.categorySummary.reduce((s, c) => s + c.high, 0) ?? 0;
  const hasIssues = critical + high > 0;

  const dotColor = !project.lastScannedAt
    ? 'var(--text-3)'
    : critical > 0
    ? 'var(--c-critical)'
    : high > 0
    ? 'var(--c-high)'
    : 'var(--c-ok)';

  return (
    <Link
      to={`/projects/${project.id}`}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-colors group"
      style={{
        background: active ? 'var(--surface-2)' : 'transparent',
      }}
      onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
    >
      {/* Health dot */}
      <span
        className="shrink-0 w-2 h-2 rounded-full"
        style={{ background: dotColor }}
      />
      <div className="flex-1 min-w-0">
        <p
          className="text-sm font-medium truncate leading-tight"
          style={{ color: active ? 'var(--text-1)' : 'var(--text-2)' }}
        >
          {project.name}
        </p>
        {hasIssues && (
          <p className="text-xs tabular mt-0.5" style={{ color: 'var(--text-3)' }}>
            {critical > 0 && <span style={{ color: 'var(--c-critical)' }}>{critical} crit</span>}
            {critical > 0 && high > 0 && <span style={{ color: 'var(--text-3)' }}> · </span>}
            {high > 0 && <span style={{ color: 'var(--c-high)' }}>{high} high</span>}
          </p>
        )}
      </div>
    </Link>
  );
}
