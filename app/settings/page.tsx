'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { Tabs } from '@/components/ui';
import type { Role, User, EmailSource, EmailSourceType, RegulatorySource, Authority, UpdatePolicies } from './_components/SettingsTypes';
import { apiGet } from './_components/SettingsApi';
import { EmailSourcesSection } from './_components/EmailSourcesSection';
import { RegulatorySourcesSection } from './_components/RegulatorySourcesSection';
import { AccessSection } from './_components/AccessSection';
import { UpdatesSection } from './_components/UpdatesSection';

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

  const tabItems = [
    {
      key: 'sources',
      label: 'Источники',
      content: (
        <div className="space-y-10">
          <EmailSourcesSection
            sources={emailSources}
            onUpdate={setEmailSources}
            onError={setErr}
            newType={newEmailType}
            newValue={newEmailValue}
            newLabel={newEmailLabel}
            onNewChange={(type, value, label) => {
              setNewEmailType(type);
              setNewEmailValue(value);
              setNewEmailLabel(label);
            }}
          />
          <RegulatorySourcesSection
            sources={regSources}
            onUpdate={setRegSources}
            onError={setErr}
            newAuthority={newRegAuthority}
            newDocId={newRegDocId}
            newUrl={newRegUrl}
            newDownloadMode={newRegDownloadMode}
            newMonitoring={newRegMonitoring}
            onNewChange={(updates) => {
              if ('authority' in updates) setNewRegAuthority(updates.authority!);
              if ('docId' in updates) setNewRegDocId(updates.docId ?? '');
              if ('url' in updates) setNewRegUrl(updates.url ?? '');
              if ('downloadMode' in updates) setNewRegDownloadMode(updates.downloadMode!);
              if ('monitoring' in updates) setNewRegMonitoring(updates.monitoring!);
            }}
          />
        </div>
      ),
    },
    {
      key: 'access',
      label: 'Доступ',
      content: (
        <AccessSection
          users={users}
          onUpdate={setUsers}
          onError={setErr}
          newEmail={newUserEmail}
          newRole={newUserRole}
          onNewChange={(email, role) => {
            setNewUserEmail(email);
            setNewUserRole(role);
          }}
        />
      ),
    },
    {
      key: 'updates',
      label: 'Обновления',
      content: (
        <UpdatesSection
          policies={policies}
          onUpdate={setPolicies}
          onError={setErr}
          onRefresh={refreshAll}
        />
      ),
    },
  ];

  return (
    <DashboardLayout>
      <PageHeader
        title="Настройки"
        subtitle="Источники (почта/регуляторы), доступ и режимы обновлений."
        showUser={true}
      />

      <main className="flex-1 p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={refreshAll} className="btn btn-secondary" disabled={loading}>
            {loading ? 'Обновляю…' : 'Обновить'}
          </button>
        </div>

        {err && (
          <div className="mb-6 p-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 text-sm">
            {err}
          </div>
        )}

        <Tabs tabs={tabItems} activeKey={tab} onChange={(k) => setTab(k as typeof tab)} />
      </main>
    </DashboardLayout>
  );
}
