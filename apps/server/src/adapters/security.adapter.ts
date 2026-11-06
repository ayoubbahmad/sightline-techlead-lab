import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, AdapterContext, RawResult } from './adapter.interface.js';
import type { Finding } from '@sightline/shared';

interface NpmAuditVulnerability {
  name: string;
  severity: string;
  via: Array<string | { title: string; url: string }>;
  range: string;
}

interface NpmAuditOutput {
  vulnerabilities?: Record<string, NpmAuditVulnerability>;
}

interface GitleaksResult {
  RuleID?: string;
  File?: string;
  StartLine?: number;
  Match?: string;
  Description?: string;
}

const auditSeverityMap: Record<string, Finding['severity']> = {
  critical: 'critical',
  high: 'high',
  moderate: 'medium',
  low: 'low',
  info: 'info',
};

export const securityAdapter: Adapter = {
  id: 'security',
  category: 'security',

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async run(ctx: AdapterContext): Promise<RawResult> {
    const start = Date.now();
    const results: RawResult[] = [];

    // npm audit
    const auditResult = await runAudit(ctx);
    results.push(auditResult);

    // gitleaks
    const gitleaksResult = await runGitleaks(ctx);
    results.push(gitleaksResult);

    return {
      exitCode: results.some((r) => r.exitCode !== 0) ? 1 : 0,
      stdout: JSON.stringify({ audit: results[0]?.stdout ?? '', gitleaks: results[1]?.stdout ?? '' }),
      stderr: results.map((r) => r.stderr).filter(Boolean).join('\n'),
      durationMs: Date.now() - start,
    };
  },

  parse(result: RawResult, _ctx: AdapterContext) {
    let parsed: { audit: string; gitleaks: string } = { audit: '', gitleaks: '' };
    try {
      parsed = JSON.parse(result.stdout) as typeof parsed;
    } catch {
      return [];
    }

    return [...parseAudit(parsed.audit), ...parseGitleaks(parsed.gitleaks)];
  },
};

async function runAudit(ctx: AdapterContext): Promise<RawResult> {
  const start = Date.now();
  const pm = ctx.project.packageManager;
  const [cmd, args] = pm === 'yarn'
    ? ['yarn', ['audit', '--json']]
    : pm === 'pnpm'
    ? ['pnpm', ['audit', '--json']]
    : ['npm', ['audit', '--json']];
  try {
    const result = await execa(cmd, args, { cwd: ctx.project.path, reject: false });
    return { exitCode: result.exitCode ?? 1, stdout: result.stdout, stderr: result.stderr, durationMs: Date.now() - start };
  } catch (err) {
    return { exitCode: 1, stdout: '', stderr: err instanceof Error ? err.message : String(err), durationMs: Date.now() - start };
  }
}

async function runGitleaks(ctx: AdapterContext): Promise<RawResult> {
  const start = Date.now();
  // prefer local, fall back to PATH
  const localGitleaks = join(ctx.project.path, 'node_modules', '.bin', 'gitleaks');
  const bin = existsSync(localGitleaks) ? localGitleaks : 'gitleaks';
  try {
    const result = await execa(
      bin,
      ['detect', '--source', ctx.project.path, '--report-format', 'json', '--no-banner', '--exit-code', '0'],
      { cwd: ctx.project.path, reject: false },
    );
    return { exitCode: result.exitCode ?? 0, stdout: result.stdout, stderr: result.stderr, durationMs: Date.now() - start };
  } catch {
    // gitleaks not installed — not a failure
    return { exitCode: 0, stdout: '[]', stderr: '', durationMs: Date.now() - start };
  }
}

function parseAudit(raw: string): ReturnType<Adapter['parse']> {
  let output: NpmAuditOutput = {};
  try {
    output = JSON.parse(raw) as NpmAuditOutput;
  } catch {
    return [];
  }
  return Object.entries(output.vulnerabilities ?? {}).map(([, vuln]) => {
    const via = vuln.via.find((v): v is { title: string; url: string } => typeof v === 'object');
    return {
      category: 'security' as const,
      tool: 'npm-audit',
      ruleId: via ? via.url : null,
      severity: auditSeverityMap[vuln.severity] ?? 'medium',
      file: 'package.json',
      line: null,
      message: via ? `${vuln.name}: ${via.title} (${vuln.range})` : `${vuln.name} has vulnerabilities (${vuln.range})`,
    };
  });
}

function parseGitleaks(raw: string): ReturnType<Adapter['parse']> {
  let results: GitleaksResult[] = [];
  try {
    results = JSON.parse(raw) as GitleaksResult[];
  } catch {
    return [];
  }
  return results.map((r) => ({
    category: 'security' as const,
    tool: 'gitleaks',
    ruleId: r.RuleID ?? null,
    severity: 'critical' as const,
    file: r.File ?? null,
    line: r.StartLine ?? null,
    message: r.Description ?? r.Match ?? 'Secret detected',
  }));
}
