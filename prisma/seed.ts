import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required for seed");

const poolConfig = {
  connectionString: url,
  ...(url.includes("pooler.supabase.com") && { ssl: { rejectUnauthorized: false } }),
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
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

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
