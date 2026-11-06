import type { Finding, Project } from '@sightline/shared';

export interface RawResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface AdapterContext {
  project: Project;
}

export interface Adapter {
  id: string;
  category: Finding['category'];
  isAvailable(project: Project): Promise<boolean>;
  run(ctx: AdapterContext): Promise<RawResult>;
  parse(result: RawResult, ctx: AdapterContext): Array<Omit<Finding, 'id' | 'projectId' | 'scanRunId' | 'firstSeenScanRunId' | 'fingerprint' | 'firstSeenAt' | 'lastSeenAt' | 'status' | 'ignoreReason'>>;
}
