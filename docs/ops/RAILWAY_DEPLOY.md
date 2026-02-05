# Railway: деплой backend (рекомендуемый путь)

После настройки Supabase — деплой Next.js на Railway. App Router, NextAuth JWT (credentials), Prisma + Postgres. **Один сервис** (Next.js).

Конфиг в коде: `railway.json` — build/start/preDeploy заданы явно.

---

## 1. Подготовка (локально)

```bash
# Supabase: DATABASE_URL в .env (Session Pooler + ?sslmode=require)
npm run preflight:prod
```

---

## 2. Создать проект на Railway

1. [railway.app](https://railway.app) → **New Project**
2. **Deploy from GitHub** — подключить репозиторий, ветка `main`
3. Railway подхватит `railway.json` (build/start/preDeploy)

---

## 3. Переменные окружения

**Variables** в Railway (Settings → Variables):

| Переменная | Значение | Обязательно |
|------------|----------|-------------|
| `DATABASE_URL` | из Supabase (Session Pooler, с `?sslmode=require`) | да |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` | да |
| `NEXTAUTH_URL` | `https://<railway-url>` (после первого деплоя) | да |
| `NODE_ENV` | `production` | да |
| `WORKSPACE_ROOT` | `/tmp` (для файловых операций; если не задан — `./data`) | опционально |

**NODE_TLS_REJECT_UNAUTHORIZED:** только если Supabase даёт SSL-ошибку. Не держать постоянно — лучше настроить корректный сертификат.

**Важно:** `NEXTAUTH_URL` должен точно совпадать с origin (https, без trailing slash). Неправильный URL = redirect loop.

---

## 4. railway.json (Config as Code)

В корне проекта:

```json
{
  "build": { "buildCommand": "npm run build" },
  "deploy": {
    "startCommand": "npm run start",
    "healthcheckPath": "/api/health",
    "preDeployCommand": ["npm run db:migrate:prod"]
  }
}
```

- **preDeployCommand** — миграции перед каждым деплоем (не в Build, чтобы сборка не зависела от DB).
- Чтобы отключить автозапуск миграций — удали `preDeployCommand` и запускай `npm run db:migrate:prod` вручную перед push.

---

## 5. Деплой

Push в `main` → Railway соберёт и задеплоит.

**После первого деплоя (критично):**
1. Скопируй URL (Settings → Domains), например `https://papa-app-production-xxxx.up.railway.app`
2. Поставь `NEXTAUTH_URL=https://<этот-url>` в Variables
3. Redeploy (Deployments → ⋮ → Redeploy, или push в main)

---

## 6. Чек после деплоя

| Проверка | Команда/действие |
|----------|-------------------|
| Health | `curl https://<your-app>.railway.app/api/health` |
| Login | открыть `/login`, войти |
| Logout | выйти, проверить redirect |
| /audit | только admin/auditor (403 для user) |
| /admin | только admin (403 для user) |
| AuditEvent | после логина — запись `auth.sign_in` в `/audit` |

---

## 7. NextAuth cookies (Railway)

При `NEXTAUTH_URL` с `https://`:
- `secure: true`
- `sameSite: lax`
- имя: `__Secure-next-auth.session-token`

Проверка: после логина в DevTools → Application → Cookies — cookie должна быть `Secure`, `SameSite=Lax`.

---

## 8. Кастомный домен

**Settings → Domains → Custom Domain** — добавить `app.yourdomain.com`.

Обновить `NEXTAUTH_URL` на `https://app.yourdomain.com` → Redeploy.

---

## 9. Миграции

**Рекомендовано:** `preDeployCommand` в `railway.json` — миграции запускаются перед каждым деплоем (после build, до start). Сборка не зависит от DB.

**Альтернатива (ручной запуск):** удали `preDeployCommand` из railway.json и перед go-live:
```bash
npm run preflight:prod   # включает db:migrate:prod
git push
```

---

## 10. Ingestion-воркер (опционально)

1. **New Service** в том же проекте
2. **Deploy from same repo**
3. **Start Command:** `npm run agent:ingest:worker`
4. **Build Command:** `npm install`
5. Те же **Variables** (`DATABASE_URL`, `NEXTAUTH_SECRET` и т.д.)

---

## Troubleshooting

| Проблема | Решение |
|----------|---------|
| 500 на /api/auth/* | Проверить `NEXTAUTH_SECRET`, `NEXTAUTH_URL` |
| Redirect loop | `NEXTAUTH_URL` = точный URL (https, без trailing slash) |
| SSL cert (Supabase) | `NODE_TLS_REJECT_UNAUTHORIZED=0` — только при необходимости |
| PORT | Railway задаёт автоматически; `start` использует `$PORT` |
| preDeploy failed | Проверить `DATABASE_URL`, при Supabase — SSL-переменную |

## Типовые грабли NextAuth

1. **NEXTAUTH_URL** — `https://` и совпадает с реальным origin.
2. **Cookies** — при https включаются `secure` и `sameSite: lax` автоматически.
3. После первого деплоя — сразу обновить `NEXTAUTH_URL` и redeploy.
