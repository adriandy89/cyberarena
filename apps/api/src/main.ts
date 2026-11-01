import 'reflect-metadata';
import { json } from 'express';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import { AUTH } from './auth/auth.constants';
import type { AuthInstance } from './auth/auth';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // Better Auth reads the raw request body, so Nest's body parser stays off
  // entirely. The auth handler is dispatched at root level (full URL kept:
  // better-auth matches routes including its basePath, like toNodeListener
  // mounted at "/"), and JSON parsing covers the rest of the API (ADR-007).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.setGlobalPrefix('api');

  const expressApp = app.getHttpAdapter().getInstance();
  const auth = app.get<AuthInstance>(AUTH, { strict: false });
  const authHandler = toNodeHandler(auth);

  expressApp.use(
    (req: import('express').Request, res: import('express').Response, next: () => void) => {
      if (req.url.startsWith('/api/auth')) {
        return authHandler(req, res);
      }
      return json()(req, res, next);
    },
  );

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
