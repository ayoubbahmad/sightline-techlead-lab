import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, AdapterContext, RawResult } from './adapter.interface.js';
import type { Finding, Project } from '@sightline/shared';

interface DepCruiserViolation {
  rule: { name: string; severity: string };
  from: string;
  to: string;
  cycle?: string[];
}

interface DepCruiserOutput {
  summary: { violations: DepCruiserViolation[] };
}

const severityMap: Record<string, Finding['severity']> = {
  error: 'high',
  warn: 'medium',
  info: 'info',
};

const CONFIG_FILES = [
  '.dependency-cruiser.js',
  '.dependency-cruiser.cjs',
  '.dependency-cruiser.mjs',
  'dependency-cruiser.config.js',
];

export const depCruiserAdapter: Adapter = {
  id: 'dep-cruiser',
  category: 'architecture',

  async isAvailable(project: Project): Promise<boolean> {
    const localBin = join(project.path, 'node_modules', '.bin', 'depcruise');
    if (!existsSync(localBin)) return false;
    return CONFIG_FILES.some((f) => existsSync(join(project.path, f)));
  },

  async run(ctx: AdapterContext): Promise<RawResult> {
    const start = Date.now();
    const localBin = join(ctx.project.path, 'node_modules', '.bin', 'depcruise');
    try {
      const result = await execa(localBin, ['src', '--output-type', 'json'], {
        cwd: ctx.project.path,
        reject: false,
      });
      return {
        exitCode: result.exitCode ?? 1,
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  },

  parse(result: RawResult, ctx: AdapterContext) {
    // Not configured — single info finding
    if (result.exitCode === 127 || result.stdout === '') {
      return [{
        category: 'architecture' as const,
        tool: 'dep-cruiser',
        ruleId: 'not-configured',
        severity: 'info' as const,
        file: null,
        line: null,
        message: 'dependency-cruiser is not configured for this project',
      }];
    }

    let output: DepCruiserOutput;
    try {
      output = JSON.parse(result.stdout) as DepCruiserOutput;
    } catch {
      return [];
    }

    return output.summary.violations.map((v) => ({
      category: 'architecture' as const,
      tool: 'dep-cruiser',
      ruleId: v.rule.name,
      severity: severityMap[v.rule.severity] ?? 'medium',
      file: v.from.replace(ctx.project.path + '/', ''),
      line: null,
      message: v.cycle
        ? `Circular dependency: ${v.cycle.join(' → ')}`
        : `${v.rule.name}: ${v.from} → ${v.to}`,
    }));
  },
};
