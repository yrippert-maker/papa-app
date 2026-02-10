#!/bin/sh
echo "=== Running prisma migrate deploy ==="
node ./node_modules/prisma/build/index.js migrate deploy || echo "WARNING: prisma migrate failed"
echo "=== Starting Next.js ==="
exec node server.js
