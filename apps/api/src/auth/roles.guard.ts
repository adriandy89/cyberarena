import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type Reflector } from '@nestjs/core';
import { Role } from '@repo/database';
import { ROLES_KEY, type RequiredRoles } from './roles.decorator';
import type { SessionRequest } from './session.guard';

/**
 * Must run AFTER SessionGuard. Checks the user role against @Roles(...).
 * The role comes from the better-auth session user (additionalField).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<RequiredRoles>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const session = request.authSession;
    if (!session) {
      throw new UnauthorizedException('SessionGuard must run before RolesGuard');
    }
    const role = (session.user as { role?: Role }).role ?? Role.STUDENT;
    if (!required.includes(role)) {
      throw new ForbiddenException(`requires role: ${required.join(' | ')}`);
    }
    return true;
  }
}
