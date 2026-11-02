# Tasks 010 — UX: mascota Byte, animaciones, navegación y orden de contenidos

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit.

## Fase A — Specs

- [x] T001 spec/plan/tasks 010 + ADR-014 + ROADMAP (filas 009/010, F6/F7, datos F10/F12).

## Fase B — Fundamentos visuales

- [x] T002 [US7] `globals.css`: `@theme` (tokens, easings, `--animate-*`), política
      reduced-motion global, limpieza de clases muertas, foco visible; fuentes Geist.
- [x] T003 lucide-react + `components/icon.tsx`; emoji de UI → iconos.

## Fase C — Byte

- [x] T004 [US3,US5,US7] `byte.tsx` + `byte.module.css` (12 estados, SSR, reduced-motion)
      + galería `/[locale]/dev/byte` (solo dev).
- [x] T005 [US3,US5] `byte-bubble.tsx` (typewriter, aria-live), `byte-scene.tsx`, `confetti.tsx`.
- [x] T006 [US3] `byte-provider.tsx` + `useByte()` (cola por prioridad) + namespace `Byte` es/en.
- [x] T007 [US5] `byte-companion.tsx` (full/mini/off persistido, tips por página, se aparta).

## Fase D — Navegación

- [x] T008 [US1] Shell común: site-header (activo, pendiente), mobile-nav, site-footer,
      skip-link, Byte en layout; home sin cabecera inline.
- [x] T009 [US1,US2] Breadcrumbs + `template.tsx` (entrada de página).
- [x] T010 [US5] loading/error/not-found con Byte + esqueletos en páginas cliente.
- [x] T011 [US2] API `GET /catalog/rooms/:slug/context` + `computeRoomContext` + tests.
- [x] T012 [US2] Página de room: migas, contexto, anterior/siguiente, "Continúa con…".
- [x] T013 [US2,US3] Login `?next=` seguro + 401 en room-player → Byte `point` + login.
- [x] T014 [US6,US8] Paths: `?locale=en`, "Continuar", índice de módulos, celebración 100 %.
- [x] T015 [US6] Dashboard: tarjeta "Continuar" + saludo de Byte con racha.

## Fase E — Respuestas con Byte

- [x] T016 [US3] API: `level { before, after }` en la respuesta de answers + tests.
- [x] T017 [US3,US7] Room player: reacciones de Byte, XP animada, `?task=N`, flechas,
      aria-live, errores de red visibles.

## Fase F — Páginas

- [x] T018 [US4,US5] Home: hero con Byte, roadmap desde `/api/catalog`, CTA, scroll reveal.
- [x] T019 [US4,US5] Hacktivities (`recommended`/`difficulty` + tests), leaderboard,
      login, status, certificado con Byte.

## Fase G — Orden de contenidos

- [x] T020 [US4,US8] `order` en paths + build ordena + EN de paths/módulos + tests.
- [x] T021 [US4] Seed reconecta módulo→path y room→módulo.
- [ ] T022 [US4] CS101: orden de módulos, fácil→difícil, sin password-attacks.
- [ ] T023 [US4] JrPT: módulo `passwords`, AD al final, sin mobile.
- [ ] T024 [US4] WebApp (+mobile) y Advanced (+red-team-ops) + descripciones.
- [ ] T025 [US4] Referencias adelantadas, traducción huérfana, avisos del validador.

## Fase H — Cierre

- [ ] T026 E2E `navigation.spec.ts` + `byte.spec.ts`.
- [ ] T027 Verificación completa + capturas + changelog + ROADMAP + content-guide.

## Bugs/Deuda

- [x] T901 BUG: `/api/catalog?locale=en` (y `paths/:slug?locale=en`) devolvía el catálogo compilado en
      crudo (otra forma, con todos los cuerpos de tareas) → NaN en contadores EN. Ahora forma y orden
      salen de la BD y solo se superponen los textos EN (`catalog-i18n.ts` + tests).
