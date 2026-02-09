#!/bin/sh
echo "=== Running prisma migrate deploy ==="
./node_modules/.bin/prisma migrate deploy || echo "WARNING: prisma migrate failed"
echo "=== Starting Next.js ==="
exec node server.js
