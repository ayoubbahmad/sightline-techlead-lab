import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { securityAdapter } from '../../src/adapters/security.adapter.js';
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

const auditFixture = readFileSync(
  join(import.meta.dirname, '../fixtures/adapter-outputs/npm-audit-output.json'),
  'utf-8',
);

describe('securityAdapter.parse', () => {
  it('parses npm audit vulnerabilities', () => {
    const combined = JSON.stringify({ audit: auditFixture, gitleaks: '[]' });
    const result = { exitCode: 1, stdout: combined, stderr: '', durationMs: 500 };
    const findings = securityAdapter.parse(result, { project: mockProject });
    expect(findings.length).toBe(2);

    const critical = findings.find((f) => f.severity === 'critical');
    const high = findings.find((f) => f.severity === 'high');
    expect(critical).toBeDefined();
    expect(high).toBeDefined();
    expect(critical?.tool).toBe('npm-audit');
    expect(critical?.message).toContain('minimist');
  });

  it('parses gitleaks findings', () => {
    const gitleaksOutput = JSON.stringify([
      {
        RuleID: 'generic-api-key',
        File: 'src/config.ts',
        StartLine: 10,
        Description: 'API key detected',
      },
    ]);
    const combined = JSON.stringify({ audit: '{}', gitleaks: gitleaksOutput });
    const result = { exitCode: 1, stdout: combined, stderr: '', durationMs: 200 };
    const findings = securityAdapter.parse(result, { project: mockProject });
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tool: 'gitleaks',
      severity: 'critical',
      ruleId: 'generic-api-key',
      file: 'src/config.ts',
      line: 10,
    });
  });
});
