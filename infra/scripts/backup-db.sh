#!/usr/bin/env bash
# Backup a CyberArena postgres container with rotation.
# Usage: bash infra/scripts/backup-db.sh <container> [db-user] [db-name] [out-dir] [keep-days]
#   prod: bash infra/scripts/backup-db.sh cyberarena-prod-postgres-1
#   dev:  bash infra/scripts/backup-db.sh cyberarena-dev-postgres-1
# The container is mandatory: no default that could silently pick the wrong stack.
set -euo pipefail

CONTAINER="${1:?usage: backup-db.sh <container> [db-user] [db-name] [out-dir] [keep-days]}"
DB_USER="${2:-cyberarena}"
DB_NAME="${3:-cyberarena}"
OUT_DIR="${4:-backups}"
KEEP_DAYS="${5:-14}"

mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/$DB_NAME-$STAMP.sql.gz"

docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$FILE"

# Rotate: remove backups older than KEEP_DAYS days.
if [ "$KEEP_DAYS" -gt 0 ]; then
  find "$OUT_DIR" -name "$DB_NAME-*.sql.gz" -mtime +"$KEEP_DAYS" -delete
fi

echo "backup written: $FILE (rotation: ${KEEP_DAYS}d)"
echo "restore with: bash infra/scripts/restore-db.sh $FILE $CONTAINER $DB_USER $DB_NAME"
