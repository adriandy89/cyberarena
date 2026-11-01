import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

export { PrismaClient } from './generated/prisma/client.js';

export type DatabaseUrl = string;

/**
 * Creates a PrismaClient backed by the Rust-free query compiler with the
 * node-postgres driver adapter (Prisma 7 requirement — see ADR-005).
 */
export function createPrismaClient(databaseUrl?: DatabaseUrl): PrismaClient {
  const connectionString = databaseUrl ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}
