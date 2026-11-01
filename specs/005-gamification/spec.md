# Spec 005 — Gamificación (streaks, badges, leaderboard, certificados, skills)

- **Estado:** completada (2026-11-01)
- **Creada:** 2026-11-01
- **Changelog:**
  - 2026-11-01 primera versión.
  - 2026-11-01 implementación completada y E2E verificado. Notas: (1) La evaluación de
    badges también se dispara en respuestas alreadySolved (auto-reparación para
    usuarios con progreso previo a la fase). (2) El leaderboard es público por diseño
    (solo nombre público, XP y nivel — sin emails). (3) Certificado = HTML imprimible
    (sin dependencias PDF). (4) Otro zombi en :3000 (PID expuesto por netstat) falseó
    404s durante el E2E — el protocolo de matar por PID se aplicó.

## 1. Propósito

La capa que convierte el progreso en hábito: rachas diarias, badges, leaderboard,
certificados por path y skill matrix por tags.

## 2. Historias de usuario

- **US1 (P1)** — Como *estudiante*, veo mi racha (🔥 días consecutivos) y cuántas
  preguntas me faltan hoy para mantenerla (x/3).
- **US2 (P1)** — Como *estudiante*, gano badges automáticamente (primera pregunta,
  primer room, hitos de preguntas, rachas, path completado) y las veo en el dashboard.
- **US3 (P1)** — Como *estudiante*, consulto el leaderboard (all-time y del mes) con
  nombre, XP y nivel.
- **US4 (P2)** — Como *estudiante*, al completar un path obtengo un certificado
  imprimible (HTML optimizado para imprimir/PDF del navegador) con mi nombre, ruta,
  fecha y XP de la ruta.
- **US5 (P2)** — Como *estudiante*, veo mi skill matrix: % de preguntas resueltas por
  tag del catálogo.

## 3. Requisitos funcionales

1. **Rachas** (@repo/shared `computeStreak`, ADR-013): día válido = ≥3 aciertos (UTC);
   racha actual cuenta hacia atrás desde hoy o ayer; incluye mejor racha histórica.
   `GET /api/me/streak` → `{current, best, solvedToday, required, qualifiedToday}`.
2. **Badges**: definiciones estáticas con claves i18n: `first-question`, `room-first`,
   `questions-10|50|100`, `streak-3|7|30`, `path-complete:<slug>` (dinámico por catálogo).
   `UserBadge(userId, badgeId, awardedAt)` PK compuesta — migración `0005_badges`.
   Evaluación idempotente tras cada respuesta correcta. `GET /api/me/badges` →
   `{awarded: [{id, awardedAt}], definitions: [{id, earned}]}`.
3. **Leaderboard**: `GET /api/leaderboard?period=all|month` (público) — top 20:
   `{rank, name, xp, levelName}`. Mensual filtra `XpEvent.createdAt >= inicio de mes UTC`.
4. **Certificados**: `GET /api/me/certificates` → paths con 100% (slug, título,
   completedAt = max solvedAt, xpInPath). Página `/[locale]/certificate/[slug]`
   imprimible (client, print CSS, botón imprimir).
5. **Skills**: `GET /api/me/skills` → por tag `{tag, solved, total, percent}`
   (preguntas heredan tags de su room).
6. **Dashboard**: tarjetas de racha, badges (grid con estado), skills (barras) y
   certificados; enlace al leaderboard en el header. Mensajes es/en completos.

## 4. Criterios de éxito (verificables)

- [x] E2E admin (6 respuestas hoy): `/me/streak` → `current 1, solvedToday 6,
      qualifiedToday true`; `/me/badges` incluye `first-question`, `room-first`,
      `path-complete:cyber-security-101`; `/leaderboard` → admin #1 con 80 XP;
      `/me/skills` → tags del room al 100%; `/me/certificates` → cs101 completo.
      *(verificado al completo, exactamente esos 3 badges)*
- [x] `/es/leaderboard` renderiza la tabla (público) y `/es/certificate/cyber-security-101`
      es imprimible con los datos del admin. *(200 ambos + i18n: "Clasificación/Histórico/
      Este mes", "Print / PDF"; datos por endpoints)*
- [x] Dashboard muestra racha 🔥 y grid de badges (datos por curl de sus endpoints).
- [x] `pnpm lint && typecheck && test && build` verdes. *(61 tests: 20 shared + 41 api)*

## 5. Fuera de alcance

Streak freezes (v1 sin congelamientos), anti-cheat de rachas, badges de first-blood
global, PDFs server-side, notificaciones.

## 6. Supuestos

- Rachas en UTC (limitación documentada; personalizable en el futuro por usuario).
- Los badges no dan XP (evita loops de evaluación).
