# Sightline — Product Vision

## What it is

Sightline is a local-first code quality dashboard for React Native developers who orchestrate AI coding agents. The agents write the code; Sightline watches the quality. It registers your local RN repos, runs the tools you already have installed, and normalizes everything into one clean view — without touching your projects, requiring a cloud account, or adding to your CI pipeline.

**Sightline integrates, it doesn't reimplement.** Dedicated tools (SonarQube, Semgrep, MobSF, tsc, eslint, …) do analysis better than Sightline could. Sightline connects to them, normalizes their results, and adds the layer none of them provide alone: one score across tools, tracking across scans, cross-tool triage, and feedback to AI agents. See [Integrations](./features/integrations.md).

## Who it's for

Solo or small-team RN developers whose job has shifted toward prompt engineering and agent supervision. You're not reading every diff anymore — Sightline gives you a surface-level quality signal so you know when something needs your attention.

## Core principles

| Principle | What it means |
|-----------|--------------|
| **Local-first** | The database is a single file at `~/.sightline/sightline.db`. Nothing leaves your machine. |
| **Read-only** | Sightline never modifies a target repo. Scans are purely observational. |
| **Integrate, don't reimplement** | Use the best existing tool for each job. Sightline's own code is the layer on top: normalization, tracking, triage, agent feedback. |
| **Zero required infra** | No Docker, no Postgres, no account to get started. `pnpm dev` and you're running. Integrations with servers you already run (SonarQube, MobSF) are opt-in. |
| **Non-intrusive** | Tools are run against the versions already installed in the target project. No new dev dependencies injected. Tool output goes to a Sightline temp dir, never the repo. |
| **No surprise network calls** | Sightline only talks to hosts you configured. Nothing is sent anywhere by default. |
| **Additive** | Adding a new tool is one file + one registry entry. Tools that emit SARIF reuse a shared parser. |

## Current state — v0.1

- Register any local React Native repo (Expo or bare)
- Detect project metadata: framework, RN/Expo version, package manager, TypeScript
- Six scanner adapters: **tsc**, **eslint**, **knip**, **dependency-cruiser**, **outdated**, **npm audit + gitleaks**
- Fingerprint-based finding tracking: new, open, fixed, ignored — across every scan
- Real-time scan progress streamed to the UI (SSE)
- Per-project health page: score cards by category, findings table with filters, scan history, commits since your last visit
- Watch mode: opt-in per project, auto-scans after each git commit

## Feature areas

| Feature doc | Covers | Adapters |
|-------------|--------|----------|
| [Code quality](./features/code-quality.md) | Type errors, lint violations, dead code | tsc, eslint, knip |
| [Architecture](./features/architecture.md) | Circular deps, boundary violations | dependency-cruiser |
| [Dependencies](./features/dependencies.md) | Outdated packages | outdated (npm/yarn/pnpm/bun) |
| [Security](./features/security.md) | Vulnerabilities, leaked secrets | npm audit, gitleaks |
| [Integrations](./features/integrations.md) | Connecting external tools: runners, connectors, importers | SARIF, Semgrep, mobsfscan, SonarQube, MobSF *(planned)* |
| [AI agents](./features/ai-agents.md) | Closing the loop with agent workflows | watch mode ✅, agent summary *(planned)* |
| [Performance](./features/performance.md) | Bundle size, render timing | *(future)* |

## Roadmap

### v0.1 — Foundation ✅
Core scanner, six adapters, fingerprint tracking, health page, findings table.

### v0.2 — Integrations
See [integrations.md](./features/integrations.md) for the design.
- Adapter foundation: `runner` / `connector` / `importer` kinds, availability reasons with setup hints, temp work dir per tool
- Per-project adapter settings: enable/disable each tool, tool config (this also covers "scan profiles")
- SARIF importer (generic), then Semgrep and mobsfscan runners on top of it
- Integration settings + write-only secrets store
- SonarQube connector (import latest analysis, then run-and-import)
- MobSF server connector for APK/IPA scans (opt-in)

### v0.3 — The layer on top
- Cross-tool grouping: one item when several tools flag the same spot
- Agent summary: Markdown block of new findings to paste into the agent's next prompt
- Suppression rules: ignore a finding pattern across a whole project (per-file, per-rule, regex), for every tool
- Trend charts: findings over time per category and per tool
- Export: Markdown and CSV report from any findings view
- Agent-originated findings badge ("first seen in commit X")

### v0.4 — Depth
- E2E integration test against a real fixture RN project
- `bun outdated` support
- osv-scanner, expo-doctor runners
- Minor severity defaults review (see per-feature docs for open questions)

### v1.0 — Stability
- Stable adapter plugin API (versioned interface)
- Multiple projects scan (batch run across all registered projects)
- CI adapter: post findings as GitHub PR comments

### Shipped ahead of plan
- Watch mode (auto-scan on git commit), originally planned for v0.3

### Future / open
- Visual dependency graph (from dep-cruiser output)
- Comparison view: diff two scan runs or two branches
- Baseline system: intentionally accept findings and track if they re-emerge
- Performance category: Metro bundle size, Flashlight rendering data

## Non-goals

- **Cloud sync or multi-user** — this tool is for one developer on one machine
- **Replacing linters** — Sightline runs your existing tools; it doesn't configure or replace them
- **Modifying the target repo** — no `.eslintignore` edits, no `package.json` bumps, no autofix
- **Being a CI gate** — the scan is advisory, not blocking (at least until v1.0)
