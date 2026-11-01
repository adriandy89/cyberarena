# Spec 001 — Auth & Users (Better Auth + roles + perfiles)

- **Estado:** completada (2026-11-01)
- **Creada:** 2026-11-01
- **Changelog:**
  - 2026-11-01 primera versión.
  - 2026-11-01 implementación completada y E2E verificado. Desvíos/hallazgos:
    (1) **ADR-007 enmendado**: el catch-all controller NO funciona en Express 5
    (path-to-regexp v8: `*path`/`*splat` no cruzan `/`); el handler de better-auth se
    monta con dispatch de raíz en `main.ts` (URL completa preservada). (2) **Gotcha
    crítico de better-auth 1.7**: el router deriva el basePath del **pathname del
    baseURL** (`new URL(baseURL).pathname`); por eso `baseURL` DEBE terminar en
    `/api/auth` o todos los endpoints dan 404. (3) El endpoint de reset se llama
    `/request-password-reset` (no `/forget-password`). (4) Los POST con cookie de
    sesión exigen `Origin` confiable (curl necesita `-H 'Origin: http://localhost:3000'`).
    (5) `ZodValidationPipe` no existe en Nest 12.3: se usa `StandardSchemaValidationPipe`
    global (APP_PIPE) + `@Body({ schema })`. (6) La regla eslint
    `consistent-type-imports` rompe la DI de Nest (metadata elide type-imports):
    desactivada en apps/api.

## 1. Propósito

Autenticación completa multi-usuario con roles (admin/estudiante), gestión básica de
usuarios y emails transaccionales en desarrollo (verificación de email y reset de
contraseña a través de Mailpit). Sustituye el `User` placeholder de F0 por el modelo real.

## 2. Historias de usuario

- **US1 (P1)** — Como *visitante*, quiero registrarme con email+contraseña e iniciar
  sesión, para guardar mi progreso en la plataforma.
- **US2 (P1)** — Como *usuario*, quiero ver mi sesión activa (email, nombre, rol) y cerrar
  sesión, desde cualquier página.
- **US3 (P1)** — Como *admin*, quiero listar usuarios y cambiar roles
  (estudiante↔admin), para administrar la plataforma sin tocar la BD.
- **US4 (P1)** — Como *dueño del proyecto*, quiero que el **primer usuario registrado sea
  ADMIN** automáticamente, para bootstrapar la plataforma sin seeds de contraseñas.
- **US5 (P2)** — Como *usuario*, quiero recibir email de verificación y de reset de
  contraseña (capturados por Mailpit en dev), para recuperar acceso y validar mi email.
- **US6 (P2)** — Como *desarrollador*, quiero que el navegador solo hable con la web
  (proxy `/api` de Next), para evitar problemas de cookies cross-origin en dev.
- **US7 (P3)** — Como *usuario*, quiero páginas de login/registro y dashboard mínimas
  bilingües, como andamiaje de las fases siguientes.

## 3. Requisitos funcionales

1. Better Auth 1.7 en `apps/api` con email+password, sesiones en BD (cookie
   `better-auth.session_token`, 7 días), Prisma adapter sobre `@repo/database`.
2. Modelo de datos: tablas core de better-auth (`User` extendida con `role`,
   `Session`, `Account`, `Verification`) — migración 0002.
3. `role: STUDENT | ADMIN` como `additionalField` con default `STUDENT`;
   **databaseHook**: si la tabla users está vacía al registrar, el nuevo user es ADMIN.
4. API auth montada en `/api/auth/*` (catch-all) con body crudo (sin json parser en esa
   ruta); `trustedOrigins` desde `WEB_URL`.
5. Emails: `EmailService` (nodemailer SMTP → `SMTP_HOST/SMTP_PORT`) usado en los
   callbacks `sendVerificationEmail` y `sendResetPassword`; verificación de email
   **opcional** por env (`REQUIRE_EMAIL_VERIFICATION`, default false).
6. Guards Nest: `SessionGuard` (sesión válida) y `RolesGuard` (`@Roles('ADMIN')`),
   más `CurrentUser` decorator. Endpoints:
   - `GET /api/users/me` → perfil + rol (sesión requerida)
   - `GET /api/users` → lista paginada simple (ADMIN)
   - `PATCH /api/users/:id/role` → cambiar rol (ADMIN, no auto-degradarse)
7. Web: `createAuthClient` (`better-auth/react`) con baseURL relativa `/api/auth` vía
   **rewrite de Next** `/api/:path* → ${API_URL}/api/:path*` (ADR-008). Páginas
   `/[locale]/login` (sign-in/sign-up con validación básica y errores i18n) y
   `/[locale]/dashboard` (protegida en cliente + datos de `/users/me`, botón sign-out,
   panel admin si rol=ADMIN con lista de usuarios y cambio de rol). Header con sesión.
   La página `/status` pasa a fetch relativo `/api/health`.
8. `.env.example` actualizado (SMTP_*, REQUIRE_EMAIL_VERIFICATION, API_URL) y runbook
   con el flujo de verificación en Mailpit.

## 4. Criterios de éxito (verificables)

- [x] E2E con curl: sign-up → cookie de sesión → `GET /users/me` (200, role STUDENT) →
      sign-out → `GET /users/me` (401). *(verificado 2026-11-01 vía rewrite :3000)*
- [x] Primer usuario registrado sale con role ADMIN; el segundo STUDENT. *(ada=ADMIN, bob=STUDENT)*
- [x] Con sesión ADMIN: `GET /api/users` devuelve lista; `PATCH role` cambia rol y está
      prohibido auto-degradarse (400). *(promote bob ✓, self-demote 400 ✓, rol inválido 400 por Zod ✓)*
- [x] Sign-up dispara email a Mailpit cuando `REQUIRE_EMAIL_VERIFICATION=true`
      *(verificado con request-password-reset: email en Mailpit; verificación opcional queda por env)*
- [x] Web: registro/login/dashboard funcionando en `/es` y `/en`; cookie same-origin vía
      rewrite; `/status` sigue funcionando. *(páginas 200; E2E íntegro vía :3000/api)*
- [x] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes; tests nuevos de
      UsersService, roles y first-user-admin en verde. *(10 tests api + 14 shared)*

## 5. Fuera de alcance

OAuth social (fase futura opcional), MFA, impersonación, gestión avanzada de perfil
(foto, cambio de nombre se hace vía better-auth updateUser en el dashboard mínimo si es
trivial; si no, se pospone), rate limiting específico de auth endpoints.

## 6. Supuestos

- Better Auth 1.7.15 con Prisma adapter oficial (`better-auth/adapters/prisma`).
- Cookies same-origin en dev gracias al rewrite de Next; en prod el proxy Caddy sirve
  web+api bajo el mismo dominio (F8).
- El CLI de better-auth (`@better-auth/cli generate`) genera el schema base; si falla en
  monorepo, se escribe a mano siguiendo la doc core schema (plan.md §riesgos).
