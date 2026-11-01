# ADR-004 — Backend: NestJS 12 como API REST separada

- **Estado:** aceptada (2026-11-01, fase 000 — decisión del usuario)
- **Contexto:** se necesita un backend mantenible y estructurado (módulos auth, progreso,
  gamificación, labs) que escale en fases; el usuario conoce NestJS y lo exige.
- **Alternativas:** Fastify puro (más rápido de arrancar, menos estructura a largo plazo),
  API Routes de Next (acoplaría web y backend, imposible desplegar por separado).
- **Decisión:** NestJS 12.3 como API REST con prefijo `/api`, validación global con **Zod
  (Standard Schema nativo de Nest 12)** en lugar de class-validator, Throttler para rate
  limit, CORS por `CORS_ORIGINS`. Compilación estándar (tsc → `dist/`).
- **Consecuencias:** dos despliegues (web/api) — coherente con los stacks Docker separados
  que exige el usuario. Los contratos API se versionan en `packages/shared` (schemas Zod
  compartidos desde F1) para no duplicar tipos.
