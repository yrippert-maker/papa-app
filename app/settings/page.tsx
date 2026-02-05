'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';

type Role = 'Owner' | 'Admin' | 'Operator' | 'Reviewer' | 'Viewer';

type User = {
  id: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string | null;
};

type EmailSourceType = 'domain' | 'email';
type EmailSource = {
  id: string;
  type: EmailSourceType;
  value: string;
  label: string;
  enabled: boolean;
  requireDmarcPass: boolean;
  autoCollect: boolean;
  autoAnalyze: boolean;
  requireApproval: boolean;
};

type Authority = 'ICAO' | 'EASA' | 'FAA' | 'ARMAK';
type RegulatorySource = {
  id: string;
  authority: Authority;
  docId?: string;
  url: string;
  enabled: boolean;
  downloadMode: 'fulltext' | 'metadata';
  monitoring: 'monthly' | 'weekly' | 'manual';
};

type UpdatePolicies = {
  email: { mode: 'scheduled' | 'manual'; intervalMin?: number; requireDmarcPass: boolean };
  regulatory: { mode: 'scheduled' | 'manual'; schedule?: { type: 'monthly' | 'weekly'; day?: number; hour: number } };
  processing: { autoCollect: boolean; autoAnalyze: boolean; requireApproval: boolean; autoApplyAfterApproval: boolean };
  audit: { enabled: boolean; retainRawDays: number };
};

const API = '/api/settings';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: 'GET' });
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`PATCH ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function apiDelete(path: string): Promise<void> {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

function cls(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="text-xl font-semibold text-slate-900 dark:text-white">{title}</div>
      {subtitle ? <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</div> : null}
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'sources' | 'access' | 'updates'>('sources');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [emailSources, setEmailSources] = useState<EmailSource[]>([]);
  const [regSources, setRegSources] = useState<RegulatorySource[]>([]);
  const [policies, setPolicies] = useState<UpdatePolicies | null>(null);

  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('Operator');

  const [newEmailType, setNewEmailType] = useState<EmailSourceType>('domain');
  const [newEmailValue, setNewEmailValue] = useState('');
  const [newEmailLabel, setNewEmailLabel] = useState('Custom');

  const [newRegAuthority, setNewRegAuthority] = useState<Authority>('ARMAK');
  const [newRegDocId, setNewRegDocId] = useState('');
  const [newRegUrl, setNewRegUrl] = useState('');
  const [newRegDownloadMode, setNewRegDownloadMode] = useState<'fulltext' | 'metadata'>('metadata');
  const [newRegMonitoring, setNewRegMonitoring] = useState<'monthly' | 'weekly' | 'manual'>('monthly');

  const canSavePolicies = useMemo(() => !!policies, [policies]);

  async function refreshAll() {
    setLoading(true);
    setErr(null);
    try {
      const [es, rs, p] = await Promise.all([
        apiGet<EmailSource[]>('/sources/email'),
        apiGet<RegulatorySource[]>('/sources/regulatory'),
        apiGet<UpdatePolicies>('/update-policies'),
      ]);
      setEmailSources(es);
      setRegSources(rs);
      setPolicies(p);

      try {
        const u = await apiGet<User[]>('/users');
        setUsers(u);
      } catch {
        setUsers([]);
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshAll();
  }, []);

  async function toggleEmailSource(id: string, enabled: boolean) {
    setErr(null);
    try {
      const updated = await apiPatch<EmailSource>(`/sources/email/${id}`, { enabled });
      setEmailSources((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to update');
    }
  }

  async function deleteEmailSource(id: string) {
    setErr(null);
    try {
      await apiDelete(`/sources/email/${id}`);
      setEmailSources((prev) => prev.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function addEmailSource() {
    setErr(null);
    if (!newEmailValue.trim()) {
      setErr('Введите домен или email');
      return;
    }
    try {
      const created = await apiPost<EmailSource>('/sources/email', {
        type: newEmailType,
        value: newEmailValue.trim(),
        label: newEmailLabel.trim() || 'Custom',
        enabled: true,
        requireDmarcPass: true,
        autoCollect: true,
        autoAnalyze: true,
        requireApproval: true,
      });
      setEmailSources((prev) => [created, ...prev]);
      setNewEmailValue('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add');
    }
  }

  async function toggleRegSource(id: string, enabled: boolean) {
    setErr(null);
    try {
      const updated = await apiPatch<RegulatorySource>(`/sources/regulatory/${id}`, { enabled });
      setRegSources((prev) => prev.map((x) => (x.id === id ? updated : x)));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to update');
    }
  }

  async function deleteRegSource(id: string) {
    setErr(null);
    try {
      await apiDelete(`/sources/regulatory/${id}`);
      setRegSources((prev) => prev.filter((x) => x.id !== id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function addRegSource() {
    setErr(null);
    if (!newRegDocId.trim() || !newRegUrl.trim()) {
      setErr('Заполните docId и URL');
      return;
    }
    try {
      const created = await apiPost<RegulatorySource>('/sources/regulatory', {
        authority: newRegAuthority,
        docId: newRegDocId.trim(),
        url: newRegUrl.trim(),
        enabled: true,
        downloadMode: newRegDownloadMode,
        monitoring: newRegMonitoring,
      });
      setRegSources((prev) => [created, ...prev]);
      setNewRegDocId('');
      setNewRegUrl('');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add');
    }
  }

  async function addUser() {
    setErr(null);
    if (!newUserEmail.trim()) {
      setErr('Введите email пользователя');
      return;
    }
    try {
      const created = await apiPost<User>('/users', { email: newUserEmail.trim(), role: newUserRole });
      setUsers((prev) => [created, ...prev]);
      setNewUserEmail('');
      setNewUserRole('Operator');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to add user (maybe no permission)');
    }
  }

  async function patchUser(id: string, patch: Partial<User>) {
    setErr(null);
    try {
      const updated = await apiPatch<User>(`/users/${id}`, patch);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to update user');
    }
  }

  async function deleteUser(id: string) {
    setErr(null);
    try {
      await apiDelete(`/users/${id}`);
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to delete user');
    }
  }

  async function savePolicies() {
    if (!policies) return;
    setErr(null);
    try {
      const updated = await apiPatch<UpdatePolicies>('/update-policies', policies);
      setPolicies(updated);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to save policies');
    }
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Настройки"
        subtitle="Источники (почта/регуляторы), доступ и режимы обновлений. Все изменения применяются только после approve."
        showUser={true}
      />

      <main className="flex-1 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={refreshAll}
            className="btn btn-secondary"
            disabled={loading}
          >
            {loading ? 'Обновляю…' : 'Обновить'}
          </button>
        </div>

        <div className="flex gap-2 mb-6">
          <TabButton active={tab === 'sources'} onClick={() => setTab('sources')} label="Источники" />
          <TabButton active={tab === 'access'} onClick={() => setTab('access')} label="Доступ" />
          <TabButton active={tab === 'updates'} onClick={() => setTab('updates')} label="Обновления" />
        </div>

        {err ? (
          <div className="mb-6 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
            {err}
          </div>
        ) : null}

        {tab === 'sources' ? (
          <div className="space-y-10">
            <div className="card">
              <div className="card-body">
                <SectionTitle
                  title="Почтовые отправители (Allowlist)"
                  subtitle="Только письма от разрешённых доменов/адресов попадают в автосбор. Рекомендуется Require DMARC pass."
                />
                <div className="flex flex-wrap gap-2 items-end mb-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Тип</label>
                    <select
                      className="input"
                      value={newEmailType}
                      onChange={(e) => setNewEmailType(e.target.value as EmailSourceType)}
                    >
                      <option value="domain">Домен</option>
                      <option value="email">Email</option>
                    </select>
                  </div>
                  <div className="min-w-[260px]">
                    <label className="block text-xs text-slate-500 mb-1">Значение</label>
                    <input
                      className="input w-full"
                      placeholder={newEmailType === 'domain' ? 'mak.ru' : 'someone@mak.ru'}
                      value={newEmailValue}
                      onChange={(e) => setNewEmailValue(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[180px]">
                    <label className="block text-xs text-slate-500 mb-1">Label</label>
                    <input
                      className="input w-full"
                      placeholder="ARMAK / UDK-Klimov / ..."
                      value={newEmailLabel}
                      onChange={(e) => setNewEmailLabel(e.target.value)}
                    />
                  </div>
                  <button onClick={addEmailSource} className="btn btn-primary">
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
                      {emailSources.map((s) => (
                        <tr key={s.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={s.enabled}
                              onChange={(e) => toggleEmailSource(s.id, e.target.checked)}
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
                            <button onClick={() => deleteEmailSource(s.id)} className="btn btn-ghost btn-sm text-red-600 hover:underline">
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                      {emailSources.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            Нет правил. Добавь домены: mak.ru, klimov.ru, ao-star.ru
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-body">
                <SectionTitle
                  title="Регуляторные источники (ICAO/EASA/FAA/ARMAK)"
                  subtitle="Мониторинг обновлений: скачивание open docs или metadata-only. Изменения → review packet → approve → apply."
                />
                <div className="flex flex-wrap gap-2 items-end mb-4">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Authority</label>
                    <select
                      className="input"
                      value={newRegAuthority}
                      onChange={(e) => setNewRegAuthority(e.target.value as Authority)}
                    >
                      <option value="ARMAK">ARMAK</option>
                      <option value="EASA">EASA</option>
                      <option value="FAA">FAA</option>
                      <option value="ICAO">ICAO</option>
                    </select>
                  </div>
                  <div className="min-w-[180px]">
                    <label className="block text-xs text-slate-500 mb-1">docId</label>
                    <input
                      className="input w-full"
                      placeholder="AP-145 / Part-145 / ..."
                      value={newRegDocId}
                      onChange={(e) => setNewRegDocId(e.target.value)}
                    />
                  </div>
                  <div className="min-w-[360px]">
                    <label className="block text-xs text-slate-500 mb-1">URL</label>
                    <input
                      className="input w-full"
                      placeholder="https://..."
                      value={newRegUrl}
                      onChange={(e) => setNewRegUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Mode</label>
                    <select
                      className="input"
                      value={newRegDownloadMode}
                      onChange={(e) => setNewRegDownloadMode(e.target.value as 'fulltext' | 'metadata')}
                    >
                      <option value="metadata">metadata</option>
                      <option value="fulltext">fulltext</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Monitoring</label>
                    <select
                      className="input"
                      value={newRegMonitoring}
                      onChange={(e) => setNewRegMonitoring(e.target.value as 'monthly' | 'weekly' | 'manual')}
                    >
                      <option value="monthly">monthly</option>
                      <option value="weekly">weekly</option>
                      <option value="manual">manual</option>
                    </select>
                  </div>
                  <button onClick={addRegSource} className="btn btn-primary">
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
                      {regSources.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={r.enabled}
                              onChange={(e) => toggleRegSource(r.id, e.target.checked)}
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
                            <button onClick={() => deleteRegSource(r.id)} className="btn btn-ghost btn-sm text-red-600 hover:underline">
                              Удалить
                            </button>
                          </td>
                        </tr>
                      ))}
                      {regSources.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-6 text-center text-slate-500">
                            Нет источников. Добавь ARMAK AP-145 и EASA/FAA MRO ссылки.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'access' ? (
          <div className="card">
            <div className="card-body">
              <SectionTitle
                title="Доступ"
                subtitle="Управление пользователями и ролями. Доступно только Owner/Admin. Последний Owner не может быть удалён."
              />
              <div className="flex flex-wrap gap-2 items-end mb-4">
                <div className="min-w-[260px]">
                  <label className="block text-xs text-slate-500 mb-1">Email</label>
                  <input
                    className="input w-full"
                    placeholder="user@company.com"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Role</label>
                  <select
                    className="input"
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as Role)}
                  >
                    <option value="Owner">Owner</option>
                    <option value="Admin">Admin</option>
                    <option value="Operator">Operator</option>
                    <option value="Reviewer">Reviewer</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                </div>
                <button onClick={addUser} className="btn btn-primary">
                  Добавить пользователя
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="table w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left">Email</th>
                      <th className="text-left">Role</th>
                      <th className="text-left">Active</th>
                      <th className="text-left">Last login</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td className="font-mono">{u.email}</td>
                        <td>
                          <select
                            className="input py-1"
                            value={u.role}
                            onChange={(e) => patchUser(u.id, { role: e.target.value as Role })}
                          >
                            <option value="Owner">Owner</option>
                            <option value="Admin">Admin</option>
                            <option value="Operator">Operator</option>
                            <option value="Reviewer">Reviewer</option>
                            <option value="Viewer">Viewer</option>
                          </select>
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={u.active}
                            onChange={(e) => patchUser(u.id, { active: e.target.checked })}
                            className="rounded"
                          />
                        </td>
                        <td className="text-xs text-slate-600">{u.lastLoginAt ?? '—'}</td>
                        <td className="text-right">
                          <button onClick={() => deleteUser(u.id)} className="btn btn-ghost btn-sm text-red-600 hover:underline">
                            Удалить/Отключить
                          </button>
                        </td>
                      </tr>
                    ))}
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">
                          Нет доступа к списку пользователей (нужны права Owner/Admin) или список пуст.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}

        {tab === 'updates' ? (
          <div className="card">
            <div className="card-body">
              <SectionTitle
                title="Обновления"
                subtitle="Глобальные режимы мониторинга и обработки. Require approval в пилоте фиксирован (всегда ON)."
              />
              {!policies ? (
                <div className="text-slate-500">Политики не загружены.</div>
              ) : (
                <div className="space-y-6">
                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold mb-3">Почта</div>
                    <div className="flex flex-wrap gap-4">
                      <Field label="Mode">
                        <select
                          className="input"
                          value={policies.email.mode}
                          onChange={(e) => setPolicies({ ...policies, email: { ...policies.email, mode: e.target.value as 'scheduled' | 'manual' } })}
                        >
                          <option value="scheduled">scheduled</option>
                          <option value="manual">manual</option>
                        </select>
                      </Field>
                      <Field label="Interval (min)">
                        <input
                          type="number"
                          className="input w-32"
                          value={policies.email.intervalMin ?? 60}
                          onChange={(e) =>
                            setPolicies({ ...policies, email: { ...policies.email, intervalMin: Number(e.target.value || 60) } })
                          }
                          disabled={policies.email.mode === 'manual'}
                          min={5}
                          max={1440}
                        />
                      </Field>
                      <Field label="Require DMARC pass">
                        <input
                          type="checkbox"
                          checked={policies.email.requireDmarcPass}
                          onChange={(e) =>
                            setPolicies({ ...policies, email: { ...policies.email, requireDmarcPass: e.target.checked } })
                          }
                          className="rounded"
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold mb-3">Регуляторы</div>
                    <div className="flex flex-wrap gap-4 items-end">
                      <Field label="Mode">
                        <select
                          className="input"
                          value={policies.regulatory.mode}
                          onChange={(e) =>
                            setPolicies({ ...policies, regulatory: { ...policies.regulatory, mode: e.target.value as 'scheduled' | 'manual' } })
                          }
                        >
                          <option value="scheduled">scheduled</option>
                          <option value="manual">manual</option>
                        </select>
                      </Field>
                      <Field label="Schedule type">
                        <select
                          className="input"
                          value={policies.regulatory.schedule?.type ?? 'monthly'}
                          onChange={(e) =>
                            setPolicies({
                              ...policies,
                              regulatory: {
                                ...policies.regulatory,
                                schedule: { ...(policies.regulatory.schedule ?? { hour: 9 }), type: e.target.value as 'monthly' | 'weekly' },
                              },
                            })
                          }
                          disabled={policies.regulatory.mode === 'manual'}
                        >
                          <option value="monthly">monthly</option>
                          <option value="weekly">weekly</option>
                        </select>
                      </Field>
                      <Field label="Day (monthly)">
                        <input
                          type="number"
                          className="input w-28"
                          value={policies.regulatory.schedule?.day ?? 1}
                          onChange={(e) =>
                            setPolicies({
                              ...policies,
                              regulatory: {
                                ...policies.regulatory,
                                schedule: { ...(policies.regulatory.schedule ?? { type: 'monthly', hour: 9 }), day: Number(e.target.value || 1) },
                              },
                            })
                          }
                          disabled={policies.regulatory.mode === 'manual' || (policies.regulatory.schedule?.type ?? 'monthly') !== 'monthly'}
                          min={1}
                          max={31}
                        />
                      </Field>
                      <Field label="Hour">
                        <input
                          type="number"
                          className="input w-24"
                          value={policies.regulatory.schedule?.hour ?? 9}
                          onChange={(e) =>
                            setPolicies({
                              ...policies,
                              regulatory: {
                                ...policies.regulatory,
                                schedule: { ...(policies.regulatory.schedule ?? { type: 'monthly', day: 1 }), hour: Number(e.target.value || 9) },
                              },
                            })
                          }
                          disabled={policies.regulatory.mode === 'manual'}
                          min={0}
                          max={23}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold mb-3">Обработка</div>
                    <div className="flex flex-wrap gap-6">
                      <Toggle
                        label="Auto-collect"
                        checked={policies.processing.autoCollect}
                        onChange={(v) => setPolicies({ ...policies, processing: { ...policies.processing, autoCollect: v } })}
                      />
                      <Toggle
                        label="Auto-analyze"
                        checked={policies.processing.autoAnalyze}
                        onChange={(v) => setPolicies({ ...policies, processing: { ...policies.processing, autoAnalyze: v } })}
                      />
                      <Toggle
                        label="Require approval (pilot locked)"
                        checked={policies.processing.requireApproval}
                        onChange={() => {}}
                        locked
                      />
                      <Toggle
                        label="Auto-apply after approval"
                        checked={policies.processing.autoApplyAfterApproval}
                        onChange={(v) =>
                          setPolicies({ ...policies, processing: { ...policies.processing, autoApplyAfterApproval: v } })
                        }
                      />
                    </div>
                    <div className="text-xs text-slate-500 mt-2">
                      Рекомендация для пилота: auto-apply выключен — оператор нажимает Apply вручную.
                    </div>
                  </div>

                  <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="font-semibold mb-3">Аудит</div>
                    <div className="flex flex-wrap gap-4 items-end">
                      <Toggle
                        label="Audit enabled"
                        checked={policies.audit.enabled}
                        onChange={(v) => setPolicies({ ...policies, audit: { ...policies.audit, enabled: v } })}
                      />
                      <Field label="Retain raw (days)">
                        <input
                          type="number"
                          className="input w-32"
                          value={policies.audit.retainRawDays}
                          onChange={(e) =>
                            setPolicies({ ...policies, audit: { ...policies.audit, retainRawDays: Number(e.target.value || 365) } })
                          }
                          min={30}
                          max={3650}
                        />
                      </Field>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={savePolicies}
                      disabled={!canSavePolicies}
                      className={cls('btn', canSavePolicies ? 'btn-primary' : 'btn-secondary opacity-50')}
                    >
                      Сохранить
                    </button>
                    <button onClick={refreshAll} className="btn btn-secondary">
                      Отменить (перезагрузить)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </DashboardLayout>
  );
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cls(
        'px-4 py-2 rounded-lg text-sm border transition-colors',
        active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
      )}
    >
      {label}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  locked,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  locked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => !locked && onChange(e.target.checked)}
        disabled={locked}
        className="rounded"
      />
      <span className={cls(locked && 'text-slate-500')}>{label}</span>
    </label>
  );
}
