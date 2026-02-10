# Login + RBAC: готовность к облаку

Состояние: критический путь (login) закрыт, RBAC стабилен, тесты против регрессий.

---

## 1. Локальное использование (ежедневный цикл)

1. `npm run dev:quick`
2. Открыть `http://localhost:3001`
3. Логин под `admin@local`
4. Работа в интерфейсе

### Подготовка операторов

1. Под ADMIN открыть `/admin/users`
2. Создать пользователей: MANAGER, ENGINEER, STOREKEEPER, AUDITOR
3. Проверить каждым: меню и доступы соответствуют роли, `/admin/*` закрыт

---

## 2. Перед переносом в облако (обязательно)

### A) Dev-админ в production

Dev-админ (`AUTH_ADMIN_*`) **нельзя** использовать в prod.

- В prod: только реальная база пользователей
- Bootstrap admin создаётся миграцией/seed и управляется через UI

### B) Таблицы RBAC

try/catch спасает от 500, но в prod:

- Миграции должны гарантировать `rbac_role_permission` и т.п.
- Иначе система будет работать с пустыми правами

---

## 3. Pre-flight (проверить в dev/stage)

- [ ] Миграции применяются чисто
- [ ] Логин: success → редирект на `/`, invalid → сообщение
- [ ] RBAC: ADMIN видит Settings, не-ADMIN не видит
- [ ] `/admin/users`: только ADMIN, создание сохраняется
- [ ] В логах нет утечки секретов / SQL-ошибок

---

## 4. Следующий шаг: где база данных?

Ответ одним словом: **локальная** / **docker** / **rds**

От этого зависят:

- миграции
- seed
- деплой ECS/RDS
- env vars в ECS task
- production URL

---

## Ссылки

- [ECS_FARGATE_DEPLOY.md](./ECS_FARGATE_DEPLOY.md) — деплой
- [POSTGRES_CLOUD.md](./POSTGRES_CLOUD.md) — RDS
- [POSTGRES_LOCAL.md](./POSTGRES_LOCAL.md) — локальный Postgres
