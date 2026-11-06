I'm building a local-first desktop tool called Sightline.
I'm a React Native developer whose job has shifted to orchestrating AI coding agents. I need a tool that helps me keep code quality high and keep a surface-level understanding of my projects, without reading every line agents write.

This is a solo, local-only tool: no auth, no cloud, no multi-user. It runs a Node server on 127.0.0.1 with a React web UI in the browser.

## Goal of this first version (v0.1)
Register local React Native repos, run quality tools on them, normalize all results into one "Finding" format, and show a health page per project.

## Stack
- pnpm workspaces monorepo, TypeScript strict everywhere
  - apps/server: Node + Fastify
  - apps/web: React + Vite + React Router + TanStack Query
  - packages/shared: shared types and zod schemas (API contracts, Finding type)
- SQLite with Drizzle ORM (database file stored in the user's app data dir, not in the repo)
- execa to run tools, simple-git for repo info
- Vitest for tests
- ESLint + Prettier, and dependency-cruiser rules for this repo's own architecture

## Features for v0.1
1. Projects
   - Add a project by absolute path; validate it's a git repo with a package.json
   - Detect: Expo vs bare React Native, RN version, Expo SDK if any, package manager (npm/yarn/pnpm/bun), TypeScript or not
   - Store lastVisitedAt (update when the project page is opened)
2. Scanner
   - Plugin/adapter architecture: each tool is an adapter implementing a common interface:
     { id, category, isAvailable(project), run(project) -> RawResult, parse(RawResult) -> Finding[] }
   - Adapters for v0.1:
     - code quality: tsc (--noEmit), ESLint (JSON formatter), knip (JSON reporter)
     - architecture: dependency-cruiser (only if the project has a config; otherwise report "not configured" as an info finding)
     - dependencies: outdated packages via the project's package manager
     - security: npm audit or osv-scanner (whichever is available), gitleaks
   - Prefer the tool versions installed in the target project; fall back gracefully. A missing tool must never crash a scan; record it as "tool unavailable" in the scan run.
   - Never modify the target repo. Scans are read-only.
   - Run scans as background jobs with status (queued/running/done/failed) and per-tool timing; stream progress to the UI (SSE is fine).
3. Findings
   - Normalized Finding: id, projectId, scanRunId, category (quality | architecture | dependencies | security | docs | performance), tool, ruleId, severity (critical | high | medium | low | info), file, line, message, fingerprint, firstSeenAt, lastSeenAt, status (open | fixed | ignored)
   - Fingerprint = stable hash of tool + ruleId + file + normalized message (no line numbers), so findings can be tracked across scans
   - On each scan: mark new findings, keep existing ones, mark disappeared ones as fixed
   - Allow ignoring a finding with a reason
4. Health page (per project)
   - Header: project info (RN/Expo version, package manager, current branch, last commit)
   - Score/summary cards per category with counts by severity, and "new since last scan"
   - Findings table: filter by category, severity, tool, status; group by file
   - Scan history list with tool timings and errors
   - "Since your last visit": commits since lastVisitedAt (author, message, files changed count)
5. Projects list page: all projects with last scan time and open critical/high counts

## Data model (adjust if you see a better design, but explain why)
Project, ScanRun, ToolRun (per tool within a scan, with status, duration, error), Finding.

## Non-functional requirements
- Server binds to 127.0.0.1 only
- Validate every path input; never run shell strings built from user input (use execa with argument arrays)
- Clean separation: adapters don't know about the database; the scan service orchestrates
- Make adding a new adapter a matter of adding one file and registering it
- Simple, clean UI; dark mode supported; no heavy component library required (Tailwind is fine)

## Testing
- Unit tests for every adapter's parse() using saved sample outputs as fixtures
- Tests for fingerprinting and the new/fixed/open status logic
- One integration test that scans a small fixture RN project included in the repo

## Out of scope for now (but keep the design open for them)
Running AI agents from the app, feature documentation/knowledge base, CI integration, performance tooling on emulators, trend charts.

## How I want you to work
1. First, explore nothing and write nothing. Give me a plan: folder structure, data model, adapter interface, API endpoints, UI pages, and the order you'll build in. Wait for my approval.
2. After approval, create a CLAUDE.md for this repo documenting architecture, conventions, how to add an adapter, commands, and a definition of done (typecheck + lint + tests pass).
3. Build in small vertical slices, each one working end to end, running typecheck, lint and tests after each slice.
4. At the end, give me a short summary: what was built, how to run it, known limitations, and suggested next steps.