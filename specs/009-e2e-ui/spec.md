# Spec 009 — Tests E2E de UI (Playwright)

- **Estado:** completada (2026-11-01)
- **Creada:** 2026-11-01
- **Changelog:**
  - 2026-11-01 primera versión.
  - 2026-11-01 implementación completada: 11/11 specs en verde local (chromium). La fase
    cazó **dos bugs reales de producto**: (1) el cliente de better-auth usaba baseURL
    relativo → `BetterAuthError: Invalid base URL` — el login por NAVEGADOR nunca
    funcionó (solo curl); corregido a URL absoluta con `window.location.origin`.
    (2) La API rechazaba Origin `127.0.0.1:3000` (solo confiaba localhost) → 403
    INVALID_ORIGIN al navegar por IP; `trustedOriginsFrom()` añade el gemelo loopback.
    Además: baseURL de Playwright a 127.0.0.1 (localhost→IPv6 falla), y los facets de
    hacktivities solo listan dificultades existentes (test ajustado a 'easy' y búsqueda
    vacía en vez de 'insane').

## 1. Propósito

Blindar los flujos críticos de la interfaz con tests E2E reproducibles como código
(complemento de los unit/API tests): auth, resolución de rooms desde la UI, catálogo
hacktivities y páginas de path. Playwright como framework (decisión: ver discusión
fase 100; el MCP NO — este repo necesita specs versionadas en CI).

## 2. Historias de usuario

- **US1 (P1)** — Como *desarrollador*, `pnpm test:e2e` verifica en navegador real:
  registro/login/logout, resolver preguntas de un room (feedback ✓ y progreso),
  búsqueda y filtros de hacktivities, y página de path en modo invitado.
- **US2 (P2)** — Como *CI*, un workflow ejecuta los E2E contra un stack efímero
  (postgres + api + web + seed) en cada push a main.

## 3. Requisitos

1. `@playwright/test` en `apps/web` (devDep), `playwright.config.ts` con baseURL
   `http://localhost:3000`, `reuseExistingServer: !process.env.CI`, chromium.
2. Specs en `apps/web/e2e/`:
   - `auth.spec.ts`: registro de usuario único (timestamp) vía UI → dashboard visible
     → logout → CTA entrar de nuevo.
   - `room.spec.ts`: usuario registrado vía API; abre `/es/rooms/linux-fundamentos-1`,
     responde "whoami" en la primera pregunta → ✓ Correcta y progreso 1/N; respuesta
     errónea → mensaje incorrecta.
   - `hacktivities.spec.ts`: buscar "pentester" → tarjeta visible; filtro insane →
     estado vacío.
   - `paths.spec.ts` (invitado): `/es/paths` lista CS101; página del path muestra
     teaser de login.
3. Helper `e2e/utils.ts`: registro/login vía API (creación rápida de usuarios de
   prueba con sesión en storageState para no repetir la UI en cada spec).
4. CI: workflow `e2e.yml` — postgres como service container, migrate+seed, build de
   api/web, arranque en background, `playwright test` (chromium headless).
5. Los E2E NO forman parte de `pnpm test` (requieren stack); script raíz
   `test:e2e` documentado en README/runbook.

## 4. Criterios de éxito

- [x] `pnpm test:e2e` verde localmente contra el stack dev (captura de evidencia).
- [x] Los 4 specs cubren los flujos descritos; usuario de prueba único por run.
- [x] CI workflow presente y coherente (se valida sintaxis localmente).
- [x] `pnpm lint && typecheck && build` siguen verdes.

## 5. Fuera de alcance

Visual regression (screenshots diff), multi-navegador (chromium first), cobertura de
gamificación completa (badges/leaderboard se cubrirá al estabilizar la UI).
