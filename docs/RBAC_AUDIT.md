# RBAC и AuditEvent

## Граница ответственности: users vs UserRole

- **Admin API** читает/пишет роли через `users.role_code` (getDb). Это единственный путь изменения ролей в админке.
- **NextAuth** читает роли из Prisma `UserRole` (связь User ↔ Role).
- Admin API roles (`users.role_code`) **не влияют** на NextAuth roles (`UserRole`). Не смешивать, не использовать взаимозаменяемо.
- Проверка: `npm run check:userrole-writes` — запрещает мутации UserRole/Role в `app/api/**`.

## Prisma / DATABASE_URL

- **DATABASE_URL** задаётся в `prisma.config.ts` (для CLI: migrate, generate) и в `.env` (runtime).
- `.env` нужен для runtime и локальных скриптов (backup, cloud:setup).

## Роли

- **admin** — полный доступ, включая `/admin`, `/audit`, `/compliance/snapshots`
- **auditor** — чтение + аудит-логи (`/audit`, `/compliance/snapshots`)
- **user** — обычный доступ

## RBAC

### Session

Роли хранятся в `session.user.roles` (массив). Заполняются в NextAuth callbacks из Prisma `UserRole`.

### Middleware

- `/admin/**` → только `admin`
- `/audit/**`, `/compliance/snapshots` → `admin` или `auditor`
- При отсутствии роли → redirect на `/403`

### API guards

```ts
import { requireRoleForApi } from "@/lib/requireRole";

const err = requireRoleForApi(session, ["admin", "auditor"], req);
if (err) return err;
```

### Server actions

```ts
import { requireRole } from "@/lib/requireRole";

requireRole(session.user.roles ?? [], "admin");
```

## AuditEvent

### Хелпер

```ts
import { logAuditEvent } from "@/services/audit/logAuditEvent";

await logAuditEvent({
  actorUserId: session.user.id,
  action: "user.update",
  target: `User:${userId}`,
  metadata: { field: "role" },
});
```

### Автоматическое логирование

- **auth.sign_in** — при логине (NextAuth `events.signIn`)

### Пример API

`GET/POST /api/admin/audit-example` — пример использования `requireRoleForApi` и `logAuditEvent`.

### Retention

`npm run audit:prune` — удалить события старше 180 дней. `npm run audit:prune:dry` — dry-run.

### requestId

Middleware добавляет `x-request-id` при отсутствии. Использовать в `metadata` для корреляции audit ↔ app logs.

## Role invariants (lib/rbac-invariants.ts)

- **CHECK constraint:** только `admin`, `user`, `auditor` (миграция `role_constraints`)
- **ensureDefaultRole(userId):** назначить `user` если у пользователя нет ролей
- **preventLastAdminDemotion(userId):** запретить снятие admin с последнего администратора
