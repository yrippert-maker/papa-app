import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required for seed");

// Этот seed только для Postgres (PrismaPg). SQLite — используйте npm run seed:admin.
const scheme = url.split(":")[0]?.toLowerCase();
if (scheme !== "postgres" && scheme !== "postgresql") {
  throw new Error(
    `Этот seed предназначен для Postgres (postgres:// или postgresql://). Схема: ${scheme}. Для SQLite: npm run seed:admin`
  );
}

// Guard: запрет insecure TLS в production
if (process.env.NODE_ENV === "production") {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error(
      "NODE_TLS_REJECT_UNAUTHORIZED=0 запрещён в production. Используйте NODE_EXTRA_CA_CERTS. См. docs/ops/DB_SEED_TLS.md. Если это CI — убедитесь, что NODE_ENV не равен production для seed."
    );
  }
  if (process.env.SEED_TLS_INSECURE === "1") {
    throw new Error(
      "SEED_TLS_INSECURE=1 запрещён в production. Используйте NODE_EXTRA_CA_CERTS. См. docs/ops/DB_SEED_TLS.md. Если это CI — убедитесь, что NODE_ENV не равен production для seed."
    );
  }
}

// Guard: NODE_TLS_REJECT_UNAUTHORIZED=0 без явного opt-in — возможная утечка в прод
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0" && process.env.SEED_TLS_INSECURE !== "1") {
  console.error(
    "[seed] NODE_TLS_REJECT_UNAUTHORIZED=0 без SEED_TLS_INSECURE=1. Используйте: npm run db:seed:supabase"
  );
  process.exit(1);
}

// TLS: insecure включается только при явном SEED_TLS_INSECURE=1 (sslmode=require не триггер — он лишь "включи TLS").
// Предпочтительно: NODE_EXTRA_CA_CERTS=/path/to/ca.pem. Fallback: npm run db:seed:supabase.
const needsInsecureTLS = process.env.SEED_TLS_INSECURE === "1";

if (process.env.NODE_ENV === "production" && needsInsecureTLS) {
  throw new Error(
    "Insecure TLS (rejectUnauthorized: false) запрещён в production. Используйте NODE_EXTRA_CA_CERTS. См. docs/ops/DB_SEED_TLS.md"
  );
}
const poolConfig = {
  connectionString: url,
  ...(needsInsecureTLS && { ssl: { rejectUnauthorized: false } }),
};
const adapter = new PrismaPg(poolConfig);
const prisma = new PrismaClient({ adapter });

async function main() {
  const roles = ["admin", "user", "auditor"];
  for (const name of roles) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@example.com";

  // Защита: если admin уже существует — ничего не делать (seed запускать один раз)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
    include: { roles: { include: { role: true } } },
  });
  if (existingAdmin && existingAdmin.roles.some((ur) => ur.role.name === "admin")) {
    console.log("Admin already exists:", adminEmail, "— skipping seed.");
    return;
  }

  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await hash(adminPassword, 12);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { status: "ACTIVE" },
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash,
      status: "ACTIVE",
    },
  });

  const adminRole = await prisma.role.findUnique({ where: { name: "admin" } });
  if (adminRole) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: adminRole.id },
    });
  }

  // Audit: кто и когда создал первого админа (actor = null — seed, не пользователь)
  await prisma.auditEvent.create({
    data: {
      actorUserId: null,
      action: "seed.admin_created",
      target: adminEmail,
      metadata: { source: "prisma_seed", createdAt: new Date().toISOString() },
    },
  });

  console.log("Seeded admin:", adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
