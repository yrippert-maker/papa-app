# Release Notes v0.1.21 — Compliance UI Dashboard

## Summary

Compliance Dashboard для мониторинга ключей подписи и статистики верификации.

## Changes

- **New permissions**: COMPLIANCE.VIEW, COMPLIANCE.MANAGE
- **New API**: /api/compliance/keys, rotate, revoke, verify-stats
- **Keys UI**: активный ключ, архивные, ротация, отзыв
- **Stats UI**: verify metrics, dead-letter status
- **Navigation**: Compliance секция в sidebar
- **Tests**: 215 passed (2 new for compliance-service)
