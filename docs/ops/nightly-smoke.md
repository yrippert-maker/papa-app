# Nightly smoke: lifecycle, escalation, recovery

Документ описывает жизненный цикл nightly smoke-проверок,
эскалацию инцидентов и процесс восстановления.

---

## TL;DR (для PR description)

```markdown
## TL;DR

Вынесена логика nightly smoke (issue / HIGH / CRITICAL / recovery) в reusable workflow.

Что добавлено:
- Единый `_lib/nightly-notify.yml` для всех smoke-workflows
- Агрегация падений в один issue (`nightly-smoke`)
- Эскалация в CRITICAL при 3 подряд падениях (один раз)
- SNS HIGH на каждое падение, SNS+Slack только при CRITICAL
- Автоматический recovery: снятие `critical` + закрытие issue
- Concurrency-защита от race-condition (один run на workflow)

Тестирование:
- Добавлены test-only `workflow_dispatch` inputs (`force_fail`, `force_is_schedule`)
- Позволяет вручную прогнать FAIL×3 → CRITICAL → SUCCESS без ожидания nightly

Безопасность:
- Тестовые хуки работают только при `workflow_dispatch`
- Scheduled nightly runs не затронуты
```

---

## Overview

Nightly smoke-workflows:

- `smoke-prod`
- `smoke-docker`
- `smoke-electron`

Все они вызывают reusable workflow `_lib/nightly-notify.yml`,
который отвечает за:

- issue management
- HIGH / CRITICAL notifications
- escalation logic
- automatic recovery

---

## Lifecycle

### ADR-style summary

| | |
|---|---|
| **Status** | Accepted |
| **Context** | Nightly smoke может падать по разным причинам; нужна агрегация, эскалация и recovery без шума. |
| **Decision** | Один issue на workflow; HIGH на каждый fail; CRITICAL ровно раз при 3 подряд; auto-close при success. |
| **Consequences** | Reusable `_lib/nightly-notify.yml`; счётчик по маркеру; Slack только CRITICAL; post-mortem link при CRITICAL; cancelled/skipped игнорируются. |

### Flow (упрощённо)

```text
smoke job ──┬── FAIL  ──► issue + HIGH ──► (failures ≥ 3?) ──► CRITICAL (once)
            │
            └── SUCCESS ──► recovery: remove critical, close issue
```

---

## Issue management

* Issue title:
  `Nightly smoke failed: <workflow_name>`
* Label: `nightly-smoke`
* Все падения агрегируются в **один issue**
* Каждый FAIL добавляет комментарий с маркером:

```html
<!-- nightly-smoke-failure -->
```

Этот маркер используется для подсчёта подряд идущих падений.

---

## Escalation rules

| Condition                        | Action                                  |
| -------------------------------- | --------------------------------------- |
| 1–2 падения подряд               | Issue update + SNS HIGH                 |
| ≥3 падения подряд                | Label `critical` + SNS CRITICAL + Slack |
| Повторные падения при `critical` | Только SNS HIGH                         |
| SUCCESS после CRITICAL           | Downgrade + close issue                 |

CRITICAL-эскалация выполняется **только один раз**
(если label `critical` уже есть — повторной эскалации нет).
В комментарии при эскалации добавляется ссылка **[Create post-mortem]** — открывает issue с [post-mortem template](../../.github/ISSUE_TEMPLATE/post-mortem.md) и предзаполненным Related incident.

---

## Recovery

При успешном nightly run:

* Issue с label `nightly-smoke` находится автоматически
* Label `critical` снимается (если был)
* Добавляется комментарий `Nightly smoke recovered`
* Issue закрывается

---

## Manual testing (workflow_dispatch)

Для ручной проверки логики используются test-only inputs:

| Input               | Назначение                                |
| ------------------- | ----------------------------------------- |
| `force_fail`        | Принудительно завершить `smoke` с ошибкой |
| `force_is_schedule` | Считать ручной запуск как nightly         |

### Пример прогона

1. FAIL ×3 → CRITICAL (SNS + Slack)
2. SUCCESS → recovery + close issue
3. Повторный FAIL после CRITICAL → без повторной эскалации

Тестовые хуки:

* активны **только** при `workflow_dispatch`
* не влияют на `schedule`-запуски

---

## Manual testing: step-by-step

### FAIL #1

`workflow_dispatch`: `force_is_schedule=true`, `force_fail=true`

Ожидаемо:

* Создан issue `Nightly smoke failed: <workflow_name>`
* Добавлен 1 комментарий с маркером `<!-- nightly-smoke-failure -->`
* Отправлен SNS **HIGH**
* **CRITICAL не установлен**

### FAIL #2

Те же параметры.

Ожидаемо:

* Второй failure-комментарий в issue
* SNS **HIGH**
* **CRITICAL всё ещё нет**

### FAIL #3 (эскалация)

Те же параметры.

Ожидаемо:

* Добавлен label `critical`
* Комментарий `Escalated to CRITICAL`
* Отправлен SNS **CRITICAL**
* Отправлен **Slack** (если `enable_slack: true`)
* Повторной эскалации при следующих падениях **не будет**

### SUCCESS (recovery)

`workflow_dispatch`: `force_is_schedule=true`, `force_fail=false`

Ожидаемо:

* Комментарий `Nightly smoke recovered`
* Label `critical` снят (если был)
* Issue автоматически **закрыт**

### Проверка: CRITICAL не повторяется

После установки `critical` выполнить ещё один FAIL: `force_fail=true`

Ожидаемо:

* SNS **HIGH** отправлен
* **Нет** повторного SNS CRITICAL
* **Нет** Slack-уведомления
* Label `critical` не добавляется повторно

---

## Concurrency protection

Во всех smoke-workflows:

```yaml
concurrency:
  group: nightly-smoke-${{ github.workflow }}
  cancel-in-progress: false
```

Это гарантирует:

* один активный run на workflow
* отсутствие race-condition при работе с issue
* новые запуски ждут завершения текущего

---

## Cleanup / Maintenance

Варианты:

1. **Оставить как есть** — inputs и шаг `Force failure` безопасны, т.к. работают только при `workflow_dispatch`.
2. **Удалить после теста**:
   * блок `workflow_dispatch.inputs`
   * шаг `Force failure (test only)`
   * вернуть `is_schedule` к `github.event_name == 'schedule'`

Рекомендуется **оставить** для будущих регрессионных проверок.

---

## Notes

* SNS HIGH / CRITICAL топики настраиваются через secrets
* Slack используется **только** для CRITICAL

---

## FAQ

### Почему не эскалируем `cancelled` и `skipped`?

`needs.smoke.result` может быть `cancelled` (ручная отмена, concurrency) или `skipped` (path filters). Трактуем их как «неизвестный исход»:

* **Эскалировать** — риск ложных CRITICAL (run отменили до завершения smoke).
* **Закрывать issue** — риск случайно закрыть реальный инцидент.

Поэтому: триггеры только на `failure`, recovery только на `success`. Cancelled/skipped → никаких действий.

### Почему Slack только для CRITICAL?

Чтобы не зашумлять канал. HIGH идёт в SNS (email) и в issue — этого достаточно для 1–2 падений. CRITICAL = «3 ночи подряд» — требует немедленного внимания, Slack оправдан.

### Почему маркер `<!-- nightly-smoke-failure -->`, а не текст?

Подсчёт идёт по количеству комментариев с маркером. Текст вроде «Nightly smoke failed» может случайно появиться в других комментариях; HTML-комментарий — устойчивый и уникальный идентификатор.

---

## Future considerations (не обязательно сейчас)

* **Release smoke / pre-deploy checks** — см. [release-smoke-pattern.md](./release-smoke-pattern.md).
* **Вынос в отдельный репо** — при росте числа reusable workflows рассмотреть отдельный репо с versioned workflows.
* **Метрики** — MTTR, incidents per month (агрегация по label `critical` / `post-mortem`).
* **Action items** — автосбор из post-mortem issues (например, bot или weekly digest).
