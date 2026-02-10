# Release evidence-kit-v1.1 — Evidence Kit Public Bundle

**Tag:** `evidence-kit-v1.1`  
**Дата:** 2026-02

---

## What's new in v1.1

### AI Document Workflow (enterprise-grade)

| Возможность | Описание |
|-------------|----------|
| **Semantic search** | OpenAI `text-embedding-3-small` / Ollama `nomic-embed-text` / stub fallback. Фиксация провайдера и модели в `audit_meta.embeddings`. |
| **Explainable AI** | Кликабельный EvidenceMap: раскрытие фрагмента → ссылка «Открыть документ» → download stream. Прозрачная цепочка источник → результат. |
| **Controlled document generation** | Draft → Confirm → Final workflow. Экспорт DOCX только после подтверждения. |
| **New template: techcard** | Технологическая карта (product, operation, steps, acceptance_criteria, sms_requirements, requirement_ref). Три типа документов end-to-end: act, letter, techcard. |
| **Audit & integrity** | `output_sha256`, `audit_meta.sources[]` (sha256/chunkIds), `workflow_schema_version`, `agent_version`, `template_version`. Доказуемая цепочка источник → требование → документ. |

---

## Что входит

| Артефакт | Описание |
|----------|----------|
| **Demo Compliance Package** | `demo-pack.zip` — audit pack, compliance report, decision record, verify-summary. Воспроизводимая верификация. |
| **Regulatory Bundle** | `regulatory-bundle-evidence-kit-v1.1.zip` — документация для регулятора: AUTHZ, DB evidence, UI routing, security posture, MANIFEST. |
| **Evidence reports** | `evidence-kit-report-ru.md/.pdf`, `evidence-kit-report-en.md/.pdf` — краткий обзор и executive summary. |

---

## Как проверить (3 команды)

```bash
# 1. Demo pack — целостность ZIP
sha256sum -c demo-pack.zip.sha256

# 2. Regulatory bundle — целостность ZIP
sha256sum -c regulatory-bundle-evidence-kit-v1.1.zip.sha256

# 3. Demo pack — self-check внутри распакованного
unzip -o demo-pack.zip && sha256sum -c 99_HASHES/checksums.sha256
```

---

## Verification snippet (copy-paste для аудитора)

```bash
# Проверка Evidence Kit v1.1 — 3 шага
sha256sum -c demo-pack.zip.sha256
sha256sum -c regulatory-bundle-evidence-kit-v1.1.zip.sha256
unzip -o demo-pack.zip && sha256sum -c 99_HASHES/checksums.sha256
```

---

## Controlled AI for regulated environments

v1.1 позиционирует систему как **controlled AI document workflow** — не просто AI-ассистент, а система принятия и фиксации решений с доказуемым результатом:

- ✔ Готовность к регуляторам / quality
- ✔ Пилоты с MRO / CAMO / OEM-подрядчиками
- ✔ Продажа как «controlled AI for regulated environments»

---

## Артефакты релиза (обязательно приложить)

| Файл | Описание |
|------|----------|
| demo-pack.zip | Demo pack |
| demo-pack.zip.sha256 | SHA-256 demo pack |
| regulatory-bundle-evidence-kit-v1.1.zip | Regulatory bundle |
| regulatory-bundle-evidence-kit-v1.1.zip.sha256 | SHA-256 regulatory bundle |
| evidence-kit-report-ru.md | Краткий отчёт (RU) |
| evidence-kit-report-en.md | Executive summary (EN) |
| README.md | Start here — навигация по пакету |

---

## Сборка

```bash
# Evidence Kit Public Bundle v1.1 (всё в dist/evidence-kit-public-v1.1/)
npm run evidence-kit:public -- --tag evidence-kit-v1.1 --pdf
```

См. [RELEASE_EVIDENCE_KIT_CHECKLIST.md](RELEASE_EVIDENCE_KIT_CHECKLIST.md).
