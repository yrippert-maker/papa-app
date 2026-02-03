# Threat Model — Papa App

**Document ID:** SEC-THREAT-001  
**Version:** 1.0.0  
**Last Updated:** 2026-02-02  
**Classification:** Internal / Confidential  
**Review Cycle:** Quarterly

---

## 1. Executive Summary

This document provides a comprehensive threat model for the Papa App system using the STRIDE methodology. It identifies potential security threats, their impact, likelihood, and mitigation strategies.

### 1.1 System Overview

Papa App is a local-first system for managing production processes, TMC (Technical Material Control), and documentation with:

- **Cryptographic key lifecycle management** (2-man rule, approval workflows)
- **Immutable audit ledger** (hash-chain verification)
- **Evidence signing** (Ed25519 digital signatures)
- **Role-based access control** (RBAC with permissions)
- **Compliance reporting** (attestations, audit packs)

### 1.2 Trust Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        EXTERNAL ZONE                             │
│  [Browsers] [External Auditors] [Regulatory Bodies] [Attackers] │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTPS (TLS 1.3)
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DMZ / NETWORK EDGE                          │
│  [Reverse Proxy / Load Balancer] [WAF] [Rate Limiter]           │
└─────────────────────────┬───────────────────────────────────────┘
                          │ Trust Boundary #1
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION ZONE                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Next.js     │  │  Auth        │  │  API Routes  │          │
│  │  Middleware  │  │  (NextAuth)  │  │  /api/*      │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│         └─────────────────┼─────────────────┘                    │
│                           │ Trust Boundary #2                    │
│                           ▼                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    BUSINESS LOGIC                        │    │
│  │  [RBAC] [Governance Service] [Key Lifecycle] [Ledger]   │    │
│  └───────────────────────┬─────────────────────────────────┘    │
│                          │ Trust Boundary #3                     │
│                          ▼                                       │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     DATA ZONE                            │    │
│  │  [SQLite DB] [File System] [Keys Directory]             │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. STRIDE Threat Analysis

### 2.1 Spoofing Identity

| ID | Threat | Asset | Impact | Likelihood | Risk | Mitigation |
|----|--------|-------|--------|------------|------|------------|
| S1 | **Session hijacking** | User session | High | Medium | High | HTTPS-only cookies, `httpOnly`, `secure`, `sameSite=strict` |
| S2 | **Credential stuffing** | User accounts | High | High | Critical | Rate limiting, account lockout, MFA (planned) |
| S3 | **Default credentials** | Admin account | Critical | Medium | Critical | Fail-fast on production with defaults, mandatory change |
| S4 | **Token replay** | API tokens | Medium | Low | Medium | Short-lived tokens, refresh rotation, audit logging |
| S5 | **Impersonation in 2-man rule** | Approval flow | Critical | Low | High | Separate sessions required, audit logging, IP tracking |

#### S1: Session Hijacking

**Attack Vector:**
- XSS to steal session cookies
- Network sniffing on unencrypted connections
- Session fixation attacks

**Current Controls:**
```typescript
// NextAuth session config
session: {
  strategy: 'jwt',
  maxAge: 24 * 60 * 60, // 24 hours
}
cookie: {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
}
```

**Residual Risk:** Low (with TLS and CSP headers)

#### S2: Credential Stuffing

**Attack Vector:**
- Automated login attempts with leaked credentials
- Brute force password guessing

**Current Controls:**
- Rate limiting on `/api/auth/*`
- bcrypt password hashing (cost factor 10)
- Audit logging of failed attempts

**Planned Controls:**
- Account lockout after 5 failed attempts
- CAPTCHA after 3 failed attempts
- MFA support (TOTP)

**Residual Risk:** Medium (until MFA implemented)

#### S3: Default Credentials

**Attack Vector:**
- Using well-known default credentials in production

**Current Controls:**
```typescript
// Fail-fast check
if (NODE_ENV === 'production' && hasDefaultAdminCredentials()) {
  return Response.json({ error: 'UNSAFE_DEFAULT_CREDENTIALS' }, { status: 500 });
}
```

**Residual Risk:** Low

---

### 2.2 Tampering with Data

| ID | Threat | Asset | Impact | Likelihood | Risk | Mitigation |
|----|--------|-------|--------|------------|------|------------|
| T1 | **Ledger tampering** | Audit log | Critical | Low | High | Hash chain, signature verification |
| T2 | **Policy modification** | Governance policies | High | Low | Medium | Version control, policy hashing |
| T3 | **Evidence tampering** | Compliance evidence | Critical | Low | High | Ed25519 signatures, hash verification |
| T4 | **Database manipulation** | SQLite DB | High | Medium | High | Read-only mode for queries, integrity checks |
| T5 | **File system tampering** | Workspace files | Medium | Medium | Medium | Path validation, file registration |

#### T1: Ledger Tampering

**Attack Vector:**
- Direct database modification
- SQL injection (if present)
- Insider with DB access

**Current Controls:**
```typescript
// Hash chain verification
function verifyLedgerChain() {
  let previousHash = null;
  for (const event of events) {
    const computed = computeEventHash(event, previousHash);
    if (computed !== event.event_hash) {
      return { valid: false, broken_at: event.id };
    }
    previousHash = computed;
  }
  return { valid: true };
}
```

**Detection:**
- `/api/system/verify` endpoint checks chain integrity
- Scheduled verification (cron)

**Residual Risk:** Low (tampering detectable)

#### T3: Evidence Tampering

**Attack Vector:**
- Modifying signed evidence files
- Key compromise

**Current Controls:**
- Ed25519 signature on all exports
- Independent verification script
- Trust anchors export for 3rd-party

**Residual Risk:** Low

---

### 2.3 Repudiation

| ID | Threat | Asset | Impact | Likelihood | Risk | Mitigation |
|----|--------|-------|--------|------------|------|------------|
| R1 | **Denied key operation** | Approval workflow | High | Medium | High | Signed intents, immutable ledger |
| R2 | **Denied access** | System access | Medium | Medium | Medium | Session logging, IP tracking |
| R3 | **Denied break-glass** | Emergency access | Critical | Low | High | Mandatory post-mortem, multiple witnesses |

#### R1: Denied Key Operation

**Attack Vector:**
- User claims they didn't initiate/approve a request
- Claim of impersonation

**Current Controls:**
```json
// Signed intent artifact
{
  "request_id": "uuid",
  "action": "ROTATE",
  "initiator_id": "user-123",
  "initiator_signature": "hex...",
  "created_at": "2026-02-02T..."
}
```

- All actions logged with user ID, timestamp, IP
- Signatures provide non-repudiation
- Ledger events are immutable

**Residual Risk:** Low

---

### 2.4 Information Disclosure

| ID | Threat | Asset | Impact | Likelihood | Risk | Mitigation |
|----|--------|-------|--------|------------|------|------------|
| I1 | **Private key exposure** | Signing keys | Critical | Low | Critical | Key isolation, no export |
| I2 | **PII in logs** | User data | High | Medium | High | Log sanitization |
| I3 | **Error stack traces** | System internals | Medium | Medium | Medium | Production error handling |
| I4 | **Path traversal** | File system | High | Medium | High | Path validation, sandboxing |
| I5 | **Sensitive config exposure** | Environment vars | Critical | Low | High | No secrets in client, audit |

#### I1: Private Key Exposure

**Attack Vector:**
- File system access to keys directory
- Backup containing keys
- Memory dump

**Current Controls:**
- Private keys stored in `workspace/00_SYSTEM/keys/`
- No API endpoint for key export
- Key rotation with archival

**Planned Controls:**
- HSM integration for production
- Key encryption at rest

**Residual Risk:** Medium (without HSM)

#### I2: PII in Logs

**Attack Vector:**
- Log files containing sensitive data
- Log aggregation systems

**Current Controls:**
```typescript
// lib/log-sanitize.ts
export function sanitize(text: string): string {
  return text
    .replace(/password[=:]\S+/gi, 'password=***')
    .replace(/Bearer\s+\S+/gi, 'Bearer ***')
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '***@***');
}
```

**Residual Risk:** Low

---

### 2.5 Denial of Service

| ID | Threat | Asset | Impact | Likelihood | Risk | Mitigation |
|----|--------|-------|--------|------------|------|------------|
| D1 | **API flooding** | API availability | High | High | High | Rate limiting, 429 responses |
| D2 | **Large file upload** | Storage, memory | Medium | Medium | Medium | 50MB limit, streaming |
| D3 | **Database lock** | SQLite | High | Medium | High | Read-only connections, timeouts |
| D4 | **Ledger growth** | Storage | Medium | Low | Low | Retention policy, cleanup |
| D5 | **Dead letter queue growth** | Disk space | Low | Low | Low | Cleanup cron, monitoring |

#### D1: API Flooding

**Attack Vector:**
- Automated requests to exhaust resources
- Distributed attack

**Current Controls:**
```typescript
// Rate limiting
const RATE_LIMITS = {
  auth: { window: 60_000, max: 10 },
  api: { window: 60_000, max: 100 },
  export: { window: 300_000, max: 5 },
};
```

Response: `429 Too Many Requests` with `Retry-After` header

**Residual Risk:** Medium (single-instance deployment)

---

### 2.6 Elevation of Privilege

| ID | Threat | Asset | Impact | Likelihood | Risk | Mitigation |
|----|--------|-------|--------|------------|------|------------|
| E1 | **RBAC bypass** | Permissions | Critical | Low | High | Deny-by-default, middleware |
| E2 | **Role manipulation** | User roles | Critical | Low | High | Admin-only role assignment |
| E3 | **2-man rule bypass** | Key operations | Critical | Low | Critical | Enforcement in service layer |
| E4 | **Break-glass abuse** | Emergency access | Critical | Low | High | Post-mortem required, alerts |
| E5 | **SQL injection** | Database | Critical | Low | High | Parameterized queries |

#### E1: RBAC Bypass

**Attack Vector:**
- Direct API access without permission check
- Misconfigured route

**Current Controls:**
```typescript
// Deny-by-default middleware
export function requirePermission(permission: Permission) {
  return async (req: NextRequest) => {
    const user = await getSessionUser(req);
    if (!user) return unauthorized();
    if (!hasPermission(user.role, permission)) return forbidden();
    return null; // allow
  };
}
```

- All routes require explicit permission
- Tests verify deny-by-default behavior

**Residual Risk:** Low

#### E3: 2-Man Rule Bypass

**Attack Vector:**
- Single user approving their own request
- System account with both roles

**Current Controls:**
```typescript
// Enforcement in approve handler
if (request.initiator_id === currentUserId) {
  return jsonError(403, 'SELF_APPROVAL_FORBIDDEN', 'Cannot approve own request');
}
```

- Initiator cannot be approver (checked at service layer)
- All approvals logged to ledger

**Residual Risk:** Low

---

## 3. Data Flow Diagrams

### 3.1 Key Rotation Flow

```
┌─────────┐     ┌─────────┐     ┌─────────────┐     ┌─────────┐
│Initiator│     │ API     │     │ Key Service │     │ Ledger  │
└────┬────┘     └────┬────┘     └──────┬──────┘     └────┬────┘
     │               │                 │                  │
     │ POST /requests│                 │                  │
     │──────────────>│                 │                  │
     │               │ createRequest() │                  │
     │               │────────────────>│                  │
     │               │                 │ logEvent()       │
     │               │                 │─────────────────>│
     │               │<────────────────│                  │
     │<──────────────│  request_id     │                  │
     │               │                 │                  │
┌────┴────┐          │                 │                  │
│Approver │          │                 │                  │
└────┬────┘          │                 │                  │
     │ POST /approve │                 │                  │
     │──────────────>│                 │                  │
     │               │ approveRequest()│                  │
     │               │────────────────>│                  │
     │               │                 │ check initiator  │
     │               │                 │ ≠ approver       │
     │               │                 │                  │
     │               │                 │ logEvent()       │
     │               │                 │─────────────────>│
     │               │<────────────────│                  │
     │<──────────────│  approved       │                  │
     │               │                 │                  │
     │ POST /execute │                 │                  │
     │──────────────>│                 │                  │
     │               │ executeRequest()│                  │
     │               │────────────────>│                  │
     │               │                 │ rotateKey()      │
     │               │                 │ logEvent()       │
     │               │                 │─────────────────>│
     │               │<────────────────│                  │
     │<──────────────│  executed       │                  │
```

### 3.2 Evidence Verification Flow

```
┌──────────┐     ┌───────────┐     ┌──────────┐     ┌───────────┐
│ Auditor  │     │ Verify API│     │ Evidence │     │ Key Vault │
└────┬─────┘     └─────┬─────┘     └────┬─────┘     └─────┬─────┘
     │                 │                │                  │
     │ POST /verify    │                │                  │
     │ {hash,sig,key}  │                │                  │
     │────────────────>│                │                  │
     │                 │ getPublicKey() │                  │
     │                 │───────────────────────────────────>│
     │                 │<──────────────────────────────────│
     │                 │                │                  │
     │                 │ verify(hash,   │                  │
     │                 │   signature,   │                  │
     │                 │   publicKey)   │                  │
     │                 │────────────────>                  │
     │                 │<───────────────│                  │
     │<────────────────│                │                  │
     │ {valid: true}   │                │                  │
```

---

## 4. Attack Trees

### 4.1 Compromise Key Lifecycle

```
                    [Compromise Key]
                          │
          ┌───────────────┼───────────────┐
          │               │               │
    [Steal Key]    [Forge Approval]  [Break-Glass]
          │               │               │
    ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐
    │FS Access  │   │Collude 2  │   │ SO Access │
    │ (requires │   │ users     │   │ (detected │
    │  admin)   │   │ (hard)    │   │  post-hoc)│
    └───────────┘   └───────────┘   └───────────┘
```

### 4.2 Tamper with Audit Trail

```
                [Tamper Ledger]
                      │
        ┌─────────────┼─────────────┐
        │             │             │
   [Direct DB]   [App Layer]   [Backup]
        │             │             │
   ┌────┴────┐   ┌────┴────┐   ┌────┴────┐
   │ Admin   │   │ SQL Inj │   │ Access  │
   │ access  │   │ (mitig- │   │ backup  │
   │ (detect-│   │  ated)  │   │ (out of │
   │  able)  │   │         │   │  scope) │
   └─────────┘   └─────────┘   └─────────┘
```

---

## 5. Risk Matrix

| Risk Level | Description | Count | Examples |
|------------|-------------|-------|----------|
| **Critical** | Immediate action required | 2 | S2 (until MFA), E3 (if bypassed) |
| **High** | Short-term remediation needed | 8 | T1, T4, I1, D1, E1, S5, R1, E4 |
| **Medium** | Planned improvements | 6 | S4, T2, I3, I5, D3, E5 |
| **Low** | Acceptable with monitoring | 7 | T3, R2, I2, I4, D4, D5, R3 |

---

## 6. Mitigation Summary

### 6.1 Implemented Controls

| Control | Threats Addressed | Status |
|---------|-------------------|--------|
| RBAC with deny-by-default | E1, E2 | ✅ Implemented |
| 2-man rule enforcement | E3, R1, S5 | ✅ Implemented |
| Hash-chain ledger | T1, R1 | ✅ Implemented |
| Ed25519 signatures | T3, R1, I1 | ✅ Implemented |
| Rate limiting | D1, S2 | ✅ Implemented |
| Path traversal protection | I4 | ✅ Implemented |
| Log sanitization | I2 | ✅ Implemented |
| Default credential fail-fast | S3 | ✅ Implemented |

### 6.2 Planned Controls

| Control | Threats Addressed | Priority | Timeline |
|---------|-------------------|----------|----------|
| MFA (TOTP) | S2, S5 | High | Q2 2026 |
| HSM integration | I1 | High | Q3 2026 |
| Account lockout | S2 | Medium | Q1 2026 |
| CAPTCHA | S2, D1 | Medium | Q2 2026 |
| Anomaly detection | E4, T1 | Medium | Q2 2026 |

---

## 7. Monitoring & Detection

### 7.1 Security Events to Monitor

| Event | Detection Method | Alert Level |
|-------|------------------|-------------|
| Failed login attempts > 5 | Log aggregation | Warning |
| 2-man rule bypass attempt | Ledger event | Critical |
| Break-glass activation | Ledger event | High |
| Ledger chain broken | Verification job | Critical |
| Rate limit exceeded | API response | Info |
| Key operation without approval | Service layer | Critical |
| Policy drift detected | Baseline check | Warning |

### 7.2 Recommended Alerts

```yaml
# alerts-security.yml
alerts:
  - name: failed_logins_spike
    condition: count(failed_login) > 10 in 5m
    severity: warning
    
  - name: ledger_integrity_failure
    condition: verify_ledger.valid == false
    severity: critical
    
  - name: break_glass_activated
    condition: event_type == 'BREAK_GLASS_ACTIVATED'
    severity: high
    
  - name: unauthorized_key_operation
    condition: key_operation without approved_request
    severity: critical
```

---

## 8. Compliance Mapping

| Threat Category | SOC 2 | ISO 27001 | PCI DSS |
|-----------------|-------|-----------|---------|
| Spoofing | CC6.1, CC6.7 | A.9.2.1 | 8.1.1, 8.3 |
| Tampering | CC6.6, CC7.2 | A.12.2.1 | 10.5.5 |
| Repudiation | CC7.2 | A.12.4.1 | 10.2.1 |
| Info Disclosure | CC6.1, CC6.5 | A.8.2.1 | 3.4, 4.1 |
| Denial of Service | CC7.1 | A.12.3.1 | 11.4 |
| Elevation | CC6.3 | A.9.4.1 | 7.1.1 |

---

## 9. Review History

| Date | Reviewer | Changes |
|------|----------|---------|
| 2026-02-02 | Security Team | Initial version |

---

## 10. Appendix: Threat Definitions

### STRIDE Categories

| Category | Definition |
|----------|------------|
| **Spoofing** | Impersonating something or someone else |
| **Tampering** | Modifying data or code |
| **Repudiation** | Claiming to have not performed an action |
| **Information Disclosure** | Exposing information to unauthorized parties |
| **Denial of Service** | Denying or degrading service to users |
| **Elevation of Privilege** | Gaining capabilities without authorization |

### Risk Levels

| Level | Impact | Likelihood | Action |
|-------|--------|------------|--------|
| Critical | Severe | High | Immediate |
| High | Significant | Medium+ | Short-term |
| Medium | Moderate | Medium | Planned |
| Low | Minor | Low | Monitor |
