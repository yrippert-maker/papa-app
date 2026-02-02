'use client';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { StatePanel } from '@/components/ui/StatePanel';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';

const INSPECTION_VIEW_PERMS = ['INSPECTION.VIEW', 'INSPECTION.MANAGE'];
import { useCallback, useEffect, useState } from 'react';

type CheckResult = {
  inspection_check_result_id: string;
  check_code: string;
  result: string;
  value: string | null;
  unit: string | null;
  comment: string | null;
};

type TemplateHint = {
  title: string;
  description: string | null;
  mandatory: boolean;
};

type CardDetail = {
  inspection_card_id: string;
  card_no: string;
  card_kind: string;
  status: string;
  request_no: string | null;
  request_title: string | null;
  check_results: CheckResult[];
  template_hints: Record<string, TemplateHint>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  IN_PROGRESS: 'В работе',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
};

const RESULT_LABELS: Record<string, string> = {
  PASS: 'Пройдено',
  FAIL: 'Не пройдено',
  NA: 'Н/П',
};

const RESULT_CLASS: Record<string, string> = {
  PASS: 'badge-success',
  FAIL: 'badge-error',
  NA: 'badge-secondary',
};

const IMMUTABLE_STATUSES = ['COMPLETED', 'CANCELLED'];

export default function InspectionCardDetailPage() {
  const params = useParams();
  const { data: session, status } = useSession();
  const id = params?.id as string;
  const [card, setCard] = useState<CardDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changedCodes, setChangedCodes] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, { result: string; value: string; unit: string; comment: string }>>({});

  const permissions = (session?.user as { permissions?: string[] } | undefined)?.permissions ?? [];
  const hasInspectionView = INSPECTION_VIEW_PERMS.some((p) => permissions.includes(p));

  const loadCard = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/inspection/cards/${id}`)
      .then((r) => {
        if (r.status === 403) throw new Error('FORBIDDEN');
        if (!r.ok) throw new Error(r.status === 404 ? 'Карта не найдена' : 'Ошибка загрузки');
        return r.json();
      })
      .then((data) => {
        setCard(data);
        const form: Record<string, { result: string; value: string; unit: string; comment: string }> = {};
        for (const cr of data.check_results ?? []) {
          form[cr.check_code] = {
            result: cr.result,
            value: cr.value ?? '',
            unit: cr.unit ?? '',
            comment: cr.comment ?? '',
          };
        }
        for (const code of Object.keys(data.template_hints ?? {})) {
          if (!form[code]) {
            form[code] = { result: 'PASS', value: '', unit: '', comment: '' };
          }
        }
        setEditForm(form);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!hasInspectionView) {
      setError('Доступ запрещён');
      setLoading(false);
      return;
    }
    loadCard();
  }, [loadCard, status, hasInspectionView]);

  const isImmutable = card && IMMUTABLE_STATUSES.includes(card.status);
  const hasManage = (card?.status && !isImmutable) ?? false;

  const handleSaveResults = () => {
    if (!id || !card || isImmutable) return;
    const results = Object.entries(editForm).map(([check_code, v]) => ({
      check_code,
      result: v.result,
      value: v.value || undefined,
      unit: v.unit || undefined,
      comment: v.comment || undefined,
    }));
    setSaving(true);
    fetch(`/api/inspection/cards/${id}/check-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((b) => Promise.reject(new Error(b.error ?? 'Ошибка')));
        return r.json();
      })
      .then((data) => {
        setChangedCodes(new Set((data.changed ?? []).map((c: { check_code: string }) => c.check_code)));
        loadCard();
        setTimeout(() => setChangedCodes(new Set()), 3000);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка сохранения'))
      .finally(() => setSaving(false));
  };

  const handleTransition = (status: string) => {
    if (!id || !card || isImmutable) return;
    setSaving(true);
    fetch(`/api/inspection/cards/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((b) => Promise.reject(new Error(b.error ?? 'Ошибка')));
        return r.json();
      })
      .then(() => loadCard())
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка смены статуса'))
      .finally(() => setSaving(false));
  };

  const updateForm = (code: string, field: string, value: string) => {
    setEditForm((prev) => {
      const next = { ...prev };
      if (!next[code]) next[code] = { result: 'PASS', value: '', unit: '', comment: '' };
      (next[code] as Record<string, string>)[field] = value;
      return next;
    });
  };

  if (status === 'loading' || (hasInspectionView && loading && !card)) {
    return (
      <DashboardLayout>
        <PageHeader title="Техкарта" />
        <main className="flex-1 p-6 lg:p-8">
          <StatePanel variant="loading" title="Загрузка..." />
        </main>
      </DashboardLayout>
    );
  }

  if (!hasInspectionView || error === 'FORBIDDEN') {
    return (
      <DashboardLayout>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="card max-w-md w-full text-center">
            <div className="card-body">
              <h2 className="text-xl font-semibold text-[#0F172A] dark:text-slate-100 mb-2">Доступ запрещён</h2>
              <p className="text-[#64748B] dark:text-slate-400 mb-4">
                У вас нет прав для просмотра техкарт (требуется INSPECTION.VIEW).
              </p>
              <Link href="/" className="btn btn-primary">
                На главную
              </Link>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !card) {
    return (
      <DashboardLayout>
        <PageHeader title="Техкарта" />
        <main className="flex-1 p-6 lg:p-8">
          <StatePanel
            variant="error"
            title={error}
            actions={
              <Link href="/inspection" className="btn btn-secondary">
                К списку
              </Link>
            }
          />
        </main>
      </DashboardLayout>
    );
  }

  if (!card) return null;

  const templateCodes = Object.keys(card.template_hints ?? {});

  return (
    <DashboardLayout>
      <PageHeader
        title={`Техкарта ${card.card_no}`}
        subtitle={card.request_title ?? card.request_no ?? undefined}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/inspection" className="btn btn-ghost btn-sm">
              ← К списку
            </Link>
            <Link href={`/inspection/${id}/audit`} className="btn btn-outline btn-sm">
              Журнал событий
            </Link>
          </div>
        }
      />
      <main className="flex-1 p-6 lg:p-8 space-y-6">
        {error && (
          <StatePanel
            variant="error"
            title={error}
            actions={
              <button onClick={() => setError(null)} className="btn btn-secondary btn-sm">
                Закрыть
              </button>
            }
          />
        )}

        <div className="card">
          <div className="card-header flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#0F172A] dark:text-slate-100">
                {card.card_no} — {card.request_title ?? card.request_no ?? '—'}
              </h3>
              <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1">
                Статус:{' '}
                <span className={`badge ${card.status === 'COMPLETED' ? 'badge-success' : card.status === 'CANCELLED' ? 'badge-secondary' : 'badge-primary'}`}>
                  {STATUS_LABELS[card.status] ?? card.status}
                </span>
              </p>
            </div>
            {hasManage && (
              <div className="flex gap-2">
                {card.status === 'DRAFT' && (
                  <button
                    onClick={() => handleTransition('IN_PROGRESS')}
                    disabled={saving}
                    className="btn btn-primary btn-sm"
                  >
                    В работу
                  </button>
                )}
                {card.status === 'IN_PROGRESS' && (
                  <>
                    <button
                      onClick={() => handleTransition('COMPLETED')}
                      disabled={saving}
                      className="btn btn-primary btn-sm"
                    >
                      Завершить
                    </button>
                    <button
                      onClick={() => handleTransition('CANCELLED')}
                      disabled={saving}
                      className="btn btn-danger btn-sm"
                    >
                      Отменить
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="card-body">
            <h4 className="text-sm font-semibold text-[#64748B] dark:text-slate-400 uppercase tracking-wider mb-4">
              Результаты проверок
            </h4>

            {isImmutable ? (
              <StatePanel
                variant="empty"
                title="Редактирование недоступно"
                description={`Карта в статусе «${STATUS_LABELS[card.status]}» — изменения запрещены.`}
              />
            ) : null}

            <div className="space-y-4">
              {templateCodes.length === 0 ? (
                <p className="text-[#64748B] dark:text-slate-400">Нет шаблона проверок для данного типа карты.</p>
              ) : (
                templateCodes.map((code) => {
                  const hint = card.template_hints?.[code];
                  const existing = card.check_results?.find((r) => r.check_code === code);
                  const form = editForm[code] ?? { result: 'PASS', value: '', unit: '', comment: '' };
                  const isChanged = changedCodes.has(code);

                  return (
                    <div
                      key={code}
                      className={`p-4 rounded-lg border ${
                        isChanged ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#0F172A] dark:text-slate-100">
                            {code}
                            {hint?.mandatory && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          {hint?.title && (
                            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-0.5">{hint.title}</p>
                          )}
                          {hint?.description && (
                            <p className="text-xs text-[#94a3b8] dark:text-slate-500 mt-1 italic">
                              {hint.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isImmutable ? (
                            <span className={`badge ${RESULT_CLASS[existing?.result ?? form.result] ?? 'badge-secondary'}`}>
                              {RESULT_LABELS[existing?.result ?? form.result] ?? existing?.result ?? form.result}
                            </span>
                          ) : (
                            <select
                              value={form.result}
                              onChange={(e) => updateForm(code, 'result', e.target.value)}
                              className="input py-1.5 px-2 text-sm w-28"
                            >
                              <option value="PASS">Пройдено</option>
                              <option value="FAIL">Не пройдено</option>
                              <option value="NA">Н/П</option>
                            </select>
                          )}
                          {isChanged && (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                              ✓ Сохранено
                            </span>
                          )}
                        </div>
                      </div>
                      {!isImmutable && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className="label text-xs">Значение</label>
                            <input
                              type="text"
                              value={form.value}
                              onChange={(e) => updateForm(code, 'value', e.target.value)}
                              placeholder="12.5"
                              className="input py-1.5 text-sm"
                            />
                          </div>
                          <div>
                            <label className="label text-xs">Ед. изм.</label>
                            <input
                              type="text"
                              value={form.unit}
                              onChange={(e) => updateForm(code, 'unit', e.target.value)}
                              placeholder="kg, pcs"
                              className="input py-1.5 text-sm"
                            />
                          </div>
                          <div className="sm:col-span-1">
                            <label className="label text-xs">Комментарий</label>
                            <input
                              type="text"
                              value={form.comment}
                              onChange={(e) => updateForm(code, 'comment', e.target.value)}
                              placeholder="—"
                              className="input py-1.5 text-sm"
                            />
                          </div>
                        </div>
                      )}
                      {isImmutable && (existing?.value || existing?.comment) && (
                        <div className="mt-2 text-sm text-[#64748B] dark:text-slate-400">
                          {existing?.value && (
                            <span>
                              {existing.value}
                              {existing.unit && ` ${existing.unit}`}
                            </span>
                          )}
                          {existing?.comment && (
                            <p className="mt-1 italic">{existing.comment}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {hasManage && templateCodes.length > 0 && (
              <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleSaveResults}
                  disabled={saving}
                  className="btn btn-primary"
                >
                  {saving ? 'Сохранение...' : 'Сохранить результаты'}
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </DashboardLayout>
  );
}
