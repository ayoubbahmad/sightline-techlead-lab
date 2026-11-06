import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, AdapterContext, RawResult } from './adapter.interface.js';
import type { Finding, Project } from '@sightline/shared';

interface ESLintMessage {
  ruleId: string | null;
  severity: number;
  message: string;
  line?: number;
}

interface ESLintFile {
  filePath: string;
  messages: ESLintMessage[];
}

const severityMap: Record<number, Finding['severity']> = {
  2: 'high',
  1: 'medium',
};

export const eslintAdapter: Adapter = {
  id: 'eslint',
  category: 'quality',

  async isAvailable(project: Project): Promise<boolean> {
    const localEslint = join(project.path, 'node_modules', '.bin', 'eslint');
    return existsSync(localEslint);
  },

  async run(ctx: AdapterContext): Promise<RawResult> {
    const start = Date.now();
    const localEslint = join(ctx.project.path, 'node_modules', '.bin', 'eslint');
    try {
      const result = await execa(
        localEslint,
        ['.', '--format', 'json', '--no-error-on-unmatched-pattern'],
        { cwd: ctx.project.path, reject: false },
      );
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
    let files: ESLintFile[] = [];
    try {
      files = JSON.parse(result.stdout) as ESLintFile[];
    } catch {
      return [];
    }

    return files.flatMap((file) =>
      file.messages.map((msg) => ({
        category: 'quality' as const,
        tool: 'eslint',
        ruleId: msg.ruleId,
        severity: severityMap[msg.severity] ?? 'low',
        file: file.filePath.replace(ctx.project.path + '/', ''),
        line: msg.line ?? null,
        message: msg.message,
      })),
    );
  },
};
