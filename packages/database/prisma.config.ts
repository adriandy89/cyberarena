import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 no longer loads .env automatically: load explicitly, first the
// package-local .env, then the monorepo root .env as fallback.
config({ path: '.env', quiet: true });
config({ path: '../../.env', quiet: true });

// Placeholder URL keeps `prisma generate` working in CI without a database;
// real commands (migrate/db push) require DATABASE_URL to be set.
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: databaseUrl,
  },
});
