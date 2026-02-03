# SOC 2–style Control Mapping (simplified)

*Not a formal certification; a mapping of “control → mechanism” for evidence ledger and audit trail.*

---

## CC6 — Logical Access

| Control intent | Mechanism |
|----------------|-----------|
| Authenticated access to audit artifacts | Portal auth (OIDC / API key) |
| Separation of duties | CI (sign/publish) vs verifier vs portal (read-only) |
| No exposure of signing material | Secrets only in CI; keys not available to portal or auditors |

---

## CC7 — Change Management

| Control intent | Mechanism |
|----------------|-----------|
| Policy is explicit and versioned | Policy-as-data (verify-policy.json) |
| Traceability of what was verified | Versioned pack, policy, and ledger |
| Record of verification outcome | Ledger stores policy context and verify result per run |

---

## CC8 — System Operations

| Control intent | Mechanism |
|----------------|-----------|
| Monitoring and alerting | CI monitor + Slack alerts |
| Reduced noise when critical is under control | Slack suppression when no unacked critical issues |
| Structured handling of issues | Incident workflow via issues + ack; Exception Register |

---

## CC9 — Risk Mitigation

| Control intent | Mechanism |
|----------------|-----------|
| Prioritization and deduplication | Deduplication and severity/type model for issues |
| Time-bound exceptions | TTL for acknowledgements; auto-expiry |
| Tamper-evidence | Anchored rollups; any change to history is detectable |

---

## A1 — Availability / Integrity

| Control intent | Mechanism |
|----------------|-----------|
| Durable, recoverable storage | Object storage with versioning |
| Defined retention | Retention policy for ledger and rollups |
| Independent verification | Any party can run independent verify on a published pack |
