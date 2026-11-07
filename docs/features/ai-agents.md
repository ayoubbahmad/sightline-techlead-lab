# AI Agent Integration

> Status: **partially shipped.** Automatic scan triggers (watch mode) are live; agent context summary and session attribution are planned for v0.3.
>
> **As built:** `WatcherService` (`apps/server/src/services/watcher.service.ts`) watches `<project>/.git` for `COMMIT_EDITMSG` changes, debounced 500ms, and is toggled per project (`projects.watch_enabled`). The sketch below (refs/heads, 5s debounce) was the original plan.
> Category tag: `quality` / cross-cutting

## Purpose

Sightline v0.1 is reactive: you trigger a scan after an agent session. The goal of this feature is to make Sightline proactive — it closes the loop between agent-generated code and quality feedback without requiring manual intervention.

## Vision

### Automatic scan triggers

A file watcher monitors the target repo for new git commits. When the agent pushes a commit (or the developer does), Sightline automatically queues a scan. No manual "Run scan" button needed.

This keeps the health page always current without developer overhead.

### Agent context injection

After a scan triggered by an agent session, Sightline can produce a compact findings summary suitable for injecting back into the agent's next prompt:

```
Sightline scan results for session [abc123]:
- 3 new type errors (tsc): src/auth/login.ts, src/api/client.ts
- 2 new security findings (npm-audit): lodash critical, minimist high
- 0 architecture violations
```

The agent can then self-correct before the developer reviews.

### Session attribution

Findings could be tagged with the git commit that introduced them (via `git log --follow`). This surfaces "findings introduced by agent session X" vs. "pre-existing findings" in the UI.

## Design constraints

- **Still read-only on target repos.** Sightline writes nothing to the project.
- **No automatic prompt injection.** Sightline produces a summary; the developer decides when and whether to feed it to the agent. No automated API calls to agent providers.
- **Opt-in per project.** File watchers are a resource cost. Each project must explicitly enable auto-scan.
- **Debounced.** A single agent session may produce many rapid commits. Scan only triggers after N seconds of inactivity, not on every commit.

## Technical approach (sketch)

```
Target repo
  └── new commit detected (chokidar file watcher on .git/refs/heads/*)
        ↓
Sightline server
  └── debounce 5s
        ↓
  scanQueue.add(projectId)
        ↓
  runScan() (existing path, unchanged)
        ↓
  SSE event pushed to any open UI connections
        ↓
  Optional: generate findings summary string (for agent context)
```

The watcher lives in the server process and is registered/unregistered when a project enables/disables auto-scan. No new processes required.

## UI changes needed

- Project settings panel: toggle "Auto-scan on commit"
- Health page: badge showing "Last scan triggered automatically"
- Findings table: "Introduced by" column showing commit hash

## Status

Kept out of v0.1 to keep the initial build focused. The existing adapter architecture requires no changes to support this — only the trigger mechanism is new.

**Prerequisite for v0.3.**
