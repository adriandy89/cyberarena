import { Module } from '@nestjs/common';
import { AdminLabsController } from './admin-labs.controller';
import { LABS_CONFIG, loadLabsConfig, type LabsConfig } from './labs.config';
import { LabsController } from './labs.controller';
import { LABS_HEALTH, LabsReaper } from './labs.reaper';
import { LabsService } from './labs.service';
import { LabRunnerClient } from './runner.client';

@Module({
  controllers: [LabsController, AdminLabsController],
  providers: [
    { provide: LABS_CONFIG, useFactory: () => loadLabsConfig() },
    {
      provide: LabRunnerClient,
      useFactory: (config: LabsConfig) => new LabRunnerClient(config.runnerUrl, config.runnerToken),
      inject: [LABS_CONFIG],
    },
    LabsService,
    LabsReaper,
    { provide: LABS_HEALTH, useExisting: LabsReaper },
  ],
  exports: [LabsService, LABS_HEALTH],
})
export class LabsModule {}
