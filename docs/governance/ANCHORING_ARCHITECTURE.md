# Anchoring Architecture (Variant B)

**Цель:** blockchain-based integrity без хранения данных на блокчейне.

## Что хранится

| Место | Данные |
|-------|--------|
| SQLite | Бизнес-данные, ledger_events (append-only), ledger_anchors |
| Object Storage (LocalStorageAdapter dev) | DOCX/PDF/фото, сгенерированные акты |
| Публичная сеть (будущее) | Только Merkle root (1 tx в сутки/неделю) |

## Схема

### ledger_events (расширено)

- `artifact_sha256`, `artifact_ref` — ссылка на артефакт
- `payload_c14n_sha256` — хэш канонического payload
- `signature`, `key_id` — подпись event_hash (Ed25519)
- `anchor_id` — FK на ledger_anchors (если заякорено)

### ledger_anchors

- `period_start`, `period_end` — период
- `merkle_root` — корень Merkle tree по event_hash (null для empty)
- `tx_hash`, `network`, `chain_id` — on-chain
- `status`: pending | confirmed | failed | empty (0 событий, не публикуется)

## API

### Proof API

- `GET /api/proof/event/:id` — event + signature + chain + anchor
- `GET /api/proof/artifact?sha256=` — события по артефакту
- `GET /api/proof/anchor/:id` — детали anchor

### Storage

- `lib/storage/` — LocalStorageAdapter (dev)
- Prod: S3StorageAdapter (MinIO/AWS S3)

## Скрипты

- `npm run anchoring:run` — создать anchor за вчера (0 events → status=empty)
- `npm run anchoring:run -- --period 2026-02-01` — за указанную дату
- `npm run anchoring:reconcile -- --from 2026-01-01 --to 2026-02-01` — проверить полноту; `--fix` создать пропуски

## Auditor Pack

- `anchors.json` — список anchors
- `events_subset.json` — события за квартал

## События в ledger (compliance)

- `DOC_ACCEPTED` — при Accept
- `DOC_REJECTED` — при Reject
- `PATCH_APPLIED` — при Apply
