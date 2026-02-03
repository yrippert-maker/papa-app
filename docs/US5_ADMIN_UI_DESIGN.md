# US-5: Admin UI — UX + Permissions Design

## Цель

Страница управления пользователями: создать, назначить роль, сбросить пароль. Доступ только для ADMIN.

---

## Permissions

| Действие | Permission | Роли |
|----------|------------|------|
| Просмотр списка | `ADMIN.MANAGE_USERS` | ADMIN |
| Создать пользователя | `ADMIN.MANAGE_USERS` | ADMIN |
| Изменить роль | `ADMIN.MANAGE_USERS` | ADMIN |
| Сбросить пароль | `ADMIN.MANAGE_USERS` | ADMIN |

Проверка: `can(session, PERMISSIONS.ADMIN_MANAGE_USERS)` — на странице и в API.

---

## UX Flow

### 1. Навигация

- **Sidebar:** пункт «Пользователи» виден только при `can(session, ADMIN.MANAGE_USERS)`.
- **URL:** `/admin/users`.
- **403:** если пользователь без прав зайдёт по прямой ссылке — показать сообщение «Доступ запрещён» (или redirect на `/`).

### 2. Страница /admin/users

**Layout:** `DashboardLayout`, как у остальных страниц.

**Содержимое:**
- Заголовок «Пользователи»
- Таблица: email, роль, created_at, действия
- Кнопка «Добавить пользователя»
- Действия в строке: «Сменить роль», «Сбросить пароль»

**Минимальный UI (MVP):**
- Таблица без пагинации (до ~50 пользователей допустимо; US-7 позже)
- Модальное окно или отдельная форма для «Добавить»
- Модалка «Сменить роль» — select с ролями из `rbac_role`
- Модалка «Сбросить пароль» — показать временный пароль (сгенерировать random), копировать в буфер

### 3. Форма «Добавить пользователя»

- Email (required)
- Пароль (required, min 8 символов)
- Роль (select: ADMIN, MANAGER, STOREKEEPER, ENGINEER, AUDITOR)
- Кнопки: «Создать», «Отмена»

### 4. Сброс пароля

- Генерация временного пароля (например, 12 символов random)
- Показать один раз, кнопка «Скопировать»
- Опционально: «Отправить на email» — заглушка, позже

---

## API Endpoints

| Method | Path | Permission | Описание |
|--------|------|------------|----------|
| GET | `/api/admin/users` | ADMIN.MANAGE_USERS | Список users (id, email, role_code, created_at) |
| POST | `/api/admin/users` | ADMIN.MANAGE_USERS | Создать: email, password, role_code |
| PATCH | `/api/admin/users/[id]` | ADMIN.MANAGE_USERS | Обновить роль или сбросить пароль |

**Request/Response:** JSON. Валидация через zod.

---

## Audit

**События для логирования:**
- `USER_CREATED` — кто создал, кого (email, role)
- `USER_ROLE_CHANGED` — кто изменил, кого, старая/новая роль
- `USER_PASSWORD_RESET` — кто сбросил, кого (без пароля в логе)

**Хранение:** ledger (`ledger_events`) с `event_type` + `payload_json`. Схему расширить в `lib/ledger-schema.ts`.

---

## Wireframe (текст)

```
+------------------------------------------+
| Пользователи                             |
| Управление учётными записями             |
+------------------------------------------+
| [+ Добавить пользователя]                |
+------------------------------------------+
| Email           | Роль      | Создан  | Действия      |
|-----------------|-----------|---------|---------------|
| admin@local     | ADMIN     | 01.02   | [Роль][Пароль]|
| user@local      | MANAGER   | 02.02   | [Роль][Пароль]|
+------------------------------------------+
```

---

## Зависимости

- `users` table ✅
- `rbac_role` ✅
- `can()` / `requirePermission()` ✅
- Расширение `ledger_events` — добавить типы USER_* в `lib/ledger-schema.ts`

---

## Checklist реализации

- [x] API: GET /api/admin/users
- [x] API: POST /api/admin/users (zod, bcrypt)
- [x] API: PATCH /api/admin/users/[id] (role, reset password)
- [x] Страница /admin/users с таблицей
- [x] Модалки: добавить, сменить роль, сбросить пароль
- [x] Sidebar: условный пункт «Пользователи»
- [x] Ledger: USER_CREATED, USER_ROLE_CHANGED, USER_PASSWORD_RESET
- [x] E2E: admin может создать user, non-admin получает 403
