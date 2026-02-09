'use client';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DocumentsTabs } from '@/components/documents/DocumentsTabs';

type TabId = 'training' | 'exams' | 'vacations' | 'timesheet';

const tabs: { id: TabId; label: string }[] = [
  { id: 'training', label: 'Обучение' },
  { id: 'exams', label: 'Экзамены' },
  { id: 'vacations', label: 'Отпуска' },
  { id: 'timesheet', label: 'Табель (FR-5.4)' },
];

type HrTraining = { id: string; program: string; employee: string; date: string; cert?: string };
type HrExam = { id: string; competency: string; employee: string; result: string; validUntil: string };
type HrVacation = { id: string; employee: string; start: string; end: string; status: string };

const FALLBACK_TRAINING: HrTraining[] = [
  { id: '1', program: 'Безопасность труда', employee: 'Иванов И.И.', date: '2025-01-15', cert: 'Удостоверение №001' },
  { id: '2', program: 'Пожарная безопасность', employee: 'Петров П.П.', date: '2025-01-20', cert: 'Удостоверение №002' },
];
const FALLBACK_EXAMS: HrExam[] = [
  { id: '1', competency: 'АП-145.50', employee: 'Иванов И.И.', result: 'Сдан', validUntil: '2026-02-01' },
  { id: '2', competency: 'EASA Part-145', employee: 'Петров П.П.', result: 'Сдан', validUntil: '2026-03-15' },
];
const FALLBACK_VACATIONS: HrVacation[] = [
  { id: '1', employee: 'Иванов И.И.', start: '2025-07-01', end: '2025-07-14', status: 'Утверждён' },
  { id: '2', employee: 'Петров П.П.', start: '2025-08-01', end: '2025-08-21', status: 'Заявка' },
];

export default function DocumentsHRPage() {
  const [activeTab, setActiveTab] = useState<TabId>('training');
  const [training, setTraining] = useState<HrTraining[]>(FALLBACK_TRAINING);
  const [exams, setExams] = useState<HrExam[]>(FALLBACK_EXAMS);
  const [vacations, setVacations] = useState<HrVacation[]>(FALLBACK_VACATIONS);
  const [timesheet, setTimesheet] = useState<Array<{ id: string; employee: string; date: string; hours: number; activity?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/hr/training').then((r) => r.json()),
      fetch('/api/hr/exams').then((r) => r.json()),
      fetch('/api/hr/vacations').then((r) => r.json()),
      fetch('/api/hr/timesheet').then((r) => r.json()),
    ])
      .then(([t, e, v, ts]) => {
        if (t?.items && Array.isArray(t.items)) setTraining(t.items);
        if (e?.items && Array.isArray(e.items)) setExams(e.items);
        if (v?.items && Array.isArray(v.items)) setVacations(v.items);
        if (ts?.items && Array.isArray(ts.items)) setTimesheet(ts.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">HR — кадровые документы</h2>
        <DocumentsTabs />
        <p className="text-slate-500 dark:text-slate-400 mb-6">
          Модуль 5 ТЗ: обучение, экзамены, отпуска. Реестры (демо-данные).
        </p>

        <div className="flex gap-2 border-b border-slate-200 dark:border-slate-700 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg -mb-px ${
                activeTab === t.id
                  ? 'bg-white dark:bg-slate-800 border border-b-0 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <section className="rounded-lg border border-slate-200 dark:border-slate-600 p-6 bg-slate-50 dark:bg-slate-800/50">
          {activeTab === 'training' && (
            <div>
              <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-3">Обучение (FR-5.1–5.2)</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Реестр программ обучения, журналы инструктажей, удостоверения.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-2 px-3 font-medium">Программа</th>
                      <th className="text-left py-2 px-3 font-medium">Сотрудник</th>
                      <th className="text-left py-2 px-3 font-medium">Дата</th>
                      <th className="text-left py-2 px-3 font-medium">Удостоверение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {training.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-2 px-3">{r.program}</td>
                        <td className="py-2 px-3">{r.employee}</td>
                        <td className="py-2 px-3">{r.date}</td>
                        <td className="py-2 px-3">{r.cert}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'exams' && (
            <div>
              <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-3">Экзамены (FR-5.3)</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Результаты экзаменов по компетенциям, срок действия удостоверения.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-2 px-3 font-medium">Компетенция</th>
                      <th className="text-left py-2 px-3 font-medium">Сотрудник</th>
                      <th className="text-left py-2 px-3 font-medium">Результат</th>
                      <th className="text-left py-2 px-3 font-medium">Действует до</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-2 px-3">{r.competency}</td>
                        <td className="py-2 px-3">{r.employee}</td>
                        <td className="py-2 px-3">{r.result}</td>
                        <td className="py-2 px-3">{r.validUntil}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {activeTab === 'timesheet' && (
            <div>
              <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-3">Табель рабочего времени (FR-5.4)</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Учёт рабочего времени с экспортом в Excel.
              </p>
              <a
                href="/api/hr/timesheet?format=xlsx"
                download
                className="inline-flex items-center px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 mb-4"
              >
                📊 Экспорт Excel
              </a>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-2 px-3 font-medium">Сотрудник</th>
                      <th className="text-left py-2 px-3 font-medium">Дата</th>
                      <th className="text-left py-2 px-3 font-medium">Часы</th>
                      <th className="text-left py-2 px-3 font-medium">Активность</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheet.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-2 px-3">{r.employee}</td>
                        <td className="py-2 px-3">{r.date}</td>
                        <td className="py-2 px-3">{r.hours}</td>
                        <td className="py-2 px-3">{r.activity ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {timesheet.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Нет записей. Добавьте через API POST /api/hr/timesheet</p>
              )}
            </div>
          )}
          {activeTab === 'vacations' && (
            <div>
              <h3 className="text-base font-medium text-slate-700 dark:text-slate-300 mb-3">Отпуска (FR-5.4–5.5)</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                График отпусков, заявки, приказы.
              </p>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-600">
                      <th className="text-left py-2 px-3 font-medium">Сотрудник</th>
                      <th className="text-left py-2 px-3 font-medium">Начало</th>
                      <th className="text-left py-2 px-3 font-medium">Конец</th>
                      <th className="text-left py-2 px-3 font-medium">Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vacations.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 dark:border-slate-700">
                        <td className="py-2 px-3">{r.employee}</td>
                        <td className="py-2 px-3">{r.start}</td>
                        <td className="py-2 px-3">{r.end}</td>
                        <td className="py-2 px-3">{r.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>
    </DashboardLayout>
  );
}
