#!/usr/bin/env bash
# Backup the CyberArena database from a running postgres container.
# Usage: bash infra/scripts/backup-db.sh [container-name] [db-user] [db-name]
# Defaults target the dev stack container name cyberarena-dev-postgres-1.
set -euo pipefail

CONTAINER="${1:-cyberarena-dev-postgres-1}"
DB_USER="${2:-cyberarena}"
DB_NAME="${3:-cyberarena}"
OUT_DIR="${4:-backups}"

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/$DB_NAME-$STAMP.sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"
echo "backup written: $FILE"
echo "restore with: gunzip -c $FILE | docker exec -i $CONTAINER psql -U $DB_USER -d $DB_NAME"
