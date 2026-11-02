import { Module } from '@nestjs/common';
import { GamificationModule } from '../gamification/gamification.module';
import { LabsModule } from '../labs/labs.module';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [GamificationModule, LabsModule],
  controllers: [RoomsController, ProgressController],
  providers: [RoomsService, ProgressService],
})
export class RoomsModule {}
