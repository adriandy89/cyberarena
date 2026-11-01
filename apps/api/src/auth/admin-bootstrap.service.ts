import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Role } from '@repo/database';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH } from './auth.constants';
import type { AuthInstance } from './auth';

const DEFAULT_BOOTSTRAP_ADMIN_EMAIL = 'admin@cyberarena.local';

/** 20-char readable alphabet (no ambiguous glyphs). */
function generatePassword(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 20; i++) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}

function isUserExistsError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'USER_ALREADY_EXISTS'
  );
}

/**
 * Creates the initial ADMIN account at first boot — and ONLY at first boot
 * (empty users table). Registration never grants ADMIN (ADR-009).
 *
 * Race safety: concurrent boots collide on the unique email constraint; the
 * duplicate is detected and ignored, so the bootstrap is idempotent.
 */
@Injectable()
export class AdminBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUTH) private readonly auth: AuthInstance,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.bootstrap();
      await this.verifyAdminExists();
    } catch (error) {
      // Never crash the app because of the bootstrap; it retries next boot.
      this.logger.error(`admin bootstrap failed: ${String(error)}`);
    }
  }

  async bootstrap(): Promise<void> {
    const existingUsers = await this.prisma.user.count();
    if (existingUsers > 0) {
      this.logger.log(`users table not empty (${existingUsers}) — skipping bootstrap`);
      return;
    }

    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || DEFAULT_BOOTSTRAP_ADMIN_EMAIL;
    const providedPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim();
    const password = providedPassword && providedPassword.length >= 8 ? providedPassword : generatePassword();
    const generated = !providedPassword || providedPassword.length < 8;
    if (providedPassword && providedPassword.length < 8) {
      this.logger.warn('BOOTSTRAP_ADMIN_PASSWORD is shorter than 8 chars — using a generated one');
    }

    try {
      const result = await this.auth.api.signUpEmail({
        body: { name: 'Admin', email, password },
      });
      const userId = result.user.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { role: Role.ADMIN, emailVerified: true },
      });
      if (generated) {
        this.logger.warn(
          `initial admin created (${email}) with GENERATED password: ${password} — CHANGE IT AFTER FIRST LOGIN`,
        );
      } else {
        this.logger.log(`initial admin created (${email})`);
      }
    } catch (error) {
      if (isUserExistsError(error)) {
        // Concurrent boot won the race; nothing else to do.
        this.logger.log('bootstrap admin already exists (race) — skipping');
        return;
      }
      throw error;
    }
  }

  /** Always verify: users present but no admin means the platform is unmanageable. */
  async verifyAdminExists(): Promise<void> {
    const [users, admins] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: Role.ADMIN } }),
    ]);
    if (users > 0 && admins === 0) {
      this.logger.error(
        'NO ADMIN ACCOUNT EXISTS — promote one manually: sign in, then from a psql session ' +
          `UPDATE "User" SET role='ADMIN' WHERE email='<your-email>'; (see docs/runbook.md)`,
      );
    }
  }
}
