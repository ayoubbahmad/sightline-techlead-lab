# Code Quality

> Adapters: `tsc` · `eslint` · `knip`
> Category tag: `quality`

## Purpose

AI agents introduce type errors, lint violations, and dead code as a natural side effect of rapid generation. This category catches all three before they accumulate. A clean quality score is the primary signal that an agent session was successful.

## Adapters

### tsc

Runs `tsc --noEmit --pretty false` using the TypeScript compiler installed in the target project (`node_modules/.bin/tsc`).

**Availability:** only runs if the project has `hasTypeScript: true` (a `tsconfig.json` exists or `typescript` is in deps) and `tsc` is installed locally.

**Output parsing:** line-by-line regex against the compact error format:
```
src/App.tsx(3,9): error TS6133: 'x' is declared but its value is never read.
```

**Severity:** all tsc errors map to `high`. Type errors are hard blocks — agents can't ship them.

**Fingerprint key:** `tool=tsc`, `ruleId=TS####`, `file`, normalized message (line numbers stripped).

---

### eslint

Runs the project's own ESLint with `--format json`, using `node_modules/.bin/eslint`.

**Availability:** ESLint binary must exist in the target project. No config is required by Sightline — it uses whatever the project already has (flat config, `.eslintrc`, etc.).

**Output parsing:** parses the ESLint JSON array. Each `message` in each `file` becomes a finding.

**Severity mapping:**

| ESLint severity | Sightline severity |
|----------------|--------------------|
| 2 (error)      | high               |
| 1 (warn)       | medium             |
| other          | low                |

**Fingerprint key:** `tool=eslint`, `ruleId` (e.g. `no-unused-vars`), `file`, normalized message.

---

### knip

Runs `knip --reporter json` using the project's locally installed knip.

**Availability:** `node_modules/.bin/knip` must exist.

**Output parsing:** two parts of the JSON output:
- `files` → each unused file → `ruleId=unused-file`, severity `low`
- `issues` → per-file, per-issue-type (unused exports, unlisted dependencies, etc.) → `ruleId=<issueType>`, severity `low`

**Fingerprint key:** `tool=knip`, `ruleId=<issueType>`, `file`, message `{issueType}: {name}`.

---

## Findings shape

```ts
{
  category: 'quality',
  tool: 'tsc' | 'eslint' | 'knip',
  ruleId: 'TS6133' | 'no-unused-vars' | 'unused-file' | ...,
  severity: 'high' | 'medium' | 'low',
  file: 'src/components/Button.tsx',   // relative to project root
  line: 42,                            // null for knip file-level findings
  message: "...",
}
```

## UI

- One **score card** for the `quality` category on the health page
- Findings table filterable by tool (`tsc` / `eslint` / `knip`) and severity
- Grouped by file by default — shows all issues in a file together

## v0.2 ideas

- **Severity overrides per rule**: let users map specific eslint rules to `info` (e.g. `no-console`) without ignoring them entirely
- **Knip config detection**: surface a "knip not configured" info finding when knip isn't set up (mirrors dep-cruiser behaviour)
- **ESLint fixable count**: eslint JSON output includes `fixable` — surface this as a hint ("12 of 30 are auto-fixable")
- **tsc project references**: handle composite project setups that require `--build` instead of `--noEmit`

## Open questions

- Should knip findings default to `info` rather than `low`? Dead code is advisory more than actionable.
- Should `tsc` strict-mode violations (e.g. `noImplicitAny`) have a different severity than explicit errors?
