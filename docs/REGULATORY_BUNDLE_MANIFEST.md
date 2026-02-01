# Regulatory Submission Bundle — Manifest

**Версия:** v0.1.1  
**Назначение:** пакет документов для передачи регулятору/аудитору.

---

## Содержимое (16 файлов)

Все файлы из списка ниже + MANIFEST.txt + BUNDLE_FINGERPRINT.md + LEDGER_VERIFY_RESULT.txt. Итого **16 файлов** в zip.

| # | Файл | Описание |
|---|------|----------|
| 1 | docs/REGULATOR_PACKAGE.md | Единая точка входа; ответы на типовые вопросы; SQLite Safe Mode |
| 2 | docs/RESPONSIBILITY_MATRIX.md | Роли, действия, запреты, юридическая ответственность, аудит |
| 3 | docs/RELEASE_NOTES_v0.1.1.md | Release notes; Runtime fingerprint |
| 4 | docs/ENDPOINT_DB_EVIDENCE.md | Endpoint→DB mode→роль→evidence |
| 5 | docs/SECURITY_POSTURE.md | Безопасность, чеклист production |
| 6 | docs/ARCHITECTURE_OVERVIEW.md | Архитектура системы |
| 7 | docs/AUDIT_LOG_SCHEMA.md | Схема audit log (SQLite/WAL) |
| 8 | docs/RELEASE_GUIDE_v0.1.1.md | Release gate, tag, push |
| 9 | docs/GITHUB_RELEASE_NOTES_v0.1.1.md | Шаблон для GitHub Release |
| 10 | docs/DEMO_TABLE_M1_M2.md | Acceptance criteria M1/M2 |
| 11 | docs/ADR-002_SQLite_to_PostgreSQL.md | ADR: миграция SQLite→Postgres |
| 12 | docs/ADR-003_Adapter_Contracts.md | ADR: контракты адаптеров |
| 13 | docs/REGULATORY_BUNDLE_MANIFEST.md | Этот файл |
| 14 | MANIFEST.txt | Машиночитаемый манифест (path, size, sha256) |
| 15 | BUNDLE_FINGERPRINT.md | Точка входа: tag, commit, verify |
| 16 | LEDGER_VERIFY_RESULT.txt | Evidence: результат проверки hash-chain ledger (JSON Schema v1, генерируется при сборке) |

**Правило включения:** в zip попадают ровно эти 16 файлов.

### LEDGER_VERIFY_RESULT.txt — JSON Schema v1

Файл содержит один JSON-объект. Кодировка UTF-8.

| Поле | Описание |
|------|----------|
| `schema_version` | Версия схемы (1) |
| `release` | tag, commit, generated_at_utc |
| `bundle_ok` | Всегда `true` — сборка bundle успешна |
| `ledger_verification` | Результат проверки |
| `ledger_verification.executed` | Выполнялась ли проверка |
| `ledger_verification.skipped` | Пропущена ли (нет БД, нет таблицы) |
| `ledger_verification.ledger_ok` | `true` — целостность подтверждена; `false` — нарушена; `null` — не выполнялась |
| `ledger_verification.message` | Человекочитаемый итог |
| `ledger_verification.db.db_mode` | Всегда `"readonly"` (safe mode) |
| `ledger_verification.db.db_source` | `e2e` \| `data` \| `none` \| `unknown` |
| `ledger_verification.scope` | table, order_by, event_count, id_min, id_max |

**Инварианты:** если `skipped=true` → `executed=false`, `ledger_ok=null`; если `executed=true` → `ledger_ok` ∈ {true, false}.

---

## Порядок чтения (рекомендуемый)

1. REGULATOR_PACKAGE.md
2. RESPONSIBILITY_MATRIX.md
3. RELEASE_NOTES_v0.1.1.md (Runtime fingerprint)
4. ENDPOINT_DB_EVIDENCE.md
5. SECURITY_POSTURE.md

---

## Verification protocol (для регулятора)

1. Проверить sha256 zip (если опубликован отдельно): `shasum -a 256 regulatory-bundle-v0.1.1.zip`
2. Распаковать
3. Проверить sha256 каждого файла по MANIFEST.txt (path, size, sha256)
4. Открыть BUNDLE_FINGERPRINT.md → REGULATOR_PACKAGE.md как точку входа
5. LEDGER_VERIFY_RESULT.txt — evidence проверки целостности hash-chain (генерируется при сборке bundle)

---

## Создание bundle

```bash
./scripts/create-regulatory-bundle.sh [tag]
```

- Требует чистый git (no uncommitted changes)
- Выход: `dist/regulatory-bundle-<tag>.zip`
