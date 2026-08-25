# P0.3 PHASE 4B.3 — DATABASE VERIFICATION TEST HARNESS

**Phase:** Phase 4B.3 — Database Verification  
**Status:** 🟡 IN PROGRESS  
**Version:** 1.0.0  
**Date:** 2026-08-25

**Contract Baseline:**
- 🔒 `P0_3_PHASE4B_3_CONTRACT.md` v1.0.0 (commit 37ae4544) — IMMUTABLE

**Foundation Documents:**
- ✅ `P0_3_PHASE4B_3_DISCOVERY.md` (commit d9f52c9c)
- ✅ `P0_3_PHASE4B_3_DECISIONS.md` (commit 2c64341f) 🔒 FROZEN
- ✅ `P0_3_PHASE4B_3_CONTRACT.md` (commit 37ae4544) 🔒 FROZEN

---

## 🎯 OBJECTIVE

**Prove that Phase 4B.3 Contract v1.0.0 is executable by testing all verification scenarios against contract invariants.**

**Test Philosophy:**
- ✅ Test **Contract**, not implementation details
- ✅ Each test proves complete chain: Input → Expected State → Actual State → Verification Decision → Deployment Consequence → Evidence
- ✅ Fail-closed tests (T2, T3, T5, T6) must prove **deployment blocking**, not just FAIL result
- ✅ T7 must prove: No declaration → Contract invariants verified (NOT guessing from actual DB)

**Success Criteria:**
- 7/7 tests PASS
- Evidence artifacts generated for each test
- Contract proven executable without modification

---

## 📋 TEST SCENARIOS

### **T1: Happy Path — Complete Verification Success**

**Purpose:** Prove successful migration with all invariants satisfied results in deployment eligibility.

**Setup:**
```yaml
Migration: 20260825_add_appointments.sql
Declaration:
  tables:
    hc_appointments:
      columns:
        appointment_id: uuid
        patient_id: uuid
        tenant_id: uuid
        status: text
      primary_key: [appointment_id]
      foreign_keys:
        - column: patient_id
          references: hc_patients(patient_id)
        - column: tenant_id
          references: runtime_tenant_registry(tenant_id)
      rls: required

Actual Database State:
  - Table hc_appointments exists
  - Columns match declaration exactly
  - Primary key on appointment_id
  - Foreign keys to hc_patients, runtime_tenant_registry
  - RLS enabled with 4 policies (SELECT, INSERT, UPDATE, DELETE)
  - All policies enforce tenant_id isolation
```

**Expected State (Contract):**
```javascript
{
  securityInvariants: {
    tenantIsolation: {
      tables: ['hc_appointments'],
      rlsEnabled: true,
      policiesRequired: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
  },
  migrationExpectations: {
    tables: {
      hc_appointments: {
        columns: {
          appointment_id: 'uuid',
          patient_id: 'uuid',
          tenant_id: 'uuid',
          status: 'text',
        },
        primary_key: ['appointment_id'],
        foreign_keys: [...],
        rls_required: true,
      },
    },
  },
}
```

**Verification Steps:**
1. ✅ Connect to database → SUCCESS
2. ✅ Parse migration declaration → SUCCESS
3. ✅ Derive expected state from contract invariants + declaration → SUCCESS
4. ✅ Query actual database state → SUCCESS
5. ✅ Compare expected vs actual:
   - Table exists: ✅ PASS
   - Columns match: ✅ PASS
   - Primary key: ✅ PASS
   - Foreign keys: ✅ PASS
   - RLS enabled: ✅ PASS
   - RLS policies complete: ✅ PASS
   - Tenant isolation enforced: ✅ PASS
6. ✅ Aggregate result → **PASS**
7. ✅ Record evidence → SUCCESS

**Expected Result:**
```json
{
  "verification_id": "v-t1-happy-path",
  "migration_id": "20260825_add_appointments",
  "overall_result": "PASS",
  "deployment_eligible": true,
  "checks": [
    {
      "check_type": "RLS_VERIFICATION",
      "check_name": "hc_appointments.rls_enabled",
      "expected": true,
      "actual": true,
      "result": "PASS",
      "severity": "CRITICAL"
    },
    {
      "check_type": "SCHEMA_STRUCTURE",
      "check_name": "hc_appointments.columns",
      "expected": ["appointment_id:uuid", "patient_id:uuid", "tenant_id:uuid", "status:text"],
      "actual": ["appointment_id:uuid", "patient_id:uuid", "tenant_id:uuid", "status:text"],
      "result": "PASS",
      "severity": "HIGH"
    }
  ],
  "summary": {
    "total_checks": 25,
    "passed": 25,
    "warnings": 0,
    "failed": 0,
    "errors": 0
  }
}
```

**Deployment Consequence:**
```yaml
migrate-database:
  result: SUCCESS  # Verification PASS
  
promote:
  needs: [migrate-database]
  if: needs.migrate-database.result == 'success'
  runs: YES  # ✅ Deployment proceeds
```

**Success Criteria:**
- ✅ Overall result: PASS
- ✅ Deployment eligible: true
- ✅ All 25 checks PASS
- ✅ Evidence artifact generated
- ✅ CI job SUCCESS → promote step runs

---

### **T2: Security Failure — RLS Missing on Critical Table**

**Purpose:** Prove that missing RLS on security-critical table results in FAIL and blocks deployment.

**Setup:**
```yaml
Migration: 20260825_add_patient_notes.sql
Declaration:
  tables:
    hc_patient_notes:
      columns:
        note_id: uuid
        patient_id: uuid
        tenant_id: uuid
        content: text
      rls: required  # ← DECLARED as required

Actual Database State:
  - Table hc_patient_notes exists
  - Columns correct
  - Primary key correct
  - RLS DISABLED  # ❌ CRITICAL VIOLATION
```

**Expected State (Contract):**
```javascript
{
  securityInvariants: {
    tenantIsolation: {
      tables: ['hc_patient_notes'],
      rlsEnabled: true,  // ← MUST be true
      policiesRequired: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
  },
}
```

**Verification Steps:**
1. ✅ Connect to database → SUCCESS
2. ✅ Parse declaration → SUCCESS
3. ✅ Derive expected state → SUCCESS
4. ✅ Query actual state → SUCCESS
5. ❌ Compare expected vs actual:
   - Table exists: ✅ PASS
   - Columns match: ✅ PASS
   - RLS enabled: ❌ **FAIL** (expected: true, actual: false)
6. ❌ Aggregate result → **FAIL**
7. ✅ Record evidence → SUCCESS

**Expected Result:**
```json
{
  "verification_id": "v-t2-rls-missing",
  "migration_id": "20260825_add_patient_notes",
  "overall_result": "FAIL",
  "deployment_eligible": false,
  "checks": [
    {
      "check_type": "RLS_VERIFICATION",
      "check_name": "hc_patient_notes.rls_enabled",
      "expected": true,
      "actual": false,
      "result": "FAIL",
      "severity": "CRITICAL",
      "message": "RLS not enabled on security-critical table hc_patient_notes. Tenant isolation cannot be enforced."
    }
  ],
  "summary": {
    "total_checks": 20,
    "passed": 19,
    "warnings": 0,
    "failed": 1,
    "errors": 0
  }
}
```

**Deployment Consequence:**
```yaml
migrate-database:
  result: FAILURE  # ❌ Verification FAIL
  
promote:
  needs: [migrate-database]
  if: needs.migrate-database.result == 'success'
  runs: NO  # ❌ BLOCKED — promote step skipped
```

**Fail-Closed Proof:**
```
RLS Missing (security-critical)
        ↓
4B.3 Verification: FAIL
        ↓
migrate-database job: FAILURE
        ↓
promote job: SKIPPED (needs dependency failed)
        ↓
Deployment: BLOCKED ✅
```

**Success Criteria:**
- ✅ Overall result: FAIL
- ✅ Deployment eligible: false
- ✅ Failed check severity: CRITICAL
- ✅ Evidence contains failure reason
- ✅ CI job FAILURE → promote blocked
- ✅ **Fail-closed proven**

---

### **T3: Schema Destruction — Unexpected Table Deletion**

**Purpose:** Prove that unexpected deletion of existing table results in FAIL and blocks deployment.

**Setup:**
```yaml
Migration: 20260825_refactor_schema.sql
Declaration:
  # Empty (no structural changes declared)

Actual Database State (BEFORE migration):
  - hc_medications table existed

Actual Database State (AFTER migration):
  - hc_medications table MISSING  # ❌ Unexpected deletion
```

**Expected State (Contract):**
```javascript
{
  securityInvariants: {
    tenantIsolation: {
      tables: ['hc_patients', 'hc_medications', 'edu_students', ...],
      rlsEnabled: true,
    },
  },
  migrationExpectations: {
    // Empty — no declared changes
  },
}
```

**Verification Steps:**
1. ✅ Connect to database → SUCCESS
2. ✅ Parse declaration → SUCCESS (empty)
3. ✅ Derive expected state → SUCCESS (contract invariants only)
4. ✅ Query actual state → SUCCESS
5. ❌ Compare expected vs actual:
   - Drift detection: Table 'hc_medications' expected (security-critical) but MISSING
6. ❌ Aggregate result → **FAIL**
7. ✅ Record evidence → SUCCESS

**Expected Result:**
```json
{
  "verification_id": "v-t3-unexpected-deletion",
  "migration_id": "20260825_refactor_schema",
  "overall_result": "FAIL",
  "deployment_eligible": false,
  "checks": [
    {
      "check_type": "DRIFT_DETECTION",
      "check_name": "unexpected_deletion",
      "expected": "Table hc_medications exists",
      "actual": "Table hc_medications missing",
      "result": "FAIL",
      "severity": "CRITICAL",
      "message": "Unexpected deletion of security-critical table hc_medications. This breaks existing Kernel dependencies."
    }
  ],
  "summary": {
    "total_checks": 15,
    "passed": 14,
    "warnings": 0,
    "failed": 1,
    "errors": 0
  }
}
```

**Deployment Consequence:**
```yaml
migrate-database:
  result: FAILURE  # ❌ Verification FAIL
  
promote:
  runs: NO  # ❌ BLOCKED
```

**Fail-Closed Proof:**
```
Unexpected Deletion (security-critical object)
        ↓
4B.3 Drift Detection: FAIL
        ↓
migrate-database: FAILURE
        ↓
Deployment: BLOCKED ✅
```

**Success Criteria:**
- ✅ Overall result: FAIL
- ✅ Deployment blocked
- ✅ Drift detection identifies deletion
- ✅ Fail-closed proven

---

### **T4: Additive Expansion — Non-Security Column Added**

**Purpose:** Prove that additive non-security changes result in WARNING but allow deployment.

**Setup:**
```yaml
Migration: 20260825_add_metadata_column.sql
Declaration:
  # Empty (developer forgot to declare)

Actual Database State (BEFORE):
  - hc_patients: [patient_id, tenant_id, first_name, last_name]

Actual Database State (AFTER):
  - hc_patients: [patient_id, tenant_id, first_name, last_name, metadata]  # ← New JSONB column
```

**Expected State (Contract):**
```javascript
{
  securityInvariants: {
    tenantIsolation: {
      tables: ['hc_patients'],
      rlsEnabled: true,
    },
  },
  migrationExpectations: {
    // Empty — no declaration
  },
}
```

**Verification Steps:**
1. ✅ Connect to database → SUCCESS
2. ✅ Parse declaration → SUCCESS (empty)
3. ✅ Derive expected state → SUCCESS
4. ✅ Query actual state → SUCCESS
5. ⚠️ Compare expected vs actual:
   - Core invariants: ✅ PASS (RLS still enabled, tenant isolation intact)
   - Drift detection: New column 'metadata' (non-security) → ⚠️ WARNING
6. ⚠️ Aggregate result → **WARNING**
7. ✅ Record evidence → SUCCESS

**Expected Result:**
```json
{
  "verification_id": "v-t4-additive-expansion",
  "migration_id": "20260825_add_metadata_column",
  "overall_result": "WARNING",
  "deployment_eligible": true,
  "checks": [
    {
      "check_type": "RLS_VERIFICATION",
      "check_name": "hc_patients.rls_enabled",
      "expected": true,
      "actual": true,
      "result": "PASS",
      "severity": "CRITICAL"
    },
    {
      "check_type": "DRIFT_DETECTION",
      "check_name": "additive_change",
      "expected": "Columns: [patient_id, tenant_id, first_name, last_name]",
      "actual": "Columns: [patient_id, tenant_id, first_name, last_name, metadata]",
      "result": "WARNING",
      "severity": "WARNING",
      "message": "New non-security column 'metadata' detected. Not declared in migration. Review recommended but not blocking."
    }
  ],
  "summary": {
    "total_checks": 20,
    "passed": 19,
    "warnings": 1,
    "failed": 0,
    "errors": 0
  }
}
```

**Deployment Consequence:**
```yaml
migrate-database:
  result: SUCCESS  # ⚠️ WARNING treated as SUCCESS
  
promote:
  runs: YES  # ✅ Deployment proceeds with warning
```

**Platform Expansion Principle:**
```
Additive non-security change
        ↓
4B.3 Verification: WARNING (not FAIL)
        ↓
migrate-database: SUCCESS
        ↓
Deployment: ELIGIBLE ✅
        ↓
Human review recommended (optional)
```

**Success Criteria:**
- ✅ Overall result: WARNING
- ✅ Deployment eligible: true
- ✅ Warning logged but not blocking
- ✅ Platform expansion enabled

---

### **T5: Infrastructure Failure — Database Unreachable**

**Purpose:** Prove that infrastructure errors result in ERROR, treated as FAIL, and block deployment.

**Setup:**
```yaml
Migration: 20260825_any_migration.sql
Database: UNREACHABLE (network error, credentials invalid, etc.)
```

**Expected State:**
```javascript
// Cannot be derived — database connection required
```

**Verification Steps:**
1. ❌ Connect to database → **ERROR** (connection refused)
2. ⏹️ Abort verification (cannot proceed without database access)
3. ❌ Aggregate result → **ERROR**
4. ✅ Record evidence → SUCCESS (error documented)

**Expected Result:**
```json
{
  "verification_id": "v-t5-db-unreachable",
  "migration_id": "20260825_any_migration",
  "overall_result": "ERROR",
  "deployment_eligible": false,
  "checks": [],
  "error": {
    "type": "DATABASE_UNREACHABLE",
    "message": "Cannot connect to database: Connection refused (ECONNREFUSED)",
    "stack": "..."
  },
  "summary": {
    "total_checks": 0,
    "passed": 0,
    "warnings": 0,
    "failed": 0,
    "errors": 1
  }
}
```

**Deployment Consequence:**
```yaml
migrate-database:
  result: FAILURE  # ❌ ERROR treated as FAILURE
  
promote:
  runs: NO  # ❌ BLOCKED
```

**Fail-Closed Proof:**
```
Database Unreachable
        ↓
4B.3 Verification: ERROR (cannot verify)
        ↓
ERROR treated as FAIL (fail-closed)
        ↓
migrate-database: FAILURE
        ↓
Deployment: BLOCKED ✅
```

**Success Criteria:**
- ✅ Overall result: ERROR
- ✅ Deployment eligible: false
- ✅ ERROR treated as FAIL (not PASS or WARNING)
- ✅ Evidence contains error details
- ✅ **Fail-closed proven** (unknown state → block)

---

### **T6: Type Mismatch — Declared vs Actual Divergence**

**Purpose:** Prove that type mismatch between declaration and actual database results in FAIL.

**Setup:**
```yaml
Migration: 20260825_add_encounter.sql
Declaration:
  tables:
    hc_encounters:
      columns:
        encounter_id: uuid      # ← Declared as UUID
        patient_id: uuid
        status: text

Actual Database State:
  - Table hc_encounters exists
  - encounter_id: TEXT          # ❌ Actual is TEXT (not UUID)
  - patient_id: uuid
  - status: text
```

**Expected State (Contract):**
```javascript
{
  migrationExpectations: {
    tables: {
      hc_encounters: {
        columns: {
          encounter_id: 'uuid',  // ← Expected
          patient_id: 'uuid',
          status: 'text',
        },
      },
    },
  },
}
```

**Verification Steps:**
1. ✅ Connect to database → SUCCESS
2. ✅ Parse declaration → SUCCESS
3. ✅ Derive expected state → SUCCESS
4. ✅ Query actual state → SUCCESS
5. ❌ Compare expected vs actual:
   - encounter_id type: ❌ **FAIL** (expected: uuid, actual: text)
6. ❌ Aggregate result → **FAIL**
7. ✅ Record evidence → SUCCESS

**Expected Result:**
```json
{
  "verification_id": "v-t6-type-mismatch",
  "migration_id": "20260825_add_encounter",
  "overall_result": "FAIL",
  "deployment_eligible": false,
  "checks": [
    {
      "check_type": "SCHEMA_STRUCTURE",
      "check_name": "hc_encounters.encounter_id.type",
      "expected": "uuid",
      "actual": "text",
      "result": "FAIL",
      "severity": "HIGH",
      "message": "Column type mismatch: encounter_id declared as 'uuid' but actual type is 'text'. Migration did not apply as declared."
    }
  ],
  "summary": {
    "total_checks": 18,
    "passed": 17,
    "warnings": 0,
    "failed": 1,
    "errors": 0
  }
}
```

**Deployment Consequence:**
```yaml
migrate-database:
  result: FAILURE  # ❌ Verification FAIL
  
promote:
  runs: NO  # ❌ BLOCKED
```

**Critical Distinction Proof:**
```
Declaration: "encounter_id should be uuid"
        ↓
4B.3 queries actual DB: "encounter_id is text"
        ↓
Declaration ≠ Actual
        ↓
FAIL (declaration is NOT proof) ✅
        ↓
Deployment: BLOCKED
```

**Success Criteria:**
- ✅ Overall result: FAIL
- ✅ Deployment blocked
- ✅ Proves: Declaration ≠ proof (must verify against actual DB)
- ✅ Type mismatch detected
- ✅ Fail-closed proven

---

### **T7: No Declaration — Fallback to Contract Invariants Only**

**Purpose:** Prove that absence of migration declaration does NOT cause guessing; system falls back to contract invariants only.

**Setup:**
```yaml
Migration: 20260825_legacy_migration.sql
Declaration: NONE  # ← No declaration provided

Actual Database State:
  - All security-critical tables exist
  - RLS enabled on all security-critical tables
  - Tenant isolation enforced
  - Some new column 'notes' added to hc_patients (not declared)
```

**Expected State (Contract):**
```javascript
{
  securityInvariants: {
    tenantIsolation: {
      tables: ['hc_patients', 'edu_students', ...],
      rlsEnabled: true,
      policiesRequired: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
  },
  migrationExpectations: {
    // EMPTY — no declaration, so NO migration-specific expectations
  },
}
```

**Verification Steps:**
1. ✅ Connect to database → SUCCESS
2. ✅ Parse declaration → SUCCESS (empty/none)
3. ✅ Derive expected state → SUCCESS (contract invariants ONLY)
4. ✅ Query actual state → SUCCESS
5. ✅ Compare expected vs actual:
   - Security invariants: ✅ PASS (RLS enabled, tenant isolation intact)
   - Drift detection: New column 'notes' (additive, non-security) → ⚠️ WARNING
6. ⚠️ Aggregate result → **WARNING** (security PASS, additive change flagged)
7. ✅ Record evidence → SUCCESS

**Expected Result:**
```json
{
  "verification_id": "v-t7-no-declaration",
  "migration_id": "20260825_legacy_migration",
  "overall_result": "WARNING",
  "deployment_eligible": true,
  "checks": [
    {
      "check_type": "RLS_VERIFICATION",
      "check_name": "security_critical_tables.rls_enabled",
      "expected": true,
      "actual": true,
      "result": "PASS",
      "severity": "CRITICAL"
    },
    {
      "check_type": "DRIFT_DETECTION",
      "check_name": "additive_change",
      "expected": "No expectation (no declaration)",
      "actual": "New column 'notes' on hc_patients",
      "result": "WARNING",
      "severity": "WARNING",
      "message": "Additive change detected without declaration. Security invariants intact. Review recommended."
    }
  ],
  "summary": {
    "total_checks": 15,
    "passed": 14,
    "warnings": 1,
    "failed": 0,
    "errors": 0
  }
}
```

**Deployment Consequence:**
```yaml
migrate-database:
  result: SUCCESS  # ⚠️ WARNING, security PASS
  
promote:
  runs: YES  # ✅ Deployment eligible
```

**OPC Principle Proof:**
```
No Declaration
        ↓
4B.3 does NOT guess expected state from actual DB
        ↓
Falls back to: Contract invariants ONLY
        ↓
Verifies: Security-critical invariants (RLS, tenant isolation)
        ↓
Additive changes: WARNING (not verified, not blocked)
        ↓
Result: Security PASS → Deploy eligible ✅
        ↓
"System cannot self-validate correctness from current state alone" ✅
```

**Critical Distinctions:**

| Scenario | System Behavior | OPC Principle |
|----------|-----------------|---------------|
| No declaration + Security intact | WARNING (eligible) | ✅ No guessing |
| No declaration + RLS missing | FAIL (blocked) | ✅ Contract enforced |
| No declaration + Additive change | WARNING (eligible) | ✅ Platform expansion |

**Success Criteria:**
- ✅ Overall result: WARNING (not PASS — acknowledges incomplete verification)
- ✅ Deployment eligible: true (security invariants satisfied)
- ✅ NO inference from actual database state
- ✅ Contract invariants verified independently
- ✅ **OPC principle proven:** "System cannot self-validate correctness from current state alone"
- ✅ Additive changes flagged but not blocking

---

## 📊 TEST SUMMARY MATRIX

| Test | Scenario | Expected Result | Deployment | Fail-Closed | OPC Principle |
|------|----------|-----------------|------------|-------------|---------------|
| T1 | Happy Path | PASS | ✅ ELIGIBLE | N/A | ✅ Declaration verified |
| T2 | RLS Missing | FAIL | ❌ BLOCKED | ✅ Proven | ✅ Security enforced |
| T3 | Unexpected Deletion | FAIL | ❌ BLOCKED | ✅ Proven | ✅ Drift detected |
| T4 | Additive Change | WARNING | ✅ ELIGIBLE | N/A | ✅ Platform expansion |
| T5 | DB Unreachable | ERROR | ❌ BLOCKED | ✅ Proven | ✅ Unknown → Block |
| T6 | Type Mismatch | FAIL | ❌ BLOCKED | ✅ Proven | ✅ Declaration ≠ proof |
| T7 | No Declaration | WARNING | ✅ ELIGIBLE | N/A | ✅ No guessing |

---

## 🔬 VERIFICATION CHAIN PROOF

Each test must prove complete chain:

```
Input (Migration + Declaration)
        ↓
Expected State (Contract + Declaration)
        ↓
Actual State (PostgreSQL Introspection)
        ↓
Verification Decision (PASS/WARNING/FAIL/ERROR)
        ↓
Deployment Consequence (ELIGIBLE/BLOCKED)
        ↓
Evidence Artifact (JSON + DB Record)
```

**Fail-Closed Tests (T2, T3, T5, T6) Must Prove:**
1. Verification result: FAIL or ERROR
2. migrate-database job: FAILURE
3. promote job: SKIPPED (dependency failed)
4. Deployment: BLOCKED
5. Evidence: Failure reason documented

**OPC Principle Tests (All) Must Prove:**
- Expected state derived from contract/declaration (NOT from actual DB)
- No inference of correctness from actual state alone
- System verifies independently, not self-validates

---

## 📦 EVIDENCE ARTIFACTS

Each test generates:

1. **Verification Result JSON:**
   - `artifacts/verification/v-{test-id}-result.json`
   - Contains: verification_id, overall_result, checks, summary, evidence chain

2. **Database Record:**
   - `migration_governance.verification_results` table
   - Links to: migration_id, commit_sha, approval_id (from 4B.2)

3. **Test Evidence Document:**
   - `docs/architecture/P0_3_PHASE4B_3_TEST_EVIDENCE.md`
   - Proves: 7/7 tests PASS, Contract executable without modification

---

## ✅ SUCCESS CRITERIA

**Test Harness COMPLETE when:**
1. ✅ 7/7 tests implemented
2. ✅ Each test proves complete verification chain
3. ✅ Fail-closed proven for T2, T3, T5, T6
4. ✅ OPC principle proven for all tests
5. ✅ Evidence artifacts generated for each test
6. ✅ Contract v1.0.0 (37ae4544) NOT modified during testing
7. ✅ Test evidence document complete

**Then proceed to:**
```
✅ Test Harness → Test Evidence → Implementation → Implementation Evidence → Certificate
```

---

## 🔒 IMMUTABILITY GUARANTEE

**Contract v1.0.0 (commit 37ae4544) is IMMUTABLE baseline.**

If tests reveal Contract ambiguity or impossibility:
1. Document gap in Test Evidence
2. Create ADR for Contract v1.1.0
3. Do NOT modify frozen Contract v1.0.0
4. Refreeze as new version with explicit changelog

**Test implementation details (mocks, adapters) may evolve; Contract may not.**

---

**Next Step:** Implement 7 test scenarios and generate Test Evidence document.
