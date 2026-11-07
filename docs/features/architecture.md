# Architecture

> Adapter: `dependency-cruiser`
> Category tag: `architecture`

## Purpose

AI agents don't understand architectural boundaries. They connect whatever makes the code compile. Over time this produces circular dependencies, feature modules importing from each other, and UI components reaching into server-only code. This category catches those violations against rules that you define.

## Adapter

### dependency-cruiser

Runs `depcruise src --output-type json` using the project's locally installed dep-cruiser binary.

**Availability:** requires both:
1. `node_modules/.bin/depcruise` installed in the target project
2. A config file present: `.dependency-cruiser.js`, `.dependency-cruiser.cjs`, `.dependency-cruiser.mjs`, or `dependency-cruiser.config.js`

If the binary is present but no config exists, the adapter returns a single `info`-severity finding: `"dependency-cruiser is not configured for this project"`. This is intentionally non-alarming — it's a nudge, not a failure.

**Output parsing:** reads `summary.violations` from the JSON output. Each violation becomes a finding. Circular deps show the full cycle path: `A → B → C → A`.

**Severity mapping:**

| dep-cruiser rule severity | Sightline severity |
|--------------------------|-------------------|
| error                    | high              |
| warn                     | medium            |
| info                     | info              |

**Fingerprint key:** `tool=dep-cruiser`, `ruleId=<ruleName>`, `from` file, message.

---

## Findings shape

```ts
{
  category: 'architecture',
  tool: 'dep-cruiser',
  ruleId: 'no-circular' | 'no-forbidden-module' | ...,   // from your config
  severity: 'high' | 'medium' | 'info',
  file: 'src/features/auth/index.ts',   // the "from" file in the violation
  line: null,                           // dep-cruiser doesn't report line numbers
  message: 'Circular dependency: src/a.ts → src/b.ts → src/a.ts'
           // or: 'no-forbidden-module: src/ui/Button.tsx → src/server/db.ts'
}
```

## UI

- One **score card** for the `architecture` category
- If not configured: a single `info` finding explains the situation; score card shows 1 info, which is visually neutral
- Violations grouped by file (the "from" file in each violation)

## Setting up dep-cruiser in a target project

Sightline runs your existing config — it doesn't inject one. To get started in a target project:

```bash
# In your RN project
npx depcruise --init
```

A recommended starting point for RN projects:
```js
// .dependency-cruiser.js
module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
    { name: 'no-unresolvable', severity: 'error', from: {}, to: { unresolvable: true } },
  ],
};
```

## v0.2 ideas

- **Built-in RN ruleset**: ship a default dep-cruiser ruleset for RN projects inside Sightline so the adapter runs meaningfully even without a project config (opt-in, doesn't create files in the target repo)
- **Visual dependency graph**: render the dep-cruiser module graph in the UI (SVG or canvas) — zoomed to violations only
- **Monorepo support**: handle `src` not existing; allow configuring the entry path per project

## Open questions

- Should Sightline offer to write a starter `.dependency-cruiser.js` into the project? (This would be the first write to a target repo — probably needs an explicit user action and a clear warning.)
- Should the "not configured" finding suppress the score card entirely, or show it with a "setup needed" state?
