#!/usr/bin/env node
/**
 * Проверка DATABASE_URL перед dev/start.
 * Fail-fast при proxy, неверном host или отсутствии URL.
 *
 * Usage: node scripts/check-database-url.mjs
 * Exit: 0 = OK, 1 = error
 */
import dotenv from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config();
if (existsSync(resolve(process.cwd(), '.env.local'))) {
  dotenv.config({ path: '.env.local', override: true });
}

function isRunningInDocker() {
  if (existsSync('/.dockerenv')) return true;
  try {
    const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
    return /docker|containerd|kubepods/i.test(cgroup);
  } catch {
    return false;
  }
}

const url = process.env.DATABASE_URL;

if (!url) {
  console.error('ERROR: DATABASE_URL is not set. Add it to .env or .env.local');
  console.error('See docs/ops/DATABASE_URL_DOCKER_SETUP.md');
  process.exit(1);
}

if (url.includes('prisma+postgres://')) {
  console.error('ERROR: Proxy DATABASE_URL detected (prisma+postgres://). Use direct postgresql://...');
  console.error('See docs/ops/DATABASE_URL_DOCKER_SETUP.md');
  process.exit(1);
}

const inDocker = isRunningInDocker();

// В контейнере localhost указывает на сам контейнер, а не на Postgres-сервис
if (inDocker && /@localhost(?::\d+)?\b/.test(url)) {
  console.error('ERROR: DATABASE_URL points to localhost inside Docker.');
  console.error('Use the compose service hostname, e.g.: postgresql://...@postgres:5432/...');
  console.error('See docs/ops/DATABASE_URL_DOCKER_SETUP.md');
  process.exit(1);
}

// (Опционально) На host имя сервиса обычно не резолвится
if (!inDocker && /@postgres(?::\d+)?\b/.test(url)) {
  console.warn('WARN: DATABASE_URL uses @postgres on host. If Node runs on host, prefer @localhost:5432.');
}

// NextAuth: https://localhost → ERR_SSL_PROTOCOL_ERROR (dev-сервер на HTTP)
const authUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL;
if (authUrl) {
  if (/^https:\/\/localhost(?::\d+)?\b/i.test(authUrl)) {
    console.warn('WARN: NEXTAUTH_URL/AUTH_URL uses https://localhost. Dev server runs HTTP → use http://localhost:3001');
  }
  // localhost без порта или :80 → ERR_CONNECTION_REFUSED (dev на 3001)
  if (/^https?:\/\/localhost(?:\/|$)/i.test(authUrl) && !/:3\d{3}\b/.test(authUrl)) {
    console.warn('WARN: NEXTAUTH_URL/AUTH_URL has no port or wrong port. Dev server runs on 3001 → use http://localhost:3001');
  }
}

console.log('DATABASE_URL OK');
