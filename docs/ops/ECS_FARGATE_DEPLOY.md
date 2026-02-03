# ECS/Fargate + ALB + private RDS: детерминированный деплой

Минимальный, но полный набор параметров, чтобы поднять сервис с первого раза. Основной путь: **ECS/Fargate + ALB (ACM) + private RDS** (см. `POSTGRES_CLOUD.md`).

---

## 1) Сеть и Security Groups: схема «ALB → app → DB»

### Security Groups

#### `sg-alb`

**Inbound**

- TCP 443 from `0.0.0.0/0`
- (опционально) TCP 80 from `0.0.0.0/0` → редирект на 443

**Outbound**

- All to `sg-app` (или All, если политика позволяет)

#### `sg-app` (ECS tasks)

**Inbound**

- TCP 3000 from `sg-alb` *(в Dockerfile EXPOSE 3000)*

**Outbound**

- TCP 5432 to `sg-db`
- TCP 443 to `0.0.0.0/0` (если приложение ходит во внешние API, Slack, S3 и т.п.; иначе можно ограничить)

#### `sg-db` (RDS)

**Inbound**

- TCP 5432 from `sg-app` **только**

**Outbound**

- default

### Subnets

- **ALB:** public subnets (маршрут на IGW)
- **ECS tasks:** private subnets (маршрут на NAT для исходящего трафика)
- **RDS:** private subnets (DB Subnet Group)

> Если исходящие запросы наружу не нужны, NAT можно не использовать; часто они нужны (внешние API, Slack, ledger и т.д.).

---

## 2) ALB + Target Group

### Target Group

- Target type: **IP**
- Protocol: **HTTP**
- Port: **3000**
- Health check:
  - Path: `/api/health`
  - Success codes: `200`
  - Interval: 30s, Timeout: 5s, Healthy threshold: 2, Unhealthy: 3 (дефолты ок)

### Listener

- **443 HTTPS** — сертификат из ACM, forward → target group
- (опционально) **80 HTTP** → redirect to 443

---

## 3) ECS Task Definition: минимальные параметры

### Fargate Service

- Launch type: **Fargate**
- Platform: **Linux x86_64** (или arm64, если образ собран под arm)
- Desired count: 1 (dev) / ≥2 (prod)
- Auto Scaling: опционально (потом)

### Task size (CPU / Memory)

Стартовые значения:

- **dev:** 0.25 vCPU / 0.5–1 GB
- **prod (минимум):** 0.5 vCPU / 1–2 GB

### Port mapping

- Container port: **3000**
- Protocol: TCP

---

## 4) Environment + Secrets (Secrets Manager)

### В Secrets Manager (secret values)

- `DATABASE_URL` — строка подключения к RDS, `sslmode=require`
- `NEXTAUTH_SECRET` — 32+ байт, случайная строка
- (по необходимости) `SLACK_WEBHOOK_URL`, `LEDGER_BUCKET` и т.п.

### В Environment (не секреты)

- `NODE_ENV=production`
- `NEXTAUTH_URL=https://your-domain.example`
- `PORT=3000` *(опционально; standalone по умолчанию слушает 3000)*

> **Важно:** `NEXTAUTH_URL` должен совпадать с доменом на ALB и протоколом https.

---

## 5) IAM роли ECS

### Task execution role

Нужна для:

- pull образа из ECR
- чтения секретов из Secrets Manager

Минимальные политики:

- `AmazonECSTaskExecutionRolePolicy`
- разрешение `secretsmanager:GetSecretValue` для используемых секретов

### Task role (runtime)

Если приложение обращается к AWS API (S3, SES и т.д.) — выдать сюда нужные права.  
Если нет — можно оставить пустой.

---

## 6) One-off миграции и seed (ECS Run Task)

### Миграции (каждый деплой / перед стартом сервиса)

Запуск **Run task** в ECS:

- **Image:** тот же образ приложения
- **Command:**

  ```json
  ["npm", "run", "db:migrate:deploy"]
  ```

- **Secrets:** `DATABASE_URL`
- **Network:** private subnets + `sg-app`

### Seed (только при первичном разворачивании)

То же «Run task»:

- **Command:**

  ```json
  ["npm", "run", "db:seed"]
  ```

- **Secrets:** `DATABASE_URL` (и при необходимости `SEED_ADMIN_PASSWORD` в Secrets Manager)
- **Environment:** `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (пароль лучше хранить в Secrets Manager)

В проде seed выполнять один раз, затем отключить/удалить или ротировать seed-пароль.

---

## 7) Проверка после деплоя

1. **ALB target group:** все targets в состоянии **healthy**.
2. Открыть в браузере:
   - `https://your-domain/api/health` → ответ `{ "ok": true }`.
3. **Логи ECS:** нет падений контейнера, нет ошибок вида «NEXTAUTH_URL mismatch».
4. **Логин:** admin из seed успешно входит в приложение.
5. **БД:** созданы таблицы NextAuth, roles, audit_events (и остальные из Prisma schema).

---

## 8) Что нужно для «готового» Task Definition (JSON)

Чтобы выдать шаблон task definition с `containerDefinitions` и секретами без догадок, нужны три вещи:

1. **Регион AWS** (например `eu-west-1`).
2. **Архитектура образа:** `amd64` или `arm64`.
3. **Домен для `NEXTAUTH_URL`** уже есть? (да/нет).

После этого можно подготовить:

- шаблон task definition (containerDefinitions + secrets);
- список секретов и их имён/ключей в Secrets Manager;
- минимальную схему шагов в порядке: **ECR → ECS → ALB → RDS**.
