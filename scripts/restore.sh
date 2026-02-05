#!/usr/bin/env bash
# Восстановление из бэкапа (custom format).
# Использование: ./scripts/restore.sh backup.dump
# ВНИМАНИЕ: --clean удаляет объекты перед восстановлением.
set -e
cd "$(dirname "$0")/.."
if [ -f .env ] && [ -z "${DATABASE_URL}" ]; then
  export $(grep -E '^DATABASE_URL=' .env | xargs)
fi
: "${DATABASE_URL:?DATABASE_URL required. Set in .env or export.}"
: "${1:?Usage: $0 backup.dump}"
pg_restore --clean --if-exists --no-owner --no-acl -d "$DATABASE_URL" "$1"
echo "Restored: $1"
