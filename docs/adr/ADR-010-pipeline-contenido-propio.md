# ADR-010 — Pipeline de contenido propio (gray-matter + Zod → catalog.json)

- **Estado:** aceptada (2026-11-01, fase 002)
- **Contexto:** el contenido (paths/modules/rooms/tasks/preguntas) es código versionado en
  `packages/content`. Debe validarse en build (room inválido rompe CI) y sincronizarse a
  PostgreSQL para progreso/consultas. Se había previsto Content Collections.
- **Decisión:** builder propio en TypeScript (`packages/content/scripts/build.ts`, ejecutado
  con tsx): lee **JSON** de paths/modules y **MDX** de rooms/tasks con `gray-matter`,
  valida TODO con schemas **Zod** (los mismos principios del contrato en @repo/shared) y
  emite `packages/content/dist/catalog.json` (contenido + cuerpos MDX como strings). El
  seed de la BD consume ese JSON. Las respuestas viven en `private/answers/*.yaml` y
  NUNCA entran al catalog.json consumible por la web — las consume el seed para
  hashearlas (sha256 de la respuesta normalizada) a la tabla `Answer`.
- **Alternativas descartadas:** Content Collections (excelente para builds web, pero su
  output/tipado ESM-only complica el consumo desde Nest CJS y el seed — el riesgo
  probado en esta fase 001 con ESM/CJS aconseja minimizar tooling fronterizo);
  parsear MDX en runtime (sin validación centralizada); contenido solo en BD (sin
  versionado ni revisión en PRs).
- **Consecuencias:** un generador pequeño y auditable (~200 líneas) con validación
  estricta (slugs referenciados existen, cada pregunta tiene respuesta, flags con formato,
  ids estables); CI valida contenido sin BD. La renderización de MDX en la web se
  resuelve en la fase 003 leyendo los cuerpos del catálogo.
