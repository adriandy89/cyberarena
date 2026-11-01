# ADR-005 — Datos: PostgreSQL 18 + Prisma 7.10

- **Estado:** aceptada (2026-11-01, fase 000)
- **Contexto:** el dato central (catálogo de contenido + progreso + gamificación) es
  relacional y se consulta desde la API. Necesitamos migraciones versionadas, seed desde
  content-as-code y buena DX para explorar datos.
- **Alternativas:** Drizzle (más ligero, SQL-first, cold-start mínimo — su brillo es edge,
  que no es nuestro caso); Mongo (modelo relacional encaja mejor); SQLite (multiple
  writers/entorno multiusuario con Docker).
- **Decisión:** PostgreSQL 18 + Prisma **7.10.1** (estable). OJO: `prisma@latest` en npm
  apunta a `8.0.0-rc.x`; se fija 7.10.1 explícitamente (constitución §2.1). Cliente
  generado en `packages/database/generated` (no commiteado), exportado como singleton.
- **Consecuencias:** paso `db:generate` obligatorio tras editar schema (automatizado en
  `postinstall` de database y en dependencias de turbo); Prisma Studio disponible para
  depurar (`pnpm db:studio`).
