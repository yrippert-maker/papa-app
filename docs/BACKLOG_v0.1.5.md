# BACKLOG — v0.1.5

## Goal

Extend verify UX. Build on v0.1.4 (StatePanel, clickable badges, TMC.VIEW, AI_INBOX.VIEW).

## Scope (in) — tightened

### A) Ledger Verify UI ✅ DONE (PR-1)

- [x] Section "Ledger integrity" on `/system/verify`
- [x] Button "Verify ledger", call `GET /api/ledger/verify`
- [x] Display OK / Failed / Skipped / Rate limit via StatePanel
- [x] Scope: event_count, id_min, id_max, timing_ms
- [x] Permission: LEDGER.READ (section gated)
- [x] API extended: scope + timing_ms + Cache-Control: no-store

### B) Verify page — DONE (A covers it)

Unified page with AuthZ + Ledger sections. No tabs needed for current scope.

### C) Optional (defer to v0.1.6+)

- **TMC.REQUEST.MANAGE** — only when request write flows exist
- **INSPECTION.VIEW / INSPECTION.MANAGE** — only when inspection module exists
- **StatusBadges** reflecting last verify result — adds state complexity; defer

### D) UX polish — minimal

- Empty state (StatePanel empty variant) — apply where missing
- "Coming soon" for future menu items — when new items are added

## Out of scope (explicit)

- New business domains
- AI autonomy changes
- Aggregator `/api/system/verify` (AuthZ + Ledger in one call) — not needed
- StatusBadges live result — deferred

## v0.1.5 Release scope (recommended)

- **Include:** PR-1 (Ledger Verify UI) ✅
- **Exclude:** C, D — move to v0.1.6 or later
- **Freeze:** v0.1.5 as "verify-complete" after PR-1

## Definition of Done v0.1.5

- [x] Ledger verify UI on /system/verify
- [x] AuthZ + Ledger sections, separate buttons, StatePanel
- [ ] Tests and build green
- [ ] Release v0.1.5
