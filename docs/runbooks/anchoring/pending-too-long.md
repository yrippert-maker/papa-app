# Runbook: Anchor pending too long (>72h)

**Issue type:** ANCHOR_PENDING_TOO_LONG

## Steps

1. Confirm the transaction on-chain (explorer / RPC).
2. If confirmed: update ledger anchor status and fetch receipt.
3. If not confirmed: retry publish or investigate RPC/contract.
