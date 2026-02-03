'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

type MailDetail = {
  event: {
    mail_id: string;
    source: { system: string; mailbox: string; uid: string };
    message_id: string;
    received_at: string;
    from: string;
    to: string[];
    cc: string[];
    subject: string;
    body_text: string;
    attachments: Array<{ filename: string; mime: string; size: number; sha256: string }>;
  } | null;
  triage: {
    category: string;
    confidence: number;
    summary: string;
    risk_flags: string[];
    entities: Record<string, unknown>;
    suggested_operator: string;
    proposed_changes: Array<{ target: string; mode: string; patch: string; explanation: string }>;
  } | null;
  decisions: Array<{
    operator_id: string;
    decision: string;
    reason: string | null;
    apply_mode?: string;
    at: string;
  }>;
}

export default function MailDetailPage() {
  const params = useParams();
  const mailId = params?.mail_id as string;
  const { data: session } = useSession();
  const [detail, setDetail] = useState<MailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [applyMode, setApplyMode] = useState<string>('draft');

  useEffect(() => {
    if (!mailId) return;
    fetch(`/api/mail/${mailId}`)
      .then((r) => {
        if (r.status === 404) return null;
        return r.json();
      })
      .then((data) => {
        setDetail(data ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [mailId]);

  const sendDecision = async (decision: string) => {
    if (!mailId) return;
    setActionLoading(true);
    try {
      const body: { decision: string; reason?: string; apply_mode?: string } = { decision };
      if (decision === 'accept') body.apply_mode = applyMode;
      const r = await fetch(`/api/mail/${mailId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (data.ok) {
        if (typeof window !== 'undefined') window.location.reload();
      } else {
        alert(data.error ?? 'Ошибка');
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <main className="p-6 lg:p-8">
          <p className="text-slate-500 dark:text-slate-400">Загрузка…</p>
        </main>
      </DashboardLayout>
    );
  }

  if (!detail?.event) {
    return (
      <DashboardLayout>
        <main className="p-6 lg:p-8">
          <PageHeader title="Письмо не найдено" />
          <p className="text-slate-500 dark:text-slate-400">
            Письмо с id <code className="rounded bg-slate-100 px-1 dark:bg-slate-700">{mailId}</code> не найдено.
          </p>
          <Link href="/mail/inbox" className="mt-4 inline-block text-blue-600 dark:text-blue-400 hover:underline">
            ← В очередь
          </Link>
        </main>
      </DashboardLayout>
    );
  }

  const { event, triage, decisions } = detail;

  return (
    <DashboardLayout>
      <main className="p-6 lg:p-8">
        <PageHeader
          title={event.subject || '(без темы)'}
          description={`${event.from} · ${event.source.system}/${event.source.mailbox} · ${new Date(event.received_at).toLocaleString()}`}
        />
        <div className="mb-4">
          <Link href="/mail/inbox" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            ← Очередь писем
          </Link>
        </div>

        {triage && (
          <section className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Triage</h3>
            <p className="mt-1 text-sm">
              Категория: <strong>{triage.category}</strong> · уверенность: {(triage.confidence * 100).toFixed(0)}%
            </p>
            <p className="mt-1 text-sm">{triage.summary}</p>
            {triage.risk_flags.length > 0 && (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                Risk: {triage.risk_flags.join(', ')}
              </p>
            )}
            {triage.proposed_changes.length > 0 && (
              <div className="mt-3">
                <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Предложенные изменения ({triage.proposed_changes.length})
                </h4>
                {triage.proposed_changes.map((ch, i) => (
                  <div key={i} className="mt-1 rounded border border-slate-200 bg-white p-2 font-mono text-xs dark:border-slate-600 dark:bg-slate-800">
                    <div className="text-slate-500 dark:text-slate-400">{ch.target} · {ch.mode}</div>
                    <div className="mt-1 whitespace-pre-wrap break-all">{ch.explanation}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Текст письма</h3>
          <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-100 p-3 text-sm dark:bg-slate-900">
            {event.body_text || '(пусто)'}
          </pre>
          {event.attachments.length > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Вложения: {event.attachments.map((a) => a.filename).join(', ')} (в AI не передаются, только метаданные)
            </p>
          )}
        </section>

        {decisions.length > 0 && (
          <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">История решений</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {decisions.map((d, i) => (
                <li key={i}>
                  {d.decision} {d.apply_mode ? `(${d.apply_mode})` : ''} — {d.operator_id} ·{' '}
                  {new Date(d.at).toLocaleString()}
                  {d.reason ? ` · ${d.reason}` : ''}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Решение</h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">
              При Accept применить:
              <select
                value={applyMode}
                onChange={(e) => setApplyMode(e.target.value)}
                className="ml-2 rounded border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              >
                <option value="draft">Как черновик</option>
                <option value="safe_auto">Сразу (только safe rules)</option>
                <option value="manual">Вручную</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => sendDecision('accept')}
              disabled={actionLoading}
              className="rounded bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700 disabled:opacity-50"
            >
              Accept
            </button>
            <button
              type="button"
              onClick={() => sendDecision('reject')}
              disabled={actionLoading}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              onClick={() => sendDecision('escalate')}
              disabled={actionLoading}
              className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Escalate
            </button>
            <button
              type="button"
              onClick={() => sendDecision('request_info')}
              disabled={actionLoading}
              className="rounded bg-slate-500 px-3 py-1.5 text-sm text-white hover:bg-slate-600 disabled:opacity-50"
            >
              Request info
            </button>
          </div>
        </section>
      </main>
    </DashboardLayout>
  );
}
