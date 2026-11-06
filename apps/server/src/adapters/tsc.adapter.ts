import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, AdapterContext, RawResult } from './adapter.interface.js';
import type { Project } from '@sightline/shared';

export const tscAdapter: Adapter = {
  id: 'tsc',
  category: 'quality',

  async isAvailable(project: Project): Promise<boolean> {
    if (!project.hasTypeScript) return false;
    const localTsc = join(project.path, 'node_modules', '.bin', 'tsc');
    return existsSync(localTsc);
  },

  async run(ctx: AdapterContext): Promise<RawResult> {
    const start = Date.now();
    const localTsc = join(ctx.project.path, 'node_modules', '.bin', 'tsc');
    try {
      const result = await execa(localTsc, ['--noEmit', '--pretty', 'false'], {
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
    if (result.exitCode === 0) return [];

    const findings: ReturnType<Adapter['parse']> = [];
    // tsc output with --pretty false: file(line,col): error TS####: message
    const lineRe = /^(.+?)\((\d+),\d+\):\s+error\s+(TS\d+):\s+(.+)$/;

    for (const line of result.stdout.split('\n')) {
      const m = lineRe.exec(line.trim());
      if (!m) continue;
      const [, filePath, lineNum, code, message] = m;
      findings.push({
        category: 'quality',
        tool: 'tsc',
        ruleId: code ?? null,
        severity: 'high',
        file: filePath?.replace(ctx.project.path + '/', '') ?? null,
        line: lineNum ? parseInt(lineNum, 10) : null,
        message: message ?? line,
      });
    }

    if (findings.length === 0 && result.exitCode !== 0) {
      findings.push({
        category: 'quality',
        tool: 'tsc',
        ruleId: null,
        severity: 'high',
        file: null,
        line: null,
        message: result.stdout || result.stderr || 'tsc exited with errors',
      });
    }

    return findings;
  },
};
