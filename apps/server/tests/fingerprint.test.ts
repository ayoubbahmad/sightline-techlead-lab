import { describe, it, expect } from 'vitest';
import { computeFingerprint } from '../src/services/fingerprint.js';

describe('computeFingerprint', () => {
  it('produces the same fingerprint for identical inputs', () => {
    const a = computeFingerprint('proj-1', 'tsc', 'TS6133', 'src/App.tsx', "'x' is declared but never read.");
    const b = computeFingerprint('proj-1', 'tsc', 'TS6133', 'src/App.tsx', "'x' is declared but never read.");
    expect(a).toBe(b);
  });

  it('differs by project', () => {
    const a = computeFingerprint('proj-1', 'tsc', 'TS6133', 'src/App.tsx', 'msg');
    const b = computeFingerprint('proj-2', 'tsc', 'TS6133', 'src/App.tsx', 'msg');
    expect(a).not.toBe(b);
  });

  it('normalizes line numbers so the fingerprint is stable across scan runs', () => {
    // The message contains a line number that should be normalized out
    const a = computeFingerprint('proj-1', 'eslint', 'no-unused-vars', 'src/App.tsx', "Line 42: 'x' is not used.");
    const b = computeFingerprint('proj-1', 'eslint', 'no-unused-vars', 'src/App.tsx', "Line 99: 'x' is not used.");
    expect(a).toBe(b);
  });

  it('produces 16-character hex output', () => {
    const fp = computeFingerprint('p', 't', null, null, 'msg');
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it('differs when tool changes', () => {
    const a = computeFingerprint('p', 'tsc', 'TS6133', 'f', 'msg');
    const b = computeFingerprint('p', 'eslint', 'TS6133', 'f', 'msg');
    expect(a).not.toBe(b);
  });
});
