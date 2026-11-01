# ADR-003 — Frontend: Next.js 16 (App Router)

- **Estado:** aceptada (2026-11-01, fase 000 — decisión del usuario con investigación)
- **Contexto:** plataforma bilingüe ES/EN con catálogo público SEO-able (hacktivities),
  contenido MDX masivo y zonas muy interactivas (room player, dashboard XP). Backend REST
  separado (NestJS). El usuario pidió evaluar alternativas.
- **Alternativas evaluadas (nov 2026):**
  - **Astro 7**: el mejor para contenido MDX/i18n estático (content collections nativas,
    i18n integrado), pero room player y dashboard son islas React enormes (SPA embebida) y
    la sesión contra API externa es manual.
  - **React Router v8 (framework mode)**: simple (Vite puro), prerender por rutas; pero
    i18n y MDX son DIY justo donde este proyecto más carga.
  - **TanStack Start v1**: type-safety excelente pero v1.0 estable con semanas, sin historia
    de i18n/MDX — riesgo innecesario.
- **Decisión:** Next.js 16.4 (App Router, Turbopack) + next-intl 4.14 (i18n `/es` `/en`) +
  Tailwind 4 + shadcn/ui (shadcn se integra en la fase de UI 003).
- **Consecuencias:** máximo ecosistema/docs; next-intl resuelve el bilingüe con middleware
  de locale (verificar su integración con `proxy.ts` de Next 16 en T010); PPR/Cache
  Components exigen aprender el modelo de caché explícito. Riesgo controlado.
