#!/usr/bin/env bash
# CyberArena LAN deployment helper (phase 013).
#
# Lives in the git clone; you run it through a symlink in your stack folder,
# which holds everything server-specific (.env, secrets/, lab-flags/, backups/):
#
#   ~/cyberarena/stack/cyberarena.sh -> ~/cyberarena/repo/infra/stacks/lan/cyberarena.sh
#
# Nothing is ever written inside the clone, so `git pull` stays clean.
set -euo pipefail

STACK_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$(dirname "$(readlink -f "$0")")/../../.." && pwd)"
PROJECT=cyberarena-prod

case "$STACK_DIR/" in
  "$REPO_DIR"/*)
    echo "Run this through the link in your stack folder (outside the clone):" >&2
    echo "  mkdir -p ~/cyberarena/stack && ln -s $REPO_DIR/infra/stacks/lan/cyberarena.sh ~/cyberarena/stack/" >&2
    exit 2 ;;
esac

dc() {
  docker compose --project-directory "$STACK_DIR" \
    -f "$REPO_DIR/infra/stacks/prod/compose.yaml" \
    -f "$REPO_DIR/infra/stacks/lan/compose.yaml" \
    --env-file "$STACK_DIR/.env" "$@"
}

env_value() {
  grep -E "^$1=" "$STACK_DIR/.env" 2>/dev/null | tail -1 | cut -d= -f2-
}

lan_ip() {
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}

# Writes a secret only if it does not exist yet (never rotates silently).
new_secret() {
  local file="$STACK_DIR/secrets/$1" value="$2"
  [ -s "$file" ] && return 1
  printf '%s' "$value" > "$file"
}

# Compose secrets are bind-mounted with their host permissions: the api runs as
# uid 10001 and must read them, so files are 644 and the folder 700 (no other
# host user can reach them).
fix_permissions() {
  chmod 700 "$STACK_DIR/secrets" "$STACK_DIR/backups"
  chmod 644 "$STACK_DIR"/secrets/* 2>/dev/null || true
  chmod 600 "$STACK_DIR/.env"
}

cmd_init() {
  local ip="${1:-$(lan_ip)}"
  [ -n "$ip" ] || { echo "Could not detect the LAN IP: ./cyberarena.sh init <ip>" >&2; exit 1; }
  umask 077
  mkdir -p "$STACK_DIR/secrets" "$STACK_DIR/lab-flags" "$STACK_DIR/backups"
  if [ ! -f "$STACK_DIR/.env" ]; then
    sed -e "s#__REPO_DIR__#$REPO_DIR#g" -e "s#__LAN_IP__#$ip#g" "$REPO_DIR/infra/stacks/lan/env.example" > "$STACK_DIR/.env"
    echo "created .env for https://$ip"
  else
    echo ".env exists: kept"
  fi
  new_secret postgres_password "$(openssl rand -hex 24)" && echo "created secrets/postgres_password" || true
  new_secret better_auth_secret "$(openssl rand -base64 48 | tr -d '\n=+/' | cut -c1-48)" \
    && echo "created secrets/better_auth_secret" || true
  new_secret lab_runner_token "$(openssl rand -hex 32)" && echo "created secrets/lab_runner_token" || true
  local admin
  admin="$(openssl rand -base64 24 | tr -d '\n=+/' | cut -c1-20)"
  if new_secret bootstrap_admin_password "$admin"; then
    echo "created secrets/bootstrap_admin_password"
    echo
    echo "  Initial admin: $(grep -E '^BOOTSTRAP_ADMIN_EMAIL=' "$STACK_DIR/.env" | cut -d= -f2) / $admin"
    echo "  (also stored in $STACK_DIR/secrets/bootstrap_admin_password)"
    echo
  fi
  bash "$REPO_DIR/infra/scripts/lab-flags.sh" "$STACK_DIR/lab-flags"
  fix_permissions
}

cmd_preflight() {
  local fail=0
  ok() { printf '  ok    %s\n' "$1"; }
  bad() { printf '  FAIL  %s\n' "$1"; fail=1; }
  [ -s "$STACK_DIR/.env" ] && ok ".env" || bad ".env missing (./cyberarena.sh init)"
  for name in postgres_password better_auth_secret bootstrap_admin_password lab_runner_token; do
    local f="$STACK_DIR/secrets/$name"
    if [ ! -s "$f" ]; then bad "secrets/$name missing (./cyberarena.sh init)"; continue; fi
    if [ "$(tr -cd '\r' < "$f" | wc -c)" != 0 ]; then bad "secrets/$name contains a carriage return"; continue; fi
    if [ "$(stat -c %a "$f")" != 644 ]; then bad "secrets/$name must be 644 (./cyberarena.sh init fixes it)"; continue; fi
    ok "secrets/$name"
  done
  if tr -d '\n' < "$STACK_DIR/secrets/postgres_password" 2>/dev/null | grep -q '[^A-Za-z0-9]'; then
    bad "postgres_password must be alphanumeric"
  fi
  local labs flags
  labs=$(find "$REPO_DIR/labs" -mindepth 2 -maxdepth 2 -name compose.yaml -not -path '*/_*' | wc -l)
  flags=$(find "$STACK_DIR/lab-flags" -name '*.env' 2>/dev/null | wc -l)
  [ "$flags" -ge "$labs" ] && ok "$flags lab flag files" || bad "$flags/$labs lab flag files (./cyberarena.sh init)"
  local web_port
  web_port=$(env_value WEB_PORT)
  for port in "${web_port:-3080}" "$(env_value POSTGRES_PORT)"; do
    if ss -ltnH "( sport = :$port )" | grep -q .; then
      if docker ps --filter "label=com.docker.compose.project=$PROJECT" --format '{{.Ports}}' | grep -q ":$port->"; then
        ok "port $port (this stack)"
      else
        bad "port $port is used by something else"
      fi
    else
      ok "port $port free"
    fi
  done
  [ "$fail" = 0 ] && echo "preflight OK" || { echo "preflight FAILED"; return 1; }
}

cmd_seed() {
  dc exec -T api sh -c '
    set -e
    export DATABASE_URL="postgresql://${DB_USER}:$(tr -d "\r\n" < /run/secrets/postgres_password)@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public"
    TSX=$(ls /app/node_modules/.pnpm/tsx@*/node_modules/tsx/dist/cli.mjs | head -1)
    cd /app/packages/database
    node "$TSX" prisma/seed.ts
  ' 2>&1 | grep -v 'prisma:warn'
}

cmd_up() {
  cmd_preflight
  dc up -d --build --wait --remove-orphans
  cmd_seed
  echo "CyberArena is up: $(env_value WEB_ORIGIN)"
}

cmd_update() {
  git -C "$REPO_DIR" pull --ff-only
  bash "$REPO_DIR/infra/scripts/lab-flags.sh" "$STACK_DIR/lab-flags"
  fix_permissions
  cmd_up
}

cmd_destroy() {
  echo "This removes the containers AND the data (database, certificates) of $PROJECT."
  read -r -p "Type 'destroy' to confirm: " answer
  [ "$answer" = destroy ] || { echo "aborted"; exit 1; }
  dc down -v
}

usage() {
  cat <<EOF
Usage: ./cyberarena.sh <command>
  init [ip]     create .env, secrets and lab flags (never overwrites existing ones)
  preflight     check config, secrets and ports
  up            build, start (waits for healthy) and seed
  update        git pull --ff-only in the clone, then up
  seed          (re)load the content into the database
  ps | logs [service...]
  down          stop and remove the containers (data kept)
  destroy       down AND delete the data volumes (asks first)
  backup        dump the database into ./backups (14-day rotation)
  labs <cmd>    lab-runner CLI: health | ls | up <slug> [--wait] | down <slug> | down-all
Stack: $STACK_DIR
Repo:  $REPO_DIR
EOF
}

cmd="${1:-help}"
[ $# -gt 0 ] && shift
case "$cmd" in
  init) cmd_init "$@" ;;
  preflight) cmd_preflight ;;
  up) cmd_up ;;
  update) cmd_update ;;
  seed) cmd_seed ;;
  ps) dc ps ;;
  logs) dc logs -f --tail=100 "$@" ;;
  down) dc down ;;
  destroy) cmd_destroy ;;
  backup) bash "$REPO_DIR/infra/scripts/backup-db.sh" "$PROJECT-postgres-1" cyberarena cyberarena "$STACK_DIR/backups" 14 ;;
  labs) docker exec "$PROJECT-lab-runner-1" node dist/cli.js "$@" ;;
  *) usage ;;
esac
