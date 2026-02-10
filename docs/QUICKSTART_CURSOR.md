# Запуск проекта в Cursor / VS Code (без терминала)

## Шаг 0. Убедись, что проект открыт правильно

1. Запусти **Cursor** или **VS Code**.
2. **File → Open Folder**.
3. Выбери **папку проекта**, где лежит `package.json`.

> ⚠️ Это важно — без `package.json` блок NPM Scripts не появится.

---

## Шаг 1. Открой боковую панель Explorer

- **Windows / Linux:** `Ctrl + Shift + E`
- **Mac:** `Cmd + Shift + E`

Это левая панель с файлами проекта.

---

## Шаг 2. Найди блок NPM Scripts

Внизу левой панели Explorer посмотри: там должен быть раздел **NPM SCRIPTS** с пунктами `dev`, `build`, `start` и др.

### Если блока NPM Scripts нет (частая ситуация)

**Вариант A — через меню**

- **View** → **Open View** → выбери **NPM Scripts**.

**Вариант B — через Command Palette (самый надёжный)**

- `Ctrl + Shift + P` (Windows) или `Cmd + Shift + P` (Mac).
- Начни вводить: `npm`.
- Выбери **«NPM Scripts»**.

После этого блок **NPM Scripts** появится слева.

---

## Шаг 3. Запусти dev

В блоке **NPM Scripts**:

1. Найди скрипт **dev**.
2. Наведи курсор — появится кнопка ▶️.
3. Нажми ▶️ (или кликни по **dev**).

---

## Шаг 4. Что произойдёт дальше

- Внизу откроется **Terminal**.
- Выполнится команда: `npm run dev`.
- В логах будет что-то вроде: **Server running on http://localhost:3001**.

---

## Шаг 5. Открой сайт

Открой браузер и перейди по адресу:

**http://localhost:3001**

---

## Если что-то не работает — быстрая проверка

- ✔️ Есть ли `package.json` в корне проекта?
- ✔️ Есть ли в нём `"scripts": { "dev": "..." }`?
- ✔️ Выполнен ли `npm install`?

---

## Альтернатива (на всякий случай)

Можно всегда запустить вручную:

- **Terminal** → **New Terminal**
- Ввести: `npm run dev`

---

# Release notes: Desktop-safe NextAuth + как проверить

## Что сделано

### 1) Desktop-safe NextAuth (localhost / Electron)

**Файл:** `lib/auth-options.ts`

- **Cookies для desktop/localhost**
  - Для `http://localhost` явно выставлено:
    - `secure: false`
    - `sameSite: "lax"`
    - `sessionToken` без префикса `__Secure-`
  - Для `https://` поведение остаётся как раньше (secure cookies).

- **Desktop-safe redirect**
  - После логина разрешается редирект **только** на whitelist путей:
    - `/`, `/login`, `/documents`, `/operations`, `/compliance`, `/inspection`, `/governance`, `/workspace`, `/tmc`, `/tmc-requests`, `/safety`, `/mail`, `/admin`, `/system`, `/traceability`, `/ai-inbox`
    - и любые подпути под ними.
  - Любой другой `callbackUrl` заменяется на `baseUrl` (главная), чтобы исключить «левые» редиректы и поломку флоу в desktop.

### 2) Env-документация

**Файл:** `env.example`

- Добавлен блок **«NextAuth desktop»** с минимальным набором переменных.
- Для dev явно показаны `AUTH_ADMIN_EMAIL` и `AUTH_ADMIN_PASSWORD` (раскомментированы как подсказка).

### 3) Роут NextAuth

**Файл:** `app/api/auth/[...nextauth]/route.ts`

- Не менялся, App Router, `GET`/`POST` корректно.

---

## Обязательные переменные окружения

Источник: `.env.local` (dev) или конфиг/хранилище сборки (packaged build).

| Переменная | Обязательно | Пример |
|------------|-------------|--------|
| `NEXTAUTH_URL` | да | `http://localhost:3001` |
| `NEXTAUTH_SECRET` | да | сгенерировать: `openssl rand -base64 32` |
| `AUTH_ADMIN_EMAIL` | для dev логина (admin credentials) | `admin@local` |
| `AUTH_ADMIN_PASSWORD` | для dev логина | свой пароль |

**Важно:** без `NEXTAUTH_SECRET` возможны **500** и ситуация «вместо JSON приходит HTML».

> **Packaged build (Electron):** env хранится в **userData/config.env** (не в resources). При первом запуске создаётся файл из шаблона `env.production.example`. Пути: macOS — `~/Library/Application Support/ПАПА/config.env`, Windows — `%AppData%\ПАПА\config.env`. Заполните `NEXTAUTH_SECRET` и пароль, перезапустите приложение.

---

## Как проверить (минимальный чек)

### 1) Проверка session endpoint

Открой в браузере:

`http://localhost:3001/api/auth/session`

Ожидаемое:

- **HTTP 200**
- **JSON** в теле (не HTML).

### 2) Проверка логина

На `/login` введи логин/пароль → «Войти».

В DevTools → **Network** ожидается:

1. `POST /api/auth/callback/credentials`
2. затем `GET /api/auth/session`

### 3) Проверка cookies

DevTools → **Application → Cookies → http://localhost:3001**

Ожидаемое:

- есть `next-auth.session-token` (для http — без префикса `__Secure-`).

---

## Если снова 500 на GET /

1. **Смотри stack trace в терминале** (где `npm run dev`) — Next пишет туда точную ошибку.
2. **Бинарный тест:** открой `http://localhost:3001/dev-home` — тот же дашборд, но без auth.
   - Если **200** → проблема в auth/middleware для `/`.
   - Если **500** → проблема в layout или page.
3. **Обход:** `SKIP_AUTH_FOR_ROOT=1` в `.env.local` → `/` редиректит на `/dev-home`.
4. Типовые причины: `NEXTAUTH_SECRET`, `DATABASE_URL` (Prisma) при недоступной БД, `WORKSPACE_ROOT`/FS.

---

## Что дальше по плану

Когда логин стабилен (session 200 + редирект корректный + cookies ставятся):

1. **Production-режим**
   - `next build`
   - запуск из Electron через `next start` или standalone-сервер.
2. **Оптимизация сборки**
   - ужать `electron-builder` files, исключить лишнее, оставить только нужные артефакты.
