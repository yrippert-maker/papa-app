# Runbook: Receipt missing for confirmed anchor

**Issue type:** RECEIPT_MISSING_FOR_CONFIRMED

## Steps

1. Fetch the transaction receipt from the chain (RPC) using the anchor's `tx_hash`.
2. Save to `00_SYSTEM/anchor-receipts/<tx_hash>.json`.
3. Re-run auditor pack generation so the manifest is updated.
