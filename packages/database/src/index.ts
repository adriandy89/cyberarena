export { createPrismaClient, PrismaClient } from './client.js';
export type { DatabaseUrl } from './client.js';

// Generated model/enum surface (regenerated with `pnpm db:generate`).
// The prisma-client generator names entity types `<Model>Model`.
export { Role } from './generated/prisma/enums.js';
export type { Role as RoleType } from './generated/prisma/enums.js';
export type { UserModel as User } from './generated/prisma/models/User.js';
export type { SessionModel as Session } from './generated/prisma/models/Session.js';
export type { AccountModel as Account } from './generated/prisma/models/Account.js';
export type { VerificationModel as Verification } from './generated/prisma/models/Verification.js';
