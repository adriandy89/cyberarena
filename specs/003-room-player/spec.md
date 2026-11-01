# Spec 003 — Room Player (jugabilidad, progreso y XP)

- **Estado:** en implementación
- **Creada:** 2026-11-01
- **Changelog:** 2026-11-01 primera versión.

## 1. Propósito

El corazón del producto: la página de room con navegación de tasks, guías renderizadas,
preguntas interactivas con verificación server-side, hints, registro de progreso y
otorgamiento de XP.

## 2. Historias de usuario

- **US1 (P1)** — Como *estudiante*, abro un room y navego sus tasks (pasos numerados)
  con la guía renderizada y las preguntas al final de cada task.
- **US2 (P1)** — Como *estudiante*, envío respuestas (flag/text/choice) y recibo
  feedback inmediato (correcta/incorrecta); al acertar veo el XP ganado y la pregunta
  queda marcada como resuelta.
- **US3 (P1)** — Como *estudiante*, puedo desplegar el hint de una pregunta.
- **US4 (P1)** — Como *sistema*, cada primera respuesta correcta otorga XP según el tipo
  de room (walkthrough/challenge/capstone) y la completación del room otorga un bonus,
  **exactamente una vez por usuario** (constraint en BD).
- **US5 (P2)** — Como *estudiante*, al volver a un room veo mi progreso persistido
  (preguntas resueltas y completación).
- **US6 (P2)** — Como *estudiante*, consulto mi XP/nivel actuales (endpoint para el
  dashboard de la fase 004).
- **US7 (P2)** — Como *visitante*, desde `/paths` puedo entrar a los rooms publicados.

## 3. Requisitos funcionales

1. **Modelos**: `QuestionSolved(userId, questionId, solvedAt)` PK compuesta;
   `XpEvent(id, userId, amount, reason, createdAt)` con `@@unique([userId, reason])`
   (razones `question:<id>`, `room-complete:<slug>`) e índice por usuario — migración
   `0004_progress`.
2. **API** (todas con SessionGuard):
   - `POST /api/rooms/:slug/answers` body `{questionId, answer}` →
     `{correct, alreadySolved, xpAwarded, roomCompleted}`. Validación Zod. 404 si la
     pregunta no pertenece al room. Comparación por hash (ADR-011). Sin límite de
     intentos en esta fase (throttler global vigila).
   - `GET /api/rooms/:slug/progress` → `{solvedQuestionIds, roomCompleted}`.
   - `GET /api/users/me/xp` → `{totalXp, solvedCount, level{index,name,progressRatio,xpToNextLevel}}`
     (nivel calculado con `getLevelForXp` de @repo/shared).
3. **Catálogo**: `GET /api/catalog` incluye por path sus rooms (slug, title, difficulty,
   type, estimatedMinutes) para enlazar desde `/paths`.
4. **Web**: `/[locale]/rooms/[slug]` — Server Component que obtiene el room de la API,
   renderiza las guías con react-markdown (ADR-011) y monta el `RoomPlayer` cliente:
   steps numerados (Task N/M con anterior/siguiente), preguntas por tipo con input/radio,
   hint plegable, feedback y XP al acertar, aviso de room completado (bonus). Progreso
   inicial cargado por fetch same-origin. `/paths` lista los rooms con link.
5. Los mensajes de UI en es/en; el contenido ya es bilingüe por diseño (es primero).

## 4. Criterios de éxito (verificables)

- [ ] E2E curl con sesión: resolver las 6 preguntas del room muestra → `correct:true`,
      XP acumulado 6×10 + bonus 20 = **80** en `/users/me/xp` (nivel NEOPHYTE→ umbral
      200 no alcanzado, ratio 80/200); respuesta repetida → `alreadySolved:true,
      xpAwarded:0`; respuesta errónea → `correct:false`; questionId ajeno al room → 404.
- [ ] `GET /rooms/:slug/progress` refleja las 6 preguntas y `roomCompleted:true`.
- [ ] `/es/rooms/intro-ciberseguridad-ofensiva` renderiza tasks, guía markdown y
      preguntas en ambos idiomas de UI; enviar la flag de bienvenida desde la página
      marca la pregunta (verificado con curl del HTML + endpoint).
- [ ] `/es/paths` enlaza al room.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` verdes.

## 5. Fuera de alcance

Streaks/badges/leaderboard/certificados (005), páginas de path con % (004), labs
(007), intentos fallidos/anti-brute (005), buscador (006).

## 6. Supuestos

- react-markdown 10.1.0 y remark-gfm 4.0.1 (verificado 2026-11-01) como deps de web.
- `hashAnswer` de @repo/database es la única vía de comparación (regla compartida con
  @repo/shared `isCorrectAnswer`).
