# Package Schema — Evidence Kit & Bundles

**Версия:** 1.0  
**Назначение:** структура пакетов, обязательные артефакты, версии полей. Контракт для интеграций и аудита.

---

## 1. Evidence Kit Public Bundle

**Где:** `dist/evidence-kit-public-v1.0/`  
**Сборка:** `npm run evidence-kit:public` ([EVIDENCE_KIT_PUBLIC_BUNDLE.md](EVIDENCE_KIT_PUBLIC_BUNDLE.md))

| Файл | Обязателен | Описание |
|------|------------|----------|
| README.md | ✅ | Start here — навигация по пакету |
| evidence-kit-report-ru.md | ✅ | Краткий отчёт (RU) |
| evidence-kit-report-en.md | ✅ | Executive summary (EN) |
| evidence-kit-report-ru.pdf | ❌ | PDF (если установлен md-to-pdf) |
| evidence-kit-report-en.pdf | ❌ | PDF (если установлен md-to-pdf) |
| demo-pack.zip | ✅ | Demo Compliance Package |
| demo-pack.zip.sha256 | ✅ | SHA-256 контрольная сумма |
| regulatory-bundle-&lt;tag&gt;.zip | ✅ | Regulatory submission bundle |
| regulatory-bundle-&lt;tag&gt;.zip.sha256 | ✅ | SHA-256 контрольная сумма |

**Формат .sha256:** `{hex}  {filename}\n`

---

## 2. Regulatory Bundle (ZIP)

**Где:** `dist/regulatory-bundle-<tag>.zip`  
**Сборка:** `npm run bundle:regulatory` ([REGULATORY_BUNDLE_MANIFEST.md](REGULATORY_BUNDLE_MANIFEST.md))

### Обязательные файлы (корень ZIP)

| Путь | Описание |
|------|----------|
| MANIFEST.txt | Машиночитаемый манифест: path, size_bytes, sha256, generated_at_utc |
| BUNDLE_FINGERPRINT.md | Точка входа: tag, commit, verification protocol |
| LEDGER_VERIFY_RESULT.txt | JSON Schema v1 — результат проверки ledger |
| AUTHZ_VERIFY_RESULT.txt | JSON Schema v1 — результат проверки route registry |

### Обязательные docs/

| Путь | Описание |
|------|----------|
| docs/REGULATOR_PACKAGE.md | Единая точка входа |
| docs/ENDPOINT_AUTHZ_EVIDENCE.md | Endpoint → Permission → Roles |
| docs/REGULATORY_BUNDLE_MANIFEST.md | Манифест содержимого |

### Опциональные (supporting)

| Путь | Описание |
|------|----------|
| 07_UI_EVIDENCE/not-found-page.png | Screenshot NotFoundPage (supporting evidence) |

**MANIFEST.txt:** все файлы в ZIP должны быть перечислены; `sha256_manifest` — hash содержимого манифеста до строки sha256_manifest.

---

## 3. Demo Pack (ZIP)

**Где:** внутри `demo-pack.zip` (распакованная структура)  
**Сборка:** `npm run compliance:demo:from-pack` ([build-demo-compliance-package.mjs](../scripts/build-demo-compliance-package.mjs))

### Структура каталогов

| Каталог | Обязателен | Содержимое |
|---------|------------|------------|
| 00_README_REGULATOR.md | ✅ | Навигация, integrity self-check |
| 00_PACKAGE_STATUS.json | ✅ | verification_status, built_at, source |
| 00_TOOLCHAIN.md | ✅ | Команды верификации |
| 01_EXECUTIVE/ | ✅ | compliance-report.md, report-manifest.json |
| 02_DECISION/ | ✅ | decision-record.json |
| 03_VERIFICATION/ | ✅ | verify-summary.json, verify-policy.json |
| 04_LEDGER/ | ❌ | ledger-entry.json, anchor-receipt.json |
| 05_PACK/ | ✅ | audit-pack.zip |
| 06_TEMPORAL/ | ❌ | Решения на разные даты (T1/, T2/) |
| 99_HASHES/ | ✅ | checksums.sha256, index.json |

### Обязательные поля 00_PACKAGE_STATUS.json

| Поле | Тип | Описание |
|------|-----|----------|
| verification_status | string | PASS \| FAIL \| WARN \| UNKNOWN |
| built_at | string | ISO 8601 |
| source.pack_sha256 | string | SHA-256 audit-pack.zip |

### Обязательные поля 99_HASHES/index.json

| Поле | Тип | Описание |
|------|-----|----------|
| schema_version | number | 1 |
| generated_at | string | ISO 8601 |
| artifacts | array | { path, sha256 }[] |

### Внешний .sha256 (рядом с ZIP)

`demo-pack.zip.sha256`: `{hex}  demo-pack.zip\n`

---

## 4. Версионирование

| Артефакт | Поле версии | Правило |
|----------|-------------|---------|
| AUTHZ_VERIFY_RESULT.txt | schema_version: 1 | Несовместимое изменение → increment |
| LEDGER_VERIFY_RESULT.txt | schema_version: 1 | Несовместимое изменение → increment |
| 99_HASHES/index.json | schema_version: 1 | Несовместимое изменение → increment |
| PACKAGE_SCHEMA.md | Заголовок "Версия" | Ручное обновление при изменении контракта |

---

## 5. AI Agent — supported templateKey (v1.1)

| templateKey | Файл | Описание |
|-------------|------|----------|
| act | act.docx | Акт (входной/выходной контроль) |
| letter | letter.docx | Письмо |
| techcard | techcard.docx | Технологическая карта (steps, acceptance_criteria, sms_requirements) |

Draft API и Export API принимают `intent` / `templateKey` из этого перечня.

---

## 6. Связанные документы

- [EVIDENCE_KIT_PUBLIC_BUNDLE.md](EVIDENCE_KIT_PUBLIC_BUNDLE.md) — сборка Public Bundle
- [REGULATORY_BUNDLE_MANIFEST.md](REGULATORY_BUNDLE_MANIFEST.md) — полный манифест regulatory bundle
- [plans/EVIDENCE_KIT_MONETIZATION_ROADMAP.md](plans/EVIDENCE_KIT_MONETIZATION_ROADMAP.md) — roadmap (Versioned Schema Docs)
