import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH } from './auth.constants';
import { createAuth, type AuthInstance } from './auth';
import { AuthController } from './auth.controller';
import { EmailService } from './email.service';

/**
 * Owns the Better Auth instance (built once against the shared PrismaService,
 * so auth and app share the same connection pool) and the SMTP mailer.
 */
@Global()
@Module({
  controllers: [AuthController],
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
  ],
  exports: [AUTH, EmailService],
})
export class AuthModule {}
