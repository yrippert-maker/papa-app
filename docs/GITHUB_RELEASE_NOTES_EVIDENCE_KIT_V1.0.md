# Release evidence-kit-v1.0 — Evidence Kit Public Bundle

**Tag:** `evidence-kit-v1.0`  
**Дата:** 2026-02

---

## Что входит

| Артефакт | Описание |
|----------|----------|
| **Demo Compliance Package** | `Papa-App-Demo-Compliance-Package.zip` — audit pack, compliance report, decision record, verify-summary, ledger-entry. Воспроизводимая верификация. |
| **Regulatory Bundle** | `regulatory-bundle-evidence-kit-v1.0.zip` — документация для регулятора: AUTHZ evidence, DB evidence, UI routing evidence, security posture, MANIFEST. |
| **UI Routing Evidence** | Контролируемая 404, ErrorBoundary, относительная навигация. [UI_ROUTING_SANITY_EVIDENCE.md](UI_ROUTING_SANITY_EVIDENCE.md). |
| **AuthZ Evidence** | Endpoint → Permission → Roles, deny-by-default. [ENDPOINT_AUTHZ_EVIDENCE.md](ENDPOINT_AUTHZ_EVIDENCE.md). AUTHZ_VERIFY_RESULT.txt в regulatory bundle. |

---

## Как проверить (3 команды)

```bash
# 1. Demo pack — целостность ZIP
sha256sum -c demo-pack.zip.sha256

# 2. Regulatory bundle — целостность ZIP
sha256sum -c regulatory-bundle-evidence-kit-v1.0.zip.sha256

# 3. Demo pack — self-check внутри распакованного
unzip -o demo-pack.zip && sha256sum -c 99_HASHES/checksums.sha256
```

---

## Verification snippet (copy-paste для аудитора)

```bash
# Проверка Evidence Kit v1.0 — 3 шага
sha256sum -c demo-pack.zip.sha256
sha256sum -c regulatory-bundle-evidence-kit-v1.0.zip.sha256
unzip -o demo-pack.zip && sha256sum -c 99_HASHES/checksums.sha256
```

*Если demo pack приложен как `Papa-App-Demo-Compliance-Package.zip`, замените `demo-pack` на это имя.*

---

## Authoritative evidence

| Тип | Authoritative | Supporting |
|-----|---------------|------------|
| **AuthZ** | AUTHZ_VERIFY_RESULT.txt (authz_verification.executed=true, authz_ok=true) | — |
| **Ledger** | LEDGER_VERIFY_RESULT.txt (ledger_verification.executed=true, ledger_ok=true) | — |
| **Demo pack** | MANIFEST.txt, 99_HASHES/checksums.sha256, decision-record.json | compliance-report.md, EXEC_SUMMARY.md |
| **UI routing** | UI_ROUTING_SANITY_EVIDENCE.md (текст, smoke-тесты) | 07_UI_EVIDENCE/not-found-page.png |

**Правило:** authoritative = manifests, verification reports, hashes. Supporting = human-readable иллюстрации (скриншоты, краткие отчёты).

---

## Артефакты релиза (обязательно приложить)

| Файл | Описание |
|------|----------|
| demo-pack.zip (или Papa-App-Demo-Compliance-Package.zip) | Demo pack |
| demo-pack.zip.sha256 | SHA-256 demo pack |
| regulatory-bundle-evidence-kit-v1.0.zip | Regulatory bundle |
| regulatory-bundle-evidence-kit-v1.0.zip.sha256 | SHA-256 regulatory bundle |

---

## Сборка

```bash
# Evidence Kit Public Bundle (всё в dist/evidence-kit-public-v1.0/)
npm run evidence-kit:public -- --tag evidence-kit-v1.0

# Или по отдельности:
npm run compliance:demo:from-pack -- --pack ./__fixtures__/auditor-pack-minimal --out ./dist/demo
npm run bundle:regulatory -- evidence-kit-v1.0
```

См. [RELEASE_EVIDENCE_KIT_CHECKLIST.md](RELEASE_EVIDENCE_KIT_CHECKLIST.md).
