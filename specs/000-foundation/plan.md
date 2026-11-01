# Plan 000 — Foundation

- **Espec:** [spec.md](./spec.md)
- **Creado:** 2026-11-01

## 1. Contexto técnico (versiones verificadas el 2026-11-01 contra npm)

| Pieza | Versión fijada | Nota |
|---|---|---|
| pnpm | 11.18.0 (host) / corepack en contenedores | packageManager pinneado |
| Node | 24 (host) / 22-bookworm-slim (containers) | LTS |
| turbo | 2.11.10 | orquestación + cache |
| typescript | 5.9.3 | NO 7.x (decorators Nest — ADR-002) |
| next | 16.4.3 | App Router, Turbopack, `proxy.ts` |
| react / react-dom | 19.3.1 | |
| next-intl | 4.14.9 | middleware de locale — verificar soporte Next 16 al integrar (ADR-003) |
| tailwindcss | 4.3.3 | CSS-first config (`@theme`), vía `@tailwindcss/postcss` |
| @nestjs/* | 12.3.2 | Vitest+SWC opcionales; ESM-ready pero compilamos CJS para tooling estable |
| zod | 4.6.7 | Standard Schema nativo en Nest 12 |
| prisma / @prisma/client | 7.10.1 | NO 8.0.0-rc.x (constitución §2.1) |
| vitest | 5.0.5 | |
| postgres (imagen) | 18-alpine | |
| mailpit (imagen) | axllent/mailpit:latest | SMTP :1025, UI :8025 |

## 2. Decisiones de arquitectura (detalle en docs/adr/)

- **ADR-001** Monorepo pnpm+Turborepo con apps/ + packages/.
- **ADR-002** TypeScript 5.9 en todo el repo.
- **ADR-003** Next.js 16 para web (alternativas evaluadas: Astro 7, React Router 8).
- **ADR-004** NestJS 12 como API REST separada (compilación CJS estándar).
- **ADR-005** Prisma 7 + PostgreSQL 18 (fijado, no RC).
- **ADR-006** Dev en Docker: stack completo con hot-reload + perfil `infra` para mixed dev.

## 3. Estructura creada por esta fase

```
├── package.json · pnpm-workspace.yaml · turbo.json · .env.example
├── .gitignore · .dockerignore · .editorconfig · README.md · AGENTS.md
├── specs/ (constitution, ROADMAP, 000-foundation/*)
├── docs/ (architecture, content-guide, runbook, adr/ADR-001..006)
├── apps/web/    Next 16 + next-intl + Tailwind 4 (es/en, landing, /status)
├── apps/api/    Nest 12 (/api/health, Zod pipe, Throttler, CORS)
├── packages/config/   tsconfig.base + eslint-config
├── packages/shared/   constantes gamificación + tipos contenido v1
├── packages/database/ Prisma schema + client + migración inicial
├── packages/content/  esqueleto (collections config vacía — F2 la llena)
├── packages/ui/       esqueleto (un componente Badge de dificultad de ejemplo)
├── infra/stacks/dev/compose.yaml (+ .env.example)
├── infra/scripts/backup-db.sh
├── labs/_template/ (compose.yaml aislada + README + flags.env.example)
└── .github/workflows/ci.yml
```

## 4. Estrategia de verificación

1. `pnpm install` + `pnpm lint/typecheck/test/build` en verde.
2. `docker compose -f infra/stacks/dev/compose.yaml up -d` → smoke con curl:
   `GET :3001/api/health` (espera `db: up`) y `GET :3000/es` + `GET :3000/en` (200).
3. Test Vitest del health controller de la API.
4. Todo commit referenciando tarea; al final se marcan criterios de éxito del spec.

## 5. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| next-intl 4.x vs cambios de Next 16 (middleware→proxy) | Integrar siguiendo su guía oficial actual; si el middleware legacy falla, usar routing con `[locale]` + detección en `proxy.ts`. |
| Nest 12 ESM vs tooling (jest/vitest paths) | Compilar a CJS estándar; Vitest con alias de workspace. |
| Prisma 7 en contenedor (sin engine Rust) | Cliente generado dentro de `packages/database/generated` (commiteado NO; se genera en install/build). |
| Hot-reload web/api con volúmenes en Windows | Usar polling solo si hace falta; documentar en runbook la alternativa mixed dev (perfil `infra`). |
