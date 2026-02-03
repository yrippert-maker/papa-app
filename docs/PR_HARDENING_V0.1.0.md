# Mini-PR: Hardening перед v0.1.0

## Цель

Четыре точечных hardening-улучшения перед релизом, рекомендованных при приёмке US-5.

---

## (1) Sidebar: permission-based gate ✅

**Было:** пункт «Пользователи» показывался при `role === 'ADMIN'`.

**Стало:** показ при наличии permission `ADMIN.MANAGE_USERS` (через `session.user.permissions`).

**Изменения:**
- `lib/auth-options.ts` — в JWT/session callback добавляем `permissions` из `getPermissionsForRole(role)`
- `types/next-auth.d.ts` — расширены User/Session/JWT полем `permissions: string[]`
- `components/layout/Sidebar.tsx` — `canManageUsers = permissions.includes('ADMIN.MANAGE_USERS')`

**Зачем:** единый policy layer; при появлении SUPERADMIN или смене маппинга прав UI не разойдётся с API.

---

## (2) Reset password: предупреждение в UI ✅

**Было:** модалка с временным паролем без явного предупреждения.

**Стало:** добавлен текст «Показан один раз — скопируйте и сохраните. Пароль не логируется.»

**Проверка:**
- пароль не попадает в ledger (в payload только actor/target id/email)
- пароль не логируется на сервере (нет console.log с ним)

---

## (3) POST /api/admin/users: уникальность email ✅

**Проверка:**
- БД: `users.email` имеет `UNIQUE` (миграция 001)
- API: при дубле возвращает 409 + «User with this email already exists»
- E2E: после создания пользователя — повторный POST с тем же email → ожидаем 409

**Файлы:** `migrations/001_add_users.up.sql`, `app/api/admin/users/route.ts`, `scripts/e2e-smoke.mjs`

---

## (4) PATCH /api/admin/users/[id]: запрет self-demote ✅

**Проблема:** единственный админ по ошибке меняет свою роль и теряет доступ.

**Решение:** запрет изменения собственной роли. При `target_id === actor_id` и попытке сменить роль → 400 «Cannot change your own role».

**Файл:** `app/api/admin/users/[id]/route.ts`

---

## Дополнительно (release touches)

### (A) Подтверждение при создании ADMIN ✅

При выборе роли «Администратор» в форме создания — чекбокс «Подтверждаю создание пользователя с правами администратора», кнопка «Создать» заблокирована до подтверждения.

### (B) Audit для отказанных операций ✅

- `USER_CREATE_DENIED` (reason: duplicate_email) — при попытке создать пользователя с существующим email
- `USER_ROLE_CHANGE_DENIED` (reason: self_demote) — при попытке изменить свою роль

---

## Чеклист перед merge

- [x] (1) Sidebar permission-based
- [x] (2) UI warning для reset password
- [x] (3) 409 на дубль email + E2E
- [x] (4) Self-demote guard
- [x] (A) Admin creation confirmation
- [x] (B) Audit для denied operations
