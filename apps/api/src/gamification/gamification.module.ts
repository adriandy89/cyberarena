import { Module } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { CertificatePdfService } from './certificate-pdf.service';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';

@Module({
  controllers: [GamificationController],
  providers: [GamificationService, BadgesService, CertificatePdfService],
  exports: [BadgesService],
})
export class GamificationModule {}
