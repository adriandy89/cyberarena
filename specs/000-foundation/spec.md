# Spec 000 — Foundation (monorepo y entorno base)

- **Estado:** completada (2026-11-01)
- **Creada:** 2026-11-01
- **Changelog:**
  - 2026-11-01 primera versión.
  - 2026-11-01 implementación completada. Desvíos documentados: (1) el "pipe Zod global"
    se pospone a F1 (Nest 12 expone `ZodValidationPipe` por-ruta; el patrón global se
    diseña con los primeros DTOs reales). (2) El perfil `--profile infra` del stack dev se
    sustituye por `up -d postgres mailpit` (semánticamente correcto sin profiles).
    (3) Prisma 7: `url` fuera del schema (vive en `prisma.config.ts`) y cliente con driver
    adapter `@prisma/adapter-pg` (requerimientos reales de la 7.10.1). (4) ESLint fijado
    a 9.39.5 (los plugins de eslint-config-next aún no declaran peer para ESLint 10).
    (5) pnpm 11: builds nativos vía `allowBuilds` y `confirmModulesPurge: false` en
    `pnpm-workspace.yaml`. (6) Postgres 18 exige montar el volumen en `/var/lib/postgresql`
    (layout pg_upgrade). Todos verificados en T015/T016.

## 1. Propósito

Establecer el esqueleto ejecutable del proyecto: monorepo pnpm+Turborepo con las dos
aplicaciones (web Next.js bilingüe, api NestJS), packages base compartidos, entorno dev
completo en Docker Compose (postgres + api + web + mailpit), CI y todo el andamiaje SDD
(constitución, roadmap, docs, ADRs). Es la base sobre la que iteran todas las fases siguientes.

## 2. Historias de usuario

- **US1 (P1)** — Como *desarrollador*, quiero levantar todo el entorno de desarrollo con un
  solo comando de Docker Compose (o infra + `pnpm dev`), para trabajar sin fricción y con
  hot-reload.
- **US2 (P1)** — Como *desarrollador*, quiero una web Next.js con routing bilingüe `/es`/`/en`
  funcionando (landing mínima), para que el i18n sea estructural desde el día 0.
- **US3 (P1)** — Como *desarrollador*, quiero una API NestJS con endpoint `GET /api/health`
  que verifique su conexión a Postgres, para validar el stack completo de un vistazo.
- **US4 (P1)** — Como *agente IA / desarrollador futuro*, quiero specs+docs+ADRs commiteados,
  para reanudar el trabajo tras cualquier reinicio sin perder contexto.
- **US5 (P2)** — Como *desarrollador*, quiero packages compartidos (`shared`, `config`,
  `database`, `content`, `ui`) con `workspace:*`, para evitar duplicación desde el inicio.
- **US6 (P2)** — Como *mantenedor*, quiero CI (lint+typecheck+test+build) en GitHub Actions,
  para que nada se rompa en silencio.
- **US7 (P3)** — Como *desarrollador*, quiero la plantilla de labs (`labs/_template/`) con red
  aislada y `.env` de flags, para que la fase 007 tenga patrón definido.

## 3. Requisitos funcionales

1. `pnpm install && pnpm build` en verde desde raíz (turbo orquesta el grafo).
2. Web: Next.js 16 App Router, `next-intl` con locales `es` (default) y `en`, landing bilingüe
   con selector de idioma y página que muestra el estado de la API (usa `NEXT_PUBLIC_API_URL`).
3. API: NestJS 12, prefix global `/api`, `GET /api/health` → `{ status: 'ok', db: 'up'|'down' }`,
   CORS configurable por `CORS_ORIGINS`, validación Zod en un pipe global, rate-limit básico.
4. `packages/database`: schema Prisma 7 con modelo `User` mínimo (placeholder de F1) + cliente
   exportado; migración inicial aplicada por el stack dev.
5. `packages/shared`: constantes de gamificación (tabla XP por tipo de pregunta, 21 niveles con
   umbrales, dificultades) + tipos base `Path/Module/Room/Task/Question` (versión 1, evolucionan en F2).
6. Stack dev (`infra/stacks/dev/compose.yaml`): postgres 18 + mailpit + api + web con
   hot-reload; perfil `infra` para levantar solo postgres+mailpit; redes separadas
   `dev_backend` (api+db) y `dev_frontend` (web+api); `.env` propio no commiteado.
7. CI GitHub Actions: matrix node 22, pasos lint/typecheck/test/build con pnpm cache.
8. `.env.example` raíz documenta todas las variables del monorepo.

## 4. Criterios de éxito (verificables)

- [x] `docker compose -f infra/stacks/dev/compose.yaml up -d` deja web en :3000 (ES/EN navegables), api en :3001 (`/api/health` → `db: up`), mailpit en :8025. *(verificado 2026-11-01: health `db: up` 20ms, /es /en 200, redirect / → /es, mailpit 200)*
- [x] El mismo resultado con la variante host: perfil `infra` + `pnpm dev`. *(variante: `up -d postgres mailpit`; migración+seed ejecutados desde host contra el postgres del stack)*
- [x] `pnpm lint && pnpm typecheck && pnpm build` verdes en raíz. *(7/7 lint, 8/8 typecheck, 4/4 build, 16 tests ✓)*
- [x] Un test de humo en la API (Vitest) valida `/api/health`. *(HealthService unit tests)*
- [x] Git history con commits atómicos por tarea referenciando ids de `tasks.md`.
- [x] `specs/`, `docs/`, `AGENTS.md` commiteados y consistentes con lo implementado.

## 5. Fuera de alcance

Auth real (F1), contenido MDX real (F2), UI de rooms (F3), gamificación aplicada (F5),
labs reales (F7), stack producción (F8).

## 6. Supuestos

- Docker Desktop disponible en la máquina dev (verificado: Docker 29 + Compose v5).
- Node 24 y pnpm 11 en host (verificado). En contenedores: Node 22 LTS.
- TypeScript se fija en 5.9.x (la 7.x nativa aún no es segura para decorators de Nest — ADR-002).
