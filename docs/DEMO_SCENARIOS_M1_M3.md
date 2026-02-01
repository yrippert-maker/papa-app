# Демо-сценарии M1–M3

Проверяемые сценарии для приёмки milestones. Выполнять через curl или Postman.

**Базовый URL:** `http://localhost:3000` (или E2E_BASE_URL)

---

## M1: Policy layer + 401/403

### 1.1 Неавторизованный запрос → 401 или 307

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/workspace/status
# Ожидается: 401 или 307
```

### 1.2 Авторизованный пользователь с правами → 200

Использовать `scripts/e2e-smoke.mjs` — он выполняет логин и проверку:

```bash
npm run test:e2e
# Ожидается: [OK] Authenticated request → 200
```

Или вручную: залогиниться в браузере, открыть DevTools → Application → Cookies, скопировать `next-auth.session-token`, затем:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/workspace/status \
  -H "Cookie: next-auth.session-token=СКОПИРОВАННОЕ_ЗНАЧЕНИЕ"
# Ожидается: 200
```

### 1.3 Пользователь без прав (роль с ограничениями) → 403

*После внедрения US-3:*

```bash
# Логин как user с ролью ENGINEER (только VIEW)
# Запрос к /api/files/upload (требует files:upload)
# Ожидается: 403
```

**Критерий M1:** сценарии 1.1, 1.2, 1.3 дают ожидаемые коды.

---

## M2: Логин через users table

### 2.1 Пользователь из БД — успешный логин

- Пользователь существует в `users`, пароль верный
- Логин → redirect/cookie, сессия создана
- Запрос к protected API с cookie → 200

### 2.2 Несуществующий пользователь — отказ

- Логин с неверным email/password
- Ответ: ошибка, нет Set-Cookie
- Запрос к protected API без cookie → 401/307

**Критерий M2:** нельзя залогиниться без записи в `users`.

---

## M3: Разные роли, e2e

### 3.1 Admin — полный доступ

- Логин как admin
- Все ключевые API (workspace, files, tmc) → 200

### 3.2 Роль с ограничениями — 403 на запрещённый action

- Логин как engineer (только VIEW)
- GET /api/workspace/status → 200
- POST /api/files/upload → 403
- POST /api/ledger/append → 403 (если требуется ledger:append)

**Критерий M3:** e2e покрывает минимум 2 роли (admin + ограниченная).

---

## Формат демо (для заказчика)

| # | Сценарий | Ожидаемый код | Факт |
|---|----------|---------------|------|
| M1.1 | Без auth | 401/307 | |
| M1.2 | С auth, есть права | 200 | |
| M1.3 | С auth, нет прав | 403 | |
| M2.1 | Логин из БД | OK | |
| M2.2 | Логин не из БД | Fail | |
| M3.1 | Admin | 200 | |
| M3.2 | Limited role | 403 на restricted | |

Заполнять при демо. Все «Факт» = ожидаемым → milestone принят.
