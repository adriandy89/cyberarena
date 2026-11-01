# ADR-007 — Better Auth montado manualmente en NestJS + roles propios

- **Estado:** aceptada (2026-11-01, fase 001)
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
- **Alternativas descartadas:** lib comunitaria (dependencia beta para algo que son ~30
  líneas propias); plugin `admin` de better-auth (trae bans/impersonación/permisos que no
  necesitamos en v1; migrable más adelante sin cambios de schema salvo tablas nuevas).
- **Consecuencias:** control total y cero dependencias extra; mantenemos el coste de
  seguir los breaking changes de better-auth en el mount (mitigado: E2E curl del smoke
  test valida el flujo completo en cada fase).
