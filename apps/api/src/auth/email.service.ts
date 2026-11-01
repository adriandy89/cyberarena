import { Injectable, Logger } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import type { SendEmailInput } from './auth';

/**
 * SMTP mailer. In development the dev stack's Mailpit captures every message
 * (SMTP localhost:1025, UI :8025). Failures are logged, never thrown: an email
 * problem must not fail the auth flow (reset/verification can be retried).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST ?? 'localhost',
        port: Number(process.env.SMTP_PORT ?? 1025),
        secure: false,
      });
    }
    return this.transporter;
  }

  async send(input: SendEmailInput): Promise<void> {
    const from = process.env.EMAIL_FROM ?? 'CyberArena <no-reply@cyberarena.local>';
    try {
      await this.getTransporter().sendMail({ from, ...input });
      this.logger.log(`email sent to ${input.to} (${input.subject})`);
    } catch (error) {
      this.logger.error(`email to ${input.to} failed: ${String(error)}`);
    }
  }
}
