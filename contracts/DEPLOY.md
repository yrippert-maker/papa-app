# AnchorRegistry — Deploy

## Сеть: Polygon (chainId 137)

### Шаги деплоя

1. Скомпилировать: `npx hardhat compile` (если есть Hardhat) или через Remix.
2. Deploy с `_owner` = адрес publisher (ваш кошелёк).
3. Зафиксировать в репо:
   - `contract_address`
   - `chain_id`: 137
   - `deployed_at`
   - `owner_address`
   - tx hash деплоя (evidence)

### Env (production)

```
ANCHOR_NETWORK=polygon
ANCHOR_CHAIN_ID=137
ANCHOR_RPC_URL=...
ANCHOR_CONTRACT_ADDRESS=0x...
ANCHOR_PUBLISHER_PRIVATE_KEY=...   # только в secrets, не в repo
ANCHOR_CONFIRMATIONS=20
ANCHOR_HASH_ALGO=sha256
```

### Смена owner

`transferOwnership(newOwner)` — только current owner.
