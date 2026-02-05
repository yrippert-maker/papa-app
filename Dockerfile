# ---- deps
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci && npx prisma generate

# ---- build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ARG WORKSPACE_ROOT=/tmp/build
ARG NEXTAUTH_SECRET=build-placeholder
ENV WORKSPACE_ROOT=$WORKSPACE_ROOT
ENV NEXTAUTH_SECRET=$NEXTAUTH_SECRET
RUN npm run build

# ---- run (standalone)
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

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
