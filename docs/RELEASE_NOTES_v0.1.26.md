# Release Notes v0.1.26 — Policy Drift Detection

## Summary

Policy version и hash в JSON output для CI drift detection.

## Changes

- **JSON fields**: `policy_version`, `policy_hash` (16-char SHA-256)
- **Service**: `computePolicyHash()` in retention-service.ts
- **Script**: Policy hash in retention-enforce.mjs
- **API**: `/api/compliance/retention` returns policy metadata
- **Tests**: 215 passed
