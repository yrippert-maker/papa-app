# How We Ensure Audit Integrity

*Public-facing trust page — for use when offering audit/evidence as a product or to external parties.*

---

We run an **evidence ledger** that records every verification run: what was checked, when, and the result. That ledger is **append-only**, **tamper-evident**, and **independently verifiable**. Here is how we achieve that.

## 1. Every run is recorded

Each time we verify an auditor pack (integrity, signatures, policy), we write a small **ledger entry** to durable storage. The entry includes a hash of the pack, signature status, and pass/fail. We do not overwrite or delete past entries.

## 2. Daily rollups and a single “fingerprint” per day

Once per day we compute a **Merkle tree** over all ledger entries for that day. The result is one short value — the **Merkle root** — that uniquely represents that day’s set of entries. If any entry were changed, this root would change. So you can think of the root as the day’s **integrity fingerprint**.

## 3. Anchoring on a public chain

We publish that daily Merkle root to a **public blockchain** (e.g. Polygon). The transaction is permanent and auditable by anyone. That means:

- **Tamper-evidence:** Changing history would require changing the root, which would no longer match the value we anchored.
- **Independence:** Anyone can check the chain and compare the anchored value to the rollup we publish.

## 4. Signed packs

Each auditor pack is **signed** with a key we control. Verifiers can check that the pack they have matches what we signed. Keys are managed under a formal policy (rotation, emergency revoke) and can be reviewed in a compliance package on request.

## 5. What you can do as an auditor

- **Inspect the ledger** — via our Auditor Portal or (by agreement) read-only access to the same storage.
- **Download the exact pack** we verified — so you can re-run verification yourself.
- **Check the rollup** — daily Merkle root and list of entries.
- **Verify the anchor** — transaction hash and network are in our rollup anchoring status; you can confirm on a block explorer.

We provide **redacted samples** of a ledger entry, a rollup, and an anchor proof, plus a **short explainer** for non-technical auditors, in our compliance package.

---

*For formal procedures (incident response, key management, access reviews) we maintain separate documents under the Regulator / SOC2 track, available on request.*
