# Branch Protection — required status checks (main)

Для `main`/`master` рекомендуется включить required status checks, чтобы security-сканы не обходились.

## Рекомендуемые required checks

| Check | Workflow | Описание |
|-------|----------|----------|
| build-and-test | ci.yml | Lint, test, build |
| CodeQL | security-codeql-gitleaks.yml | SAST |
| Gitleaks | security-codeql-gitleaks.yml | Secret scanning |
| verify_audit | ci.yml | (если main) |

## Настройка в GitHub

1. Settings → Branches → Branch protection rules → main
2. Require status checks to pass before merging
3. Добавить: `build-and-test`, `CodeQL`, `Gitleaks`
4. (Опционально) Require branches to be up to date

## Примечания

- `security-ai-weekly` — scheduled, не блокирует PR
- Trivy — часть weekly; для PR-gating можно добавить отдельный job в ci.yml
