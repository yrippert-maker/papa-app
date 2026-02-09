'use client';

import Image from 'next/image';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const BRANDBOOK_LOGO = '/mura-menasa-logo.png';

function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await signIn('credentials', {
      username,
      password,
      redirect: false,
      callbackUrl,
    });
    if (res?.error) {
      setError('Неверный логин или пароль');
      return;
    }
    window.location.href = callbackUrl;
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5] dark:bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-none">
        <div className="text-center mb-8">
          <div className="relative w-14 h-14 mx-auto mb-4">
            <Image
              src={BRANDBOOK_LOGO}
              alt="MURA MENASA FZCO"
              fill
              className="object-contain"
              sizes="56px"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
                (e.currentTarget as HTMLImageElement).parentElement?.querySelector('.logo-fallback')?.classList.remove('hidden');
              }}
            />
            <div className="logo-fallback hidden absolute inset-0 rounded-xl bg-[#EF1C23] flex items-center justify-center">
              <span className="text-white font-bold text-xl">П</span>
            </div>
          </div>
          <h1 className="text-xl font-bold text-[#1a1a1a] dark:text-white tracking-tight">ПАПА</h1>
          <p className="text-sm text-[#4a4a4a] dark:text-slate-400 mt-1">Программа автоматизации производственной аналитики</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              id="username"
              type="email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="admin@local"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Пароль
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              required
            />
          </div>
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 text-sm border border-red-200 dark:border-red-800">{error}</div>
          )}
          <button type="submit" className="btn btn-primary w-full">
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500">Загрузка...</div>}>
      <LoginForm />
    </Suspense>
  );
}
