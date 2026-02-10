# Evidence Kit v1.0 — Public Bundle

**Назначение:** единый пакет для публичной передачи регуляторам, партнёрам, инвесторам.

**Foundation:** frozen (v1.0). Feature development — [EVIDENCE_KIT_FEATURE_ROADMAP.md](plans/EVIDENCE_KIT_FEATURE_ROADMAP.md).

---

## Содержимое

| Артефакт | Описание |
|----------|----------|
| **README.md** | Start here — 1 страница, навигация по пакету |
| **evidence-kit-report-ru.pdf** / .md | Краткий отчёт (RU) |
| **evidence-kit-report-en.pdf** / .md | Executive summary (EN) |
| **demo-pack.zip** | Demo Compliance Package + sha256 |
| **regulatory-bundle-&lt;tag&gt;.zip** | Regulatory submission bundle + sha256 |

---

## Сборка

```bash
npm run evidence-kit:public
```

Опции:

```bash
# С указанием tag для regulatory bundle
node scripts/build-evidence-kit-public.mjs --tag v1.0.0

# С генерацией PDF (требует: npm install md-to-pdf)
node scripts/build-evidence-kit-public.mjs --pdf

# Без demo pack (только regulatory bundle + отчёты)
node scripts/build-evidence-kit-public.mjs --no-demo
```

---

## Выход

`dist/evidence-kit-public-v1.0/`

---

## Golden artifact (эталон)

Public Bundle должен храниться как **golden artifact** — неизменяемый эталон для проверки.

| Вариант | Как | Когда |
|---------|-----|-------|
| **GitHub Release** | Тег `evidence-kit-v1.0` → Release с приложенными ZIP + sha256 | Рекомендуется. Всегда доступен, версионирован. |
| **S3 / bucket** | `s3://your-bucket/evidence-kit/evidence-kit-v1.0/` | Опционально: зеркало, CDN, внутренний архив. |

**Правило:** после релиза артефакты не меняются. Новые версии — новый тег (evidence-kit-v1.1 и т.д.).

См. [RELEASE_EVIDENCE_KIT_CHECKLIST.md](RELEASE_EVIDENCE_KIT_CHECKLIST.md).

---

## Связанные документы

- [EVIDENCE_KIT_PITCH.md](EVIDENCE_KIT_PITCH.md) — What is Evidence Kit and why it matters
- [REGULATORY_BUNDLE_MANIFEST.md](REGULATORY_BUNDLE_MANIFEST.md) — содержимое regulatory bundle
- [README_COMPLIANCE.md](README_COMPLIANCE.md) — compliance pipeline
- [UI_ROUTING_SANITY_EVIDENCE.md](UI_ROUTING_SANITY_EVIDENCE.md) — UI routing evidence
