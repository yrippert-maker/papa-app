# Anchoring issues runbook

This runbook maps issue `type` to remediation guidance.

## <a id="receipt_integrity_mismatch"></a>RECEIPT_INTEGRITY_MISMATCH

**What it means:** Receipt content/hash does not match expected integrity envelope.

**Checklist:**
- Verify the receipt source of truth (provider logs / export).
- Confirm hashing algorithm/version alignment.
- Rebuild pack and re-run independent verify.

## <a id="receipt_missing_for_confirmed"></a>RECEIPT_MISSING_FOR_CONFIRMED

**What it means:** A confirmed event has no corresponding receipt.

**Checklist:**
- Check receipt ingestion pipeline for drops.
- Verify filtering rules (time windows, pagination).
- Ensure confirmed events are within coverage.

## <a id="anchor_failed"></a>ANCHOR_FAILED

**What it means:** Anchoring operation failed (upstream or internal).

**Checklist:**
- Inspect anchoring provider status (outage/latency).
- Retry anchoring job for the affected window.
- Confirm rate limits / auth tokens.

## <a id="anchor_pending_too_long"></a>ANCHOR_PENDING_TOO_LONG

**What it means:** Anchor has been pending longer than the configured threshold.

**Checklist:**
- Check anchoring provider queue and latency.
- Verify network connectivity and RPC availability.
- Consider manual retry or escalation.

## <a id="gap_in_periods"></a>GAP_IN_PERIODS

**What it means:** Coverage gap detected in expected periods.

**Checklist:**
- Validate schedule definition (period boundaries).
- Check data availability for the missing interval.
- Re-run generation for the gap window.
