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

  // Bodyless POST/DELETE requests (trigger scan, toggle watch) may still carry
  // a JSON content-type; treat an empty body as "no body" instead of a 500.
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body, done) => {
    const text = typeof body === 'string' ? body : body.toString('utf8');
    if (text.trim() === '') {
      done(null, undefined);
      return;
    }
    try {
      done(null, JSON.parse(text));
    } catch (err) {
      // Malformed JSON is a client error, not a server failure.
      const error = err as Error & { statusCode?: number };
      error.statusCode = 400;
      done(error, undefined);
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
