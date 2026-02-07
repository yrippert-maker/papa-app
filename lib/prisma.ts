import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required when using Prisma");
  }
  // Railway / Supabase: self-signed certs → pg требует rejectUnauthorized: false
  const needsInsecureSsl =
    url.includes("pooler.supabase.com") ||
    url.includes("railway.app") ||
    url.includes("rlwy.net") ||
    url.includes("railway.internal");
  const pool = new Pool({
    connectionString: url,
    ...(needsInsecureSsl && { ssl: { rejectUnauthorized: false } }),
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

export const prisma: PrismaClient =
  globalForPrisma.prisma ?? (process.env.DATABASE_URL ? createPrisma() : (null as unknown as PrismaClient));

if (process.env.NODE_ENV !== "production" && prisma) globalForPrisma.prisma = prisma;
