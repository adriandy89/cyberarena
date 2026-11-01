/**
 * Seed entry point. Phase 000: connectivity check only.
 * Phase 002 (content engine) fills this with catalog syncing (paths/modules/
 * rooms/tasks/questions + hashed answers from packages/content/private).
 */
import { config } from 'dotenv';

config({ path: '.env', quiet: true });
config({ path: '../../.env', quiet: true });

import { createPrismaClient } from '../src/client.js';

async function main() {
  const prisma = createPrismaClient();
  try {
    await prisma.$connect();
    const users = await prisma.user.count();
    console.log(`[seed] database reachable — users: ${users} (nothing to seed in phase 000)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[seed] failed:', error);
  process.exit(1);
});
