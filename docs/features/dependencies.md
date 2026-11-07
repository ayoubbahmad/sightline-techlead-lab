# Dependencies

> Adapter: `outdated`
> Category tag: `dependencies`

## Purpose

AI agents update packages without always understanding the impact. A major bump can introduce breaking changes. A minor bump in a transitive dep can cause subtle regressions. This category surfaces all outdated packages so you can decide whether the agent's changes were intentional or accidental drift.

## Adapter

### outdated

Runs the target project's package manager's outdated command and parses the result.

**Availability:** always available — every project has a package manager. Package manager is detected from lockfile:
- `bun.lockb` → bun
- `pnpm-lock.yaml` → pnpm  
- `yarn.lock` → yarn
- fallback → npm

**Commands per package manager:**

| PM | Command |
|----|---------|
| npm | `npm outdated --json` |
| yarn | `yarn outdated --json` |
| pnpm | `pnpm outdated --format json` |
| bun | *(not yet implemented — bun lacks a stable JSON outdated command)* |

**Severity mapping** (based on semver jump from current to latest):

| Jump | Sightline severity |
|------|--------------------|
| major | high |
| minor | medium |
| patch | low |

**Output format note:** yarn's JSON is line-delimited NDJSON; each line is a separate JSON object. The table data is in the object with `type: "table"`.

**Fingerprint key:** `tool=outdated`, `ruleId=outdated-package`, `file=package.json`, message `{name}: {current} → {latest}`.

---

## Findings shape

```ts
{
  category: 'dependencies',
  tool: 'outdated',
  ruleId: 'outdated-package',
  severity: 'high' | 'medium' | 'low',
  file: 'package.json',
  line: null,
  message: 'react-native: 0.72.0 → 0.74.0 (wanted: 0.72.6)'
}
```

## UI

- One **score card** for the `dependencies` category
- Findings always point to `package.json`
- High (major version jumps) are shown first by default severity sort

## v0.2 ideas

- **bun support**: add `bun outdated --json` parsing once bun stabilizes its output format
- **Monorepo workspace support**: scan per-workspace `package.json` files, not just the root
- **Changelog links**: link each finding to the package's GitHub releases or CHANGELOG.md
- **Breaking change flag**: npm registry API can tell you if a major release includes documented breaking changes — surface this as an extra badge
- **Lock file drift detection**: flag packages where `installed !== wanted` (locked but inconsistent)
- **Dev/prod split**: separate score for `devDependencies` vs `dependencies` (a stale type package is lower priority than a stale runtime dep)

## Open questions

- Should `minor` bumps default to `info` instead of `medium`? Minor bumps follow semver contract and shouldn't break anything. `medium` might be too alarming for routine patch hygiene.
- Should packages in `peerDependencies` generate findings? Currently yes, but peer deps are often constrained by the ecosystem (RN version) not the developer.
