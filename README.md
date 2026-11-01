# CyberArena

Plataforma personal y profesional de aprendizaje de ciberseguridad **estilo [TryHackMe](https://tryhackme.com)**: rutas de aprendizaje (novato → experto), rooms con tareas y preguntas, verificación de flags, gamificación (XP, niveles, badges, streaks) y **labs prácticos con Docker Compose por room**, todo desplegable en contenedores de forma segura.

> Nombre de trabajo: **CyberArena** (renombrable sin impacto — no hay dependencias del nombre en el código).

## Recorrido de contenido (novato → experto)

1. **Cyber Security 101** — fundamentos: Linux, Windows/AD, networking, criptografía, explotación básica, web hacking, defensive.
2. **Jr Penetration Tester** — recon, Nmap, Burp Suite, Metasploit, privesc Linux/Windows, seguridad web (OWASP), Active Directory, password attacks, capstones.
3. **Web Application Pentesting** — OWASP a profundidad, APIs, exploits web encadenados.
4. **Web Application Red Teaming** — evasión, payloads avanzados, engagement web ofensivo.
5. **Red Teaming / nivel PT2** — AD avanzado, Kerberos, containers, cloud/IAM, AI/LLM exploitation.

## Stack

| Capa | Tecnología |
|---|---|
| Monorepo | pnpm 11 workspaces + Turborepo 2 |
| Web | Next.js 16 (App Router) · next-intl (ES/EN) · Tailwind CSS 4 · shadcn/ui |
| API | NestJS 12 (REST) · Zod (Standard Schema) |
| Auth | Better Auth (roles admin/estudiante) |
| Datos | PostgreSQL 18 + Prisma 7 |
| Contenido | MDX + Content Collections (content-as-code, validación Zod en build) |
| Labs | Docker Compose por room (redes aisladas) |
| Infra | Docker multi-stage · stacks compose separados por carpeta (`infra/stacks/{dev,prod,proxy}`) · Caddy (HTTPS) |

## Desarrollo rápido

Requisitos: Node 22+, pnpm 11, Docker.

```bash
# 1) Variables de entorno
cp .env.example .env                                  # rellena secretos
cp infra/stacks/dev/.env.example infra/stacks/dev/.env

# 2) Todo el entorno dev en Docker (postgres + api + web + mailpit)
#    (primer arranque: instala dependencias dentro de los contenedores, ~3 min)
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env up -d

#    …o solo infraestructura y dev servers en host (mejor DX en Windows):
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env up -d postgres mailpit
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```

- Web: http://localhost:3000 (`/es` · `/en`)
- API: http://localhost:3001/api/health (o a través de la web: http://localhost:3000/api/health)
- Mailpit (email dev): http://localhost:8025
- Login: http://localhost:3000/es/login — **el primer usuario registrado es ADMIN**

## Estructura del repositorio

```
apps/         web (Next.js) · api (NestJS)
packages/     shared · database · content · ui · config
infra/        stacks/dev · stacks/prod · stacks/proxy · scripts
labs/         un docker-compose aislado por room práctico
specs/        ESPECIFICACIONES SDD (fuente de verdad del proyecto)
docs/         arquitectura, guía de contenido, runbook, ADRs
```

## Metodología: SDD (Spec-Driven Development)

Este proyecto se construye por iteraciones dirigidas por especificaciones. **La fuente de verdad es `specs/`**, no la memoria de ninguna conversación:

- `specs/constitution.md` — principios no negociables.
- `specs/<NNN-feature>/spec.md` — el QUÉ (requisitos, historias de usuario).
- `specs/<NNN-feature>/plan.md` — el CÓMO (decisiones técnicas).
- `specs/<NNN-feature>/tasks.md` — checklist ejecutable (`T001…`); **cualquier sesión retoma desde el primer checkbox sin marcar**.

Agentes de IA: lee [`AGENTS.md`](AGENTS.md) antes de tocar nada.

## Licencia

Uso personal. El contenido educativo es original; las marcas y materiales de terceros (TryHackMe, Vulhub…) no se copian.
