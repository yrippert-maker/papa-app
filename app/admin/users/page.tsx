'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useEffect, useState } from 'react';

type User = {
  id: number;
  email: string;
  role_code: string;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  STOREKEEPER: 'Кладовщик',
  ENGINEER: 'Инженер',
  AUDITOR: 'Аудитор',
};

const ROLES = ['ADMIN', 'MANAGER', 'STOREKEEPER', 'ENGINEER', 'AUDITOR'] as const;

function formatDate(s: string): string {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(s));
  } catch {
    return s;
  }
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [modalAdd, setModalAdd] = useState(false);
  const [modalRole, setModalRole] = useState<{ user: User } | null>(null);
  const [modalReset, setModalReset] = useState<{ user: User; tempPassword: string } | null>(null);

  const [formEmail, setFormEmail] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRole, setFormRole] = useState<string>('MANAGER');
  const [formAdminConfirm, setFormAdminConfirm] = useState(false);
  const [formRoleEdit, setFormRoleEdit] = useState<string>('MANAGER');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const loadUsers = (cursor?: string | null) => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    const url = cursor ? `/api/admin/users?limit=20&cursor=${encodeURIComponent(cursor)}` : '/api/admin/users?limit=20';
    fetch(url)
      .then((r) => {
        if (r.status === 403) {
          setForbidden(true);
          return { users: [], nextCursor: null, hasMore: false };
        }
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error ?? 'Ошибка')));
        return r.json();
      })
      .then((data) => {
        if (cursor) {
          setUsers((prev) => [...prev, ...(data.users ?? [])]);
        } else {
          setUsers(data.users ?? []);
        }
        setNextCursor(data.nextCursor ?? null);
        setHasMore(data.hasMore ?? false);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadUsers(null);
  }, []);

  const loadMore = () => {
    if (nextCursor && !loading) loadUsers(nextCursor);
  };

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (formRole === 'ADMIN' && !formAdminConfirm) {
      setSubmitError('Подтвердите создание пользователя с ролью Администратор');
      return;
    }
    setSubmitError(null);
    setSubmitLoading(true);
    fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: formEmail, password: formPassword, role_code: formRole }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setModalAdd(false);
        setFormEmail('');
        setFormPassword('');
        setFormAdminConfirm(false);
        loadUsers();
      })
      .catch((e) => setSubmitError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setSubmitLoading(false));
  };

  const handleChangeRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalRole) return;
    setSubmitError(null);
    setSubmitLoading(true);
    fetch(`/api/admin/users/${modalRole.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role_code: formRoleEdit }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setModalRole(null);
        loadUsers();
      })
      .catch((e) => setSubmitError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setSubmitLoading(false));
  };

  const handleResetPassword = (user: User) => {
    setSubmitError(null);
    setSubmitLoading(true);
    fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset_password: true }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setModalReset({
          user,
          tempPassword: data.temporary_password ?? '',
        });
      })
      .catch((e) => setSubmitError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setSubmitLoading(false));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (forbidden) {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card max-w-md w-full text-center">
            <div className="card-body">
              <h2 className="text-xl font-semibold text-[#0F172A] mb-2">Доступ запрещён</h2>
              <p className="text-[#64748B]">У вас нет прав для управления пользователями.</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader
        title="Пользователи"
        subtitle="Управление учётными записями"
        actions={
          <button
            onClick={() => {
              setFormAdminConfirm(false);
              setModalAdd(true);
            }}
            className="btn btn-primary"
          >
            + Добавить пользователя
          </button>
        }
      />

      <main className="flex-1 p-6 lg:p-8">
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="card">
          <div className="card-body overflow-x-auto">
            {loading ? (
              <p className="text-[#64748B] dark:text-slate-400">Загрузка...</p>
            ) : users.length === 0 ? (
              <p className="text-[#64748B] dark:text-slate-400">Нет пользователей.</p>
            ) : (
              <table className="table w-full">
                <thead>
                  <tr>
                    <th className="text-left">Email</th>
                    <th className="text-left">Роль</th>
                    <th className="text-left">Создан</th>
                    <th className="text-right">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td className="font-medium">{u.email}</td>
                      <td>{ROLE_LABELS[u.role_code] ?? u.role_code}</td>
                      <td>{formatDate(u.created_at)}</td>
                      <td className="text-right">
                        <button
                          onClick={() => {
                            setFormRoleEdit(u.role_code);
                            setModalRole({ user: u });
                          }}
                          className="btn btn-ghost btn-sm mr-2"
                        >
                          Роль
                        </button>
                        <button
                          onClick={() => handleResetPassword(u)}
                          className="btn btn-ghost btn-sm"
                          disabled={submitLoading}
                        >
                          Пароль
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {hasMore && !loading && (
              <div className="mt-4 flex justify-center">
                <button onClick={loadMore} className="btn btn-secondary">
                  Загрузить ещё
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal: Add User */}
      {modalAdd && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => !submitLoading && setModalAdd(false)}
        >
          <div
            className="card max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold">Добавить пользователя</h3>
              <button
                onClick={() => !submitLoading && setModalAdd(false)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddUser} className="card-body space-y-4">
              {submitError && (
                <p className="text-red-600 dark:text-red-400 text-sm">{submitError}</p>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Email</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="input w-full"
                  placeholder="user@local"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Пароль (мин. 8 символов)</label>
                <input
                  type="password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="input w-full"
                  minLength={8}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Роль</label>
                <select
                  value={formRole}
                  onChange={(e) => {
                    setFormRole(e.target.value);
                    if (e.target.value !== 'ADMIN') setFormAdminConfirm(false);
                  }}
                  className="input w-full"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              {formRole === 'ADMIN' && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formAdminConfirm}
                    onChange={(e) => setFormAdminConfirm(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-amber-700 dark:text-amber-400 font-medium">
                    Подтверждаю создание пользователя с правами администратора
                  </span>
                </label>
              )}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalAdd(false)}
                  className="btn btn-secondary"
                  disabled={submitLoading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitLoading || (formRole === 'ADMIN' && !formAdminConfirm)}
                >
                  {submitLoading ? 'Создание...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Role */}
      {modalRole && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => !submitLoading && setModalRole(null)}
        >
          <div
            className="card max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold">Сменить роль — {modalRole.user.email}</h3>
              <button
                onClick={() => !submitLoading && setModalRole(null)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleChangeRole} className="card-body space-y-4">
              {submitError && (
                <p className="text-red-600 dark:text-red-400 text-sm">{submitError}</p>
              )}
              <div>
                <label className="block text-sm font-medium mb-2">Роль</label>
                <select
                  value={formRoleEdit}
                  onChange={(e) => setFormRoleEdit(e.target.value)}
                  className="input w-full"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setModalRole(null)}
                  className="btn btn-secondary"
                  disabled={submitLoading}
                >
                  Отмена
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitLoading}>
                  {submitLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password — show temp password */}
      {modalReset && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setModalReset(null)}
        >
          <div
            className="card max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header flex items-center justify-between">
              <h3 className="text-lg font-semibold">Пароль сброшен — {modalReset.user.email}</h3>
              <button
                onClick={() => setModalReset(null)}
                className="text-[#64748B] hover:text-[#0F172A]"
              >
                ✕
              </button>
            </div>
            <div className="card-body space-y-4">
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Показан один раз — скопируйте и сохраните. Пароль не логируется.
              </p>
              <p className="text-sm text-[#64748B] dark:text-slate-400">
                Временный пароль для {modalReset.user.email}:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg font-mono text-sm break-all">
                  {modalReset.tempPassword}
                </code>
                <button
                  onClick={() => copyToClipboard(modalReset.tempPassword)}
                  className="btn btn-secondary"
                >
                  Копировать
                </button>
              </div>
              <button onClick={() => setModalReset(null)} className="btn btn-primary w-full">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
