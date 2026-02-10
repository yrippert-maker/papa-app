# Document Store — Storage layout (Portal storage, S3/GCS)

Документы хранятся как **версионируемые объекты** в S3/GCS. Layout соответствует Sprint M1 (Mail MVP).

## Бакет и префиксы

- **DOCS_BUCKET** — бакет для документов (можно общий с ledger или отдельный).
- **DOCS_PREFIX** = `docs-store` — префикс для документов.
- **DOCS_PROPOSALS_PREFIX** = `mail-proposals` — префикс для предложений изменений (proposals).
- **MAIL_EVENTS_PREFIX** = `mail-events` — префикс для событий почты (mail_event).
- **mail-ledger** и **doc-ledger** — в **LEDGER_BUCKET** (отдельный префикс).

## Пути документов

```
docs-store/
  finance/
    payments/
      latest.json
      versions/
        2026-02-03T10-15-00Z__<sha256>.json
        2026-02-03T12-40-11Z__<sha256>.json
  mura-menasa/
    handbook/
      latest.md
      versions/
        2026-02-03T10-20-00Z__<sha256>.md
```

- **latest.\*** — указатель на текущую версию (перезаписывается при approve).
- **versions/** — immutable история (никогда не перезаписывается).
- Рекомендуется **versioning** и при необходимости **object lock / retention** на бакете.

## Proposals и mail-events

```
docs-store/  (или тот же DOCS_BUCKET)
  mail-proposals/
    <proposal_id>.json

mail-events/
  YYYY/MM/DD/
    <mail_id>.json
```

## Ledger (в LEDGER_BUCKET)

```
mail-ledger/
  YYYY/MM/DD/
    <entry_sha256>.json

doc-ledger/
  _pending/
    config-mail-allowlist-<sha>.json   # prepare phase (internal)
  YYYY/MM/DD/
    config-mail-allowlist-<sha>.json   # config_change (allowlist)
    <entry_sha256>.json                # doc_update
```

## doc_id

- **finance/payments** — реестр платежей (JSON, append-only).
- **mura-menasa/handbook** — документация Mura Menasa (Markdown, append в секцию drafts).

См. также: [MAIL_MVP_SPEC.md](./MAIL_MVP_SPEC.md), [MAIL_MVP_SPRINT_M1.md](./MAIL_MVP_SPRINT_M1.md).
