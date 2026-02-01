# Push и Release — пошаговый гайд

Безопасный сценарий публикации релиза (v0.1.2 и далее). Remote и GitHub username/repo настраиваются вручную.

---

## Prerequisites (What is required from the operator)

Before executing the push and release steps, the operator MUST ensure:

- A GitHub repository exists for this project.
- The operator has push rights to the target repository.
- A Git remote named `origin` is configured locally.
- If using the automated GitHub Release step:
  - GitHub CLI (`gh`) is installed.
  - The operator is authenticated (`gh auth status`).

If any of the above prerequisites are not met, the release process MUST NOT proceed.

**Note:**
- Release commit and annotated tag creation are local operations and do not require a configured remote.
- Push and GitHub Release creation require a configured `origin` remote.

---

## If `origin` remote is not configured

If `git remote -v` returns no output, configure the remote before proceeding:

**HTTPS:**

```bash
git remote add origin https://github.com/YOUR_USERNAME/REPO.git
```

**SSH:**

```bash
git remote add origin git@github.com:YOUR_USERNAME/REPO.git
```

**Verify:**

```bash
git remote -v
```

Ожидаемо: `origin` с fetch/push URL.

---

## 1) Проверки перед push

```bash
git status
git show v0.1.2 --no-patch
git log -1 --oneline
```

Убедитесь:
- рабочее дерево чистое
- тег `v0.1.2` указывает на нужный коммит

---

## 2) Push (2 команды)

```bash
git push -u origin main
git push origin v0.1.2
```

Для пустого/нового репозитория — корректный порядок.

---

## 3) GitHub Release

### Через скрипт (если `gh` установлен и авторизован)

```bash
gh auth status
./scripts/create-release.sh YOUR_USERNAME/REPO v0.1.2
```

### Вручную

GitHub → Releases → Create release → Tag `v0.1.2` → вставить текст из `docs/GITHUB_RELEASE_NOTES_v0.1.2.md`.

---

## 4) Частые ошибки push

| Проблема | Решение |
|----------|---------|
| remote уже существует | `git remote set-url origin <URL>` |
| ветка не main | `git branch -M main` |
| Нет прав | Проверить: репозиторий создан, доступ (HTTPS token / SSH key) |

---

## Что нужно для точных команд

Пришлите одно из двух:
1. `YOUR_USERNAME` и `REPO`
2. Вывод `git remote -v`

Можно получить готовый блок команд 1-в-1, включая `OWNER/REPO` для `create-release.sh`.

---

## Regulatory note

The absence of a configured remote does not affect the integrity or reproducibility
of the release artifacts. Regulatory bundles and evidence are generated locally
and become publicly accessible only after a successful push and GitHub Release.

**Regulatory submission bundles** MUST be built from a clean checkout of the release tag (no `ALLOW_DIRTY`):

```bash
git checkout v0.1.2.1
npm ci
./scripts/create-regulatory-bundle.sh v0.1.2.1
```
