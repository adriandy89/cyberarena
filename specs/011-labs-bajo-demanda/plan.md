# Plan 011 — Labs bajo demanda

## Arquitectura

```
navegador ─(Caddy)─> web ─> api ─(red interna labs-control + token)─> lab-runner ─docker.sock─> labs
  LabPanel             │      │  LabLease / LabEvent (Postgres)            │   127.0.0.1:18xxx
  latido 60 s          │      └─ reaper 60 s: caduca, apaga, renueva       └─ plazos propios + watchdog
```

Tres capas de apagado, independientes entre sí:

1. **Reaper de la API** (cada 60 s): caduca reservas (10 min sin latido o pasada su duración máxima), hace
   `down` de los labs que se quedan sin reservas y llama a `renew` con los que siguen reservados.
2. **Plazos del runner** (bucle de 30 s): cada lab en marcha tiene un plazo que solo la API alarga
   (`ttl` 180 s). Si la API o la BD caen, los labs mueren a los 3 min. Proyectos `lab-*` sin plazo
   (manuales o previos al arranque del runner) se adoptan con 5 min de gracia.
3. **`restart: "no"`** en todos los labs: un reinicio de Docker no los resucita; el runner (con
   `restart: always`) barre al arrancar.

## lab-runner (`apps/lab-runner`)

- Node 22 + TypeScript, **sin dependencias de runtime** (`node:http`, `node:child_process.execFile` sin
  shell, `node:crypto`). `yaml` solo como devDependency del generador de manifiesto.
- **Manifiesto** (`dist/manifest.json`), generado y validado en el build (`scripts/build-manifest.ts`):
  por lab, `slug`, `project` (el `name:` del compose), `access` (`http`|`exec`), puertos, `url?`,
  servicios con su contenedor de `exec`, binds relativos y variables de flags requeridas.
- **Imagen**: los labs van dentro (inmutables). CLI de docker y compose copiados y fijados desde la
  imagen oficial `docker:<ver>-cli`.
- **Ficheros de los labs** (`LAB_ASSETS=volume`, por defecto en contenedor): antes de cada `up` se copia
  `labs/<slug>/` al volumen `cyberarena-lab-assets` y se arranca con
  `-f compose.yaml -f <override generado>`; el override (`volumes: !override`) cambia cada bind relativo
  por `type: volume` + `volume.subpath: <slug>/<ruta>` + `read_only`. Con el runner en el host
  (`LAB_ASSETS=bind`) se usan los binds tal cual. Plan B si el spike falla: mirror mount
  (`LABS_HOST_DIR`).
- **Flags**: `/run/lab-flags/<slug>.env` (directorio montado de solo lectura, gitignored, generado por
  `infra/scripts/lab-flags.sh`). Lab sin fichero → `unavailable`. Nunca se usa `.example`.
- **API interna** (Bearer, `timingSafeEqual`): `GET /healthz`, `GET /labs`, `POST /labs/:slug/up` (202,
  asíncrono, idempotente), `POST /labs/:slug/down`, `POST /renew {slugs, ttlSeconds}` (solo alarga),
  `POST /down-all`. Slug validado por regex y contra el manifiesto; mutex por slug; máximo de
  operaciones simultáneas; timeout por `exec`; rechaza `up` si ya hay `LAB_MAX_RUNNING`.
- **Estado** en memoria por slug: `stopped|starting|running|stopping|exited|error|unavailable`,
  `lastError`, `deadline`. La verdad sobre qué corre sale de `docker compose ls --all --format json`.
- **Watchdog**: si el bucle no completa una vuelta en 2 min, `process.exit(1)` (`restart: always`).
- **CLI** (`node dist/cli.js up|down|ls|smoke`) para el runbook y el smoke de labs.
- **Modo simulado** (`LAB_RUNNER_DRY_RUN=1`): mismos estados con retardos, sin Docker (E2E y CI).

## API (`apps/api/src/labs`)

- **Prisma**: `LabLease { userId @id, labSlug, startedAt, lastSeenAt, maxUntil }`,
  `LabEvent { id, at, labSlug, userId?, type, detail? }` (purga a 30 días), `Room.extraLabs String[]`.
- **Config** (`labs.config.ts`, Zod): `LABS_ENABLED`, `LAB_RUNNER_URL`, `LAB_RUNNER_TOKEN[_FILE]`,
  `LAB_IDLE_TIMEOUT_MIN=10`, `LAB_SESSION_MAX_MIN=120`, `LAB_SESSION_CAP_MIN=240`, `LAB_EXTEND_MIN=60`,
  `LAB_MAX_RUNNING=3`, `LAB_SWEEP_SECONDS=60`, `LAB_RENEW_TTL_SECONDS=180`.
- **Política** (`lease-policy.ts`, funciones puras): caducidad, ampliación (solo en los últimos 30 min,
  hasta el tope), capacidad.
- **Endpoints** (`SessionGuard`, Zod): `GET /api/labs/:slug`, `POST /api/labs/:slug/{start,heartbeat,
  extend,stop}`; admin: `GET /api/admin/labs`, `POST /api/admin/labs/:slug/stop`,
  `POST /api/admin/labs/stop-all`. `start` en transacción con `pg_advisory_xact_lock`: `409
  LAB_OTHER_ACTIVE` (con opción `switch`), `409 LAB_CAPACITY` (con la hora del primer hueco), `503` si el
  runner no responde. Slugs permitidos: `room.lab ∪ room.extraLabs` ∩ manifiesto.
- **Reaper** (`setInterval` al arrancar; `enableShutdownHooks`): guarda `lastSweep` en memoria; health
  añade el bloque `labs`.

## Web

- `lib/use-lab-session.ts`: estado + sondeo (3 s mientras cambia, 30 s estable) + latido.
- `LabPanel`: máquina de estados (deshabilitado/invitado/parado/arrancando/en marcha/otro lab/capacidad/
  caducado/error). Byte: listo → `happy`, caducado → `sleep`, error → `error`.
- Dashboard admin (labs activos, reservas, eventos, último barrido, detener) y fila en `/status`.

## Throttling (prerrequisito del sondeo)

`trust proxy` para `loopback, uniquelocal` (Caddy y la red Docker) → `req.ip` es el cliente. El SSR de
la web reenvía `x-forwarded-for`. `@SkipThrottle` en health y en los GET públicos del catálogo; límites
por ruta en `answers` y `labs`; `rateLimit` de better-auth en `/api/auth/*`.

## Seguridad (ADR-015)

El runner monta `docker.sock` (equivale a root en el host). Controles: red interna sin puertos, token
en secreto Docker, manifiesto inmutable dentro de la imagen, lint de composes, sin shell, cero deps de
runtime, `read_only` + tmpfs, `cap_drop: ALL`, `no-new-privileges`, límites de recursos. Postgres de
prod solo en `127.0.0.1` para que ningún lab lo alcance por la gateway del bridge.

## Spike T002 — resultado (2026-11-02, Docker Desktop: Engine 29.9.2, Compose 5.6.1)

Se ejecutó `docker compose` dentro de `docker:29-cli` (trae el plugin compose v5.6.1 en
`/usr/local/libexec/docker/cli-plugins/`) con `docker.sock`, los labs montados en `/labs:ro` y el
volumen de assets en `/assets`.

| Prueba | Resultado |
|---|---|
| `sqli-basico`: bind `./site` → `volumes: !override` con `type: volume` + `subpath: sqli-basico/site` | ✅ `up --wait` correcto; `GET 127.0.0.1:18081` → 200 desde el host; montaje `RW:false` |
| `privesc-linux-1`: bind de **un fichero** (`./setup.sh`) → `subpath: privesc-linux-1/setup.sh` | ✅ el fichero se monta y es de solo lectura (`touch` → read-only) |
| `docker compose config` con el override | ✅ el bind original desaparece; queda solo el volumen |
| `docker compose -p <proyecto> down -v` **sin** `-f` ni `--env-file` | ✅ apaga por etiqueta de proyecto: el runner no necesita las flags para apagar |
| El volumen `external` sobrevive a `down -v` | ✅ |

Conclusiones para la implementación:

- Se adopta el diseño del volumen de assets (no hace falta el plan B del mirror mount).
- `docker compose ls --all` lista **todos** los proyectos del host (también de otros proyectos del
  usuario): el runner filtra estrictamente por los nombres de proyecto del manifiesto.
- El runner usa `docker:29-cli` como base de la que copiar el CLI y el plugin compose.
- **privesc-linux-1 no se puede resolver hoy**: con `no-new-privileges` el SUID de `find` (busybox) y
  `sudo vim` no escalan (`NoNewPrivs: 1`; sudo lo dice explícitamente). T005 lo declara como excepción
  documentada del lint y vuelve a verificar los vectores.
