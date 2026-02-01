# Regulatory Submission Checklist

**Назначение:** порядок и состав передачи пакета регулятору/аудитору.

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

Краткий пример:
```
Регуляторная передача: ПАПА v0.1.4

Артефакт: regulatory-bundle-v0.1.4.zip
SHA-256: <из вывода shasum>
Tag: v0.1.4
Commit: <SHA под тегом>
Дата: YYYY-MM-DD

Порядок проверки: см. BUNDLE_FINGERPRINT.md внутри zip.
```
