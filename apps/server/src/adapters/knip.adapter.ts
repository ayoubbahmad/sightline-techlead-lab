import { execa } from 'execa';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Adapter, AdapterContext, RawResult } from './adapter.interface.js';
import type { Project } from '@sightline/shared';

interface KnipIssue {
  name: string;
  pos?: number;
  line?: number;
  col?: number;
}

interface KnipFileResult {
  [issueType: string]: KnipIssue[];
}

interface KnipOutput {
  files?: string[];
  issues?: Array<{ [file: string]: KnipFileResult }>;
}

export const knipAdapter: Adapter = {
  id: 'knip',
  category: 'quality',

  async isAvailable(project: Project): Promise<boolean> {
    const localKnip = join(project.path, 'node_modules', '.bin', 'knip');
    return existsSync(localKnip);
  },

  async run(ctx: AdapterContext): Promise<RawResult> {
    const start = Date.now();
    const localKnip = join(ctx.project.path, 'node_modules', '.bin', 'knip');
    try {
      const result = await execa(localKnip, ['--reporter', 'json'], {
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
    let output: KnipOutput = {};
    try {
      output = JSON.parse(result.stdout) as KnipOutput;
    } catch {
      return [];
    }

    const findings: ReturnType<Adapter['parse']> = [];

    // Unused files
    for (const file of output.files ?? []) {
      findings.push({
        category: 'quality',
        tool: 'knip',
        ruleId: 'unused-file',
        severity: 'low',
        file: file.replace(ctx.project.path + '/', ''),
        line: null,
        message: 'Unused file',
      });
    }

    // Per-issue-type findings
    for (const fileMap of output.issues ?? []) {
      for (const [file, issueTypes] of Object.entries(fileMap)) {
        for (const [issueType, issues] of Object.entries(issueTypes)) {
          for (const issue of issues) {
            findings.push({
              category: 'quality',
              tool: 'knip',
              ruleId: issueType,
              severity: 'low',
              file: file.replace(ctx.project.path + '/', ''),
              line: issue.line ?? null,
              message: `${issueType}: ${issue.name}`,
            });
          }
        }
      }
    }

    return findings;
  },
};
