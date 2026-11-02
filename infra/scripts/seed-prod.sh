#!/usr/bin/env bash
# Seeds (or re-seeds: idempotent) the production database from the content
# baked into the API image (packages/content/dist). Run it after every API
# image rebuild: Spanish content comes from the database, English from the
# image, and they must match. From the repo root:
#   bash infra/scripts/seed-prod.sh
# The database password is read inside the container and never leaves it.
set -euo pipefail
export MSYS_NO_PATHCONV=1

docker compose --project-directory infra/stacks/prod -f infra/stacks/prod/compose.yaml \
  --env-file infra/stacks/prod/.env exec -T api sh -c '
    set -e
    export DATABASE_URL="postgresql://${DB_USER}:$(tr -d "\r\n" < /run/secrets/postgres_password)@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
    TSX=$(ls /app/node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs | head -1)
    cd /app/packages/database
    node "$TSX" prisma/seed.ts
  '
