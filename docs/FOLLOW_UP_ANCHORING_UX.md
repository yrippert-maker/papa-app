# Follow-up — Anchoring UX & Governance

Задачи на будущее (не блокируют текущий релиз).

---

## 1. Full-card highlight для Copy link

**Приоритет:** Low  
**Файл:** `app/governance/anchoring/_components/IssuesPanel.tsx`

**Описание:** Сейчас подсветка при Copy link только на кнопке. Опционально — подсвечивать всю карточку issue (как tx/anchor).

**Приёмка:** При включении карточка получает severity-based highlight на 1.5s при Copy link (ok/error). API не меняется.

**Как включить:** Раскомментировать блок в IssuesPanel (см. TODO над `className` карточки).

---

## 2. Расширить verify (strict fail по issue-типам)

**Приоритет:** Medium  
**Файл:** `scripts/independent-verify.mjs`

**Описание:** Добавить жёсткий fail по конкретным типам проблем (например, `RECEIPT_MISSING_FOR_CONFIRMED`, `RECEIPT_INTEGRITY_MISMATCH`).

**Приёмка:** При `STRICT_VERIFY=1` verify падает с exit 2, если обнаружены критические issue-типы.

---

## 3. Аналогичный контур для другого governance-модуля

**Приоритет:** As needed  
**Шаблон:** `docs/RELEASE_RUNBOOK_ANCHORING_COPY_UX.md`

**Описание:** При добавлении нового governance-модуля — повторить структуру: runbook, CI gate, ops checklist, ticket closure.

---

## Создание issue (GitHub/Jira)

При необходимости создать issue — скопировать соответствующий блок выше в описание.
