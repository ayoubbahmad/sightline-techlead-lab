import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eslintAdapter } from '../../src/adapters/eslint.adapter.js';
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
  watchEnabled: false,
};

const fixtureOutput = readFileSync(
  join(import.meta.dirname, '../fixtures/adapter-outputs/eslint-output.json'),
  'utf-8',
);

describe('eslintAdapter.parse', () => {
  it('parses eslint JSON output into findings', () => {
    const result = { exitCode: 1, stdout: fixtureOutput, stderr: '', durationMs: 200 };
    const findings = eslintAdapter.parse(result, { project: mockProject });
    expect(findings).toHaveLength(2);
    expect(findings[0]).toMatchObject({
      tool: 'eslint',
      ruleId: 'no-unused-vars',
      severity: 'high',
      file: 'src/App.tsx',
      line: 3,
    });
    expect(findings[1]).toMatchObject({
      tool: 'eslint',
      ruleId: 'react-hooks/exhaustive-deps',
      severity: 'medium',
    });
  });

  it('strips project path prefix from file', () => {
    const result = { exitCode: 1, stdout: fixtureOutput, stderr: '', durationMs: 200 };
    const findings = eslintAdapter.parse(result, { project: mockProject });
    expect(findings[0]?.file).toBe('src/App.tsx');
  });

  it('returns empty array for invalid JSON', () => {
    const result = { exitCode: 0, stdout: 'not json', stderr: '', durationMs: 10 };
    expect(eslintAdapter.parse(result, { project: mockProject })).toHaveLength(0);
  });
});
