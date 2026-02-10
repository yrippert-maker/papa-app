# Required Status Checks для main

Рекомендации по настройке branch protection (Settings → Branches → Branch protection rules → main):

## Итого required checks

- **smoke-next** — required
- **smoke-prod** — required
- **smoke-docker** — required (если деплой Docker-образом)
- **smoke-electron** — не required (scheduled/nightly)

| Check | Required? | Обоснование |
|-------|-----------|-------------|
| **smoke-next** | ✅ Да | Ловит "порт не слушает / dev-скрипты сломаны / health не отвечает". |
| **smoke-prod** | ✅ Да | Ловит "в dev ок, но build/start в прод режиме падает". |
| **smoke-docker** | ✅ Да | Ловит Dockerfile/ENTRYPOINT/права/non-root/env регрессии. |
| **smoke-electron** | ◻️ Нет | На runner'ах Electron иногда флакнет. Required только если desktop-релиз критичен на каждый PR. |

## Порядок smoke-workflows

Рекомендуемый порядок: smoke-next → smoke-prod → smoke-docker → smoke-electron.

При параллельном запуске порядок не гарантируется — это нормально. Для строгой последовательности потребуется orchestrator через `workflow_call`, обычно не нужно.

## Path filters (условный запуск)

| Workflow | PR | push main | Не запускается при |
|----------|-----|-----------|---------------------|
| smoke-next | всегда | всегда | — |
| smoke-prod | paths: app/**, lib/**, env.example, middleware.ts, … | **всегда** (страховка) | PR: только docs/**, *.md |
| smoke-docker | paths: Dockerfile, app/**, … | **всегда** (страховка) | PR: только docs/**, *.md |

**Страховочная ветка:** на `push` в main smoke-prod и smoke-docker запускаются **без** paths — main всегда проверяется полностью.

Все workflows: `job: smoke` — стабильное имя для Branch protection.

## Nightly schedule (08:00 MSK)

| Workflow | Cron (UTC) | При падении |
|----------|------------|--------------|
| smoke-prod | `0 5 * * *` (08:00 MSK) | SNS HIGH + issue/comment |
| smoke-docker | `15 5 * * *` (08:15 MSK) | SNS HIGH + issue/comment |
| smoke-electron | `30 5 * * *` (08:30 MSK) | SNS HIGH + issue/comment |

**Secrets:** `AWS_GITHUB_SNS_PUBLISH_ROLE_ARN`, `AWS_SNS_TOPIC_HIGH_ARN`, `AWS_SNS_TOPIC_CRITICAL_ARN`  
**Vars:** `AWS_SNS_REGION` (или `AWS_REGION`)

### Lifecycle nightly issues

| Событие | Действие |
|---------|----------|
| Night 1 fail | SNS HIGH email + создать issue |
| Night 2+ fail | SNS HIGH email + добавить комментарий |
| Night 3+ fail подряд | SNS CRITICAL email + label `critical` + эскалация |
| Night success | Снять `critical` (если был) + закрыть issue |

**Labels:** `nightly-smoke`, `critical` (создаются автоматически)

Подробнее: [nightly-smoke.md](./nightly-smoke.md)

### Acceptance / Test plan (nightly-notify)

1. **Manual FAIL x3** (workflow_dispatch, `force_is_schedule=true`, `force_fail=true`)
   * Run #1: issue создан + 1 failure-коммент; SNS HIGH отправлен; CRITICAL нет
   * Run #2: +1 failure-коммент; SNS HIGH отправлен; CRITICAL нет
   * Run #3: +1 failure-коммент; label `critical` добавлен; SNS CRITICAL отправлен; Slack отправлен; повторной эскалации нет при наличии label
2. **Manual SUCCESS** (workflow_dispatch, `force_is_schedule=true`, `force_fail=false`)
   * recovery-коммент; `critical` снят (если был); issue закрыт
3. **No duplicate CRITICAL**
   * повторный FAIL после CRITICAL → только SNS HIGH, без SNS CRITICAL/Slack

### Cleanup options

* **Вариант 1 (чисто):** удалить inputs, шаг `Force failure`, вернуть `is_schedule` к schedule-only
* **Вариант 2 (оставить для регресса):** оставить — активируется только при `workflow_dispatch` и `force_fail=true`
