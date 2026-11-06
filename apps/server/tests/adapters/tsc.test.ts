import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tscAdapter } from '../../src/adapters/tsc.adapter.js';
import type { Project } from '@sightline/shared';

const PROJECT_PATH = '/projects/my-app';
const mockProject: Project = {
  id: 'test-id',
  name: 'test',
  path: PROJECT_PATH,
  framework: 'bare-rn',
  rnVersion: '0.74.0',
  expoSdkVersion: null,
  packageManager: 'npm',
  hasTypeScript: true,
  createdAt: new Date().toISOString(),
  lastVisitedAt: null,
  lastScannedAt: null,
};

const fixtureOutput = readFileSync(
  join(import.meta.dirname, '../fixtures/adapter-outputs/tsc-errors.txt'),
  'utf-8',
);

describe('tscAdapter.parse', () => {
  it('parses tsc error lines into findings', () => {
    const result = { exitCode: 1, stdout: fixtureOutput, stderr: '', durationMs: 100 };
    const findings = tscAdapter.parse(result, { project: mockProject });
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      tool: 'tsc',
      ruleId: 'TS6133',
      severity: 'high',
      file: 'src/App.tsx',
      line: 3,
    });
    expect(findings[1]).toMatchObject({
      tool: 'tsc',
      ruleId: 'TS2345',
      file: 'src/components/Button.tsx',
      line: 10,
    });
  });

  it('returns empty array when tsc exits cleanly', () => {
    const result = { exitCode: 0, stdout: '', stderr: '', durationMs: 50 };
    expect(tscAdapter.parse(result, { project: mockProject })).toHaveLength(0);
  });

  it('returns a single fallback finding if exit code non-zero but no parseable lines', () => {
    const result = { exitCode: 2, stdout: 'some unparseable error', stderr: '', durationMs: 10 };
    const findings = tscAdapter.parse(result, { project: mockProject });
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe('high');
  });
});
