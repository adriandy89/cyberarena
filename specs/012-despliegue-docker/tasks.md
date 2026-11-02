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
- [ ] T006 Scripts de BD: contenedor y BD explícitos; restore muestra el destino; restore a BD scratch.
- [ ] T007 E2E sobre HTTPS: cookie `__Secure-`, `ignoreHTTPSErrors`, reintento ante 429 en el login.
- [ ] T008 `infra/scripts/seed-prod.sh` y `infra/scripts/smoke-prod.sh`.

## Fase B — Despliegue y pruebas

- [ ] T009 Despliegue completo (proxy + prod + lab-runner), seed doble, smoke y E2E sobre HTTPS.
- [ ] T010 Labs en prod: UI, flag, reaper, API parada, adopción, smoke de los 39 labs.
- [ ] T011 Backup + restore en BD scratch.

## Fase C — Cierre

- [ ] T012 Runbook y arquitectura al día con lo verificado.
- [ ] T013 CI: E2E también en PR y con sesión; build de la imagen del lab-runner.
- [ ] T014 Limpieza acotada (106 T4) con `docker system df` antes/después; cierre de 106 y 012.

## Registro

_(se rellena durante el despliegue)_
