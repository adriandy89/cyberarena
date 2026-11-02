import { Module } from '@nestjs/common';
import { LABS_CONFIG, loadLabsConfig, type LabsConfig } from './labs.config';
import { LabsController } from './labs.controller';
import { LabsService } from './labs.service';
import { LabRunnerClient } from './runner.client';

@Module({
  controllers: [LabsController],
  providers: [
    { provide: LABS_CONFIG, useFactory: () => loadLabsConfig() },
    {
      provide: LabRunnerClient,
      useFactory: (config: LabsConfig) => new LabRunnerClient(config.runnerUrl, config.runnerToken),
      inject: [LABS_CONFIG],
    },
    LabsService,
  ],
  exports: [LabsService, LabRunnerClient, LABS_CONFIG],
})
export class LabsModule {}
