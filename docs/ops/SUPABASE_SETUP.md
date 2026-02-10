# Supabase: Postgres + pgvector для papa-app

Пошаговая настройка облачной БД для Stage 1 миграции.

## 1. Создать проект

1. [supabase.com](https://supabase.com) → **New Project**
2. Organization (или создать)
3. **Name:** `papa-app` (или любое)
4. **Database Password:** сохранить в надёжное место
5. **Region:** Frankfurt (eu-central-1) или ближайший
6. **Pricing:** Free tier достаточно для старта

## 2. Получить DATABASE_URL

**Settings → Database → Connection string**

### Для миграций (Direct, порт 5432)

```
postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres
```

### Для приложения (можно тот же Direct)

Использовать тот же URL. Добавить `?sslmode=require` если нужно:

```
postgresql://postgres.[project-ref]:[YOUR-PASSWORD]@db.[project-ref].supabase.co:5432/postgres?sslmode=require
```

Supabase по умолчанию принимает SSL. Если соединение падает — добавь `sslmode=require`.

**Важно:** `[project-ref]` — короткий ID проекта (например `abcdefghijklmnop`). Виден в URL дашборда: `https://supabase.com/dashboard/project/abcdefghijklmnop`.

### Pooler (если Direct не подключается)

В **Settings → Database → Connection string** выбери **Transaction** или **Session** (Pooler). Формат:

```
postgresql://postgres.[project-ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

Пример для eu-west-1: `aws-1-eu-west-1.pooler.supabase.com`. Пользователь — `postgres.[project-ref]`, не просто `postgres`.

### Запись DATABASE_URL в .env (macOS)

1. В корне проекта открой `.env`:
   ```bash
   nano .env
   ```

2. Найди строку `DATABASE_URL=...` и замени её на (подставь пароль и `[project-ref]` из дашборда):
   ```
   DATABASE_URL="postgresql://postgres:ВАШ_ПАРОЛЬ@db.[project-ref].supabase.co:5432/postgres?sslmode=require"
   ```

3. **Если в пароле есть `@`**, замени его на `%40`:
   ```
   DATABASE_URL="postgresql://postgres:МойПароль%40@db.[project-ref].supabase.co:5432/postgres?sslmode=require"
   ```

4. Сохранить в nano: `Ctrl+O` → Enter → `Ctrl+X`

5. Проверить:
   ```bash
   grep DATABASE_URL .env
   ```

## 3. Включить pgvector

Supabase включает pgvector по умолчанию. Проверка:

```sql
SELECT * FROM pg_extension WHERE extname = 'vector';
```

Если пусто — выполнить:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

(через SQL Editor в дашборде Supabase)

## 4. Прогнать миграции

```bash
# Из корня проекта
DATABASE_URL="postgresql://postgres.xxx:yyy@db.xxx.supabase.co:5432/postgres" npm run db:pg:migrate
```

Или через скрипт (читает из .env):

```bash
npm run cloud:setup
```

## 5. Prisma seed (роли + admin)

```bash
npm run db:seed
```

При ошибке TLS с Supabase: `npm run db:seed:supabase`

```bash
DATABASE_URL="..." npx prisma migrate deploy
SEED_ADMIN_EMAIL=admin@company.com SEED_ADMIN_PASSWORD='...' npm run db:seed
```

## 6. Подключить локальное приложение

В `.env` или `.env.local`:

```env
DATABASE_URL=postgresql://postgres.xxx:yyy@db.xxx.supabase.co:5432/postgres
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

Запуск:

```bash
npm run dev
```

## 7. Проверка

Smoke NextAuth-таблиц:
```bash
npm run smoke:nextauth-db
```

- [ ] Login работает
- [ ] Search (hybrid) — хотя бы keyword
- [ ] Settings / RBAC
- [ ] Agent ingestion (загрузить файл → воркер создаёт chunks)

## 8. Ошибка «password authentication failed»

1. [Supabase Dashboard](https://supabase.com/dashboard) → твой проект → **Settings** → **Database**
2. **Reset database password** — задай новый пароль и сохрани
3. Обнови `.env`: замени пароль в `DATABASE_URL`. Если в пароле есть `@`, пиши `%40`
4. Сохрани в nano: `Ctrl+O` → Enter → `Ctrl+X`
5. Запусти снова: `npm run cloud:setup`

**Порт 3001 занят?** Освободить: `lsof -i :3001` → `kill -9 <PID>`. Или запуск на другом порту: `PORT=3002 npm run dev`.

## 9. Ограничения Free tier

- 500 MB БД
- 2 проекта
- Пауза после 7 дней неактивности (можно разбудить)

Для production — Pro plan или переход на AWS RDS.
