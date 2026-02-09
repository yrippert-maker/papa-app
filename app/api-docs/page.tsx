'use client';

import 'swagger-ui-react/swagger-ui.css';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { usePermissions } from '@/hooks';
import { PERMISSIONS } from '@/lib/authz';

const SwaggerUI = dynamic(() => import('swagger-ui-react').then((mod) => mod.default), {
  ssr: false,
  loading: () => <div className="p-8">Загрузка документации…</div>,
});

export default function ApiDocsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { can } = usePermissions();
  const [spec, setSpec] = useState<Record<string, unknown> | null>(null);

  const allowed = can(PERMISSIONS.ADMIN_MANAGE_USERS) || can(PERMISSIONS.COMPLIANCE_VIEW);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.replace('/login');
      return;
    }
    if (!allowed) {
      router.replace('/403');
      return;
    }
    fetch('/openapi.json')
      .then((r) => r.json())
      .then(setSpec)
      .catch(() => setSpec(null));
  }, [session, status, allowed, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="flex items-center justify-center min-h-screen">Загрузка…</div>
    );
  }

  if (!allowed) return null;

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">API Документация</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          OpenAPI 3.1 спецификация. Запустите <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">npm run openapi:generate</code> для обновления.
        </p>
        {spec && (
          <div className="[&_.swagger-ui]:font-sans">
            <SwaggerUI spec={spec} />
          </div>
        )}
        {!spec && allowed && (
          <p className="text-amber-600">Файл openapi.json не найден. Выполните npm run openapi:generate</p>
        )}
      </div>
    </DashboardLayout>
  );
}
