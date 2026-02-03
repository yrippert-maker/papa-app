# Security & Compliance Assurance

**Papa App** — Independent verification and attestation for governance evidence.

---

## Auditor Pack

Self-contained verification bundle for external auditors. No dependencies, offline capable.

| Resource | Link |
|----------|------|
| **Latest release** | [GitHub Releases](https://github.com/yrippert-maker/papa-app/releases) |
| **Auditor pack** | Download `auditor-pack-*.tar.gz` from release assets |
| **Verification** | `tar -xzf auditor-pack-*.tar.gz && cd auditor-pack-* && node verify.mjs` |

**Pack SHA-256:** Published in each release's notes (authoritative).

---

## Attestation Cadence

| Type | Schedule |
|------|----------|
| Quarterly | 1st of Jan, Apr, Jul, Oct |
| Annual | 1st of Jan |

Automated via [Governance Cadence](.github/workflows/governance-cadence.yml).

---

## Integrity Anchoring (Polygon)

The system maintains an append-only integrity ledger for designated compliance and operational events. Each event is cryptographically signed and chained.

Periodically, the ledger is summarized into a Merkle root and anchored to the Polygon network via an on-chain registry event. No operational documents, photos, or sensitive data are stored on-chain—only cryptographic commitments (hashes) and proof metadata.

**Verification:** Independent offline verification is supported through auditor packs that include receipts, proofs, and verification tooling.

### RU: Якорение целостности (Polygon)

Система ведёт append-only журнал целостности по ключевым событиям комплаенса и эксплуатации. Каждое событие криптографически подписывается и связывается цепочкой.

Периодически журнал сворачивается в Merkle root и якорится в сети Polygon через событие on-chain реестра. Документы, фото и чувствительная информация на блокчейн не выгружаются — публикуются только криптографические обязательства (хэши) и метаданные доказательства.

**Проверка:** Независимая проверка поддерживается в offline-режиме через auditor pack, содержащий receipts, proofs и инструмент верификации.

### Integrity Anchoring — Scope and Limitations (Regulatory / Partner)

The integrity mechanism provides tamper-evidence and auditability for designated event classes within the system. It does not store operational documents, media, or personal/commercial data on-chain. Instead, it anchors cryptographic summaries (Merkle roots) to the Polygon network and retains verifiable evidence (receipts and proofs) in the audit bundle.

Verification can be performed independently in offline mode using the provided auditor pack. The assurance covers integrity and provenance of recorded events and referenced artifacts by hash; it does not replace functional safety audits, penetration testing, or review of live system access controls unless explicitly included in a separate assessment scope.

---

## Scope

### In Scope (Dry-Run)

- Pack integrity (checksums)
- Provenance (git tag, commit)
- Trust anchors, policies, snapshots, attestations
- Standalone verifier (`verify.mjs`)

### Out of Scope

- Live system access
- Source code review
- Penetration testing
- Operational controls

See [DRY_RUN_AUDIT_PLAN](governance/DRY_RUN_AUDIT_PLAN.md) for full scope.

---

## Contact

**Security disclosure:** Open a [GitHub Security Advisory](https://github.com/yrippert-maker/papa-app/security/advisories/new) or contact the repository owner.

**Audit inquiries:** See repository description or GitHub profile.

---

## References

- [Governance Charter](governance/GOVERNANCE_CHARTER.md)
- [Dry-Run Audit Plan](governance/DRY_RUN_AUDIT_PLAN.md)
- [Governance Roadmap](governance/GOVERNANCE_ROADMAP.md)
