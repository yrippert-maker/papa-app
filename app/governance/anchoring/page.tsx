'use client';

import { Suspense } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import AnchoringPage from '@/components/governance/AnchoringPage';

export default function Page() {
  return (
    <DashboardLayout>
      <Suspense fallback={<div className="p-6">Загрузка…</div>}>
        <AnchoringPage />
      </Suspense>
    </DashboardLayout>
  );
}
