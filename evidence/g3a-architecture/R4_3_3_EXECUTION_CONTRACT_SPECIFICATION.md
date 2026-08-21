# R4.3.3 — EXECUTION WRAPPER CONTRACT SPECIFICATION

**Status:** � FROZEN  
**Created:** 2026-08-20  
**Frozen:** 2026-08-20  
**Phase:** R4.3 Execution Gate Integration  

---

## EXECUTIVE SUMMARY

This contract defines the **Execution Boundary** between authorization (R4.1, R4.2) and mutation (bella_migration_executor). The wrapper is NOT merely a "recommended path" but the ONLY path through which Production mutations can occur.

**Core Principle:**
```
WITHOUT VALID AUTHORIZATION → NO MUTATION POSSIBLE
```

Not:
> "Developer doesn't know credentials"

But:
> "Executor REFUSES to mutate without valid gate token"

---

## INVARIANTS (E1-E6)

### E1: Executor Authorization Boundary (CRITICAL)

**Statement:** bella_migration_executor role CANNOT execute database mutations without valid execution authorization.

**Technical Enforcement:**

**MVP (R4.3):**
- Every execution entry point in `migration-executor.mjs` MUST validate + consume gate token before opening execution database connection
- Invalid/missing/expired/consumed token → BLOCK immediately
- Token validation failure → NO database connection opened, NO DDL executed
- Executor code explicitly checks token at entry point
- Token validation failure → hard exit before any DB operation

**Production (Post-R4.3):**
- Executor MUST be deployed in isolated service/network boundary
- Developer CANNOT directly invoke executor or possess executor credentials
- Network-level isolation enforces authorization boundary
- Examples: Supabase Edge Function with IAM, Lambda with API Gateway, dedicated migration service

**NOT Acceptable (MVP or Production):**
- "Developer doesn't know executor credentials" (security by obscurity)
- "Wrapper is the documented way" (bypass still possible via filesystem/direct call)
- "RLS will block most things" (not all DDL respects RLS, and executor NEEDS mutation permission)

**MVP Limitation Acknowledged:**
- Executor is script on filesystem
- Someone with file system access could attempt direct invocation
- Defense: Script refuses to run without valid token (code-level enforcement)
- This is acceptable for R4.3 verification
- Production MUST upgrade to network-isolated service

**Verification:**
- 10 bypass tests MUST all BLOCK
- Direct executor invocation without token → BLOCK
- Forged/expired/consumed token → BLOCK
- Valid token with wrong binding → BLOCK

---

### E2: Single-Use Token (Already Proven)

**Statement:** Gate token can be consumed at most once.

**Enforcement:** Atomic UPDATE in consumeGateToken() (R4.3.2 verified)

**Evidence:** R4.3.2 Test 15-17 PASS (concurrent double-consume blocked)

**No Additional Work Required:** R4.3.2 already proved this.

---

### E3: Approval Verification Precedes Token Issuance

**Statement:** Gate token MUST NOT be issued unless approval verification passes.

**Enforcement Flow:**
```
Developer Request
    ↓
verifyApproval(approval_id, migration_hash, ...) [R4.2]
    ↓
Decision: PASS or BLOCK
    ↓
IF BLOCK → return immediately, NO token issued
    ↓
IF PASS → issueGateToken() [R4.3.2]
```

**Verification:**
- Positive E2E: Valid approval → Token issued → Execute succeeds
- Negative: Invalid approval → NO token issued → NO execution

---

### E4: Token Consumption Precedes Execution

**Statement:** Migration execution MUST NOT begin unless gate token is successfully consumed.

**Enforcement Flow:**
```
Executor receives token
    ↓
validateGateToken(token, executionContext) [R4.3.2]
    ↓
IF invalid → BLOCK immediately
    ↓
IF valid → consumeGateToken(token.nonce) [R4.3.2]
    ↓
IF consume fails (already used) → BLOCK
    ↓
IF consume succeeds → BEGIN MUTATION
```

**Critical:** Consume BEFORE mutation, not after. Prevents replay if mutation fails.

---

### E5: Execution Audit Trail

**Statement:** All execution attempts MUST be recorded in append-only audit log.

**Events to Audit:**
1. `AUTHORIZATION_CHECK` - verifyApproval() called
2. `TOKEN_ISSUED` - issueGateToken() succeeded
3. `TOKEN_VALIDATED` - validateGateToken() called
4. `TOKEN_CONSUMED` - consumeGateToken() succeeded
5. `EXECUTION_STARTED` - DDL execution began
6. `EXECUTION_SUCCEEDED` - DDL committed successfully
7. `EXECUTION_FAILED` - DDL failed, error recorded
8. `EXECUTION_BLOCKED` - Authorization failed, no execution

**Storage:** bella_execution_audit table (append-only, R4.3.1 verified)

**Immutability:** No UPDATE/DELETE allowed (trigger enforcement, R4.3.1 Test 12-13)

---

### E6: Fail-Closed Execution

**Statement:** Any error in authorization/validation chain MUST block execution.

**Error Scenarios:**
- Approval verification fails → BLOCK
- Token issuance fails → BLOCK
- Token validation fails → BLOCK
- Token consumption fails (already used) → BLOCK
- Token expired → BLOCK
- Binding mismatch → BLOCK
- Database connection error → BLOCK
- ANY unexpected error → BLOCK (no fallthrough)

**NOT Acceptable:**
- "Try token validation, if fails then try direct execution"
- "Log error but proceed anyway"
- "Default to allowing execution on error"

**IS Acceptable:**
- Hard exit on any validation failure
- Return error to caller
- NO mutation on error path

---

## ARCHITECTURE DECISIONS

### Q1: Executor Invocation Method

**Decision:** **C - Isolated Execution Boundary**

**Options Considered:**

**A. Direct Database Connection**
- ❌ REJECTED: Developer with bella_migration_executor credentials could bypass wrapper
- ❌ REJECTED: Credentials in environment → security by obscurity

**B. Application-Enforced (Session Variable)**
- ⚠️ RISKY: If executor has DB access, session var could be forged
- ⚠️ RISKY: Wrapper becomes "recommended path", not "only path"
- ⚠️ REJECTED for Production

**C. Isolated Execution Boundary** ✅ SELECTED
- ✅ Executor is separate process/service/function
- ✅ Executor endpoint/credentials NOT exposed to developer
- ✅ Only wrapper can invoke executor
- ✅ Token passed as explicit parameter
- ✅ Executor validates token before ANY operation

**Implementation Note for R4.3 MVP:**
- For testing, executor can be a separate script: `scripts/bdgf/migration-executor.mjs`
- Script REFUSES to run without valid token parameter
- Script validates token BEFORE opening DB connection
- Script exits immediately if token invalid

**Production Evolution:**
- Supabase Edge Function with restricted access
- Or separate Lambda/Cloud Function
- Or dedicated migration service
- Principle remains: Isolated boundary, token-gated

---

### Q2: Token Transmission

**Decision:** **Explicit Parameter (NOT Environment Variable)**

**Rationale:**
- Token MUST be passed directly in execution request
- NOT via environment variable (can persist, be logged, be cached)
- NOT via config file (same issues)
- NOT via database query (circular dependency)

**Implementation:**
```javascript
// Wrapper
const token = await issueGateToken(...);
const result = await executeWithToken({
  token,                    // Explicit parameter
  migration_content,
  target_environment,
  target_schema
});

// Executor
async function executeWithToken(params) {
  const { token, migration_content, ... } = params;
  
  // Validate token FIRST
  const validation = await validateGateToken(token, executionContext);
  if (!validation.valid) {
    throw new Error('EXECUTION_BLOCKED: Invalid token');
  }
  
  // Consume token SECOND
  const consumption = await consumeGateToken(token.payload.nonce);
  if (!consumption.consumed) {
    throw new Error('EXECUTION_BLOCKED: Token already used');
  }
  
  // Execute THIRD (only if above succeeded)
  return await executeMigration(migration_content);
}
```

---

### Q3: Failure Handling

**Decision:** **Fail-Closed + Transaction Where Possible**

**Authorization Failure:**
```
verifyApproval() → BLOCK
    ↓
NO token issued
NO execution attempted
Return: { status: 'BLOCKED', reason: 'APPROVAL_INVALID' }
```

**Migration Execution Failure:**
```
DDL fails (syntax error, constraint violation, etc.)
    ↓
Transaction rollback (if transactional DDL)
    ↓
Update approval: execution_error = <error message>
Insert audit: event = 'EXECUTION_FAILED'
Token: status remains 'used' (consumed but failed)
Return: { status: 'FAILED', error: <details> }
```

**Critical Caveat (R4.3 Q4 from prior contract):**
- PostgreSQL: Some DDL is transactional, some is not
- CREATE INDEX CONCURRENTLY: NOT rollbackable
- CREATE DATABASE: NOT rollbackable
- Most ALTER TABLE: transactional
- Wrapper CANNOT assume all failures rollback
- Must document which DDLs have partial execution risk

**For R4.3 MVP:**
- Attempt transaction wrapper: `BEGIN; <DDL>; COMMIT;`
- If DDL fails → rollback
- If rollback also fails → record as PARTIAL_FAILURE
- Do NOT automatically retry

---

### Q4: Audit Granularity

**Decision:** **Pre-Execution + Post-Execution + Status Transitions**

**Minimum Required Events:**

| Event | Timing | Recorded Data |
|-------|--------|---------------|
| AUTHORIZATION_CHECK | After verifyApproval() | approval_id, decision, reason |
| TOKEN_ISSUED | After issueGateToken() | token_id, approval_id, nonce |
| EXECUTION_STARTED | Before DDL execution | token_id, migration_hash, started_at |
| EXECUTION_SUCCEEDED | After successful COMMIT | token_id, completed_at, rows_affected (if applicable) |
| EXECUTION_FAILED | After failure/rollback | token_id, error_message, failed_at |
| EXECUTION_BLOCKED | Authorization/token failure | reason, blocked_at |

**Storage:**
- Table: `bella_execution_audit`
- Append-only (R4.3.1 verified)
- No UPDATE/DELETE (trigger enforced)

**NOT Audited (out of R4.3 scope):**
- Individual DDL statements within migration
- Row-level changes (too verbose)
- Performance metrics (nice-to-have)

---

## EXECUTION BOUNDARY ENFORCEMENT

### Technical Implementation

**Principle:** Token validation is MANDATORY, not optional.

**Code Structure:**
```javascript
// migration-executor.mjs
export async function executeMigration(params) {
  // ============================================================
  // GATE TOKEN VALIDATION — NO BYPASS ALLOWED
  // ============================================================
  
  const { token, migration_content, target_environment, target_schema } = params;
  
  // HARD CHECK: Token must exist
  if (!token || !token.payload || !token.signature) {
    throw new ExecutionBlockedError('NO_TOKEN', 'Token required for execution');
  }
  
  // Build execution context
  const executionContext = {
    migration_hash: computeHash(migration_content),
    target_environment,
    target_schema,
    executor_identity: 'bella_migration_executor'
  };
  
  // HARD CHECK: Token must be valid
  const validation = await validateGateToken(token, executionContext, db);
  if (!validation.valid) {
    await auditEvent('EXECUTION_BLOCKED', {
      reason: 'TOKEN_INVALID',
      details: validation.reason
    });
    throw new ExecutionBlockedError('TOKEN_INVALID', validation.reason);
  }
  
  // HARD CHECK: Token must be consumable (not already used)
  const consumption = await consumeGateToken(token.payload.nonce, db);
  if (!consumption.consumed) {
    await auditEvent('EXECUTION_BLOCKED', {
      reason: 'TOKEN_ALREADY_USED',
      details: consumption.reason
    });
    throw new ExecutionBlockedError('TOKEN_ALREADY_USED', consumption.reason);
  }
  
  // ============================================================
  // AUTHORIZATION PASSED — PROCEED WITH EXECUTION
  // ============================================================
  
  await auditEvent('EXECUTION_STARTED', {
    token_id: token.token_id,
    migration_hash: executionContext.migration_hash
  });
  
  try {
    // Execute DDL
    const result = await db.query(migration_content);
    
    await auditEvent('EXECUTION_SUCCEEDED', {
      token_id: token.token_id,
      rows_affected: result.rowCount
    });
    
    return { status: 'SUCCESS', result };
    
  } catch (error) {
    await auditEvent('EXECUTION_FAILED', {
      token_id: token.token_id,
      error: error.message
    });
    
    throw new ExecutionFailedError(error.message);
  }
}

// Custom error classes for clarity
class ExecutionBlockedError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
    this.name = 'ExecutionBlockedError';
  }
}

class ExecutionFailedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExecutionFailedError';
  }
}
```

**Key Properties:**
1. No code path bypasses token validation
2. Validation failure throws immediately (no execution)
3. Consumption happens BEFORE mutation
4. All state transitions audited
5. Errors are specific and actionable

---

## VERIFICATION REQUIREMENTS

### Positive E2E Tests (4 scenarios)

**File:** `scripts/bdgf/r4-3-3-positive-e2e-test.mjs`

1. ✅ **Valid Flow End-to-End**
   - Create approval (status='approved')
   - Call wrapper with approval_id + migration_content
   - Verify: Token issued, validation passed, consumption succeeded, DDL executed
   - Check: bella_execution_audit has EXECUTION_STARTED + EXECUTION_SUCCEEDED
   - Check: bella_migration_approval.execution_completed_at is set
   - Check: bella_gate_tokens.status = 'used'

2. ✅ **Invalid Approval → No Execution**
   - Create approval (status='pending')
   - Call wrapper
   - Verify: NO token issued, NO execution, audit shows AUTHORIZATION_CHECK failed

3. ✅ **Token Validation Failure → No Execution**
   - Create approval
   - Issue token
   - Tamper with token signature
   - Call executor directly
   - Verify: Token validation fails, NO execution, audit shows EXECUTION_BLOCKED

4. ✅ **Execution Failure → Rollback**
   - Create approval
   - Issue token
   - Provide invalid DDL (syntax error)
   - Call executor
   - Verify: Execution fails, token marked 'used', audit shows EXECUTION_FAILED
   - Check: No partial mutations (if DDL is transactional)

**Expected:** 4/4 PASS

---

### Bypass / Adversarial Tests (11 scenarios)

**File:** `scripts/bdgf/r4-3-3-bypass-test.mjs`

**Objective:** Prove NO path exists to execute migration without valid authorization.

1. ❌ **Direct Executor Call (No Wrapper)**
   - Call migration-executor.mjs directly without going through wrapper
   - NO token provided
   - Expected: EXECUTION_BLOCKED, error 'NO_TOKEN'

2. ❌ **Executor Without Token**
   - Call executor with migration_content but token=null
   - Expected: EXECUTION_BLOCKED, error 'NO_TOKEN'

3. ❌ **Executor With Invalid Token (Forged Signature)**
   - Create fake token with wrong signature
   - Call executor
   - Expected: EXECUTION_BLOCKED, error 'TOKEN_INVALID'

4. ❌ **Executor With Expired Token**
   - Issue token with 2-second TTL
   - Wait 3 seconds
   - Call executor
   - Expected: EXECUTION_BLOCKED, error 'TOKEN_EXPIRED'

5. ❌ **Executor With Consumed Token (Replay)**
   - Issue token
   - Execute successfully (consume token)
   - Try to execute again with same token
   - Expected: EXECUTION_BLOCKED, error 'TOKEN_ALREADY_USED'

6. ❌ **Token for Different Migration**
   - Issue token for migration A (hash_A)
   - Try to execute migration B (hash_B) with token A
   - Expected: EXECUTION_BLOCKED, error 'MIGRATION_HASH_MISMATCH'

7. ❌ **Direct Executor Credential Invocation**
   - Possess valid bella_migration_executor credentials (username/password or connection string)
   - NO gate token
   - Attempt to call executor entry point directly (bypass wrapper)
   - Expected: EXECUTION_BLOCKED at executor entry point
   - Executor MUST NOT open execution DB connection
   - Executor MUST NOT execute any DDL
   - **This test proves E1**: Credential alone is insufficient, token is required

8. ❌ **Token With Wrong Executor Identity**
   - Issue token with executor_identity='bella_migration_executor'
   - Try to execute with executor_identity='malicious_executor' in execution context
   - Expected: EXECUTION_BLOCKED, error 'EXECUTOR_IDENTITY_MISMATCH'

9. ❌ **Token With Wrong Environment/Schema**
   - Issue token for environment='staging', schema='public'
   - Try to execute in environment='production', schema='public'
   - Expected: EXECUTION_BLOCKED, error 'ENVIRONMENT_MISMATCH'

10. ❌ **Concurrent Execution Same Token**
    - Issue token
    - Launch 2 parallel execution requests with same token
    - Expected: Only 1 succeeds (consumeGateToken is atomic, R4.3.2 verified)
    - Second request: EXECUTION_BLOCKED, error 'TOKEN_ALREADY_USED'

11. ❌ **TOCTOU / Concurrent Same Approval**
    - Create approved migration
    - Launch 2 parallel wrapper requests with same approval_id
    - Both call verifyApproval() → both PASS
    - Both call issueGateToken() → both get tokens
    - Both call executor → race to consumeGateToken()
    - Expected: Only 1 execution succeeds end-to-end
    - Second execution: EXECUTION_BLOCKED at token consumption (already used)
    - **This tests entire authorization chain, not just consumeGateToken()**

**Expected:** 11/11 attacks BLOCKED

---

### R3 Regression Test

**File:** `scripts/bdgf/r3-simple-test.mjs`

**Objective:** Prove R4.3.3 does NOT break R3 baseline.

**Expected:** 8/8 PASS

**Critical:** If ANY R3 test fails, R4.3.3 has introduced a regression and MUST be fixed before proceeding.

---

## DEPENDENCIES

### Input from Prior Phases

**R4.2 — Approval Gate:**
- ✅ verifyApproval() function (25/25 tests)
- Input: approval_id, migration_hash, target_environment
- Output: { decision: 'PASS' | 'BLOCK', reason, evidence }

**R4.3.2 — Gate Token Module:**
- ✅ issueGateToken() function (17/17 tests)
- ✅ validateGateToken() function
- ✅ consumeGateToken() function (atomic, single-use verified)
- ✅ verifyTokenBinding() function

**R4.3.1 — Schema:**
- ✅ bella_gate_tokens table
- ✅ bella_execution_audit table (append-only)
- ✅ bella_migration_approval table (extended)

**All dependencies VERIFIED and FROZEN.**

---

## IMPLEMENTATION SEQUENCE

### Phase 1: Contract Freeze (NOW)

- [ ] Review this contract
- [ ] Address any questions/concerns
- [ ] Freeze contract (no changes after this point)
- [ ] Create `R4_3_3_CONTRACT_FROZEN.md` marker file

### Phase 2: Wrapper Implementation

**Files to Create:**
1. `scripts/bdgf/execute-migration-wrapper.mjs` - Orchestration
2. `scripts/bdgf/migration-executor.mjs` - Isolated executor with token gate

**Key Functions:**
- `executeMigrationWrapper(params)` - Main entry point
- `executeMigration(params)` - Executor with token validation

### Phase 3: Positive E2E Tests

**File:** `scripts/bdgf/r4-3-3-positive-e2e-test.mjs`

**Expected:** 4/4 PASS

### Phase 4: Bypass Tests

**File:** `scripts/bdgf/r4-3-3-bypass-test.mjs`

**Expected:** 11/11 BLOCKED

### Phase 5: R3 Regression

**Command:** `node scripts/bdgf/r3-simple-test.mjs`

**Expected:** 8/8 PASS

### Phase 6: Evidence Documentation

**File:** `evidence/g3a-architecture/R4_3_3_EXECUTION_WRAPPER_VERIFICATION.md`

**Must Include:**
- E2E test results (4/4)
- Bypass test results (10/10)
- R3 regression results (8/8)
- Architecture decision rationale
- Known limitations
- Production readiness assessment

---

## KNOWN LIMITATIONS

### 1. DDL Transaction Semantics

**Issue:** Not all PostgreSQL DDL is transactional.

**Examples:**
- CREATE INDEX CONCURRENTLY - NOT rollbackable
- CREATE DATABASE - NOT rollbackable
- VACUUM - NOT rollbackable

**Mitigation:**
- Document non-transactional DDL clearly
- Do NOT assume automatic rollback
- Consider pre-execution validation for high-risk DDL

**Out of Scope for R4.3:**
- DDL-specific rollback strategies
- Partial execution recovery
- Multi-statement migration atomicity beyond transaction wrapper

### 2. Executor Isolation (MVP vs Production)

**MVP Approach:**
- Executor is separate script
- Script refuses to run without token
- Sufficient for R4.3 verification

**Production Evolution Needed:**
- Supabase Edge Function with restricted access
- Or dedicated Lambda/Cloud Function with IAM enforcement
- Or separate migration service with API gateway

**Gap:** MVP executor script could still be called if someone has file system access. Production MUST use network-isolated service.

### 3. Token Rotation Not Implemented

**Issue:** Signing key cannot be rotated without invalidating all issued tokens.

**Impact:** If key compromised, must rotate AND invalidate all active tokens.

**Mitigation:** Short TTL (60s max) limits exposure window.

**Out of Scope for R4.3.**

### 4. No Token Revocation Before Expiry

**Issue:** Cannot revoke specific token before natural expiry.

**Impact:** If token leaked, must wait up to 60 seconds for expiry.

**Mitigation:** Acceptable for R4.3 given short TTL.

**Future:** Add revocation API if longer TTLs needed.

### 5. Single Executor Role

**Issue:** No differentiation between executor types (DDL vs DML vs admin).

**Impact:** bella_migration_executor has same permissions for all migrations.

**Mitigation:** Future work - multiple executor roles with different permissions.

**Out of Scope for R4.3.**

---

## SUCCESS CRITERIA

R4.3.3 is COMPLETE when:

1. ✅ Contract frozen (this document)
2. ✅ Wrapper implemented (execute-migration-wrapper.mjs)
3. ✅ Executor implemented (migration-executor.mjs with token gate)
4. ✅ Positive E2E: 4/4 PASS
5. ✅ Bypass tests: 11/11 BLOCKED
6. ✅ R3 regression: 8/8 PASS
7. ✅ Evidence documented
8. ✅ Executor with valid credentials but no token → BLOCKED
9. ✅ Token valid but wrong migration/environment/schema/identity → BLOCKED
10. ✅ Token consumed only once (even with concurrent requests)
11. ✅ Audit append-only functional
12. ✅ No mutation before authorization boundary

**Critical Proof Points:**

**R4.3.2 proved:** "Gate token cannot be forged, tampered, or replayed"

**R4.3.3 must prove:** "Executor cannot use mutation permission without valid gate token"

Specifically:
- Executor has bella_migration_executor credentials (full mutation permission)
- Executor called WITHOUT token → REFUSES to open DB connection → NO mutation
- Executor called WITH invalid token → REFUSES to open DB connection → NO mutation
- Executor called WITH valid token → validates → consumes → THEN opens DB connection → mutation allowed

Not:
> "Wrapper is the documented way to execute migrations"

But:
> "Wrapper is the ONLY way to execute migrations"

---

## NEXT PHASE

**R4.3.4 — E2E Integration & Production Readiness**

After R4.3.3 verified, final phase includes:
- Full end-to-end workflow test (developer request → execution → audit)
- Production deployment checklist
- Secrets Manager integration (replace .env)
- Monitoring/alerting setup
- Runbook for emergency scenarios

---

## SIGNATURE

**Contract Author:** Kiro (Autonomous Agent)  
**Date:** 2026-08-20  
**Status:** � FROZEN  
**Approved By:** Human Architect (@user)  

**Review History:**
- 2026-08-20: Draft created
- 2026-08-20: E1 enforcement clarified (MVP vs Production)
- 2026-08-20: Test #7 changed to direct executor credential test
- 2026-08-20: Test #11 added (TOCTOU concurrent approval)
- 2026-08-20: **FROZEN** - ready for implementation

**Contract Version:** 1.0-frozen  
**Supersedes:** None (first R4.3.3 contract)

---

**END OF CONTRACT SPECIFICATION**

**✅ CONTRACT FROZEN — IMPLEMENTATION MAY BEGIN ✅**
