import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { compareSync } from 'bcryptjs';
import { getDbReadOnly } from './db';
import { getPermissionsForRole } from './authz';

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
        const db = getDbReadOnly();
        const row = db
          .prepare('SELECT id, email, password_hash, role_code FROM users WHERE email = ?')
          .get(credentials.username.trim()) as
          | { id: number; email: string; password_hash: string; role_code: string }
          | undefined;
        if (!row) return null;
        if (!compareSync(credentials.password, row.password_hash)) return null;
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
  secret: process.env.NEXTAUTH_SECRET ?? (process.env.NODE_ENV === 'development' ? 'dev-secret-change-in-production' : undefined),
};
