# Tasks 001 — Auth & Users

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit.

## Fase A — Specs y datos

^- [x] T001 [P] [US0] `specs/001-auth-users/*` completa + ADR-007/008.
^- [x] T002 [P] [US1] Schema Prisma: better-auth core tables + `role` en User; migración
      0002 aplicada y versionada; `@repo/database` re-exporta tipos.

## Fase B — API

^- [x] T003 [US1,US5,US6] `apps/api`: better-auth instance (prisma adapter, additionalField
      role, first-user-admin hook, trustedOrigins, callbacks email), EmailService
      (nodemailer), AuthController catch-all con body cruto, main.ts con body parser
      condicional.
^- [x] T004 [US2,US3] Guards (Session/Roles) + decorators; UsersModule: `GET /users/me`,
      `GET /users` (ADMIN), `PATCH /users/:id/role` (ADMIN, no auto-degradarse); tests.

## Fase C — Web

^- [x] T005 [US6] `lib/auth-client.ts`, Next rewrites `/api`, `/status` a fetch relativo,
      types del auth client (`InferSessionUser`).
^- [x] T006 [US2,US7] Páginas `/login` (sign in/up, errores i18n) y `/dashboard` (protección
      cliente, `/users/me`, panel admin usuarios/roles), `UserMenu` en header, mensajes es/en.

## Fase D — Docs y cierre

^- [x] T007 [P] [US5] `.env.example` (SMTP, REQUIRE_EMAIL_VERIFICATION, API_URL), runbook
      (Mailpit, flujo verificación/reset), README nota de auth.
^- [x] T008 [US1..US4] Verificación completa: build/lint/typecheck/test + E2E curl
      (registro→me→logout→roles) + Mailpit con verificación activada; changelog + ROADMAP.

## Bugs/Deuda

- Ninguno
