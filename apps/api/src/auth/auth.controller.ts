import { All, Controller, Inject, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { AuthInstance } from './auth';
import { AUTH } from './auth.constants';

/**
 * Catch-all for Better Auth's HTTP API (/api/auth/**: sign-up, sign-in,
 * sign-out, get-session, forgot/reset password, verify-email, ...).
 *
 * Nest's global prefix applies ("api") and the body parser is bypassed for
 * this path in main.ts so better-auth reads the raw request body (ADR-007).
 */
@Controller('auth')
export class AuthController {
  constructor(@Inject(AUTH) private readonly auth: AuthInstance) {}

  @All('*path')
  handle(@Req() req: Request, @Res() res: Response): void {
    toNodeHandler(this.auth)(req, res);
  }
}
