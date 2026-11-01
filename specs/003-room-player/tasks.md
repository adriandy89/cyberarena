# Tasks 003 — Room Player

> Commit atómico por tarea (`T0NN`).

## Fase A — Datos

- [x] T001 [P] specs/003 + ADR-011 + verificación de versiones (react-markdown 10.1.0, remark-gfm 4.0.1).
- [x] T002 [US4] Modelos `QuestionSolved` + `XpEvent` (unique por razón) + migración `0004_progress`.

## Fase B — API

- [x] T003 [US2,US4] RoomsModule: `POST /rooms/:slug/answers` (hash, XP idempotente por
      constraint, bonus de completación) + tests unitarios con casos de carrera.
- [x] T004 [US5,US6,US7] `GET /rooms/:slug/progress`, `GET /users/me/xp` (nivel vía
      @repo/shared) y rooms resumidos en `GET /api/catalog` + tests.

## Fase C — Web

- [x] T005 [US1..US5] `/[locale]/rooms/[slug]`: server fetch + markdown render
      (react-markdown) + `RoomPlayer` cliente (steps, preguntas por tipo, hints,
      feedback XP, completación).
- [x] T006 [US7] `/paths` lista rooms con link + mensajes es/en de todo el player.

## Fase D — Cierre

- [x] T007 [US1..US7] Verificación completa + E2E curl (room resuelto → XP 80,
      idempotencia, 404s) + cierre de spec + ROADMAP + commit final.

## Bugs/Deuda

- Ninguno
