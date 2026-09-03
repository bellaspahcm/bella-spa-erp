# P0.3 PHASE 4B.2 — DISCOVERY FINDINGS

**Phase:** Phase 4B.2 — BDGF Integration (Discovery Only)  
**Status:** 🟡 INVESTIGATION COMPLETE — CONTRACT PENDING  
**Date:** 2026-08-25

---

## 🎯 INVESTIGATION OBJECTIVE

Understand approval authority, migration identity, and BDGF integration boundaries BEFORE writing Phase 4B.2 contract.

**Principle:** "Discovery before contract, contract before code"

---

## ✅ FINDINGS SUMMARY

| Area | Status | Authority Found |
|------|--------|-----------------|
| **Approval Schema** | ✅ VERIFIED | `bella_migration_approval` table (R4.2) |
| **Approval Creation** | ✅ VERIFIED | Manual script: `record-human-go-approval.mjs` |
| **Migration Hash** | ✅ VERIFIED | SHA-256 via `computeHash()` in `r4-verify-approval.mjs` |
| **BDGF Interface** | ✅ VERIFIED | `execute-migration-wrapper.mjs` entry point |
| **Security Boundary** | ✅ VERIFIED | Token-based authorization chain |
| **4B.2 Scope** | 🟡 NEEDS CONTRACT | Integration layer only |

---

## 📊 APPROVAL AUTHORITY INVESTIGATION

### 1. Approval Schema (bella_migration_approval)

**Location:** `supabase/migrations/20260820150000_r4_approval_contract.sql`

**Table Structure:**
```sql
CREATE TABLE bella_migration_approval (
  approval_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  migration_id VARCHAR(255) NOT NULL,        -- Migration identifier
  migration_hash VARCHAR(64) NOT NULL,       -- SHA-256 of content
  
  requester_id VARCHAR(255) NOT NULL,        -- Who requested
  approver_id VARCHAR(255) NOT NULL,         -- Who approved
  approver_role VARCHAR(50) NOT NULL,        -- Role authority
  approved_at TIMESTAMP NOT NULL,
  
  target_environment VARCHAR(20) NOT NULL,   -- production/staging/dev
  target_schema VARCHAR(255),                -- Optional restriction
  
  expires_at TIMESTAMP NOT NULL,             -- Time-bound validity
  status VARCHAR(20) NOT NULL,               -- requested/approved/used/expired
  
  approval_hash VARCHAR(64) NOT NULL,        -- Integrity check
  
  CONSTRAINT no_self_approval CHECK (requester_id <> approver_id),
  CONSTRAINT unique_active_approval UNIQUE (migration_id, target_environment, status) 
    WHERE status = 'approved'
);
```

**Key Constraints:**
- ✅ No self-approval (I0): `requester_id <> approver_id`
- ✅ Single active approval per migration+environment
- ✅ Status machine: `requested` → `approved` → `used`
- ✅ Time-bound: `expires_at` mandatory

**Contract:** `R4_APPROVAL_CONTRACT_SPECIFICATION.md` v1.0.0 (FROZEN)

---

### 2. Approval Creation Authority

**Script:** `scripts/bdgf/record-human-go-approval.mjs`

**Current Workflow:**
```
Human Decision Document
        ↓
Interactive CLI Script (record-human-go-approval.mjs)
        ├─ Confirm 3 conditions:
        │  1. Backup verified
        │  2. Monitoring plan confirmed
        │  3. Scope confirmed
        ├─ Collect approver identity
        ├─ Generate approval signature
        └─ INSERT into bella_migration_approval
        ↓
Approval Record (status='approved')
```

**Parameters:**
- `migration_id`: User-provided (e.g., "M001", "05-A")
- `migration_hash`: Computed from migration file content
- `approver_id`: Interactive prompt
- `expires_at`: NOW() + 7 days (hardcoded)

**Authority:** Manual human process (not automated)

---

### 3. Migration Hash Computation

**Function:** `computeHash()` in `scripts/bdgf/r4-verify-approval.mjs`

**Implementation:**
```javascript
function computeHash(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}
```

**Properties:**
- Algorithm: SHA-256
- Encoding: UTF-8 input, hex output (64 chars)
- Canonical: Direct content hash (no preprocessing)
- Deterministic: Same content → same hash

**Usage:**
1. **At approval creation:** Hash migration file content
2. **At execution time:** Hash actual migration content
3. **Verification:** Compare hashes (I1 invariant)

**Binding:** Approval is cryptographically bound to exact migration content

---

### 4. Migration Identity

**Current Practice:**
- `migration_id`: Free-form string (e.g., "M001", "05-A", "add_column_x")
- No enforced format or convention
- Not derived from commit SHA or file name
- Human-assigned identifier

**Observation:** `migration_id` is a human label, NOT a cryptographic identity. The true identity is `migration_hash`.

**Binding Chain:**
```
approval_id (UUID)
    ↓
migration_id (human label)
    ↓
migration_hash (cryptographic identity)
    ↓
migration_content (actual SQL)
```

---

## 🔐 BDGF INTERFACE ANALYSIS

### BDGF Entry Point

**CLI:** `node scripts/bdgf/execute-migration-wrapper.mjs <approval_id> <migration_file>`

**Parameters:**
- `approval_id`: UUID from `bella_migration_approval`
- `migration_file`: Path to SQL file

**Environment Variables:**
- `DATABASE_EXECUTOR_URL`: PostgreSQL connection (bella_migration_executor role)
- `GATE_SIGNING_KEY`: HMAC key for token signing

---

### BDGF Execution Flow

```
1. verifyApproval()
   ├─ Find approval by migration_id (from approval_id)
   ├─ Compute migration_hash from content
   ├─ Verify 8 invariants (I0-I7)
   └─ Return PASS/BLOCK

2. issueGateToken()
   ├─ Generate cryptographic token
   ├─ Bind: approval_id, migration_hash, environment, schema, executor
   ├─ Sign with GATE_SIGNING_KEY
   └─ Store in bella_gate_tokens

3. executeMigration()
   ├─ Validate token (signature + bindings)
   ├─ Consume token (atomic, single-use)
   ├─ Connect as bella_migration_executor
   └─ Execute migration DDL

4. Audit (TODO in code)
   └─ Record in bella_execution_audit
```

**Security Model:**
- Token = proof of authorization (not a credential)
- Token is single-use (atomic consumption)
- Token binds approval → migration → environment → executor
- No token = no execution (hard gate)

---

### 8 Invariants Verified

| ID | Invariant | Check |
|----|-----------|-------|
| I0 | No Self-Approval | `requester_id ≠ approver_id` |
| I1 | Migration Binding | `approved_hash = executing_hash` |
| I2 | Scope Binding | All context fields match |
| I3 | Single-Use | Atomic status update |
| I4 | Time Validity | Within validity window |
| I5 | Environment Match | `target_environment = execution_environment` |
| I6 | Approver Authority | Role authorized for environment |
| I7 | Integrity | Approval record not tampered |

**All verified BEFORE execution**

---

## 🚧 BOUNDARIES VERIFIED

### What 4B.2 MUST Do

1. ✅ **Detect when migration needed:**
   - Input: `needs_migration=true` from detect-changes (4B.1)
   - Conditional job execution

2. ✅ **Call BDGF wrapper:**
   - `node scripts/bdgf/execute-migration-wrapper.mjs <approval_id> <migration_file>`
   - Pass correct parameters

3. ✅ **Inject secrets:**
   - `DATABASE_EXECUTOR_URL` (exists, verified in Phase 4A)
   - `GATE_SIGNING_KEY` (exists, verified in Phase 4A)

4. ✅ **Handle execution result:**
   - SUCCESS → proceed to app deployment (4B.3)
   - FAIL → block app deployment

5. ✅ **Audit:**
   - Log execution attempt
   - Preserve approval_id in workflow logs

---

### What 4B.2 MUST NOT Do

1. ❌ **Create approvals:**
   - Approval generation is MANUAL (human authority)
   - 4B.2 assumes approval EXISTS

2. ❌ **Modify BDGF components:**
   - `execute-migration-wrapper.mjs` — reuse as-is
   - `migration-executor.mjs` — frozen boundary (R4.3.3)
   - `gate-token.mjs` — reuse as-is
   - `r4-verify-approval.mjs` — reuse as-is

3. ❌ **Bypass token authorization:**
   - No direct executor invocation
   - No credential alternatives
   - Must go through wrapper

4. ❌ **Implement migration safety analysis:**
   - Not in 4B.2 scope
   - Would be separate gate (if needed)

5. ❌ **Implement database verification:**
   - Deferred to 4B.3

---

## 🔴 CRITICAL GAPS IDENTIFIED

### Gap 1: Approval ID Generation for CI/CD

**Problem:** Current approval creation is MANUAL (interactive script).

**Question:** How does workflow obtain `approval_id`?

**Options:**
1. **Manual pre-approval:** Human creates approval before push → approval_id documented → workflow reads from file/env
2. **Auto-generate approval (NOT RECOMMENDED):** Workflow creates approval automatically (violates human authority)
3. **Lookup by migration_id:** Workflow derives migration_id → looks up existing approval
4. **Separate approval service:** API/service for approval creation (future enhancement)

**Recommendation for 4B.2:**
- **Option 1 (Manual pre-approval)** — safest, aligns with current R4 contract
- Workflow receives `approval_id` as input (workflow_dispatch parameter or commit message)
- If no approval_id provided → BLOCK execution

**Rationale:** Preserves human-in-the-loop authority. No automation bypass.

---

### Gap 2: Migration File Discovery

**Problem:** Workflow needs to know which migration file(s) to execute.

**Question:** How does workflow find migration files?

**Options:**
1. **Git diff detection:** Detect changed files in `supabase/migrations/**`
2. **Single migration per commit:** Enforce one migration per commit (simplest)
3. **Migration manifest:** Commit includes manifest listing migrations to execute
4. **Scan all migrations:** Execute all SQL files in `supabase/migrations/**` (DANGEROUS)

**Recommendation for 4B.2:**
- **Option 1 (Git diff detection)** — scan `supabase/migrations/**` for changed .sql files
- **Constraint:** Enforce max 1 migration per commit (fail if multiple detected)
- **Order:** Lexicographic order by filename (timestamp-based naming)

**Rationale:** Deterministic, auditable, aligns with Supabase convention.

---

### Gap 3: Migration ID Mapping

**Problem:** Workflow detects `supabase/migrations/20260825120000_add_column.sql` but approval uses `migration_id="M001"`.

**Question:** How to map detected file → approval migration_id?

**Options:**
1. **Filename = migration_id:** Use SQL filename as migration_id
2. **Commit SHA = migration_id:** Derive from git commit
3. **Lookup table:** Store mapping in metadata file
4. **Migration manifest:** Explicit mapping in commit

**Recommendation for 4B.2:**
- **Option 1 (Filename = migration_id)** — simplest, no additional metadata
- Example: `20260825120000_add_column.sql` → migration_id = `20260825120000_add_column`
- Approval creation script must use same filename-based migration_id

**Rationale:** Deterministic, no external dependencies, auditable.

---

### Gap 4: Multiple Migrations in One Commit

**Problem:** What if one commit contains 3 new migrations?

**Question:** Execute all? Require separate approvals for each?

**Recommendation for 4B.2:**
- **BLOCK if multiple migrations detected**
- Error message: "Multiple migrations detected. Each migration requires separate commit and approval."
- **Constraint:** One migration per commit (simplifies approval workflow)

**Rationale:** Safer, clearer audit trail, aligns with forward-only principle.

---

### Gap 5: Missing Approval Scenario

**Problem:** Workflow detects migration file, but no approval exists.

**Question:** Block execution? Auto-create approval?

**Recommendation for 4B.2:**
- **BLOCK execution**
- Error message: "No approval found for migration <migration_id>. Create approval first using record-human-go-approval.mjs"
- **No auto-creation** (violates human authority)

**Rationale:** Fail-closed, preserves governance.

---

## 🔐 SECURITY BOUNDARY VERIFICATION

### Credential Boundaries

**Verified:**
- ✅ `DATABASE_EXECUTOR_URL` — workflow injects, wrapper uses, executor connects
- ✅ `GATE_SIGNING_KEY` — workflow injects, wrapper uses for token signing

**Question:** Should workflow directly access `GATE_SIGNING_KEY`?

**Analysis:**
- Wrapper (`execute-migration-wrapper.mjs`) reads `process.env.GATE_SIGNING_KEY`
- Token signing happens inside wrapper (not in executor)
- Workflow must inject secret for wrapper to access

**Conclusion:** ✅ ACCEPTABLE — workflow injects, wrapper signs, executor validates. No bypass path.

**Boundary:**
```
GitHub Workflow
      ↓ injects secrets
execute-migration-wrapper.mjs
      ├─ Signs token with GATE_SIGNING_KEY
      ├─ Connects with DATABASE_EXECUTOR_URL
      └─ Calls executor with token
      ↓
migration-executor.mjs
      ├─ Validates token
      ├─ Consumes token
      └─ Executes migration
```

**No credential leakage** — secrets passed via environment, not logged.

---

## 📋 NEXT STEPS

### 1. Resolve Critical Gaps (Decision Required)

**Must decide before writing contract:**

| Gap | Decision Needed | Recommended Option |
|-----|----------------|-------------------|
| **Approval ID** | How workflow obtains approval_id? | Manual pre-approval (workflow_dispatch parameter) |
| **Migration Discovery** | How to find migration files? | Git diff on `supabase/migrations/**` |
| **Migration ID** | How to derive migration_id? | Filename-based (e.g., `20260825_add_column`) |
| **Multiple Migrations** | Allow multiple per commit? | BLOCK (one migration per commit) |
| **Missing Approval** | Auto-create or block? | BLOCK (require manual approval) |

---

### 2. Create Phase 4B.2 Contract

**After gaps resolved, contract must define:**

1. **Input from 4B.1:**
   - `needs_migration` (boolean)
   - Changed migration files (list)

2. **Workflow Job Structure:**
   - Job name: `migrate-database`
   - Condition: `needs_migration == 'true'`
   - Inputs: `approval_id` (workflow_dispatch parameter)

3. **Execution Steps:**
   - Detect migration files
   - Validate one migration only
   - Derive migration_id from filename
   - Call BDGF wrapper
   - Handle result

4. **Error Handling:**
   - Multiple migrations → FAIL
   - No approval → FAIL
   - BDGF execution error → FAIL
   - Success → output approval_id for audit

5. **Secrets:**
   - `DATABASE_EXECUTOR_URL`
   - `GATE_SIGNING_KEY`

6. **Test Harness:**
   - How to test without production mutation?
   - Mock approval creation?
   - Test DB-only deployment path?

---

### 3. Implementation Blocked Until Contract

**DO NOT START:**
- ❌ Modifying `deploy-production.yml`
- ❌ Creating `migrate-database` job
- ❌ Adding approval_id parameter
- ❌ Calling BDGF wrapper
- ❌ Testing with production

**MUST WAIT FOR:**
- ✅ Gap resolution decisions
- ✅ Phase 4B.2 contract approval
- ✅ Test harness design

---

## 🎯 PHASE 4B.2 STATUS

**Discovery:** ✅ COMPLETE

**Findings:**
- ✅ Approval authority understood
- ✅ BDGF interface understood
- ✅ Security boundaries verified
- ✅ Integration points identified
- 🔴 Critical gaps identified (5 gaps)

**Next Phase:**
- 🟡 Resolve gaps (requires decisions)
- 🟡 Write Phase 4B.2 contract
- ⏳ Implementation (after contract approval)

**Blocker:** Cannot proceed to contract until 5 critical gaps resolved.

---

## 📚 REFERENCES

**Approval Contract:**
- `docs/architecture/R4_APPROVAL_CONTRACT_SPECIFICATION.md` v1.0.0 (FROZEN)
- `supabase/migrations/20260820150000_r4_approval_contract.sql`

**BDGF Implementation:**
- `scripts/bdgf/execute-migration-wrapper.mjs` — Entry point
- `scripts/bdgf/migration-executor.mjs` — Execution boundary (R4.3.3)
- `scripts/bdgf/gate-token.mjs` — Token management
- `scripts/bdgf/r4-verify-approval.mjs` — Approval verification

**Approval Creation:**
- `scripts/bdgf/record-human-go-approval.mjs` — Manual approval script

**Control Plane Contract:**
- `docs/architecture/P0_3_PHASE4B_CONTROL_PLANE_CONTRACT.md`

---

**END OF DISCOVERY**

**Status:** 🟡 INVESTIGATION COMPLETE — AWAITING GAP RESOLUTION  
**Date:** 2026-08-25  
**Next:** Resolve 5 critical gaps, then write Phase 4B.2 contract
