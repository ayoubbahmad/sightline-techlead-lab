import { eq, and, notInArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { scanRuns, toolRuns, findings, projects } from '../db/schema.js';
import { adapters } from '../adapters/registry.js';
import { computeFingerprint } from './fingerprint.js';
import type { Project, ScanProgressEvent } from '@sightline/shared';
import { randomUUID } from 'node:crypto';

type ProgressCallback = (event: ScanProgressEvent) => void;

export async function runScan(scanRunId: string, project: Project, onProgress: ProgressCallback): Promise<void> {
  const now = new Date().toISOString();

  db.insert(scanRuns).values({
    id: scanRunId,
    projectId: project.id,
    status: 'running',
    startedAt: now,
    newFindingCount: 0,
    fixedFindingCount: 0,
  }).run();

  // Run adapters sequentially to avoid overwhelming the target project's tooling
  let newCount = 0;
  let fixedCount = 0;
  const seenFingerprints: string[] = [];

  for (const adapter of adapters) {
    const toolRunId = randomUUID();
    const available = await adapter.isAvailable(project).catch(() => false);

    if (!available) {
      db.insert(toolRuns).values({
        id: toolRunId,
        scanRunId,
        tool: adapter.id,
        status: 'unavailable',
        startedAt: null,
        completedAt: null,
        durationMs: null,
        error: null,
      }).run();
      onProgress({ type: 'tool_done', scanRunId, tool: adapter.id, toolStatus: 'unavailable' });
      continue;
    }

    const toolStart = new Date().toISOString();
    db.insert(toolRuns).values({
      id: toolRunId,
      scanRunId,
      tool: adapter.id,
      status: 'running',
      startedAt: toolStart,
      completedAt: null,
      durationMs: null,
      error: null,
    }).run();
    onProgress({ type: 'tool_start', scanRunId, tool: adapter.id });

    try {
      const rawResult = await adapter.run({ project });
      const parsed = adapter.parse(rawResult, { project });
      const toolEnd = new Date().toISOString();

      // Persist findings
      for (const finding of parsed) {
        const fingerprint = computeFingerprint(
          project.id,
          finding.tool,
          finding.ruleId,
          finding.file,
          finding.message,
        );
        seenFingerprints.push(fingerprint);

        const existing = db.select().from(findings)
          .where(and(eq(findings.projectId, project.id), eq(findings.fingerprint, fingerprint)))
          .get();

        if (existing) {
          db.update(findings)
            .set({ scanRunId, lastSeenAt: toolEnd, status: existing.status === 'fixed' ? 'open' : existing.status })
            .where(eq(findings.id, existing.id))
            .run();
        } else {
          db.insert(findings).values({
            id: randomUUID(),
            projectId: project.id,
            scanRunId,
            firstSeenScanRunId: scanRunId,
            category: finding.category,
            tool: finding.tool,
            ruleId: finding.ruleId,
            severity: finding.severity,
            file: finding.file,
            line: finding.line,
            message: finding.message,
            fingerprint,
            firstSeenAt: toolEnd,
            lastSeenAt: toolEnd,
            status: 'open',
            ignoreReason: null,
          }).run();
          newCount++;
        }
      }

      db.update(toolRuns).set({
        status: 'done',
        completedAt: toolEnd,
        durationMs: rawResult.durationMs,
        error: null,
      }).where(eq(toolRuns.id, toolRunId)).run();

      onProgress({ type: 'tool_done', scanRunId, tool: adapter.id, toolStatus: 'done', durationMs: rawResult.durationMs });
    } catch (err) {
      const toolEnd = new Date().toISOString();
      const error = err instanceof Error ? err.message : String(err);
      db.update(toolRuns).set({
        status: 'failed',
        completedAt: toolEnd,
        error,
      }).where(eq(toolRuns.id, toolRunId)).run();
      onProgress({ type: 'tool_done', scanRunId, tool: adapter.id, toolStatus: 'failed', error });
    }
  }

  // Mark disappeared findings as fixed
  if (seenFingerprints.length > 0) {
    const disappeared = db.select().from(findings)
      .where(and(
        eq(findings.projectId, project.id),
        eq(findings.status, 'open'),
        notInArray(findings.fingerprint, seenFingerprints),
      ))
      .all();
    for (const f of disappeared) {
      db.update(findings).set({ status: 'fixed' }).where(eq(findings.id, f.id)).run();
      fixedCount++;
    }
  }

  const completedAt = new Date().toISOString();
  db.update(scanRuns).set({
    status: 'done',
    completedAt,
    newFindingCount: newCount,
    fixedFindingCount: fixedCount,
  }).where(eq(scanRuns.id, scanRunId)).run();

  // Update project lastScannedAt
  db.update(projects).set({ lastScannedAt: completedAt }).where(eq(projects.id, project.id)).run();

  onProgress({ type: 'scan_done', scanRunId });
}
