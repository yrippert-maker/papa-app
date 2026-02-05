# Stage 2: миграция на ECS Fargate + RDS

**Когда:** при росте нагрузки, compliance/enterprise требованиях, изоляции окружений.

**Текущее состояние:** Railway + Supabase Postgres (Session Pooler).

**Целевое:** ECS Fargate + ALB + RDS (или Supabase как managed DB).

---

## 1. Триггеры для перехода

| Условие | Действие |
|---------|----------|
| Высокий трафик | ECS + auto-scaling |
| Compliance / enterprise | RDS в VPC, изоляция |
| Несколько окружений (dev/stage/prod) | ECS + отдельные services |
| Масштабирование worker | Отдельный ECS service |

---

## 2. Компоненты Stage 2

| Компонент | Назначение |
|-----------|------------|
| **ECS Fargate** | Запуск Next.js контейнера |
| **ALB** | HTTPS, health check `/api/health` |
| **RDS Postgres** | (опционально) замена Supabase; или оставить Supabase |
| **Secrets Manager** | `DATABASE_URL`, `NEXTAUTH_SECRET` |
| **CloudWatch Logs** | Логи приложения |
| **ECR** | Docker-образ |

---

## 3. План миграции (по этапам)

### Этап 1: Подготовка (1–2 дня)

- [ ] Создать ECR репозиторий
- [ ] Собрать Docker-образ: `docker build -t papa-app .`
- [ ] Проверить локально: `docker run -p 3000:3000 -e DATABASE_URL=... papa-app`
- [ ] Запушить образ в ECR

### Этап 2: Сеть и Security Groups (1 день)

- [ ] VPC: public + private subnets
- [ ] `sg-alb`: 443 inbound from 0.0.0.0/0
- [ ] `sg-app`: 3000 inbound from sg-alb, 5432 outbound to sg-db
- [ ] `sg-db`: 5432 inbound from sg-app только

### Этап 3: RDS (если мигрируем с Supabase)

- [ ] RDS Postgres в private subnets
- [ ] `db:migrate:prod` на новую БД
- [ ] Миграция данных (pg_dump/pg_restore) или параллельный период
- [ ] Обновить `DATABASE_URL` в Secrets Manager

### Этап 4: ECS Task Definition

- [ ] CPU: 0.5 vCPU, Memory: 1 GB (prod)
- [ ] Port: 3000
- [ ] Env: `NODE_ENV=production`, `PORT=3000`
- [ ] Secrets: `DATABASE_URL`, `NEXTAUTH_SECRET` из Secrets Manager
- [ ] `NEXTAUTH_URL` — финальный домен

### Этап 5: ALB + Target Group

- [ ] Health: `/api/health`, 200
- [ ] Listener 443 → target group
- [ ] ACM сертификат для домена

### Этап 6: ECS Service

- [ ] Desired count: 2 (prod)
- [ ] Rolling update
- [ ] Миграции: **one-off Run Task** перед деплоем: `npm run db:migrate:prod`

### Этап 7: Cutover

- [ ] DNS переключить на ALB
- [ ] `NEXTAUTH_URL` = новый домен
- [ ] Smoke: health, login, RBAC, audit
- [ ] Мониторинг 24–48 ч

---

## 4. Миграции

**Правило:** один экземпляр миграций за раз.

```bash
# ECS Run Task (один раз перед деплой)
Command: ["npm", "run", "db:migrate:prod"]
```

Не запускать миграции параллельно на нескольких тасках.

---

## 5. Worker (отдельный сервис)

Если нужен `agent:ingest:worker`:

- [ ] Отдельный ECS Service
- [ ] Тот же образ, другой command: `npm run agent:ingest:worker`
- [ ] Те же переменные (DATABASE_URL)
- [ ] Desired count: 1 (или по нагрузке)

---

## 6. Rollback

1. ECS Service → Update → previous task definition
2. DNS назад (если cutover)
3. `NEXTAUTH_URL` назад
4. Проверить `/api/health`

---

## 7. Ссылки

* Детальный runbook: `docs/ops/ECS_FARGATE_DEPLOY.md`
* Cloud: `docs/ops/POSTGRES_CLOUD.md`
* Prod runbook: `docs/ops/PROD_RUNBOOK.md`
