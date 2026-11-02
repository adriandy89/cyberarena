#!/usr/bin/env bash
# Restore a CyberArena database from a backup produced by backup-db.sh.
# DANGER: drops and recreates the TARGET database. Container and target db are
# mandatory (no defaults). Usage:
#   bash infra/scripts/restore-db.sh <file.sql.gz> <container> <db-user> <target-db>
# Safe drill (prod untouched): restore into a scratch database, compare, drop it:
#   echo cyberarena_restore | bash infra/scripts/restore-db.sh backups/<file>.sql.gz \n#     cyberarena-prod-postgres-1 cyberarena cyberarena_restore
set -euo pipefail

USAGE="usage: restore-db.sh <file.sql.gz> <container> <db-user> <target-db>"
FILE="${1:?$USAGE}"
CONTAINER="${2:?$USAGE}"
DB_USER="${3:?$USAGE}"
DB_NAME="${4:?$USAGE}"

[ -f "$FILE" ] || { echo "backup not found: $FILE"; exit 1; }
echo "target: container=$CONTAINER database=$DB_NAME (user $DB_USER)"
echo "source: $FILE"

read -r -p "This will DROP and recreate '$DB_NAME' in $CONTAINER. Type the db name to confirm: " CONFIRM
[ "$CONFIRM" = "$DB_NAME" ] || { echo "aborted"; exit 1; }

docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='$DB_NAME';" >/dev/null
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
docker exec "$CONTAINER" psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"
gunzip -c "$FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME"
echo "restore complete: $FILE -> $CONTAINER/$DB_NAME"
