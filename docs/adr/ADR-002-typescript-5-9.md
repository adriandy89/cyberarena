# ADR-002 — TypeScript 5.9 (no 7.x) en todo el monorepo

- **Estado:** aceptada (2026-11-01, fase 000)
- **Contexto:** `typescript@latest` es 7.0.2 (compilador nativo). NestJS depende de
  decorators experimentales y tooling (SWC, reflect-metadata) validado contra 5.x; Next 16
  documenta soporte para 5.x. Riesgo real de incompatibilidad con 7.x en ecosistema Nest.
- **Decisión:** fijar `typescript@5.9.3` en todos los packages (compartido vía
  `packages/config`). Se revisa esta ADR cuando NestJS 12 declare soporte estable de TS 7.
- **Consecuencias:** pierde la velocidad del compilador nativo (irrelevante a esta escala);
  gana estabilidad de decorators y del ecosistema. Constitución §2.1 aplicada (no adoptar
  lo último a ciegas, adoptar lo estable verificado).
