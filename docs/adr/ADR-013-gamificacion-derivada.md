# ADR-013 — Gamificación derivada; badges evaluadas tras cada respuesta

- **Estado:** aceptada (2026-11-01, fase 005)
- **Contexto:** rachas, skills y certificados son agregados de datos ya existentes
  (`QuestionSolved.solvedAt`, tags del catálogo, completación de paths). Los badges son
  logros discretos que conviene materializar (mostrar sin recalcular historia).
- **Decisión:**
  1. **Rachas**: cálculo puro en `@repo/shared` (`computeStreak`) sobre el histograma
    de preguntas resueltas por día (UTC); un día "cuenta" con
    `STREAK_MIN_QUESTIONS_PER_DAY` (3) aciertos. La racha actual tolera que hoy aún no
    se haya cumplido (cuenta desde ayer hacia atrás). Sin congelamientos en v1.
  2. **Skills matrix y certificados**: derivados al leer (extensión natural del
    ADR-012), sin almacenamiento.
  3. **Badges**: `UserBadge(userId, badgeId, awardedAt)` con PK compuesta (idempotente
    por constraint). Definiciones estáticas en `BadgesService` con claves i18n
    (`badges.<id>.name/description` en la web). Evaluación best-effort tras cada
    respuesta correcta (`evaluate(userId)`): recuenta aciertos/rooms/paths/racha e
    inserta las que falten (P2002 ignorado).
  4. **Leaderboard**: agregación de `XpEvent` (all-time y mes actual), endpoint
    público sin datos sensibles (nombre, XP, nivel).
- **Consecuencias:** una única tabla nueva; todo lo demás es lectura derivada. La
  evaluación de badges es O(consultas de recuento) por respuesta correcta — trivial a
  esta escala. Zona horaria de rachas = UTC (documentado; ajustable luego por usuario).
