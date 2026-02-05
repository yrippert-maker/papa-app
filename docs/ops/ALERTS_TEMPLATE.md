# Шаблон алертов (Railway, Sentry, внешние)

Минимальный набор алертов для production.

---

## Alert → Owner → Severity → Playbook

| Alert | Owner | Severity | Playbook |
|-------|-------|----------|----------|
| Healthcheck DOWN | Ops | P0 | [ALERTS_PLAYBOOKS.md#healthcheck-down](ALERTS_PLAYBOOKS.md#playbook-healthcheck-down-p0) |
| Deploy / preDeploy failed | Ops | P1 | [ALERTS_PLAYBOOKS.md#deploy-failed](ALERTS_PLAYBOOKS.md#playbook-deploy-failed--predeploy-failed-p1) |
| Auth errors spike / 500 на `/api/auth/*` | Ops | P0/P1 | [ALERTS_PLAYBOOKS.md#auth-errors](ALERTS_PLAYBOOKS.md#playbook-auth-errors-spike--500-на-apiauth-p0p1) |
| `security.last_admin_blocked` | Security | P2 | [ALERTS_PLAYBOOKS.md#last-admin](ALERTS_PLAYBOOKS.md#playbook-securitylast_admin_blocked-p2--p1-если-повторяется) |
| Retention cron missed | Ops | P2 | [ALERTS_PLAYBOOKS.md#retention-cron](ALERTS_PLAYBOOKS.md#playbook-retention-cron-missed-p2) |

> Детальные playbooks: `docs/ops/ALERTS_PLAYBOOKS.md`

---

## 1. Railway (встроенные)

### Healthcheck failed

* **Условие:** Health check `/api/health` не 200
* **Действие:** Railway автоматически перезапускает; настроить уведомления в Project Settings → Notifications
* **Канал:** Email, Slack (если подключён)

### Deploy failed

* **Условие:** Build или preDeploy упал
* **Действие:** Уведомление в Deployments
* **Проверить:** логи миграции, `DATABASE_URL`, `NODE_TLS_REJECT_UNAUTHORIZED` при SSL

---

## 2. Sentry (если подключён)

### 5xx rate

```javascript
// В Sentry: Alerts → Create Alert
// Условие: event.type:error AND transaction:/api/health
// Threshold: > 5 за 5 минут
```

### Auth errors spike

```javascript
// Условие: message содержит "NextAuth" | "credentials" | "session"
// Threshold: > 10 за 10 минут
```

### Security event

```javascript
// Условие: tags.security_event = true
// Threshold: любой — сразу alert
```

---

## 3. Внешний мониторинг (UptimeRobot, Better Uptime, etc.)

### Health endpoint

* **URL:** `https://<origin>/api/health`
* **Interval:** 5 мин
* **Expected:** 200
* **Alert:** Email/SMS при 3+ последовательных fail

---

## 4. Логи (ручной просмотр)

### Что смотреть в Railway Logs

| Паттерн | Значение |
|---------|----------|
| `[admin/users PATCH]` + `Cannot remove last admin` | Security: попытка снять последнего admin |
| `NextAuth` + `error` | Проблемы auth |
| `ECONNREFUSED` / `Connection refused` | DB недоступна |
| `self-signed certificate` | SSL Supabase (временно `NODE_TLS_REJECT_UNAUTHORIZED=0`) |

---

## 5. Минимальный набор (TL;DR)

| Приоритет | Алерт | Инструмент |
|-----------|-------|------------|
| P0 | `/api/health` ≠ 200 | UptimeRobot / Railway |
| P0 | Deploy failed | Railway |
| P1 | 5xx spike | Sentry (если есть) |
| P1 | Auth errors | Sentry / логи |
| P2 | `security.last_admin_blocked` | Логи / AuditEvent |

---

## 6. Пример: Sentry init (опционально)

```typescript
// app/sentry.ts или instrumentation.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event, hint) {
    const msg = (hint?.originalException as Error)?.message ?? "";
    if (msg.includes("Cannot remove last admin")) {
      event.tags = { ...event.tags, security_event: "last_admin_blocked" };
    }
    return event;
  },
});
```
