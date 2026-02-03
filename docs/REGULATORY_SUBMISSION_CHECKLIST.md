# Regulatory Submission Checklist

**Назначение:** порядок и состав передачи пакета регулятору/аудитору.

**Audit-grade baseline:** v1.0.0 — первый baseline; **v1.0.1** — финальный baseline (full delivery). Пакет должен быть собран на **чистом** дереве (без `ALLOW_DIRTY`). См. [AUDIT_GRADE_STATUS.md](AUDIT_GRADE_STATUS.md).

---

## 1. Что прикладывать (в порядке приоритета)

| # | Артефакт | Описание | Обязательность |
|---|----------|----------|----------------|
| 1 | `regulatory-bundle-<tag>.zip` | Полный пакет (20 файлов) | Обязательно |
| 2 | Zip SHA-256 | Контрольная сумма zip | Рекомендуется (в сопроводительном письме) |
| 3 | Release tag | Напр. `v0.1.4` | Обязательно |
| 4 | Commit SHA | SHA коммита под тегом | Обязательно |
| 5 | Runtime fingerprint | OS, Node.js, SQLite (см. RELEASE_NOTES) | По запросу |

---

## 2. Порядок передачи

1. **Сопроводительное письмо** (если требуется):
   - Release tag
   - Zip SHA-256
   - Дата генерации
   - Контакт ответственного

2. **Артефакт:** `regulatory-bundle-v0.1.4.zip` (или актуальный tag)

3. **Проверки для регулятора** (см. Verification protocol в BUNDLE_FINGERPRINT.md):
   - Распаковать zip
   - Проверить `sha256_manifest` в MANIFEST.txt
   - Открыть BUNDLE_FINGERPRINT.md как точку входа
   - Проверить LEDGER_VERIFY_RESULT.txt и AUTHZ_VERIFY_RESULT.txt

---

## 3. Verification protocol (внутри bundle)

1. `shasum -a 256 regulatory-bundle-<tag>.zip` — сравнить с заявленным SHA-256
2. Распаковать
3. Для каждого файла из MANIFEST.txt: `shasum -a 256 <path>` — сравнить с указанным sha256
4. Открыть [REGULATOR_PACKAGE.md](REGULATOR_PACKAGE.md) как точку входа
5. Ledger: bundle включает LEDGER_VERIFY_RESULT.txt. Целостность подтверждена ТОЛЬКО если `ledger_verification.executed = true` и `ledger_verification.ledger_ok = true`
6. AuthZ: bundle включает AUTHZ_VERIFY_RESULT.txt. AuthZ подтверждена ТОЛЬКО если `authz_verification.executed = true` и `authz_verification.authz_ok = true`

---

## 3.1 Записать SHA-256 после сборки на чистом дереве

После сборки без `ALLOW_DIRTY` записать SHA-256 в сопроводительное письмо и (опционально) в этот чеклист:

```bash
git status   # дерево должно быть чистым
npm run bundle:regulatory   # или: bash scripts/create-regulatory-bundle.sh v1.0.1
shasum -a 256 dist/regulatory-bundle-v1.0.1.zip
```

Пример записи для v1.0.1: `SHA-256 (regulatory-bundle-v1.0.1.zip): <значение>`.

**Записанный SHA (v1.0.1, чистый дерево):** `b63972e0175bb74af1a77e4c7fe87b7b073221fb1990c2cf4f307a6d2cbf168e`

---

## 4. Требования к bundle

- **MUST** быть собран из чистого checkout тега (см. RELEASE_GUIDE)
- **MUST NOT** использовать `ALLOW_DIRTY`
- **MUST** содержать ровно 20 файлов (см. REGULATORY_BUNDLE_MANIFEST.md)
- **MUST** содержать `sha256_manifest` в MANIFEST.txt
- **MUST** содержать `working_tree_clean: true` в MANIFEST.txt (при корректной сборке)

---

## 5. Сопроводительное письмо

Шаблоны (заполнить placeholder'ы):
- [REGULATORY_COVER_LETTER_RU.md](REGULATORY_COVER_LETTER_RU.md) — русский
- [REGULATORY_COVER_LETTER_EN.md](REGULATORY_COVER_LETTER_EN.md) — английский

Краткий пример (v1.0.1 — финальный baseline):
```
Регуляторная передача: ПАПА v1.0.1

Артефакт: regulatory-bundle-v1.0.1.zip
SHA-256: <записать после: git checkout v1.0.1 && npm run bundle:regulatory && shasum -a 256 dist/regulatory-bundle-v1.0.1.zip>
Tag: v1.0.1
Commit: <SHA под тегом>
Дата: YYYY-MM-DD

Порядок проверки: см. BUNDLE_FINGERPRINT.md внутри zip.
```
Аналогично для v1.0.0 и других тегов.
