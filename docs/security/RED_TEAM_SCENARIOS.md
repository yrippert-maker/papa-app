# Red Team Scenarios

**Document ID:** SEC-REDTEAM-001  
**Version:** 1.0.0  
**Last Updated:** 2026-02-02  
**Classification:** Internal / Confidential

---

## 1. Purpose

This document defines red team scenarios for testing the security controls of Papa App, with particular focus on:

- Break-glass procedure abuse
- 2-man rule bypass attempts
- Privilege escalation
- Audit trail tampering
- Key compromise scenarios

These scenarios should be executed periodically (quarterly) or after significant system changes.

---

## 2. Red Team Engagement Rules

### 2.1 Scope

| In Scope | Out of Scope |
|----------|--------------|
| All application functionality | Physical security |
| API endpoints | Third-party services (NextAuth provider) |
| Authentication/Authorization | Production data |
| Key management operations | Social engineering of real users |
| Audit trail integrity | DDoS attacks |

### 2.2 Rules of Engagement

1. **Notification**: Security Officer must be notified before engagement
2. **Environment**: Use dedicated test environment only
3. **Data**: Use synthetic test data only
4. **Logging**: All red team actions must be logged
5. **Artifacts**: Preserve all evidence for analysis
6. **Disclosure**: Report findings within 48 hours

---

## 3. Break-Glass Scenarios

### 3.1 Scenario BG-001: Unauthorized Break-Glass Activation

**Objective**: Test if non-Security Officer can activate break-glass

**Setup**:
- User with `COMPLIANCE.MANAGE` but not Security Officer role
- Active key lifecycle request

**Attack Steps**:
1. Authenticate as non-SO user
2. Attempt to call break-glass activation API
3. Observe response and ledger

**Expected Result**:
- 403 Forbidden response
- No break-glass activation
- Attempt logged to ledger

**Test Script**:
```bash
# As regular compliance user
curl -X POST /api/compliance/break-glass \
  -H "Authorization: Bearer $USER_TOKEN" \
  -d '{"reason": "Test unauthorized activation"}' \
  --expect-fail 403
```

**Pass Criteria**:
- [ ] API returns 403
- [ ] `ANOMALY_AUTHZ_BREAK_GLASS_DENIED` logged
- [ ] No system state change

---

### 3.2 Scenario BG-002: Break-Glass Without Post-Mortem

**Objective**: Test enforcement of mandatory post-mortem

**Setup**:
- Valid Security Officer credentials
- Activate break-glass, let it expire

**Attack Steps**:
1. Activate break-glass with valid reason
2. Perform key operation under break-glass
3. Let break-glass expire (4 hours)
4. Attempt normal operations without post-mortem

**Expected Result**:
- System should flag missing post-mortem
- Alerts generated for Security Council
- Repeated break-glass should be blocked

**Pass Criteria**:
- [ ] Post-mortem reminder generated at expiry
- [ ] Alert sent to Security Council after 72 hours
- [ ] Dashboard shows "Post-mortem overdue" status

---

### 3.3 Scenario BG-003: Break-Glass Session Reuse

**Objective**: Test if break-glass session can be reused by another user

**Setup**:
- SO-1 activates break-glass
- SO-2 attempts to use the same session

**Attack Steps**:
1. SO-1 activates break-glass, gets session token
2. Copy session token to SO-2's machine
3. SO-2 attempts key operation with SO-1's session

**Expected Result**:
- Session should be bound to original user
- Operation fails or is logged as SO-1

**Pass Criteria**:
- [ ] Session cannot be transferred
- [ ] All operations logged with correct user ID
- [ ] IP mismatch detected and logged

---

## 4. 2-Man Rule Bypass Scenarios

### 4.1 Scenario 2MR-001: Self-Approval Attempt

**Objective**: Test enforcement of initiator ≠ approver rule

**Setup**:
- User with `COMPLIANCE.MANAGE` permission
- Create a key rotation request

**Attack Steps**:
1. Create key rotation request as User-A
2. Attempt to approve the same request as User-A

**Expected Result**:
- 403 Forbidden with `SELF_APPROVAL_FORBIDDEN`
- Attempt logged to ledger

**Test Script**:
```bash
# Create request
REQUEST_ID=$(curl -X POST /api/compliance/keys/requests \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  -d '{"action": "ROTATE", "reason": "Test"}' | jq -r '.request_id')

# Try to self-approve
curl -X POST "/api/compliance/keys/requests/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $USER_A_TOKEN" \
  --expect-fail 403
```

**Pass Criteria**:
- [ ] API returns 403 `SELF_APPROVAL_FORBIDDEN`
- [ ] Request remains in PENDING state
- [ ] `ANOMALY_AUTHZ_SELF_APPROVAL_ATTEMPT` logged

---

### 4.2 Scenario 2MR-002: Collusion Detection

**Objective**: Test if rapid approval by second user is flagged

**Setup**:
- Two users with `COMPLIANCE.MANAGE`
- Both in same team

**Attack Steps**:
1. User-A creates request
2. User-B approves within 10 seconds
3. Check for collusion warning

**Expected Result**:
- Approval succeeds (policy allows)
- Warning logged for rapid approval
- If policy requires different teams, approval fails

**Pass Criteria**:
- [ ] If same-team allowed: approval with warning
- [ ] If different-team required: 403 `CONSTRAINT_VIOLATION`
- [ ] Timing logged for audit

---

### 4.3 Scenario 2MR-003: Race Condition in Approval

**Objective**: Test concurrent approval attempts

**Setup**:
- One pending request
- Two approvers sending requests simultaneously

**Attack Steps**:
1. Create key rotation request
2. User-B and User-C simultaneously call /approve
3. Check that only one approval succeeds

**Expected Result**:
- Exactly one approval succeeds
- Second attempt gets `ALREADY_APPROVED` or `CONFLICT`

**Test Script**:
```bash
# Parallel approval attempts
curl -X POST "/api/compliance/keys/requests/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $USER_B_TOKEN" &
curl -X POST "/api/compliance/keys/requests/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $USER_C_TOKEN" &
wait
```

**Pass Criteria**:
- [ ] Database transaction prevents double-approval
- [ ] One 200, one 409 or 400 response
- [ ] Final state has exactly one approver

---

## 5. Privilege Escalation Scenarios

### 5.1 Scenario PE-001: Direct Role Modification

**Objective**: Test if user can modify their own role

**Setup**:
- User with `AUDITOR` role
- API endpoint for user management

**Attack Steps**:
1. Authenticate as auditor
2. Attempt to PATCH own user record with `role: "admin"`
3. Check if role changed

**Expected Result**:
- 403 Forbidden (auditor cannot manage users)
- No role change in database

**Pass Criteria**:
- [ ] API returns 403
- [ ] Database role unchanged
- [ ] Attempt logged

---

### 5.2 Scenario PE-002: Permission Injection via JWT

**Objective**: Test if JWT can be modified to add permissions

**Setup**:
- Valid user JWT
- Knowledge of JWT structure

**Attack Steps**:
1. Decode JWT payload
2. Add `"permissions": ["ADMIN.MANAGE_USERS"]` to payload
3. Re-sign with guessed/known secret (or not sign)
4. Use modified JWT

**Expected Result**:
- JWT validation fails (signature mismatch)
- Request rejected with 401

**Pass Criteria**:
- [ ] Modified JWT rejected
- [ ] Original permissions enforced
- [ ] Invalid signature logged

---

### 5.3 Scenario PE-003: E2E_MODE Exploitation

**Objective**: Test if E2E_MODE can be exploited in production

**Setup**:
- Production environment (simulated)
- Attempt to set E2E_MODE

**Attack Steps**:
1. Set `NODE_ENV=production`
2. Set `E2E_MODE=1` but `CI` not set
3. Call protected endpoint

**Expected Result**:
- 503 Service Unavailable
- Safety catch prevents operation

**Pass Criteria**:
- [ ] 503 response with `E2E_MODE_FORBIDDEN`
- [ ] No bypass possible
- [ ] Alert generated

---

## 6. Audit Trail Tampering Scenarios

### 6.1 Scenario AT-001: Direct Database Modification

**Objective**: Test if ledger tampering is detected

**Setup**:
- Direct database access (simulating insider threat)
- Existing ledger events

**Attack Steps**:
1. Connect to SQLite database directly
2. Modify an event's payload or hash
3. Run ledger verification

**Expected Result**:
- Verification fails immediately
- Broken chain reported with event ID

**Test Script**:
```bash
# Tamper with database
sqlite3 workspace/data/papa.db "UPDATE ledger_events SET payload = 'tampered' WHERE id = 5"

# Verify (should fail)
npm run verify:ledger --expect-fail
```

**Pass Criteria**:
- [ ] Verification returns `valid: false`
- [ ] Exact break point identified
- [ ] `ANOMALY_DATA_LEDGER_CHAIN_BROKEN` emitted

---

### 6.2 Scenario AT-002: Event Deletion

**Objective**: Test if event deletion is detected

**Setup**:
- Multiple ledger events
- Direct database access

**Attack Steps**:
1. Delete middle event from ledger
2. Run verification

**Expected Result**:
- Chain verification fails (gap detected)
- Subsequent events have wrong previous_hash

**Pass Criteria**:
- [ ] Deletion detected via chain break
- [ ] Cannot "heal" chain without detection

---

### 6.3 Scenario AT-003: Append-Only Violation

**Objective**: Test if inserting events in middle is detected

**Setup**:
- Ledger with events 1-10
- Attempt to insert event between 5 and 6

**Attack Steps**:
1. Insert new event with ID 5.5 (or renumber)
2. Try to fix hashes manually

**Expected Result**:
- Original events' signatures still invalid
- Hash chain computation reveals tampering

**Pass Criteria**:
- [ ] Inserted events don't have valid signatures
- [ ] Chain integrity check fails
- [ ] Temporal analysis shows anomaly

---

## 7. Key Compromise Scenarios

### 7.1 Scenario KC-001: Private Key Extraction

**Objective**: Test protection of private keys

**Setup**:
- Running application
- API access

**Attack Steps**:
1. Search all API endpoints for key exposure
2. Check error messages for key material
3. Attempt path traversal to keys directory
4. Check if keys are in backups/logs

**Expected Result**:
- No API exposes private keys
- Error messages sanitized
- Path traversal blocked
- Keys not in logs

**Pass Criteria**:
- [ ] No private key in any API response
- [ ] Path traversal returns 400
- [ ] Log search shows no key material

---

### 7.2 Scenario KC-002: Key Usage After Revocation

**Objective**: Test if revoked key can still sign

**Setup**:
- Active key for signing
- Revoke the key
- Attempt to sign new evidence

**Attack Steps**:
1. Generate evidence with active key
2. Revoke the key
3. Attempt to generate new evidence
4. Verify old evidence still validates

**Expected Result**:
- New signing fails (no active key)
- Old signatures still valid (historical)
- Verification shows key was revoked

**Pass Criteria**:
- [ ] New operations fail without active key
- [ ] Old signatures remain valid
- [ ] Verification includes revocation status

---

## 8. Execution Schedule

| Quarter | Focus Area | Scenarios |
|---------|------------|-----------|
| Q1 | Break-Glass | BG-001, BG-002, BG-003 |
| Q2 | 2-Man Rule | 2MR-001, 2MR-002, 2MR-003 |
| Q3 | Privilege Escalation | PE-001, PE-002, PE-003 |
| Q4 | Audit & Keys | AT-001, AT-002, KC-001 |

---

## 9. Reporting Template

```markdown
# Red Team Engagement Report

## Engagement Details
- **Date**: YYYY-MM-DD
- **Team**: [Names]
- **Environment**: [Test/Staging]
- **Scenarios Executed**: [List]

## Executive Summary
[2-3 sentences on overall findings]

## Findings

### Finding 1: [Title]
- **Scenario**: [ID]
- **Severity**: [Critical/High/Medium/Low]
- **Status**: [Pass/Fail/Partial]
- **Description**: [What was found]
- **Evidence**: [Screenshots/Logs]
- **Recommendation**: [Fix suggestion]

## Metrics
- Scenarios Executed: X
- Pass: X
- Fail: X
- Partial: X

## Recommendations
1. [Prioritized list]

## Sign-off
- Red Team Lead: _____________ Date: _______
- Security Officer: _____________ Date: _______
```

---

## 10. Post-Engagement Actions

1. **Immediate** (within 24 hours):
   - Document all findings
   - Report critical vulnerabilities
   
2. **Short-term** (within 1 week):
   - Create tickets for all findings
   - Prioritize remediation
   
3. **Medium-term** (within 1 month):
   - Remediate high/critical findings
   - Re-test failed scenarios
   
4. **Long-term** (next quarter):
   - Update threat model
   - Refine scenarios based on learnings

---

## 11. Change Log

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-02 | Initial release |
