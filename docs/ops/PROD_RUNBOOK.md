# Prod Runbook: миграции, бэкап, деплой

## Деплой backend

Рекомендуемый путь: **Railway** — см. `docs/ops/RAILWAY_DEPLOY.md`.

---

## Перед деплоем

1. **Миграции** (оба шага обязательны)
   ```bash
   npm run db:status          # проверить статус Prisma
   npm run db:migrate:prod    # Prisma + вне-Prisma (триггеры, users)
   ```
   Или по отдельности:
   ```bash
   prisma migrate deploy      # Prisma schema (User, Role, AuditEvent, …)
   npm run db:pg:migrate      # вне-Prisma: users, ledger_events, last-admin invariant
   ```
   Для Supabase (self-signed cert): `NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:pg:migrate`

2. **Проверка БД**
   ```bash
   npm run smoke:nextauth-db
   ```

3. **Smoke checks после миграции**
   ```bash
   npm run test
   npm run test:e2e:rbac
   npm run smoke:nextauth-db
   npm run smoke:last-admin-invariant
   ```

4. **Pre-flight перед сменой домена** (все проверки одной командой)
   ```bash
   npm run preflight:prod
   ```
   Запускает: db:status, db:migrate:prod, audit:prune:dry, smoke:nextauth-db, smoke:last-admin-invariant

## Бэкап (ручной)

```bash
./scripts/backup.sh                    # → backup-YYYYMMDD-HHMMSS.dump
./scripts/backup.sh my-backup.dump    # → my-backup.dump
```

Требует: `DATABASE_URL` в `.env` или `export`.

## Восстановление

```bash
./scripts/restore.sh backup.dump
```

**Внимание:** `--clean` удаляет объекты перед восстановлением.

### Проверка восстановления (dry-run)

1. Поднять временную БД (отдельный Supabase проект или локальный Postgres)
2. `DATABASE_URL=... ./scripts/restore.sh backup.dump`
3. `npm run db:status` — миграции должны быть applied
4. `npm run smoke:nextauth-db` — проверка таблиц

### Верификация last-admin invariant (Postgres)

После `db:pg:migrate`:

```bash
export DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' .env | tr -d '"')
psql "$DATABASE_URL" -c "\df check_last_admin"
psql "$DATABASE_URL" -c "SELECT tgname FROM pg_trigger WHERE tgrelid = 'users'::regclass;"
```

Smoke-тест: попытаться снять admin у последнего админа или удалить его — триггер должен выбросить исключение.

## После деплоя

1. Health: `curl https://your-app/api/health`
2. Login: проверить вход
3. Admin: `/admin` (только admin)
4. Audit: `/audit` или `/compliance/snapshots` (admin/auditor)

## Audit retention

По умолчанию хранить 180 дней. Nightly cron:

```bash
npm run audit:prune        # удалить старше 180 дней
npm run audit:prune:dry    # dry-run
```

Или с кастомным периодом: `node scripts/audit-prune.mjs --days 90`.

## Переменные окружения (prod)

- `NODE_ENV=production`
- `DATABASE_URL` — из Supabase/RDS
- `NEXTAUTH_SECRET` — уникальный
- `NEXTAUTH_URL` — https://your-domain
- **Не** `DEV_ADMIN=true` (dev-admin отключён в prod)
