# Railway: деплой backend и go-live (рекомендуемый путь)

Стек: **Next.js App Router**, **NextAuth (JWT, credentials)**, **Prisma 7**, **Supabase Postgres (Session Pooler)**.
Деплой: **Railway**, **один сервис (Next.js)**.
Конфиг в репозитории: `railway.json` (build/start/preDeploy/healthcheck).

## 0) Предусловия (локально)

### 0.1 Supabase: рабочий `DATABASE_URL`

В `.env` должен быть **Session Pooler** URL с SSL:

* host: `*.pooler.supabase.com`
* `?sslmode=require`

Проверка:

```bash
export DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' .env | tr -d '"')
psql "$DATABASE_URL" -c "select current_database(), current_user;"
```

### 0.2 Preflight

Перед любым прод-деплоем:

```bash
npm run preflight:prod
```

Ожидаемо: `db:status`, `db:migrate:prod`, `audit:prune:dry`, `smoke:nextauth-db`, `smoke:last-admin-invariant` — всё зелёное.

---

## 1) Создать проект на Railway и подключить репозиторий

1. railway.app → **New Project**
2. **Deploy from GitHub** → выбрать `yrippert-maker/papa-app` (ветка `main`)
3. Railway подхватит `railway.json`:

   * Build: `npm run build`
   * PreDeploy: `npm run db:migrate:prod`
   * Start: `npm run start`
   * Healthcheck: `/api/health`

> Примечание: `start` в `package.json` должен слушать `$PORT`, например:
> `next start -p ${PORT:-3000}`

---

## 2) Railway Variables (до первого деплоя)

Railway → Settings → Variables:

**Обязательные**

* `DATABASE_URL` — Supabase Session Pooler URL с `?sslmode=require`
* `NEXTAUTH_SECRET` — `openssl rand -base64 32`
* `NODE_ENV=production`

**Не ставить заранее**

* `NEXTAUTH_URL` — ставится после первого успешного деплоя (когда известен URL)
* `NODE_TLS_REJECT_UNAUTHORIZED=0` — только если есть TLS/SSL ошибка и только временно

**Опциональные**

* `WORKSPACE_ROOT` — путь для файловых операций (если нужен; иначе не задавать)
* `AUTH_TRUST_HOST=true` — для NextAuth/Auth.js на Railway (если ругается на host/URL)

---

## 3) Первый деплой → зафиксировать NEXTAUTH_URL → redeploy

### 3.1 Дождаться первого успешного деплоя

Railway → Deployments → последний успешный.

### 3.2 Взять публичный URL

Берём URL сервиса (Domains/Deployments), вида:
`https://<service>.up.railway.app`

### 3.3 Выставить `NEXTAUTH_URL` и redeploy

Variables:

* `NEXTAUTH_URL=https://<railway-url>` (https, **без trailing slash**)

После сохранения — **Redeploy** (Deployments → ⋮ → Redeploy).

**Почему это критично:** неправильный `NEXTAUTH_URL` = redirect-loop и битые cookies.

---

## 4) Post-deploy проверки (после redeploy)

### 4.1 Health

```bash
curl -i https://<railway-url>/api/health
```

Ожидаемо: `200`.

### 4.2 Auth (NextAuth)

* открыть `/login`
* login/logout без redirect-loop
* в DevTools → Application → Cookies убедиться, что cookie `Secure` (на https)

### 4.3 RBAC

* `/admin` — только admin
* `/audit` и `/compliance/snapshots` — admin/auditor
* user → `/403`

> ⚠️ Роли для админских операций изменяются **только через Admin API (`users.role_code`)**.
> Prisma `UserRole` используется **только для авторизации (NextAuth)**.

### 4.4 Audit

* после логина появляется `auth.sign_in`
* "Ещё" (keyset pagination) подгружает без дублей/пропусков
* фильтры сбрасывают курсор корректно

---

## 5) Миграции и порядок деплоя (Railway)

В `railway.json`:

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

* миграции выполняются **перед каждым деплоем**
* сборка не зависит от БД (миграции не в build)

**Операционное правило:** миграции должны быть **backward-compatible**, особенно если Railway будет масштабироваться на несколько инстансов.

---

## 6) Кастомный домен

Railway → Settings → Domains → **Custom Domain** → добавить, например `app.yourdomain.com`.

После того как DNS/HTTPS активировались:

1. Variables:

* `NEXTAUTH_URL=https://app.yourdomain.com`

2. **Redeploy**

3. Повторить auth-check:

* login/logout
* отсутствие redirect-loop
* cookies `Secure`

---

# Go-Live checklist (5–10 минут)

Запускать **перед объявлением пользователям** (после установки кастомного домена и redeploy).

## A) Preflight (ещё раз)

В идеале (локально или как Railway Run Command):

```bash
npm run preflight:prod
```

## B) Smoke в браузере (под прод-доменом)

1. `https://app.yourdomain.com/api/health` → 200
2. `/login` → login/logout без редирект-лупа
3. `/admin`:

* admin → OK
* auditor/user → `/403`

4. `/audit`:

* admin/auditor → OK
* user → `/403`

5. Audit:

* есть свежий `auth.sign_in`
* "Ещё" работает стабильно

## C) Минимальная проверка данных

(по желанию, если есть доступ к psql)

```bash
psql "$DATABASE_URL" -c "select count(*) from \"AuditEvent\";"
```

---

# Rollback plan (быстрый откат)

Цель: вернуть пользователей на рабочее состояние за минуты, даже если проблема в auth/cookies/redirect.

## Сценарий 1: проблема после смены домена (чаще всего NextAuth)

**Симптомы:** redirect-loop, 500 на `/api/auth/*`, логин не работает.

**Действия:**

1. В Railway Variables вернуть `NEXTAUTH_URL` обратно на предыдущий рабочий URL:

   * либо на Railway URL `https://<service>.up.railway.app`
   * либо на старый домен (если откатываете DNS)
2. Redeploy
3. Проверить login/logout

**Если проблема именно в домене/cookies:** самый быстрый откат — **DNS назад** + `NEXTAUTH_URL` назад.

## Сценарий 2: деплой сломал runtime (500/healthcheck падает)

1. Railway → Deployments → выбрать **предыдущий успешный** → **Rollback/Redeploy** на него
2. Проверить `/api/health`
3. Если миграции были применены и они breaking:

   * либо быстрый hotfix деплой,
   * либо отдельный план отката миграции (зависит от миграций; по умолчанию Prisma не делает auto-down)

> Поэтому правило: миграции в проде — backward-compatible.

## Сценарий 3: проблема с Supabase/TLS

**Симптомы:** ошибки подключения к БД в логах.

**Действия:**

1. Проверить корректность `DATABASE_URL` (pooler + `sslmode=require`)
2. Если TLS ошибка и нужно срочно:

   * временно выставить `NODE_TLS_REJECT_UNAUTHORIZED=0`
   * Redeploy
3. После стабилизации — убрать переменную (не держать постоянно)

---

# Troubleshooting (коротко)

## Build failures: как отличить причину

**Если в логах `Type error ...`** — это **НЕ** build context. Сначала чиним TypeScript (см. ниже).

**Если в логах `Module not found: Can't resolve '@/...'`** — тогда применяем чек-лист: commit hash в Railway, кэш, `.dockerignore`, Dockerfile `COPY`.

### Type error (например `Property 'then' does not exist on type 'DbPreparedStatement'`)

* `next build` всегда запускает строгий TS-чек; Railway падает, пока ошибка не исправлена.
* Локально воспроизвести: `rm -rf .next && npm run build`
* Найти место: `git grep -n "\.then(" -- '*.ts' '*.tsx'` или `git grep -n "prepare(" lib db app`
* Типичная ошибка: `db.prepare(sql).then(...)` — `DbPreparedStatement` синхронный, у него нет `.then`. Использовать `async/await` или `stmt.run/get/all` напрямую.

### Module not found

1. Убедиться, что Railway собирает нужный коммит (Deployments → commit hash).
2. Проверить `.dockerignore` — не исключает ли `lib/**` или `**/*.ts`.
3. Проверить Dockerfile — `COPY . .` должен копировать весь проект.
4. Очистить build cache (Redeploy without cache).

---

## A) 500 на `/api/auth/*`

Почти всегда:

* неверный `NEXTAUTH_SECRET` (не задан / изменился)
* неверный `NEXTAUTH_URL` (не совпадает с origin, нет https, trailing slash)

## B) Redirect-loop

* `NEXTAUTH_URL` должен **точно** совпадать с реальным origin (https, без trailing slash)
* после изменения `NEXTAUTH_URL` нужен **Redeploy**

## C) preDeployCommand failed

* проверь `DATABASE_URL`
* проверь права/доступ к Supabase
* смотри логи миграции (`db:migrate:prod`)

## D) Nixpacks / fetchTarball / nix-env failed

Если в логе видно `nix-env`, `fetchTarball`, `nixpkgs` — Railway использует Nixpacks.

**Решение:** Railway → Service → Settings → Build → **Builder = Dockerfile** → Redeploy. При наличии Dockerfile в репо Railway будет собирать через Docker, без Nix.

**Альтернатива:** Clear build cache + Redeploy (иногда помогает при сетевых ошибках fetchTarball).

## E) Переключение между Nixpacks и Dockerfile

Оба билдера настроены и должны проходить:

| Builder   | Start command   | Когда использовать                          |
|-----------|-----------------|---------------------------------------------|
| Dockerfile| `node server.js`| По умолчанию; обходит проблемы Nix/fetchTarball |
| Nixpacks  | `npm run start` | Запасной; при падении Docker — Clear cache + Nixpacks |

Переключение: Railway → Service → Settings → Build → **Builder** → выбрать Nixpacks или Dockerfile → Redeploy.

---

## Definition of Done

Go-live считается завершённым, если:

* `/api/health` стабильно возвращает 200
* login/logout работает без redirect-loop
* RBAC соблюдается (`/admin`, `/audit`)
* `auth.sign_in` фиксируется в AuditEvent
* `npm run preflight:prod` проходит без ошибок

---

## Через 24 часа после go-live

* проверить рост `AuditEvent`
* убедиться, что retention cron/скрипт запускается
* проверить логи на auth errors / 403 spikes
* зафиксировать текущих admin-пользователей

---

## Keyset index (если Prisma migrate имеет drift)

Если `prisma migrate deploy` падает из‑за drift, индекс для keyset pagination можно применить вручную:

```bash
psql "$DATABASE_URL" -f docs/ops/audit_keyset_index_standalone.sql
```

Скрипт использует `IF NOT EXISTS` — безопасен при повторном запуске.
