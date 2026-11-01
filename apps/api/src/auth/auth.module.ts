import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH } from './auth.constants';
import { createAuth, type AuthInstance } from './auth';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { EmailService } from './email.service';

/**
 * Owns the Better Auth instance (built once against the shared PrismaService,
 * so auth and app share the same connection pool) and the SMTP mailer.
 * The HTTP handler is mounted directly on Express in main.ts (ADR-007), and
 * the initial admin is bootstrapped at first boot (ADR-009).
 */
@Global()
@Module({
  providers: [
    EmailService,
    {
      provide: AUTH,
      inject: [PrismaService, EmailService],
      useFactory: (prisma: PrismaService, email: EmailService): AuthInstance =>
        createAuth({
          prisma,
          sendEmail: (input) => email.send(input),
        }),
    },
    AdminBootstrapService,
  ],
  exports: [AUTH, EmailService],
})
export class AuthModule {}
