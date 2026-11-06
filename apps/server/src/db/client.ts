import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import * as schema from './schema.js';

function getDbPath(): string {
  const dataDir = process.env['SIGHTLINE_DATA_DIR'] ?? join(homedir(), '.sightline');
  mkdirSync(dataDir, { recursive: true });
  return join(dataDir, 'sightline.db');
}

const sqlite = new Database(getDbPath());
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });

export function runMigrations() {
  migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
}
