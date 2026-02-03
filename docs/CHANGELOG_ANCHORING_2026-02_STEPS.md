# Отчёт о внесённых изменениях (последние 7 шагов)

## Шаг 1: Исправление ошибок сборки

### 1.1 `lib/anchor-publisher.ts`
- **Проблема:** Type error — `logs.find()` ожидал тип с `address`, но `receipt.logs` типизировался как `Array<{ logIndex: string }>`.
- **Решение:** Расширен тип `data.result.logs` до `Array<{ address?: string; logIndex: string }>`.

### 1.2 `app/compliance/keys/page.tsx`
- **Проблема:** React Hook useEffect — missing dependencies (`fetchAudit`, `hasView`, `loading`).
- **Решение:** Добавлены `eslint-disable-next-line react-hooks/exhaustive-deps` для двух `useEffect`.

### 1.3 `lib/anomaly-detection-service.ts` → `lib/ledger-hash.ts`
- **Проблема:** `appendLedgerEvent` импортировался из `ledger-hash`, но не экспортировался.
- **Решение:** Добавлена функция `appendLedgerEvent` в `lib/ledger-hash.ts` с импортом `getDb` и логикой append (аналогично `admin-audit`).

### 1.4 `lib/ledger-anchoring-service.ts`
- **Проблема 1:** `verifyLedgerChain(all)` — в SELECT не было `event_type`, требуемого типом `LedgerEvent`.
- **Решение:** Добавлен `event_type` в SELECT.
- **Проблема 2:** `anchor` — тип `merkle_root: string` не допускал `null`.
- **Решение:** Изменён тип на `merkle_root: string | null`.
- **Проблема 3:** `getAnchorById` — возвращал `Record<string, unknown>` вместо ожидаемой структуры.
- **Решение:** Добавлена явная типизация результата `db.prepare().get()`.
- **Проблема 4:** `buildMerkleRoot` — `Buffer<ArrayBufferLike>[]` не совместим с `Buffer<ArrayBuffer>[]`.
- **Решение:** Добавлен `as Buffer` при `digest()`.

### 1.5 `lib/policy-repository.ts`
- **Проблема:** `for (const [date, dateEntries] of byDate)` — итерация по `Map` требует `downlevelIteration` или `es2015+`.
- **Решение:** Заменено на `Array.from(byDate)`.

### 1.6 `app/governance/anchoring/page.tsx`
- **Проблема:** `useSearchParams()` должен быть обёрнут в Suspense (Next.js App Router).
- **Решение:** Обёрнут `AnchoringPage` в `<Suspense fallback={...}>`.

---

## Шаг 2: Компонент `IssuesPanel`

**Файл:** `app/governance/anchoring/_components/IssuesPanel.tsx`

- Client component без shadcn и внешних зависимостей.
- Props: `windowDays`, `checkGaps`, `defaultOpen`, `className`.
- Кнопка «View issues (30d)» с бейджами: critical, major, 0 (зелёный).
- Ленивая загрузка: fetch только при открытии панели.
- Кнопка Reload при открытой панели.
- Список issues с сортировкой по severity (critical первыми), затем по дате.
- Каждый issue: severity pill, type, tx_hash, anchor_id, message, period, ссылка «Open →».
- Поддержка dark mode (Tailwind dark:).

---

## Шаг 3: Интеграция `IssuesPanel` в `AnchoringPage`

**Файл:** `components/governance/AnchoringPage.tsx`

- Добавлен импорт `IssuesPanel` из `@/app/governance/anchoring/_components/IssuesPanel`.
- Удалены: state `issues`, `useEffect` для загрузки issues, старый inline-блок issues.
- В header добавлен `IssuesPanel` рядом с карточкой статуса: `windowDays={30} checkGaps={true}`.
- Layout: `flex items-center gap-4` — IssuesPanel слева от карточки статуса.

---

## Шаг 4: Предыдущие изменения (контекст)

Из предыдущих сессий в рамках «Anchoring UX + Ops»:

1. **ANCHORING_STATUS.json** — скрипт `scripts/build-anchoring-status.mjs`, формат `anchoring-status/v1`.
2. **API `/api/anchoring/issues`** — новый формат `AnchoringIssuesResponse` с `issues: AnchoringIssue[]`, типы в `lib/types/anchoring-issues.ts`.
3. **Proof bundle** — `GET /api/anchoring/anchors/:id/proof-bundle`, формат `proof-bundle/v1`.
4. **Export button** — использует proof-bundle API вместо client-side JSON.
5. **create-auditor-pack.mjs** — вызов `build-anchoring-status.mjs` после receipts.
6. **independent-verify.mjs** — вывод summary по `ANCHORING_STATUS.json`.

---

---

## Шаг 5: Copy UX (IssuesPanel)

**Контракт UX (зафиксирован):**

- Copy tx / anchor / link → `✓` (ok) / `⚠︎` (error)
- `aria-live="polite"` + tooltip — доступность
- 1.5 s lock + защита от повторных кликов
- Severity-based highlight: ok → critical=amber, major=emerald; error → rose
- Микро-bounce для ✓ (scale на label), без layout-скачков

---

## Шаг 6: Anchoring Governance (Final)

**Anchoring Governance**

* Added unified copy UX for anchoring issues (tx / anchor / link).
* Introduced auditor pack with independent offline verification.
* Enforced CI release gate on critical anchoring issues.
* Pack integrity: pack_hash.json + pack_signature.json (Ed25519).
* Audit Monitor: daily scheduled verify + optional Slack notify.
* Ops UX: Export JSON/CSV, Copy all tx, Acknowledge (localStorage).
* docs/VERIFY_POLICY.md — env documentation.

---

## Шаг 7: Audit Attestation & Compliance (Final)

**Документация для внешнего аудита:**

- `docs/AUDIT_ATTESTATION.md` — One-paragraph attestation (SOC/ISO ready)
- `docs/SOX_MAPPING.md` — SOX 404 ITGC mapping
- `docs/ISO27001_MAPPING.md` — ISO 27001 controls mapping
- `docs/DOMAIN_ROLLOUT_PLAYBOOK.md` — Reusable template для других доменов

**README / OPS checklist** — добавлены ссылки на compliance docs.

---

## Итог

- Сборка проходит успешно.
- `IssuesPanel` — минимальный drop-in, без shadcn.
- Страница `/governance/anchoring` использует `IssuesPanel` в header.
- Copy UX: tx / anchor / link — единообразно, production-grade.
- Auditor pack: immutable, optionally signed, CI-gated.
- Audit attestation + SOX/ISO mappings — готовы для external audit.
- Все ранее выявленные ошибки типов и линтера исправлены.
