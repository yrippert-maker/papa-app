'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffect, useState } from 'react';

type WorkspaceEntry = {
  name: string;
  relativePath: string;
  isDir: boolean;
  size?: number;
  registered: boolean;
};

export default function WorkspacePage() {
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [currentDir, setCurrentDir] = useState('');
  const [loading, setLoading] = useState(true);
  const [initStatus, setInitStatus] = useState<string | null>(null);

  const loadEntries = (dir: string) => {
    const url = dir ? `/api/files/list?dir=${encodeURIComponent(dir)}` : '/api/files/list';
    fetch(url)
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEntries(currentDir);
  }, [currentDir]);

  const handleInitWorkspace = () => {
    setInitStatus(null);
    fetch('/api/workspace/init', { method: 'POST' })
      .then((r) => r.json())
      .then((data) => {
        setInitStatus(data.ok ? 'Workspace инициализирован' : data.error ?? 'Ошибка');
        if (data.ok) loadEntries(currentDir);
      })
      .catch((e) => setInitStatus(e instanceof Error ? e.message : 'Ошибка'));
  };

  const breadcrumbs = currentDir ? currentDir.split('/').filter(Boolean) : [];

  return (
    <DashboardLayout>
      <PageHeader
        title="Workspace"
        subtitle="Файловая структура проекта"
        actions={
          <button onClick={handleInitWorkspace} className="btn btn-primary">
            Инициализировать
          </button>
        }
      />
      <main className="flex-1 p-6 lg:p-8">
        {initStatus && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              initStatus.includes('инициализирован')
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {initStatus}
          </div>
        )}
        <div className="card mb-6">
          <div className="card-body">
            <div className="flex items-center gap-2 text-sm text-[#64748B]">
              <button
                onClick={() => setCurrentDir('')}
                className="hover:text-[#0F172A] font-medium"
              >
                /
              </button>
              {breadcrumbs.map((part, i) => {
                const path = breadcrumbs.slice(0, i + 1).join('/');
                return (
                  <span key={path} className="flex items-center gap-2">
                    <span>/</span>
                    <button
                      onClick={() => setCurrentDir(path)}
                      className="hover:text-[#0F172A] font-medium"
                    >
                      {part}
                    </button>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A]">Содержимое</h3>
          </div>
          <div className="card-body overflow-x-auto">
            {loading ? (
              <p className="text-[#64748B]">Загрузка...</p>
            ) : entries.length === 0 ? (
              <p className="text-[#64748B]">
                {currentDir ? 'Папка пуста.' : 'Workspace пуст или не инициализирован.'}
              </p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th>Тип</th>
                    <th className="text-right">Размер</th>
                    <th>В реестре</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.relativePath}>
                      <td>
                        {e.isDir ? (
                          <button
                            onClick={() =>
                              setCurrentDir(e.relativePath ? e.relativePath : currentDir)
                            }
                            className="text-left font-medium text-[#2563EB] hover:underline flex items-center gap-2"
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              />
                            </svg>
                            {e.name}
                          </button>
                        ) : (
                          <span className="font-medium">{e.name}</span>
                        )}
                      </td>
                      <td>{e.isDir ? 'Папка' : 'Файл'}</td>
                      <td className="text-right">
                        {e.size != null ? `${(e.size / 1024).toFixed(1)} KB` : '—'}
                      </td>
                      <td>{e.registered ? '✓' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
