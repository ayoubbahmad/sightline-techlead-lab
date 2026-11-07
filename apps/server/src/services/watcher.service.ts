import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projects, scanRuns } from '../db/schema.js';
import { runScan } from './scan.service.js';
import type { Project } from '@sightline/shared';

// Active watchers keyed by projectId
const watchers = new Map<string, FSWatcher>();

// Per-project debounce timers
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

function triggerScan(project: Project): void {
  // Don't stack scans — skip if one is already running or queued
  const active = db
    .select()
    .from(scanRuns)
    .where(eq(scanRuns.projectId, project.id))
    .all()
    .find((s) => s.status === 'running' || s.status === 'queued');

  if (active) return;

  void runScan(project, () => {
    // progress events are SSE-only; watcher-triggered scans have no subscriber
  });
}

function startWatching(project: Project): void {
  if (watchers.has(project.id)) return;

  const gitDir = join(project.path, '.git');

  let watcher: FSWatcher;
  try {
    watcher = watch(gitDir, (_, filename) => {
      if (filename !== 'COMMIT_EDITMSG') return;

      // Debounce: git can fire multiple events per commit
      const existing = debounceTimers.get(project.id);
      if (existing) clearTimeout(existing);

      debounceTimers.set(
        project.id,
        setTimeout(() => {
          debounceTimers.delete(project.id);
          triggerScan(project);
        }, 500),
      );
    });
  } catch {
    // .git dir might not exist or be inaccessible — silently skip
    return;
  }

  watcher.on('error', () => {
    watcher.close();
    watchers.delete(project.id);
  });

  watchers.set(project.id, watcher);
}

function stopWatching(projectId: string): void {
  const watcher = watchers.get(projectId);
  if (!watcher) return;
  watcher.close();
  watchers.delete(projectId);

  const timer = debounceTimers.get(projectId);
  if (timer) {
    clearTimeout(timer);
    debounceTimers.delete(projectId);
  }
}

function restoreAll(): void {
  const watched = db.select().from(projects).all().filter((p) => p.watchEnabled);
  for (const project of watched) {
    startWatching(project);
  }
}

export const watcherService = { startWatching, stopWatching, restoreAll };
