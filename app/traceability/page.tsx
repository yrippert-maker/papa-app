'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useState } from 'react';

const MOCK_CARD = {
  engineSn: '12345',
  status: 'installed',
  helicopter: 'Mi-8 RA-12345',
  operator: 'XYZ',
  installedAt: '2026-01-12',
  docs: ['Release note', 'Work order', 'Certificates'],
};

export default function TraceabilityPage() {
  const [search, setSearch] = useState('');

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-6">
          Эксплуатация (двигатель → вертолёт)
        </h2>
        <div className="mb-6">
          <input
            type="search"
            placeholder="Engine SN / Helicopter tail / Operator"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input max-w-md"
          />
        </div>
        <div className="card max-w-2xl">
          <div className="card-header py-4">
            <h3 className="text-base font-semibold">Карточка: Engine SN {MOCK_CARD.engineSn}</h3>
          </div>
          <div className="card-body space-y-4">
            <div>
              <p className="text-sm text-slate-500">Status</p>
              <p className="font-medium">{MOCK_CARD.status}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Helicopter</p>
              <p>{MOCK_CARD.helicopter}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Operator</p>
              <p>{MOCK_CARD.operator}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Installed at</p>
              <p>{MOCK_CARD.installedAt}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-2">Docs</p>
              <div className="flex gap-2">
                {MOCK_CARD.docs.map((d) => (
                  <button key={d} className="btn btn-sm btn-outline">
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-slate-500 pt-2">
              History: Repair #R-2025-091 → installed → removed …
            </p>
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
