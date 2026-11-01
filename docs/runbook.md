# Runbook — operación de entornos

> Cómo arrancar, parar, depurar y hacer backup. Actualizado en F0; cada fase añade su sección.

## Prerrequisitos

- Docker Desktop 29+ (con Compose v5) corriendo.
- Node 22+ y pnpm 11 (`corepack enable` si falta).
- Copia de `.env.example` → `.env` en la raíz y en `infra/stacks/dev/`.

## Desarrollo

### Variante A — todo en Docker (verificada 2026-11-01)

```bash
# Variables del stack
cp infra/stacks/dev/.env.example infra/stacks/dev/.env   # ajusta secretos

# Levanta postgres + mailpit + api + web (hot-reload por volúmenes).
# El primer arranque instala dependencias dentro de los contenedores (~3 min);
# los siguientes arrancan en segundos gracias al volumen pnpm-store.
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env up -d

# Logs
docker compose --project-directory . -f infra/stacks/dev/compose.yaml logs -f api web

# Migraciones/seed desde host apuntando al postgres del stack (puerto publicado)
pnpm db:migrate && pnpm db:seed

# Parar (borra contenedores, conserva volúmenes de datos)
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env down
```

### Variante B — mixed (infra en Docker, dev servers en host; mejor DX en Windows)

```bash
docker compose --project-directory . -f infra/stacks/dev/compose.yaml --env-file infra/stacks/dev/.env up -d postgres mailpit
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev          # web :3000 + api :3001 con hot-reload
```

### Verificación de humo (smoke test)

```bash
curl -s http://localhost:3001/api/health        # espera {"status":"ok","db":"up"}
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/es   # 200
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/en   # 200
```

Puertos: web 3000 · api 3001 · postgres 5432 · mailpit UI 8025 / SMTP 1025.

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

## Producción (fase 008)

Stacks: `infra/stacks/proxy` (Caddy, TLS) + `infra/stacks/prod` (web+api+postgres).
Ambos se ejecutan con `--project-directory` EN SU PROPIA CARPETA (montan archivos
relativos: Caddyfile y secrets).

### Despliegue desde cero

```bash
# 1) Secretos (una vez; en Linux chmod 600 — en Windows NTFS no aplica)
cd infra/stacks/prod/secrets
openssl rand -hex 24 > postgres_password                  # SOLO alfanumérico (va en URL)
openssl rand -base64 32 | tr -d '\n=+/' > better_auth_secret
printf 'TuPasswordInicial-12345' > bootstrap_admin_password  # opcional (si no: se genera y loggea)
cd ../../..   # raíz del repo

# 2) Environments
cp infra/stacks/proxy/.env.example infra/stacks/proxy/.env   # SITE_ADDRESS (localhost o dominio)
cp infra/stacks/prod/.env.example  infra/stacks/prod/.env    # WEB_ORIGIN etc.

# 3) Proxy PRIMERO (define la red cyberarena_proxy)
docker compose --project-directory infra/stacks/proxy -f infra/stacks/proxy/compose.yaml --env-file infra/stacks/proxy/.env up -d

# 4) Producción (build + up; migraciones automáticas al arrancar la api)
docker compose --project-directory infra/stacks/prod -f infra/stacks/prod/compose.yaml --env-file infra/stacks/prod/.env up -d --build

# 5) Seed del contenido (one-off dentro de la red interna — ver abajo)
```

### Seed de contenido en producción

El catálogo viaja con la imagen pero el seed corre aparte (la red backend es
`internal: true` — sin egress — así que el one-off usa node+tsx directos):

```bash
PROD_PW=$(cat infra/stacks/prod/secrets/postgres_password)
MSYS_NO_PATHCONV=1 docker run --rm --network cyberarena-prod-backend \
  -v "$(pwd)/packages/content/dist:/app/content/dist:ro" \
  -e "DATABASE_URL=postgresql://cyberarena:${PROD_PW}@postgres:5432/cyberarena?schema=public" \
  --entrypoint sh cyberarena-prod-api \
  -c 'TSX=$(ls /app/node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs | head -1); cd /app/packages/database && node "$TSX" prisma/seed.ts'
```

(Regenera `packages/content/dist` antes con `pnpm --filter @repo/content build`.)

### Actualizar a una nueva versión

```bash
git pull && pnpm install && pnpm build     # valida todo
docker compose --project-directory infra/stacks/prod -f infra/stacks/prod/compose.yaml --env-file infra/stacks/prod/.env up -d --build
# el entrypoint aplica migraciones pendientes (MIGRATE_ON_BOOT=true); re-seed si cambió contenido
```

### TLS

- `SITE_ADDRESS=localhost` (default): certificado interno de Caddy. El navegador avisa
  hasta que confíes en la CA local (`docker cp cyberarena-proxy-caddy-1:/data/caddy/pki/authorities/local/root.crt`
  e importarla en el sistema).
- Dominio real: `SITE_ADDRESS=tudominio.com` + `ACME_EMAIL=...` → Let's Encrypt
  automático; añade `Strict-Transport-Security` al Caddyfile.

### Backups y restore

```bash
bash infra/scripts/backup-db.sh cyberarena-prod-postgres-1 cyberarena cyberarena backups 14
echo "cyberarena" | bash infra/scripts/restore-db.sh backups/<file>.sql.gz cyberarena-prod-postgres-1
```

Cron diario (Linux): `0 4 * * * cd /ruta/repo && bash infra/scripts/backup-db.sh ...`.

### Checklist de seguridad (ADR-006)

- [x] Contenedores no-root (10001 api/web; caps mínimas postgres/caddy) + `cap_drop: ALL`
- [x] `no-new-privileges` en todos; healthchecks en todos
- [x] Secretos por compose secrets (postgres/auth/bootstrap) — no en yaml ni env
- [x] Redes: `backend` interna (postgres sin egress), frontend, proxy pública
- [x] API/Postgres jamás publicados; solo Caddy 80/443 (443/udp HTTP/3)
- [x] Cabeceras: nosniff, DENY frames, referrer-policy, permissions-policy
- [x] Admin bootstrap solo con BD vacía (ADR-009); registro nunca otorga ADMIN

### Troubleshooting de producción

| Síntoma | Causa | Fix |
|---|---|---|
| 502 desde Caddy a web | Next standalone ligó al hostname del contenedor | `HOSTNAME: 0.0.0.0` en el env de web (ya en el compose) |
| `/api/*` 500 en prod | Los rewrites de Next son BUILD-TIME (no runtime) | Caddy enruta `/api/*` → api:3001 (ya en el Caddyfile; ADR-008 enmendado) |
| One-off no puede instalar nada | Red `backend` es `internal: true` (sin egress) — corepack/pnpm no descargan | Usar node + `node_modules/.pnpm/tsx@*/...` directos (comando de seed) |
| Puerto 5433 no accesible en Windows | Docker Desktop a veces no publica bindings loopback-only | Es operativa opcional: usa `docker exec` para psql/backup; o publica sin host_ip si tu red lo permite |
| `mount src not a directory` (Caddyfile) | compose corrido con project-directory incorrecto | Usar `--project-directory infra/stacks/proxy` |
| Migraciones no aplican | `MIGRATE_ON_BOOT` distinto de true | `docker compose logs api` para ver `[entrypoint]` |

## Solución de problemas

| Síntoma | Causa probable | Fix |
|---|---|---|
| `/api/health` devuelve `db: down` | Postgres aún arrancando o credenciales distintas | Espera healthcheck (`docker ps` → healthy) y revisa `DATABASE_URL` vs `POSTGRES_*` del stack `.env` |
| Web da 500 en `/es` | API caída (la landing consulta health opcionalmente) o `NEXT_PUBLIC_API_URL` mal | Verifica api con curl; revisa `.env` |
| Hot-reload no responde en Windows | inotify no cruza el mount | El compose usa polling (`CHOKIDAR_USEPOLLING`) para web; para api se reinicia con `--watch`; si persiste usa variante B |
| Puerto ocupado | Servicios previos | Cambia `API_PORT`/`WEB_PORT` en el `.env` del stack |
| Prisma `P1001` | `DATABASE_URL` apunta mal | Debe apuntar al host publicado (`localhost:5432`) desde host, y a `postgres:5432` dentro de la red del stack |

## Backups

```bash
# Backup (dump comprimido con fecha)
bash infra/scripts/backup-db.sh

# Restore (peligro: sobreescribe la BD destino)
gunzip -c backups/<archivo>.sql.gz | docker exec -i <contenedor-postgres> psql -U $POSTGRES_USER -d $POSTGRES_DB
```

Los backups del stack dev van a `backups/` (ignorado por git). En F8 se define rotación.

## Labs (F7 — patrón previsto)

```bash
docker compose -f labs/<room-slug>/compose.yaml up -d   # levanta el lab aislado
docker compose -f labs/<room-slug>/compose.yaml down -v # al terminar SIEMPRE down -v
```

Los labs NO publican puertos al host salvo los declarados en su compose; están en redes
internas aisladas. Nunca conectar un lab a las redes del stack de la app.
