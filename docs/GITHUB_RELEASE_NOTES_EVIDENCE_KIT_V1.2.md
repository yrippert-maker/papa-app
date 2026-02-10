# Release evidence-kit-v1.2 — Evidence Kit Public Bundle

**Tag:** `evidence-kit-v1.2`  
**Дата:** 2026-02

---

## What's new in v1.2 (Quality & Trust)

| Возможность | Описание |
|-------------|----------|
| **Confidence score** | `sources[].confidence` (0–1) — релевантность каждого источника. Регулятор видит «почему этот документ». |
| **Auto-suggest** | Автозаполнение полей (serial_number, inspector, act_number) из выбранных документов. Меньше ручного ввода. |
| **UI indicators** | EvidenceMap и список поиска — badge с % релевантности (зелёный ≥80%, жёлтый ≥50%). |

Всё из v1.1 сохранено: semantic search, EvidenceMap, Draft→Confirm→Final, techcard, audit_meta.

---

## Что входит

| Артефакт | Описание |
|----------|----------|
| **Demo Compliance Package** | `demo-pack.zip` — audit pack, compliance report, decision record, verify-summary. |
| **Regulatory Bundle** | `regulatory-bundle-evidence-kit-v1.2.zip` — документация для регулятора. |
| **Evidence reports** | `evidence-kit-report-ru.md/.pdf`, `evidence-kit-report-en.md/.pdf`. |

---

## Как проверить (3 команды)

```bash
sha256sum -c demo-pack.zip.sha256
sha256sum -c regulatory-bundle-evidence-kit-v1.2.zip.sha256
unzip -o demo-pack.zip && sha256sum -c 99_HASHES/checksums.sha256
```

---

## Pilot readiness

v1.2 привязан к [Pilot Readiness Pack](plans/PILOT_READINESS_PACK.md): ТВ3-117, акт входного контроля, EASA/ARMAC.

---

## Сборка

```bash
npm run evidence-kit:public -- --tag evidence-kit-v1.2 --pdf
```
