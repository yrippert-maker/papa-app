# Anchoring на Polygon — настройка

## Выбор: offline (A)

Аудиторская проверка **строго offline** — receipt включается в pack, RPC не нужен.

## Параметры сети

| Окружение | network | chain_id |
|-----------|---------|----------|
| Prod | polygon | 137 |
| Dev | polygon-amoy | 80002 |

## Env (production)

```
ANCHOR_NETWORK=polygon
ANCHOR_CHAIN_ID=137
ANCHOR_RPC_URL=...
ANCHOR_CONTRACT_ADDRESS=0x...
ANCHOR_PUBLISHER_PRIVATE_KEY=...   # только в secrets
ANCHOR_CONFIRMATIONS=20

# Feature flags (включить publish/confirm только в prod)
ANCHORING_PUBLISH_ENABLED=true
ANCHORING_CONFIRM_ENABLED=true
```

## Period policy (daily)

- Период: UTC 00:00:00 — 23:59:59
- **0 событий**: anchor создаётся (status=empty, merkle_root=null), **не публикуется** on-chain
- Детерминизм: leaves сортируются по event_hash; sha256(min||max); odd leaves дублируются

## CLI

- `npm run anchoring:run` — создать anchor (idempotent)
- `npm run anchoring:publish -- --latest` — опубликовать в Polygon (требует viem + env)
- `npm run anchoring:confirm -- --latest` — подтвердить по receipt, сохранить в anchor-receipts/
- `npm run anchoring:reconcile -- --from 2026-01-01 --to 2026-02-01` — проверить полноту anchors за период, предложить догнать пропуски

## CI

Publish/confirm выполняются только при `ANCHORING_PUBLISH_ENABLED=true` и `ANCHORING_CONFIRM_ENABLED=true` (env workflow). Без флагов — no-op.
