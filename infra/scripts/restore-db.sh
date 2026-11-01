#!/usr/bin/env bash
# Restore a CyberArena database from a backup produced by backup-db.sh.
# DANGER: overwrites the target database. Usage:
#   bash infra/scripts/restore-db.sh backups/<file>.sql.gz [container] [db-user] [db-name]
set -euo pipefail

FILE="${1:?usage: restore-db.sh <file.sql.gz> [container] [db-user] [db-name]}"
CONTAINER="${2:-cyberarena-dev-postgres-1}"
DB_USER="${3:-cyberarena}"
DB_NAME="${4:-cyberarena}"

[ -f "$FILE" ] || { echo "backup not found: $FILE"; exit 1; }

read -r -p "This will DROP and recreate '$DB_NAME' in $CONTAINER. Type the db name to confirm: " CONFIRM
[ "$CONFIRM" = "$DB_NAME" ] || { echo "aborted"; exit 1; }

docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME';" >/dev/null
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
gunzip -c "$FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "restore complete: $FILE -> $CONTAINER/$DB_NAME"
