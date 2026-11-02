import { Module, StandardSchemaValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { GamificationModule } from './gamification/gamification.module';
import { HacktivitiesModule } from './hacktivities/hacktivities.module';
import { HealthModule } from './health/health.module';
import { LabsModule } from './labs/labs.module';
import { PrismaModule } from './prisma/prisma.module';
import { RoomsModule } from './rooms/rooms.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // `pnpm dev` runs the api from apps/api: also read the monorepo root .env.
    // Variables already set (Docker, CI) always win over both files.
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
    // Global rate limiting: 120 requests / minute / IP by default (constitution §1.5).
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    RoomsModule,
    GamificationModule,
    HacktivitiesModule,
    LabsModule,
    HealthModule,
  ],
  providers: [
    // Zod/Standard Schema validation for @Body({ schema }) route params.
    { provide: APP_PIPE, useClass: StandardSchemaValidationPipe },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
