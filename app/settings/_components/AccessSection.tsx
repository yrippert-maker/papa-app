'use client';

import type { User, Role } from './SettingsTypes';
import { apiPost, apiPatch, apiDelete } from './SettingsApi';
import { FormField } from '@/components/ui';

type Props = {
  users: User[];
  onUpdate: (users: User[]) => void;
  onError: (msg: string) => void;
  newEmail: string;
  newRole: Role;
  onNewChange: (email: string, role: Role) => void;
};

export function AccessSection({ users, onUpdate, onError, newEmail, newRole, onNewChange }: Props) {
  async function add() {
    if (!newEmail.trim()) {
      onError('Введите email пользователя');
      return;
    }
    try {
      const created = await apiPost<User>('/users', { email: newEmail.trim(), role: newRole });
      onUpdate([created, ...users]);
      onNewChange('', 'Operator');
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to add user (maybe no permission)');
    }
  }

  async function patch(id: string, patch: Partial<User>) {
    try {
      const updated = await apiPatch<User>(`/users/${id}`, patch);
      onUpdate(users.map((u) => (u.id === id ? updated : u)));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to update user');
    }
  }

  async function remove(id: string) {
    try {
      await apiDelete(`/users/${id}`);
      onUpdate(users.filter((u) => u.id !== id));
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to delete user');
    }
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="mb-4">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">Доступ</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Управление пользователями и ролями. Доступно только Owner/Admin.
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-end mb-4">
          <FormField label="Email">
            <input
              className="input min-w-[260px]"
              placeholder="user@company.com"
              value={newEmail}
              onChange={(e) => onNewChange(e.target.value, newRole)}
            />
          </FormField>
          <FormField label="Role">
            <select
              className="input"
              value={newRole}
              onChange={(e) => onNewChange(newEmail, e.target.value as Role)}
            >
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Operator">Operator</option>
              <option value="Reviewer">Reviewer</option>
              <option value="Viewer">Viewer</option>
            </select>
          </FormField>
          <button onClick={add} className="btn btn-primary">
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
                      onChange={(e) => patch(u.id, { role: e.target.value as Role })}
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
                      onChange={(e) => patch(u.id, { active: e.target.checked })}
                      className="rounded"
                    />
                  </td>
                  <td className="text-xs text-slate-600">{u.lastLoginAt ?? '—'}</td>
                  <td className="text-right">
                    <button onClick={() => remove(u.id)} className="btn btn-ghost btn-sm text-red-600 hover:underline">
                      Удалить/Отключить
                    </button>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    Нет доступа к списку пользователей (нужны права Owner/Admin) или список пуст.
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
