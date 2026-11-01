# ADR-007 — Better Auth montado manualmente en NestJS + roles propios

- **Estado:** aceptada (2026-11-01, fase 001; **enmendada el mismo día**, ver abajo)
- **Contexto:** Better Auth no tiene integración oficial de NestJS; existe la lib
  comunitaria `@thallesp/nestjs-better-auth` (beta, patrón AuthModule.forRoot + body
  parser global desactivado). Better Auth exige leer el body crudo. Necesitamos roles
  STUDENT/ADMIN propios, no el plugin admin completo de better-auth.
- **Decisión:** integración **manual**: instancia `betterAuth()` en `apps/api/src/auth/auth.ts`
  (Prisma adapter), catch-all `@Controller('auth')` → `toNodeListener(auth.handler)`, y en
  `main.ts` middleware condicional que aplica `express.json()` SOLO fuera de `/api/auth`
  (requisito del body crudo aislado a la ruta de auth, el resto de la API conserva JSON).
  Rol `STUDENT|ADMIN` como `additionalField` + `SessionGuard`/`RolesGuard` Nest propios +
  bootstrap del primer usuario como ADMIN vía `databaseHooks.user.create.before`.
- **ENMIENDA (2026-11-01, tras E2E):** el catch-all controller NO funciona con
  Express 5 (path-to-regexp v8: los wildcards `*path`/`*splat` no cruzan `/`). El handler
  se monta con **dispatch de raíz en `main.ts`** (`req.url.startsWith('/api/auth')` →
  `toNodeHandler(auth)`, URL completa preservada) + `express.json()` para el resto.
  Además, better-auth 1.7 **deriva el basePath del pathname del `baseURL`**
  (`new URL(baseURL).pathname` en `dist/auth/base.mjs`): el `baseURL` de la instancia
  DEBE terminar en `/api/auth` (si termina en `/api`, todos los endpoints responden 404).
  Y los POST con cookie requieren `Origin` confiable (testing con curl:
  `-H 'Origin: http://localhost:3000'`).
- **Alternativas descartadas:** lib comunitaria (dependencia beta para algo que son ~30
  líneas propias); plugin `admin` de better-auth (trae bans/impersonación/permisos que no
  necesitamos en v1; migrable más adelante sin cambios de schema salvo tablas nuevas).
- **Consecuencias:** control total y cero dependencias extra; mantenemos el coste de
  seguir los breaking changes de better-auth en el mount (mitigado: E2E curl del smoke
  test valida el flujo completo en cada fase).
