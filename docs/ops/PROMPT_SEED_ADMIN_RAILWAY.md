# Промт для разработчика: создание первого администратора (Railway / Prod)

Готовый промт для задачи / issue / сообщения разработчику.

---

## Контекст

Приложение `papa-app` задеплоено на Railway.
Авторизация через credentials (`/api/auth/callback/credentials`) возвращает `401 Unauthorized`, несмотря на то что пользователь существует в локальной БД.

Причина: **локальный seed не гарантирует запись в prod-БД Railway**.
Необходимо явно создать (или сбросить пароль) первого администратора **в prod-БД Railway**.

---

## Цель

Создать (или принудительно обновить пароль) пользователя-администратора:

* **Email:** `admin@company.com`
* **Роль:** `ADMIN`
* **Пароль:** `PapaApp2026_OK`

в **prod-БД Railway**, чтобы логин через UI (`/login`) начал работать.

---

## Обязательные шаги (Railway)

### 1. Открыть Railway Shell

> Важно: команды должны выполняться **в Railway Shell**, а не локально.

#### Вариант A. Shell в UI (Deploy Logs)

На экране **Deploy Logs** сервиса `papa-app`:

* В **правом верхнем углу** панели логов наведи курсор
* Рядом с иконками ⬇️ (download) и ↗️ (open in new tab) ищи кнопку **`>_`** (Exec / Shell)
* Появляется **только при наведении**; может называться `Exec`, `Open Shell` или иконка терминала

Если не появилась — **Restart** сервиса, дождись `✓ Ready in XXms`, снова наведи курсор в правый верхний угол.

#### Вариант B. Railway CLI + railway run (без Shell)

`railway run` выполняет команду **локально**, но подставляет `DATABASE_URL` из Railway Variables → seed идёт в prod-БД.

```bash
npx @railway/cli login
npx @railway/cli link
```

Выбрать: Project → Environment `production` → Service `papa-app`

```bash
npm run railway:seed
```

#### Вариант C. Railway Shell (если нужен интерактивный shell)

```bash
npx @railway/cli login
npx @railway/cli link
npx @railway/cli shell
```

Внутри shell — команды seed из шага 2 ниже.

---

### 2. Выполнить seed с явным force reset

```bash
export SEED_ADMIN_EMAIL="admin@company.com"
export SEED_ADMIN_PASSWORD="PapaApp2026_OK"
export SEED_ADMIN_FORCE_RESET="1"

npm run db:seed
```

Ожидаемый лог:

* `Seeded admin: admin@company.com` **или**
* `Admin password reset: admin@company.com` **или**
* `Admin already exists: admin@company.com`

---

### 3. Проверить, что это именно prod-БД

```bash
npx prisma db execute --stdin <<'SQL'
SELECT email FROM "User" ORDER BY email;
SQL
```

Ожидаемо: `admin@company.com`.

---

### 4. Проверить логин

Перейти в браузере:

```
https://papa-app-production.up.railway.app/login
```

Ввести:

* Email: `admin@company.com`
* Пароль: `PapaApp2026_OK`

Ожидаемый результат: **успешный вход**, `401` исчезает.

---

## Если 401 остаётся

Проверить **Railway logs** на момент логина, особенно `authorize()`.

Возможные причины:

1. Пользователь не найден в prod-БД
2. `bcrypt.compare()` возвращает `false`
3. `authorize()` читает не то поле / таблицу (`passwordHash`, `User`)

Допустимо временно добавить лог (без пароля и хэша):

```ts
console.info("[auth]", {
  email,
  userFound: !!user,
});
```

---

## Важно

Если после seed логин всё ещё даёт `401` — это **уже не seed и не Railway**, а **auth-код**:

* `authorize()` смотрит не в то поле
* bcrypt compare не совпадает
* используется другая таблица / схема

Решается одним логом в `authorize()` и проверкой Railway logs.

---

## Документация

Актуальный runbook: [RAILWAY_SEED_LOGIN.md](./RAILWAY_SEED_LOGIN.md)

(включает предупреждение «локальный seed ≠ Railway prod» и диагностику 401)
