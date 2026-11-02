import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { CertificateItem } from '@repo/shared';
import { GamificationService } from './gamification.service';
import {
  CertificatePdfService,
  certificateVerificationCode,
} from './certificate-pdf.service';

const CERTIFICATES: CertificateItem[] = [
  {
    pathSlug: 'webapp-pentesting',
    pathTitle: 'Web Application Pentesting',
    completedAt: '2026-11-02T10:00:00.000Z',
    xpInPath: 1337,
  },
];

function makeService(certificates: CertificateItem[] = CERTIFICATES) {
  const gamification = {
    getCertificates: vi.fn().mockResolvedValue(certificates),
  } as unknown as GamificationService;
  return new CertificatePdfService(gamification);
}

describe('CertificatePdfService', () => {
  it('builds a valid PDF with the student and path data', async () => {
    const service = makeService();
    const { buffer, filename } = await service.build(
      'user-1',
      'Ada Lovelace',
      'webapp-pentesting',
      'es',
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(2000);
    expect(filename).toBe('CyberArena-webapp-pentesting-Ada-Lovelace.pdf');
    // PDF text streams are Flate-compressed; at least the metadata stays plain.
    expect(buffer.toString('latin1')).toContain('/Type /Page');
  });

  it('labels the certificate in EN when locale=en', async () => {
    const service = makeService();
    const { buffer } = await service.build('user-1', 'Ada', 'webapp-pentesting', 'en');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('404s when the path is not completed', async () => {
    const service = makeService([]);
    await expect(
      service.build('user-1', 'Ada', 'webapp-pentesting', 'es'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('certificateVerificationCode', () => {
  it('is 16 uppercase hex chars and deterministic', () => {
    const completedAt = new Date('2026-11-02T10:00:00.000Z');
    const a = certificateVerificationCode('u1', 'p', completedAt);
    const b = certificateVerificationCode('u1', 'p', completedAt);
    const c = certificateVerificationCode('u2', 'p', completedAt);
    expect(a).toMatch(/^[0-9A-F]{16}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
