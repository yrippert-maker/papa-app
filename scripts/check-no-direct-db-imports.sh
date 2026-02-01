#!/bin/bash
# CI guard: no direct better-sqlite3 or pg imports outside allowed paths.
# Allowed: lib/adapters/, lib/db.ts, lib/db/, scripts/, migrations/
# Usage: ./scripts/check-no-direct-db-imports.sh

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILED=0

is_allowed() {
  local rel="$1"
  [[ "$rel" == lib/adapters/* ]] || [[ "$rel" == lib/db.ts ]] || \
  [[ "$rel" == lib/db/* ]] || [[ "$rel" == scripts/* ]] || [[ "$rel" == migrations/* ]]
}

check_imports() {
  local pattern="$1"
  local name="$2"
  local files
  files=$(grep -rEl "$pattern" "$ROOT" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" \
    --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=coverage \
    --exclude-dir=build --exclude-dir=out \
    --exclude-dir="Новая папка" --exclude-dir="Новая папка с объектами" 2>/dev/null || true)
  for f in $files; do
    [ -z "$f" ] && continue
    rel="${f#$ROOT/}"
    rel="${rel#./}"
    if ! is_allowed "$rel"; then
      echo "ERROR: $name imported outside allowed paths: $rel"
      FAILED=1
    fi
  done
}

# better-sqlite3: real imports only (not comments)
check_imports "from ['\"]better-sqlite3['\"]|require\\(['\"]better-sqlite3['\"]\\)" "better-sqlite3"
# pg (node-postgres)
check_imports "from ['\"]pg['\"]|require\\(['\"]pg['\"]\\)" "pg"

if [ $FAILED -eq 1 ]; then
  echo ""
  echo "DB drivers may only be imported in lib/adapters/, lib/db, scripts/, migrations/."
  exit 1
fi
echo "OK: no direct db imports outside allowed paths"
