import { defineConfig } from 'drizzle-kit';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// Load the ROOT .env (two levels above lib/db) unless DATABASE_URL is already set.
const rootEnv = path.resolve(here, '../../.env');
if (!process.env.DATABASE_URL && fs.existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

if (!process.env.DATABASE_URL) {
  throw new Error(`DATABASE_URL must be set (expected in ${rootEnv})`);
}

// drizzle-kit resolves `schema` with a glob relative to the current working directory.
// On Windows, path.join() yields backslashes, which glob treats as escape characters,
// so no schema files are found. Use a cwd-relative path with forward slashes instead.
const schemaPath = path
  .relative(process.cwd(), path.join(here, 'src', 'schema', 'index.js'))
  .split(path.sep)
  .join('/');

export default defineConfig({
  schema: schemaPath,
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
});
