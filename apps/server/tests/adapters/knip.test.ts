import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { knipAdapter } from '../../src/adapters/knip.adapter.js';
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
  join(import.meta.dirname, '../fixtures/adapter-outputs/knip-output.json'),
  'utf-8',
);

describe('knipAdapter.parse', () => {
  it('parses unused files and exports from knip JSON', () => {
    const result = { exitCode: 1, stdout: fixtureOutput, stderr: '', durationMs: 300 };
    const findings = knipAdapter.parse(result, { project: mockProject });
    // 1 unused file + 1 export
    expect(findings).toHaveLength(2);
  });

  it('marks unused files with ruleId unused-file', () => {
    const result = { exitCode: 1, stdout: fixtureOutput, stderr: '', durationMs: 300 };
    const findings = knipAdapter.parse(result, { project: mockProject });
    const fileFinding = findings.find((f) => f.ruleId === 'unused-file');
    expect(fileFinding).toBeDefined();
    expect(fileFinding?.file).toBe('src/legacy/OldComponent.tsx');
  });

  it('returns empty array for invalid JSON', () => {
    const result = { exitCode: 0, stdout: '', stderr: '', durationMs: 10 };
    expect(knipAdapter.parse(result, { project: mockProject })).toHaveLength(0);
  });
});
