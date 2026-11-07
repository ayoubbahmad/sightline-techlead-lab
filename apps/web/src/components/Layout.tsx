import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';

export function Layout() {
  return (
    <div className="flex h-full overflow-hidden" style={{ background: 'var(--surface-0)' }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
