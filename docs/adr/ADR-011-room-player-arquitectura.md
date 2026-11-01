# ADR-011 — Room player: render MD server-side, respuestas con hash, XP idempotente por constraint

- **Estado:** aceptada (2026-11-01, fase 003)
- **Contexto:** la página del room debe mostrar guías (markdown de los tasks), preguntas
  interactivas (flag/text/choice), hints y feedback de XP, con verificación server-side
  de las respuestas y progreso por usuario.
- **Decisión:**
  1. **Render del markdown en el servidor** (`react-markdown` 10 + `remark-gfm` 4, dentro
     de un Server Component). Los nodos renderizados se pasan como `children/props` al
     cliente interactivo (`RoomPlayer`), que recibe además las preguntas serializables.
     Ventajas: cero JS de parsing, sin `dangerouslySetInnerHTML` (react-markdown no
     ejecuta HTML crudo), y el cliente solo lleva la lógica de interacción.
  2. **Verificación**: `POST /api/rooms/:slug/answers {questionId, answer}` con sesión;
     se compara `hashAnswer(submitted) === Answer.answerHash` (misma normalización
     case-insensitive de @repo/shared/@repo/database). Nunca se compara en claro ni se
     expone el hash.
  3. **XP idempotente por diseño**: `XpEvent` tiene `@@unique([userId, reason])` con
     razones `question:<id>` y `room-complete:<slug>` — el premio solo puede existir una
     vez por usuario y razón, aunque concurran respuestas simultáneas (P2002 → ignora).
  4. **Registros de progreso**: `QuestionSolved` con PK compuesta (userId, questionId).
     Los intentos fallidos NO se registran en esta fase (anti-brute/analítica → fase 005).
- **Alternativas descartadas:** render client de markdown (bundle + parsing en cliente);
  MDX compilado (los cuerpos son markdown simple y el pipeline ya los valida); XP por
  lógica de aplicación sin constraint (condiciones de carrera → doble premio).
- **Consecuencias:** el player es un híbrido RSC+cliente simple y seguro; la lógica de
  negocio (XP, niveles, completación) vive en @repo/shared + la API, testeable sin UI.
