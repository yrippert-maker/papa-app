# Release Checklist v0.1.0

Перед созданием GitHub Release выполнить по пунктам.

---

## Безопасность

- [ ] `admin@local` с паролем `admin` заменён или удалён (или не в production)
- [ ] `NEXTAUTH_SECRET` задан (не default)
- [ ] `WORKSPACE_ROOT` задан явно
- [ ] `E2E_MODE` не установлен
- [ ] `npm audit` — статус зафиксирован (известные — в roadmap)

---

## Функциональность

- [ ] `npm run migrate` — миграции применены
- [ ] `npm run seed:admin` — первый admin создан (или через Admin UI)
- [ ] Логин: admin@local (или иной) → дашборд
- [ ] Логин: auditor@local → только read, 403 на write
- [ ] Страницы: дашборд, ТМЦ, заявки, workspace, AI Inbox — открываются

---

## Тесты и CI

- [ ] `npm test` — все unit-тесты проходят
- [ ] `npm run test:e2e` — E2E smoke проходит
- [ ] GitHub Actions CI — зелёный

---

## Документация

- [ ] README — актуальный, YOUR_USERNAME заменён
- [ ] [SECURITY_POSTURE.md](SECURITY_POSTURE.md) — пройден checklist
- [ ] [ARCHITECTURE_OVERVIEW.md](ARCHITECTURE_OVERVIEW.md) — актуален

---

## Релиз

- [ ] Коммиты в `main` стабильны
- [ ] `./scripts/create-release.sh owner/papa-app v0.1.0` выполнен
- [ ] Release notes содержат ссылки на SECURITY_POSTURE, ARCHITECTURE_OVERVIEW

---

## После релиза

- [ ] Tag `v0.1.0` создан
- [ ] Release виден на GitHub
- [ ] Команда уведомлена
