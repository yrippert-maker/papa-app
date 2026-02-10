'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const CATEGORIES = [
  { value: 'TECH_CARD', label: 'По техкарте' },
  { value: 'TRANSFER', label: 'Перемещение' },
  { value: 'OTHER', label: 'Прочее' },
];

export default function NewOutgoingRequestPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('TECH_CARD');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/tmc/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          request_kind: 'OUTGOING',
          request_category: category,
          notes,
        }),
      });
      if (res.ok) {
        router.push('/tmc-requests/outgoing');
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка создания заявки');
      }
    } catch {
      alert('Ошибка сети');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader title="Новая исходящая заявка" subtitle="Создание заявки на выдачу ТМЦ" />
      <main className="flex-1 p-6 lg:p-8 max-w-2xl">
        <form onSubmit={handleSubmit} className="card">
          <div className="card-body space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Название заявки</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                placeholder="Например: Выдача по техкарте №123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Категория</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#0F172A] mb-1">Примечания</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-[#E2E8F0] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#DC2626]"
                placeholder="Дополнительная информация..."
              />
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary"
              >
                {saving ? 'Сохранение...' : 'Создать заявку'}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="btn btn-secondary"
              >
                Отмена
              </button>
            </div>
          </div>
        </form>
      </main>
    </DashboardLayout>
  );
}
