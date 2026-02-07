# Railway: seed и логин

Краткий runbook для seed в продовой БД Railway и диагностики логина.

## Чеклист перед логином (1–2 минуты)

### 1) Railway → papa-app → Variables

- `DATABASE_URL` **не должен** начинаться с `ppostgresql://` (лишняя `p`)
- Если `DATABASE_URL` — **reference** на Postgres — идеально
- `SEED_ADMIN_*` (если seed их читает):
  - `SEED_ADMIN_EMAIL=admin@company.com`
  - `SEED_ADMIN_PASSWORD=PapaApp2026_OK`
  - `SEED_ADMIN_FORCE_RESET=1` — **только на 1 прогон** (затем удалить)

### 2) Railway → papa-app → Deploy Logs (последний деплой)

В одном деплое должны быть:

- `prisma migrate deploy` → success
- `prisma db seed` (или seed-скрипт) → success
- старт приложения без Prisma-ошибок

Если seed тихо не запустился — логин будет 401.

### 3) Логин

- `admin@company.com` / `PapaApp2026_OK`

---

## Сразу после успешного входа (обязательно)

### 4) Убрать seed из preDeploy

Если seed был в `preDeployCommand` — оставить только миграции:

```json
"preDeployCommand": ["npm", "run", "db:migrate:prod"]
```

### 5) Выключить/удалить force reset

В Railway Variables:

- удалить `SEED_ADMIN_FORCE_RESET` **или** поставить `0`

Защита от: пересоздания админа на каждом деплое, неожиданной смены пароля.

---

## Если всё ещё 401

Тогда это уже не seed, а одна из причин:

- email/пароль в базе не совпадает (сид не отработал или отработал не теми значениями)
- `NEXTAUTH_SECRET` сменился
- логика авторизации проверяет другой `role/status` (например, `isActive=true`)

**Быстрый контроль:** Railway → HTTP Logs → найти `POST /api/auth/callback/credentials` и посмотреть app-логи рядом (User not found, Invalid password, Inactive).

---

## Финальный контроль (обязательные 3 пункта)

1. **Railway → Deploy Logs (последний успешный деплой с seed)**
   - `prisma migrate deploy` ✅
   - `prisma db seed` / seed-скрипт ✅
   - Если seed был — логин обязан работать (при корректной логике auth).

2. **Railway → Variables**
   - `DATABASE_URL` корректный (`postgresql://` / reference на Postgres) ✅
   - `SEED_ADMIN_FORCE_RESET` → **удалить или 0** ✅
   - (опционально) `SEED_ADMIN_PASSWORD` можно убрать, если больше не нужен.

3. **Git / Railway**
   - Seed убран из `railway.json` → следующий `git push` задеплоит версию **без seed** ✅

---

## Что считаем «готово»

- Логин проходит с `admin@company.com` / `PapaApp2026_OK`
- Новый деплой **не** запускает seed
- `SEED_ADMIN_FORCE_RESET` выключен/удалён
- В Deploy Logs нет красных Prisma-ошибок

---

## Если после отключения seed снова 401

Тогда это уже не инфраструктура, а прикладное:

- пользователь не найден / не ADMIN / не активирован
- пароль хешируется иначе, чем ожидает NextAuth (bcrypt vs argon2, salt rounds, etc.)
- seed писал в другую БД (не тот `DATABASE_URL`)

**Быстрый диагноз:** HTTP Logs → `POST /api/auth/callback/credentials` (401) и рядом App Logs — обычно есть причина текстом.

---

## Вариант: локальный seed в Railway prod (одна БД)

Если хочешь запускать seed **локально** против **той же** Railway prod БД:

1. Скопируй `DATABASE_URL` из Railway Variables в `.env`
2. Добавь в конец URL: `&sslaccept=accept_invalid_certs` (для локального TLS к Railway)
3. `npx prisma generate && npm run db:seed`

Пример (подставь свой хост/пароль):
```
DATABASE_URL="postgresql://postgres:PASSWORD@HOST.railway.app:5432/railway?sslmode=require&sslaccept=accept_invalid_certs"
```

> Railway ↔ Railway DB = доверенная сеть, TLS ок. Проблема только при подключении **локально** — сертификат может не проходить проверку.

**Альтернатива:** `npm run db:seed:supabase` (SEED_TLS_INSECURE=1) — если `sslaccept` не сработает.

---

## ⚠️ Критично: локальный seed ≠ Railway prod (разные БД)

Если локальный `.env` указывает на **другую** БД (dev, Supabase и т.п.) — seed не обновит Railway prod. 401 на `papa-app-production.up.railway.app` означает: данные в **Railway prod БД** не те.

Seed нужно выполнять **в Railway Shell** (или `railway run`), чтобы использовать prod `DATABASE_URL`.

### Проверка: одна ли база (без печати URL)

**В Railway Shell:**
```bash
node -e "console.log(require('crypto').createHash('sha256').update(process.env.DATABASE_URL||'').digest('hex').slice(0,12))"
```

**Локально:**
```bash
node -e "require('dotenv').config(); console.log(require('crypto').createHash('sha256').update(process.env.DATABASE_URL||'').digest('hex').slice(0,12))"
```

Хэши разные → разные базы. Seed в Railway обязателен.

---

## Seed в Railway

### Вариант 1. Railway Shell (самый надёжный)

Railway → **Service → Shell**:

**Создать admin (если нет):**
```bash
export SEED_ADMIN_EMAIL="admin@company.com"
export SEED_ADMIN_PASSWORD="PapaApp2026_OK"
npm run db:seed
```

**Сброс пароля (если admin есть, но логин 401):**
```bash
export SEED_ADMIN_EMAIL="admin@company.com"
export SEED_ADMIN_PASSWORD="PapaApp2026_OK"
export SEED_ADMIN_FORCE_RESET="1"
npm run db:seed
```

Ожидаемо: `Seeded admin: admin@company.com` или `Admin password reset: admin@company.com` или `Admin already exists: admin@company.com`.

**Проверка prod-БД сразу после seed:**
```bash
npx prisma db execute --stdin <<'SQL'
SELECT email FROM "User" ORDER BY email;
SQL
```
Ожидаемо: `admin@company.com`.

> Если `db:seed` падает с TLS-ошибкой — попробуй `npm run db:seed:supabase`.

### Вариант 2. Railway CLI

```bash
railway run npm run db:seed
```

(переменные в Railway Variables) или с явными env и force reset:

```bash
railway run --env SEED_ADMIN_EMAIL=admin@company.com --env SEED_ADMIN_PASSWORD=PapaApp2026_OK --env SEED_ADMIN_FORCE_RESET=1 npm run db:seed
```

## Проверка после seed

### Prisma Studio

```bash
railway run npx prisma studio
```

### SQL (обязательная проверка)

```sql
SELECT email FROM "User";
```

Ожидаемо: `admin@company.com`. Если его нет — логин не заработает.

Детальнее:

```sql
SELECT email, "passwordHash" IS NOT NULL
FROM "User"
WHERE email = 'admin@company.com';
```

Ожидаемо: `admin@company.com | true`.

## Логин: 401 «Неверный логин или пароль»

Если `POST /api/auth/callback/credentials` → **401** и UI показывает «Неверный логин или пароль»:

- NextAuth работает корректно
- CSRF и cookies в порядке
- **Причина:** `authorize()` вернул `null` — пользователь не найден или пароль не совпадает

| Возможная причина | Статус |
|-------------------|--------|
| NEXTAUTH_URL      | ❌ нет (была бы redirect/cookie ошибка) |
| CSRF              | ❌ нет (200 OK) |
| Prisma / DB       | ❌ нет (иначе 500) |
| TLS               | ❌ нет (иначе 500) |
| Cookies           | ❌ нет (401 до сессии) |
| **Данные prod-БД**| ✅ **единственная причина** |

### Решение

1. Выполнить seed в Railway (см. выше)
2. Убедиться, что `SEED_ADMIN_EMAIL` и `SEED_ADMIN_PASSWORD` в Railway Variables совпадают с тем, что вводите в форму
3. Повторить логин

**Если seed говорит "Admin already exists", но логин не работает** — пароль в БД другой. Используйте `SEED_ADMIN_FORCE_RESET=1` в Railway Shell (см. выше).

После успешного seed:

- `/api/auth/callback/credentials` → **302**
- Редирект на `/`
- Cookie `next-auth.session-token` установлена

### Если seed в Railway выполнен, но 401 остаётся

Тогда это уже не «не та БД», а конкретно:

* пользователь найден / не найден в prod
* bcrypt compare даёт false
* или `authorize()` смотрит не в то поле / таблицу

В `lib/auth-options.ts` уже добавлен диагностический лог (только при 401). Смотреть **Railway logs** — будет `[auth]` с `userFound`, `hashPrefix`, `compareResult`. После фикса — удалить лог.

---

## Полная диагностика 401 (по шагам)

### Этап 1. Та ли БД?

Сравни **хост** в `DATABASE_URL`:

* **Локально:** `.env` — домен в URL (`….railway.app` или `db.….supabase.co`)
* **Railway:** Service `papa-app` → Variables → `DATABASE_URL` — тот же домен?

Хосты совпадают → seed менял **ту же БД**, что прод.

### Этап 2. Прод подключается к БД?

Railway → `papa-app` → **Logs** → поиск:

* `P1001`
* `DatabaseNotReachable`
* `PrismaClientInitializationError`

Должно быть **чисто**. Если есть — сначала лечить подключение (URL, TLS, переменные).

**P1001 / DatabaseNotReachable** — приложение не может подключиться к Postgres. В `lib/prisma.ts` для Railway (railway.app, rlwy.net, railway.internal) добавлен `ssl: { rejectUnauthorized: false }`. Проверьте: `DATABASE_URL` — reference на Postgres; Postgres и papa-app в одном проекте; при необходимости — redeploy.

### Этап 3. Правильный пароль

Логин тем паролем, который **реально поставил seed**:

* из env: `SEED_ADMIN_PASSWORD` (по умолчанию `PapaApp2026_OK`)
* или из вывода `npm run db:seed` / `db:seed:supabase`

Форма: `admin@company.com` + этот пароль.

### Этап 4. Если 401 остаётся — три варианта

| Вариант | Признак | Решение |
|---------|---------|---------|
| **A) Разные БД** | Хосты в локальном и Railway URL не совпадают | Seed в Railway Shell или `railway run` |
| **B) Не тот user/hash** | В логах `[auth]` видно `userFound: false` или `compareResult: false` | Force reset в Railway, проверить bcrypt |
| **C) БД недоступна** | P1001 / DatabaseNotReachable в логах | Проверить `DATABASE_URL`, TLS, сеть |

### Этап 5. sslaccept — только локально

* **Локально:** `&sslaccept=accept_invalid_certs` в URL — ок для seed.
* **В Railway Variables:** оставить `DATABASE_URL` **без** sslaccept — как выдаёт платформа.

---

## Быстрая проверка

1. Сравнить **HOST** в локальном `.env` и Railway Variables.
2. Railway Logs — убедиться, что **нет P1001/DatabaseNotReachable**.
3. Логиниться паролем из seed (`PapaApp2026_OK` или тот, что в env).

Скрин Railway Variables (хост виден, пароль замазан) — достаточно для точной диагностики.

## Связанные документы

- [PROMPT_SEED_ADMIN_RAILWAY.md](./PROMPT_SEED_ADMIN_RAILWAY.md) — готовый промт для задачи / issue / разработчику
- [DB_SEED_TLS.md](./DB_SEED_TLS.md) — TLS для seed (Supabase / self-signed)
- [RAILWAY_DEPLOY.md](./RAILWAY_DEPLOY.md) — деплой и переменные
