# DATABASE_URL для Docker Postgres

## Правильный URL

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/papa?schema=public"
```

**НЕ использовать:** `prisma+postgres://localhost:51213/...` (proxy, которого нет).

---

## Пошаговая настройка

### 1. Заменить DATABASE_URL в `.env`

```bash
# Вариант A: если DATABASE_URL уже есть
perl -i.bak -pe 's|^DATABASE_URL=.*$|DATABASE_URL="postgresql://postgres:postgres@localhost:5432/papa?schema=public"|' .env

# Вариант B: добавить, если нет
echo 'DATABASE_URL="postgresql://postgres:postgres@localhost:5432/papa?schema=public"' >> .env
```

Проверка:

```bash
grep -E "^DATABASE_URL=" .env
```

### 2. Запустить Postgres (если ещё не запущен)

```bash
docker compose up -d postgres
```

### 3. Проверить доступность БД

```bash
npx prisma db pull
```

### 4. Prisma: создать схему (User, Role и т.д.)

```bash
npx prisma migrate dev --name init
```

При запросе reset — соглашаться только если данных не жалко.

### 5. RBAC и вне-Prisma таблицы

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/papa?schema=public" npm run db:migrate
```

### 6. Seed первого админа (Prisma)

```bash
SEED_ADMIN_EMAIL=admin@company.com SEED_ADMIN_PASSWORD='secure-password' npx prisma db seed
```

### 7. Перезапустить приложение

```bash
npm run dev:quick
```

Логин: `admin@company.com` + пароль из seed (или `admin@local` если оставлен dev-admin в .env).

---

## Dev-admin vs Prisma

- **Без DATABASE_URL:** используется dev-admin (`AUTH_ADMIN_EMAIL` / `AUTH_ADMIN_PASSWORD`) + SQLite для RBAC.
- **С DATABASE_URL:** Prisma User + Postgres. Dev-admin всё ещё работает, если задан в .env (для локальной разработки).

---

## Docker: Node в контейнере

Если приложение (Node/Prisma) запускается **внутри контейнера**, `localhost` в `DATABASE_URL` неверен — Postgres в другом контейнере. Использовать имя сервиса из `docker-compose`:

```env
DATABASE_URL="postgresql://postgres:postgres@postgres:5432/papa?schema=public"
```

(где `postgres` — имя сервиса в `docker-compose.yml`)

---

## Контрольный чек (проверка после настройки)

```bash
# 1. URL прямой, не proxy
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
# Ожидаемо: postgresql://...@localhost:5432/papa...

# 2. Prisma миграции
npx prisma migrate status
# Ожидаемо: Database schema is up to date!

# 3. RBAC: ADMIN имеет SETTINGS.VIEW
psql "postgresql://postgres:postgres@localhost:5432/papa" -c "SELECT role_code, perm_code FROM rbac_role_permission WHERE role_code='ADMIN' AND perm_code='SETTINGS.VIEW';"
# Ожидаемо: 1 строка (ADMIN | SETTINGS.VIEW)
```

**Поиск остатков proxy-конфига** (не должно быть в коде):

```bash
rg "prisma\+postgres|5121[0-9]|DIRECT_URL|SHADOW_DATABASE_URL" --glob '!node_modules' --glob '!*.bak' .
```
