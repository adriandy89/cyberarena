import { Module } from '@nestjs/common';
import { LabsModule } from '../labs/labs.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [LabsModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
