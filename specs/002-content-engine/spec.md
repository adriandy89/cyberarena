# Spec 002 — Content Engine (contenido como código)

- **Estado:** en implementación
- **Creada:** 2026-11-01
- **Changelog:** 2026-11-01 primera versión.

## 1. Propósito

Convertir `packages/content` en el motor de contenido: schemas validados en build, un
catálogo compilado a JSON, sincronización a PostgreSQL (respuestas hasheadas) y endpoints
de lectura para la web. Incluye el primer contenido real de muestra (CS101) para probar
el pipeline completo de punta a punta.

## 2. Historias de usuario

- **US1 (P1)** — Como *autor de contenido*, escribo rooms en MDX/JSON con validación
  inmediata (build roto si algo falta o contradice el schema), sin tocar la BD a mano.
- **US2 (P1)** — Como *sistema*, el catálogo se sincroniza a la BD con upserts por slug
  (idempotente) y las respuestas se guardan hasheadas, jamás en claro ni expuestas.
- **US3 (P1)** — Como *frontend*, consumo el catálogo vía API (`/api/catalog/*`) sin
  respuestas, listo para la fase 003 (room player).
- **US4 (P2)** — Como *visitante*, veo una página `/[locale]/paths` que lista las rutas
  del catálogo (prueba E2E del pipeline).
- **US5 (P2)** — Como *desarrollador*, CI valida el contenido sin base de datos.

## 3. Requisitos funcionales

1. **Schemas Zod** (`packages/content/src/schemas.ts`): Path (slug, title, description,
   level, moduleSlugs), Module (slug, title, description, roomSlugs), Room (frontmatter:
   slug, title, description, difficulty, type, estimatedMinutes, tags, lab?), Task
   (index, title, body), Question (id estable `<room>-tNN-qNN`, prompt, hint?, kind,
   options si choice). Importan `Difficulty`, `RoomType`, `FLAG_PATTERN` de `@repo/shared`.
2. **Builder** (`scripts/build.ts`, tsx): lee JSON+MDX (`gray-matter` + `fast-glob`),
   valida (incluye: rooms referenciadas existen, ids de pregunta únicos y con patrón,
   toda pregunta tiene respuesta en `private/answers/<room>.yaml`, flags con formato,
   sin respuestas huérfanas) y emite `dist/catalog.json` + `dist/answers.json` (este
   último gitignored y SOLO para el seed).
3. **Contenido de muestra**: path `cyber-security-101` con el módulo
   `start-your-cyber-journey` y el room `intro-ciberseguridad-ofensiva` (original, en
   español): ≥3 tasks con guía real y ≥5 preguntas (flag, text y choice).
4. **Modelos Prisma**: `CatalogPath`, `CatalogModule`, `Room`, `TaskT`, `Question`,
   `Answer{questionId, answerHash, kind}` — migración `0003_catalog` (Answer separada
   y nunca incluida en consultas públicas).
5. **Seed** (`pnpm db:seed`): catalog.json → upserts por slug/questionId (orden
   correcto), respuestas hasheadas con `sha256(normalizeAnswer(...))` (flags además
   lowercase — coherente con `isCorrectAnswer` de @repo/shared), borrado de filas del
   catálogo ausentes en el fuente (con log). Idempotente.
6. **API**: `GET /api/catalog` (paths con conteos), `GET /api/catalog/paths/:slug`
   (árbol módulos+rooms), `GET /api/catalog/rooms/:slug` (room completo con tasks,
   cuerpos y preguntas; SIN respuestas). Cache-Control público corto. Tests.
7. **Web**: página `/[locale]/paths` (server component) que lista las rutas desde la API
   y enlaza desde la landing. Mensajes es/en.
8. **Guía**: `docs/content-guide.md` actualizada al formato final con ejemplo completo.

## 4. Criterios de éxito (verificables)

- [ ] `pnpm --filter @repo/content build` valida y emite catalog.json; contenido
      inválido (probado con un caso) rompe el build con error claro.
- [ ] `pnpm db:seed` idempotente: segunda ejecución no duplica nada (slugs/ids estables).
- [ ] `GET /api/catalog` y `GET /api/catalog/rooms/intro-ciberseguridad-ofensiva`
      devuelven el catálogo SIN respuestas (grep de hash/answer vacío).
- [ ] `/es/paths` y `/en/paths` renderizan la ruta CS101 desde la API.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes.

## 5. Fuera de alcance

Render de MDX en la web y progreso del estudiante (fase 003), hacktivities con
filtros (fase 006), más contenido (fases 100+), búsqueda.

## 6. Supuestos

- gray-matter 4.0.3, yaml 2.9.1, fast-glob 3.3.3 (verificado 2026-11-01).
- Las respuestas hasheadas usan sha256 sin salt: el hash NO se expone por API, y la
  tabla Answer nunca se selecciona en consultas del catálogo (defensa por diseño).
