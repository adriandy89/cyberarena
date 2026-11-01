# Tasks 002 — Content Engine

> Commit atómico por tarea (`T0NN`).

## Fase A — Especificación

- [x] T001 [P] `specs/002-content-engine/*` + ADR-010 (pipeline propio).

## Fase B — Contenido y pipeline

- [x] T002 [US1] `packages/content`: schemas Zod + builder tsx (validación estricta) +
      deps (gray-matter, yaml, fast-glob) + tests unitarios de schemas/validaciones.
- [x] T003 [US1] Contenido muestra: path CS101 + módulo + room `intro-ciberseguridad-ofensiva`
      (≥3 tasks, ≥5 preguntas flag/text/choice) + `private/answers`.
- [x] T004 [US5] Validación negativa: builder rompe con contenido inválido (caso de prueba
      documentado en el guide) + CI nota.

## Fase C — Datos y API

- [x] T005 [US2] Modelos Prisma del catálogo + `Answer` + migración `0003_catalog`.
- [x] T006 [US2] Seed: sync catalog.json→BD (upserts, hash sha256, limpieza) + tests del
      hashing/normalización.
- [x] T007 [US3] CatalogModule API (`/api/catalog`, `/paths/:slug`, `/rooms/:slug`) sin
      respuestas + tests.

## Fase D — Web y cierre

- [x] T008 [US4] Página `/[locale]/paths` desde la API + link en landing + mensajes.
- [x] T009 [P] `docs/content-guide.md` final (formato, reglas, ejemplo) + runbook seed.
- [ ] T010 [US1..US5] Verificación completa (criterios de éxito), changelog, ROADMAP.

## Bugs/Deuda

- Ninguno. La validación negativa (T004) quedó cubierta por unit tests + fallos YAML reales documentados en el guide.
