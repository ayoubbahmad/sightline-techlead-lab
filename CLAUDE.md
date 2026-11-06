# Sightline — CLAUDE.md

## What this is
Local-first desktop tool for React Native developers who orchestrate AI agents. Registers local RN repos, runs quality tools on them, normalizes results into a unified Finding format, and shows a health page per project.

## Architecture

```
sightline/
├── apps/server      Node + Fastify API, SQLite/Drizzle, adapter runner
├── apps/web         React + Vite + React Router + TanStack Query UI
└── packages/shared  Shared TypeScript types and Zod schemas
```

**Server binds to `127.0.0.1` only. No auth, no cloud.**

The UI proxies `/api/*` to `http://127.0.0.1:3001` via Vite's dev proxy.

## Data flow
1. User adds a project by path → server validates (git repo + package.json) and detects metadata
2. User triggers a scan → server runs adapters sequentially, streams SSE progress
3. Each adapter: `isAvailable()` → `run()` → `parse()` → findings persisted with fingerprints
4. New/fixed/open status tracked per fingerprint across scans
5. Web polls and subscribes to SSE for live scan progress

## Database
SQLite at `~/.sightline/sightline.db` (or `$SIGHTLINE_DATA_DIR`). Never stored in the repo.

Tables: `projects`, `scan_runs`, `tool_runs`, `findings`

Migrations are in `apps/server/drizzle/`. After schema changes run:
```
pnpm --filter server exec drizzle-kit generate
```
Migrations run automatically on server start via `runMigrations()`.

## Adding a new adapter

1. Create `apps/server/src/adapters/my-tool.adapter.ts` implementing the `Adapter` interface:
   ```typescript
   export const myToolAdapter: Adapter = {
     id: 'my-tool',
     category: 'quality', // or architecture | dependencies | security | docs | performance
     async isAvailable(project) { /* return false to skip gracefully */ },
     async run(ctx) { /* execa call, return RawResult */ },
     parse(result, ctx) { /* return Finding[] subset (no id/fingerprint/timestamps) */ },
   };
   ```
2. Add a fixture output in `tests/fixtures/adapter-outputs/`
3. Write a `tests/adapters/my-tool.test.ts` testing `parse()` with the fixture
4. Register in `apps/server/src/adapters/registry.ts`
5. Add the tool name to `TOOLS` in `apps/web/src/components/ScanProgress.tsx`

Rules:
- Adapters are **pure**: no DB access, no side effects
- Never throw from `run()` — catch and return a RawResult with exitCode 1
- Never modify the target repo
- Prefer the tool version installed in the target project (`node_modules/.bin/`)

## Fingerprinting
`apps/server/src/services/fingerprint.ts` — stable 16-char hex hash of `projectId + tool + ruleId + file + normalizedMessage`. Line numbers are stripped from messages so a finding's fingerprint doesn't change when surrounding code shifts.

## Commands
```bash
pnpm dev              # start server + web in parallel
pnpm typecheck        # typecheck all packages
pnpm test             # run all tests
pnpm lint             # ESLint (zero warnings)
pnpm format           # Prettier

pnpm --filter server exec drizzle-kit generate   # generate migration after schema change
pnpm --filter server exec drizzle-kit studio     # Drizzle Studio (DB browser)
```

## Definition of done
A change is done when:
- [ ] `pnpm typecheck` exits 0
- [ ] `pnpm lint` exits 0
- [ ] `pnpm test` exits 0

## Conventions
- TypeScript strict everywhere (`strict: true`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`)
- Use `execa` with argument arrays, never shell strings, for all subprocess calls
- All API shapes are defined in `packages/shared` via Zod schemas
- Server routes validate input with Zod before touching the DB
- No default exports — named exports only

## Out of scope (keep design open for)
AI agent orchestration, feature documentation/knowledge base, CI integration, performance profiling on emulators, trend charts.
