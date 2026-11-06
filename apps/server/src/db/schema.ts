import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  path: text('path').notNull().unique(),
  framework: text('framework', { enum: ['expo', 'bare-rn', 'unknown'] }).notNull(),
  rnVersion: text('rn_version'),
  expoSdkVersion: text('expo_sdk_version'),
  packageManager: text('package_manager', { enum: ['npm', 'yarn', 'pnpm', 'bun'] }).notNull(),
  hasTypeScript: integer('has_typescript', { mode: 'boolean' }).notNull(),
  createdAt: text('created_at').notNull(),
  lastVisitedAt: text('last_visited_at'),
  lastScannedAt: text('last_scanned_at'),
});

export const scanRuns = sqliteTable('scan_runs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed'] }).notNull(),
  startedAt: text('started_at').notNull(),
  completedAt: text('completed_at'),
  newFindingCount: integer('new_finding_count').notNull().default(0),
  fixedFindingCount: integer('fixed_finding_count').notNull().default(0),
});

export const toolRuns = sqliteTable('tool_runs', {
  id: text('id').primaryKey(),
  scanRunId: text('scan_run_id').notNull().references(() => scanRuns.id, { onDelete: 'cascade' }),
  tool: text('tool').notNull(),
  status: text('status', { enum: ['queued', 'running', 'done', 'failed', 'unavailable'] }).notNull(),
  startedAt: text('started_at'),
  completedAt: text('completed_at'),
  durationMs: real('duration_ms'),
  error: text('error'),
});

export const findings = sqliteTable('findings', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  scanRunId: text('scan_run_id').notNull().references(() => scanRuns.id),
  firstSeenScanRunId: text('first_seen_scan_run_id').notNull().references(() => scanRuns.id),
  category: text('category', { enum: ['quality', 'architecture', 'dependencies', 'security', 'docs', 'performance'] }).notNull(),
  tool: text('tool').notNull(),
  ruleId: text('rule_id'),
  severity: text('severity', { enum: ['critical', 'high', 'medium', 'low', 'info'] }).notNull(),
  file: text('file'),
  line: integer('line'),
  message: text('message').notNull(),
  fingerprint: text('fingerprint').notNull(),
  firstSeenAt: text('first_seen_at').notNull(),
  lastSeenAt: text('last_seen_at').notNull(),
  status: text('status', { enum: ['open', 'fixed', 'ignored'] }).notNull(),
  ignoreReason: text('ignore_reason'),
});
