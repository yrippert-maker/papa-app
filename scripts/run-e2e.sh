#!/bin/bash
# E2E: запуск с настраиваемым портом (избегает EADDRINUSE при параллельном dev).
# Dev: 3000. E2E: 3100 по умолчанию.
set -e
E2E_PORT="${E2E_PORT:-3100}"
export PORT="$E2E_PORT"
export E2E_BASE_URL="http://localhost:$E2E_PORT"

# Port check: fail fast с понятным сообщением
if pid=$(lsof -nP -iTCP:"$E2E_PORT" -sTCP:LISTEN -t 2>/dev/null); then
  echo "ERROR: Port $E2E_PORT is in use. Free it before running E2E:"
  lsof -nP -iTCP:"$E2E_PORT" -sTCP:LISTEN 2>/dev/null || true
  echo "  kill -TERM <PID>"
  exit 1
fi

exec start-server-and-test start "http://localhost:$E2E_PORT/login" e2e:run
