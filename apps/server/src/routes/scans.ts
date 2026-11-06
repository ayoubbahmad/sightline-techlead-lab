import type { FastifyPluginAsync } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projects, scanRuns, toolRuns } from '../db/schema.js';
import { runScan } from '../services/scan.service.js';
import type { ScanProgressEvent } from '@sightline/shared';

// In-memory SSE subscribers keyed by scanRunId
const subscribers = new Map<string, Array<(event: ScanProgressEvent) => void>>();

export const scansRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Params: { id: string } }>('/api/projects/:id/scans', async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });

    // Check no scan already running
    const running = db.select().from(scanRuns)
      .where(eq(scanRuns.projectId, project.id))
      .all()
      .find((s) => s.status === 'running' || s.status === 'queued');
    if (running) return reply.code(409).send({ error: 'Scan already in progress' });

    // Start scan async, don't await
    runScan(project, (event) => {
      const subs = subscribers.get(event.scanRunId) ?? [];
      for (const sub of subs) sub(event);
      if (event.type === 'scan_done') {
        // Brief delay to ensure last event is sent before cleanup
        setTimeout(() => subscribers.delete(event.scanRunId), 5000);
      }
    }).catch(() => {/* errors recorded in DB */});

    // Return immediately with the queued scan (scan service sets running status synchronously before first await)
    // Small yield to let the insert happen
    await new Promise((resolve) => setTimeout(resolve, 10));
    const scan = db.select().from(scanRuns).where(eq(scanRuns.projectId, project.id)).all().at(-1);
    return reply.code(202).send(scan);
  });

  fastify.get<{ Params: { id: string } }>('/api/projects/:id/scans', async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });
    return db.select().from(scanRuns).where(eq(scanRuns.projectId, project.id)).all()
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  });

  fastify.get<{ Params: { scanId: string } }>('/api/scans/:scanId', async (request, reply) => {
    const scan = db.select().from(scanRuns).where(eq(scanRuns.id, request.params.scanId)).get();
    if (!scan) return reply.code(404).send({ error: 'Not found' });
    const tools = db.select().from(toolRuns).where(eq(toolRuns.scanRunId, scan.id)).all();
    return { ...scan, toolRuns: tools };
  });

  // SSE progress stream
  fastify.get<{ Params: { scanId: string } }>('/api/scans/:scanId/progress', async (request, reply) => {
    const { scanId } = request.params;
    const scan = db.select().from(scanRuns).where(eq(scanRuns.id, scanId)).get();
    if (!scan) return reply.code(404).send({ error: 'Not found' });

    // If scan already done, send single done event and close
    if (scan.status === 'done' || scan.status === 'failed') {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      reply.raw.write(`data: ${JSON.stringify({ type: 'scan_done', scanRunId: scanId })}\n\n`);
      reply.raw.end();
      return reply;
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (event: ScanProgressEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      if (event.type === 'scan_done') reply.raw.end();
    };

    const existing = subscribers.get(scanId) ?? [];
    existing.push(send);
    subscribers.set(scanId, existing);

    request.raw.on('close', () => {
      const subs = subscribers.get(scanId) ?? [];
      subscribers.set(scanId, subs.filter((s) => s !== send));
    });

    return reply;
  });
};
