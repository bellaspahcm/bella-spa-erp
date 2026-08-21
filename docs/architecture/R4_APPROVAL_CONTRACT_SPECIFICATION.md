# R4.1 — Approval Contract Specification

**Date:** 2026-08-20 19:15  
**Status:** 🟢 FROZEN  
**Version:** 1.0.0  
**Phase:** R4 — Migration Execution Gate Framework

---

## 🎯 PURPOSE

Transform approval from "human record" into **machine-enforceable authorization**.

### Current State (R2)

Approval exists in `bella_migration_approval` table:
- Manual INSERT by human
- No automated verification
- No binding to migration identity
- No replay protection
- No expiration

### Target State (R4.1)

Approval becomes **hard gate**:
- Machine-verifiable contract
- Cryptographic binding to migration
- Replay protection
- Time-bound validity
- Automated verification before execution

---

## 📜 APPROVAL CONTRACT SCHEMA

### Core Fields

```typescript
interface ApprovalContract {
  // Identity
  approval_id: string;           // UUID v4 — unique approval identifier
  migration_id: string;          // Migration identifier (e.g., "M001", "20240820_add_column")
  migration_hash: string;        // SHA-256 hash of migration content
  
  // Authorization
  requester_id: string;          // User ID of requester (who created request)
  approver_id: string;           // User ID of approver
  approver_role: ApproverRole;   // Role at time of approval
  approved_at: timestamp;        // When approval granted
  
  // Scope
  target_environment: Environment; // production | staging | dev
  target_schema?: string;         // Optional schema restriction
  
  // Validity
  expires_at: timestamp;         // Approval expiration
  valid_from?: timestamp;        // Optional: earliest execution time
  valid_until?: timestamp;       // Optional: latest execution time
  
  // State
  status: ApprovalStatus;        // pending | approved | revoked | used | expired
  used_at?: timestamp;           // When approval was consumed
  used_by?: string;              // Executor that consumed approval
  
  // Integrity
  approval_hash: string;         // Hash of this approval record (tamper detection)
  signature?: string;            // Optional: cryptographic signature
  
  // Audit
  created_by: string;            // Who created approval request
  created_at: timestamp;         // When request created
  notes?: string;                // Human context (why approval needed)
}
```

---

### Enums

```typescript
enum ApproverRole {
  ADMIN = 'admin',
  DBA = 'dba',
  TECH_LEAD = 'tech_lead',
  EMERGENCY_OVERRIDE = 'emergency_override'
}

enum Environment {
  PRODUCTION = 'production',
  STAGING = 'staging',
  DEV = 'dev'
}

enum ApprovalStatus {
  PENDING = 'pending',      // Awaiting approval
  APPROVED = 'approved',    // Approved but not yet used
  USED = 'used',            // Consumed by execution
  REVOKED = 'revoked',      // Manually revoked
  EXPIRED = 'expired'       // Passed expiration time
}
```

---

## 🔒 CONTRACT INVARIANTS

### I0: No Self-Approval (NEW - CRITICAL)

**Invariant:** The requester MUST NOT approve their own migration.

**Implementation:**
```typescript
if (approval.requester_id === approval.approver_id) {
  throw new Error('SELF_APPROVAL_FORBIDDEN');
}
```

**Exception:** None (unless future emergency policy explicitly allows with governance freeze)

**Enforcement:** Check at approval creation AND verification.

**Violation:** Self-approval detected → BLOCK

**Rationale:** Prevents developer from bypassing governance by approving their own work.

---

### I1: Migration Binding (Approval-Migration Hash)

**Invariant:** Approval is cryptographically bound to exact migration content.

**Formula:**
```
approved_migration_hash == executing_migration_hash
```

**Implementation:**
```typescript
migration_hash = SHA256(migration_sql_content);
approval_record.migration_hash = migration_hash;

// At execution time
if (approval.migration_hash !== SHA256(actual_migration_content)) {
  throw new Error('MIGRATION_HASH_MISMATCH');
}
```

**Enforcement:** Hash computed at approval time, verified at execution time.

**Violation:** If `migration_hash` doesn't match actual migration → BLOCK

**Rationale:** Prevents using approval for migration A to execute modified migration A' or different migration B.

---

### I2: Approval Scope Binding

**Invariant:** Approval must bind to complete execution context.

**Binding Components:**
```typescript
interface ApprovalScope {
  migration_id: string;          // Which migration
  migration_hash: string;        // Exact content
  target_environment: Environment; // Where (production/staging/dev)
  target_schema?: string;        // Optional schema restriction
  expires_at: timestamp;         // When (validity window)
}
```

**Enforcement:** ALL components must match at execution time.

**Violation Examples:**
- Approval for staging used in production → BLOCK
- Approval for schema A used in schema B → BLOCK  
- Approval expired → BLOCK

**Rationale:** Prevents scope escalation (e.g., staging approval used in production).

---

### I3: Single-Use (Replay Protection)

**Invariant:** Each approval can be used exactly once.

**Implementation:**
```sql
-- At execution time
UPDATE bella_migration_approval
SET status = 'used',
    used_at = NOW(),
    used_by = CURRENT_USER
WHERE approval_id = $1
  AND status = 'approved'
RETURNING *;

-- If no rows returned → approval already used or invalid
```

**Enforcement:** Atomic UPDATE with status check.

**Violation:** Attempt to reuse approval → BLOCK

---

### I4: Time Validity

**Invariant:** Approval must be within validity window.

**Implementation:**
```typescript
function isWithinValidityWindow(approval: ApprovalContract): boolean {
  const now = new Date();
  
  // Check expiration
  if (now > approval.expires_at) {
    return false; // Expired
  }
  
  // Check valid_from (if set)
  if (approval.valid_from && now < approval.valid_from) {
    return false; // Too early
  }
  
  // Check valid_until (if set)
  if (approval.valid_until && now > approval.valid_until) {
    return false; // Too late
  }
  
  return true;
}
```

**Enforcement:** Check before execution.

**Violation:** Expired or outside window → BLOCK

---

### I5: Environment Match

**Invariant:** Approval target environment must match execution environment.

**Implementation:**
```typescript
function verifyEnvironment(
  approval: ApprovalContract,
  executionEnv: Environment
): boolean {
  return approval.target_environment === executionEnv;
}
```

**Enforcement:** Check before execution.

**Violation:** Approval for staging used in production → BLOCK

---

### I6: Approver Authority

**Invariant:** Approver must have authority to approve migrations in target environment.

**Implementation:**
```typescript
const AUTHORITY_MATRIX: Record<Environment, ApproverRole[]> = {
  production: ['ADMIN', 'DBA', 'EMERGENCY_OVERRIDE'],
  staging: ['ADMIN', 'DBA', 'TECH_LEAD'],
  dev: ['ADMIN', 'DBA', 'TECH_LEAD']
};

function hasAuthority(
  approverRole: ApproverRole,
  environment: Environment
): boolean {
  return AUTHORITY_MATRIX[environment].includes(approverRole);
}
```

**Enforcement:** Check at approval creation AND verification.

**Violation:** Unauthorized approver → BLOCK

---

### I7: Integrity

**Invariant:** Approval record has not been tampered with.

**Implementation:**
```typescript
function computeApprovalHash(approval: ApprovalContract): string {
  const canonical = {
    approval_id: approval.approval_id,
    migration_id: approval.migration_id,
    migration_hash: approval.migration_hash,
    approver_id: approval.approver_id,
    approved_at: approval.approved_at.toISOString(),
    target_environment: approval.target_environment,
    expires_at: approval.expires_at.toISOString()
  };
  
  return SHA256(JSON.stringify(canonical, Object.keys(canonical).sort()));
}

function verifyIntegrity(approval: ApprovalContract): boolean {
  const computed = computeApprovalHash(approval);
  return computed === approval.approval_hash;
}
```

**Enforcement:** Check before execution.

**Violation:** Hash mismatch → BLOCK (approval tampered)

---

## 🚪 G2 — APPROVAL GATE SPECIFICATION

### Gate Input

```typescript
interface ApprovalGateInput {
  migration_id: string;
  migration_content: string;     // Actual SQL to execute
  execution_environment: Environment;
}
```

---

### Gate Logic

```typescript
async function verifyApproval(input: ApprovalGateInput): Promise<GateResult> {
  // 1. Compute migration hash
  const migrationHash = SHA256(input.migration_content);
  
  // 2. Find approval
  const approval = await db.query(`
    SELECT * FROM bella_migration_approval
    WHERE migration_id = $1
      AND status = 'approved'
    LIMIT 1
  `, [input.migration_id]);
  
  if (!approval) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'NO_APPROVAL_FOUND',
      evidence: { migration_id: input.migration_id }
    };
  }
  
  // 3. Verify no self-approval (I0)
  if (approval.requester_id === approval.approver_id) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'SELF_APPROVAL_FORBIDDEN',
      evidence: {
        requester_id: approval.requester_id,
        approver_id: approval.approver_id
      }
    };
  }
  
  // 4. Verify migration binding (I1)
  if (approval.migration_hash !== migrationHash) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'MIGRATION_HASH_MISMATCH',
      evidence: {
        expected: approval.migration_hash,
        actual: migrationHash
      }
    };
  }
  
  // 5. Verify environment (I2, I5)
  if (approval.target_environment !== input.execution_environment) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'ENVIRONMENT_MISMATCH',
      evidence: {
        approved_for: approval.target_environment,
        executing_in: input.execution_environment
      }
    };
  }
  
  // 6. Verify time validity (I2, I4)
  if (!isWithinValidityWindow(approval)) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'APPROVAL_EXPIRED',
      evidence: {
        expires_at: approval.expires_at,
        now: new Date()
      }
    };
  }
  
  // 7. Verify approver authority (I6)
  if (!hasAuthority(approval.approver_role, approval.target_environment)) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'UNAUTHORIZED_APPROVER',
      evidence: {
        approver_role: approval.approver_role,
        environment: approval.target_environment
      }
    };
  }
  
  // 8. Verify integrity (I7)
  if (!verifyIntegrity(approval)) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'APPROVAL_TAMPERED',
      evidence: {
        expected_hash: approval.approval_hash,
        computed_hash: computeApprovalHash(approval)
      }
    };
  }
  
  // 9. Mark as used (I3 - atomic)
  const marked = await db.query(`
    UPDATE bella_migration_approval
    SET status = 'used',
        used_at = NOW(),
        used_by = CURRENT_USER
    WHERE approval_id = $1
      AND status = 'approved'
    RETURNING *
  `, [approval.approval_id]);
  
  if (!marked) {
    return {
      gate: 'G2_APPROVAL',
      decision: 'BLOCK',
      reason: 'APPROVAL_ALREADY_USED',
      evidence: { approval_id: approval.approval_id }
    };
  }
  
  // ALL CHECKS PASSED
  return {
    gate: 'G2_APPROVAL',
    decision: 'PASS',
    evidence: {
      approval_id: approval.approval_id,
      requester_id: approval.requester_id,
      approver_id: approval.approver_id,
      approved_at: approval.approved_at,
      consumed_at: new Date()
    }
  };
}
```

---

### Gate Result

```typescript
interface GateResult {
  gate: string;                  // Gate identifier (e.g., 'G2_APPROVAL')
  decision: 'PASS' | 'BLOCK';    // Gate decision
  reason?: string;               // Block reason (if decision = BLOCK)
  evidence: Record<string, any>; // Evidence for audit trail
}
```

---

## 🧪 NEGATIVE TEST MATRIX

### Test Coverage Required

| Test Case | Expected Result | Invariant Tested |
|-----------|----------------|------------------|
| No approval exists | BLOCK - NO_APPROVAL_FOUND | - |
| Self-approval (requester = approver) | BLOCK - SELF_APPROVAL_FORBIDDEN | I0 |
| Migration hash mismatch | BLOCK - MIGRATION_HASH_MISMATCH | I1 |
| Wrong environment | BLOCK - ENVIRONMENT_MISMATCH | I2, I5 |
| Wrong schema | BLOCK - SCHEMA_MISMATCH | I2 |
| Approval expired | BLOCK - APPROVAL_EXPIRED | I2, I4 |
| Approval not yet valid | BLOCK - APPROVAL_NOT_YET_VALID | I4 |
| Approval already used | BLOCK - APPROVAL_ALREADY_USED | I3 |
| Unauthorized approver | BLOCK - UNAUTHORIZED_APPROVER | I6 |
| Approval tampered | BLOCK - APPROVAL_TAMPERED | I7 |
| Approval revoked | BLOCK - APPROVAL_REVOKED | Status check |
| Valid approval | PASS | All invariants |

**Total:** 12 test cases (11 negative + 1 positive)

---

## 📋 DATABASE SCHEMA

### Table: bella_migration_approval

```sql
CREATE TABLE bella_migration_approval (
  -- Identity
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id VARCHAR(255) NOT NULL,
  migration_hash VARCHAR(64) NOT NULL, -- SHA-256 hex
  
  -- Authorization
  requester_id VARCHAR(255) NOT NULL,  -- Who requested
  approver_id VARCHAR(255) NOT NULL,   -- Who approved
  approver_role VARCHAR(50) NOT NULL,
  approved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Scope
  target_environment VARCHAR(20) NOT NULL CHECK (target_environment IN ('production', 'staging', 'dev')),
  target_schema VARCHAR(255),
  
  -- Validity
  expires_at TIMESTAMP NOT NULL,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  
  -- State
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'revoked', 'used', 'expired')),
  used_at TIMESTAMP,
  used_by VARCHAR(255),
  
  -- Integrity
  approval_hash VARCHAR(64) NOT NULL,
  signature TEXT,
  
  -- Audit
  created_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  notes TEXT,
  
  -- Indexes
  CONSTRAINT unique_migration_approval UNIQUE (migration_id, target_environment, status) WHERE status = 'approved',
  CONSTRAINT no_self_approval CHECK (requester_id <> approver_id)
);

-- Index for fast lookup
CREATE INDEX idx_approval_migration_status ON bella_migration_approval(migration_id, status)
  WHERE status = 'approved';

-- Index for expiration checks
CREATE INDEX idx_approval_expiration ON bella_migration_approval(expires_at, status)
  WHERE status = 'approved';
```

---

## 🔐 SECURITY PROPERTIES

### S1: No Approval = No Execution

**Property:** Without valid approval, migration CANNOT execute.

**Enforcement:** Gate G2 MUST PASS before executor invoked.

**Verification:** Negative test (no approval → block)

---

### S2: Approval Cannot Be Forged

**Property:** Approval integrity protected by hash + signature.

**Enforcement:** Integrity check (I6) before execution.

**Verification:** Negative test (tampered approval → block)

---

### S3: Approval Cannot Be Reused

**Property:** Each approval single-use only.

**Enforcement:** Atomic status update (I2).

**Verification:** Negative test (replay → block)

---

### S4: Approval Cannot Be Transferred

**Property:** Approval for migration A cannot be used for migration B.

**Enforcement:** Migration hash binding (I1).

**Verification:** Negative test (hash mismatch → block)

---

### S5: Approval Cannot Cross Environments

**Property:** Approval for staging cannot be used in production.

**Enforcement:** Environment match check (I4).

**Verification:** Negative test (wrong env → block)

---

## 📊 SUCCESS CRITERIA

### R4.1 Complete When:

- [x] Contract schema defined and frozen
- [x] All 8 invariants specified (I0-I7)
- [x] Gate logic specified
- [x] Negative test matrix complete (12 tests)
- [x] Database schema created
- [x] Security properties documented
- [x] Design decisions frozen

### R4.2 Can Begin When:

R4.1 contract frozen → Implement `verify_approval()` → Write tests

---

## 🔒 CONTRACT STATUS

**Version:** 1.0.0  
**Status:** 🟢 FROZEN  
**Date:** 2026-08-20 19:15

**Frozen Elements:**
- ✅ Approval contract schema
- ✅ 8 invariants (I0: No Self-Approval, I1: Migration Binding, I2: Scope Binding, I3: Single-Use, I4: Time Validity, I5: Environment Match, I6: Approver Authority, I7: Integrity)
- ✅ Two-phase workflow (REQUEST → APPROVE)
- ✅ Emergency as stricter auth path (not bypass)
- ✅ 12 negative tests defined

**Design Decisions (LOCKED):**
1. Hash-only (no signature for MVP)
2. Requester ≠ Approver (no self-approval)
3. Emergency = stricter authorization path

**Next:** R4.2 — Implement `verify_approval()` and test suite

---

## 🔒 DESIGN DECISIONS (FROZEN)

### Q1: Signature Requirement

**Decision:** Hash-only for R4.1 MVP ✅

**Rationale:**
- Hash sufficient for tamper detection
- Simpler implementation
- Signature deferred to future enhancement (R4.x/R5) when non-repudiation required

**Implementation:**
```
approval.migration_hash = SHA256(migration_content)
approval.approval_hash = SHA256(canonical_approval_record)
```

---

### Q2: Approval Creation Authority

**Decision:** Two-phase workflow with separation of request and approval ✅

**NOT ALLOWED:**
```sql
-- ❌ Developer cannot directly INSERT approved record
INSERT INTO bella_migration_approval (status, ...) VALUES ('approved', ...);
```

**REQUIRED WORKFLOW:**
```
Developer
    ↓
CREATE REQUEST (status = 'requested')
    ↓
Authorized Approver validates request
    ↓
ISSUE APPROVAL (status = 'approved')
    ↓
verify_approval() at execution time
```

**State Machine:**
```
REQUESTED → APPROVED → CONSUMED (single-use)
REQUESTED → REJECTED
REQUESTED → EXPIRED
APPROVED → REVOKED
```

**Enforcement:** `approver_role` verified against trusted authority (not self-declared).

**Rationale:** Prevents self-approval bypass. Developer cannot grant themselves authorization.

---

### Q3: Emergency Override

**Decision:** Dedicated emergency authorization path (NOT bypass) ✅

**NOT ALLOWED:**
```
EMERGENCY_OVERRIDE → Skip gate ❌
```

**REQUIRED:**
```
EMERGENCY PATH
    ↓
Emergency Authorization (stricter than normal)
    ├─ emergency_reason REQUIRED
    ├─ Dual control (requester ≠ authorizer)
    ├─ Restricted scope (limited migration size/type)
    ├─ Short validity window (e.g., 1 hour)
    ├─ Mandatory postflight review
    └─ Immutable audit trail
    ↓
verify_approval() (emergency approval)
    ↓
Execution
    ↓
POST-INCIDENT REVIEW (required within 24h)
```

**Rationale:** Emergency is not bypass. Emergency is a stricter authorization path with additional constraints and mandatory review.

---

## 📝 NEXT STEPS

### Immediate

1. **Review this spec** — Validate contract design
2. **Freeze contract** — Lock schema before implementation
3. **Create R4.2** — Implement `verify_approval()`

### After R4.1 Frozen

1. Create `scripts/bdgf/r4-verify-approval.mjs`
2. Create negative test suite (10 tests)
3. Integrate with migration executor

---

**Status:** 🟡 DRAFT — AWAITING REVIEW & FREEZE

**Principle:** "Contract before code, tests before implementation"

Contract defines WHAT system must do. Implementation defines HOW. Tests prove it works.
