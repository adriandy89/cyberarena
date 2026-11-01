# Arquitectura — CyberArena

> Visión global. Detalle por fase en `specs/`. Decisiones justificadas en `docs/adr/`.

## Diagrama general

```
                       ┌─────────────────────────── Docker host ───────────────────────────┐
                       │                                                                    │
  Browser ──► :3000 ──│──► web (Next.js 16)          infra/stacks/dev · prod              │
                       │      · SSR/SSG catálogo      ┌──────────────────────────────┐     │
                       │      · i18n /es /en          │ red dev_frontend             │     │
                       │      · room player (client)  │   web ◄──► api                │     │
                       │                             │ ┌──────────────────────────┐ │     │
  Browser ──► :3001 ──│──► api (NestJS 12)  ────────►│ │ red dev_backend          │ │     │
                       │      · REST /api/*          │ │   api ◄──► postgres 18   │ │     │
                       │      · Better Auth (F1)     │ └──────────────────────────┘ │     │
                       │      · progreso/gamificación│   api ◄──► mailpit (F1)       │     │
                       │                             └──────────────────────────────┘     │
                       │                                                                    │
                       │  labs/<room>/compose.yaml  ── red interna aislada por room (F7)    │
                       │  (SIN puertos publicados a la app; acceso desde terminal local)    │
                       └────────────────────────────────────────────────────────────────────┘
```

## Monorepo (pnpm + Turborepo)

- `apps/web` (Next.js 16) y `apps/api` (NestJS 12) son desplegables; `packages/*` son
  librerías internas enlazadas con `workspace:*`.
- `packages/shared` es el **contrato**: constantes de gamificación, tipos de contenido y
  (desde F1) schemas Zod compartidos entre web y api. Sin dependencias de frameworks.
- `packages/database` expone el cliente Prisma generado (`generated/`, no commiteado) y las
  migraciones. Solo `apps/api` (y scripts) lo consumen — la web **nunca** toca la BD.
- `packages/content` valida y compila el contenido MDX (F2); sus salidas se siembran a la BD
  y sirven a la web. `packages/content/private/**` jamás se importa desde código de cliente.

## Flujo de datos del contenido (modelo target F2/F3)

```
MDX (content-as-code, git) ──build──► validación Zod (Content Collections)
        │                                       │
        └─ answers (private/*.yaml) ──► seed ──► PostgreSQL (hash de flags)
                                                │
                        web ◄── REST ── api ◄───┘  (nunca expone respuestas)
```

## Progreso y gamificación (target F3/F5)

- Toda respuesta correcta genera `XpEvent` inmutable + actualiza `RoomProgress`.
- Agregados (% room/módulo/path, streaks, niveles) se calculan sobre eventos; cacheables.
- La lógica pura (XP→nivel, rachas, normalización de flags) vive en `packages/shared` con
  tests — web y api la comparten.

## Seguridad (resumen — detalle en runbook y ADRs)

- Contenedores no-root, `cap_drop: ALL`, healthchecks, redes segmentadas.
- Labs aislados por room, sin conexión con las redes de la app.
- Secretos: `.env` por stack (no commiteados); en prod, `secrets:` de compose (F8).
- API: validación Zod global, Throttler, CORS explícito.
- Respuestas de preguntas hasheadas en BD; nunca en bundles ni API responses.

## Despliegue (target F8)

- `infra/stacks/prod` (web+api+postgres) y `infra/stacks/proxy` (Caddy, HTTPS ACME) con
  imágenes multi-stage (`turbo prune --docker`), redes separadas y backups programados.
