import { Module } from '@nestjs/common';
import { HacktivitiesController } from './hacktivities.controller';
import { HacktivitiesService } from './hacktivities.service';

@Module({
  controllers: [HacktivitiesController],
  providers: [HacktivitiesService],
})
export class HacktivitiesModule {}
