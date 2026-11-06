import { execa } from 'execa';
import type { Adapter, AdapterContext, RawResult } from './adapter.interface.js';
import type { Finding, PackageManager } from '@sightline/shared';

interface NpmOutdatedEntry {
  current: string;
  wanted: string;
  latest: string;
  dependent?: string;
}

interface YarnOutdatedBody {
  type: string;
  data: { body: Array<[string, string, string, string, string]> };
}

export const outdatedAdapter: Adapter = {
  id: 'outdated',
  category: 'dependencies',

  async isAvailable(): Promise<boolean> {
    return true;
  },

  async run(ctx: AdapterContext): Promise<RawResult> {
    const start = Date.now();
    const pm = ctx.project.packageManager;
    const [cmd, args] = getCommand(pm);
    try {
      const result = await execa(cmd, args, {
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
    const pm = ctx.project.packageManager;
    if (pm === 'npm') return parseNpm(result);
    if (pm === 'yarn') return parseYarn(result);
    if (pm === 'pnpm') return parsePnpm(result);
    return [];
  },
};

function getCommand(pm: PackageManager): [string, string[]] {
  if (pm === 'yarn') return ['yarn', ['outdated', '--json']];
  if (pm === 'pnpm') return ['pnpm', ['outdated', '--format', 'json']];
  return ['npm', ['outdated', '--json']];
}

function parseNpm(result: RawResult): ReturnType<Adapter['parse']> {
  let data: Record<string, NpmOutdatedEntry> = {};
  try {
    data = JSON.parse(result.stdout) as Record<string, NpmOutdatedEntry>;
  } catch {
    return [];
  }
  return Object.entries(data).map(([name, info]) => ({
    category: 'dependencies' as const,
    tool: 'outdated',
    ruleId: 'outdated-package',
    severity: semverSeverity(info.current, info.latest),
    file: 'package.json',
    line: null,
    message: `${name}: ${info.current} → ${info.latest} (wanted: ${info.wanted})`,
  }));
}

function parseYarn(result: RawResult): ReturnType<Adapter['parse']> {
  for (const line of result.stdout.split('\n')) {
    try {
      const parsed = JSON.parse(line) as YarnOutdatedBody;
      if (parsed.type === 'table') {
        return parsed.data.body.map(([name, current, wanted, latest]) => ({
          category: 'dependencies' as const,
          tool: 'outdated',
          ruleId: 'outdated-package',
          severity: semverSeverity(current ?? '', latest ?? ''),
          file: 'package.json',
          line: null,
          message: `${name}: ${current} → ${latest} (wanted: ${wanted})`,
        }));
      }
    } catch {
      continue;
    }
  }
  return [];
}

function parsePnpm(result: RawResult): ReturnType<Adapter['parse']> {
  let data: Record<string, { current: string; latest: string; wanted: string }> = {};
  try {
    data = JSON.parse(result.stdout) as typeof data;
  } catch {
    return [];
  }
  return Object.entries(data).map(([name, info]) => ({
    category: 'dependencies' as const,
    tool: 'outdated',
    ruleId: 'outdated-package',
    severity: semverSeverity(info.current, info.latest),
    file: 'package.json',
    line: null,
    message: `${name}: ${info.current} → ${info.latest} (wanted: ${info.wanted})`,
  }));
}

function semverSeverity(current: string, latest: string): Finding['severity'] {
  const c = parseSemver(current);
  const l = parseSemver(latest);
  if (!c || !l) return 'low';
  if (l.major > c.major) return 'high';
  if (l.minor > c.minor) return 'medium';
  return 'low';
}

function parseSemver(v: string): { major: number; minor: number; patch: number } | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}
