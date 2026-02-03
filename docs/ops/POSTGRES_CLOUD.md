# Postgres: локально и в облаке

## Вариант 1 — локально (Docker)

Для разработки без облака:

```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=papa postgres:16
```

В `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/papa?schema=public"
```

Дальше: миграции и seed (см. ниже).

---

## Вариант 2 — managed Postgres в облаке

Создай managed Postgres в одном из облаков:

| Облако | Сервис |
|--------|--------|
| **AWS** | RDS Postgres / Aurora Postgres |
| **GCP** | Cloud SQL for Postgres |
| **Azure** | Azure Database for PostgreSQL |

Получи параметры: **HOST**, **PORT** (обычно 5432), **USER**, **PASSWORD**, **DBNAME**.

### Прямой URL для Prisma (миграции и runtime)

В облаке почти всегда нужен SSL:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public&sslmode=require"
```

Подставь свои USER, PASSWORD, HOST, DBNAME.

### Firewall / Security group

- Разреши входящий трафик на порт **5432** (или указанный порт БД) с:
  - IP твоей машины (для `prisma migrate` и локального dev), и/или
  - CIDR пода/сервера, где крутится Next.js (для production).

---

## Миграции и seed (одинаково для Варианта 1 и 2)

После того как `DATABASE_URL` задан:

```bash
npx prisma migrate dev -n init_auth_rbac_audit
```

Затем seed (первый admin):

```bash
SEED_ADMIN_EMAIL=admin@company.com \
SEED_ADMIN_PASSWORD='StrongPassw0rd!' \
npx prisma db seed
```

---

## Prisma Accelerate (опционально)

- **Вариант A (рекомендуется сейчас):** один прямой `DATABASE_URL` для всего (migrate + runtime). Без Accelerate. Audit-friendly.
- **Вариант B:** отдельно `DIRECT_DATABASE_URL` для миграций и `DATABASE_URL` для runtime (например Accelerate). Требует явной настройки в `prisma.config.ts` и, при необходимости, в schema.

Пока всё не стабилизировано — используй Вариант A.

---

## AWS + Postgres (managed RDS + контейнерный деплой)

Рекомендуемый путь: Amazon Web Services + managed Amazon RDS + контейнерный деплой.

### 1) Создать Postgres в AWS (RDS)

Рекомендуемые параметры:

- Engine: PostgreSQL (актуальная stable-версия)
- Storage: gp3
- **Public access: NO** (приватная БД в VPC)
- Multi-AZ: по требованиям (prod — да, dev — опционально)
- Backup retention: ≥7 дней (prod)
- Monitoring/Logs: включить (минимум PostgreSQL logs)

Сетевое размещение:

- VPC: рабочая VPC приложения
- Subnets: private subnets (DB Subnet Group)
- Security Groups: отдельная SG для БД (`sg-db`)

### 2) Security Group / Firewall (минимум)

Создать **SG для приложения** (`sg-app`) и **SG для БД** (`sg-db`).

Настройки `sg-db`:

- **Inbound:** TCP 5432 **только** from `sg-app`
- **Outbound:** default (или ограничить по политике)

Это исключает доступ к БД «из интернета» и упрощает аудит.

### 3) DATABASE_URL (Prisma/Next runtime + миграции)

Формат:

```env
DATABASE_URL="postgresql://USER:PASSWORD@RDS_ENDPOINT:5432/DBNAME?schema=public&sslmode=require"
```

Примечания:

- Для RDS обычно достаточно `sslmode=require`.
- Если появятся ошибки TLS, проверь CA bundle (RDS CA) и переменные окружения контейнера (редко требуется ручная настройка при `sslmode=require`, но зависит от окружения).

### 4) Миграции и seed в AWS

В проде **НЕ** использовать `prisma migrate dev`. Правильно:

- **Миграции:**

  ```bash
  npx prisma migrate deploy
  ```

- **Seed (один раз при первичном разворачивании):**

  ```bash
  SEED_ADMIN_EMAIL=admin@company.com SEED_ADMIN_PASSWORD='StrongPassw0rd!' npx prisma db seed
  ```

Seed выполняется один раз (через одноразовую task/job).

### 5) Где хранить секреты

Рекомендуется:

- **AWS Secrets Manager** для `DATABASE_URL`, `NEXTAUTH_SECRET`, seed-пароля
- (или SSM Parameter Store, если политика позволяет)

---

## Деплой Next.js контейнером в AWS

### Вариант 1 (рекомендованный): Amazon ECS + AWS Fargate + ALB

Что получится:

- контейнер с Next.js (одна задача/сервис)
- приватная RDS в той же VPC
- вход снаружи через **ALB + HTTPS (ACM)**

Минимальный чек-лист:

1. Собрать Docker image, запушить в Amazon ECR
2. ECS Service (Fargate) в private subnets
3. ALB в public subnets + ACM сертификат (HTTPS)
4. Переменные окружения/секреты подтянуть из Secrets Manager
5. Security groups: ALB → sg-app (80/443), sg-app → sg-db (5432)

### Вариант 2 (проще, меньше DevOps): AWS App Runner

Подходит, если не хочешь руками собирать VPC/ECS. Но для приватной RDS всё равно придётся настроить VPC connector.

**Если нет DevOps-ресурса — App Runner часто быстрее.**  
Если нужен максимальный контроль и «как у всех» — ECS/Fargate.

---

## Что сделать прямо сейчас (AWS-путь)

1. Создать RDS Postgres (dev instance достаточно).
2. Сформировать `DATABASE_URL` по шаблону выше.
3. Локально (или в CI) выполнить:

   ```bash
   npx prisma migrate deploy
   SEED_ADMIN_EMAIL=admin@company.com SEED_ADMIN_PASSWORD='StrongPassw0rd!' npx prisma db seed
   ```

4. После этого NextAuth работает с DB-backed users; продолжать RBAC/audit.

---

## Уточнения для точного чек-листа AWS

1. Деплой приложения: **ECS/Fargate** или **App Runner**?
2. База: **private-only** (рекомендуется) или **public** на время dev?

Дефолт: **ECS/Fargate + private RDS**.

---

## Recommended scenario (prod/dev parity)

**Основной путь:** ECS/Fargate + ALB (ACM) + private RDS.

- **Secrets:** AWS Secrets Manager (`DATABASE_URL`, `NEXTAUTH_SECRET`, seed-пароль при init).
- **Migrations:** one-off ECS task — `npm run db:migrate:deploy` (или `npx prisma migrate deploy`).
- **Seed:** one-off ECS task — `npm run db:seed` (только при первичном разворачивании; переменные `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` из Secrets Manager или env).

Артефакты в репозитории:

- **Dockerfile** — multi-stage, Next.js standalone; для ECR и ECS/App Runner.
- **`output: "standalone"`** в `next.config.mjs` — обязательно для этого Dockerfile.
- **`npm run db:migrate:deploy`** / **`npm run db:seed`** — для one-off ECS tasks.
- **`/api/health`** — GET без auth, возвращает `{ ok: true }`; использовать для ALB target health check.

Дальше: **детерминированный деплой** — см. [ECS_FARGATE_DEPLOY.md](./ECS_FARGATE_DEPLOY.md): ECS task definition (cpu/mem, portMappings, secrets), ALB + Target Group, SG, IAM для ECR + Secrets Manager, one-off migrate/seed, проверка после деплоя.

---

## Другие облака (GCP / Azure)

Для GCP (Cloud SQL) и Azure (Azure Database for PostgreSQL) можно добавить аналогичные блоки: формат `DATABASE_URL`, firewall, деплой контейнером.
