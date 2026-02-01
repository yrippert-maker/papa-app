# Настройка GitHub — papa-app

## Вариант: один скрипт (macOS)

```bash
chmod +x scripts/first-push.sh
./scripts/first-push.sh ваш-github-username
# Затем: git push -u origin main
```

Скрипт: заменяет YOUR_USERNAME в README, добавляет remote, делает коммит. **Однократный** — прерывается, если remote или коммиты уже есть.

---

## Перед первым push (вручную)

### 1. Заменить YOUR_USERNAME в README

```bash
sed -i '' 's/YOUR_USERNAME/ваш-логин/g' README.md
grep -n "YOUR_USERNAME" README.md || echo "OK"
```

### 2. Проверить секреты

```bash
git ls-files | grep -E '\.env(\.|$)'
# Ожидаемо: пусто (env.example — ок)
```

### 3. .gitignore — уже содержит

- `.env`, `.env*.local`
- `node_modules/`, `.next/`, `.tmp/`
- `coverage/`, `/data/`

---

## После push

### 4. Создать labels (один раз, **до** создания Issues)

```bash
chmod +x scripts/create-github-labels.sh
./scripts/create-github-labels.sh ваш-логин/papa-app
```

### 5. Создать Issues (требует labels)

```bash
chmod +x scripts/create-github-issues.sh
./scripts/create-github-issues.sh ваш-логин/papa-app
```

### 6. Проверить CI

- Откройте Actions → workflow "CI" должен пройти
- Бейдж в README: имя workflow в URL — `ci.yml` (совпадает с `.github/workflows/ci.yml`)

---

## Branching

```bash
git checkout -b feature/US-5-admin-ui
# ... коммиты ...
git push -u origin feature/US-5-admin-ui
# PR → main
```

См. [BRANCHING_STRATEGY.md](BRANCHING_STRATEGY.md).

---

## GitHub Release (после P1)

```bash
chmod +x scripts/create-release.sh
./scripts/create-release.sh ваш-логин/papa-app v0.1.0
```
