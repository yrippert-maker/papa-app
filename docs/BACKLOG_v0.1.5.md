# BACKLOG — v0.1.5

## Goal

Extend verify UX and optionally further RBAC refinement. Build on v0.1.4 (StatePanel, clickable badges, TMC.VIEW, AI_INBOX.VIEW).

## Scope (in)

### A) Ledger Verify UI (recommended)

1. **Integrate Ledger verify into `/system/verify`**
   - Add section "Ledger integrity" with button "Verify Ledger"
   - Call `GET /api/ledger/verify`
   - Display result (OK / Failed) via StatePanel
   - Reuse existing verify page layout

2. **Or:** Dedicated `/system/ledger-verify` page (if separation preferred)

### B) Verify page enhancements

1. **Unified verify page** with tabs/sections:
   - AuthZ verification (current)
   - Ledger verification (new)
   - Optional: future checks

2. **StatusBadges:** Ledger badge could reflect last verify result (optional, requires state)

### C) Optional RBAC refinement

1. **TMC.REQUEST.MANAGE** — if write for requests is needed separately from VIEW
2. **INSPECTION.VIEW / INSPECTION.MANAGE** — when inspection module is implemented

### D) UX polish

1. **Loading state** for verify buttons (already done)
2. **Empty state** for pages without data (StatePanel empty variant)
3. **"Coming soon"** mode for future menu items (as discussed)

## Out of scope (explicit)

- New business domains
- AI autonomy changes
- DB schema migrations (unless for new features)

## Proposed PR breakdown

- **PR-1:** Ledger verify section on `/system/verify` (or dedicated page)
- **PR-2:** Verify page structure (tabs/sections) if needed
- **PR-3:** Optional RBAC/UX polish

## Definition of Done

- Auditor/admin can verify Ledger from UI (no console)
- AuthZ and Ledger verify results displayed consistently
- Evidence (LEDGER_VERIFY_RESULT in bundle) unchanged; runtime verify remains API
- Tests and build green

## Priority

1. **High:** Ledger verify UI (completes verify story)
2. **Medium:** Verify page structure (if UX requires)
3. **Low:** RBAC/UX polish
