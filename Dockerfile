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
WORKDIR /app
RUN node -v && npm -v
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN test -f lib/system/health/s3-health.ts && test -f lib/db.ts && test -f lib/docs-agent-db.ts || (echo "Build context: critical files missing"; exit 1)
ENV NEXT_TELEMETRY_DISABLED=1
ARG WORKSPACE_ROOT=/tmp/build
ARG NEXTAUTH_SECRET=build-placeholder
ARG GIT_SHA=unknown
ENV WORKSPACE_ROOT=$WORKSPACE_ROOT
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
ENV GIT_SHA=$GIT_SHA
RUN echo "Building commit: $GIT_SHA"
RUN rm -rf .next node_modules/.cache
RUN npm run check:root

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

# non-root user (container hardening)
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
CMD ["node", "server.js"]
