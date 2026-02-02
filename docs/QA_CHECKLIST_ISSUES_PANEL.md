# QA Checklist: IssuesPanel Copy UX

## Quick (post-merge)

- [ ] Copy tx / anchor / link → ✓ / ⚠︎
- [ ] Disabled 1.5s after click
- [ ] Screen reader announcement (if testing a11y)
- [ ] prestart-check blocks `next start` without build

**Follow-up:** Full-card highlight for "Copy link" — separate UX decision (see TODO in IssuesPanel).

---

## Full

### Pre-requisites

- [ ] `npm run build` completed successfully
- [ ] `npm run start` (or dev server on port 3001)
- [ ] Navigate to `/governance/anchoring`

---

## 1. Panel open / load

- [ ] Click "View issues (30d)" — modal opens
- [ ] Issues load (or "No issues" / error message)
- [ ] "Reload" button works
- [ ] "Reset" clears filters

---

## 2. Copy tx / anchor (when present)

- [ ] Click "Copy" next to tx hash → label becomes **✓**, tx block highlights (amber or emerald)
- [ ] After ~1.5 s → label returns to "Copy", highlight fades
- [ ] Paste in notepad → correct hash
- [ ] Click "Copy" next to anchor ID → same behavior
- [ ] Button disabled during 1.5 s (no double-click)

---

## 3. Copy link

- [ ] Click "Copy link" → label becomes **✓**
- [ ] Paste → URL opens correct issue
- [ ] Disabled 1.5 s after click

---

## 4. Copy error (optional)

- [ ] In Safari / non-secure context / blocked clipboard: click Copy
- [ ] Label shows **⚠︎**, tooltip "Copy failed"
- [ ] Block highlights rose (error state)
- [ ] No console errors, no global alert

---

## 5. Filters

- [ ] "Critical only" — filters correctly
- [ ] "Hide gaps" — hides GAP_IN_PERIODS
- [ ] Search box — filters by type, severity, message, tx, anchor, period
- [ ] "Showing X of Y" updates

---

## 6. prestart guard

- [ ] `rm -rf .next && npm run start` → error, exit 1
- [ ] `npm run build && npm run start` → starts
- [ ] `SKIP_PRESTART_CHECK=1 npm run start` (without build) → starts (if .next exists from prior build)

---

## 7. Accessibility (screen reader)

- [ ] Copy success → announces "Copied to clipboard"
- [ ] Copy fail → announces "Copy failed"
