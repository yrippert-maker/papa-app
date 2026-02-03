# Due Diligence Answer Sheet (1 page)

*Quick answers for typical questions from investors, banks, and enterprise customers.*

---

## What is this system?

A **system for independent verification and provable audit** that delivers cryptographic integrity, reproducibility, and an immutable audit trail for operational data and decisions.

---

## How is data integrity ensured?

- All audit packs are **hashed and signed**.
- Signatures support **key rotation** (key_id, multi-key allowlist).
- Verification is performed by an **independent verifier**.

---

## Can history be changed after the fact?

**No.**

- All verification runs are written to an **append-only evidence ledger**.
- **Daily Merkle rollups** are computed over the ledger.
- The **Merkle root is anchored** in an external network.
- Any change to history is **detectable**.

---

## Can a verification be reproduced?

**Yes.**

- Each ledger entry references the **pack archive**.
- Any party can **download the pack** and run **independent verify**.

---

## How are incidents and exceptions handled?

- Issues are classified by **severity** and **type**.
- Exceptions are recorded via **server-side acknowledgement (ack)**.
- Acks have a **TTL** and expire automatically.
- All exceptions are visible in the **Exception Register**.

---

## Who has access?

- **Signing and publishing** run in CI with minimal privileges.
- **Portal** is read-only, with authentication.
- **Signing keys** are not exposed to the portal or to auditors.

---

## What can be verified independently in one day?

See **[AUDITOR_CHECKLIST_1DAY.md](../AUDITOR_CHECKLIST_1DAY.md)**.
