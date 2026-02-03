# Audit Integrity — Short Explainer for Non-Technical Auditors

*Plain-language overview of how we prove that our audit trail is complete and unchanged.*

---

## Why this matters

You need to be sure that:

1. **We really ran the checks** we say we ran.
2. **No one has changed the record** of what happened.

We support both with a **ledger**, **daily summaries**, and **on-chain proof**.

---

## The ledger (the “log book”)

Think of the ledger as a **log book** that we cannot erase or edit:

- **One line per verification:** Each time we verify an auditor pack, we add one line (a “ledger entry”) with: what we checked, when, and whether it passed or failed.
- **We never delete or change old lines.** So the history is complete and stable.

If we stored this only on our own servers, you would have to trust us that we did not alter it. So we do two more things.

---

## Daily “fingerprint” (the rollup)

Once per day we take **all the lines we added that day** and compute a single short value from them — like a **fingerprint** for that day. That value is called the **Merkle root**.

- If **any** of that day’s lines were changed, the fingerprint would change.
- So instead of checking every line, you can **check one fingerprint per day** to see if that day’s log is still intact.

We publish this fingerprint (and the list of entries it covers) so you or your experts can verify it.

---

## Proof on a public blockchain (anchoring)

We **publish that daily fingerprint on a public blockchain** (e.g. Polygon). The transaction is permanent and visible to everyone.

- **Tamper-evidence:** If we changed our records, the fingerprint would change and **would no longer match** what we put on the chain. So you can see that the record has not been altered since it was anchored.
- **Independence:** You do not have to trust our systems alone; you can check the chain yourself or through any block explorer.

We give you the **transaction hash** and **network** so you can look up the anchored value.

---

## What you get

- **Ledger entries** — the “lines” in the log (via our Auditor Portal or by agreement).
- **Daily rollup** — the fingerprint and list of entries for each day.
- **Anchor proof** — transaction hash and network; you can confirm the fingerprint on-chain.
- **Redacted samples** — example ledger entry, rollup, and anchor proof with sensitive details removed, so you can see the structure and wording.

---

## One sentence summary

*We record every verification in an append-only ledger, publish a daily fingerprint of that ledger, and anchor that fingerprint on a public blockchain so anyone can verify that the record has not been changed.*
