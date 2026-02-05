# Platform reference implementations

Референсные реализации для onboarding и копирования в другие репозитории.

---

## Nightly smoke (operational baseline)

**Документация:** [nightly-smoke.md](./nightly-smoke.md)

**Компоненты:**

- `_lib/nightly-notify.yml` — reusable workflow (issue / HIGH / CRITICAL / recovery)
- `smoke-prod`, `smoke-docker`, `smoke-electron` — callers
- Post-mortem template + автосвязка при CRITICAL

**PR (baseline):** _TODO после merge — вставить ссылку_

**Использование:** эталон для smoke/monitoring пайплайнов, release smoke ([release-smoke-pattern.md](./release-smoke-pattern.md)).

---

## PR labels (рекомендуемые)

При merge референсных PR добавлять:

- `operational-baseline` — baseline для эксплуатации
- `platform-reference` — референс для копирования в другие репо

**Создание labels (один раз):** `./scripts/create-github-labels.sh owner/repo`
