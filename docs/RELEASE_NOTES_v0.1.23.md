# Release Notes v0.1.23 — Audit Filters & Pagination

## Summary

Фильтры и пагинация для audit log ключей.

## Changes

- **Filters**: from, to (date range), action (KEY_ROTATED/KEY_REVOKED)
- **Pagination**: cursor-based, has_more indicator
- **API**: filters and pagination for audit + export endpoints
- **UI**: date pickers, action dropdown, load more button
- **Tests**: 215 passed
