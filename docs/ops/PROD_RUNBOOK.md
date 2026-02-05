# Prod Runbook: деплой, smoke, откат, cron

**Стек:** Next.js (App Router) · NextAuth (JWT) · Prisma 7 · Supabase Postgres (Session Pooler)  
**Деплой:** Railway · один сервис · `railway.json`

> **Один источник истины:** этот runbook — точка входа. Audit, alerts, infra, чеклисты — в отдельных документах (см. раздел «Один источник истины»).  
> Подробный Railway-гайд: [RAILWAY_DEPLOY.md](RAILWAY_DEPLOY.md)

---

## 0) Preflight (обязательно)

Локально перед любым прод-деплоем:

```bash
npm run preflight:prod
```

Ожидаемо: всё зелёное.

---

## 1) Создать проект на Railway

1. railway.app → **New Project**
2. **Deploy from GitHub** → repo + ветка `main`
3. Railway читает `railway.json`:
   * build: `npm run build`
   * preDeploy: `npm run db:migrate:prod`
   * start: `npm run start`
   * healthcheck: `/api/health`

> `start` должен слушать `$PORT` → `next start -p ${PORT:-3000}`

---

## 2) Variables (до первого деплоя)

Railway → Settings → Variables

**Обязательные**

* `DATABASE_URL` = Supabase **Session Pooler** + `?sslmode=require`
* `NEXTAUTH_SECRET` = `openssl rand -base64 32`
* `NODE_ENV=production`

**Не ставить**

* `NEXTAUTH_URL` (только после 1-го успешного деплоя)

**Временно при SSL-ошибке Supabase**

* `NODE_TLS_REJECT_UNAUTHORIZED=0` → убрать после стабилизации

---

## 3) Первый деплой → NEXTAUTH_URL → redeploy

1. Дождаться **успешного** деплоя
2. Взять URL: `https://<service>.up.railway.app`
3. Добавить: `NEXTAUTH_URL=https://<service>.up.railway.app` (**без** `/`)
4. **Redeploy**

⚠️ Неверный `NEXTAUTH_URL` = redirect-loop + битые cookies.

---

## 4) Post-deploy smoke

**Health**

```bash
curl -i https://<url>/api/health
# 200
```

**Auth**

* `/login` → login/logout без redirect-loop
* Cookies `Secure` (https)

**RBAC**

* `/admin` → только `admin`
* `/audit` → `admin` / `auditor`
* `user` → `/403`

**Audit**

* есть `auth.sign_in`
* «Ещё» (keyset) без дублей
* фильтры корректно сбрасывают курсор

---

## 5) Миграции / drift

Обычно:

```bash
npm run db:migrate:prod
# или
prisma migrate deploy && npm run db:pg:migrate
```

Если Prisma drift и нужен только индекс keyset:

```bash
psql "$DATABASE_URL" -f docs/ops/audit_keyset_index_standalone.sql
```

---

## 6) Кастомный домен

1. Railway → Domains → Custom Domain (например, `app.yourdomain.com`)
2. После DNS/HTTPS: `NEXTAUTH_URL=https://app.yourdomain.com` → **Redeploy**
3. Повторить smoke (Auth + RBAC + Health)

---

# 🔄 Быстрый откат

### A) Redirect-loop / auth сломан

1. Вернуть `NEXTAUTH_URL` на предыдущий рабочий origin
2. **Redeploy**

### B) 500 / healthcheck падает

1. Railway → Deployments → **Rollback** на прошлый успешный
2. Проверить `/api/health`

> Правило: миграции в проде — **backward-compatible**.

---

## ✅ Definition of Done

* `/api/health` → 200
* login/logout без redirect-loop
* RBAC работает (`/admin`, `/audit`)
* `auth.sign_in` пишется в AuditEvent
* `npm run preflight:prod` — зелёный

---

## ⏱ Через 24 часа

Рост `AuditEvent`, retention работает, нет всплесков auth/403, зафиксирован список admin.  
→ **Чеклист:** [CHECKLIST_FIRST_24H.md](CHECKLIST_FIRST_24H.md)

---

# 📋 План после go-live

**Сегодня:** мониторинг, audit sanity, cron.  
**Неделя:** observability, бэкапы + restore, админы.  
**Позже:** алерты, оптимизация, infra v2.

→ **Детали:** [CHECKLIST_FIRST_24H.md](CHECKLIST_FIRST_24H.md)

---

# 📚 Один источник истины (ссылки)

| Тема | Документ |
|------|----------|
| **Audit-аудит** (события, качество, таксономия) | [AUDIT_AUDIT.md](AUDIT_AUDIT.md) |
| **Alerts / Playbooks** | [ALERTS_TEMPLATE.md](ALERTS_TEMPLATE.md) · [ALERTS_PLAYBOOKS.md](ALERTS_PLAYBOOKS.md) |
| **Railway vs ECS** (когда переходить) | [INFRA_RAILWAY_VS_ECS.md](INFRA_RAILWAY_VS_ECS.md) |
| **Первые 24 часа** | [CHECKLIST_FIRST_24H.md](CHECKLIST_FIRST_24H.md) |
| **Stage 2 (ECS/RDS)** | [STAGE2_MIGRATION_PLAN.md](STAGE2_MIGRATION_PLAN.md) |

---

# ⚡ One-page Go-Live (5 минут)

Запускать **после** установки `NEXTAUTH_URL` (и кастомного домена, если есть).

1. **Health** — `curl -fsS https://<origin>/api/health >/dev/null && echo OK`
2. **Login / Logout** — `/login` → логин → логаут без redirect-loop; cookies `Secure`
3. **RBAC** — admin: `/admin` OK; auditor: `/admin` 403, `/audit` OK; user: `/audit` 403
4. **Audit** — после логина есть `auth.sign_in`; «Ещё» грузит без дублей
5. **DB sanity (опционально)** — `psql "$DATABASE_URL" -c 'select count(*) from "AuditEvent";'`

---

# 🕒 Cron: audit:prune

**Railway** — Settings → Cron (если доступен)

* Schedule: `0 3 * * *` (ежедневно 03:00)
* Command: `npm run audit:prune`

**Render** — Background Worker / Cron Job

* Schedule: `0 3 * * *`
* Command: `npm run audit:prune`

**Проверка перед включением**

```bash
npm run audit:prune:dry
```

---

# 📦 Render Deploy (Short)

* New → Web Service → GitHub repo → `main`
* Build: `npm ci && npm run build`
* Start: `npm run start`
* Env: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NODE_ENV=production`, `NEXTAUTH_URL` (после 1-го деплоя)
* Миграции: `npm run db:migrate:prod` вручную перед go-live или в Start Command обёртке
* Smoke — как для Railway

---

# ☁️ AWS ECS Fargate (Short)

* ECS Fargate + ALB (HTTPS)
* Build: `npm run build`; Start: `npm run start`
* Env: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NODE_ENV=production`
* Миграции: one-off ECS Task `npm run db:migrate:prod` перед rolling update
* Health: `/api/health`
* Rollback: previous task definition

---

# 🧩 Worker: agent:ingest:worker

Держать **отдельным сервисом**.

* Railway: New Service → Start: `npm run agent:ingest:worker`
* Variables: те же, что у web
* DoD: стартует без ошибок, пишет логи, не падает при перезапуске

---

# Бэкап и восстановление

**Бэкап**

```bash
./scripts/backup.sh                    # → backup-YYYYMMDD-HHMMSS.dump
./scripts/backup.sh my-backup.dump    # → my-backup.dump
```

**Восстановление**

```bash
./scripts/restore.sh backup.dump
```

**Dry-run восстановления**

1. Временная БД (отдельный Supabase или локальный Postgres)
2. `DATABASE_URL=... ./scripts/restore.sh backup.dump`
3. `npm run db:status` — миграции applied
4. `npm run smoke:nextauth-db`

---

# Переменные окружения (prod)

* `NODE_ENV=production`
* `DATABASE_URL` — Supabase/RDS
* `NEXTAUTH_SECRET` — уникальный
* `NEXTAUTH_URL` — https://your-domain (без trailing slash)
* **Не** `DEV_ADMIN=true`

---

# Обычная рутина (после стабилизации)

* **Еженедельно:** security events + список admin (policy: ≥2 admin)
* **Ежемесячно:** audit health (топ action'ов, всплески/дыры)
* **Ежеквартально:** пересмотр Railway vs ECS по метрикам/стоимости/инцидентам → [INFRA_RAILWAY_VS_ECS.md](INFRA_RAILWAY_VS_ECS.md)
