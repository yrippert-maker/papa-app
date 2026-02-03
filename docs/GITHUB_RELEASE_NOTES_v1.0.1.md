# Release v1.0.1 — Full delivery: dashboard, health alerts, trust package

## Summary

- **System Health** — `/api/system/health` and `/system/health` UI: ledger writable, rollup freshness, pending queue.
- **Alerts** — Health-alert script and workflow: Slack on no rollup > 24h, pending > threshold.
- **Trust package** — PUBLIC_TRUST_EXPLAINER, BANK_INVESTOR_PACKET, redacted samples doc, SOC2/Due Diligence refs.
- **Mail types** — risk_score (DKIM/SPF/DMARC), SLA warning, virus-scan hook placeholder.
- **Docs** — REGULATORY_SUBMISSION_CHECKLIST v1.0.0 example, README_COMPLIANCE baseline, ALERTS_COMPLIANCE Health section.

## Artifacts

- Regulatory bundle: `regulatory-bundle-v1.0.1.zip` (after clean tag + `./scripts/create-regulatory-bundle.sh v1.0.1`).
