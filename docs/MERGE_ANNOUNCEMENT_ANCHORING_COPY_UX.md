# Merge / Release Announcements — Anchoring Copy UX

Копируй в нужный формат.

---

## GitHub / GitLab — Merge Comment

```
## feat(governance): add unified copy UX to anchoring issues panel

### Summary
Production-grade copy UX for the Anchoring Issues panel: unified feedback, accessibility, severity-based highlighting.

### Added
- **CopyChip** — reusable component for tx / anchor / link copy
- Copy states: `Copy` → ✓ (ok) / ⚠︎ (error), 1.5s lock, aria-live
- Severity-based highlight: critical→amber, major→emerald, error→rose
- **prestart-check.mjs** — blocks `next start` without build artifacts
- Barrel `_components/index.ts`, unit test CopyChip

### Fixed
- TS errors in inspection test mocks

### QA
- Copy tx / anchor / link → ✓ / ⚠︎
- Disabled 1.5s after click
- prestart-check blocks start without build

Merge-ready. Regression-risk: low.
```

---

## Slack

```
🚀 *Anchoring Governance UX* — merged

• Copy tx / anchor / link в Issues panel: единый UX (✓ / ⚠︎), 1.5s lock, a11y
• prestart-check: блокирует `next start` без build
• CopyChip component, unit tests

Regression-risk: low. QA checklist: `docs/QA_CHECKLIST_ISSUES_PANEL.md`
```

---

## Notion — Release Note Block

**Title:** Anchoring Governance — Copy UX

**Body:**

| Section | Content |
|---------|---------|
| **Added** | Copy actions for tx hash, anchor ID, issue deep-link. Unified feedback (✓ / ⚠︎), 1.5s lock, clipboard fallback, aria-live. CopyChip component. prestart-check guard. |
| **Improved** | Severity-based highlight (critical→amber, major→emerald, error→rose). Consistent copy feedback across all fields. |
| **Fixed** | TS errors in inspection test mocks. Prevented `next start` without build. |
| **Scope** | `/governance/anchoring` — Issues panel |
| **Risk** | Low |

---

## Jira — Release / Version Comment

```
feat(governance): Anchoring Copy UX

ADDED:
- Copy tx/anchor/link in Issues panel (CopyChip)
- Visual feedback: ✓ / ⚠︎, 1.5s lock, severity highlight
- prestart-check: block next start without build
- Unit test CopyChip, barrel _components

FIXED:
- TS errors in __tests__ (inspection mocks)

QA: Copy tx/anchor/link → ✓/⚠︎, disabled 1.5s, prestart guard.
Regression: low.
```

---

## One-liner (changelog / tag)

```
feat(governance): add unified copy UX to anchoring issues panel — CopyChip, prestart-check, a11y
```
