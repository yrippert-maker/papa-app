# Decision Diff — Specification

**Цель:** формально объяснять «Что изменилось между двумя compliance-решениями — и почему?» Без чтения исходников auditor может понять «почему стало fail».

---

## 1. CLI

```bash
decision-diff --from decision-A.json --to decision-B.json [--format json|md] [--output <dir>]
```

| Опция | Описание |
|-------|----------|
| `--from` | Путь к decision-record.json «откуда». |
| `--to` | Путь к decision-record.json «куда». |
| `--format` | `json` \| `md` \| `both` (default: both при --output). |
| `--output` | Каталог для записи decision-diff.json и decision-diff.md. |

---

## 2. Diff-модель (семантический)

Diff **семантический**, не построчный. Разделы:

| Раздел | Содержимое |
|--------|------------|
| **context_diff** | as_of, policy_version, policy_hash, pack_ref, policy_path. |
| **evidence_diff** | ledger_entry_id, input_policies (добавлено/удалено/изменено). |
| **checks_diff** | added, removed, outcome_changed (check id, from→to outcome, reason). |
| **rules_diff** | added, removed (rules_fired: rule_type, message). |
| **outcome_diff** | overall (pass/fail/warn), severity_effective. |
| **why_diff** | outcome.why (from → to). |
| **summary** | Краткое резюме: «Outcome: X → Y. <why_to>». |

---

## 3. Выходные форматы

| Формат | Назначение |
|--------|------------|
| `decision-diff.json` | Машины, регуляторы, интеграции. |
| `decision-diff.md` | Люди (auditor, board, regulator review). |

---

## 4. Критерии готовности

- [x] Diff объясняет изменение решения без чтения исходников.
- [x] Auditor может понять «почему стало fail».
- [x] Diff пригоден для регуляторного review.

---

## 5. Связь с Temporal (--as-of)

При сравнении решений с разным `as_of` блок `context_diff` покажет изменение временного контекста.

## 6. Интеграция в Compliance Report (Часть C)

При генерации отчёта с `--diff-from` и `--diff-to`:
- В compliance-report.md добавляется раздел **Appendix: Historical Compliance Changes**
- decision-diff.json и decision-diff.md записываются в output
- report-manifest.json получает `decision_diff_ref: { path, sha256 }`
