# Runbook: DR Failover (Multi-Cloud)

**Цель:** обеспечить восстановление работы системы при недоступности основного облака без потери доказуемой целостности данных.

**Модель:** Active / Passive. Cloud B (Standby) прогрето, данные реплицированы.

---

## Роли

| Роль | Ответственность |
|------|-----------------|
| SRE / Platform | Техническое переключение |
| Security / Approver | Подтверждение корректности |
| System | Репликация, blockchain anchoring |

---

## Предусловия

- [ ] Cloud B развёрнут (ECS, RDS replica, S3 replica)
- [ ] S3 Cross-Region Replication (CRR) настроена
- [ ] RDS Cross-Region Read Replica создана
- [ ] Route53 health check на Primary ALB
- [ ] DNS failover record (standby) подготовлен

---

## Триггер

Failover возможен, если:

- Primary Cloud недоступен > N минут
- Health checks не проходят
- Standby синхронизирован в пределах допустимого RPO

Или ручное решение (плановое переключение).

---

## Шаги (кто / что / когда)

### 1. Подтвердить инцидент

| Действие | Ответственный | Время |
|----------|---------------|-------|
| Проверить status primary (ALB, ECS, RDS) | On-call | 0–2 мин |
| Убедиться: не кратковременный сбой | On-call | 2–5 мин |
| Оповестить: incident declared | On-call | 5 мин |

### 2. Проверить готовность Standby

| Действие | Ответственный | Время |
|----------|---------------|-------|
| RDS replica lag < 5 мин? | On-call | 1 мин |
| S3 replica актуальна? | On-call | 1 мин |
| ECS tasks в Standby healthy? | On-call | 1 мин |

**Safety-gate:** если lag > N минут — **не переключать** автоматически. Эскалировать.

**Manual gate:** в случае пограничных состояний (частичная деградация, сомнительная репликация) переключение может требовать ручного подтверждения уполномоченной роли (Approver / SRE). Решение фиксируется в audit-ledger.

### 3. Promote RDS (если failover)

| Действие | Ответственный | Время |
|----------|---------------|-------|
| RDS: Promote Read Replica (Standby region) | On-call / DBA | 2–5 мин |
| Обновить env Standby: `DATABASE_URL` → promoted endpoint | On-call | 1 мин |
| Перезапустить ECS tasks в Standby (если нужно) | On-call | 2 мин |

### 4. DNS Failover

| Действие | Ответственный | Время |
|----------|---------------|-------|
| Route53: переключить record на Standby ALB | On-call | 1 мин |
| Или: обновить CNAME/ALIAS вручную | On-call | 1 мин |
| Дождаться propagation (TTL) | — | 1–5 мин |

### 5. Верификация

| Действие | Ответственный | Время |
|----------|---------------|-------|
| Проверить /api/health | On-call | 1 мин |
| Проверить логин / базовые операции | On-call | 2 мин |
| Проверить ledger/anchoring доступность | On-call | 1 мин |

### 6. Пост-фейловер

| Действие | Ответственный | Время |
|----------|---------------|-------|
| Создать post-mortem issue | On-call | 5 мин |
| Оповестить заинтересованных | On-call | 5 мин |
| Запланировать failback (когда Primary восстановлен) | Lead | — |

---

## RTO / RPO

| Метрика | Целевое значение |
|---------|-----------------|
| **RTO** | ~10 мин (promote RDS + DNS) |
| **RPO** | < 5 мин (асинхронная репликация) |

---

## Failback (когда Primary восстановлен)

1. Cloud A переводится в standby
2. Убедиться: Primary healthy
3. Выполнить полную сверку: версии, sha256, blockchain receipts
4. Синхронизировать данные Standby → Primary (если были записи в Standby)
5. Настроить репликацию заново (Primary → Standby)
6. Решить: возвращаться ли на A или оставить B как primary
7. DNS: переключить обратно на Primary (если возврат)
8. Post-mortem: обновить

---

## Чего не делаем

- ❌ Не пишем данные с Mac обратно
- ❌ Не разрешаем параллельную запись в два облака
- ❌ Не нарушаем порядок версий без якорения

**Итог:** нет split-brain, нет недоказуемых изменений, все действия воспроизводимы и проверяемы.

---

## Контакты

| Роль | Контакт |
|------|---------|
| On-call | _заполнить_ |
| DBA / Infra | _заполнить_ |
| Incident commander | _заполнить_ |

---

## Ссылки

- [CLOUD_BLOCKCHAIN_ARCHITECTURE.md](../ops/CLOUD_BLOCKCHAIN_ARCHITECTURE.md) — §9 Multi-Cloud Failover
- [Terraform multi-region](../../terraform/multi-region/) — S3 CRR, RDS guidance
- [ECS_FARGATE_DEPLOY.md](../ops/ECS_FARGATE_DEPLOY.md) — деплой
