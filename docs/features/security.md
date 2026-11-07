# Security

> Adapters: `npm-audit` · `gitleaks`
> Category tag: `security`

## Purpose

Security is the highest-stakes category. AI agents can unknowingly introduce vulnerable dependencies (by upgrading to a version with a known CVE) or commit secrets (API keys, tokens, connection strings) that end up in git history. This category catches both.

## Adapters

Both tools run inside a single adapter (`security.adapter.ts`) and their results are combined into one `RawResult` envelope before parsing.

### npm-audit (via `security` adapter)

Runs the target project's audit command. The package manager is detected from lockfile (same logic as the `outdated` adapter).

| PM | Command |
|----|---------|
| npm | `npm audit --json` |
| yarn | `yarn audit --json` |
| pnpm | `pnpm audit --json` |

**Availability:** always runs (every project has npm/yarn/pnpm).

**Output parsing:** reads `vulnerabilities` from the npm audit JSON format. Each vulnerable package becomes one finding. The advisory title and URL are extracted from the `via` array.

**Severity mapping:**

| npm audit severity | Sightline severity |
|-------------------|--------------------|
| critical          | critical           |
| high              | high               |
| moderate          | medium             |
| low               | low                |
| info              | info               |

**Fingerprint key:** `tool=npm-audit`, `ruleId=<advisory URL>`, `file=package.json`, message `{packageName}: {title} ({range})`.

---

### gitleaks (via `security` adapter)

Scans for secrets committed to the git history of the target project.

**Availability:** optional. Sightline first checks `node_modules/.bin/gitleaks` in the target project, then falls back to `gitleaks` on `PATH`. If neither is found, the tool silently produces zero findings — it does **not** create an error or warning.

> **Note (open question):** should a missing gitleaks binary surface a warning finding so the user knows they don't have secret scanning active?

**Command:**
```
gitleaks detect --source <project-path> --report-format json --no-banner --exit-code 0
```
`--exit-code 0` prevents gitleaks from failing the scan when secrets are found (we handle findings ourselves).

**Output parsing:** parses the JSON array output. Each leak becomes one finding.

**Severity:** all gitleaks findings map to `critical` — an exposed secret is always critical.

**Fingerprint key:** `tool=gitleaks`, `ruleId=<RuleID>`, `file`, message description/match.

---

## Combined result envelope

The adapter runs both tools independently and wraps their stdout in a single JSON envelope:
```json
{ "audit": "<raw npm audit JSON>", "gitleaks": "<raw gitleaks JSON array>" }
```
This keeps the adapter interface clean (one `run()` → one `RawResult`).

---

## Findings shape

**npm audit finding:**
```ts
{
  category: 'security',
  tool: 'npm-audit',
  ruleId: 'https://npmjs.com/advisories/1065',   // advisory URL
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info',
  file: 'package.json',
  line: null,
  message: 'lodash: Prototype Pollution (<4.17.21)'
}
```

**gitleaks finding:**
```ts
{
  category: 'security',
  tool: 'gitleaks',
  ruleId: 'generic-api-key',
  severity: 'critical',
  file: 'src/config.ts',
  line: 10,
  message: 'API key detected'
}
```

## UI

- One **score card** for the `security` category
- Critical severity findings are shown with a prominent red color
- npm audit findings always link to `package.json`
- gitleaks findings show the exact file and line

## Installing gitleaks

If you want secret scanning, install gitleaks in the target project:

```bash
# macOS
brew install gitleaks

# or as a dev dependency
npm install --save-dev gitleaks
```

Sightline will pick it up on the next scan automatically.

## v0.2 ideas

- **osv-scanner**: add `osv-scanner` as an alternative/additional vulnerability source (broader than npm audit, catches transitive deps missed by npm)
- **`.gitleaksignore` awareness**: respect existing `.gitleaksignore` files in the target project
- **CVE advisory links**: make the advisory URL in each audit finding clickable in the UI
- **Secret type classification**: surface the type of secret detected (API key, JWT, private key, etc.) with clearer remediation guidance
- **Audit deduplication**: npm audit can report the same CVE multiple times (once per affected dep path); deduplicate by advisory URL

## Open questions

- Should an unavailable gitleaks binary create an `info`-level finding saying "secret scanning not configured"? Currently it fails silently, which means users might not realize gitleaks isn't running.
- Should `yarn audit` or `pnpm audit` output differences in format be parsed differently? Currently pnpm audit output format is assumed to match npm's — this may need verification.
