# Integrations

> Status: **design — not yet implemented**
> Category tag: cross-cutting (integrations produce findings in any category)

## Purpose

Sightline should not try to out-analyze dedicated tools. SonarQube, Semgrep, MobSF and others are better at their own analysis than Sightline could be. Sightline's job is to:

1. **Connect** to those tools: run them, query them, or read their reports
2. **Normalize** their results into one `Finding` format
3. **Add what none of them do alone:** one score across all tools, new/fixed tracking over time, deduplication across tools, triage, and feedback to AI agents

Sightline only writes its own analysis where no good tool exists.

## Integration kinds

Today every adapter is a **runner**. This design adds two more kinds:

| Kind | How it gets results | Infra needed | Examples |
|---|---|---|---|
| **runner** | Runs a local CLI, parses stdout | None (tool installed in project or on `PATH`) | tsc, eslint, knip, gitleaks, mobsfscan, semgrep |
| **connector** | Calls the HTTP API of a server the user already runs | A running server + URL + token | SonarQube, MobSF (binary scans) |
| **importer** | Reads a report file in a standard format | None | SARIF from any tool, including CI artifacts |

The kinds can be combined. A runner can produce SARIF and then reuse the SARIF importer's parser. That makes adding a SARIF-capable tool mostly a matter of choosing its command line.

### Why SARIF first

[SARIF](https://sarifweb.azurewebsites.net/) (Static Analysis Results Interchange Format, OASIS standard) is a common JSON output format for static-analysis tools: Semgrep, CodeQL, mobsfscan, Snyk, osv-scanner, gitleaks and ESLint (via a formatter) all write it. One well-tested SARIF parser covers all of them. It is the lowest-cost, highest-reach integration.

## Adapter interface changes

The current interface (`apps/server/src/adapters/adapter.interface.ts`) stays valid for runners. Proposed additions:

```ts
export type AdapterKind = 'runner' | 'connector' | 'importer';

export interface AdapterContext {
  project: Project;
  /** Per-project settings for this adapter (validated by the adapter's Zod schema). */
  config: Record<string, unknown>;
  /** Fresh temp dir owned by Sightline, so tools never write into the target repo. */
  workDir: string;
  /** Aborted on scan cancel or timeout. */
  signal: AbortSignal;
}

export interface RawResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** Structured data fetched by connectors (API responses); runners leave it unset. */
  payload?: unknown;
}

export type Availability =
  | { available: true }
  | { available: false; reason: 'not-installed' | 'not-configured' | 'unreachable'; hint: string };

export interface Adapter {
  id: string;
  kind: AdapterKind;
  /** Default category for display; each finding still sets its own `category`. */
  category: Finding['category'];
  /** Zod schema for per-project config; absent = no settings. */
  configSchema?: z.ZodTypeAny;
  /** Per-adapter timeout; connectors waiting on a server may need minutes. */
  timeoutMs?: number;
  isAvailable(ctx: Omit<AdapterContext, 'workDir' | 'signal'>): Promise<Availability>;
  run(ctx: AdapterContext): Promise<RawResult>;
  parse(result: RawResult, ctx: AdapterContext): ParsedFinding[];
}
```

Key points:
- **`parse()` stays pure.** Connectors do their HTTP calls in `run()` and hand the responses to `parse()` through `payload`. Parsers are then tested against JSON fixtures, the same way as today.
- **Category is per finding.** One SonarQube or SARIF report mixes security, reliability and maintainability issues.
- **`isAvailable()` returns a reason.** "Not configured" and "server unreachable" become setup hints in the UI (shown on the tool run), not silent skips.
- **`workDir`** is how tools that write files (sonar-scanner's `.scannerwork`, SARIF output files) stay compliant with the read-only rule.

## Configuration and secrets

Integrations need settings (server URL, project key, rule config) and secrets (API tokens).

**Schema (new tables):**

| Table | Columns | Purpose |
|---|---|---|
| `integrations` | `id`, `adapterId`, `name`, `baseUrl`, `createdAt` | A server instance, e.g. "Local SonarQube @ localhost:9000". Shared across projects. |
| `project_adapters` | `projectId`, `adapterId`, `enabled`, `integrationId?`, `config` (JSON) | Per-project enable/disable + settings. Also covers "scan profiles" from the v1.0 roadmap. |

**Secrets:**
- Stored outside SQLite in `~/.sightline/credentials.json` (or `$SIGHTLINE_DATA_DIR`), file mode `0600`, keyed by integration id.
- **Write-only through the API.** The UI can set or replace a token. The API only ever returns `hasToken: true/false`; tokens are never sent back to the browser.
- Never written to the target repo, never logged.
- Later: an optional macOS Keychain backend.

## Integration designs

### SARIF importer (generic)

**Input:** a `.sarif` / `.sarif.json` file, either produced by a runner into `workDir` or at a path the user configures (e.g. a CI artifact they downloaded).

**Mapping:**

| SARIF | Finding |
|---|---|
| `runs[].tool.driver.name` (lowercased) | `tool` (e.g. `semgrep`, not `sarif`, so fingerprints and filters show the real origin) |
| `results[].ruleId` | `ruleId` |
| `results[].message.text` | `message` |
| `locations[0].physicalLocation.artifactLocation.uri` | `file`, made relative to the project root (resolve `uriBaseId` / `file://` URIs) |
| `locations[0].physicalLocation.region.startLine` | `line` |
| rule `properties.security-severity` (CVSS-like, 0–10) | ≥ 9 `critical`, ≥ 7 `high`, ≥ 4 `medium`, > 0 `low` |
| otherwise `level`: `error` / `warning` / `note` / `none` | `high` / `medium` / `low` / `info` |
| rule `properties.tags` contains `security` (or `security-severity` present) | `category: 'security'`, else `'quality'` |

Results whose file is outside the project root are dropped (and counted in the tool run's details).

### Semgrep (runner → SARIF)

```
semgrep scan --sarif --output <workDir>/semgrep.sarif --metrics=off --config <config> <projectPath>
```

- Prefer a config the project already has (`.semgrep.yml`, `.semgrep/`), and fall back to a ruleset chosen in settings.
- **Local-first caveat:** `--config auto` and registry rulesets (`p/react`, `p/typescript`) download rules from the Semgrep registry, and `auto` requires metrics to be on. Default to a local config or a cached ruleset; don't silently use the network.

### mobsfscan (runner → SARIF)

The source-code scanner from the MobSF project (Semgrep- and libsast-based rules for Android/iOS/RN code). It needs no server.

```
mobsfscan --sarif -o <workDir>/mobsfscan.sarif <projectPath>
```

This is the default way to get MobSF-quality mobile security rules into Sightline.

### SonarQube (connector)

Two modes, chosen per project:

1. **Import latest analysis:** the user (or CI) already runs `sonar-scanner`. Sightline only fetches results. This is the simplest mode and the right default.
2. **Run and import:** Sightline runs `sonar-scanner` with `-Dsonar.working.directory=<workDir>` (so `.scannerwork` isn't written into the repo), reads the compute task id from `<workDir>/report-task.txt`, polls `GET /api/ce/task?id=…` until done, then fetches.

**Fetch:**
- `GET /api/issues/search?componentKeys=<key>&resolved=false&ps=500&p=N`, paginated. The API caps results at 10,000, which is fine for local use; surface a warning if hit.
- `GET /api/hotspots/search?projectKey=<key>&status=TO_REVIEW` for security hotspots.
- Auth: user token as `Authorization: Bearer <token>` (SonarQube 10+); older versions take the token as the basic-auth username.

**Mapping (verify against the user's SonarQube version, since the taxonomy changed in 10.x):**
- Prefer the Clean Code `impacts[]` array: `softwareQuality` `SECURITY` → `security`, `RELIABILITY` / `MAINTAINABILITY` → `quality`. Impact severity `BLOCKER`/`HIGH`/`MEDIUM`/`LOW`/`INFO` → `critical`/`high`/`medium`/`low`/`info`.
- Fall back to the legacy `type` (`VULNERABILITY`, `BUG`, `CODE_SMELL`) and `severity` on older servers.
- Hotspots → `security`, severity from `vulnerabilityProbability` (`HIGH`/`MEDIUM`/`LOW`).
- `component` (`<projectKey>:src/x.ts`) → `file` with the key prefix stripped; `line` → `line`; `rule` → `ruleId`.

**Fingerprint note:** use our own fingerprint (tool + rule + file + message), not SonarQube's issue key. That keeps new/fixed tracking consistent with every other tool, even if the SonarQube project is re-created.

### MobSF server (connector, optional)

MobSF's main product analyzes **built binaries** (APK/IPA), not source. That catches things source scanners can't see (manifest permissions, binary protections, embedded secrets, insecure network config).

- Opt-in per project. The user points Sightline at a built APK/IPA path (Sightline does not build the app).
- `POST /api/v1/upload` (multipart) → `hash`; `POST /api/v1/scan` with the hash; `POST /api/v1/report_json` → findings. API key in the `Authorization` header.
- Only re-upload when the binary's mtime/hash changes; uploads are large and scans are slow.
- Findings have no source `file`. Use the binary name as `file` and the MobSF section (e.g. `manifest`, `binary`, `network_security`) as the rule prefix.

### Other candidates

| Tool | Kind | Why |
|---|---|---|
| osv-scanner | runner (SARIF/JSON) | Broader vulnerability DB than `npm audit`, covers lockfile-transitive deps |
| expo-doctor | runner | Expo SDK / native module compatibility, RN-specific |
| CodeQL | importer (SARIF) | Strong but slow to run locally; best as "import the SARIF CI already produced" |
| Snyk | runner (SARIF) | For teams that already pay for it; needs an account (opt-in) |

## Built on top: Sightline's own layer

Once multiple tools report into one model, Sightline can add:

- **Cross-tool deduplication:** findings in the same `file` + `line` + `category` from different tools are grouped as one item ("reported by eslint, SonarQube"). They keep separate fingerprints so tracking stays per-tool; grouping is a view-level concern.
- **Agent summary:** a compact Markdown block of *new* findings since a given commit/scan, which the developer pastes into the agent's next prompt (see [ai-agents.md](./ai-agents.md)).
- **Triage across tools:** suppression rules and baselines apply to every tool's findings the same way.
- **Trends:** findings over time per category and per tool.

## Design constraints

- **Read-only still holds.** Every tool writes output to `workDir`, never the target repo. Connectors only read from their servers (the exception is uploading a binary to MobSF, which the user enables explicitly).
- **No required infra.** Runners and importers work out of the box; connectors are opt-in. A project with no integrations configured behaves exactly like v0.1.
- **No surprise network calls.** Adapters only talk to hosts the user configured (localhost servers, or registry downloads the user opted into). Nothing is sent anywhere by default.
- **Fail soft.** An unreachable server marks that tool run `unavailable` with a hint. It never fails the whole scan.

## Implementation plan

1. **Foundation:** `kind`, `Availability` with reasons, `workDir` + `signal` in context, per-adapter timeout; `project_adapters` table; a project settings panel that lists adapters with enable/disable and an availability hint for each.
2. **SARIF importer** with fixtures from Semgrep and mobsfscan; then the **Semgrep** and **mobsfscan** runners on top of it.
3. **Integrations + secrets:** `integrations` table, credentials file, write-only token API, settings UI.
4. **SonarQube connector:** "import latest analysis" first, then "run and import".
5. **MobSF server connector** (binary scans), opt-in.
6. **Layer on top:** cross-tool grouping, agent summary, suppression rules.

## Open questions

- Should Sightline offer to start SonarQube/MobSF via Docker for the user, or always expect them to be running already? (Leaning: document the `docker run` command, don't manage containers.)
- When a tool covers what an existing adapter does (e.g. Semgrep's ESLint-like rules, osv-scanner vs npm audit), do we disable the overlapping one by default or rely on cross-tool grouping?
- Should the SARIF importer accept an arbitrary report path per project, or only files produced in `workDir`? Arbitrary paths make CI artifact import possible but mean reading files outside the project.
