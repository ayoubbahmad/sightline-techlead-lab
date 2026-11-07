import Fastify from 'fastify';
import cors from '@fastify/cors';
import { runMigrations } from './db/client.js';
import { projectsRoutes } from './routes/projects.js';
import { scansRoutes } from './routes/scans.js';
import { findingsRoutes } from './routes/findings.js';
import { watcherService } from './services/watcher.service.js';

const PORT = Number(process.env['PORT'] ?? 3001);

async function main() {
  runMigrations();

  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cors, {
    // Allow any localhost port (Vite picks a free port on each run)
    origin: /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/,
  });

  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  await app.register(projectsRoutes);
  await app.register(scansRoutes);
  await app.register(findingsRoutes);

  app.get('/api/health', async () => ({ ok: true }));

  await app.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`Sightline server running at http://127.0.0.1:${PORT}`);
  watcherService.restoreAll();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
