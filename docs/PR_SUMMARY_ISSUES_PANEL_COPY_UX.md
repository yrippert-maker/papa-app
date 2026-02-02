# PR Summary: IssuesPanel Copy UX + CopyChip

## Overview

Production-grade copy UX for the Anchoring Issues panel: unified feedback, accessibility, and severity-based highlighting. Refactored into a shared `CopyChip` component.

## Changes

### New: `CopyChip` component
- **Path:** `app/governance/anchoring/_components/CopyChip.tsx`
- Reusable copy button: `Copy` / `✓` / `⚠︎` states
- Props: `copyKey`, `text`, `labelDefault`, `copyState`, `lockedKey`, `onCopy`
- Replaces inline `CopyButton` and `CopyLinkButton` in IssuesPanel

### New: barrel `_components/index.ts`
- Exports: `CopyChip`, `IssuesPanel`, `Modal`
- `AnchoringPage` imports from barrel

### New: unit test `__tests__/components/CopyChip.test.tsx`
- Shallow tests: label (✓/⚠︎), disabled by `lockedKey`, `onCopy` callback

### Updated: `IssuesPanel.tsx`
- Uses `CopyChip` for tx, anchor, and link copy actions
- Added TODO comment for optional full-card highlight on Copy link
- Wrapped issue cards in `React.Fragment` for comment placement

### Updated: `CHANGELOG_ANCHORING_2026-02_STEPS.md`
- Added **Step 5: Copy UX** — documented UX contract

## Copy UX Contract (unchanged)

- **States:** `Copy` / `✓` (ok) / `⚠︎` (error)
- **Accessibility:** `aria-live="polite"` + tooltip
- **Lock:** 1.5 s disabled, double-click protection
- **Highlight:** ok → critical=amber, major=emerald; error → rose
- **Animation:** Micro-bounce for ✓ (scale on label)

## Verification

- [x] `npm run lint` — no errors
- [x] `npm run build` — success
- [x] `npm test -- __tests__/components/CopyChip.test.tsx` — 7 passed
- [x] CopyChip used for tx, anchor, link
- [x] prestart-check.mjs unchanged

### Fixed: TS errors in __tests__
- `inspection-check-results.test.ts`: explicit `GetResult` type for mock `get`
- `inspection-report.test.ts`: explicit `DbGetResult` type for mock `get`
- `inspection-audit.test.ts`: cast `events` to `LedgerEventRow[]` for `verifyLedgerChain`

## Notes

- Full-card highlight on Copy link: intentionally disabled; see TODO in IssuesPanel

## Artifacts

- `docs/COMMIT_MESSAGE_ANCHORING_COPY_UX.txt` — squash commit (conventional)
- `docs/QA_CHECKLIST_ISSUES_PANEL.md` — manual QA checklist
