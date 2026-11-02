# ROADMAP de fases (SDD)

> Cada fase = una carpeta `specs/<NNN-slug>/` con spec/plan/tasks. Se ejecutan en orden.
> Marca aquí el estado al cerrar cada fase. Última actualización: 2026-11-02.

| Fase | Carpeta | Estado | Entregable |
|---|---|---|---|
| F0 | `000-foundation` | ✅ completada (2026-11-01) | Monorepo operativo: web+api bilingüe + postgres en Docker + CI |
| F1 | `001-auth-users` | ✅ completada (2026-11-01) | Better Auth, roles admin/estudiante, perfiles, emails dev |
| F2 | `002-content-engine` | ✅ completada (2026-11-01) | Content Collections: schemas, seed→BD, validación, guía de autoría |
| F3 | `003-room-player` | ✅ completada (2026-11-01) | UI del room: tasks MDX, preguntas, flags, hints, progreso |
| F4 | `004-paths-dashboard` | ✅ completada (2026-11-01) | Páginas path/módulo, % progreso, dashboard personal |
| F5 | `005-gamification` | ✅ completada (2026-11-01) | XP, niveles, streaks, badges, leaderboard, certificados, skill matrix |
| F6 | `006-hacktivities` | ✅ completada (2026-11-01) | Catálogo público: búsqueda, filtros, orden, tarjetas || F7 | `007-labs` | ✅ completada (2026-11-01) | Plantilla lab + labs reales integrados en rooms + verificación de flags |
| F8 | `008-deploy-hardening` | ✅ completada (2026-11-01) | Stack prod + proxy Caddy HTTPS + backups + hardening + runbook final |
| F9 | `100-content-cs101` | ✅ completada (2026-11-01) | Path Cyber Security 101 completo (14 módulos) |
| F10 | `101-content-jrpt` | ✅ completada (2026-11-01) | Path Jr Penetration Tester completo (17 módulos) |
| F11 | `102-content-webapp` | ✅ completada (2026-11-01) | Path Web Application Pentesting |
| F12 | `103-content-advpt` | ✅ completada (2026-11-01) | Paths Web App Red Teaming + Red Teaming (nivel PT2) |
| F13 | `104-labs-massive` | ✅ completada (2026-11-02) | Labs masivos: 4 tiers, 25 labs, 9 rooms nuevas, filtro Solo-con-labs en hacktivities |
| F14 | `105-new-labs` | ✅ completada (2026-11-02) | 18 labs nuevos (T1 web races/API, T2 blue team, T3 especialización) → 51 rooms, 402 answers, 52 EN |

## Convenciones

- Una fase abre su carpeta con `spec.md` antes de escribir código de esa fase.
- Las fases de contenido (100+) pueden intercalarse tras F7 (el engine de rooms debe existir).
- Cualquier mejora transversal descubierta en una fase se registra como tarea `T9xx` en la fase activa.
- Fuera de alcance v1 (explícito): AttackBox en navegador (Kasm), VPN tipo THM, multi-instancia.
