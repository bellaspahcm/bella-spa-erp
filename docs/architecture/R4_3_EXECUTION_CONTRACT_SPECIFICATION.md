# R4.3 — Execution Gate Contract Specification

**Version:** 1.0.0  
**Status:** 🟢 FROZEN  
**Depends On:** R4.1 FROZEN, R4.2 COMPLETE  
**Date:** 2026-08-20  

---

## Purpose

Define the **execution boundary** that enforces approval gate verification as a **mandatory prerequisite** for migration execution.

**Critical Distinction:**
- R4.2 proves: `verifyApproval()` logic is correct
- R4.3 proves: `verifyApproval()` result **controls execution access**

---

## Execution Boundary Invariants

### E1: No Direct Executor Access
**Invariant:** `bella_migration_executor` credential MUST NOT be directly accessible to developers or automation without passing through execution gate.

**Anti-Pattern:**
```javascript
// ❌ FORBIDDEN - Direct executor access
const executorClient = new Client(DATABASE_EXECUTOR_URL);
await executorClient.query('DROP TABLE important_data;');
```

**Enforcement:**
- bella_migration_executor credential NOT in developer .env
- Execution wrapper is the ONLY interface to executor
- Wrapper calls `verifyApproval()` before executor access

### E2: Gate Result Binding
**Invariant:** Execution gate MUST cryptographically bind approval verification result to execution request with comprehensive field binding.

**Gate Token Requirements:**
1. Token MUST be signed by secrets manager (not environment variable)
2. Token MUST include ALL security-critical fields:
   - `approval_id` (which approval authorized this)
   - `migration_id` (which migration is approved)
   - `migration_hash` (exact content hash - prevents substitution)
   - `target_environment` (where approved to execute)
   - `target_schema` (if schema-scoped)
   - `executor_identity` (who can execute)
   - `execution_attempt_id` (unique per attempt)
   - `issued_at` (when gate opened)
   - `expires_at` (when gate closes - max 60 seconds)
   - `nonce` (unique per token - prevents replay)
3. Token MUST have short TTL (60 seconds max)
4. Token MUST be single-use (stored in database after consumption)
5. Executor MUST independently validate:
   - Token signature (against secrets manager key)
   - Token not expired
   - Token not previously used
   - Migration hash matches actual content
   - Environment matches execution context
   - Executor identity matches caller

**Attack Prevention:**
- ❌ **Token reuse:** Database tracks used tokens (Q1 decision)
- ❌ **Token substitution:** Migration hash binding prevents using token for different migration
- ❌ **Token forgery:** Secrets manager signing key (Q3 decision) not accessible to developers
- ❌ **Replay attack:** Nonce + single-use enforcement
- ❌ **Environment confusion:** Environment binding validated at execution

**Security Boundary:**
```
Approval (database) 
   ↓
verifyApproval() (verification)
   ↓
Gate Token Generation (signed by secrets manager)
   ↓
Gate Token Storage (database, single-use enforcement)
   ↓
Executor Validation (independent verification)
   ↓
bella_migration_executor (mutation)
```

**Critical:** Token is NOT sufficient security boundary alone. Executor MUST independently verify token validity and bindings.

### E3: Fail-Closed Execution
**Invariant:** Any error in gate verification MUST block execution.

**Failure Modes:**
- ❌ Database connection error → BLOCK
- ❌ `verifyApproval()` throws exception → BLOCK
- ❌ Gate result signature invalid → BLOCK
- ❌ Gate result expired → BLOCK
- ❌ Approval not found → BLOCK
- ❌ Network timeout → BLOCK

**Never fail open:** Execution is privilege, not default.

### E4: Atomic Execution
**Invariant:** Migration execution and approval state transitions MUST maintain consistency.

**State Machine (Q2 Decision):**
```
REQUESTED
   ↓
APPROVED
   ↓
EXECUTING (gate opened, token issued)
   ├──→ EXECUTED (migration succeeded, COMMIT)
   └──→ EXECUTION_FAILED (migration failed, ROLLBACK)
```

**Execution Semantics (Q4 Decision):**
1. Migration executes within PostgreSQL transaction
2. On success: COMMIT transaction, mark approval 'executed'
3. On failure: ROLLBACK transaction, mark approval 'execution_failed'

**State Transitions:**
- `approved` → `executing`: When gate token issued
- `executing` → `executed`: When migration COMMIT succeeds
- `executing` → `execution_failed`: When migration ROLLBACK occurs

**Retry Policy:**
- Approval in `executed` state: ❌ CANNOT retry (success already recorded)
- Approval in `execution_failed` state: ⚠️ **Requires new approval** (no automatic retry with same approval)
- **Rationale:** If migration started executing, approval is considered consumed even if failed

**Transaction Limitations (Q4 Clarification):**
- ⚠️ **Not all migrations are transactionally safe:**
  - Some DDL operations may have implicit commits
  - Operations with external side effects (CREATE EXTENSION, file operations)
  - Cross-database operations
  - Non-transactional statements
- Contract does NOT guarantee all migrations rollback cleanly
- Migrations requiring atomic safety MUST be verified compatible with PostgreSQL transaction semantics
- Failed migrations may leave partial state requiring manual intervention

**Execution Wrapper Responsibility:**
```sql
BEGIN;
-- Preflight checks
-- Execute migration content
-- Post-execution verification
COMMIT; -- or ROLLBACK on error
```

### E5: Audit Trail Immutability
**Invariant:** All gate decisions and execution attempts MUST be logged immutably.

**Required Fields:**
- timestamp
- migration_id
- migration_hash
- approval_id (if found)
- gate_decision (PASS/BLOCK)
- block_reason (if BLOCK)
- executor_identity
- execution_result (success/failure)
- execution_error (if failed)

**Storage:** Append-only table, no UPDATE/DELETE allowed.

### E6: Environment Isolation
**Invariant:** Production executor MUST NOT be accessible from non-production environments.

**Enforcement:**
- Separate bella_migration_executor credentials per environment
- Production executor only in production infrastructure
- Gate verifies environment match before execution

---

## Execution Workflow

### Phase 1: Request Approval
```
Developer
   ↓
Migration File (migration.sql)
   ↓
Compute Hash
   ↓
Create Approval Request
   ↓
Status: 'requested'
```

### Phase 2: Approve
```
Authorized Approver
   ↓
Review Migration
   ↓
Approve Request
   ↓
Status: 'approved'
   ↓
Approval Hash Computed (I7)
```

### Phase 3: Execute (Execution Gate)
```
Execution Request
   ↓
Load Migration File
   ↓
Compute Migration Hash
   ↓
Call verifyApproval()
   │
   ├── BLOCK → Log Audit → Stop
   │
   └── PASS
         ↓
   Generate Gate Token (signed, short TTL)
         ↓
   Call bella_migration_executor with Gate Token
         ↓
   Executor validates Gate Token
         ↓
   Execute Migration SQL
         ↓
   Log Execution Result
         ↓
   Update Approval Status: 'executed'
```

---

## Gate Token Specification

**Purpose:** Bind `verifyApproval()` result to execution request, prevent bypass.

**Format:**
```json
{
  "gate": "G2_APPROVAL",
  "decision": "PASS",
  "approval_id": "uuid",
  "migration_id": "M001",
  "migration_hash": "sha256...",
  "target_environment": "production",
  "issued_at": "2026-08-20T12:00:00Z",
  "expires_at": "2026-08-20T12:01:00Z",
  "signature": "hmac-sha256..."
}
```

**Signature:**
```
HMAC-SHA256(
  key: GATE_SIGNING_KEY (secret),
  message: JSON.stringify({
    gate, decision, approval_id, migration_id, 
    migration_hash, target_environment, issued_at, expires_at
  })
)
```

**Validation Rules:**
1. Signature must be valid (HMAC verification)
2. `expires_at` must be in future (max 60 seconds from `issued_at`)
3. `decision` must be "PASS"
4. Token can only be used once (replay prevention)
5. `migration_hash` must match actual migration content
6. `target_environment` must match execution environment

---

## Execution Interface

### Option A: Command-Line Wrapper
```bash
# Request approval
node scripts/bdgf/request-approval.mjs \
  --migration migration.sql \
  --environment production \
  --requester developer@example.com

# Admin approves (separate interface)
node scripts/bdgf/approve-migration.mjs \
  --migration-id M001 \
  --approver admin@example.com

# Execute with gate
node scripts/bdgf/execute-migration.mjs \
  --migration migration.sql \
  --migration-id M001 \
  --environment production
```

**Execution Flow:**
1. `execute-migration.mjs` loads migration file
2. Computes hash
3. Calls `verifyApproval()`
4. If PASS: generates gate token
5. Connects to bella_migration_executor
6. Validates gate token
7. Executes SQL
8. Logs result

### Option B: API Endpoint (Future)
```http
POST /api/migrations/execute
Authorization: Bearer <jwt>

{
  "migration_id": "M001",
  "migration_content": "CREATE TABLE...",
  "environment": "production"
}
```

**For R4.3:** Use Option A (CLI wrapper).

---

## Bypass Prevention

### Bypass Scenario 1: Direct Executor Access
**Attack:** Developer extracts `DATABASE_EXECUTOR_URL` and executes SQL directly.

**Prevention:**
- ❌ E1 violation detection: executor credential not in developer .env
- ✅ Executor credential rotation after deployment
- ✅ Network isolation: executor only accessible from execution gateway

### Bypass Scenario 2: Gate Token Replay
**Attack:** Developer captures valid gate token, replays for different migration.

**Prevention:**
- ✅ E2: Gate token signature includes `migration_hash`
- ✅ E2: Gate token has short TTL (60 seconds)
- ✅ E2: Token single-use (stored in replay prevention table)

### Bypass Scenario 3: Approval Reuse
**Attack:** Developer reuses consumed approval for new migration.

**Prevention:**
- ✅ I3 (from R4.2): Approval marked 'used' after first execution
- ✅ `verifyApproval()` rejects status != 'approved'

### Bypass Scenario 4: Tampered Migration
**Attack:** Developer modifies migration after approval, before execution.

**Prevention:**
- ✅ I1 (from R4.2): Migration hash mismatch detected
- ✅ E2: Gate token includes migration hash, validated at execution

### Bypass Scenario 5: Environment Confusion
**Attack:** Developer uses production approval to execute in staging.

**Prevention:**
- ✅ I5 (from R4.2): Environment mismatch detected
- ✅ E6: Separate executor credentials per environment

---

## Testing Requirements (R4.3)

### Positive Tests
1. ✅ Valid approval → migration executes successfully
2. ✅ Approval status changes: `approved` → `executing` → `executed`
3. ✅ Audit log records execution

### Negative Tests (Bypass Detection)
1. ❌ No approval → execution blocked
2. ❌ Expired approval → execution blocked
3. ❌ Wrong environment approval → execution blocked
4. ❌ Tampered migration (hash mismatch) → execution blocked
5. ❌ Consumed approval (replay) → execution blocked
6. ❌ Direct executor access (no gate) → blocked or detected
7. ❌ Invalid gate token signature → execution blocked
8. ❌ Expired gate token → execution blocked
9. ❌ Gate token replay → execution blocked
10. ❌ Unauthorized approver → execution blocked

### Regression Test
- ✅ R3 baseline still locked (3/3 authorities closed)

---

## Open Questions (RESOLVED)

All questions resolved. Decisions locked:

### Q1: Gate Token Storage → ✅ **B: Database**

**Decision:** Store used gate tokens in `bella_gate_tokens` table.

**Schema:**
```sql
CREATE TABLE bella_gate_tokens (
  token_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES bella_migration_approval(approval_id),
  migration_id VARCHAR(255) NOT NULL,
  migration_hash VARCHAR(64) NOT NULL,
  nonce VARCHAR(64) NOT NULL UNIQUE,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  executor_identity TEXT,
  status VARCHAR(20) NOT NULL CHECK (status IN ('issued', 'used', 'expired')),
  execution_result TEXT -- 'success', 'failed', or NULL if not used
);
```

**Rationale:**
- Persistent audit trail
- Enforceable single-use constraint (nonce UNIQUE)
- Queryable for forensics
- No external dependencies (Redis, cache)

### Q2: Approval State Machine → ✅ **C: EXECUTION_FAILED**

**Decision:** Dedicated `execution_failed` state.

**State Machine:**
```
REQUESTED → APPROVED → EXECUTING → EXECUTED
                          ↓
                    EXECUTION_FAILED
```

**Rationale:**
- Clear state tracking (no ambiguity)
- Prevents replay via revert to 'approved'
- Audit trail shows execution was attempted
- Retry requires new approval (explicit re-authorization)

### Q3: Gate Token Signing Key → ✅ **B: Secrets Manager**

**Decision:** Use secrets manager (not environment variable, not derived from DB credentials).

**Implementation:**
- Development: Can use `.env` for `GATE_SIGNING_KEY` (convenience)
- Production: **MUST use** secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Signing key MUST be rotatable without database migration
- Signing key MUST NOT be accessible to developers

**Security Rationale:**
- Environment variable leak → gate token forgery risk
- DB credential derivation → ties signing key to database access (wrong boundary)
- Secrets manager → independent security boundary, rotatable, audited access

**Contract Requirement:**
```
Production deployment MUST NOT use environment variable for GATE_SIGNING_KEY.
Development MAY use environment variable with explicit security warning.
```

### Q4: Execution Rollback → ✅ **A: PostgreSQL Transaction (with limitations)**

**Decision:** Use PostgreSQL transactions for rollback, but acknowledge limitations.

**Implementation:**
```sql
BEGIN;
  -- Preflight checks
  -- Execute migration SQL
  -- Post-execution verification
COMMIT; -- or ROLLBACK on error
```

**Limitations Acknowledged:**
- Not all DDL is transactional (implicit commits)
- External side effects cannot be rolled back
- Cross-database operations may not rollback atomically
- Some operations (CREATE DATABASE, DROP DATABASE) cannot be in transaction

**Contract Clarification:**
> R4.3 provides transactional rollback for compatible migrations.  
> Migrations with non-transactional operations require explicit marking and handling.  
> Failed migrations may require manual remediation even with ROLLBACK.

**Future Work:** 
- R4.x: Migration compatibility analyzer (detect non-transactional operations)
- R4.x: Pre-execution simulation (dry-run mode)

---

## Definition of Done (R4.3)

R4.3 is COMPLETE when:

1. ✅ Execution contract frozen (this document)
2. ✅ Execution wrapper implemented (`execute-migration.mjs`)
3. ✅ Gate token generation and validation implemented
4. ✅ 10 negative bypass tests BLOCK
5. ✅ 1 positive test PASS
6. ✅ R3 regression test PASS
7. ✅ Audit trail recorded for all executions
8. ✅ Direct executor access cannot bypass gate
9. ✅ Evidence documented

**Critical Test:**
- Developer with DATABASE_URL attempts direct executor access → BLOCKED (credential not available)
- Developer attempts to replay gate token → BLOCKED (token used)
- Developer modifies migration after approval → BLOCKED (hash mismatch)

---

## Next Steps

1. **Freeze this contract** (resolve Q1-Q4, get approval)
2. **Implement execution wrapper** (`scripts/bdgf/execute-migration.mjs`)
3. **Implement gate token** (sign, validate, replay prevention)
4. **Write bypass tests** (10 negative scenarios)
5. **Run E2E test** (request → approve → execute)
6. **Document evidence** (R4_3_TEST_RESULTS.md)
7. **Mark R4.3 COMPLETE**

---

**Status:** 🟢 FROZEN  
**Decisions Locked:** Q1=B, Q2=C, Q3=B, Q4=A (with limitations)  
**Next Action:** Implement execution wrapper  
**Blocker:** None  
**Dependencies:** R4.1 FROZEN ✅, R4.2 COMPLETE ✅

---

## Contract Freeze Summary

**Date:** 2026-08-20  
**Frozen By:** Human architect review + AI implementation  

**6 Execution Invariants:**
- ✅ E1: No Direct Executor Access
- ✅ E2: Gate Result Binding (comprehensive field binding)
- ✅ E3: Fail-Closed Execution
- ✅ E4: Atomic Execution (with state machine + transaction limitations)
- ✅ E5: Audit Trail Immutability
- ✅ E6: Environment Isolation

**4 Design Decisions:**
- ✅ Q1: Gate tokens stored in database (persistent, auditable)
- ✅ Q2: Execution failures transition to `execution_failed` state (no revert)
- ✅ Q3: Signing key from secrets manager (production requirement)
- ✅ Q4: PostgreSQL transactions with acknowledged limitations

**Critical Security Boundary:**
> Approval → verifyApproval() → Gate Token (signed, secrets manager) → Token Storage (single-use, DB) → Executor Validation (independent) → bella_migration_executor → Mutation

**Key Principle:**
> R4.3 proves: Developer who knows the system CANNOT make bella_migration_executor mutate Production without passing the execution gate.

This contract is now **FROZEN**. Implementation may proceed.
