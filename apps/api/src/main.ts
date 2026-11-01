import 'reflect-metadata';
import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Better Auth reads the raw request body, so Nest's body parser stays off
  // and JSON parsing is applied selectively: every path except /api/auth.
  // (ADR-007)
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');

  const expressApp = app.getHttpAdapter().getInstance();
  expressApp.use((req: import('express').Request, res: import('express').Response, next: () => void) => {
    if (req.path.startsWith('/auth')) {
      return next();
    }
    return json()(req, res, next);
  });

  const corsOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  const port = Number(process.env.API_PORT ?? 3001);
  const host = process.env.API_HOST ?? '0.0.0.0';
  await app.listen(port, host);
  console.log(`[api] listening on http://${host}:${port}/api`);
}

void bootstrap();
