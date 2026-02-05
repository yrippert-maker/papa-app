# Чеклист: первые 24 часа после go-live

Запускать **ежедневно** в первые 72 часа. Отмечать галочками.

---

## День 1 (0–24 ч)

### Health & Availability

- [ ] `curl -fsS https://<origin>/api/health` → 200
- [ ] Нет всплесков 500 в логах
- [ ] Login/logout без redirect-loop
- [ ] Cookies `Secure` (https)

### Audit

- [ ] `AuditEvent` растёт: `psql "$DATABASE_URL" -c 'select count(*) from "AuditEvent";'`
- [ ] Есть `auth.sign_in` после логина
- [ ] Есть admin CRUD (если были действия)
- [ ] Pagination «Ещё» на `/audit` без дублей

### Retention & Cron

- [ ] Запущен **один реальный** `audit:prune` (не dry)
- [ ] Cron настроен (Railway/Render) — проверить через 24 ч

### Логи (минимум)

- [ ] NextAuth errors — нет неожиданных
- [ ] DB connection errors — нет
- [ ] preDeploy / миграции — успешны

---

## День 2 (24–48 ч)

- [ ] Health стабилен
- [ ] Audit продолжает расти
- [ ] Cron сработал (проверить лог)
- [ ] Нет всплесков 401/403 (кроме ожидаемых)

---

## День 3 (48–72 ч)

- [ ] Всё как в День 2
- [ ] Зафиксирован список admin-пользователей
- [ ] Backup создан и проверен: `./scripts/backup.sh`

---

## P1 — немедленно при обнаружении

| Симптом | Действие |
|---------|----------|
| Audit пустой или с пропусками | Расследовать, логировать, фиксировать |
| 500 на `/api/health` | Rollback, проверить миграции |
| Redirect-loop на login | Проверить `NEXTAUTH_URL`, Redeploy |
| DB connection errors | Проверить `DATABASE_URL`, Supabase status |

---

## Контакты / ссылки

* Runbook: `docs/ops/PROD_RUNBOOK.md`
* Railway: [dashboard](https://railway.app)
* Supabase: [dashboard](https://supabase.com/dashboard)
