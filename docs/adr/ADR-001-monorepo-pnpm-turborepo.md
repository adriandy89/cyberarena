# ADR-001 — Monorepo con pnpm workspaces + Turborepo

- **Estado:** aceptada (2026-11-01, fase 000)
- **Contexto:** proyecto full-stack personal y escalable (web + api + packages compartidos
  + contenido + infra), desarrollado por una persona con soporte de agentes IA.
- **Alternativas:** Nx (más potente en code generation y grafo, pero ~4× la configuración
  inicial para beneficio que un dev solo no explota); repos múltiples (duplica CI, versionado
  y sincronización de contratos); pnpm workspaces sin orquestador (sin cache ni paralelismo
  de tareas).
- **Decisión:** pnpm 11 workspaces (enlaces `workspace:*`, store eficiente) + Turborepo 2.11
  para orquestación/caché de tareas (`turbo run build/lint/typecheck/test`).
- **Consecuencias:** arranque mínimo, caché local acelera iteración, estructura canónica
  `apps/` + `packages/` conocida por la comunidad y por los agentes. Renunciamos a
  generators/constraints de Nx (mitigado con lint + estructura documentada en AGENTS.md).
