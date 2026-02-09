'use client';

import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';

const TECH_STANDARDS = [
  {
    id: 'TR-MM-00002-00001',
    title: 'ТР ММ-00002-00001',
    description: 'Технологический регламент (шаблон техкарты). Базируется на MOPM (MM-02).',
    product: 'Общий',
    docRef: 'MM-02',
  },
  {
    id: 'AI-9',
    title: 'Руководство по капитальному ремонту АИ-9',
    description: 'Руководства по капитальному ремонту ГТД АИ-9. Эталоны операций.',
    product: 'АИ-9',
    docRef: 'MM-02',
  },
  {
    id: 'NR-3',
    title: 'Руководство по капитальному ремонту НР-3',
    description: 'Руководства по капитальному ремонту ГТД НР-3. Эталоны операций.',
    product: 'НР-3',
    docRef: 'MM-02',
  },
  {
    id: 'TV3-117',
    title: 'Техкарты ТВ3-117',
    description: 'Технологические карты на двигатель ТВ3-117. См. MOPM, раздел цехов.',
    product: 'ТВ3-117',
    docRef: 'MM-02',
  },
];

export default function DocumentsTechcardsPage() {
  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Документы</h2>
        <DocumentsTabs />
        <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-6">
          Технологические карты и эталоны
        </h3>
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          Эталоны построены на основе ТР ММ-00002-00001, руководств по капитальному ремонту АИ-9 и НР-3 (MOPM MM-02).
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {TECH_STANDARDS.map((s) => (
            <Link
              key={s.id}
              href="/documents/mura-menasa/handbook"
              className="block rounded-lg border border-slate-200 dark:border-slate-600 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
            >
              <div className="font-medium text-slate-900 dark:text-white">{s.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{s.product}</div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{s.description}</p>
            </Link>
          ))}
        </div>
        <div className="mt-8 rounded-lg border border-slate-200 dark:border-slate-600 p-4 bg-slate-50 dark:bg-slate-800/30">
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Генерация техкарты
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            В{' '}
            <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
              Помощнике по документам
            </Link>{' '}
            выберите тип «Техкарта», прикрепите документы или фото, и сформируйте черновик по шаблону ТР ММ.
          </p>
        </div>

        <section className="mt-8 rounded-lg border border-slate-200 dark:border-slate-600 p-6 bg-white dark:bg-slate-800/50">
          <h4 className="text-base font-semibold text-slate-700 dark:text-slate-300 mb-4">
            Пайплайн: АВК → Акт недостатков → Техкарта (FR-3.6–3.7)
          </h4>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-medium text-sm">
                1
              </span>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">АВК / АВыхК</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">Акт входного/выходного контроля</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">→</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium text-sm">
                2
              </span>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Акт недостатков</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">При выявлении дефектов</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">→</span>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-medium text-sm">
                3
              </span>
              <div>
                <div className="font-medium text-slate-900 dark:text-white">Техкарта</div>
                <p className="text-xs text-slate-500 dark:text-slate-400">По результатам АВК/акта недостатков</p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/?intent=act"
              className="inline-flex items-center px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Создать АВК
            </Link>
            <Link
              href="/?intent=act&act_type=дефектов"
              className="inline-flex items-center px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Акт недостатков
            </Link>
            <Link
              href="/?intent=techcard"
              className="inline-flex items-center px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Создать техкарту
            </Link>
            <Link
              href="/?intent=techcard&unit_id=TV3-117"
              className="inline-flex items-center px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Техкарта ТВ3-117
            </Link>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
            Помощник поддерживает фото акта и автозаполнение полей. Для акта недостатков выберите тип «Акт» и укажите «дефектов» в типе акта.
          </p>
        </section>
      </main>
    </DashboardLayout>
  );
}
