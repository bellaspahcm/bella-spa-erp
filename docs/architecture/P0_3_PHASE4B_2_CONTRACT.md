# P0.3 PHASE 4B.2 — BDGF INTEGRATION CONTRACT

**Phase:** Phase 4B.2 — BDGF Integration  
**Status:** 🔒 FROZEN  
**Version:** 1.2.0  
**Date:** 2026-08-25  
**Frozen Date:** 2026-08-25

**Amendment Log:**
- v1.2.0 (2026-08-25): Applied 2 critical P0 provenance fixes + clarifications
  - 🔴 P0.1: Enforced canonical commit_sha throughout (Step 0, Step 2, Step 7)
  - 🔴 P0.2: Evidence artifact uses approved commit_sha (not workflow github.sha)
  - 🟠 Added merge commit policy (single-parent commits only)
  - 🟠 Added provenance scope clarification (workflow commit-level + BDGF hash-level)
  - 🟠 Updated success criteria terminology (metadata → evidence artifact)
- v1.1.0 (2026-08-25): Applied 4 architectural fixes per review
  - 🔴 P0 #1: Added commit_sha provenance binding
  - 🔴 P0 #2: Added downstream job dependency enforcement
  - 🟠 P1 #3: Fixed Step 7 audit terminology → evidence artifact
  - 🟠 P1 #4: Clarified deployment boundary (controls, doesn't deploy)
  - Improved migration count robustness (grep -c vs wc -l)
- v1.0.0 (2026-08-25): Initial draft

---

## 🎯 OBJECTIVE

Integrate BDGF (Bella Deployment Governance Framework) into GitHub Actions workflow to enforce approval-gated migration execution.

**What 4B.2 Does:**
- Connect change detection (4B.1) → human approval → BDGF verification → controlled execution
- Enforce fail-closed behavior at every decision point
- Preserve all R4 security invariants
- Provide migration gate result consumed by downstream deployment job

**What 4B.2 Does NOT Do:**
- Create approvals (manual human process)
- Modify BDGF components (reuse as-is)
- Execute migrations directly (via BDGF wrapper only)
- Perform application deployment (4B.2 controls eligibility, does not deploy)
- Implement database verification (deferred to 4B.3)

**Boundary Clarification:**
- 4B.2 **does not perform** application deployment
- 4B.2 **does control** whether application deployment may proceed
- Migration FAIL → deployment job BLOCKED via job dependency

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
commit_sha: string        # Exact commit SHA to execute
                          # Binds approval to immutable artifact
                          # REQUIRED if needs_migration=true
```

**Commit Provenance:**
```bash
# Workflow MUST checkout exact commit_sha (not branch HEAD)
git checkout ${{ github.event.inputs.commit_sha }}

# Derive parent for diff
PARENT_SHA=$(git rev-parse ${{ github.event.inputs.commit_sha }}^)

# Migration discovery scoped to exact commit
git diff --name-only $PARENT_SHA..${{ github.event.inputs.commit_sha }}
```

**Rationale:** Binds execution to immutable commit. Prevents audit gap where approval for commit A is used to execute modified commit B.

**Provenance Scope Clarification:**
- **4B.2 workflow provenance:** Binds execution to exact immutable migration source commit (`commit_sha`)
- **BDGF authorization:** Remains migration-hash based per frozen R4 contract (I1: Migration Binding)
- **Implication:** Workflow guarantees source commit identity; BDGF guarantees migration content identity
- **Combined:** No execution without both commit provenance AND content verification

**Example:**
```
Commit A: migration X (hash H1) + app.js (version 1)
Commit B: migration X (hash H1) + app.js (version 2)

Scenario: Approval created for commit A
         Workflow dispatched with commit_sha=B

Result: 4B.2 discovers migration in commit B
        Migration hash still H1 (identical content)
        BDGF passes (hash match)
        BUT: Execution bound to commit B (not A)

Prevention: Human approval workflow must verify commit_sha
           matches approved commit before dispatch
```

**Note:** Commit-level binding in BDGF approval records (e.g., `approved_commit_sha` field) would require R4 contract amendment and is outside 4B.2 scope. Current architecture provides workflow-level commit provenance + BDGF content verification.

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

### Downstream Dependency Enforcement

**Application Deployment Job MUST enforce migration result:**

```yaml
app-deploy:
  needs: [detect-changes, migrate-database]
  # Only run if:
  # 1. Migration not needed (needs_migration=false), OR
  # 2. Migration succeeded (migrate-database SUCCESS)
  if: |
    always() &&
    (needs.detect-changes.outputs.needs_migration != 'true' ||
     needs.migrate-database.result == 'success')
```

**Rationale:** Prevents deployment if migration fails. Without this dependency, `app-deploy` with `needs: [detect-changes]` only would proceed even if `migrate-database` fails, violating architectural control-flow.

**Control Flow Guarantee:**
```
migrate-database FAIL
         ↓
app-deploy BLOCKED (job dependency)
         ↓
Production deployment BLOCKED
```

---

### Execution Steps

#### Step 0: Normalize Commit Provenance

**Purpose:** Establish canonical commit SHA for all operations (prevents github.sha/github.event.before inconsistency)

**Implementation:**
```bash
echo "🔒 Normalizing commit provenance..."

# Canonical commit SHA from workflow input
COMMIT_SHA="${{ github.event.inputs.commit_sha }}"

if [ -z "$COMMIT_SHA" ]; then
  echo "❌ ERROR: commit_sha required for provenance binding"
  exit 1
fi

echo "✅ Canonical commit: $COMMIT_SHA"

# Checkout exact commit (detached HEAD)
git checkout --detach "$COMMIT_SHA"

# Verify non-merge commit (one parent only)
PARENT_COUNT=$(git rev-list --parents -n 1 "$COMMIT_SHA" | wc -w)
if [ "$PARENT_COUNT" -ne 2 ]; then
  echo "❌ ERROR: Migration execution target must be a non-merge commit"
  echo "   Commit $COMMIT_SHA has $((PARENT_COUNT - 1)) parents"
  echo "   Policy: One migration per commit requires single-parent commits"
  exit 1
fi

# Derive parent for diff
PARENT_SHA=$(git rev-parse "${COMMIT_SHA}^")
echo "✅ Parent commit: $PARENT_SHA"

# Export for all subsequent steps
echo "COMMIT_SHA=$COMMIT_SHA" >> $GITHUB_ENV
echo "PARENT_SHA=$PARENT_SHA" >> $GITHUB_ENV
```

**Rationale:** All subsequent operations use `$COMMIT_SHA` (not `github.sha`), ensuring execution bound to approved immutable commit.

**Merge Commit Policy:** Migration execution requires single-parent commits. One migration per commit policy incompatible with merge semantics.

---

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

**Purpose:** Find changed migration files using canonical commit provenance

**Implementation:**
```bash
echo "🔍 Discovering migration files..."

# Use canonical commit provenance (NOT github.sha / github.event.before)
CHANGED_MIGRATIONS=$(git diff --name-only \
  "$PARENT_SHA..$COMMIT_SHA" \
  | grep '^supabase/migrations/.*\.sql$' \
  || true)

if [ -z "$CHANGED_MIGRATIONS" ]; then
  echo "⚠️  No migration files detected in commit $COMMIT_SHA"
  echo "   This may indicate a classification error (needs_migration=true but no .sql files)"
  exit 1
fi

echo "Detected migration files in commit $COMMIT_SHA:"
echo "$CHANGED_MIGRATIONS"
```

**Critical:** Uses `$COMMIT_SHA` (approved) not `${{ github.sha }}` (workflow context). Prevents drift between approval and execution.

**Error Condition:** No migrations found → FAIL (possible 4B.1 classification bug)

---

#### Step 3: Validate Single Migration Constraint

**Purpose:** Enforce one migration per commit (Decision 4)

**Implementation:**
```bash
echo "🔒 Validating single migration constraint..."

# Count migrations robustly (handle whitespace, empty lines)
MIGRATION_COUNT=$(echo "$CHANGED_MIGRATIONS" | grep -c '^supabase/migrations/.*\.sql$')

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

**Robust counting:** Uses `grep -c` to handle edge cases (whitespace, empty lines, path variations).

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

#### Step 7: Generate Execution Evidence Artifact

**Purpose:** Create immutable workflow evidence artifact (not authoritative audit)

**Implementation:**
```bash
echo "📝 Generating execution evidence artifact..."

cat > bdgf-execution.json <<EOF
{
  "approval_id": "$APPROVAL_ID",
  "migration_id": "$MIGRATION_ID",
  "migration_file": "$MIGRATION_FILE",
  "migration_hash": "$MIGRATION_HASH",
  "commit_sha": "$COMMIT_SHA",
  "parent_sha": "$PARENT_SHA",
  "triggered_by": "${{ github.actor }}",
  "workflow_run_id": "${{ github.run_id }}",
  "execution_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "environment": "production",
  "result": "SUCCESS"
}
EOF

echo "Execution evidence artifact:"
cat bdgf-execution.json
```

**Critical:** Uses `$COMMIT_SHA` (approved commit) not `${{ github.sha }}` (workflow context). Ensures evidence records exact approved commit.

**Important:** This artifact is workflow evidence only, not an authoritative audit record. 

**Audit Responsibility:**
- Authoritative execution audit records remain BDGF and database responsibility
- Future: `bella_execution_audit` table (out of scope for 4B.2)
- 4B.2 provides workflow-level evidence artifacts only

**Artifact availability:** Workflow logs and GitHub Actions artifacts.

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
1. ✅ Canonical commit SHA normalized and validated
2. ✅ Non-merge commit verified (single parent)
3. ✅ Exactly 1 migration detected in approved commit
4. ✅ `approval_id` provided
5. ✅ Migration file exists
6. ✅ BDGF wrapper returns exit code 0
7. ✅ Execution evidence artifact generated

**Output:**
- Job status: SUCCESS
- Commit SHA (canonical, approved)
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
   - 4B.2 does not perform application deployment
   - 4B.2 provides migration gate result for downstream deployment job
   - Deployment job consumes 4B.2 result via `needs` dependency
   - Migration FAIL → deployment BLOCKED (architectural control-flow)

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
- [x] Contract reviewed
- [x] Contract frozen (v1.2.0 - 2026-08-25)

### Implementation Phase

**Workflow Changes:**
- [ ] Add `migrate-database` job definition
- [ ] Add `approval_id` workflow_dispatch input
- [ ] Add `commit_sha` workflow_dispatch input (provenance)
- [ ] Add conditional: `if: needs_migration == 'true'`
- [ ] Add Step 0: Normalize commit provenance (canonical SHA)
- [ ] Add Step 1: Validate approval_id
- [ ] Add Step 2: Discover migrations (canonical commit diff)
- [ ] Add Step 3: Validate single migration
- [ ] Add Step 4: Derive migration_id
- [ ] Add Step 5: Verify file exists
- [ ] Add Step 6: Invoke BDGF wrapper
- [ ] Add Step 7: Generate evidence artifact (canonical commit SHA)
- [ ] Add error handling (all steps)
- [ ] Add secrets injection
- [ ] Add downstream dependency enforcement (app-deploy needs migrate-database)

**Test Harness:**
- [ ] Create mock BDGF wrapper script
- [ ] Create test scenarios (5 minimum)
- [ ] Create test execution script
- [ ] Verify no production access

### Verification Phase

- [ ] Execute test scenario 1 (valid approval + commit)
- [ ] Execute test scenario 2 (no approval_id)
- [ ] Execute test scenario 3 (multiple migrations)
- [ ] Execute test scenario 4 (no migrations)
- [ ] Execute test scenario 5 (BDGF error)
- [ ] Verify commit provenance enforcement (no github.sha usage)
- [ ] Verify merge commit rejection
- [ ] Verify evidence artifact uses canonical commit_sha
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

**Version:** 1.2.0  
**Status:** 🟢 READY FOR FREEZE  
**Date:** 2026-08-25

**Critical Amendments Applied (2/2 P0):**
- [x] 🔴 P0.1: Canonical commit_sha enforced throughout (Step 0: normalize, Step 2: discover, Step 7: evidence)
- [x] 🔴 P0.2: Evidence artifact records approved commit_sha (not workflow github.sha)

**Additional Clarifications:**
- [x] � Merge commit policy: Migration execution requires single-parent commits
- [x] 🟠 Provenance scope: Workflow provides commit-level binding, BDGF provides hash-level verification
- [x] 🟠 Success criteria terminology: "evidence artifact generated" (not "metadata recorded")

**Architecture Review:**
- [x] All 5 frozen decisions implemented correctly
- [x] All 8 R4 invariants preserved
- [x] No BDGF modifications
- [x] Fail-closed enforcement at every decision point
- [x] Test harness design adequate
- [x] Commit provenance canonically enforced (no github.sha drift)
- [x] Downstream deployment dependency enforced
- [x] Audit vs evidence terminology accurate
- [x] Deployment boundary clearly defined
- [x] Merge commit semantics defined

**Provenance Guarantee:**
```
Approved commit_sha
        ↓
Step 0: git checkout --detach $commit_sha
        ↓
Step 2: git diff $parent..$commit_sha
        ↓
Step 7: evidence.commit_sha = $commit_sha
        ↓
No github.sha / github.event.before usage
```

**Ready for:**
- [ ] Final human review
- [ ] FREEZE decision
- [ ] Commit contract v1.2.0
- [ ] Proceed to test harness + implementation

---

**Principle:** "Contract before code, tests before production"

**Next:** Test Harness → Implementation → Evidence → Certificate

---

## 🔒 FINAL CONTRACT STATUS — FROZEN

**Version:** 1.2.0  
**Status:** 🔒 FROZEN  
**Frozen Date:** 2026-08-25

**Freeze Approval:**
- Human Architect: APPROVED
- Provenance chain: VERIFIED
- R4 invariants: PRESERVED
- BDGF boundary: RESPECTED
- Fail-closed: ENFORCED

**Post-Freeze Policy:**
- Contract modifications require Architecture Change Request (ACR)
- Implementation bugs → fix implementation (not contract)
- Architecture gaps → Gap/Decision Record → ACR → amendment

**Provenance Guarantee:**
```
Approved commit_sha
        ↓
Step 0: git checkout --detach $commit_sha
        ↓
Step 2: git diff $parent..$commit_sha
        ↓
Step 7: evidence.commit_sha = $commit_sha
        ↓
No github.sha / github.event.before usage
```

**Implementation Path:**
1. Commit frozen contract v1.2.0
2. Build isolated test harness (mock BDGF)
3. Execute 5 test scenarios  
4. Collect evidence
5. Implement workflow changes
6. Create completion certificate

---

**END OF CONTRACT**
