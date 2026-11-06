import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { scanRuns, toolRuns, findings } from '../db/schema.js';
import type { Project, CategorySummary, FindingCategory, ProjectHealth } from '@sightline/shared';

export async function buildHealthPayload(project: Project): Promise<ProjectHealth> {
  const allScans = db.select().from(scanRuns)
    .where(eq(scanRuns.projectId, project.id))
    .all()
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  const latestScan = allScans[0] ?? null;
  const previousScan = allScans[1] ?? null;

  const tools = latestScan
    ? db.select().from(toolRuns).where(eq(toolRuns.scanRunId, latestScan.id)).all()
    : [];

  const allFindings = db.select().from(findings)
    .where(eq(findings.projectId, project.id))
    .all()
    .filter((f) => f.status !== 'fixed');

  const categories: FindingCategory[] = ['quality', 'architecture', 'dependencies', 'security', 'docs', 'performance'];

  const categorySummary: CategorySummary[] = categories.map((category) => {
    const catFindings = allFindings.filter((f) => f.category === category);
    const newSince = previousScan
      ? catFindings.filter((f) => f.firstSeenScanRunId === latestScan?.id).length
      : catFindings.length;
    return {
      category,
      critical: catFindings.filter((f) => f.severity === 'critical').length,
      high: catFindings.filter((f) => f.severity === 'high').length,
      medium: catFindings.filter((f) => f.severity === 'medium').length,
      low: catFindings.filter((f) => f.severity === 'low').length,
      info: catFindings.filter((f) => f.severity === 'info').length,
      newSinceLastScan: newSince,
    };
  });

  return {
    project,
    latestScan,
    toolRuns: tools,
    categorySummary,
    recentScans: allScans.slice(0, 10),
  };
}
