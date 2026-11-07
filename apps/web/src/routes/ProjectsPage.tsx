export function ProjectsPage() {
  return (
    <div
      className="flex h-full items-center justify-center"
      style={{ background: 'var(--surface-0)' }}
    >
      <div className="text-center space-y-3 max-w-xs">
        {/* Sightline eye mark */}
        <div className="flex justify-center mb-6">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="var(--border-raised)" strokeWidth="1.5" fill="none" />
            <circle cx="24" cy="24" r="12" stroke="var(--border-raised)" strokeWidth="1.5" fill="none" />
            <circle cx="24" cy="24" r="4" fill="var(--text-3)" />
          </svg>
        </div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
          Select a project
        </p>
        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
          Pick a project from the sidebar or add one to start watching its health.
        </p>
      </div>
    </div>
  );
}
