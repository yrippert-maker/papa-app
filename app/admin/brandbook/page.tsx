'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';

type BrandbookConfig = {
  company?: string;
  colors?: { primary?: string; primaryRgb?: string; text?: string; textSecondary?: string; background?: string };
  typography?: { fontFamily?: string; headingFont?: string };
  logo?: { path?: string; alt?: string };
  templates?: { firmBlank?: string };
  documentRules?: string[];
};

export default function BrandbookAdminPage() {
  const [config, setConfig] = useState<BrandbookConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings/brandbook')
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setConfig(null))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof BrandbookConfig>(key: K, value: BrandbookConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : null));
  }

  function updateNested<K extends keyof BrandbookConfig>(key: K, subKey: string, value: string) {
    setConfig((c) => {
      if (!c) return null;
      const obj = c[key] as Record<string, string> | undefined;
      return { ...c, [key]: { ...obj, [subKey]: value } };
    });
  }

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings/brandbook', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Ошибка');
      setMsg('Сохранено');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !config) {
    return (
      <DashboardLayout>
        <main className="p-6 lg:p-8">Загрузка…</main>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Конфигурация брендбука (FR-1.5)
          </h2>
          <Link href="/admin/users" className="text-sm text-[#EF1C23] dark:text-red-400 hover:underline">
            ← Пользователи
          </Link>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Компания
            </label>
            <input
              type="text"
              value={config.company ?? ''}
              onChange={(e) => update('company', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Цвета</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['primary', 'text', 'background'] as const).map((k) => (
                <div key={k}>
                  <label className="text-xs text-slate-500">{k}</label>
                  <input
                    type="text"
                    value={config.colors?.[k] ?? ''}
                    onChange={(e) => updateNested('colors', k, e.target.value)}
                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Шрифты</h3>
            <input
              type="text"
              value={config.typography?.fontFamily ?? ''}
              onChange={(e) => updateNested('typography', 'fontFamily', e.target.value)}
              placeholder="fontFamily"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Путь к логотипу
            </label>
            <input
              type="text"
              value={config.logo?.path ?? ''}
              onChange={(e) => updateNested('logo', 'path', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Правила оформления (по одному на строку)
            </label>
            <textarea
              value={(config.documentRules ?? []).join('\n')}
              onChange={(e) => update('documentRules', e.target.value.split('\n').filter(Boolean))}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
            />
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
          {msg && <span className="text-sm text-slate-500">{msg}</span>}
        </div>
      </main>
    </DashboardLayout>
  );
}
