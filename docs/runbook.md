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
