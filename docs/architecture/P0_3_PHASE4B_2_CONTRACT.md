# P0.3 PHASE 4B.2 — BDGF INTEGRATION CONTRACT

**Phase:** Phase 4B.2 — BDGF Integration  
**Status:** 🟡 DRAFT — AWAITING REVIEW & FREEZE  
**Version:** 1.0.0  
**Date:** 2026-08-25

---

## 🎯 OBJECTIVE

Integrate BDGF (Bella Deployment Governance Framework) into GitHub Actions workflow to enforce approval-gated migration execution.

**What 4B.2 Does:**
- Connect change detection (4B.1) → human approval → BDGF verification → controlled execution
- Enforce fail-closed behavior at every decision point
- Preserve all R4 security invariants

**What 4B.2 Does NOT Do:**
- Create approvals (manual human process)
- Modify BDGF components (reuse as-is)
- Execute migrations directly (via BDGF wrapper only)
- Implement database verification (deferred to 4B.3)

---

## 📚 FOUNDATION DOCUMENTS

**This contract builds on:**
- ✅ `P0_3_PHASE4B_CONTROL_PLANE_CONTRACT.md` — Overall control plane architecture
- ✅ `P0_3_PHASE4B_1_EVIDENCE.md` — Change detection (5/5 PASS)
- ✅ `P0_3_PHASE4B_2_DISCOVERY_FINDINGS.md` — BDGF interface analysis
- ✅ `P0_3_PHASE4B_2_GAP_RESOLUTION_DECISIONS.md` — 5 frozen decisions
- ✅ `R4_APPROVAL_CONTRACT_SPECIFICATION.md` v1.0.0 — Approval invariants (I0-I7)

**All foundation documents FROZEN.**

---

## 🏗️ ARCHITECTURE

### Integration Flow

```
Developer Push
      ↓
GitHub Actions: detect-changes (4B.1)
      ├─ app_changed
      ├─ db_changed
      ├─ infra_changed
      ├─ docs_only
      ├─ needs_migration ◀────────┐
      ├─ needs_app_deploy         │
      └─ risk_class               │
                                  │
If needs_migration == true ──────┘
      ↓
GitHub Actions: migrate-database (4B.2 NEW)
      │
      ├─ Input: approval_id (workflow_dispatch parameter)
      ├─ Discover migration files (git diff)
      ├─ Validate: exactly 1 migration
      ├─ Derive: migration_id from filename
      │
      ▼
Call BDGF Wrapper
      │
      └─ node scripts/bdgf/execute-migration-wrapper.mjs \
           <approval_id> <migration_file>
      │
      ▼
BDGF Wrapper (EXISTING — NOT MODIFIED)
      │
      ├─ verifyApproval() — 8 invariants (I0-I7)
      ├─ issueGateToken() — cryptographic authorization
      └─ executeMigration() — bella_migration_executor
      │
      ▼
Result: SUCCESS / FAIL
      │
      ├─ SUCCESS → proceed to 4B.3 (database verification)
      └─ FAIL → BLOCK app deployment
```

### Boundary Definition

**4B.2 Integration Layer:**
```
┌─────────────────────────────────────────┐
│  GitHub Actions Workflow (4B.2)        │
│                                         │
│  • Detect migration files              │
│  • Validate constraints                │
│  • Call BDGF wrapper                   │
│  • Handle results                      │
└─────────────────────────────────────────┘
              ↓ CLI invocation
┌─────────────────────────────────────────┐
│  BDGF (EXISTING — REUSE ONLY)          │
│                                         │
│  • execute-migration-wrapper.mjs       │
│  • migration-executor.mjs (R4.3.3)     │
│  • gate-token.mjs                      │
│  • r4-verify-approval.mjs              │
└─────────────────────────────────────────┘
```

**4B.2 MUST NOT modify anything below the boundary.**

---

## 📋 CONTRACT SPECIFICATION

### Input Parameters

**From detect-changes job (4B.1):**
```yaml
needs_migration: boolean  # true if db_changed=true
```

**From workflow_dispatch:**
```yaml
approval_id: string      # UUID from bella_migration_approval
                          # REQUIRED if needs_migration=true
```

**From git:**
```bash
${{ github.event.before }}  # Previous commit SHA
${{ github.sha }}            # Current commit SHA
```

---

### Job Definition

**Job Name:** `migrate-database`

**Condition:**
```yaml
if: needs.detect-changes.outputs.needs_migration == 'true'
```

**Runs-on:** `ubuntu-latest`

**Dependencies:**
```yaml
needs: [detect-changes]
```

---

### Execution Steps

#### Step 1: Validate Approval ID Input

**Purpose:** Ensure approval_id provided (no auto-generation)

**Implementation:**
```bash
if [ -z "${{ github.event.inputs.approval_id }}" ]; then
  echo "❌ ERROR: approval_id required when needs_migration=true"
  echo ""
  echo "Migration detected but no approval_id provided."
  echo ""
  echo "Required Action:"
  echo "1. Create approval using: node scripts/bdgf/record-human-go-approval.mjs"
  echo "2. Re-run workflow with approval_id parameter"
  exit 1
fi

APPROVAL_ID="${{ github.event.inputs.approval_id }}"
echo "✅ Approval ID: $APPROVAL_ID"
```

**Error Condition:** If `approval_id` empty → FAIL (fail-closed)

---

#### Step 2: Discover Migration Files

**Purpose:** Find changed migration files using git diff

**Implementation:**
```bash
echo "🔍 Discovering migration files..."

# Detect changed .sql files in supabase/migrations/
CHANGED_MIGRATIONS=$(git diff --name-only \
  ${{ github.event.before }}..${{ github.sha }} \
  | grep '^supabase/migrations/.*\.sql$' \
  || echo "")

if [ -z "$CHANGED_MIGRATIONS" ]; then
  echo "⚠️  No migration files detected"
  echo "   This may indicate a classification error (needs_migration=true but no .sql files)"
  exit 1
fi

echo "Detected migration files:"
echo "$CHANGED_MIGRATIONS"
```

**Error Condition:** No migrations found → FAIL (possible 4B.1 classification bug)

---

#### Step 3: Validate Single Migration Constraint

**Purpose:** Enforce one migration per commit (Decision 4)

**Implementation:**
```bash
echo "🔒 Validating single migration constraint..."

MIGRATION_COUNT=$(echo "$CHANGED_MIGRATIONS" | wc -l)

if [ "$MIGRATION_COUNT" -gt 1 ]; then
  echo "❌ BLOCKED: Multiple migrations detected ($MIGRATION_COUNT files)"
  echo ""
  echo "Detected files:"
  echo "$CHANGED_MIGRATIONS"
  echo ""
  echo "Phase 4B.2 Requirement: One migration per commit"
  echo ""
  echo "Each migration requires:"
  echo "  • Separate commit"
  echo "  • Separate approval"
  echo "  • Separate execution"
  echo ""
  echo "Action: Split into $MIGRATION_COUNT commits, create $MIGRATION_COUNT approvals"
  exit 1
fi

MIGRATION_FILE=$(echo "$CHANGED_MIGRATIONS" | head -n 1)
echo "✅ Single migration validated: $MIGRATION_FILE"
```

**Error Condition:** Multiple migrations → FAIL (one per commit enforced)

---

#### Step 4: Derive Migration ID

**Purpose:** Map filename → migration_id (Decision 3)

**Implementation:**
```bash
echo "🔑 Deriving migration ID from filename..."

# Extract filename without path and extension
MIGRATION_ID=$(basename "$MIGRATION_FILE" .sql)

echo "Migration ID: $MIGRATION_ID"
echo "Migration File: $MIGRATION_FILE"

# Export for subsequent steps
echo "MIGRATION_ID=$MIGRATION_ID" >> $GITHUB_ENV
echo "MIGRATION_FILE=$MIGRATION_FILE" >> $GITHUB_ENV
```

**Convention:**
```
File: supabase/migrations/20260825120000_add_column.sql
       ↓
ID:   "20260825120000_add_column"
```

**Deterministic mapping** — no external dependencies.

---

#### Step 5: Verify Migration File Exists

**Purpose:** Ensure migration file actually exists (sanity check)

**Implementation:**
```bash
echo "✅ Verifying migration file exists..."

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
  echo "   This should not happen (git diff detected it)"
  exit 1
fi

echo "✅ Migration file verified"

# Compute hash for audit log
MIGRATION_HASH=$(sha256sum "$MIGRATION_FILE" | awk '{print $1}')
echo "Migration hash: ${MIGRATION_HASH:0:16}..."
echo "MIGRATION_HASH=$MIGRATION_HASH" >> $GITHUB_ENV
```

**Sanity check** — file must exist if git diff detected it.

---

#### Step 6: Invoke BDGF Wrapper

**Purpose:** Execute migration through BDGF authorization chain

**Implementation:**
```bash
echo "🚀 Invoking BDGF wrapper..."
echo ""
echo "Command:"
echo "  node scripts/bdgf/execute-migration-wrapper.mjs \\"
echo "    $APPROVAL_ID \\"
echo "    $MIGRATION_FILE"
echo ""

# Set environment
export DATABASE_EXECUTOR_URL="${{ secrets.DATABASE_EXECUTOR_URL }}"
export GATE_SIGNING_KEY="${{ secrets.GATE_SIGNING_KEY }}"
export TARGET_ENVIRONMENT="production"
export TARGET_SCHEMA="public"
export EXECUTOR_IDENTITY="bella_migration_executor"

# Execute wrapper
node scripts/bdgf/execute-migration-wrapper.mjs \
  "$APPROVAL_ID" \
  "$MIGRATION_FILE"

BDGF_EXIT_CODE=$?

if [ $BDGF_EXIT_CODE -ne 0 ]; then
  echo ""
  echo "❌ BDGF execution failed (exit code: $BDGF_EXIT_CODE)"
  echo ""
  echo "Possible causes:"
  echo "  • No approval found (approval_id invalid)"
  echo "  • Approval expired"
  echo "  • Migration hash mismatch (file modified after approval)"
  echo "  • Environment mismatch"
  echo "  • Migration execution error (syntax, constraint, etc.)"
  echo ""
  echo "Check BDGF logs above for details"
  exit 1
fi

echo ""
echo "✅ BDGF execution SUCCESS"
```

**Error Handling:** Non-zero exit code → FAIL with diagnostic message

---

#### Step 7: Record Execution Metadata

**Purpose:** Log execution for audit trail

**Implementation:**
```bash
echo "📝 Recording execution metadata..."

cat > bdgf-execution.json <<EOF
{
  "approval_id": "$APPROVAL_ID",
  "migration_id": "$MIGRATION_ID",
  "migration_file": "$MIGRATION_FILE",
  "migration_hash": "$MIGRATION_HASH",
  "commit_sha": "${{ github.sha }}",
  "triggered_by": "${{ github.actor }}",
  "workflow_run_id": "${{ github.run_id }}",
  "execution_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "production",
  "result": "SUCCESS"
}
EOF

echo "Execution metadata:"
cat bdgf-execution.json
```

**Audit artifact** — available in workflow logs and artifacts.

---

### Secrets Required

**GitHub Environment Secrets:**

| Secret | Purpose | Authority |
|--------|---------|-----------|
| `DATABASE_EXECUTOR_URL` | PostgreSQL connection (bella_migration_executor role) | Execute migrations |
| `GATE_SIGNING_KEY` | HMAC key for gate token signing | Token authorization |

**Both secrets verified in Phase 4A.**

**Injection:**
```yaml
env:
  DATABASE_EXECUTOR_URL: ${{ secrets.DATABASE_EXECUTOR_URL }}
  GATE_SIGNING_KEY: ${{ secrets.GATE_SIGNING_KEY }}
```

**No other credentials used** — no SUPABASE_SERVICE_ROLE_KEY, no developer credentials.

---

### Error Handling

**All error conditions FAIL-CLOSED:**

| Error Condition | Action | Reason |
|-----------------|--------|--------|
| No `approval_id` provided | FAIL | No auto-authorization (Decision 5) |
| No migrations detected | FAIL | Possible 4B.1 bug |
| Multiple migrations | FAIL | One per commit enforced (Decision 4) |
| Migration file not found | FAIL | Sanity check |
| BDGF execution error | FAIL | Propagate BDGF failure |
| Missing secrets | FAIL | Cannot execute without credentials |

**Principle:** Any doubt → BLOCK.

---

### Success Criteria

**4B.2 Job succeeds when:**
1. ✅ Exactly 1 migration detected
2. ✅ `approval_id` provided
3. ✅ Migration file exists
4. ✅ BDGF wrapper returns exit code 0
5. ✅ Execution metadata recorded

**Output:**
- Job status: SUCCESS
- Approval ID (for audit)
- Migration ID (for audit)
- Migration hash (for verification)

**Next step:** Proceed to 4B.3 (database verification) if 4B.2 SUCCESS.

---

## 🔒 SECURITY INVARIANTS

### I0: No Self-Approval (Preserved)

**Enforcement:**
- Approval created manually via `record-human-go-approval.mjs`
- Workflow receives `approval_id` as input (not generated)
- BDGF verifies `requester_id ≠ approver_id` (database constraint)

**No automation bypass.**

---

### I1: Migration Binding (Preserved)

**Enforcement:**
- Approval contains `migration_hash` (SHA-256 of approved content)
- BDGF computes hash of actual migration file
- BDGF verifies: `approved_hash == actual_hash`

**If file modified after approval → BLOCK.**

---

### I2: Scope Binding (Preserved)

**Enforcement:**
- Approval specifies `target_environment`, `target_schema`
- Workflow passes `TARGET_ENVIRONMENT=production`
- BDGF verifies match

**Cannot use staging approval for production.**

---

### I3: Single-Use (Preserved)

**Enforcement:**
- BDGF atomically updates approval status: `approved` → `used`
- Database constraint prevents replay
- Gate token consumed (single-use)

**Cannot reuse approval.**

---

### I4: Time Validity (Preserved)

**Enforcement:**
- Approval has `expires_at` timestamp
- BDGF verifies `NOW() < expires_at`

**Expired approval → BLOCK.**

---

### I5: Environment Match (Preserved)

**Enforcement:**
- Workflow targets `production`
- BDGF verifies approval `target_environment=production`

**Cannot use dev approval for production.**

---

### I6: Approver Authority (Preserved)

**Enforcement:**
- Approval records `approver_role`
- BDGF verifies role authorized for environment
- Authority matrix: `production` requires `admin`, `dba`, or `emergency_override`

**Unauthorized approver → BLOCK.**

---

### I7: Integrity (Preserved)

**Enforcement:**
- Approval has `approval_hash` (hash of approval record)
- BDGF recomputes hash
- BDGF verifies match

**Tampered approval → BLOCK.**

---

### Fail-Closed Enforcement

**Every decision point fails closed:**

```
No approval_id → FAIL
No migration files → FAIL
Multiple migrations → FAIL
File not found → FAIL
BDGF error → FAIL
Hash mismatch → FAIL (BDGF)
Approval expired → FAIL (BDGF)
No approval record → FAIL (BDGF)
Wrong environment → FAIL (BDGF)
```

**No "continue anyway" paths.**

---

## 🧪 TEST HARNESS DESIGN

### Isolated Test Environment

**Requirements:**
- NO production database mutations
- NO production approvals
- Verify integration logic only

### Test Approach

**Option A: Mock BDGF Wrapper**
- Replace `execute-migration-wrapper.mjs` with mock script
- Returns success/failure based on test case
- Verifies correct parameters passed

**Option B: Test Database**
- Use separate test database (not production)
- Create test approvals
- Execute real BDGF flow
- Verify no production impact

**Recommendation: Option A (Mock)** for 4B.2 isolated testing.

### Test Scenarios

**Minimum test matrix:**

| # | Scenario | Expected Result | Validates |
|---|----------|----------------|-----------|
| 1 | Valid approval + 1 migration | SUCCESS | Happy path |
| 2 | No approval_id provided | FAIL | Decision 5 (fail-closed) |
| 3 | Multiple migrations detected | FAIL | Decision 4 (one per commit) |
| 4 | No migration files found | FAIL | Error detection |
| 5 | BDGF wrapper returns error | FAIL | Error propagation |

**5 scenarios minimum** (similar to 4B.1 structure).

---

## 📊 VERIFICATION CRITERIA

### Phase 4B.2 COMPLETE When:

**Integration Logic:**
- [ ] `migrate-database` job added to workflow
- [ ] Conditional execution on `needs_migration=true`
- [ ] Approval ID input validation
- [ ] Migration discovery (git diff)
- [ ] Single migration validation
- [ ] Migration ID derivation
- [ ] BDGF wrapper invocation
- [ ] Error handling (all paths)
- [ ] Execution metadata logging

**Test Harness:**
- [ ] Isolated test harness created
- [ ] 5 test scenarios executed
- [ ] All scenarios PASS
- [ ] No production mutations
- [ ] Evidence collected

**Security:**
- [ ] No approval auto-generation
- [ ] No BDGF component modifications
- [ ] All 8 invariants preserved (I0-I7)
- [ ] Fail-closed behavior verified
- [ ] Secrets properly injected

**Documentation:**
- [ ] Evidence document created
- [ ] 5 scenario results documented
- [ ] Certificate issued
- [ ] Status updated (4B.2 COMPLETE)

---

## 🚫 EXPLICITLY OUT OF SCOPE

**4B.2 does NOT include:**

1. ❌ **Approval creation automation**
   - Approval remains manual (human authority)
   - Workflow receives approval_id as input

2. ❌ **BDGF component modifications**
   - `execute-migration-wrapper.mjs` — reuse as-is
   - `migration-executor.mjs` — frozen (R4.3.3 boundary)
   - `gate-token.mjs` — reuse as-is
   - `r4-verify-approval.mjs` — reuse as-is

3. ❌ **Migration safety analysis**
   - No schema validation
   - No breaking change detection
   - Would be separate gate (future)

4. ❌ **Database verification**
   - Deferred to Phase 4B.3
   - 4B.2 only calls BDGF, does not verify DB state

5. ❌ **Application deployment**
   - Deferred to Phase 4B.3
   - 4B.2 only handles migration execution

6. ❌ **Rollback mechanism**
   - Forward-only principle (from overall contract)
   - No automated rollback

7. ❌ **Production testing**
   - Test harness uses mock/isolated environment
   - No production DB access during testing

---

## 📋 IMPLEMENTATION CHECKLIST

### Pre-Implementation

- [x] Discovery complete
- [x] Gaps resolved
- [x] Decisions frozen
- [ ] Contract reviewed
- [ ] Contract frozen

### Implementation Phase

**Workflow Changes:**
- [ ] Add `migrate-database` job definition
- [ ] Add `approval_id` workflow_dispatch input
- [ ] Add conditional: `if: needs_migration == 'true'`
- [ ] Add Step 1: Validate approval_id
- [ ] Add Step 2: Discover migrations (git diff)
- [ ] Add Step 3: Validate single migration
- [ ] Add Step 4: Derive migration_id
- [ ] Add Step 5: Verify file exists
- [ ] Add Step 6: Invoke BDGF wrapper
- [ ] Add Step 7: Record metadata
- [ ] Add error handling (all steps)
- [ ] Add secrets injection

**Test Harness:**
- [ ] Create mock BDGF wrapper script
- [ ] Create test scenarios (5 minimum)
- [ ] Create test execution script
- [ ] Verify no production access

### Verification Phase

- [ ] Execute test scenario 1 (valid)
- [ ] Execute test scenario 2 (no approval_id)
- [ ] Execute test scenario 3 (multiple migrations)
- [ ] Execute test scenario 4 (no migrations)
- [ ] Execute test scenario 5 (BDGF error)
- [ ] Collect evidence (run IDs, logs)
- [ ] Create evidence document
- [ ] Create certificate

### Completion

- [ ] Update status: 4B.2 COMPLETE
- [ ] Commit & push changes
- [ ] Unblock 4B.3

---

## 🔗 DEPENDENCIES

### Prerequisites (Must be COMPLETE)

- ✅ Phase 4B.0: Control Plane Contract
- ✅ Phase 4B.1: Change Detection (5/5 PASS)
- ✅ Phase 4A: Secret Injection (DATABASE_EXECUTOR_URL, GATE_SIGNING_KEY)
- ✅ R4.2: Approval Contract (8 invariants)
- ✅ R4.3: BDGF Implementation (wrapper, executor, tokens)

### Blocks (Cannot start until 4B.2 COMPLETE)

- ⏳ Phase 4B.3: Database Verification
- ⏳ Phase 4B.4: Production Hardening

---

## 📚 REFERENCES

- **Discovery:** `P0_3_PHASE4B_2_DISCOVERY_FINDINGS.md`
- **Decisions:** `P0_3_PHASE4B_2_GAP_RESOLUTION_DECISIONS.md` (FROZEN)
- **4B.1 Evidence:** `P0_3_PHASE4B_1_EVIDENCE.md` (5/5 PASS)
- **Control Plane:** `P0_3_PHASE4B_CONTROL_PLANE_CONTRACT.md`
- **Approval Contract:** `R4_APPROVAL_CONTRACT_SPECIFICATION.md` v1.0.0
- **BDGF Implementation:** `scripts/bdgf/execute-migration-wrapper.mjs`

---

## 🔒 CONTRACT STATUS

**Version:** 1.0.0  
**Status:** 🟡 DRAFT — AWAITING REVIEW  
**Date:** 2026-08-25

**Review Required:**
- [ ] Verify all 5 frozen decisions implemented correctly
- [ ] Verify all 8 R4 invariants preserved
- [ ] Verify no BDGF modifications
- [ ] Verify fail-closed enforcement
- [ ] Verify test harness design adequate

**After Review:**
- [ ] FREEZE contract
- [ ] Proceed to implementation

---

**Principle:** "Contract before code, tests before production"

**Next:** Review → Freeze → Implement → Test → Verify → Certificate

---

**END OF CONTRACT**
