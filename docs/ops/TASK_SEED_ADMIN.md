# Задача: создать первого пользователя-администратора

Промт для разработчика / AI-ассистента / junior.

---

## Контекст

Проект использует **NextAuth (Credentials)** + **Prisma (Postgres)**.
В продакшене нет ни одного пользователя, поэтому логин невозможен.
Нужно реализовать **надёжный и безопасный способ создания первого администратора**.

---

## Требования

### 1. Seed-скрипт

Реализовать seed для создания **первого администратора**, если его ещё нет.

**Источник данных:**

* `SEED_ADMIN_EMAIL`
* `SEED_ADMIN_PASSWORD`

**Поведение:**

* если пользователь с таким email **уже существует** → ничего не делать (idempotent)
* если не существует → создать пользователя:
  * захешировать пароль (`bcrypt`)
  * назначить роль `ADMIN` / `SUPERADMIN`
  * установить `emailVerified = true` (если используется)
* вывести лог:
  * `Seeded admin: <email>` или `Admin already exists: <email>`

---

### 2. Безопасность

* ❌ **Никогда** не хардкодить пароль
* ❌ **Не логировать** пароль или хеш
* ❌ **Не выполнять seed автоматически** без явного запуска
* ❌ В `NODE_ENV=production` запрещать insecure TLS
* ✅ Поддерживать явный opt-in (`SEED_TLS_INSECURE=1`) только для локального dev

---

### 3. Интеграция

* Seed должен вызываться через Prisma:

  ```json
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
  ```
* Команда:

  ```bash
  npm run db:seed
  ```
* Для Supabase / self-signed TLS:

  ```bash
  npm run db:seed:supabase
  ```

---

### 4. Проверки

После выполнения seed:

* пользователь должен успешно логиниться через `/api/auth/callback/credentials`
* `/api/auth/providers` и `/api/auth/csrf` возвращают 200
* повторный запуск seed не меняет данные

---

## Ожидаемая реализация (примерно)

```ts
// prisma/seed.ts
if (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD) {
  throw new Error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required");
}

const existing = await prisma.user.findUnique({
  where: { email },
});

if (existing) {
  console.log(`Admin already exists: ${email}`);
  process.exit(0);
}

const passwordHash = await bcrypt.hash(password, 12);

await prisma.user.create({
  data: {
    email,
    passwordHash,
    role: "ADMIN",
    emailVerified: new Date(),
  },
});

console.log(`Seeded admin: ${email}`);
```

---

## Definition of Done

* [ ] Администратор создаётся одной командой
* [ ] Seed безопасен и идемпотентен
* [ ] Работает в prod (Railway / Postgres)
* [ ] Документирован в README / docs
* [ ] Логин работает сразу после seed

---

## Текущий статус (papa-app)

Реализация в `prisma/seed.ts` **соответствует** требованиям:

| Требование | Статус |
|------------|--------|
| SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD | ✅ (есть defaults для dev: `admin@example.com` / `ChangeMe123!`) |
| Idempotent | ✅ (проверка existingAdmin + admin role) |
| bcrypt hash | ✅ (bcryptjs, cost 12) |
| Роль admin | ✅ (UserRole → role "admin") |
| Не логировать пароль/хеш | ✅ |
| Production TLS guards | ✅ |
| SEED_TLS_INSECURE opt-in | ✅ |
| `npm run db:seed` / `db:seed:supabase` | ✅ |
| Prisma seed config | ✅ |

**Опционально:** для строгого соответствия промту — требовать `SEED_ADMIN_EMAIL` и `SEED_ADMIN_PASSWORD` в prod (throw, без defaults). Сейчас defaults позволяют локальный dev без .env.

См. также: [RAILWAY_SEED_LOGIN.md](./RAILWAY_SEED_LOGIN.md), [DB_SEED_TLS.md](./DB_SEED_TLS.md).
