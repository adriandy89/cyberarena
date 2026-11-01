import { SetMetadata } from '@nestjs/common';
import { type Role } from '@repo/database';

export const ROLES_KEY = 'roles';
export type RequiredRoles = Role[];

/** Restricts a route to the given roles (pair with RolesGuard). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
