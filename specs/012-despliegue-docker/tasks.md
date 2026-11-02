# Tasks 012 — Despliegue Docker completo y verificado

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit. Las T3/T4 de la spec 106 se
> marcan con referencia a este registro.

## Fase A — Arreglos previos

- [x] T001 spec + tasks 012; ROADMAP.
- [x] T002 Entrypoint de la API: secretos sin `\r\n`; `prisma migrate deploy` sin pnpm en runtime.
- [x] T003 `.dockerignore` (store de pnpm, backups, secretos, tsbuildinfo, resultados E2E); `# syntax`
      en la línea 1; la imagen de la API sin `packages/content/private`.
- [x] T004 Web: `API_URL` como argumento de build (rewrite horneado correcto) + `turbo.json`.
- [x] T005 Proxy: healthcheck de Caddy, comentario `--project-directory`, directorios vacíos sueltos.
- [x] T006 Scripts de BD: contenedor y BD explícitos; restore muestra el destino; restore a BD scratch.
- [x] T007 E2E sobre HTTPS: cookie `__Secure-`, `ignoreHTTPSErrors`, reintento ante 429 en el login.
- [x] T008 `infra/scripts/prod-preflight.sh`, `seed-prod.sh` y `smoke-prod.mjs` (Node: JSON sin `jq` y TLS
      verificado contra la CA de Caddy).

## Fase B — Despliegue y pruebas

- [x] T009 Despliegue completo (proxy + prod + lab-runner), seed doble, smoke y E2E sobre HTTPS.
- [x] T010 Labs en prod: UI, flag, reaper, API parada, adopción, smoke de los 39 labs.
- [ ] T011 Backup + restore en BD scratch.

## Fase C — Cierre

- [ ] T012 Runbook y arquitectura al día con lo verificado.
- [ ] T013 CI: E2E también en PR y con sesión; build de la imagen del lab-runner.
- [ ] T014 Limpieza acotada (106 T4) con `docker system df` antes/después; cierre de 106 y 012.

## Registro

- 2026-11-02 · **Preflight.** `postgres_password` y `better_auth_secret` tenían `\r` (el `openssl` de Git
  Bash en Windows escribe CRLF): Postgres habría guardado una contraseña distinta de la de la API. Se
  normalizaron con `tr -d '\r'` (valores intactos) y el README de secretos ahora genera sin `\r`. Creado
  `lab_runner_token`; flags de los 39 labs con `lab-flags.sh`. Preflight OK.
- 2026-11-02 · **Un solo lab-runner por host Docker.** El de dev y el de prod gestionarían los mismos
  proyectos `lab-*` y cada uno apagaría los labs del otro (no los renueva). Antes de prod se paró el de dev;
  como `restart: always` lo resucita al reiniciar el daemon, en dev pasa a `unless-stopped`.
- 2026-11-02 · **Primer `up --build` fallido:** el contexto de build no podía leer
  `apps/lab-runner/node_modules` (enlaces de Linux escritos por el `pnpm install` de los contenedores de
  dev). Corregido en 011 T909.
- 2026-11-02 · **Disco C: lleno (20 MB libres) durante el build.** Se paró el build y, con el visto bueno
  del usuario: caché de build de Docker (32,5 GB), imágenes sin uso de cualquier proyecto (32,4 GB; los
  volúmenes con datos no se tocaron), store de pnpm (0,7 GB), `.turbo` (3,7 GB) y `.next` (0,6 GB).
  `docker_data.vhdx` no es *sparse*: tras `fstrim` en la VM se compactó con diskpart desde un PowerShell
  elevado (script con Docker y WSL parados): 123,8 → 60,5 GB. C: pasó de 20 MB a 68 GB libres.
- 2026-11-02 · **Despliegue (T009).** `proxy up` + `prod up -d --build`: postgres, api, web y lab-runner
  *healthy*. La API aplicó las 11 migraciones con el CLI local (sin descargar pnpm), creó el admin
  inicial con el secreto y el reaper hizo su primer barrido; el runner arrancó con Engine 29.9.2 /
  Compose 5.6.1 y 39 labs. `seed-prod.sh` ×2: 4 paths, 37 módulos, 59 rooms, 491 preguntas, 0 filas
  obsoletas. `smoke-prod.mjs`: TLS verificado contra la CA interna de Caddy, health (db y runner),
  cabeceras de seguridad, páginas, catálogo 59 rooms ES/EN (EN de verdad en inglés), hacktivities,
  labs activados, login de admin con cookie `__Secure-`, panel de labs de admin, endpoint de PDF vivo
  (404 = path no completado) y las 118 páginas de rooms ES+EN: todo OK. Playwright contra
  `https://localhost`: **27 OK, 1 omitido** (el del reaper exige inactividad de 1 min: se prueba en T010).
- 2026-11-02 · **Labs en prod (T010).** API recreada con `LAB_IDLE_TIMEOUT_MIN=1` y
  `LAB_SWEEP_SECONDS=10` (nuevas variables en el compose de prod; por defecto, la política acordada):
  `labs.spec` sobre HTTPS 4/4, incluido el reaper. **Flags reales**: 3 labs arrancados por la API y
  explotados desde el host (web-recon-1: ruta oculta y cabecera; idor-chain: IDOR, pedido ajeno y mass
  assignment; xss-reflejado: búsqueda) → 6/6 respuestas `correct=true`. **API parada**: un lab arrancado
  por la API y otro levantado a mano (adoptado) se apagaron solos a los ~5 min por plazo del runner.
  API restaurada a 10 min / 60 s. `labs-smoke.mjs` con el runner de prod: **39/39** (HTTP 200 o
  `exec`), sin labs encendidos al terminar.
- 2026-11-02 · **Backup y restore (T011).** `backup-db.sh cyberarena-prod-postgres-1` →
  `backups/cyberarena-20261102-193800.sql.gz` (210 KB); restaurado en `cyberarena_restore` con
  `restore-db.sh` (destino explícito). Conteos idénticos en ambas BD: User 16, Room 59, Question 491,
  Answer 491, QuestionSolved 11, XpEvent 11, LabEvent 29, migraciones 11. BD scratch eliminada; la de
  producción no se tocó.
