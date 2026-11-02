import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import PDFDocument from 'pdfkit';
import type { CertificateItem } from '@repo/shared';
import { GamificationService } from './gamification.service';

const LABELS = {
  es: {
    brand: 'CyberArena',
    title: 'CERTIFICADO DE FINALIZACIÓN',
    awardedTo: 'Otorgado a',
    forCompleting: 'por completar el path',
    completedOn: 'Completado el',
    experience: 'XP acumulada',
    verification: 'Código de verificación',
    verifyNote: 'Verifica este certificado con su código único y el historial del usuario.',
  },
  en: {
    brand: 'CyberArena',
    title: 'CERTIFICATE OF COMPLETION',
    awardedTo: 'Awarded to',
    forCompleting: 'for completing the path',
    completedOn: 'Completed on',
    experience: 'XP earned',
    verification: 'Verification code',
    verifyNote: 'Verify this certificate with its unique code and the user history.',
  },
} as const;

export function certificateVerificationCode(
  userId: string,
  pathSlug: string,
  completedAt: Date,
): string {
  return createHash('sha256')
    .update(`${userId}|${pathSlug}|${completedAt.toISOString()}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

@Injectable()
export class CertificatePdfService {
  constructor(private readonly gamification: GamificationService) {}

  /** Builds the certificate PDF for a completed path, ES or EN. */
  async build(userId: string, userName: string, pathSlug: string, locale: 'es' | 'en'): Promise<{ buffer: Buffer; filename: string }> {
    // getCertificates returns Date objects (serialized to ISO by HTTP elsewhere)
    const certificates = (await this.gamification.getCertificates(userId)) as Array<
      CertificateItem & { completedAt: Date }
    >;
    const certificate = certificates.find((item) => item.pathSlug === pathSlug);
    if (!certificate) {
      throw new NotFoundException('path not completed');
    }

    const t = LABELS[locale === 'en' ? 'en' : 'es'];
    const completedAt = new Date(certificate.completedAt);
    const code = certificateVerificationCode(userId, certificate.pathSlug, completedAt);
    const date = completedAt.toISOString().slice(0, 10);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
    const chunks: Buffer[] = [];
    const done = new Promise<Buffer>((resolve) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
    });

    // page background + double border (matches the web card)
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');
    doc.lineWidth(3).strokeColor('#059669')
      .rect(28, 28, doc.page.width - 56, doc.page.height - 56).stroke();
    doc.lineWidth(1).strokeColor('#10b981')
      .rect(38, 38, doc.page.width - 76, doc.page.height - 76).stroke();

    const centerX = doc.page.width / 2;
    doc.fillColor('#047857').font('Helvetica-Bold').fontSize(13)
      .text(t.brand.toUpperCase(), centerX - 150, 70, { width: 300, align: 'center', characterSpacing: 4 });
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(26)
      .text(t.title, 60, 110, { width: doc.page.width - 120, align: 'center' });

    doc.fillColor('#64748b').font('Helvetica').fontSize(10)
      .text(t.awardedTo.toUpperCase(), 60, 185, { width: doc.page.width - 120, align: 'center', characterSpacing: 2 });
    doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(24)
      .text(userName, 60, 205, { width: doc.page.width - 120, align: 'center' });

    doc.fillColor('#64748b').font('Helvetica').fontSize(10)
      .text(t.forCompleting.toUpperCase(), 60, 265, { width: doc.page.width - 120, align: 'center', characterSpacing: 2 });
    doc.fillColor('#065f46').font('Helvetica-Bold').fontSize(16)
      .text(certificate.pathTitle, 60, 285, { width: doc.page.width - 120, align: 'center' });

    doc.fillColor('#475569').font('Helvetica').fontSize(10)
      .text(`${t.completedOn}: ${date}    ·    ${t.experience}: ${certificate.xpInPath} XP`, 60, 345, {
        width: doc.page.width - 120,
        align: 'center',
      });

    doc.fillColor('#94a3b8').font('Helvetica').fontSize(8)
      .text(`${t.verification}: ${code}`, 60, 395, { width: doc.page.width - 120, align: 'center' });
    doc.fontSize(7).fillColor('#b0b8c4')
      .text(t.verifyNote, 60, 410, { width: doc.page.width - 120, align: 'center' });

    doc.end();
    const buffer = await done;

    const safeName = userName.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'student';
    const safePath = certificate.pathSlug;
    return { buffer, filename: `CyberArena-${safePath}-${safeName}.pdf` };
  }
}
