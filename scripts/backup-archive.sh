#!/usr/bin/env bash
# NFR-4.2: Ежедневный бэкап данных ПАПА.
# Запуск: cron 0 2 * * * /path/to/scripts/backup-archive.sh
# Или: npm run backup:archive

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
WORKSPACE="${WORKSPACE_ROOT:-$ROOT/data}"
BACKUP_DIR="${BACKUP_DIR:-$ROOT/backups}"
DATE=$(date +%Y-%m-%d)
STAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
ARCHIVE="$BACKUP_DIR/papa-backup-$STAMP.tar.gz"

echo "[backup] Starting backup to $ARCHIVE"

# Архивируем data/ (workspace)
if [ -d "$WORKSPACE" ]; then
  tar -czf "$ARCHIVE" -C "$(dirname "$WORKSPACE")" "$(basename "$WORKSPACE")" 2>/dev/null || true
  echo "[backup] Workspace archived"
fi

# Если архив пустой, пробуем data в корне
if [ ! -s "$ARCHIVE" ] && [ -d "$ROOT/data" ]; then
  tar -czf "$ARCHIVE" -C "$ROOT" data 2>/dev/null || true
  echo "[backup] data/ archived"
fi

# SQLite если есть
if [ -f "$ROOT/data/00_SYSTEM/db/papa.sqlite" ]; then
  cp "$ROOT/data/00_SYSTEM/db/papa.sqlite" "$BACKUP_DIR/papa-$STAMP.sqlite" 2>/dev/null || true
  echo "[backup] SQLite copied"
fi

echo "[backup] Done: $ARCHIVE"

# Ротация: оставляем последние 90 дней (см. config/retention-policy.json)
find "$BACKUP_DIR" -name "papa-backup-*.tar.gz" -mtime +90 -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "papa-*.sqlite" -mtime +90 -delete 2>/dev/null || true
