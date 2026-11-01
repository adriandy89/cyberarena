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
