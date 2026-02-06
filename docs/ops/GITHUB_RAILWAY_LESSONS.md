# Отчёт: замечания при работе с GitHub и Railway (для перехода в облако)

Документ фиксирует проблемы, решения и рекомендации, выявленные при настройке CI/CD, npm workspaces и деплоя на Railway. Использовать как чек-лист при миграции в облако (Railway, ECS, Render и т.п.).

---

## 1. TypeScript / Next.js build: границы проектов

### Проблема

`next build` использует **корневой `tsconfig.json`**, а не `tsconfig.typecheck.json`. При `include: ["**/*.ts", "**/*.tsx", ...]` Next подхватывает **весь репозиторий**, включая `apps/auditor-portal/`.

- `tsconfig.typecheck.json` с `exclude: ["apps/auditor-portal/**"]` влияет только на `npm run typecheck` (tsc).
- `next build` читает `tsconfig.json` и парсит portal-код → падает на `'>' expected` и подобных ошибках (другой TS/JSX-контекст).

### Решение

В **корневой `tsconfig.json`** добавить в `exclude`:

```json
"exclude": [
  "node_modules",
  "electron/bundle",
  "00_SYSTEM",
  "data",
  "apps/auditor-portal/**",
  ...
]
```

### Проверка

- Root не должен импортировать ничего из `apps/auditor-portal` (иначе после exclude будет `Cannot find module`).
- `npm run check:root` должен проходить без упоминаний `apps/auditor-portal`.

### Рекомендация для облака

При добавлении новых `apps/*` или `packages/*` сразу добавлять их в `exclude` корневого `tsconfig.json`, если они не входят в Next-приложение.

---

## 2. npm workspaces: объявление и использование

### Проблема

Использование `-w auditor-portal` и `--workspaces` без объявленных workspaces в `package.json` приводит к ошибкам или игнорированию в разных окружениях.

### Решение

**1. Root `package.json`:**

```json
{
  "workspaces": ["apps/*"]
}
```

**2. `apps/auditor-portal/package.json`:**

```json
{
  "name": "auditor-portal"
}
```

**3. Проверка:**

```bash
npm -ws --silent run -s build
```

Не должно быть "No workspaces found".

### Рекомендации

- **Один `npm ci`** — только в корне; в workspace-пакетах отдельный `npm ci` не нужен.
- **check:portal:** `npm run build -w auditor-portal` (без `npm ci` в подпроекте).
- **check:all:** `npm run build --workspaces` после root lint/typecheck/build.
- У каждого `apps/*` должен быть скрипт `build`, иначе `--workspaces` может падать.

---

## 3. CI: PR vs Nightly

### Схема

| Триггер | Workflow | Команда |
|---------|----------|---------|
| PR / push main | `ci.yml` | `npm run check` |
| Nightly (08:30 MSK) / manual | `check-all.yml` | `npm run check:all` |

### Команды

- **check** = `check:root` + `check:portal` (lint, typecheck, build root + portal).
- **check:all** = root lint/typecheck/build + `npm run build --workspaces`.

### Рекомендации

- PR должен блокировать merge при падении `npm run check`.
- Nightly — расширенная проверка всех workspace-пакетов.
- Кэш: `actions/cache` для `.next/cache` и `cache: 'npm'` в setup-node.

---

## 4. Railway: Dockerfile vs Nixpacks

### Текущая конфигурация

- **railway.json:** `"build": { "builder": "DOCKERFILE", "dockerfilePath": "Dockerfile" }`
- **Dockerfile:** multi-stage, build stage выполняет `npm run check:root`.
- **nixpacks.toml:** запасной вариант, `npm run build` (без check:root).

### Несоответствия

| Параметр | Dockerfile | nixpacks.toml | package.json engines |
|----------|------------|---------------|----------------------|
| Node | 22.12-alpine | 20 (nixpkgs) | >=22.12.0 |
| Install | npm ci | npm install | — |
| Build | check:root | npm run build | — |

### Рекомендации

1. **По умолчанию:** Builder = Dockerfile (избегает проблем Nixpacks/fetchTarball).
2. **При ошибках Nixpacks:** Railway → Settings → Build → Builder = Dockerfile → Redeploy.
3. **Синхронизация Node:** привести nixpacks и CI к Node 22.x, если engines требует >=22.12.0.
4. **railway.json:** при использовании Nixpacks добавить `deploy` (startCommand, healthcheckPath, preDeployCommand), если нужны миграции до старта.

---

## 5. Dockerfile: переменные и этапы

### Обязательные ARG/ENV для build

- `WORKSPACE_ROOT` (по умолчанию `/tmp/build`)
- `NEXTAUTH_SECRET` (placeholder для build)
- `RAILWAY_GIT_COMMIT_SHA` → `GIT_SHA` (для логов)

### Этапы

1. **deps:** `npm ci --include=dev`, `prisma generate`
2. **build:** `npm run check:root` (lint + typecheck + next build)
3. **run:** standalone output, non-root user, `node server.js`

### Проверка build context

Перед `check:root`:

```dockerfile
RUN test -f lib/system/health/s3-health.ts && test -f lib/db.ts && test -f lib/docs-agent-db.ts || (echo "Build context: critical files missing"; exit 1)
```

### .dockerignore

Не исключать `lib/**`, `app/**`, `prisma/**`. Текущий `.dockerignore` не трогает их — корректно.

---

## 6. Railway Variables (обязательные)

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | Postgres (Supabase/RDS) с `?sslmode=require` |
| `NEXTAUTH_SECRET` | `openssl rand -base64 32` |
| `NODE_ENV` | `production` |
| `NEXTAUTH_URL` | URL приложения (https, без trailing slash) — задать после первого деплоя |

### Опциональные

- `AUTH_TRUST_HOST=true` — при ошибках NextAuth по host/URL
- `WORKSPACE_ROOT` — путь для файловых операций (если нужен)

---

## 7. Типичные ошибки и решения

### A) Type error при `next build`

- **Причина:** строгая проверка TS в Next.
- **Действие:** `rm -rf .next && npm run build` локально, исправить ошибки.
- **Часто:** `db.prepare(sql).then(...)` — SQLite sync API, нет `.then`; использовать `stmt.run/get/all` или async/await.

### B) Module not found (`@/...`)

- Проверить commit hash в Railway.
- Проверить `.dockerignore` — не исключает ли `lib/**`, `**/*.ts`.
- Проверить `COPY . .` в Dockerfile.
- Очистить build cache (Redeploy without cache).

### C) 500 на `/api/auth/*`, redirect-loop

- `NEXTAUTH_SECRET` задан и не менялся.
- `NEXTAUTH_URL` точно совпадает с origin (https, без trailing slash).
- После изменения `NEXTAUTH_URL` — Redeploy.

### D) preDeployCommand failed

- Проверить `DATABASE_URL`, доступ к БД.
- Смотреть логи миграции (`db:migrate:prod`).

### E) Nixpacks: fetchTarball / nix-env failed

- Railway → Settings → Build → Builder = **Dockerfile** → Redeploy.
- Либо Clear build cache + Redeploy.

### F) 500 на /api/auth/session, stacktrace из bcrypt/node-gyp-build (Alpine/musl + Node 22)

**Причина:** нативный `bcrypt` не загружает бинарные биндинги в Alpine (musl). Любой импорт bcrypt → падение → вместо JSON сервер отдаёт HTML ошибки → клиент: "Unexpected token '<'".

**Типичный фрагмент логов (Railway Deploy Logs / Runtime Logs):**

```
GET /api/auth/session 500 in 123ms
Error: ...
    at Object.<anonymous> (/app/node_modules/bcrypt/bcrypt.js:6:...)
    at Module.load (node:internal/modules/cjs/loader:...)
    at Function.Module._load (node:internal/modules/cjs/loader.js:...)
    ...
    at loadBinding (node:internal/bootstrap/loaders.js:...)
Error: The module '/app/node_modules/bcrypt/lib/binding/napi-v3/bcrypt_lib.node'
was compiled against a different Node.js version using
NODE_MODULE_VERSION 127. This version of Node.js requires
NODE_MODULE_VERSION 132. Please try re-compiling or re-installing...
```

Или короче: `c=musl node=22.12.0`, `loaded from: /app/node_modules/bcrypt`, стек из `node-gyp-build` / `bcrypt.js`.

**Как подтвердить:** Railway → Logs → фильтр по `api/auth`, `bcrypt`, `Error:` — на каждый GET /api/auth/session повторяется падение.

**Решение:** заменить `bcrypt` на `bcryptjs` (чистый JS, без node-gyp):

- `lib/auth-options.ts` — `compare` из bcryptjs
- `prisma/seed.ts` — `hash` из bcryptjs
- `npm remove bcrypt`, оставить только `bcryptjs`

---

## 8. Рассинхрон коммитов

Railway может собирать старый коммит, если:

- Push не завершился или не дошёл до origin.
- Railway подключён к другой ветке.
- Кэш билда устарел.

**Проверка:** Deployments → commit hash должен совпадать с последним push.

---

## 9. Чек-лист перед переходом в облако

- [ ] `tsconfig.json` исключает `apps/auditor-portal/**` и другие отдельные проекты
- [ ] `package.json` содержит `workspaces: ["apps/*"]`
- [ ] `npm -ws run build` проходит
- [ ] `npm run check` и `npm run check:all` проходят локально
- [ ] Dockerfile использует `check:root` (или `npm run build` при необходимости)
- [ ] `railway.json` указывает Builder = DOCKERFILE
- [ ] Версии Node согласованы (engines, Dockerfile, CI, nixpacks)
- [ ] `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` заданы в Railway
- [ ] `/api/health` возвращает 200 после деплоя
- [ ] Login/logout без redirect-loop
- [ ] Документация обновлена (RAILWAY_DEPLOY.md, ECS_FARGATE_DEPLOY.md)

---

## 10. ERR_CONNECTION_REFUSED на localhost:3001 (локальный dev)

**Симптом:** браузер показывает `ERR_CONNECTION_REFUSED` на `http://localhost:3001`.

**Причины (по убыванию вероятности):**

1. **Dev-сервер не запущен** — выполнить `npm run dev`.
2. **Сервер на другом порту** — смотреть вывод при старте (`Local: http://localhost:3001`).
3. **Процесс упал** — смотреть ошибки в терминале.
4. **Другой app в монорепе** — root Next → 3001, auditor-portal (Vite) → обычно 5173.

**Проверка:**

```bash
lsof -i :3001
# или
netstat -an | grep 3001
```

Пусто = сервер не слушает на 3001.

**Запуск с env (если нужен WORKSPACE_ROOT):**

```bash
WORKSPACE_ROOT=/tmp/papa-dev NEXTAUTH_SECRET=dev-secret npm run dev
```

**Примечание:** первый запрос к Next.js dev может долго компилироваться (1–2 мин на большом проекте). Если `lsof` показывает процесс на 3001, но curl таймаутит — подождать и повторить.

---

## 11. Ссылки на документацию

| Документ | Назначение |
|----------|-------------|
| `docs/ops/RAILWAY_DEPLOY.md` | Деплой на Railway |
| `docs/ops/ECS_FARGATE_DEPLOY.md` | Деплой на ECS/Fargate |
| `docs/ops/PROD_RUNBOOK.md` | Операционный runbook |
| `docs/ops/ALERTS_PLAYBOOKS.md` | Реакция на инциденты |
| `env.example` | Переменные окружения |
