# Tasks 011 — Labs bajo demanda

> Commit atómico por tarea (`T0NN`), casilla marcada en el mismo commit.

## Fase A — Specs y base

- [x] T001 spec/plan/tasks 011; ADR-015 (runner con `docker.sock`); changelog de la 007; ROADMAP.
- [x] T002 Spike: compose dentro de un contenedor con volumen de assets, `volume.subpath` (directorio y
      fichero suelto) y `!override`; resultado en `plan.md`.
- [x] T003 Throttling real: `trust proxy`, `x-forwarded-for` desde el SSR, `@SkipThrottle` en health y
      catálogo, límites por ruta, `rateLimit` de better-auth; tests.

## Fase B — Labs y runner

- [x] T004 `apps/lab-runner`: esqueleto, `lint.ts` + `build-manifest.ts` + tests con fixtures.
- [x] T005 Endurecer los 39 composes y `_template` (`x-cyberarena`, límites, `restart: "no"`,
      `cap_drop`); test que pasa el lint por todos; `validate.ts` comprueba que `lab:` existe.
- [x] T006 Núcleo del runner (estado, plazos, mutex, args de compose, override, assets) con `execFile`
      simulado; modo `LAB_RUNNER_DRY_RUN`.
- [x] T007 Servidor HTTP, auth, watchdog, CLI, Dockerfile; servicio en los compose de dev y prod;
      Postgres de prod en `127.0.0.1`; `infra/scripts/lab-flags.sh`.

## Fase C — API

- [x] T008 Prisma `LabLease`, `LabEvent`, `Room.extraLabs` + migración; `extraLabs` en el esquema de
      contenido, el seed y los 5 rooms.
- [x] T009 Módulo `labs` (config, cliente del runner, política, servicio, controlador) + tests.
- [x] T010 Reaper, endpoints de admin, salud de labs y actividad al responder + tests.

## Fase D — Web

- [x] T011 `use-lab-session` + `LabPanel` (estados, ES/EN, Byte).
- [x] T012 Sección admin de labs en el dashboard y fila de labs en `/status`.

## Fase E — Cierre

- [x] T013 E2E `labs.spec.ts` (se salta si los labs están desactivados; vale con runner real o simulado);
      `infra/scripts/labs-smoke.mjs` (Node en lugar de bash: lee el manifiesto JSON sin depender de `jq`).
- [x] T014 Verificación completa en el dev stack con labs reales; content-guide; cierre de la spec.

## Bugs/Deuda

- [ ] T901 Daemon Docker rootless dedicado a los labs (el runner deja de ser root en el host).
- [ ] T902 Detectar actividad por el tráfico del lab, no solo por el latido de la página.
- [ ] T903 «Reset» de un lab compartido (solo con una única reserva o admin).
- [ ] T904 Bloquear la salida a internet de los labs (`enable_ip_masquerade=false`) con imágenes
      precocinadas para los que hoy hacen `apk add` al arrancar.
- [ ] T905 Rotar las flags y sacarlas de git (hoy están en `flags.env.example` y `private/answers`).
- [ ] T906 Cola de espera cuando se alcanza la capacidad.
- [ ] T907 Healthchecks por lab (hoy «listo» = contenedores en marcha).
- [ ] T908 Temporizador de respaldo a nivel host (systemd/Task Scheduler) por si el runner no arranca.
- [x] T909 BUG (encontrado en 012): el compose de dev no daba a `apps/lab-runner/node_modules` un volumen
      anónimo, así que el `pnpm install` de los contenedores api/web escribía enlaces de Linux en el host
      (ilegibles en Windows) y rompía el contexto de build. Añadido el volumen; `node_modules` regenerado.
