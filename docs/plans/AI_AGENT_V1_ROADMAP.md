# AI Agent — Roadmap v1.x

## v1.1 — закрыт ✅

## ~~Убрать --legacy-peer-deps~~ ✅ Сделано

Добавлен `overrides` в package.json: `"openai": { "zod": "$zod" }` — `npm install` работает без `--legacy-peer-deps`.

## Следующий крупный ROI (после workflow)

1. **Реальные эмбеддинги** — подключить OpenAI/Ollama в `lib/agent/embed.ts`
2. **EvidenceMap кликабельный** — открыть документ/фрагмент по клику
3. **Шаблоны DOCX** — 2–3 типа (письмо/акт/отчёт) + таблицы

## ~~Track A: Реальные эмбеддинги~~ ✅ Сделано

- AGENT_EMBEDDINGS_PROVIDER=openai|ollama|stub
- OpenAI: text-embedding-3-small. Ollama: nomic-embed-text
- Fallback на stub при ошибке. audit_meta.embeddings

## ~~Track B: EvidenceMap кликабельный~~ ✅ Сделано

- GET /api/agent/doc/:docId — метаданные + download
- enrichEvidence с snippet. EvidenceMap: клик → фрагмент, «Открыть документ»

## ~~Track C: Эталонные DOCX~~ ✅ Сделано

- act.docx: act_number, act_date, work_order, location, requirement_ref (REQ:…)
- techcard.docx: product, operation, steps, acceptance_criteria, sms_requirements
- Реестр: version, status (DRAFT/APPROVED). Матрица: REQ-коды

---

## v1.2 — Quality & Trust (см. [AI_AGENT_V1.2_ROADMAP.md](AI_AGENT_V1.2_ROADMAP.md))

| Направление | Цель |
|-------------|------|
| ~~Confidence score по источникам~~ ✅ | Регулятор видит «почему этот источник» — явная метрика доверия |
| ~~Auto-suggest missing_fields~~ ✅ | Меньше ручного ввода, wow на демо |
| Шаблоны под регулятора (EASA / ARMAC) | Документ в формате, который инспектор ожидает |

**Критерий любой работы:** «Как это ускорит пилот / продажу / внедрение?»
