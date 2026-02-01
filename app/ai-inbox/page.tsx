'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffect, useState, useRef } from 'react';

type FileEntry = {
  name: string;
  relativePath: string;
  isDir: boolean;
  size?: number;
  registered: boolean;
};

export default function AiInboxPage() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadAiInbox = () => {
    fetch('/api/files/list?dir=ai-inbox')
      .then((r) => r.json())
      .then((data) => setEntries(data.entries ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAiInbox();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const r = await fetch('/api/files/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await r.json();
      if (data.ok) {
        setUploadResult(`Файл загружен: ${data.relative_path}`);
        loadAiInbox();
      } else {
        setUploadResult(data.error ?? 'Ошибка загрузки');
      }
    } catch (err) {
      setUploadResult(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="AI Inbox"
        subtitle="Загрузка документов для обработки"
        actions={
          <>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={uploading}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn btn-primary"
            >
              {uploading ? 'Загрузка...' : '+ Загрузить файл'}
            </button>
          </>
        }
      />
      <main className="flex-1 p-6 lg:p-8">
        {uploadResult && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              uploadResult.includes('загружен')
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {uploadResult}
          </div>
        )}
        <div className="card mb-6">
          <div className="card-body">
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              Загрузите документы (накладные, спецификации, техкарты) для регистрации в реестре и
              последующей AI-обработки.
            </p>
            <div
              className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center text-slate-500 dark:text-slate-400 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-all"
              onClick={() => inputRef.current?.click()}
            >
              <svg
                className="w-12 h-12 mx-auto mb-3 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              <p>Нажмите или перетащите файл сюда</p>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-semibold text-[#0F172A]">Загруженные файлы</h3>
          </div>
          <div className="card-body overflow-x-auto">
            {loading ? (
              <p className="text-[#64748B]">Загрузка...</p>
            ) : entries.length === 0 ? (
              <p className="text-[#64748B]">Пока нет загруженных файлов.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Имя</th>
                    <th className="text-right">Размер</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {entries
                    .filter((e) => !e.isDir)
                    .map((e) => (
                      <tr key={e.relativePath}>
                        <td className="font-medium">{e.name}</td>
                        <td className="text-right">
                          {e.size != null ? `${(e.size / 1024).toFixed(1)} KB` : '—'}
                        </td>
                        <td>{e.registered ? '✓ В реестре' : '—'}</td>
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
