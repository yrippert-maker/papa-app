/**
 * Alert service — единый список предупреждений.
 * Агрегирует из safety, materials, regulatory, process, traceability.
 */

export type AlertCategory = 'SAFETY' | 'MATERIALS' | 'REGULATORY' | 'PROCESS' | 'TRACEABILITY' | 'GOVERNANCE';

export type AlertSeverity = 'info' | 'minor' | 'major' | 'critical';

export interface Alert {
  id: string;
  category: AlertCategory;
  severity: AlertSeverity;
  title: string;
  message: string;
  createdAt: string;
  action: {
    type: 'NAVIGATE';
    href: string;
    query?: Record<string, string>;
    focusId?: string;
  };
}

/**
 * Собирает alerts из различных источников.
 * Пока — mock + compliance inbox. Позже — safety, materials, process.
 */
export async function getAlerts(limit = 12): Promise<Alert[]> {
  const alerts: Alert[] = [];

  try {
    const { getAnchoringHealth } = await import('./anchoring-health-service');
    const health = getAnchoringHealth();
    if (health.status === 'FAILED') {
      alerts.push({
        id: `anchoring_failed_${health.lastConfirmedAt ?? 'none'}`,
        category: 'GOVERNANCE',
        severity: 'critical',
        title: 'Anchoring: FAILED',
        message: health.lastConfirmedAt
          ? `No confirmed anchor since ${health.lastConfirmedAt.replace('T', ' ').slice(0, 16)}Z`
          : 'No confirmed anchors found',
        createdAt: new Date().toISOString(),
        action: {
          type: 'NAVIGATE',
          href: '/governance/anchoring',
          query: { status: 'failed' },
        },
      });
    }
    // Опционально: alert при DELAYED (раскомментировать при необходимости)
    // if (health.status === 'DELAYED') {
    //   alerts.push({
    //     id: `anchoring_delayed_${health.lastConfirmedAt ?? 'none'}`,
    //     category: 'GOVERNANCE',
    //     severity: 'major',
    //     title: 'Anchoring: delayed',
    //     message: 'Last confirmed anchor is stale',
    //     createdAt: new Date().toISOString(),
    //     action: { type: 'NAVIGATE', href: '/governance/anchoring' },
    //   });
    // }
  } catch {
    // anchoring tables may not exist
  }

  try {
    const { listInbox } = await import('./compliance-inbox-service');
    const items = listInbox({ status: 'NEW', limit: 5 });
    for (const it of items.slice(0, 3)) {
      alerts.push({
        id: `reg-${it.id}`,
        category: 'REGULATORY',
        severity: (it.severity as AlertSeverity) ?? 'minor',
        title: it.source,
        message: it.title,
        createdAt: it.created_at,
        action: {
          type: 'NAVIGATE',
          href: '/documents/regulators',
          query: { status: 'new', focusId: it.id },
          focusId: it.id,
        },
      });
    }
  } catch {
    // ignore (tables may not exist)
  }

  // Mock: safety, materials (будет заменено реальными данными)
  alerts.push({
    id: 'safety-lifting-1',
    category: 'SAFETY',
    severity: 'minor',
    title: 'Подъёмные механизмы',
    message: '1 поверка истекает через 14 дней',
    createdAt: new Date().toISOString(),
    action: {
      type: 'NAVIGATE',
      href: '/safety/lifting',
      query: { status: 'due_soon' },
    },
  });
  alerts.push({
    id: 'safety-fire-1',
    category: 'SAFETY',
    severity: 'minor',
    title: 'Пожарная безопасность',
    message: '2 средства — поверка через 7 дней',
    createdAt: new Date().toISOString(),
    action: {
      type: 'NAVIGATE',
      href: '/safety/fire',
      query: { status: 'due_soon' },
    },
  });
  alerts.push({
    id: 'materials-1',
    category: 'MATERIALS',
    severity: 'minor',
    title: 'ЗИП',
    message: '4 позиции ниже минимального остатка',
    createdAt: new Date().toISOString(),
    action: {
      type: 'NAVIGATE',
      href: '/operations',
      query: { view: 'materials', filter: 'shortage' },
    },
  });

  return alerts.slice(0, limit);
}
