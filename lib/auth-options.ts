import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compareSync } from 'bcryptjs';
import { getDbReadOnly } from './db';
import { getPermissionsForRole } from './authz';

const secret = process.env.NEXTAUTH_SECRET;
const isProd = process.env.NODE_ENV === 'production';
const allowDevFallback = process.env.ALLOW_DEV_FALLBACK_SECRET === '1';
if (!secret && (isProd || !allowDevFallback)) {
  throw new Error('NEXTAUTH_SECRET is required. Set in .env.local or use ALLOW_DEV_FALLBACK_SECRET=1 for local dev only.');
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Email', type: 'text' },
        password: { label: 'Пароль', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const email = credentials.username.trim();
        const password = credentials.password;

        // Dev admin via env (portal demo / local dev)
        const devEmail = process.env.AUTH_ADMIN_EMAIL;
        const devPassword = process.env.AUTH_ADMIN_PASSWORD;
        if (devEmail && devPassword && email === devEmail && password === devPassword) {
          return {
            id: 'dev-admin',
            name: email.split('@')[0],
            email,
            role: 'admin',
          };
        }

        const db = getDbReadOnly();
        const row = db
          .prepare('SELECT id, email, password_hash, role_code FROM users WHERE email = ?')
          .get(email) as
          | { id: number; email: string; password_hash: string; role_code: string }
          | undefined;
        if (!row) return null;
        if (!compareSync(password, row.password_hash)) return null;
        return {
          id: String(row.id),
          name: row.email.split('@')[0],
          email: row.email,
          role: row.role_code,
        };
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 24 * 60 * 60 },
  pages: { signIn: '/login' },
  callbacks: {
    redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        if (new URL(url).origin === baseUrl) return url;
      } catch {
        return baseUrl;
      }
      return baseUrl;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        const role = (user as { role?: string }).role;
        token.role = role;
        token.permissions = role ? Array.from(getPermissionsForRole(role)) : [];
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.permissions = (token.permissions as string[]) ?? [];
      }
      return session;
    },
  },
  secret: secret ?? 'dev-secret-change-in-production',
};
