import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { Role, type PrismaClient } from '@repo/database';

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface AuthDependencies {
  prisma: PrismaClient;
  sendEmail: (input: SendEmailInput) => Promise<void>;
}

/** Pure rule for tests: the first ever-registered user bootstraps as ADMIN. */
export function resolveBootstrapRole(existingUserCount: number): Role {
  return existingUserCount === 0 ? Role.ADMIN : Role.STUDENT;
}

const emailLayout = (title: string, body: string, url: string, cta: string) => `
<!doctype html><html lang="es"><body style="font-family:system-ui,sans-serif;background:#020617;color:#e2e8f0;padding:32px">
  <div style="max-width:480px;margin:0 auto;background:#0f172a;border:1px solid #1e293b;border-radius:12px;padding:32px">
    <h1 style="font-size:20px;margin:0 0 12px">CyberArena</h1>
    <h2 style="font-size:16px;color:#34d399;margin:0 0 8px">${title}</h2>
    <p style="font-size:14px;line-height:1.6;color:#94a3b8">${body}</p>
    <p style="margin:24px 0">
      <a href="${url}" style="background:#10b981;color:#020617;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:8px;display:inline-block">${cta}</a>
    </p>
    <p style="font-size:12px;color:#64748b;word-break:break-all">${url}</p>
  </div>
</body></html>`;

/**
 * Builds the Better Auth instance bound to our Prisma client and mailer
 * (see ADR-007: manual integration, custom STUDENT/ADMIN role).
 */
export function createAuth(deps: AuthDependencies) {
  const webUrl = process.env.WEB_URL ?? 'http://localhost:3000';
  const baseURL = `${process.env.BETTER_AUTH_URL ?? 'http://localhost:3001'}/api`;
  const requireEmailVerification = process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

  return betterAuth({
    database: prismaAdapter(deps.prisma, { provider: 'postgresql' }),
    baseURL,
    trustedOrigins: [webUrl],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification,
      minPasswordLength: 8,
      sendResetPassword: async ({ user, url }) => {
        await deps.sendEmail({
          to: user.email,
          subject: 'CyberArena — reset your password',
          html: emailLayout(
            'Reset your password',
            'We received a request to reset your password. This link expires soon; ignore this email if it was not you.',
            url,
            'Reset password',
          ),
          text: `Reset your password: ${url}`,
        });
      },
    },
    emailVerification: {
      sendVerificationEmail: async ({ user, url }) => {
        await deps.sendEmail({
          to: user.email,
          subject: 'CyberArena — verify your email',
          html: emailLayout(
            'Verify your email',
            'Welcome to CyberArena. Confirm your email address to activate your account.',
            url,
            'Verify email',
          ),
          text: `Verify your email: ${url}`,
        });
      },
    },
    user: {
      additionalFields: {
        role: {
          type: 'string',
          defaultValue: Role.STUDENT,
          // Never client-writable: role changes go through the admin endpoint only.
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const existing = await deps.prisma.user.count();
            return { data: { ...user, role: resolveBootstrapRole(existing) } };
          },
        },
      },
    },
  });
}

export type AuthInstance = ReturnType<typeof createAuth>;
export type AuthSession = AuthInstance['$Infer']['Session'];
export type AuthUser = AuthSession['user'];
