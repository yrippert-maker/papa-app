#!/usr/bin/env bash
# Ручной бэкап Postgres (custom format для pg_restore).
# Использование: ./scripts/backup.sh [output.dump]
# Требует: DATABASE_URL в .env или в окружении.
set -e
cd "$(dirname "$0")/.."
if [ -f .env ] && [ -z "${DATABASE_URL}" ]; then
  export $(grep -E '^DATABASE_URL=' .env | xargs)
fi
: "${DATABASE_URL:?DATABASE_URL required. Set in .env or export.}"
OUT="${1:-backup-$(date +%Y%m%d-%H%M%S).dump}"
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-acl -f "$OUT"
echo "Backup: $OUT ($(du -h "$OUT" | cut -f1))"
