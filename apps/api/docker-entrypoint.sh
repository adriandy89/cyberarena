#!/bin/sh
# Production entrypoint for the CyberArena API container.
# - Loads Docker compose secrets (files under /run/secrets) into the environment.
# - Builds DATABASE_URL from parts + secret password when not provided.
# - Optionally runs database migrations before booting the app.
# Needs no network: no corepack/pnpm at runtime (phase 012).
set -e

# Secret files may end with a newline or CRLF (edited on Windows): strip both,
# or the password stored by postgres and the one in DATABASE_URL would differ.
read_secret() {
  tr -d '\r\n' < "$1"
}

if [ -f /run/secrets/better_auth_secret ]; then
  export BETTER_AUTH_SECRET="$(read_secret /run/secrets/better_auth_secret)"
fi

if [ -f /run/secrets/postgres_password ]; then
  export POSTGRES_PASSWORD="$(read_secret /run/secrets/postgres_password)"
fi

if [ -f /run/secrets/bootstrap_admin_password ]; then
  export BOOTSTRAP_ADMIN_PASSWORD="$(read_secret /run/secrets/bootstrap_admin_password)"
fi

if [ -z "${DATABASE_URL:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ]; then
  # NOTE: keep the password URL-safe (alphanumerics) — see infra/stacks/prod/secrets.
  export DATABASE_URL="postgresql://${DB_USER:-cyberarena}:${POSTGRES_PASSWORD}@${DB_HOST:-postgres}:${DB_PORT:-5432}/${DB_NAME:-cyberarena}?schema=public"
fi

if [ "${MIGRATE_ON_BOOT:-false}" = "true" ]; then
  echo "[entrypoint] running prisma migrate deploy"
  (cd /app/packages/database && ./node_modules/.bin/prisma migrate deploy)
fi

exec node apps/api/dist/main.js
