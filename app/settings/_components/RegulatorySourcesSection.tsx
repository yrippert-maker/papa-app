'use client';

import type { RegulatorySource, Authority } from './SettingsTypes';
import { apiPatch, apiPost, apiDelete } from './SettingsApi';
import { FormField } from '@/components/ui';

type Props = {
  sources: RegulatorySource[];
  onUpdate: (sources: RegulatorySource[]) => void;
  onError: (msg: string) => void;
  newAuthority: Authority;
  newDocId: string;
  newUrl: string;
  newDownloadMode: 'fulltext' | 'metadata';
  newMonitoring: 'monthly' | 'weekly' | 'manual';
  onNewChange: (v: Partial<{ authority: Authority; docId: string; url: string; downloadMode: 'fulltext' | 'metadata'; monitoring: 'monthly' | 'weekly' | 'manual' }>) => void;
};

export function RegulatorySourcesSection({
  sources,
  onUpdate,
  onError,
  newAuthority,
  newDocId,
  newUrl,
  newDownloadMode,
  newMonitoring,
  onNewChange,
}: Props) {
  async function toggle(id: string, enabled: boolean) {
    try {
      const updated = await apiPatch<RegulatorySource>(`/sources/regulatory/${id}`, { enabled });
      onUpdate(sources.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to update');
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/sources/regulatory/${id}`);
      onUpdate(sources.filter((x) => x.id !== id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function add() {
    if (!newDocId.trim() || !newUrl.trim()) {
      onError('Заполните docId и URL');
      return;
    }
    try {
      const created = await apiPost<RegulatorySource>('/sources/regulatory', {
        authority: newAuthority,
        docId: newDocId.trim(),
        url: newUrl.trim(),
        enabled: true,
        downloadMode: newDownloadMode,
        monitoring: newMonitoring,
      });
      onUpdate([created, ...sources]);
      onNewChange({ docId: '', url: '' });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to add');
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="mb-4">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">Регуляторные источники (ICAO/EASA/FAA/ARMAK)</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Мониторинг обновлений: скачивание open docs или metadata-only.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end mb-4">
          <FormField label="Authority">
            <select
              className="input"
              value={newAuthority}
              onChange={(e) => onNewChange({ authority: e.target.value as Authority })}
            >
              <option value="ARMAK">ARMAK</option>
              <option value="EASA">EASA</option>
              <option value="FAA">FAA</option>
              <option value="ICAO">ICAO</option>
            </select>
          </FormField>
          <FormField label="docId">
            <input
              className="input min-w-[180px]"
              placeholder="AP-145 / Part-145"
              value={newDocId}
              onChange={(e) => onNewChange({ docId: e.target.value })}
            />
          </FormField>
          <FormField label="URL">
            <input
              className="input min-w-[360px]"
              placeholder="https://..."
              value={newUrl}
              onChange={(e) => onNewChange({ url: e.target.value })}
            />
          </FormField>
          <FormField label="Mode">
            <select
              className="input"
              value={newDownloadMode}
              onChange={(e) => onNewChange({ downloadMode: e.target.value as 'fulltext' | 'metadata' })}
            >
              <option value="metadata">metadata</option>
              <option value="fulltext">fulltext</option>
            </select>
          </FormField>
          <FormField label="Monitoring">
            <select
              className="input"
              value={newMonitoring}
              onChange={(e) => onNewChange({ monitoring: e.target.value as 'monthly' | 'weekly' | 'manual' })}
            >
              <option value="monthly">monthly</option>
              <option value="weekly">weekly</option>
              <option value="manual">manual</option>
            </select>
          </FormField>
          <button onClick={add} className="btn btn-primary">
            Добавить
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="table w-full text-sm">
            <thead>
              <tr>
                <th className="text-left">Enabled</th>
                <th className="text-left">Authority</th>
                <th className="text-left">docId</th>
                <th className="text-left">URL</th>
                <th className="text-left">Mode</th>
                <th className="text-left">Monitoring</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((r) => (
                <tr key={r.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => toggle(r.id, e.target.checked)}
                      className="rounded"
                    />
                  </td>
                  <td>{r.authority}</td>
                  <td className="font-mono">{r.docId ?? '—'}</td>
                  <td className="truncate max-w-[420px]">
                    <a className="text-blue-600 hover:underline" href={r.url} target="_blank" rel="noreferrer">
                      {r.url}
                    </a>
                  </td>
                  <td>{r.downloadMode}</td>
                  <td>{r.monitoring}</td>
                  <td className="text-right">
                    <button onClick={() => remove(r.id)} className="btn btn-ghost btn-sm text-red-600 hover:underline">
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Нет источников. Добавь ARMAK AP-145 и EASA/FAA MRO ссылки.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
