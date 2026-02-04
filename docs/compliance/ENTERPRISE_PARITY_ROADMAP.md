# Enterprise Parity Roadmap — Custom Audit / Compliance Infrastructure

**Контекст:** papa-app позиционируется в классе **Custom audit / compliance infrastructure** (то, что делают консалтеры, Big4, internal audit teams под заказчика). Цель — конкурировать с кастомной enterprise-инфраструктурой, а не только «быть хорошим продуктом».

---

## 1. Разрыв: papa-app vs custom audit infra

### Кастомная audit/compliance infra обычно даёт

- ✔️ Индивидуальные требования под регулятора  
- ✔️ Полную трассируемость решений  
- ✔️ Формальные отчёты «для подписи»  
- ✔️ Чёткое владение ответственностью (RACI)  
- ✔️ Возможность объяснить *почему* система так решила  

### papa-app уже даёт

- ✅ Криптографическую целостность  
- ✅ Воспроизводимость  
- ✅ Независимую верификацию  
- ✅ Policy-as-data  
- ✅ Audit packs, ledger, anchoring  
- ✅ Exception handling и runbooks  

**Главный разрыв:** не в технологии, а в **«decision layer»** и **«human-facing outputs»**.

---

## 2. Критические недостающие блоки (по приоритету)

### 🔴 Блок №1 — Decision Explainability (самый важный)

**Чего не хватает:** система говорит «pass / fail / warn», но не даёт **формализованного объяснения решения**, пригодного для регулятора, суда, board review.

**Что добавить:**

| Артефакт | Описание |
|----------|----------|
| `decision-record.json` | Машинный формат: применённые policies (версии, хэши), входные данные (pack refs), список проверок, какие правила сработали, почему severity = warn/fail, альтернативы (если есть), кто утвердил / auto-approved. |
| `decision-record.md` | Человекочитаемая версия того же. |

**Ценность:** за это кастомные системы берут сотни тысяч.

---

### 🔴 Блок №2 — Formal Compliance Reporting (PDF / signed)

**Чего не хватает:** слой «официальный отчёт для regulator / board / court».

**Что добавить:**

| Компонент | Описание |
|-----------|----------|
| Compliance Report Generator | Генерация Executive Compliance Report (PDF), Technical Appendix. |
| Подписываемый артефакт | Хэш отчёта, подпись, ссылка на audit pack / ledger. |

**Ценность:** must-have для enterprise deals.

---

### 🟠 Блок №3 — RACI / Accountability Layer

**Чего не хватает:** явное владение решением (Owner, Reviewer, Approver, liable).

**Что добавить:**

| Элемент | Описание |
|---------|----------|
| Responsibility & Approval Model | Явный RACI: Owner, Reviewer, Approver. |
| Связка | policy → role → decision. |
| Фиксация | «approved by X at time Y», «auto-approved under policy Z». |

**Ценность:** без этого банк / regulator не подпишется.

---

### 🟠 Блок №4 — Custom Controls DSL (Control-as-Code)

**Чего не хватает:** VERIFY_POLICY отличный, но кастомные infra позволяют писать controls ближе к бизнесу.

**Что добавить:**

- Control Definitions (Control-as-Code), пример:
  - `control.id`, `objective`, `evidence` (ledger_hash, anchor_receipt), `assertion`, `severity`.
- Цепочка: Policy → Control → Evidence → Decision.
- Язык общения с аудиторами, не только с разработчиками.

---

### 🟠 Блок №5 — Temporal & Historical Reasoning

**Чего не хватает:** ответы «на дату X система была compliant?», «что изменилось между T1 и T2?».

**Что добавить:**

- Time-scoped verification: `verify(pack, policy, as_of=timestamp)`.
- Diff reports: policy diff, evidence diff, outcome diff.

**Ценность:** сильный selling point.

---

## 3. Что НЕ добавлять

Чтобы не размыть фокус:

- ❌ Ещё больше криптографии  
- ❌ Blockchain-маркетинг  
- ❌ Сложные UI-дашборды  
- ❌ «AI compliance» без explainability  

Архитектурно продукт уже силён; важно не усложнять без необходимости.

---

## 4. Минимальный «Enterprise Parity» набор

### MUST (без этого — нет enterprise)

1. **Decision Record** (explainability)  
2. **Formal Compliance Report** (PDF + signature)  
3. **Accountability / Approval** (RACI)  

### NICE-TO-HAVE (усиливает цену)

4. Control-as-Code слой  
5. Temporal verification & diffs  

---

## 5. Влияние на цену (ориентир)

| Состояние продукта | Ориентир цены |
|--------------------|----------------|
| Текущий papa-app | $50k–150k |
| + Decision Record | $150k–250k |
| + Reports + RACI | $250k–500k |
| + Controls + Temporal | $500k+ / enterprise |

Конкуренция с кастомными решениями при: дешевле, быстрее, воспроизводимо, проверяемо независимой стороной.

---

## 6. Реализованные спецификации и артефакты

| # | Направление | Статус | Артефакты |
|---|-------------|--------|-----------|
| 1 | Decision Record | ✅ Сделано | [DECISION_RECORD_SPEC.md](./DECISION_RECORD_SPEC.md); генерация в `independent-verify.mjs` → `decision-record.json` + `decision-record.md`; `decision_id` + `ledger_entry_id` (immutability chain). |
| 2 | Compliance Report (PDF) | ✅ Реализовано | [COMPLIANCE_REPORT_SPEC.md](./COMPLIANCE_REPORT_SPEC.md); `scripts/generate-compliance-report.mjs` — MD + report-manifest.json + control-coverage-matrix.csv; PDF опционально (`--pdf`, требует md-to-pdf). |
| 3 | RACI / Accountability | ✅ Спека + в decision-record | [RACI_ACCOUNTABILITY_SPEC.md](./RACI_ACCOUNTABILITY_SPEC.md); в decision-record: approval.owner, approval.reviewer, approval.approver, approved_at; в policy — опционально approval_owner, approval_reviewer. |
| 4 | Control-as-Code DSL | ✅ Спека + пример + матрица | [CONTROL_AS_CODE_SPEC.md](./CONTROL_AS_CODE_SPEC.md); пример [config/control-definitions.example.yaml](../../config/control-definitions.example.yaml); Control Coverage Matrix — автогенерация в `generate-compliance-report.mjs` → `control-coverage-matrix.csv`. |
| 5 | Enterprise pricing & packaging | — | Оставить под продукт/продажи. |

---

## 7. Следующие шаги (по желанию)

- **PDF:** установить `md-to-pdf` и запускать `compliance:report --pdf` для генерации compliance-report.pdf.
- **Temporal verification** (verify as_of, diff reports) — по roadmap, отдельная спецификация.

---

*Документ фиксирует разрыв с custom audit infra и план достижения enterprise parity. Спеки и генерация Decision Record реализованы; отчёт (PDF) и интеграция Controls — следующие шаги.*
