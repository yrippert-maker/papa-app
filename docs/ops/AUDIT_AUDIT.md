# Audit-аудит: что должно логироваться и как понять, что хватает

## 1.1. Контрольный список "обязательных" событий (MVP compliance)

### Auth

* `auth.sign_in` (успех) ✅
* `auth.sign_out` (если есть)
* `auth.sign_in_failed` (неуспех) — полезно для алертов (без PII/паролей)

### RBAC / Access control

* `rbac.access_denied` (403) — с route + role + requestId ✅ (sampling 1%)
* `security.last_admin_blocked` ✅

### Админские изменения данных

* `admin.user.create / update / delete`
* `admin.user.role_change`
* `settings.user.update` (критичные поля)

### Системные операции

* `ops.db.migrate` (start/success/fail)
* `ops.audit_prune` (start/success/fail; deletedCount, cutoffDays) ✅

---

## 1.2. "Качество" аудита (инварианты)

Для каждого audit event проверь:

| Поле | Описание |
|------|----------|
| **Кто** | `actorUserId` (или `system`) |
| **Что** | `action` (строгое имя) |
| **Над чем** | `entityType` + `entityId` (или аналог) |
| **Когда** | `createdAt` |
| **Откуда** | IP (первый из `x-forwarded-for`) + user-agent |
| **Корреляция** | `requestId` ✅ |
| **Контекст** | минимум metadata, без секретов ✅ |

Если чего-то нет — это "дырка расследований".

---

## 1.3. Таксономия действий (префиксы)

* `auth.*`
* `admin.*`
* `settings.*`
* `security.*`
* `ops.*`
* `rbac.*`

**Правило:** одно действие = один смысл (без "user.updated" на всё подряд).

---

## 1.4. PII / секреты (жёсткие правила)

* Никогда: пароли, токены, cookie, Authorization ✅
* Email/username — только если нужно расследованию (лучше как `targetUserId`)
* Metadata — *allowlist only* ✅

---

## 1.5. Проверка "аудит работает всегда"

| Сценарий | Статус |
|----------|--------|
| CRUD внутри транзакции → audit только при коммите | ✅ |
| Last-admin invariant → блок + `security.last_admin_blocked` | ✅ |
| Pagination → без дыр/дублей при росте | ✅ |
| Retention → удаляет старше N дней, не трогает свежее | ✅ |
| `ops.audit_prune` в конце prune | ✅ |
