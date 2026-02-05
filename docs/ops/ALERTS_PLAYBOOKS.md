# Alerts → Playbooks

Для каждого алерта: **владелец**, **SLA**, **первые 5 минут**, **эскалация**, **критерий восстановления**.

---

## P0/P1/P2 классификация

| Уровень | Описание |
|---------|----------|
| **P0** | Сервис недоступен, логин не работает для всех |
| **P1** | Деградация, миграции падают, DB errors |
| **P2** | Шум, подозрительная активность, единичные ошибки |

---

## Playbook: Healthcheck DOWN (P0)

**Сигнал:** Railway healthcheck fails / UptimeRobot down  
**Цель:** восстановить доступность ≤ 10–15 мин

1. Открыть Railway logs → найти первую ошибку после последнего deploy
2. Проверить DB connect errors (`DATABASE_URL`, SSL)
3. Если ошибка после свежего deploy → **Rollback** на предыдущий успешный
4. Проверить `/api/health` → 200
5. Пост-проверка: `/login`, `/audit`

**Восстановлено, когда:** 200 на health + login без loop

---

## Playbook: Deploy failed / preDeploy failed (P1)

**Сигнал:** Deploy failed, preDeployCommand failed

1. В логах найти причину: миграции (Prisma/pg), DB TLS/SSL
2. Проверить `DATABASE_URL` pooler + `sslmode=require`
3. При drift и падении из-за индекса: применить `docs/ops/audit_keyset_index_standalone.sql`
4. Redeploy

**Не делать:** держать `NODE_TLS_REJECT_UNAUTHORIZED=0` постоянно

---

## Playbook: Auth errors spike / 500 на `/api/auth/*` (P0/P1)

**Чаще всего:** `NEXTAUTH_URL` / `NEXTAUTH_SECRET`

1. Проверить изменения variables за последние 30–60 мин
2. Убедиться: `NEXTAUTH_URL` точно equals origin (https, без `/`), `NEXTAUTH_SECRET` не менялся
3. Если менялся `NEXTAUTH_URL` → вернуть прошлый рабочий → Redeploy
4. Браузер: проверить cookies `Secure`

**Восстановлено, когда:** login/logout без loop + auth endpoints 200/302

---

## Playbook: `security.last_admin_blocked` (P2 → P1 если повторяется)

1. Найти событие по `requestId` → кто пытался, какой userId
2. Проверить текущий список админов (должно быть ≥ 2 по политике)
3. Если легитимно: сначала назначить второго admin, затем повторить демоут/удаление
4. Если подозрительно: временно заморозить доступ актору, включить строгие алерты

---

## Playbook: Retention cron missed (P2)

1. Проверить, запускался ли cron
2. Запустить `npm run audit:prune:dry`
3. Затем `npm run audit:prune`
4. Проверить `ops.audit_prune` в AuditEvent или логи
