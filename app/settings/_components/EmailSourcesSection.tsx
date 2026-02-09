'use client';

import type { EmailSource, EmailSourceType } from './SettingsTypes';
import { apiPatch, apiPost, apiDelete } from './SettingsApi';
import { FormField } from '@/components/ui';

type Props = {
  sources: EmailSource[];
  onUpdate: (sources: EmailSource[]) => void;
  onError: (msg: string) => void;
  newType: EmailSourceType;
  newValue: string;
  newLabel: string;
  onNewChange: (type: EmailSourceType, value: string, label: string) => void;
};

export function EmailSourcesSection({
  sources,
  onUpdate,
  onError,
  newType,
  newValue,
  newLabel,
  onNewChange,
}: Props) {
  async function toggle(id: string, enabled: boolean) {
    try {
      const updated = await apiPatch<EmailSource>(`/sources/email/${id}`, { enabled });
      onUpdate(sources.map((x) => (x.id === id ? updated : x)));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to update');
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/sources/email/${id}`);
      onUpdate(sources.filter((x) => x.id !== id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function add() {
    if (!newValue.trim()) {
      onError('Введите домен или email');
      return;
    }
    try {
      const created = await apiPost<EmailSource>('/sources/email', {
        type: newType,
        value: newValue.trim(),
        label: newLabel.trim() || 'Custom',
        enabled: true,
        requireDmarcPass: true,
        autoCollect: true,
        autoAnalyze: true,
        requireApproval: true,
      });
      onUpdate([created, ...sources]);
      onNewChange('domain', '', 'Custom');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to add');
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="mb-4">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">Почтовые отправители (Allowlist)</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Только письма от разрешённых доменов/адресов попадают в автосбор.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end mb-4">
          <FormField label="Тип">
            <select
              className="input"
              value={newType}
              onChange={(e) => onNewChange(e.target.value as EmailSourceType, newValue, newLabel)}
            >
              <option value="domain">Домен</option>
              <option value="email">Email</option>
            </select>
          </FormField>
          <FormField label="Значение">
            <input
              className="input min-w-[260px]"
              placeholder={newType === 'domain' ? 'mak.ru' : 'someone@mak.ru'}
              value={newValue}
              onChange={(e) => onNewChange(newType, e.target.value, newLabel)}
            />
          </FormField>
          <FormField label="Label">
            <input
              className="input min-w-[180px]"
              placeholder="ARMAK / UDK-Klimov"
              value={newLabel}
              onChange={(e) => onNewChange(newType, newValue, e.target.value)}
            />
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
                <th className="text-left">Type</th>
                <th className="text-left">Value</th>
                <th className="text-left">Label</th>
                <th className="text-left">Policy</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      onChange={(e) => toggle(s.id, e.target.checked)}
                      className="rounded"
                    />
                  </td>
                  <td>{s.type}</td>
                  <td className="font-mono">{s.value}</td>
                  <td>{s.label}</td>
                  <td className="text-xs text-slate-600">
                    DMARC:{s.requireDmarcPass ? 'on' : 'off'} · collect:{s.autoCollect ? 'on' : 'off'} · analyze:
                    {s.autoAnalyze ? 'on' : 'off'} · approval:{s.requireApproval ? 'on' : 'off'}
                  </td>
                  <td className="text-right">
                    <button onClick={() => remove(s.id)} className="btn btn-ghost btn-sm text-red-600 hover:underline">
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    Нет правил. Добавь домены: mak.ru, klimov.ru, ao-star.ru
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
