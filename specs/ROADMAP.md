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
| F6 | `006-hacktivities` | ✅ completada (2026-11-01) | Catálogo público: búsqueda, filtros, orden, tarjetas |
| F7 | `007-labs` | ✅ completada (2026-11-01) | Plantilla lab + labs reales integrados en rooms + verificación de flags |
| F8 | `008-deploy-hardening` | ✅ completada (2026-11-01) | Stack prod + proxy Caddy HTTPS + backups + hardening + runbook final |
| F8b | `009-e2e-ui` | ✅ completada (2026-11-01) | Tests E2E Playwright (auth, room, hacktivities, paths) + workflow CI |
| F9 | `100-content-cs101` | ✅ completada (2026-11-01) | Path Cyber Security 101 completo (14 módulos) |
| F10 | `101-content-jrpt` | ✅ completada (2026-11-01) | Path Jr Penetration Tester completo (10 módulos tras la fase 010) |
| F11 | `102-content-webapp` | ✅ completada (2026-11-01) | Path Web Application Pentesting |
| F12 | `103-content-advpt` | ✅ completada (2026-11-01) | Path Advanced Pentesting (red team web/AD/cloud/IA, nivel PT2) — consolidado en un único path |
| F13 | `104-labs-massive` | ✅ completada (2026-11-02) | Labs masivos: 4 tiers, 25 labs, 9 rooms nuevas, filtro Solo-con-labs en hacktivities |
| F14 | `105-new-labs` | ✅ completada (2026-11-02) | 18 labs nuevos (T1 web races/API, T2 blue team, T3 especialización) → 51 rooms, 402 answers, 52 EN |
| F15 | `010-ux-byte-navegacion` | ✅ completada (2026-11-02) | Shell de navegación, mascota Byte, animaciones accesibles, reestructuración del orden de contenidos |
| F16 | `107-en-completo-respuestas` | ✅ completada (2026-11-02) | Teoría, pistas y opciones en inglés; respuestas con alternativas; fin de las respuestas-frase |
| F17 | `106-depth-certs-prod` | 🔄 en curso (T1–T2 ✅; T3–T4 en la 012) | 8 rooms teóricas, certificados PDF, stack prod verificado |
| F18 | `011-labs-bajo-demanda` | ⬜ pendiente | Labs que se arrancan y apagan desde la web: lab-runner, reservas con latido, reaper, seguridad |
| F19 | `012-despliegue-docker` | ⬜ pendiente | Despliegue Docker completo (proxy + prod + lab-runner) probado de punta a punta; limpieza |

## Convenciones

- Una fase abre su carpeta con `spec.md` antes de escribir código de esa fase.
- Las fases de contenido (100+) pueden intercalarse tras F7 (el engine de rooms debe existir).
- Cualquier mejora transversal descubierta en una fase se registra como tarea `T9xx` en la fase activa.
- Fuera de alcance v1 (explícito): AttackBox en navegador (Kasm), VPN tipo THM, multi-instancia por usuario
  (una instancia por lab y usuario). El ciclo de vida de los labs desde la web (una instancia compartida por
  lab) entra en la fase 011.
