# Runbook — operación de entornos

> Cómo arrancar, parar, depurar y hacer backup. Actualizado en F0; cada fase añade su sección
> (producción y labs bajo demanda verificados en las fases 011 y 012, 2026-11-02).

## Prerrequisitos

- Docker Desktop 29+ (con Compose v5) corriendo.
- Node 22+ y pnpm 11 (`corepack enable` si falta).
- Copia de `.env.example` → `.env` en `infra/stacks/dev/` (y en la raíz para la variante B).

## Desarrollo

Las dos variantes se verificaron desde un clon limpio el 2026-11-02 (fase 014); son las que explica el
`README.md`.

### Variante A — todo en Docker (solo hace falta Docker)

```bash
# Variables del stack (los valores por defecto sirven tal cual)
cp infra/stacks/dev/.env.example infra/stacks/dev/.env

# Levanta postgres + mailpit + api + web (hot-reload por volúmenes). El api instala
# dependencias, compila los paquetes compartidos, migra y hace el seed ANTES de
# arrancar (idempotente); la web espera a que el api esté sano. Primer arranque
# ~3-4 min (`up` vuelve cuando el api está listo); los siguientes, segundos.
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env up -d

# Contraseña del admin inicial (si no fijaste BOOTSTRAP_ADMIN_PASSWORD)
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env logs api | grep "initial admin"

# Logs
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env logs -f api web

# Recargar el contenido tras editarlo: el reinicio recompila y repite el seed
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env restart api

# Parar (borra contenedores, conserva volúmenes de datos)
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env down
```

Todos los comandos llevan `--env-file`: el compose exige `POSTGRES_PASSWORD` incluso para `logs`.

### Variante B — mixed (infra en Docker, dev servers en host; mejor DX en Windows)

```bash
corepack enable && pnpm install
cp .env.example .env                       # DATABASE_URL ya coincide con el stack de dev
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env up -d postgres mailpit
pnpm build                                 # un clon limpio no tiene dist/ ni el catálogo compilado
pnpm db:migrate && pnpm db:seed
pnpm dev          # web :3000 + api :3001 con hot-reload (el api lee el .env de la raíz)
```

No mezcles las dos variantes sobre la misma carpeta a la vez: comparten `apps/web/.next` y `next dev`
se niega a arrancar si el otro sigue vivo.

### Verificación de humo (smoke test)

```bash
curl -s http://localhost:3001/api/health        # espera {"status":"ok","db":"up"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/es   # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en   # 200
```

Puertos: web 3000 · api 3001 · postgres 5432 · mailpit UI 8025 / SMTP 1025 (en `127.0.0.1`).

## Autenticación (fase 001)

- **Admin inicial (ADR-009)**: al arrancar la API, si la tabla `User` está vacía se crea
  automáticamente `BOOTSTRAP_ADMIN_EMAIL` (default `admin@cyberarena.local`) con
  `BOOTSTRAP_ADMIN_PASSWORD` (o una contraseña aleatoria que se muestra UNA vez en el
  log del arranque — cámbiala tras el primer login). **Registrarse nunca otorga ADMIN**:
  todos los registros nacen STUDENT y los roles solo cambian vía endpoint admin. En cada
  arranque se verifica que exista al menos un admin (si no, ERROR en el log).
- La web habla con la API por el rewrite same-origin `/api` (ADR-008): la cookie de
  sesión es de primer partido y no hay CORS cross-port.
- **Verificación de email / reset de contraseña en dev**: `REQUIRE_EMAIL_VERIFICATION`
  en el `.env` del stack (default `false`). Los emails salen por Mailpit:
  - UI: http://localhost:8025
  - API REST (para scripts): `curl -s http://localhost:8025/api/v1/messages | jq`
  - Flujo de reset con curl (a través del rewrite de la web, puerto 3000; nota: los
    POST con cookie de sesión requieren cabecera `Origin` de confianza):
    ```bash
    curl -s -X POST http://localhost:3000/api/auth/request-password-reset \
      -H 'Content-Type: application/json' -H 'Origin: http://localhost:3000' \
      -d '{"email":"admin@example.com","redirectTo":"/es/login"}'
    # el enlace llega a Mailpit; abrirlo verifica/resetea vía GET /api/auth/reset-password/...
    ```
- Cambiar roles: dashboard → panel "Usuarios (admin)", o
  `PATCH /api/users/<id>/role` con body `{"role":"ADMIN"|"STUDENT"}` (un admin no
  puede cambiarse su propio rol).
- Crear cuenta dev rápidamente:
  ```bash
  curl -s -c cookies.txt -X POST http://localhost:3000/api/auth/sign-up/email \
    -H 'Content-Type: application/json' \
    -d '{"name":"Ada","email":"ada@example.com","password":"supersecret1"}'
  curl -s -b cookies.txt http://localhost:3000/api/users/me
  ```

## Contenido (fase 002)

El catálogo es código (`packages/content`, ver `docs/content-guide.md`):

```bash
pnpm --filter @repo/content build   # valida MDX/JSON → dist/catalog.json (rompe si es inválido)
pnpm db:seed                        # sincroniza el catálogo a BD (idempotente, respuestas hasheadas)
curl -s http://localhost:3001/api/catalog            # verificar
curl -s http://localhost:3001/api/catalog/rooms/<slug> | jq '.tasks[].questions[] | .id'
```

- El seed **borra** filas del catálogo ausentes en el fuente (los ids/slugs son estables:
  renombrar rompe progreso — ver guide §reglas).
- Las respuestas viven hasheadas (sha256) en la tabla `Answer`, jamás expuestas por la API.

## Producción (fases 008 y 012)

Stacks: `infra/stacks/proxy` (Caddy, TLS) + `infra/stacks/prod` (postgres, api, web, lab-runner).
Ambos se ejecutan con `--project-directory` EN SU PROPIA CARPETA (montan archivos relativos:
Caddyfile, secretos y flags de labs). Despliegue verificado de punta a punta el 2026-11-02 (registro en
`specs/012-despliegue-docker/tasks.md`).

**Servidor de la LAN sin proxy (fase 013):** `infra/stacks/lan/` reutiliza este compose de prod con un
overlay. La web se publica en `WEB_PORT` (3080) por HTTP, los labs en la IP de la LAN y la configuración
vive fuera del clon (`~/cyberarena/stack`, `./cyberarena.sh init|up|update|backup|labs`). Pasos en
`infra/stacks/lan/README.md`. Desplegado en `http://192.168.1.20:3080` el 2026-11-02.

### Despliegue desde cero

```bash
# 1) Secretos (una vez): ver infra/stacks/prod/secrets/README.md. En Windows, el openssl de
#    Git Bash escribe CRLF: los comandos del README ya lo quitan (`tr -d '\r\n'`).

# 2) Environments
cp infra/stacks/proxy/.env.example infra/stacks/proxy/.env   # SITE_ADDRESS (localhost o dominio)
cp infra/stacks/prod/.env.example  infra/stacks/prod/.env    # WEB_ORIGIN, LABS_ENABLED…

# 3) Flags de los labs para el runner (directorio montado de solo lectura)
bash infra/scripts/lab-flags.sh infra/stacks/prod/lab-flags

# 4) Comprobaciones (secretos sin \r y válidos, flags, puertos, versiones de Docker; no muestra valores)
bash infra/scripts/prod-preflight.sh

# 5) Proxy PRIMERO (define la red cyberarena_proxy)
docker compose --project-directory infra/stacks/proxy -f infra/stacks/proxy/compose.yaml --env-file infra/stacks/proxy/.env up -d

# 6) Producción (build + up; la api aplica migraciones al arrancar, sin red)
docker compose --project-directory infra/stacks/prod -f infra/stacks/prod/compose.yaml --env-file infra/stacks/prod/.env up -d --build

# 7) Seed del contenido (idempotente; repítelo tras CADA rebuild de la api)
bash infra/scripts/seed-prod.sh

# 8) Smoke: TLS con la CA de Caddy, health, catálogo ES/EN, login admin, PDF, 118 páginas de rooms
node infra/scripts/smoke-prod.mjs
```

**Un solo lab-runner por host Docker.** Si el dev stack tiene su runner (`--profile labs`) encendido,
para el de dev antes de levantar prod: los dos gestionarían los mismos proyectos `lab-*` y cada uno
apagaría los labs que el otro arranca.

### Seed de contenido en producción

`seed-prod.sh` ejecuta el seed **dentro** del contenedor de la api con el contenido horneado en la imagen
(`packages/content/dist`), y la contraseña de la BD nunca sale del contenedor. El español sale de la BD
y el inglés de la imagen: tras cada rebuild de la api, vuelve a ejecutar el seed para que coincidan.

### Actualizar a una nueva versión

```bash
git pull && pnpm install && pnpm build     # valida todo (incluido el lint de labs)
bash infra/scripts/prod-preflight.sh
docker compose --project-directory infra/stacks/prod -f infra/stacks/prod/compose.yaml --env-file infra/stacks/prod/.env up -d --build
bash infra/scripts/seed-prod.sh && node infra/scripts/smoke-prod.mjs
```

### E2E contra producción

```bash
cd apps/web
E2E_NO_SERVER=1 E2E_BASE_URL=https://localhost E2E_API_URL=https://localhost pnpm exec playwright test
```

El harness usa la cookie `__Secure-` y acepta la CA interna de Caddy; `apiLogin` espera si el limitador
de better-auth responde 429 (3 inicios de sesión / 10 s / IP en producción). El test del reaper solo corre
con `LAB_IDLE_TIMEOUT_MIN=1` (ver «Labs bajo demanda»).

### TLS

- `SITE_ADDRESS=localhost` (default): certificado interno de Caddy. Para que el navegador confíe:
  `docker cp cyberarena-proxy-caddy-1:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt` y, en
  Windows, `certutil -user -addstore Root caddy-root.crt`. Con curl: `--cacert caddy-root.crt`.
- Usa siempre `https://localhost` (el certificado no cubre `127.0.0.1`).
- Dominio real: `SITE_ADDRESS=tudominio.com` + `ACME_EMAIL=...` → Let's Encrypt automático; añade
  `Strict-Transport-Security` al Caddyfile.

### Backups y restore

Los scripts exigen contenedor y BD destino explícitos (ya no hay valores por defecto que apunten a dev).

```bash
# Backup con rotación (14 días) → backups/cyberarena-<fecha>.sql.gz
bash infra/scripts/backup-db.sh cyberarena-prod-postgres-1 cyberarena cyberarena backups 14

# Simulacro sin tocar producción: restaurar en una BD scratch, comparar y borrarla
echo cyberarena_restore | bash infra/scripts/restore-db.sh backups/<file>.sql.gz cyberarena-prod-postgres-1 cyberarena cyberarena_restore
docker exec cyberarena-prod-postgres-1 psql -U cyberarena -d cyberarena_restore -tAc 'SELECT count(*) FROM "User"'
docker exec cyberarena-prod-postgres-1 psql -U cyberarena -d postgres -c 'DROP DATABASE cyberarena_restore'

# Restore real (DROP + CREATE de la BD de producción): escribe el nombre para confirmar
bash infra/scripts/restore-db.sh backups/<file>.sql.gz cyberarena-prod-postgres-1 cyberarena cyberarena
```

Cron diario (Linux): `0 4 * * * cd /ruta/repo && bash infra/scripts/backup-db.sh cyberarena-prod-postgres-1`.

### Checklist de seguridad (ADR-006, ADR-015)

- [x] Contenedores no-root (10001 api/web; caps mínimas postgres/caddy) + `cap_drop: ALL`
- [x] `no-new-privileges` y healthchecks en todos (también Caddy y el lab-runner)
- [x] Secretos por compose secrets (postgres/auth/bootstrap/lab-runner) — no en yaml ni env; sin `\r`
- [x] Redes: `backend` interna (postgres sin egress), `labs-control` interna (solo api ↔ runner),
      frontend, proxy pública
- [x] Solo Caddy publica puertos (80/443); Postgres no publica ninguno (red interna; operación con
      `docker exec`)
- [x] lab-runner: único con `docker.sock`, sin puertos, token, manifiesto de labs inmutable, lint
      de composes, `read_only`; corre como root (excepción documentada en ADR-015)
- [x] Labs: `127.0.0.1`, `cap_drop: ALL`, `no-new-privileges` (salvo excepción documentada),
      límites de CPU/memoria/procesos, `restart: "no"`
- [x] Rate limit por IP real del cliente (`trust proxy`) y limitador propio de better-auth
- [x] Cabeceras: nosniff, DENY frames, referrer-policy, permissions-policy
- [x] Admin bootstrap solo con BD vacía (ADR-009); registro nunca otorga ADMIN

### Troubleshooting de producción

| Síntoma | Causa | Fix |
|---|---|---|
| La api no conecta a Postgres (auth failed) en el primer arranque | Secreto con `\r` (CRLF): Postgres guarda la contraseña con `\r` | `prod-preflight.sh` lo detecta; quitar el `\r` y recrear el volumen `pgdata` si ya se inicializó |
| 502 desde Caddy a web | Next standalone ligó al hostname del contenedor | `HOSTNAME: 0.0.0.0` en el env de web (ya en el compose) |
| `/api/*` 404/500 en web:3000 directo | Los rewrites de Next son BUILD-TIME | La imagen se construye con `API_URL=http://api:3001`; por Caddy, `/api/*` va directo a la api |
| Inglés vacío o en español tras un rebuild | El seed no se repitió | `bash infra/scripts/seed-prod.sh` |
| Build: `cannot be accessed by the system` en `node_modules` | Enlaces de Linux escritos por contenedores de dev en el host | `rm -rf <paquete>/node_modules && pnpm install` (el compose de dev ya aísla todos) |
| Labs que se apagan solos a los 5 min | Hay dos lab-runners en el mismo host | Deja solo uno (para el de dev) |
| Linux: la api no arranca (`EACCES` en `/run/secrets/…`) o los labs quedan `unavailable` | Compose monta los secretos con los permisos del host; la api corre como uid 10001 | Secretos 644 dentro de una carpeta 700; `lab-flags/` 755 y sus `*.env` 644 (`cyberarena.sh init` y `lab-flags.sh` ya lo aplican) |
| `mount src not a directory` (Caddyfile) | compose corrido con project-directory incorrecto | Usar `--project-directory infra/stacks/proxy` |
| Migraciones no aplican | `MIGRATE_ON_BOOT` distinto de true | `docker compose logs api` para ver `[entrypoint]` |

## Labs bajo demanda (fase 011)

El estudiante arranca el lab desde la página del room; el **lab-runner** (único servicio con
`docker.sock`, ADR-015) lo levanta y tres capas lo apagan cuando nadie lo usa:

1. **Reaper de la api** (cada `LAB_SWEEP_SECONDS`): caduca reservas sin latido (`LAB_IDLE_TIMEOUT_MIN`,
   10) o pasadas de su máximo (2 h, ampliable a 4 h), apaga los labs sin reservas y renueva el plazo de
   los demás en el runner.
2. **Plazos del runner**: si la api o la BD caen, cada lab muere al vencer su plazo (≤ 5 min). Los
   proyectos `lab-*` que encuentra sin plazo (levantados a mano) se adoptan con 5 min de gracia.
3. **`restart: "no"`** en todos los labs; SIGTERM al runner apaga todos los labs.

```bash
# Estado y operación (dentro del contenedor del runner, mismas reglas que la api)
docker exec cyberarena-prod-lab-runner-1 node dist/cli.js health
docker exec cyberarena-prod-lab-runner-1 node dist/cli.js ls
docker exec cyberarena-prod-lab-runner-1 node dist/cli.js up <slug> --wait
docker exec cyberarena-prod-lab-runner-1 node dist/cli.js down <slug>
docker exec cyberarena-prod-lab-runner-1 node dist/cli.js down-all          # parada de emergencia

# Smoke de todos los labs (up, sondeo HTTP o exec desde el host, down)
node infra/scripts/labs-smoke.mjs --runner cyberarena-prod-lab-runner-1
```

- **Interruptor general**: `LABS_ENABLED=false` en `infra/stacks/prod/.env` → el LabPanel vuelve a los
  comandos manuales. Desde la web, un admin tiene «Detener todos» en su dashboard.
- **Revisión periódica**: `/api/health` (bloque `labs`) y `/status` muestran si el runner responde, cuántos
  labs corren y si el barrido está al día; el estado pasa a `degraded` si el runner cae o el barrido lleva
  3 intervalos sin ejecutarse. El dashboard de admin lista labs en uso, reservas y últimos eventos.
- **Probar el reaper**: `LAB_IDLE_TIMEOUT_MIN=1 LAB_SWEEP_SECONDS=10 docker compose … up -d api` y vuelve a
  los valores por defecto al terminar.
- **Flags**: `bash infra/scripts/lab-flags.sh <dir>` copia `labs/<slug>/flags.env` (si existe) o
  `flags.env.example` al directorio que monta el runner; un lab sin fichero queda «no disponible».
- **Dev**: `docker compose … --profile labs up -d lab-runner` con `LAB_RUNNER_TOKEN` en
  `infra/stacks/dev/.env` y flags en `infra/stacks/dev/lab-flags`; `LABS_ENABLED=true` en la api.
- **Manual (sin runner)**: `docker compose -f labs/<slug>/compose.yaml --env-file labs/<slug>/flags.env.example up -d`
  y `docker compose -p lab-<slug> down -v` (con el runner activo, un lab manual se apaga a los 5 min).

## Solución de problemas

| Síntoma | Causa probable | Fix |
|---|---|---|
| `/api/health` devuelve `db: down` | Postgres aún arrancando o credenciales distintas | Espera healthcheck (`docker ps` → healthy) y revisa `DATABASE_URL` vs `POSTGRES_*` del stack `.env` |
| Web da 500 en `/es` | API caída o `API_URL` mal (server-side, y horneado en el build para el rewrite `/api`) | Verifica la api con curl; revisa `API_URL` |
| Hot-reload no responde en Windows | inotify no cruza el mount | El compose usa polling (`CHOKIDAR_USEPOLLING`) para web; para api se reinicia con `--watch`; si persiste usa variante B |
| La web de dev en contenedor no ve un fichero nuevo | El watcher no detecta altas en el bind mount de Windows | `docker compose … restart web` |
| La web de dev no hidrata en `127.0.0.1` | `next dev` (Next 16) bloquea recursos de dev de otro origen | Abre `http://localhost:3000` |
| Puerto ocupado | Servicios previos | Cambia `API_PORT`/`WEB_PORT` en el `.env` del stack |
| Prisma `P1001` | `DATABASE_URL` apunta mal | Debe apuntar al host publicado (`localhost:5432`) desde host, y a `postgres:5432` dentro de la red del stack |

## Disco de Docker en Windows

Docker Desktop guarda todo en `%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx`, que **crece pero no
encoge solo**. Limpiar dentro de Docker (`docker builder prune -a`, `docker image prune -a`) libera espacio
para Docker, no para Windows. Para devolverlo a C::

```bash
# 1) Liberar bloques dentro de la VM (marca como libre lo borrado)
docker run --rm --privileged --pid=host alpine:3.20 nsenter -t 1 -m -u -n -i fstrim -av
# 2) En un PowerShell de ADMINISTRADOR, con Docker Desktop cerrado y tras `wsl --shutdown`:
#    diskpart → select vdisk file="%LOCALAPPDATA%\Docker\wsl\disk\docker_data.vhdx"
#               attach vdisk readonly → compact vdisk → detach vdisk
```

El 2026-11-02 esto devolvió 63 GB (123,8 → 60,5 GB). Nunca borres volúmenes (`docker volume prune`) sin
revisar qué datos contienen: son de todos tus proyectos.
