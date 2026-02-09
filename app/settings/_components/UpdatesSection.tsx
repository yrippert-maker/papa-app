'use client';

import type { UpdatePolicies } from './SettingsTypes';
import { apiPatch } from './SettingsApi';
import { FormField } from '@/components/ui';

type Props = {
  policies: UpdatePolicies | null;
  onUpdate: (p: UpdatePolicies) => void;
  onError: (msg: string) => void;
  onRefresh: () => void;
};

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
      <span className={locked ? 'text-slate-500' : ''}>{label}</span>
    </label>
  );
}

export function UpdatesSection({ policies, onUpdate, onError, onRefresh }: Props) {
  async function save() {
    if (!policies) return;
    try {
      const updated = await apiPatch<UpdatePolicies>('/update-policies', policies);
      onUpdate(updated);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Failed to save policies');
    }
  }

  if (!policies) {
    return <div className="text-slate-500">Политики не загружены.</div>;
  }

  return (
    <div className="card">
      <div className="card-body">
        <div className="mb-4">
          <div className="text-xl font-semibold text-slate-900 dark:text-white">Обновления</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Глобальные режимы мониторинга и обработки.
          </div>
        </div>
        <div className="space-y-6">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="font-semibold mb-3">Почта</div>
            <div className="flex flex-wrap gap-4">
              <Field label="Mode">
                <select
                  className="input"
                  value={policies.email.mode}
                  onChange={(e) => onUpdate({ ...policies, email: { ...policies.email, mode: e.target.value as 'scheduled' | 'manual' } })}
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
                  onChange={(e) => onUpdate({ ...policies, email: { ...policies.email, intervalMin: Number(e.target.value || 60) } })}
                  disabled={policies.email.mode === 'manual'}
                  min={5}
                  max={1440}
                />
              </Field>
              <Field label="Require DMARC pass">
                <input
                  type="checkbox"
                  checked={policies.email.requireDmarcPass}
                  onChange={(e) => onUpdate({ ...policies, email: { ...policies.email, requireDmarcPass: e.target.checked } })}
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
                  onChange={(e) => onUpdate({ ...policies, regulatory: { ...policies.regulatory, mode: e.target.value as 'scheduled' | 'manual' } })}
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
                    onUpdate({
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
                    onUpdate({
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
                    onUpdate({
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
                onChange={(v) => onUpdate({ ...policies, processing: { ...policies.processing, autoCollect: v } })}
              />
              <Toggle
                label="Auto-analyze"
                checked={policies.processing.autoAnalyze}
                onChange={(v) => onUpdate({ ...policies, processing: { ...policies.processing, autoAnalyze: v } })}
              />
              <Toggle label="Require approval (pilot locked)" checked={policies.processing.requireApproval} onChange={() => {}} locked />
              <Toggle
                label="Auto-apply after approval"
                checked={policies.processing.autoApplyAfterApproval}
                onChange={(v) => onUpdate({ ...policies, processing: { ...policies.processing, autoApplyAfterApproval: v } })}
              />
            </div>
          </div>

          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="font-semibold mb-3">Аудит</div>
            <div className="flex flex-wrap gap-4 items-end">
              <Toggle
                label="Audit enabled"
                checked={policies.audit.enabled}
                onChange={(v) => onUpdate({ ...policies, audit: { ...policies.audit, enabled: v } })}
              />
              <Field label="Retain raw (days)">
                <input
                  type="number"
                  className="input w-32"
                  value={policies.audit.retainRawDays}
                  onChange={(e) => onUpdate({ ...policies, audit: { ...policies.audit, retainRawDays: Number(e.target.value || 365) } })}
                  min={30}
                  max={3650}
                />
              </Field>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="btn btn-primary">
              Сохранить
            </button>
            <button onClick={onRefresh} className="btn btn-secondary">
              Отменить (перезагрузить)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
