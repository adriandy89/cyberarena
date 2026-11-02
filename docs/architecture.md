# Arquitectura — CyberArena

> Visión global. Detalle por fase en `specs/`. Decisiones justificadas en `docs/adr/`.
> Actualizada el 2026-11-02 (fases 010, 011 y 012).

## Diagrama general (producción)

```
                    ┌──────────────────────────────── Docker host ────────────────────────────────┐
                    │                                                                              │
 Navegador ─ :443 ──┼──► Caddy (TLS) ── red cyberarena_proxy ─┬─► web (Next.js 16, standalone)    │
                    │      /api/* ──────────────────────────┐  │     · SSR /es /en (next-intl)    │
                    │                                       └──┼─► api (NestJS 12)               │
                    │                                          │     · REST /api/*, better-auth   │
                    │   red backend (internal) ── postgres 18 ◄┘     · progreso, gamificación     │
                    │                                                · labs: reservas + reaper    │
                    │   red labs-control (internal) ── api ──► lab-runner ──► docker.sock        │
                    │                                                     │                      │
                    │   labs/<slug> (un proyecto `lab-*` por lab, red propia) ◄──┘               │
                    │     · puertos solo en 127.0.0.1:18xxx (el estudiante ataca desde su host)   │
                    └──────────────────────────────────────────────────────────────────────────────┘
```

En desarrollo (`infra/stacks/dev`) la web (:3000) proxifica `/api` a la api (:3001) con un rewrite de
Next (ADR-008); el lab-runner va en el perfil `labs`.

## Monorepo (pnpm + Turborepo)

- Desplegables: `apps/web` (Next.js 16), `apps/api` (NestJS 12) y `apps/lab-runner` (Node, sin
  dependencias de runtime, ADR-015). `packages/*` son librerías internas enlazadas con `workspace:*`.
- `packages/shared` es el **contrato**: gamificación, tipos de contenido, navegación segura y el
  contrato de labs (`LabSessionView`, códigos de error). Sin dependencias de frameworks.
- `packages/database` expone el cliente Prisma generado y las migraciones. Solo la api (y scripts) lo
  consumen — la web **nunca** toca la BD.
- `packages/content` valida y compila el contenido (pipeline propio, ADR-010): `dist/catalog.json`,
  `catalog-en.json` y `answers.json`. `packages/content/private/**` jamás se importa desde código de
  cliente ni viaja en la imagen de la api.

## Flujo de datos del contenido

```
MDX + JSON (git) ──build──► validación Zod ──► dist/catalog.json (ES) + catalog-en.json (EN)
        │                                                    │
        └─ private/answers/*.yaml ──► seed ──► PostgreSQL (hash + alternativas, ADR-011)
                                                    │
                web ◄── REST ── api ◄───────────────┘  (nunca expone respuestas)
```

El español se sirve desde la BD; el inglés, del `catalog-en.json` de la imagen (por eso el seed se
repite tras cada rebuild). El build exige cobertura EN completa (fase 107).

## Web

- Shell común (cabecera, migas, menú móvil, pie) y la mascota **Byte** (SVG + CSS, ADR-014) que
  reacciona a respuestas, labs y errores; animaciones accesibles (reduced-motion).
- Room player: tareas con `?task=N`, contexto de navegación (`/api/catalog/rooms/:slug/context`),
  feedback de XP y nivel, panel de laboratorio.
- Los Server Components piden a la api con `API_URL` reenviando `X-Forwarded-For`, para que el rate
  limit cuente al visitante.

## Progreso y gamificación

- Toda respuesta correcta genera `XpEvent` inmutable + `QuestionSolved`; los agregados (% de
  room/módulo/path, rachas, niveles, insignias) se derivan (ADR-012/013).
- Certificados de path en PDF generados en la api (pdfkit) con código de verificación.

## Labs bajo demanda (fase 011, ADR-015)

- Una **instancia por lab, compartida** por quien la use; **1 lab por estudiante** y **3 a la vez**.
- La api guarda las reservas (`LabLease`, una por usuario) y la auditoría (`LabEvent`); cada cambio y la
  llamada al runner que implica van bajo un bloqueo consultivo de Postgres.
- La web envía un **latido** cada 60 s mientras la página del room está abierta.
- **Apagado en tres capas**: reaper de la api (10 min sin latido, 2–4 h máximo), plazos propios del
  runner (sobreviven a la caída de la api o la BD) y `restart: "no"` en los labs.
- El runner solo arranca labs de un manifiesto generado en el build y validado por un lint de seguridad
  (127.0.0.1, `cap_drop: ALL`, límites, sin rutas del host ni `docker.sock`…).
- **Un solo runner por host Docker.**

## Seguridad (resumen — detalle en runbook y ADRs)

- Contenedores no-root (salvo el lab-runner, excepción documentada), `cap_drop: ALL`, `no-new-privileges`,
  healthchecks, redes segmentadas (`backend` y `labs-control` internas).
- Solo Caddy publica puertos; Postgres de prod en `127.0.0.1` para operación; labs en `127.0.0.1`.
- Secretos por `secrets:` de compose (sin `\r`, comprobado por `prod-preflight.sh`).
- API: validación Zod, rate limit por IP real (`trust proxy`) con límites por ruta, limitador propio de
  better-auth, CORS explícito.
- Respuestas hasheadas en BD; nunca en bundles, respuestas de la api ni en la imagen.

## Despliegue

- `infra/stacks/proxy` (Caddy, TLS interno o ACME) + `infra/stacks/prod` (postgres, api, web,
  lab-runner) con imágenes multi-stage (`turbo prune --docker`).
- Operación: `prod-preflight.sh`, `seed-prod.sh`, `smoke-prod.mjs`, `labs-smoke.mjs`, backups con
  rotación y restore a BD scratch. Verificado de punta a punta el 2026-11-02 (fase 012).
