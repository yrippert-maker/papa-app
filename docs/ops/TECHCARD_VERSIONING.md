# Версионирование техкарт (NFR-3.2)

## Обзор

Техкарты и акты подлежат версионированию для аудита. Политика хранения: 10 лет (config/retention-policy.json).

## Реализация

- **draftFields.version** — версия в формате X.Y (например 1.0), заполняется при создании черновика
- **agent_generated_documents** — при DATABASE_URL сохраняется output_sha256, audit_meta, output_docx_path
- **ledger** — события AGENT_EXPORT с sha256, actor, timestamp
- **PRODUCTION_DOCS_STORAGE** — структура папок по изделию/типу/периоду

## Рекомендации

1. При сохранении техкарты указывать version в draftFields
2. Имя файла может включать версию: `{product}_{operation}_v{version}.docx`
3. Использовать config/retention-policy.json для политики хранения 10 лет
