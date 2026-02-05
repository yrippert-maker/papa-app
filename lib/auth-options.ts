import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcrypt";
import { getDbReadOnly, dbGet } from "./db";
import { getPermissionsForRole, PERMISSIONS } from "./authz";
import { prisma } from "@/lib/prisma";
import { getUserRoles } from "@/services/auth/getUserRoles";
import { logAuditEvent } from "@/services/audit/logAuditEvent";

const secret = process.env.NEXTAUTH_SECRET;
const isProd = process.env.NODE_ENV === "production";
const allowDevFallback = process.env.ALLOW_DEV_FALLBACK_SECRET === "1";
if (!secret && (isProd || !allowDevFallback)) {
  throw new Error(
    "NEXTAUTH_SECRET is required. Set in .env.local or use ALLOW_DEV_FALLBACK_SECRET=1 for local dev only."
  );
}

const usePrisma = Boolean(process.env.DATABASE_URL);

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Email", type: "text" },
        password: { label: "Пароль", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.username || !credentials?.password) return null;
          const email = credentials.username.trim().toLowerCase();
          const password = credentials.password;

          // Dev admin: только при NODE_ENV !== production И явном DEV_ADMIN=true
          const devAdminAllowed =
            process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN === "true";
          const devEmail = process.env.AUTH_ADMIN_EMAIL;
          const devPassword = process.env.AUTH_ADMIN_PASSWORD;
          if (devAdminAllowed && devEmail && devPassword && email === devEmail.trim() && password === devPassword) {
            return {
              id: "dev-admin",
              name: email.split("@")[0],
              email,
              role: "admin",
              roles: ["admin"],
            };
          }

          if (usePrisma) {
            const user = await prisma.user.findUnique({
              where: { email },
              include: { roles: { include: { role: true } } },
            });
            if (!user || user.status !== "ACTIVE" || !user.passwordHash) return null;
            const ok = await bcrypt.compare(password, user.passwordHash);
            if (!ok) return null;
            const roleNames = user.roles.map((ur) => ur.role.name);
            const roleName = roleNames[0] ?? "user";
            return {
              id: user.id,
              name: user.name ?? user.email.split("@")[0],
              email: user.email,
              role: roleName,
              roles: roleNames,
            };
          }

          const db = await getDbReadOnly();
          const row = (await dbGet(db, 'SELECT id, email, password_hash, role_code FROM users WHERE email = ?', email)) as
            | { id: number; email: string; password_hash: string; role_code: string }
            | undefined;
          if (!row) return null;
          const { compareSync } = await import("bcryptjs");
          if (!compareSync(password, row.password_hash)) return null;
          return {
            id: String(row.id),
            name: row.email.split("@")[0],
            email: row.email,
            role: row.role_code,
          };
        } catch (err) {
          console.error("[auth] authorize failed:", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  pages: { signIn: "/login" },
  // Desktop / localhost: cookies без secure, sameSite lax
  cookies: {
    sessionToken: {
      name:
        process.env.NEXTAUTH_URL?.startsWith("https://")
          ? "__Secure-next-auth.session-token"
          : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: process.env.NEXTAUTH_URL?.startsWith("https://") ?? false,
      },
    },
  },
  callbacks: {
    // Desktop: только разрешённые пути; callbackUrl не доверяем «как есть»
    redirect({ url, baseUrl }) {
      const allowedPaths = [
        "/",
        "/login",
        "/403",
        "/documents",
        "/operations",
        "/compliance",
        "/inspection",
        "/governance",
        "/workspace",
        "/tmc",
        "/tmc-requests",
        "/safety",
        "/mail",
        "/admin",
        "/audit",
        "/settings",
        "/system",
        "/traceability",
        "/ai-inbox",
      ];
      const isPathAllowed = (path: string) =>
        path === "/" ||
        path === "/login" ||
        allowedPaths.some((p) => path === p || path.startsWith(p + "/"));

      if (url.startsWith("/")) {
        const path = url.split("?")[0];
        return isPathAllowed(path) ? `${baseUrl}${url}` : baseUrl;
      }
      try {
        const u = new URL(url);
        if (u.origin !== new URL(baseUrl).origin) return baseUrl;
        return isPathAllowed(u.pathname) ? url : baseUrl;
      } catch {
        return baseUrl;
      }
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id?: string }).id;
        const role = (user as { role?: string }).role;
        const roles = (user as { roles?: string[] }).roles;
        token.role = role ? role.toUpperCase() : role;
        token.roles = roles?.map((r) => r.toLowerCase()) ?? (role ? [role.toLowerCase()] : []);
        if (!token.roles?.length && token.id && usePrisma) {
          try {
            token.roles = await getUserRoles(token.id);
          } catch (e) {
            console.warn("[auth jwt] getUserRoles failed:", e);
          }
        }
        try {
          const isAdmin = token.roles?.includes("admin") ?? role?.toUpperCase() === "ADMIN";
          if (isAdmin) {
            token.permissions = Object.values(PERMISSIONS);
          } else {
            token.permissions = role ? Array.from(await getPermissionsForRole(role.toUpperCase())) : [];
          }
        } catch (e) {
          console.warn("[auth jwt] getPermissionsForRole failed:", e);
          token.permissions = token.roles?.includes("admin") ? Object.values(PERMISSIONS) : [];
        }
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.roles = (token.roles as string[]) ?? [];
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  secret: secret ?? "dev-secret-change-in-production",
  events: {
    async signIn({ user }) {
      try {
        if (usePrisma && user.id && user.id !== "dev-admin") {
          await logAuditEvent({
            actorUserId: user.id,
            action: "auth.sign_in",
            target: user.email ?? user.id,
            metadata: { provider: "credentials" },
          });
        }
      } catch (e) {
        console.warn("[auth signIn] logAuditEvent failed:", e);
      }
    },
  },
};
