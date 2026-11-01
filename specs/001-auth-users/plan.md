# Plan 001 — Auth & Users

- **Espec:** [spec.md](./spec.md)
- **Creado:** 2026-11-01

## 1. Versiones y docs verificadas (2026-11-01)

| Pieza | Versión | Fuente |
|---|---|---|
| better-auth | 1.7.15 (api y web) | npm |
| prismaAdapter | `better-auth/adapters/prisma` + `{ provider: 'postgresql' }` | docs oficiales adapter |
| Nest mount | `bodyParser: false` requerido; mount catch-all `/api/auth` | docs integración Nest (lib comunitaria como referencia; **lo montamos manual**, sin dependencia extra) |
| nodemailer / @types | 10.3.1 / 8.0.2 | npm |

## 2. Decisiones (ADR)

- **ADR-007**: Better Auth manual en `apps/api` (sin `@thallesp/nestjs-better-auth`),
  catch-all con `toNodeListener`; body parser de Express desactivado SOLO en `/api/auth`
  (middleware condicional), JSON intacto para el resto de rutas. Rol propio
  `STUDENT|ADMIN` como additionalField + guards Nest propios (no plugin admin de
  better-auth: menos superficie, control total; se puede migrar después).
- **ADR-008**: el navegador solo habla con la web. Next `rewrites` `/api/:path*` →
  `API_URL` (server-side, default `http://localhost:3001`). Cookies same-origin en dev,
  sin CORS cross-port; en prod Caddy ya unifica dominio. Los fetches del cliente pasan a
  rutas relativas.

## 3. Estructura nueva

```
apps/api/src/auth/
├── auth.module.ts        (global: exporta auth instance + guards)
├── auth.ts               (betterAuth(): prisma adapter, emailAndPassword, role,
│                          databaseHooks first-user-admin, trustedOrigins, emails)
├── auth.controller.ts    (@All('*path') catch-all → toNodeListener(auth.handler))
├── email.service.ts      (nodemailer SMTP; plantillas mínimas texto/HTML)
├── session.guard.ts      (auth.api.getSession({headers}); 401 si no sesión)
├── roles.guard.ts + roles.decorator.ts (@Roles('ADMIN'))
└── current-user.decorator.ts
apps/api/src/users/
├── users.module.ts · users.controller.ts · users.service.ts (+ spec tests)
apps/web/
├── lib/auth-client.ts    (createAuthClient de better-auth/react, baseURL '/api/auth')
├── app/[locale]/login/page.tsx        (sign in/up con useSession)
├── app/[locale]/dashboard/page.tsx    (protegida; panel admin lista usuarios)
├── components/user-menu.tsx           (header: sesión/entrar/salir)
packages/database/prisma/migrations/0002_*/migration.sql
```

## 4. Estrategia del schema Prisma

1. Intentar CLI: `pnpm dlx @better-auth/cli@latest generate -c apps/api/src/auth/auth.ts
   -o packages/database/prisma/schema-auth.prisma` y fusionar.
2. Fallback (esperado): escribir a mano las tablas core (User extendida con role,
   Session, Account, Verification con `@@unique([providerId, accountId])`,
   `token @unique`, onDelete Cascade) según la doc core-schema de 1.7.
3. Migración: `prisma migrate dev --name auth` contra el postgres del stack dev
   (usuario superuser ⇒ shadow DB ok); el SQL queda versionado en `prisma/migrations`.

## 5. Verificación

1. `pnpm build/lint/typecheck/test` verdes.
2. Stack dev arriba (postgres) + api/web: E2E curl con cookie jar (sign-up, me, sign-out,
   segundo usuario STUDENT, PATCH role como admin, auto-degradación 400).
3. `REQUIRE_EMAIL_VERIFICATION=true` → sign-up genera email visible en Mailpit (:8025).
4. Navegación `/es/login`, `/es/dashboard` bilingüe (verificación con curl del HTML).

## 6. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| CLI de better-auth no resuelve la config TS del monorepo | Schema a mano (doc core) + verificación con migrate diff |
| Body crudo: mejor-auth no lee el body si express lo consumió | Middleware condicional: json() solo fuera de `/api/auth` |
| `toNodeListener` con Express 5 (platform-express 12) | E2E curl en el smoke test lo valida de inmediato |
| Cookies Secure/SameSite en localhost | Rewrite las hace same-origin (ADR-008); sin config especial |
| Primer-usuario-ADMIN con carrera de registros simultáneos | Aceptado (escala personal); hook transaccional best-effort documentado |
