/**
 * PG-адаптер — обёртка над Prisma raw SQL, реализует DbAdapter для Postgres.
 * Используется только при DATABASE_URL; better-sqlite3 не импортируется.
 * См. ADR-003, ADR-004.
 */

import type { PrismaClient } from '@prisma/client';
import type { DbAdapter, DbPreparedStatement, DbRunResult, DbCapabilities } from './types';

/**
 * Конвертирует SQL с ? в $1, $2 для Postgres.
 * Не трогает ? внутри строковых литералов (между '...'), чтобы не ломать LIKE '%?%'.
 * В SQL кавычка внутри строки экранируется как ''.
 */
function toPgPlaceholders(sql: string): string {
  let n = 0;
  let out = '';
  let i = 0;
  let inString = false;
  while (i < sql.length) {
    const c = sql[i];
    if (c === "'" && !inString) {
      inString = true;
      out += c;
      i++;
      continue;
    }
    if (c === "'" && inString) {
      if (sql[i + 1] === "'") {
        out += "''";
        i += 2;
        continue;
      }
      inString = false;
      out += c;
      i++;
      continue;
    }
    if (c === '?' && !inString) {
      out += `$${++n}`;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

const CAPABILITIES: DbCapabilities = {
  returning: true,
  onConflict: true,
  lastInsertId: 'lastval',
};

function createStatement(client: PrismaClient, sql: string): DbPreparedStatement {
  const pgSql = toPgPlaceholders(sql);
  return {
    async run(...params: unknown[]): Promise<DbRunResult> {
      const result = await client.$executeRawUnsafe(pgSql, ...params);
      const count = typeof result === 'number' ? result : (result as { count?: number })?.count ?? 0;
      let lastInsertRowid = 0;
      if (/^\s*INSERT/i.test(sql.trim())) {
        const rows = await client.$queryRawUnsafe<[{ id?: number; lastval?: number }]>('SELECT lastval() as id');
        lastInsertRowid = Number(rows?.[0]?.id ?? rows?.[0]?.lastval ?? 0);
      }
      return { changes: count, lastInsertRowid };
    },
    async get<T = unknown>(...params: unknown[]): Promise<T | undefined> {
      const rows = await client.$queryRawUnsafe<unknown[]>(pgSql, ...params);
      return (rows?.[0] as T) ?? undefined;
    },
    async all<T = unknown>(...params: unknown[]): Promise<T[]> {
      const rows = await client.$queryRawUnsafe<unknown[]>(pgSql, ...params);
      return (rows ?? []) as T[];
    },
  };
}

/**
 * Создаёт PG-адаптер поверх Prisma client (raw SQL).
 * Вызывать только при process.env.DATABASE_URL.
 */
export function createPgAdapter(prisma: PrismaClient): DbAdapter {
  let txClient: PrismaClient | null = null;

  function client(): PrismaClient {
    return txClient ?? prisma;
  }

  const adapter: DbAdapter = {
    dialect: 'postgres',
    capabilities: CAPABILITIES,
    async prepare(sql: string): Promise<DbPreparedStatement> {
      return createStatement(client(), sql);
    },
    async exec(sql: string): Promise<void> {
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await client().$executeRawUnsafe(stmt);
      }
    },
    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
      return prisma.$transaction(async (tx) => {
        txClient = tx as PrismaClient;
        try {
          return await fn();
        } finally {
          txClient = null;
        }
      });
    },
    async healthCheck(): Promise<boolean> {
      try {
        await prisma.$queryRawUnsafe('SELECT 1');
        return true;
      } catch {
        return false;
      }
    },
  };

  return adapter;
}
