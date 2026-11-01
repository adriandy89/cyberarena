# Spec 006 — Hacktivities (catálogo de rooms con búsqueda y filtros)

- **Estado:** completada (2026-11-01)
- **Creada:** 2026-11-01
- **Changelog:**
  - 2026-11-01 primera versión.
  - 2026-11-01 implementación completada y E2E verificado. Notas: (1) filtros inválidos
    devuelven 400 (Zod en @Query({ schema })); (2) las completaciones se calculan en
    memoria (usuarios con TODAS las preguntas del room); (3) la búsqueda cubre título,
    descripción y tags (case-insensitive, acentos incluidos).

## 1. Propósito

El directorio navegable de rooms estilo TryHackMe: búsqueda de texto, filtros por
dificultad/tipo/tag, ordenación y tarjetas con contexto (path, tiempo, completaciones).

## 2. Historias de usuario

- **US1 (P1)** — Como *visitante*, busco rooms por texto (título, descripción o tags).
- **US2 (P1)** — Como *visitante*, filtro por dificultad (info…insane), tipo
  (walkthrough/challenge/capstone) y tag.
- **US3 (P1)** — Como *visitante*, ordeno por popularidad (usuarios que lo completaron),
  más nuevos, A→Z, Z→A o duración.
- **US4 (P2)** — Como *visitante*, cada tarjeta me da contexto y enlace al room.
- **US5 (P2)** — Como *sistema*, el endpoint es público, cacheable y con facetas
  (tags/dificultades disponibles) para pintar los filtros.

## 3. Requisitos funcionales

1. `GET /api/hacktivities?q&difficulty&type&tag&sort&take&skip` (público):
   - `q`: match case-insensitive en title/description/tags.
   - `difficulty|type|tag`: filtros exactos (validados con Zod, valores inválidos → 400).
   - `sort`: `popular` (completaciones desc, default) | `newest` (createdAt desc) |
     `az` | `za` | `time` (estimatedMinutes asc).
   - `take` ≤50 (default 24), `skip` ≥0.
   - Respuesta: `{ total, rooms: [{slug,title,description,difficulty,type,
     estimatedMinutes,tags,lab,completions,pathSlug,pathTitle}], facets: {tags,
     difficulties, types} }`. Completaciones = nº de usuarios con TODAS las preguntas
     del room resueltas (agregación en memoria, espíritu ADR-012).
2. Migración `0006_room_created`: `Room.createdAt DateTime @default(now())` (para
   `newest`).
3. Web `/[locale]/hacktivities`: client con búsqueda (debounce 300ms), pills de
   dificultad/tipo, selector de tag y orden, grid de tarjetas (DifficultyBadge de
   @repo/ui, badge de tipo, ⏱ minutos, tags, 👥 completados), link al room, estados
   vacíos, paginación simple (cargar más). Link "Hacktivities" en el header.
4. Mensajes es/en.

## 4. Criterios de éxito (verificables)

- [x] E2E: `?q=pentester` → 1 room (título del room lo contiene); `?q=zzz` → 0;
      `?difficulty=insane` → 0; `?difficulty=info` → 1; `?sort=az` → ordenado;
      `completions=1` (admin); `?type=challenge` → 0 (válido sin resultados);
      `?difficulty=xxx` → 400. *(verificado; "pentester" matchea por descripción)*
- [x] `/es/hacktivities` renderiza búsqueda, filtros y tarjeta con link (curl).
      *(200 + "Hacktivities/Dificultad/Populares")*
- [x] `pnpm lint && typecheck && test && build` verdes. *(47 tests api incl. 6 nuevos)*

## 5. Fuera de alcance

Free/premium, ratings con estrellas, paginación por cursor, SSR del filtro.

## 6. Supuestos

- Con <100 rooms, filtrar/ordenar en memoria tras una consulta del catálogo completo es
  correcto y mantiene el código simple (revisar con content packs grandes).
