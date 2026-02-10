# ---- deps
FROM node:22.12-alpine AS deps
WORKDIR /app
# Явная проверка Node (для логов Railway)
RUN node --version && npm --version
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# NODE_ENV=development + --include=dev: гарантирует devDeps (prisma, types) для build
ENV NODE_ENV=development
RUN npm ci --include=dev && npx prisma generate --schema=prisma/schema.prisma

# ---- build
FROM node:22.12-alpine AS build
ARG CACHE_BUST=2
WORKDIR /app
RUN node -v && npm -v
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN test -f lib/system/health/s3-health.ts && test -f lib/db.ts && test -f lib/docs-agent-db.ts || (echo "Build context: critical files missing"; exit 1)
ENV NEXT_TELEMETRY_DISABLED=1
ARG WORKSPACE_ROOT=/tmp/build
# NEXTAUTH_SECRET: pass via --build-arg in CI (no default to avoid layer cache exposure)
ARG NEXTAUTH_SECRET
ARG RAILWAY_GIT_COMMIT_SHA
ENV WORKSPACE_ROOT=$WORKSPACE_ROOT
# Fallback для build; runtime берет из Railway Variables
ENV NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-build-placeholder}
ENV GIT_SHA=$RAILWAY_GIT_COMMIT_SHA
RUN echo "Building commit: ${GIT_SHA:-unknown}"
RUN rm -rf .next node_modules/.cache
RUN npm run build:shared-types 2>/dev/null || true
RUN echo "FORCE_REBUILD_1770728467"
RUN npm run build

# ---- run (standalone)
FROM node:22.12-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Railway передаёт PORT; standalone server.js читает process.env.PORT
ENV PORT=3000

# standalone output
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build "/app/data/mura-menasa" "./data/mura-menasa"

# Prisma: schema + migrations for runtime migrate deploy
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma

# Entrypoint with migrations
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# non-root user (container hardening)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["sh", "./entrypoint.sh"]
