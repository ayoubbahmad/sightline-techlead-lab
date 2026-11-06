export type Framework = 'expo' | 'bare-rn' | 'unknown';
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';
export type FindingCategory = 'quality' | 'architecture' | 'dependencies' | 'security' | 'docs' | 'performance';
export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type FindingStatus = 'open' | 'fixed' | 'ignored';
export type ScanStatus = 'queued' | 'running' | 'done' | 'failed';
export type ToolRunStatus = 'queued' | 'running' | 'done' | 'failed' | 'unavailable';

export interface Project {
  id: string;
  name: string;
  path: string;
  framework: Framework;
  rnVersion: string | null;
  expoSdkVersion: string | null;
  packageManager: PackageManager;
  hasTypeScript: boolean;
  createdAt: string;
  lastVisitedAt: string | null;
  lastScannedAt: string | null;
}

export interface ScanRun {
  id: string;
  projectId: string;
  status: ScanStatus;
  startedAt: string;
  completedAt: string | null;
  newFindingCount: number;
  fixedFindingCount: number;
}

export interface ToolRun {
  id: string;
  scanRunId: string;
  tool: string;
  status: ToolRunStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface Finding {
  id: string;
  projectId: string;
  scanRunId: string;
  firstSeenScanRunId: string;
  category: FindingCategory;
  tool: string;
  ruleId: string | null;
  severity: FindingSeverity;
  file: string | null;
  line: number | null;
  message: string;
  fingerprint: string;
  firstSeenAt: string;
  lastSeenAt: string;
  status: FindingStatus;
  ignoreReason: string | null;
}

export interface ScanProgressEvent {
  type: 'tool_start' | 'tool_done' | 'scan_done';
  scanRunId: string;
  tool?: string;
  toolStatus?: ToolRunStatus;
  durationMs?: number;
  error?: string;
}

export interface CommitInfo {
  hash: string;
  author: string;
  message: string;
  date: string;
  filesChanged: number;
}

export interface ProjectHealth {
  project: Project;
  latestScan: ScanRun | null;
  toolRuns: ToolRun[];
  categorySummary: CategorySummary[];
  recentScans: ScanRun[];
}

export interface CategorySummary {
  category: FindingCategory;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  newSinceLastScan: number;
}
