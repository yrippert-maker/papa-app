# Release / pre-deploy smoke: паттерн адаптации

Документ описывает, как адаптировать паттерн nightly-notify под **release smoke** и **pre-deploy checks**.

Эталон: [nightly-smoke.md](./nightly-smoke.md) и `_lib/nightly-notify.yml`.

---

## Когда использовать

* **Release smoke** — smoke перед публикацией релиза (tag push, pre-release).
* **Pre-deploy smoke** — smoke перед деплоем в staging/prod (manual approval, deploy workflow).

Общая идея: критичный пайплайн падает → агрегируем в issue → эскалируем при повторениях → recovery при success.

---

## Отличия от nightly

| Аспект | Nightly | Release / pre-deploy |
|--------|---------|----------------------|
| Триггер | `schedule` | `push: tags`, `workflow_dispatch`, `workflow_run` |
| Частота | Ежедневно | По событию (релиз, деплой) |
| Порог эскалации | 3 подряд | 1–2 (релиз критичнее) |
| Recovery | Авто-close при success | Может быть ручной (деплой откатили) |
| Issue title | `Nightly smoke failed: <wf>` | `Release smoke failed: <tag>` / `Pre-deploy failed: <env>` |

---

## Шаги адаптации

### 1. Создать reusable workflow

Скопировать `_lib/nightly-notify.yml` → `_lib/release-notify.yml` (или `pre-deploy-notify.yml`).

Изменить:

* `workflow_name` → `release_tag` или `deploy_env`
* Issue title: `Release smoke failed: <tag>` / `Pre-deploy failed: <env>`
* Label: `release-smoke` / `pre-deploy-smoke`
* Маркер: `<!-- release-smoke-failure -->` / `<!-- pre-deploy-failure -->`
* `severity_threshold`: default `1` или `2` (релиз = один fail уже критичен)
* `is_schedule` → `is_release` / `is_pre_deploy` (boolean: это release/deploy run)

### 2. Добавить smoke job в release/deploy workflow

Пример для release (перед `publish`):

```yaml
jobs:
  smoke-release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run prod:build
      # ... smoke steps ...
      - name: Smoke check
        run: curl -fsS http://127.0.0.1:3001/api/health

  publish:
    needs: [smoke-release, build-mac, build-win, sbom]
    # ...
```

### 3. Вызвать reusable notify

```yaml
  release_notify:
    needs: [smoke-release]
    uses: ./.github/workflows/_lib/release-notify.yml
    with:
      workflow_name: release
      release_tag: ${{ github.ref_name }}
      smoke_result: ${{ needs.smoke-release.result }}
      is_release: true
      severity_threshold: 1
    secrets: ...
```

### 4. Concurrency

```yaml
concurrency:
  group: release-smoke-${{ github.ref_name }}
  cancel-in-progress: false
```

Для pre-deploy — `group: pre-deploy-${{ github.event.inputs.environment }}`.

---

## Post-mortem

Использовать тот же [post-mortem template](../../.github/ISSUE_TEMPLATE/post-mortem.md). Ссылка «Create post-mortem» в CRITICAL-комментарии уже подставляет Related incident.

---

## Чек-лист внедрения

- [ ] Reusable `release-notify.yml` / `pre-deploy-notify.yml`
- [ ] Smoke job в release/deploy workflow
- [ ] Вызов reusable с корректными inputs
- [ ] Concurrency
- [ ] Secrets (SNS, Slack) проброшены
- [ ] Документация (runbook) обновлена
