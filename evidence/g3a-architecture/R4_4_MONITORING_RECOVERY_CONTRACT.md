# R4.4 — MONITORING & RECOVERY CONTROL CONTRACT
**BELLA Deployment Governance Framework**  
**Date:** 2026-08-20  
**Status:** IN PROGRESS

---

## EXECUTIVE SUMMARY

R4.4 completes the production governance loop by adding **detection and recovery** capabilities to the authorization boundary established in R3-R4.3.

**Core Principle:**
```
R4.3 = Prevent unauthorized execution
R4.4 = Detect and recover from execution incidents

Together: Authorize → Execute → Audit → Detect → Recover → Verify
```

---

## SCOPE DEFINITION

### ✅ IN SCOPE

**R4.4.1: Security Monitoring**
- Detect authorization violations
- Alert on security events
- Record security incidents

**R4.4.2: Recovery Control**
- Classify migration failures
- Execute controlled recovery
- Verify recovery success

**R4.4.3: Incident/Recovery Audit**
- Record all incidents
- Track recovery actions
- Link to authorization chain

**R4.4.4: Adversarial Monitoring Tests**
- Simulate attacks
- Verify detection works
- Prove alert delivery

### ❌ OUT OF SCOPE

**NOT Building:**
- Full observability platform
- APM/performance monitoring
- Distributed tracing
- ELK/Loki/Grafana stack
- Static code verification
- E0 artifact verification
- Rollback automation (comprehensive)
- Application-level governance

**Rationale:** Keep R4.4 focused on authorization security and migration recovery only.

---

## R4.4.1 — SECURITY MONITORING

### Objective
Detect and alert on authorization boundary violations.

### Required Detections

**1. Invalid/Forged Token**
```
Event: Token validation fails (signature mismatch)
Detection: validateGateToken() → error
Alert: CRITICAL - Forged token attempt
Audit: token_id, migration_hash, error_type
```

**2. Expired Token**
```
Event: Token past expiration time
Detection: expires_at < NOW()
Alert: WARNING - Expired token attempt
Audit: token_id, expires_at, attempt_time
```

**3. Replay Attack**
```
Event: Token already used (status='used')
Detection: consumeGateToken() → already_used
Alert: CRITICAL - Token replay attempt
Audit: token_id, original_used_at, replay_attempt_time
```

**4. Binding Mismatch**
```
Event: Token hash ≠ migration content hash
Detection: validateGateToken() → hash_mismatch
Alert: CRITICAL - Content substitution attempt
Audit: token_id, expected_hash, actual_hash
```

**5. Unauthorized Executor Invocation**
```
Event: Executor called without valid token
Detection: executeMigration() → NO_TOKEN
Alert: CRITICAL - Bypass attempt
Audit: caller_identity, timestamp, migration_content
```

**6. Approval Rejection**
```
Event: Approval verification fails (8 invariants)
Detection: verifyApproval() → FAIL
Alert: WARNING - Invalid approval
Audit: approval_id, failed_invariants
```

**7. Concurrent Execution Anomaly**
```
Event: Multiple tokens for same approval
Detection: approval_id → multiple token_id (status='issued')
Alert: WARNING - Concurrent execution risk
Audit: approval_id, token_ids, timestamps
```

**8. Unexpected Execution Failure**
```
Event: Migration fails after authorization passed
Detection: executeMigration() → ExecutionFailedError
Alert: ERROR - Migration execution failed
Audit: token_id, error_message, partial_mutations
```

### Detection Implementation

**Minimal Viable Detection:**
```javascript
// R4.4 Detection Layer (wraps R4.3 execution)
async function executeWithMonitoring(params) {
  const incident = {
    incident_id: crypto.randomUUID(),
    timestamp: new Date(),
    type: null,
    severity: null,
    details: {}
  };
  
  try {
    // Execute through R4.3 boundary
    const result = await executeMigration(params);
    
    // Success - no incident
    await auditSuccess(result);
    return result;
    
  } catch (error) {
    // Classify incident
    incident.type = classifyError(error);
    incident.severity = getSeverity(error);
    incident.details = extractDetails(error);
    
    // Record incident
    await recordIncident(incident);
    
    // Alert
    await sendAlert(incident);
    
    // Re-throw for caller
    throw error;
  }
}
```

**NOT implementing:**
- Full SIEM integration
- ML-based anomaly detection
- Correlation engines
- Advanced threat intelligence

### Alert Delivery

**Minimum Requirements:**
- Write to `bella_security_incidents` table
- Console log with severity
- (Optional) Email/Slack webhook

**NOT implementing:**
- PagerDuty integration
- SMS alerts
- Complex escalation chains
- On-call rotation

### Success Criteria

✅ **R4.4.1 PASS when:**
1. All 8 security events can be detected
2. Incidents recorded in audit table
3. Alerts delivered (console + DB minimum)
4. Adversarial tests trigger alerts (8/8)

---

## R4.4.2 — RECOVERY CONTROL

### Objective
Provide controlled recovery path for migration failures.

### Failure Classification

**Type 1: Authorization Failure**
```
Cause: R4.2 or R4.3 gate rejection
State: No database mutation occurred
Recovery: NO RECOVERY NEEDED (fail-closed worked)
Action: Fix authorization, retry
```

**Type 2: Transactional DDL Failure**
```
Cause: DDL syntax error, constraint violation
State: Transaction rolled back (PostgreSQL ACID)
Recovery: NO RECOVERY NEEDED (rollback worked)
Action: Fix migration SQL, get new approval
```

**Type 3: Non-Transactional DDL Failure**
```
Cause: Partial DDL execution (CREATE INDEX CONCURRENTLY, etc.)
State: Partial mutation may exist
Recovery: MANUAL VERIFICATION + CLEANUP
Action: Investigate state, clean up artifacts, retry
```

**Type 4: Execution Environment Failure**
```
Cause: Network timeout, DB crash, OOM
State: Unknown (may have partial mutations)
Recovery: STATE INSPECTION + DECISION
Action: Query database state, classify, decide rollback/forward-fix
```

### Recovery Procedures

**Procedure 1: No Recovery (Fail-Closed)**
```
Authorization FAIL
      ↓
Zero mutations
      ↓
VERIFY: Database pristine
      ↓
CLOSE INCIDENT
```

**Procedure 2: Forward Fix**
```
Partial execution
      ↓
Identify incomplete state
      ↓
Create fix migration
      ↓
Get new approval
      ↓
Execute fix through R4.3
      ↓
VERIFY: Desired state reached
      ↓
CLOSE INCIDENT
```

**Procedure 3: Manual Cleanup**
```
Non-transactional failure
      ↓
Identify artifacts (indexes, constraints)
      ↓
DROP artifacts manually (documented)
      ↓
VERIFY: Clean state
      ↓
Get new approval for retry
      ↓
CLOSE INCIDENT
```

**Procedure 4: Emergency Rollback**
```
Critical failure + data integrity risk
      ↓
Restore from backup (Human GO required)
      ↓
VERIFY: Backup restored
      ↓
INCIDENT: Mark as ROLLED_BACK
      ↓
CLOSE INCIDENT
```

### Recovery Decision Matrix

| Failure Type | Mutation? | Recovery |
|--------------|-----------|----------|
| Authorization FAIL | No | None needed |
| Transactional DDL FAIL | No (rolled back) | None needed |
| Non-Transactional DDL FAIL | Partial | Manual cleanup |
| Environment FAIL | Unknown | Investigate → Decide |
| Data corruption | Yes | Emergency rollback |

### Recovery Runbook Schema

```yaml
incident_id: uuid
migration_id: uuid
approval_id: uuid
token_id: uuid
failure_type: enum
failure_timestamp: timestamp
failure_details: jsonb

recovery_decision:
  type: none | forward_fix | cleanup | rollback
  decided_by: human | system
  decided_at: timestamp
  rationale: text

recovery_actions:
  - action_type: SQL | manual | backup_restore
    action_content: text
    executed_at: timestamp
    executed_by: identity
    result: success | failure

verification:
  verified_at: timestamp
  verified_by: identity
  state: pristine | fixed | rolled_back
  evidence: text

incident_status: open | investigating | recovering | resolved | closed
```

### Success Criteria

✅ **R4.4.2 PASS when:**
1. All 4 failure types can be classified
2. Recovery procedures documented for each type
3. Recovery runbook schema implemented
4. At least 1 recovery tested end-to-end (forward fix)

---

## R4.4.3 — INCIDENT/RECOVERY AUDIT

### Objective
Record complete audit trail for all security incidents and recovery actions.

### Audit Schema

**Table: `bella_security_incidents`**
```sql
CREATE TABLE bella_security_incidents (
  incident_id UUID PRIMARY KEY,
  incident_type TEXT NOT NULL, -- forged_token, replay, bypass, etc.
  severity TEXT NOT NULL, -- CRITICAL, ERROR, WARNING
  
  -- Authorization chain linkage
  migration_id UUID,
  approval_id UUID,
  token_id UUID,
  executor_identity TEXT,
  
  -- Incident details
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  detection_method TEXT NOT NULL, -- validateToken, consumeToken, etc.
  
  error_code TEXT,
  error_message TEXT,
  error_details JSONB,
  
  -- Recovery
  recovery_required BOOLEAN DEFAULT FALSE,
  recovery_status TEXT, -- none, pending, in_progress, completed, failed
  recovery_initiated_at TIMESTAMPTZ,
  recovery_completed_at TIMESTAMPTZ,
  recovery_actions JSONB,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  FOREIGN KEY (approval_id) REFERENCES bella_migration_approvals(approval_id),
  FOREIGN KEY (token_id) REFERENCES bella_gate_tokens(token_id)
);

CREATE INDEX idx_incidents_occurred ON bella_security_incidents(occurred_at DESC);
CREATE INDEX idx_incidents_type ON bella_security_incidents(incident_type);
CREATE INDEX idx_incidents_severity ON bella_security_incidents(severity);
CREATE INDEX idx_incidents_token ON bella_security_incidents(token_id);
```

**Table: `bella_recovery_actions`**
```sql
CREATE TABLE bella_recovery_actions (
  action_id UUID PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES bella_security_incidents(incident_id),
  
  action_sequence INT NOT NULL, -- 1, 2, 3 for multi-step recovery
  action_type TEXT NOT NULL, -- forward_fix, cleanup, rollback, verify
  action_description TEXT NOT NULL,
  action_sql TEXT, -- If SQL-based recovery
  
  executed_at TIMESTAMPTZ,
  executed_by TEXT NOT NULL, -- human or system
  execution_result TEXT, -- success, failure, skipped
  execution_details JSONB,
  
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  verified_by TEXT,
  verification_evidence TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_recovery_incident ON bella_recovery_actions(incident_id);
CREATE INDEX idx_recovery_sequence ON bella_recovery_actions(incident_id, action_sequence);
```

### Audit Requirements

**Every incident MUST record:**
1. Incident type + severity
2. Authorization chain (migration_id, approval_id, token_id)
3. Executor identity
4. Timestamp + detection method
5. Error details (code, message, context)

**Every recovery MUST record:**
1. Recovery decision (type, decided_by, rationale)
2. Recovery actions (sequence, type, SQL)
3. Execution results
4. Verification (evidence, verified_by)
5. Final status

### Success Criteria

✅ **R4.4.3 PASS when:**
1. Schema created and deployed
2. All incidents write to audit tables
3. All recovery actions tracked
4. Can query full incident→recovery→verification chain
5. Audit trail immutable (no DELETE, only INSERT/UPDATE status)

---

## R4.4.4 — ADVERSARIAL MONITORING TESTS

### Objective
Prove detection works by simulating real attacks and failures.

### Test Suite

**Test 1: Forged Token**
```javascript
// Simulate: Developer creates fake token
const fakeToken = {
  token_id: crypto.randomUUID(),
  payload: { approval_id: 'fake' },
  signature: 'invalid_signature'
};

// Execute
await executeMigration({ token: fakeToken, ... });

// Verify
✅ Execution BLOCKED
✅ Incident recorded (type: forged_token, severity: CRITICAL)
✅ Alert sent
✅ No database mutation
```

**Test 2: Replay Attack**
```javascript
// Setup: Use token once
await executeMigration({ token: validToken, ... });

// Attack: Reuse same token
await executeMigration({ token: validToken, ... });

// Verify
✅ Replay BLOCKED
✅ Incident recorded (type: replay_attack, severity: CRITICAL)
✅ Alert sent
✅ No additional mutation
```

**Test 3: Expired Token**
```javascript
// Setup: Create token with past expiration
const expiredToken = await issueGateToken({
  ...params,
  expires_at: new Date(Date.now() - 60000) // 1 min ago
});

// Execute
await executeMigration({ token: expiredToken, ... });

// Verify
✅ Execution BLOCKED
✅ Incident recorded (type: expired_token, severity: WARNING)
✅ Alert sent
```

**Test 4: Binding Mismatch**
```javascript
// Setup: Token for migration A, execute migration B
const tokenA = await issueGateToken({ migration: 'SELECT 1', ... });
const migrationB = 'SELECT 2';

// Execute
await executeMigration({ token: tokenA, migration_content: migrationB });

// Verify
✅ Binding check BLOCKED
✅ Incident recorded (type: binding_mismatch, severity: CRITICAL)
✅ Alert sent
✅ Hash comparison in audit (expected vs actual)
```

**Test 5: Direct Executor Bypass**
```javascript
// Attack: Call executor without going through wrapper
await executeMigration({ /* no token */ });

// Verify
✅ NO_TOKEN check BLOCKED
✅ Incident recorded (type: bypass_attempt, severity: CRITICAL)
✅ Alert sent
```

**Test 6: Invalid Approval**
```javascript
// Setup: Expired approval
const expiredApproval = { ..., expires_at: pastDate };

// Execute wrapper
await executeWithApproval({ approval: expiredApproval, ... });

// Verify
✅ verifyApproval() BLOCKED
✅ Incident recorded (type: invalid_approval, severity: WARNING)
✅ Alert sent
✅ Which invariant failed logged
```

**Test 7: Migration Execution Failure**
```javascript
// Setup: Invalid SQL
const badMigration = 'CREATE TABL typo (id INT)'; // syntax error

// Execute (with valid authorization)
await executeMigration({ token: validToken, migration_content: badMigration });

// Verify
✅ Execution FAILED (PostgreSQL error)
✅ Transaction ROLLED BACK
✅ Incident recorded (type: execution_failure, severity: ERROR)
✅ Alert sent
✅ Error message captured
```

**Test 8: Recovery Flow**
```javascript
// Simulate: Non-transactional DDL partial failure
// (Hard to simulate, manual documentation acceptable)

// Document recovery procedure:
1. Identify partial state
2. Create cleanup SQL
3. Execute cleanup
4. Verify clean state
5. Get new approval
6. Retry

// Verify
✅ Recovery procedure documented
✅ Recovery actions recorded in audit
✅ Verification step included
✅ Incident closed
```

### Test Execution Requirements

**NOT unit tests.**  
**MUST be runtime adversarial tests** (similar to R4.3.3 adversarial tests).

**Each test MUST verify:**
1. ✅ Attack/failure BLOCKED or DETECTED
2. ✅ Incident recorded in `bella_security_incidents`
3. ✅ Alert delivered (console + DB minimum)
4. ✅ Authorization chain intact (no corruption)
5. ✅ Database state correct (no unauthorized mutations)

### Success Criteria

✅ **R4.4.4 PASS when:**
- All 8 tests PASS
- Exit code 0
- No false negatives (all attacks detected)
- No false positives (valid operations not flagged)

---

## DEFINITION OF DONE

R4.4 is COMPLETE when all 4 phases verified:

### R4.4.1: Security Monitoring ✅
- [ ] 8 security events can be detected
- [ ] Incidents recorded in audit table
- [ ] Alerts delivered (console + DB)
- [ ] Detection code integrated with R4.3

### R4.4.2: Recovery Control ✅
- [ ] 4 failure types classified
- [ ] Recovery procedures documented
- [ ] Recovery runbook schema implemented
- [ ] At least 1 end-to-end recovery tested

### R4.4.3: Incident/Recovery Audit ✅
- [ ] `bella_security_incidents` schema created
- [ ] `bella_recovery_actions` schema created
- [ ] All incidents write to audit
- [ ] Full chain queryable

### R4.4.4: Adversarial Tests ✅
- [ ] 8 adversarial tests implemented
- [ ] All tests PASS (Exit 0)
- [ ] Detection proven with real attacks
- [ ] Alert delivery verified

---

## INTEGRATION WITH R3-R4.3

### R4.3 provides enforcement
```
Authorization → Execution
```

### R4.4 provides detection + recovery
```
Execution → Audit → Detect → Recover
```

### Combined loop
```
Developer
    ↓
R3: Database Authority
    ↓
R4.2: Approval Gate
    ↓
R4.3: Execution Boundary
    ↓
[EXECUTION]
    ↓
R4.4: Monitoring (detect violations)
    ↓
R4.4: Recovery (handle failures)
    ↓
R4.4: Audit (record everything)
    ↓
Production Stable
```

---

## ARCHITECTURE ARTIFACTS (TBD)

**Implementation:**
- `scripts/bdgf/r4-4-monitoring.mjs` - Detection + alerting
- `scripts/bdgf/r4-4-recovery.mjs` - Recovery procedures
- `supabase/migrations/20260820_r4_4_monitoring_audit.sql` - Audit schema

**Tests:**
- `scripts/bdgf/r4-4-adversarial-monitoring-test.mjs` - 8 adversarial tests

**Evidence:**
- `evidence/g3a-architecture/R4_4_MONITORING_VERIFICATION.md`

---

## SCOPE BOUNDARY ENFORCEMENT

**If someone proposes:**
- "Let's add full Grafana stack"
- "Let's add distributed tracing"
- "Let's add APM"
- "Let's add ML anomaly detection"

**Response:**
> R4.4 scope is authorization security monitoring + migration recovery ONLY.  
> Full observability → post-MVP backlog.

**R4.4 stays focused:** Detect attacks → Alert → Recover from failures → Close loop.

---

**Contract Status:** ESTABLISHED  
**Date:** 2026-08-20  
**Next:** R4.4.1 Implementation

---
