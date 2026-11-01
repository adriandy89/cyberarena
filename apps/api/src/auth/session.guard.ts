import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthInstance, AuthSession } from './auth-module-types';
import { AUTH } from './auth.constants';

/** Request with the session attached by SessionGuard. */
export type SessionRequest = Request & { authSession?: AuthSession };

/** Converts Node's IncomingHttpHeaders into a Web Headers instance. */
export function toWebHeaders(nodeHeaders: Record<string, unknown>): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(nodeHeaders)) {
    if (typeof value === 'string') {
      headers.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') {
          headers.append(key, item);
        }
      }
    }
  }
  return headers;
}

/**
 * Requires a valid Better Auth session; attaches it to `request.authSession`
 * for the CurrentUser decorator and the RolesGuard.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: AuthInstance) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<SessionRequest>();
    const session = await this.auth.api.getSession({
      headers: toWebHeaders(request.headers),
    });
    if (!session) {
      throw new UnauthorizedException();
    }
    request.authSession = session;
    return true;
  }
}
