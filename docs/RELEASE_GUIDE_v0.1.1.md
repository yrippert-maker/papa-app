# Release Guide v0.1.1

**Цель:** воспроизводимый выпуск с регуляторной трассируемостью.

---

## 1. Release gate (перед тэгом, ~2 мин)

```bash
npm test
npm run test:e2e
npm run build
npm run check:db-imports
```

**Локальный smoke:**
- `/admin/users` — «Загрузить ещё»
- `/api/admin/users?limit=2` — курсор
- `/api/files/list` или `/api/workspace/status` — readonly

---

## 2. Git: commit и аннотированный тег

**Проверить чистоту:**
```bash
git status
git diff --stat
```

**Коммит и тег (аннотированный — для аудита):**
```bash
git add .
git commit -m "chore: v0.1.1 release — US-7 pagination, US-8 SQLite safe mode"
git tag -a v0.1.1 -m "Release v0.1.1: US-7 pagination, US-8 SQLite safe mode"
```

**Проверка тега:**
```bash
git show v0.1.1 --no-patch
```

---

## 3. Публикация

```bash
git push origin main
git push origin v0.1.1
# или все теги:
# git push origin --tags
```

---

## 4. GitHub Release

```bash
./scripts/create-release.sh OWNER/REPO v0.1.1
```

Либо вручную: Create release → Tag v0.1.1 → вставить текст из [GITHUB_RELEASE_NOTES_v0.1.1.md](GITHUB_RELEASE_NOTES_v0.1.1.md).

---

## 5. Пост-релиз: артефакт

После успешного push зафиксировать в `docs/RELEASE_NOTES_v0.1.1.md` или `REGULATOR_PACKAGE.md`:

- **Commit hash:** `git rev-parse v0.1.1`
- **Runtime:** Node `node -v`, better-sqlite3 (из `package.json`)

Пример блока для добавления в release notes:
```markdown
## Release artifact (v0.1.1)
- Commit: `abc1234`
- Node: v20.x
- better-sqlite3: ^12.6.2
```
