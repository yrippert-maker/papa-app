# Anchoring Hardening — acceptance checklist

## A. Ledger invariants

- **Append-only на уровне БД**: триггеры запрещают UPDATE/DELETE на `ledger_events` (migration 010).
- **Event hash chain**: `prev_hash` и `block_hash` непрерывны; `getEventProof()` проверяет через `verifyLedgerChain`.
- **Canonical payload**: `payload_c14n_sha256` — sorted keys через `canonicalJSON` (lib/ledger-hash).
- **key_id registry**: верификация Ed25519 по `key_id` → trust anchors / keys.

## B. Merkle determinism

- Лист = `event_hash`; сортировка лексикографическая.
- `sha256(min||max)`; odd leaves дублируются.
- Зафиксировано в ledger-anchoring-service и docs.

## C. Anchor idempotency

- `createAnchor()` возвращает существующий при повторном вызове.
- UNIQUE(period_start, period_end).
- `publishAnchor()`: не отправляет tx при events_count=0 или status=empty; идемпотент при confirmed.
- `confirmAnchor()`: идемпотент при confirmed.

## D. On-chain verification (offline)

- verify проверяет receipt: `to == contract_address`, `status == 0x1`.
- `receipts_manifest.json`: tx_hash → sha256; verify проверяет integrity перед парсингом.
- `contract.json`: ABI event + chain_id + address.

## E. Feature flags

- `ANCHORING_PUBLISH_ENABLED=true` — включать publish.
- `ANCHORING_CONFIRM_ENABLED=true` — включать confirm.
- CI: шаги выполняются только при secrets с этими значениями.

## F. Period policy

- 0 событий: anchor создаётся (status=empty, merkle_root=null, events_count=0), **не публикуется** on-chain.
