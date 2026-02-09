'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import Link from 'next/link';

type VideoItem = { id: string; title: string; role: string; url?: string; version?: string };

export default function HelpPage() {
  const [videos, setVideos] = useState<VideoItem[]>([]);

  useEffect(() => {
    fetch('/api/help/videos')
      .then((r) => r.json())
      .then((d) => setVideos(d.videos ?? []))
      .catch(() => setVideos([]));
  }, []);

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8 max-w-3xl">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Инструкции для сотрудников
        </h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          Руководство по работе с ПАПА в соответствии с компетенциями (ролями).
        </p>
        <div className="space-y-4">
          {videos.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4">
              <h3 className="font-medium text-slate-900 dark:text-white mb-2">Видеоинструкции (FR-9.3)</h3>
              <ul className="space-y-2">
                {videos.map((v) => (
                  <li key={v.id} className="text-sm">
                    <span className="text-slate-700 dark:text-slate-300">{v.title}</span>
                    {v.role && v.role !== 'all' && (
                      <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({v.role})</span>
                    )}
                    {v.version && (
                      <span className="ml-2 text-xs text-slate-400">v{v.version}</span>
                    )}
                    {v.url ? (
                      <a href={v.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 dark:text-blue-400 hover:underline">
                        Смотреть
                      </a>
                    ) : (
                      <span className="ml-2 text-slate-400 text-xs">(в разработке)</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Документация</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Полная инструкция: роли ADMIN, MANAGER, ENGINEER, STOREKEEPER, AUDITOR; типовые сценарии (акт по фото, техкарта, реестр платежей, compliance).
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Файл в репозитории: <code>docs/mura-menasa/ИНСТРУКЦИЯ_СОТРУДНИКОВ_ПАПА.md</code>
            </p>
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-600 p-4">
            <h3 className="font-medium text-slate-900 dark:text-white mb-2">Быстрые ссылки</h3>
            <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
              <li>
                <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Дашборд
                </Link>{' '}
                — Помощник по документам, акты, техкарты, фото
              </li>
              <li>
                <Link href="/documents/techcards" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Техкарты
                </Link>{' '}
                — эталоны ТР ММ, АИ-9, НР-3, ТВ3-117
              </li>
              <li>
                <Link href="/documents/finance" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Финансы
                </Link>{' '}
                — реестр платежей, сводка для аудитора
              </li>
              <li>
                <Link href="/documents/library" className="text-blue-600 dark:text-blue-400 hover:underline">
                  Библиотека
                </Link>{' '}
                — регуляторные документы
              </li>
            </ul>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
