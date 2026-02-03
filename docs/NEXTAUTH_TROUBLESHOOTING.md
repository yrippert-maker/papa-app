# NextAuth — устранение `error=Configuration`

Чек-лист для исправления ошибки `/api/auth/error?error=Configuration` на localhost.

---

## Шаг 1 — ENV (самая частая причина)

Создайте/обновите `.env.local` в корне проекта:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_long_random_32+_chars
```

Сгенерировать секрет:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**После изменений — перезапустить dev-сервер.**

---

## Шаг 2 — минимальный провайдер

### Вариант A — Pages Router (`pages/api/auth/[...nextauth].ts`)

```ts
import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export default NextAuth({
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login) return null;
        return { id: "u-test", name: credentials.login };
      },
    }),
  ],
});
```

### Вариант B — App Router (`app/api/auth/[...nextauth]/route.ts`)

```ts
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

const handler = NextAuth({
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        login: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login) return null;
        return { id: "u-test", name: String(credentials.login) };
      },
    }),
  ],
});

export { handler as GET, handler as POST };
```

---

## Шаг 3 — OAuth (Google/GitHub)

Если используется OAuth — все переменные обязательны:

**Google:**
```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```
Callback: `http://localhost:3000/api/auth/callback/google`

**GitHub:**
```env
GITHUB_ID=...
GITHUB_SECRET=...
```

---

## Шаг 4 — Adapter (Prisma/SQLite)

Если в конфиге есть `adapter:` — временно **закомментируйте** его.

- Ошибка исчезла → проблема в инициализации БД/adapter
- Ошибка осталась → проблема в env/providers/callbacks

---

## Шаг 5 — проверка

1. `npm run dev`
2. Откройте `http://localhost:3000/api/auth/signin`

Если видна страница входа, а не "Server error / Configuration" — конфиг работает.

---

## Другие 404 (не связаны с auth)

### URL `/login.` с точкой в конце

`/login` и `/login.` — разные маршруты. Точка даёт 404. Открывать строго:

```
http://localhost:3000/login
```

### 500 на `/api/workspace/status` / «Workspace: Не найден»

Означает, что workspace/БД ещё не инициализированы.

**Фикс:** Workspace → **Инициализировать** (кнопка) или из Console:

```js
fetch("/api/workspace/init", { method: "POST" }).then(r=>r.json()).then(console.log)
```

После init обновите дашборд. `/api/workspace/status` теперь всегда возвращает 200 (не 500) при отсутствии workspace/БД.

### Ошибки `/_next/static/*` 404

Битый dev-кэш после clean build, смены ветки, обновления Next.js. Фикс:

```bash
rm -rf .next
npm run dev
```

В браузере: **Cmd+Shift+R** (hard refresh) или инкогнито, затем `http://localhost:3000/login`.

---

## Важно для papa-app

- **NextAuth v4:** `trustHost` не использовать (v5-only); вызывает ошибку сборки.
- После изменений auth/env: **clean build** (`rm -rf .next && npm run build`) перед проверкой.

---

## Частые причины

| Причина | Решение |
|---------|---------|
| Нет `NEXTAUTH_SECRET` | Добавить в `.env.local`, перезапустить |
| Пустой `providers: []` | Добавить Credentials или OAuth |
| OAuth id/secret не заданы | Добавить переменные в `.env.local` |
| Adapter падает при инициализации | Временно отключить adapter |
| Исключение в callback | Включить `debug: true`, смотреть логи |

---

## Smoke-проверка

После запуска `npm run dev`:

```bash
npm run smoke:auth
```

Или вручную (BASE_URL по умолчанию http://localhost:3000):

```bash
# Providers — должен вернуть JSON (не 404, не Configuration)
curl -s http://localhost:3000/api/auth/providers | head -c 200

# Session — до входа: {"user":null} или пустой объект
curl -s http://localhost:3000/api/auth/session | head -c 100
```

Ожидаемо: OK providers, OK session; без `error=Configuration`, без 404.

---

## Точная диагностика

Реальная причина — только в **серверных логах**. Ищите в консоли:

- `NEXTAUTH_SECRET is not set`
- `No provider configured`
- `Invalid callback URL`
- `JWT secret missing`
- `Adapter error`
