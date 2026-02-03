# Runbook: Receipt integrity mismatch

**Issue type:** RECEIPT_INTEGRITY_MISMATCH

## Steps

1. Re-fetch the transaction receipt from the chain (RPC).
2. Compare SHA-256 of the stored receipt with the new fetch.
3. If different: replace the receipt file and update `receipts_manifest.json`.
4. Re-run auditor pack generation and verify.
