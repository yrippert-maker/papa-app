# Go-live Polygon anchoring — чеклист

Перед включением флагов в prod:

- [ ] Контракт задеплоен на Polygon mainnet, `contract_address` зафиксирован в docs
- [ ] Ключ publisher хранится в secure secrets (не в env файла на диске)
- [ ] RPC провайдер стабилен (rate limits / failover)
- [ ] `anchoring:run` отрабатывает при 0 events (создаёт empty anchor)
- [ ] Auditor pack verify проходит offline на sample anchor + receipt

Если всё так — можно включать `ANCHORING_PUBLISH_ENABLED` и `ANCHORING_CONFIRM_ENABLED`.

## После outage

Запустить reconcile:

```bash
npm run anchoring:reconcile -- --from 2026-01-01 --to 2026-02-01
npm run anchoring:reconcile -- --from 2026-01-01 --to 2026-02-01 --fix
```

`--fix` создаёт пропущенные anchors (anchoring:run). Publish и confirm — отдельно (governance cadence или вручную).
