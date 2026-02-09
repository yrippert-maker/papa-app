'use client';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { startRegistration } from '@simplewebauthn/browser';

export default function BiometricSetupPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRegister() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const optsRes = await fetch('/api/signature/biometric/register');
      const options = await optsRes.json();
      if (!optsRes.ok) {
        setError(options.error || 'Ошибка');
        return;
      }

      const credential = await startRegistration(options);

      const verifyRes = await fetch('/api/signature/biometric/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: credential }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) {
        setError(verifyData.error || 'Ошибка верификации');
        return;
      }
      setResult('Passkey зарегистрирован. Теперь можно подписывать документы отпечатком.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8 max-w-2xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          ЭЦП с биометрией
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Зарегистрируйте passkey (Touch ID / Windows Hello / Android) для подписания документов
          отпечатком пальца.
        </p>
        <button
          onClick={handleRegister}
          disabled={loading}
          className="btn btn-primary"
        >
          {loading ? 'Регистрация…' : 'Зарегистрировать passkey'}
        </button>
        {result && (
          <p className="mt-4 text-emerald-600 dark:text-emerald-400 text-sm">{result}</p>
        )}
        {error && (
          <p className="mt-4 text-amber-600 dark:text-amber-400 text-sm">{error}</p>
        )}
      </main>
    </DashboardLayout>
  );
}
