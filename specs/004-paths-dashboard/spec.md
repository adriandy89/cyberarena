# Spec 004 — Paths & Dashboard (progreso visible)

- **Estado:** completada (2026-11-01)
- **Creada:** 2026-11-01
- **Changelog:**
  - 2026-11-01 primera versión.
  - 2026-11-01 implementación completada y E2E verificado. Notas: (1) La tarjeta XP del
    dashboard es client-rendered: sus DATOS se verificaron por curl (`/users/me/xp`,
    `/progress/overview`) y la página como 200+estructura — no por grep del HTML. (2) El
    link de /paths al detalle existe en el payload RSC (el href exacto no aparece como
    atributo HTML plano por la serialización de next-intl). (3) Recaída del footgun
    `import type PrismaService` en ProgressService (valor import obligatorio en Nest DI);
    y de nuevo un proceso zombi en :3000 falseó 404s — protocolo de matar por PID
    reforzado en memoria.

## 1. Propósito

Hacer visible el progreso: página de cada path con % por room/módulo/path y dashboard
personal con nivel, XP y avance por rutas.

## 2. Historias de usuario

- **US1 (P1)** — Como *estudiante*, abro `/[locale]/paths/[slug]` y veo la estructura
  módulos→rooms con % de preguntas resueltas por room, % por módulo y % global, con
  enlaces a cada room.
- **US2 (P1)** — Como *estudiante*, mi `/[locale]/dashboard` muestra tarjeta de
  nivel/XP (nombre de nivel, barra hacia el siguiente, total XP, preguntas resueltas)
  y el avance por path con acceso directo.
- **US3 (P2)** — Como *visitante sin sesión*, la página del path se ve completa con
  progreso vacío e invitación a entrar.
- **US4 (P2)** — Como *sistema*, el progreso se deriva de `QuestionSolved` en lectura
  (ADR-012): sin contadores desnormalizados.

## 3. Requisitos funcionales

1. `GET /api/progress/overview` (sesión): por cada path `{slug, title, level,
   roomsCompleted, roomsTotal, solvedQuestions, totalQuestions, percent}` + totales
   globales.
2. `GET /api/progress/paths/:slug` (sesión): por room `{slug, solved, total, percent,
   completed}`, por módulo `{slug, percent}` y `%` global del path. 404 si el path no
   existe.
3. Web `/[locale]/paths/[slug]`: server fetch del árbol público (`/api/catalog/paths/:slug`)
   + cliente `PathProgress` que consulta `/progress/paths/:slug` (401 → modo visitante
   con ceros y CTA login). Barras y estados: completado ✓ / en curso / sin empezar.
4. Dashboard: tarjeta XP (nivel, barra a siguiente, XP total, resueltas) desde
   `/users/me/xp` + lista de paths con % desde `/progress/overview`; se conserva el
   panel admin de usuarios.
5. `/paths`卡片 enlaza a la página del path (ya lista rooms → room player).

## 4. Criterios de éxito (verificables)

- [x] Con la sesión admin (room resuelto en fase 003): `/progress/overview` →
      cs101 `roomsCompleted 1/1, percent 100`; `/progress/paths/cyber-security-101` →
      room 100%, módulo 100%, path 100%. *(verificado: 6/6 preguntas, completed:true)*
- [x] Dashboard muestra NEOPHYTE, 80 XP, barra 40% y cs101 100% (curl del HTML).
      *(datos verificados vía /users/me/xp y /progress/overview; página 200 — tarjeta
      client-rendered, ver changelog)*
- [x] Visitante: `/es/paths/cyber-security-101` renderiza estructura con 0% y CTA.
      *("Inicia sesión para guardar…", módulo y room visibles; EN: "Sign in to save…")*
- [x] `pnpm lint && typecheck && test && build` verdes. *(37 tests api incl. 5 nuevos
      de progreso derivado)*

## 5. Fuera de alcance

Streaks/badges (005), filtros hacktivities (006), labs (007).

## 6. Supuestos

- `% room = preguntas resueltas / total` (coincide con lo que otorga XP); un room sin
  preguntas cuenta como no completado.
