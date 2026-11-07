# Performance

> Status: **planned — out of scope for v0.1**
> Category tag: `performance`

## Purpose

Code quality tools catch bugs and style issues. Performance tooling catches a different class of agent-introduced regression: a component that now re-renders 10x more, a bundle that grew 200KB because an agent imported a heavy library, a screen that dropped from 60fps to 45fps.

These regressions are invisible to tsc and eslint but felt immediately by users.

## Vision

### Bundle analysis

Track the production JS bundle size per scan. Surface new packages that are unexpectedly large or duplicated (e.g., two versions of `lodash` bundled due to an agent adding a dependency that resolved differently).

**Candidates:**
- [Metro bundle explorer](https://github.com/marklawlor/metro-bundle-explorer) — introspects Metro bundles
- [source-map-explorer](https://github.com/danvk/source-map-explorer) — works on any source-mapped bundle
- [@expo/bundle-analyzer](https://github.com/expo/expo) — Expo-native

**What a finding looks like:**
```
Bundle size increased by 243KB (+18%) since last scan
  New contributor: @sentry/react-native (added in last commit)
```

### Render performance

Detect components that regressed in frame rate after an agent session. This requires running the app on a device or emulator — the heaviest category to implement.

**Candidates:**
- [Flashlight](https://github.com/bamlab/flashlight) — CLI tool for measuring RN screen performance
- [Perf Monitor](https://reactnative.dev/docs/performance#perf-monitor) — built-in RN overlay

### JS thread blocking

Detect long synchronous operations on the JS thread introduced by agents (e.g., a large `JSON.parse` now called in a render cycle).

**Candidates:**
- Hermes CPU profiler output parsing

## Design constraints

- **Bundle analysis can be static** — no device needed. Runs against the Metro output.
- **Render performance requires a running app** — either a simulator or device. This is a fundamentally different category of adapter (stateful, long-running, requires setup).
- **Render performance is per-screen, not per-project** — findings need a "screen" dimension that the current Finding type doesn't have.

## Approach for v0.2 (bundle only)

Bundle size analysis is static and fits the existing adapter model cleanly:

```ts
export const bundleAdapter: Adapter = {
  id: 'bundle',
  category: 'performance',
  async isAvailable(project) { /* check for metro or expo CLI */ },
  async run(ctx) { /* build bundle to temp dir, run source-map-explorer */ },
  parse(result) { /* parse JSON output, compare to previous baseline */ },
};
```

Render performance deferred to v0.3+ given the device/simulator requirement.

## Status

Kept out of v0.1. The `performance` category already exists in the Finding type and UI — it just has no adapter yet. Adding one requires no schema changes.

**Bundle adapter: candidate for v0.2.**
**Render performance: candidate for v0.3+.**
