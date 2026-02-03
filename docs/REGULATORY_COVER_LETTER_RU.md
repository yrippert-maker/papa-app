# Сопроводительное письмо — Регуляторная передача ПАПА

**Дата:** _________________  
**Версия:** [RELEASE_TAG]  
**Контакт:** _________________

---

Уважаемые коллеги,

Направляем регуляторный пакет программного обеспечения **ПАПА** (Программа автоматизации производственной аналитики).

## Артефакты

| Параметр | Значение |
|----------|----------|
| **Артефакт** | regulatory-bundle-[RELEASE_TAG].zip |
| **SHA-256** | [ZIP_SHA256] |
| **Tag** | [RELEASE_TAG] |
| **Commit** | [COMMIT_SHA] |
| **sha256_manifest** | [SHA256_MANIFEST] |
| **Дата генерации** | _________________ |

## Порядок проверки

См. [REGULATORY_SUBMISSION_CHECKLIST.md](REGULATORY_SUBMISSION_CHECKLIST.md) (verification protocol).

1. Проверить SHA-256 zip: `shasum -a 256 regulatory-bundle-[RELEASE_TAG].zip`
2. Распаковать архив
3. Открыть `BUNDLE_FINGERPRINT.md` — точка входа с протоколом верификации
4. Сверить файлы по `MANIFEST.txt` (sha256)

## Содержимое

Пакет содержит 20 файлов: документация (AUTHZ_MODEL, ENDPOINT_EVIDENCE, SECURITY_POSTURE и др.), release notes, evidence (`LEDGER_VERIFY_RESULT.txt`, `AUTHZ_VERIFY_RESULT.txt`). Полный перечень — в `REGULATORY_BUNDLE_MANIFEST.md`.

## Ответственность

Система — инструмент; решения принимает оператор. AI — advisory only. Human-in-the-loop сохранён.

С уважением,  
_________________
