# BACKLOG — v0.1.6

## Goal

Verify aggregator: one request returns AuthZ + Ledger snapshot. Reduce N calls to 1 for `/system/verify` page.

## Scope (in)

### PR-1: Endpoint + aggregation ✅

- [x] `GET /api/system/verify`
- [x] Permission: WORKSPACE.READ; ledger included only if LEDGER.READ
- [x] Reuse `runAuthzVerification` and ledger logic
- [x] Response: authz_verification + ledger_verification + timing_ms
- [x] Rate limit, Cache-Control: no-store
- [x] Route registry, ENDPOINT_AUTHZ_EVIDENCE, docs/verify-aggregator.md

### PR-2: UI migration ✅

- [x] Replace 2 calls (authz + ledger) with 1 aggregator call on `/system/verify`
- [x] One "Verify" button, timeout 15s, in-flight guard
- [x] ledger_verification.skipped → "Ledger verification skipped" (warning, not error)
- [x] 429 → "Rate limit — попробуйте позже" + Retry

### PR-3: Tests ✅

- [x] Unit: aggregator response shape, permission branches, overall ok logic
- [x] E2E: auditor (WORKSPACE.READ + LEDGER.READ) → 200, ledger included
- [x] Authz routes sync (route_count 15)
- [x] Migration script fix: re-open db after .mjs migration
- [x] Jest config: --runInBand to avoid worker timeout
- [x] API routes: TMC items/lots use TMC_VIEW (not TMC_MANAGE)

## Out of scope

- scope/include/consistency query params (simplified v1)
- Caching, ETag (defer)
- OpenAPI (defer)

## Definition of Done v0.1.6

- [x] `GET /api/system/verify` returns combined snapshot
- [x] Tests green, route count 15
- [x] E2E passes with verify aggregator
- [ ] Release v0.1.6
