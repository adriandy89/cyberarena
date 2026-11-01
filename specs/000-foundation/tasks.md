# Tasks 000 — Foundation

> Checklist ejecutable. Commit atómico por tarea. Marca `[x]` en el mismo commit.
> Convención: `T0NN [P] [USn] descripción` — [P] = paralelizable, [USn] = historia de usuario.

## Fase A — Andamiaje SDD y raíz

- [x] T001 [P] [US4] Repositorio git (rama `main`), `.gitignore`, `.editorconfig`, `.dockerignore`, `README.md`.
- [x] T002 [P] [US4] `specs/constitution.md`, `specs/ROADMAP.md`, `AGENTS.md`, `docs/` base y ADR-001..006.
- [x] T003 [P] [US1] Raíz monorepo: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.env.example`.

## Fase B — Packages base

- [x] T004 [P] [US5] `packages/config`: `tsconfig.base.json` (TS 5.9) + `eslint.config.base` + `prettier` config.
- [x] T005 [P] [US5] `packages/shared`: constantes gamificación (XP por tipo, 21 niveles, dificultades, tipos de flag) + tipos v1 Path/Module/Room/Task/Question + tests Vitest.
- [x] T006 [P] [US5] `packages/database`: Prisma 7.10.1, schema con `User` placeholder, cliente exportado con singleton, migración inicial.
- [x] T007 [P] [US5] `packages/content` esqueleto: `content-collections.ts` vacío documentado (F2 lo llena).
- [x] T008 [P] [US5] `packages/ui` esqueleto: `DifficultyBadge` + export barrel (Tailwind-ready).

## Fase C — Aplicaciones

- [x] T009 [P] [US3] `apps/api`: Nest 12 (prefix `/api`, ZodValidationPipe global, Throttler, CORS por `CORS_ORIGINS`), `HealthController` con check de Postgres, test Vitest.
- [x] T010 [P] [US2] `apps/web`: Next 16 + next-intl (`es` default, `en`), Tailwind 4, landing bilingüe con selector y estado de API (`/status`).

## Fase D — Infra y CI

- [x] T011 [P] [US1] `infra/stacks/dev/compose.yaml`: postgres 18 + mailpit + api + web (hot-reload, volúmenes), perfil `infra`, redes `dev_backend`/`dev_frontend`, `.env.example` del stack.
- [x] T012 [P] [US7] `labs/_template/`: compose aislada + README + `flags.env.example`.
- [x] T013 [P] [US6] CI GitHub Actions (lint+typecheck+test+build, pnpm cache, node 22).
- [x] T014 [P] [US1] `infra/scripts/backup-db.sh` y `docs/runbook.md` operativo.

## Fase E — Verificación y cierre

- [x] T015 [US1..US3] `pnpm install` + lint + typecheck + test + build en verde; corregir incidencias.
- [x] T016 [US1] `docker compose up` del stack dev + smoke test (health `db: up`, `/es` y `/en` 200) documentado en runbook.
- [x] T017 [US4] Cierre: criterios de éxito del spec marcados, ROADMAP actualizado (F0 ✅), changelog.

## Bugs/Deuda (añadir aquí lo descubierto)

- [ ] T901 Estabilizar y documentar variantes de arranque dev (full-docker vs mixed) tras validar en Docker Desktop. — cubierto por T016/runbook; revalidar en F1.
