import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthUser } from './auth-module-types';

/** Injects the authenticated user (requires SessionGuard to have run). */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser | undefined => {
    const request = context.switchToHttp().getRequest();
    return request.authSession?.user;
  },
);
