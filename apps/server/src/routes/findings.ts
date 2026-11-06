import type { FastifyPluginAsync } from 'fastify';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projects, findings } from '../db/schema.js';
import { UpdateFindingSchema, FindingsQuerySchema } from '@sightline/shared';

export const findingsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get<{ Params: { id: string }; Querystring: Record<string, string> }>(
    '/api/projects/:id/findings',
    async (request, reply) => {
      const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
      if (!project) return reply.code(404).send({ error: 'Not found' });

      const query = FindingsQuerySchema.safeParse(request.query);
      if (!query.success) return reply.code(400).send({ error: query.error.flatten() });

      let rows = db.select().from(findings).where(eq(findings.projectId, project.id)).all();

      const { category, severity, tool, status } = query.data;
      if (category) rows = rows.filter((f) => f.category === category);
      if (severity) rows = rows.filter((f) => f.severity === severity);
      if (tool) rows = rows.filter((f) => f.tool === tool);
      if (status) rows = rows.filter((f) => f.status === status);

      return rows;
    },
  );

  fastify.patch<{ Params: { id: string } }>('/api/findings/:id', async (request, reply) => {
    const finding = db.select().from(findings).where(eq(findings.id, request.params.id)).get();
    if (!finding) return reply.code(404).send({ error: 'Not found' });

    const body = UpdateFindingSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    const patch: Record<string, string> = {};
    if (body.data.status !== undefined) patch['status'] = body.data.status;
    if (body.data.ignoreReason !== undefined) patch['ignoreReason'] = body.data.ignoreReason;

    const updated = db.update(findings)
      .set(patch)
      .where(eq(findings.id, finding.id))
      .returning()
      .get();
    return updated;
  });
};
