# AGENTS.md — Guía operativa para agentes de IA (y humanos)

Este repositorio se desarrolla con **Spec-Driven Development (SDD)**. Si eres un agente
(Claude, ZCode, Copilot…) que retoma el trabajo, sigue exactamente este protocolo.

## Protocolo de arranque (obligatorio en cada sesión)

1. Lee `specs/constitution.md` (principios no negociables).
2. Lee este archivo completo.
3. Ejecuta `git log --oneline -15` para ver el avance reciente.
4. Localiza la fase activa: el **roadmap** está en `specs/ROADMAP.md`; las fases terminadas
   tienen todas las casillas de su `tasks.md` marcadas.
5. Abre el `tasks.md` de la fase activa y continúa **desde la primera casilla sin marcar**.
   No reimplementes lo ya hecho; verifica con git log / código existente si dudas.
6. Antes de tocar una dependencia nueva o actualizar una existente: **verifica la versión
   estable vigente** (`npm view <pkg> version` + docs oficiales) — constitución §2.1.

## Reglas de trabajo

- **Commit atómico por tarea** (`T012`), Conventional Commits, marcando la casilla en
  `tasks.md` **en el mismo commit**. Ejemplo: `feat(api): health endpoint (T004)`.
- Nunca commitees `.env` ni secretos (constitución §1.1).
- Un bloque de trabajo termina solo cuando `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pasa.
- Si el código y la spec discrepan: corrige conscientemente y documenta (ADR si es
  arquitectónico, changelog de la spec si es de alcance).
- Si descubres un bug fuera del alcance de la tarea actual: créalo como tarea `T9xx BUG:` al
  final del `tasks.md` de su fase (o de la fase activa si no tiene) y sigue con lo tuyo.
- Idioma: **código y comentarios en inglés; docs, specs y contenido educativo en español**
  (el contenido bilingüe se rige por la fase 002).

## Mapa del repositorio

| Ruta | Qué es |
|---|---|
| `specs/` | Fuente de verdad: constitución, roadmap y una carpeta por fase (`NNN-slug/`) |
| `specs/NNN-slug/spec.md` | Requisitos e historias de usuario (el QUÉ) |
| `specs/NNN-slug/plan.md` | Decisiones técnicas y estructura (el CÓMO) |
| `specs/NNN-slug/tasks.md` | Checklist ejecutable con checkpoints |
| `specs/NNN-slug/data-model.md` | Entidades de datos de la fase |
| `docs/architecture.md` | Visión global del sistema |
| `docs/content-guide.md` | Cómo se autora contenido (paths/modules/rooms MDX) |
| `docs/runbook.md` | Operación de entornos, backups, troubleshooting |
| `docs/adr/` | Decisiones arquitectónicas (ADR-NNN) |
| `apps/web` | Next.js 16 (UI bilingüe, catálogo, room player, dashboard) |
| `apps/api` | NestJS 12 (REST: auth, progreso, gamificación) |
| `packages/shared` | Contratos Zod, tipos, constantes (XP, niveles) compartidas |
| `packages/database` | Prisma schema, migraciones, seed, cliente tipado |
| `packages/content` | Contenido como código: MDX + Content Collections + answers privadas |
| `packages/ui` | Componentes React compartidos |
| `packages/config` | tsconfig/eslint base |
| `infra/stacks/{dev,prod,proxy}` | Stacks docker-compose separados por entorno |
| `infra/scripts` | Backups, seeds, utilidades operativas |
| `labs/<room-slug>/` | Un stack compose aislado por room práctico |

## Comandos habituales

```bash
pnpm install                                  # dependencias
pnpm dev                                      # dev servers (web+api)
docker compose --project-directory . -f infra/stacks/dev/compose.yaml up -d   # entorno dev completo
pnpm build && pnpm lint && pnpm typecheck && pnpm test                        # verificación completa
pnpm db:migrate && pnpm db:seed               # migraciones y seed
```

## Fases (resumen; detalle en specs/ROADMAP.md)

`000-foundation` → `001-auth-users` → `002-content-engine` → `003-room-player` →
`004-paths-dashboard` → `005-gamification` → `006-hacktivities` → `007-labs` →
`008-deploy-hardening` → `100+` content packs (CS101, JrPT, WebApp, AdvPT).

## Al terminar tu sesión

1. Deja `tasks.md` al día (casillas marcadas) y commits limpios.
2. Si hay decisiones pendientes o contexto no obvio, añádelo al changelog de la spec activa.
3. No dejes trabajo a medio hacer sin casilla que lo represente.
