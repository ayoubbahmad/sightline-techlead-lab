import type { FastifyPluginAsync } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { projects } from '../db/schema.js';
import { validateProjectPath, detectProjectInfo, getProjectGitInfo, getCommitsSince } from '../services/project.service.js';
import { watcherService } from '../services/watcher.service.js';
import { AddProjectSchema } from '@sightline/shared';

export const projectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/projects', async () => {
    return db.select().from(projects).all();
  });

  fastify.post('/api/projects', async (request, reply) => {
    const body = AddProjectSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });

    // Normalize: strip trailing slash
    const path = body.data.path.replace(/\/$/, '');

    const error = await validateProjectPath(path);
    if (error) return reply.code(422).send({ error });

    const existing = db.select().from(projects).where(eq(projects.path, path)).get();
    if (existing) return reply.code(409).send({ error: 'Project already added' });

    const info = detectProjectInfo(path);
    const now = new Date().toISOString();
    const project = {
      id: randomUUID(),
      ...info,
      path,
      createdAt: now,
      lastVisitedAt: null,
      lastScannedAt: null,
    };
    db.insert(projects).values(project).run();
    return reply.code(201).send(project);
  });

  fastify.get<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });

    // Update lastVisitedAt
    const now = new Date().toISOString();
    db.update(projects).set({ lastVisitedAt: now }).where(eq(projects.id, project.id)).run();

    const gitInfo = await getProjectGitInfo(project).catch(() => ({ branch: 'unknown', lastCommit: null }));
    return { ...project, lastVisitedAt: now, ...gitInfo };
  });

  fastify.delete<{ Params: { id: string } }>('/api/projects/:id', async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });
    watcherService.stopWatching(project.id);
    db.delete(projects).where(eq(projects.id, project.id)).run();
    return reply.code(204).send();
  });

  fastify.post<{ Params: { id: string } }>('/api/projects/:id/watch', async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });
    db.update(projects).set({ watchEnabled: true }).where(eq(projects.id, project.id)).run();
    watcherService.startWatching({ ...project, watchEnabled: true });
    return { watchEnabled: true };
  });

  fastify.delete<{ Params: { id: string } }>('/api/projects/:id/watch', async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });
    db.update(projects).set({ watchEnabled: false }).where(eq(projects.id, project.id)).run();
    watcherService.stopWatching(project.id);
    return { watchEnabled: false };
  });

  fastify.get<{ Params: { id: string } }>('/api/projects/:id/health', async (request, reply) => {
    const { buildHealthPayload } = await import('./health.js');
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });
    return buildHealthPayload(project);
  });

  fastify.get<{ Params: { id: string } }>('/api/projects/:id/commits', async (request, reply) => {
    const project = db.select().from(projects).where(eq(projects.id, request.params.id)).get();
    if (!project) return reply.code(404).send({ error: 'Not found' });
    if (!project.lastVisitedAt) return [];
    return getCommitsSince(project, project.lastVisitedAt);
  });
};
