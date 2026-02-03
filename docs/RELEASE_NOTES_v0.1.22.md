# Release Notes v0.1.22 — Key Audit Log & CSV Export

## Summary

Audit log для key actions и CSV export для внешних отчётов.

## Changes

- **Key Audit**: rotate/revoke записываются в ledger
- **Audit API**: GET /api/compliance/keys/audit
- **Export API**: GET /api/compliance/export?type=verify-stats|key-audit
- **UI**: журнал действий на /compliance/keys
- **UI**: CSV кнопки на compliance страницах
- **Tests**: 215 passed
