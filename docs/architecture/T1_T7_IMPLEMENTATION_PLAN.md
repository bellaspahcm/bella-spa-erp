# T1-T7 Implementation Plan

**Date:** 2026-08-25  
**Status:** 🟡 PLANNING  
**Gate C:** ✅ COMPLETE  

---

## 🎯 OBJECTIVE

Implement T1-T7 runtime validation according to frozen Contract v1.0.0 (37ae4544) and Test Harness v1.0.0 (e535ad0c).

**NOT MOCK TESTS.** Real integration tests against verification engine + database.

---

## 📋 PHASE T0: INSPECTION COMPLETE

### Existing Components Found

**Verification Engine:**
- `src/platform/migration-governance/verification/index.ts` — Public API
- `src/platform/migration-governance/verification/verification-engine.ts` — Main engine
- `src/platform/migration-governance/verification/types.ts` — Type definitions

**State Resolution:**
- `ExpectedStateResolver` — Parses declarations + contract invariants
- Contract invariants: `getContractInvariants()`
- Declaration parser: `parseMigrationDeclaration()`

**Verification Checks:**
- `checks/schema-verification.ts` — Table/column verification
- `checks/constraint-verification.ts` — PK/FK verification
- `checks/rls-verification.ts` — RLS status/policies verification
- `checks/drift-detection.ts` — Additive/destructive drift

**Evidence Generation:**
- `evidence-generator.ts` — JSON artifact + DB record
- `generateJSONArtifact()` — Creates `artifacts/verification/*.json`
- `insertDBRecord()` — Inserts into `migration_governance.verification_results`

**Database Adapter:**
- `DirectPostgreSQLAdapter` — ✅ 8/8 methods functional
- Contract interface: `queryTables()`, `queryColumns()`, `queryPrimaryKey()`, `queryForeignKeys()`, `queryRLSStatus()`, `queryRLSPolicies()`

---

## 🗺️ TEST MAPPING

### T1: Happy Path

**Fixture:**
- Table: `test_appointments` (or use existing `hc_appointments` if suitable)
- Columns: `appointment_id` (PK), `patient_id` (FK), `tenant_id`, `status`
- Foreign keys: → `hc_patients(patient_id)`, → `runtime_tenant_registry(tenant_id)`
- RLS: enabled with 4 policies (SELECT, INSERT, UPDATE, DELETE)

**Declaration:**
```yaml
tables:
  test_appointments:
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
```

**Expected:**
- `verification_result`: PASS
- `deployment_eligible`: true
- All invariant checks: PASS

**Engine checks:**
- Schema structure ✅
- Primary key ✅
- Foreign keys ✅
- RLS enabled ✅
- RLS policies complete ✅

---

### T2: Missing RLS

**Fixture mutation:**
- Same as T1 BUT: `ALTER TABLE test_appointments DISABLE ROW LEVEL SECURITY;`

**Declaration:**
- Same as T1 (declares `rls: required`)

**Expected:**
- `verification_result`: FAIL
- `deployment_eligible`: false
- `blocking_reason`: "RLS required but disabled on security-critical table"

**Engine check that MUST fail:**
- `checks/rls-verification.ts` → RLS enabled check

**Proof required:**
- deployment_eligible = false (BLOCKED)

---

### T3: Missing Foreign Key

**Fixture mutation:**
- Same as T1 BUT: One FK constraint not created

**Declaration:**
- Same as T1 (declares both FKs)

**Expected:**
- `verification_result`: FAIL
- `deployment_eligible`: false
- `blocking_reason`: "Foreign key constraint missing"

**Engine check that MUST fail:**
- `checks/constraint-verification.ts` → FK verification

---

### T4: Additive Drift (Unexpected Column)

**Fixture mutation:**
- Same as T1 PLUS: Extra column `notes text` not in declaration

**Declaration:**
- Same as T1 (does NOT declare `notes` column)

**Expected:**
- `verification_result`: WARNING
- `deployment_eligible`: true (NOT BLOCKED)
- `drift_detected`: "Unexpected column: notes"

**Engine check:**
- `checks/drift-detection.ts` → `detectAdditiveChanges()`

**Proof required:**
- WARNING result
- deployment_eligible = true (additive changes don't block)

---

### T5: Incomplete RLS Policy

**Fixture mutation:**
- Same as T1 BUT: Only 3 RLS policies (missing DELETE policy)

**Declaration:**
- Same as T1 (requires RLS)

**Expected:**
- `verification_result`: FAIL
- `deployment_eligible`: false
- `blocking_reason`: "RLS policy incomplete (missing DELETE command)"

**Engine check:**
- `checks/rls-verification.ts` → Policy completeness check

---

### T6: Destructive Drift (Column Deleted)

**Fixture mutation:**
- Same as T1 BUT: `status` column missing

**Declaration:**
- Same as T1 (declares `status` column)

**Expected:**
- `verification_result`: FAIL
- `deployment_eligible`: false
- `blocking_reason`: "Declared column missing (destructive drift)"

**Engine check:**
- `checks/drift-detection.ts` → `detectColumnModifications()`

---

### T7: No Declaration (OPC Principle)

**Fixture:**
- Existing table (e.g., `runtime_tenant_registry`)

**Declaration:**
- NULL or empty (no declaration provided)

**Expected:**
- `verification_result`: Per contract OPC semantics
- `deployment_eligible`: Depends on contract invariants only
- Contract invariants checked: YES
- Migration-specific checks: SKIPPED (no declaration)

**Engine behavior:**
- `ExpectedStateResolver` → `parseMigrationDeclaration()` returns null
- Only contract invariants verified (security-critical tables RLS)
- No assertion on undeclared tables/columns

---

## 📋 PHASE T1: Fixture Isolation Strategy

### Option A: Transaction Rollback (Preferred)

```typescript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  // Setup: Create test fixture
  await setupT1Fixture(client);
  
  // Execute: Run verification engine
  const result = await verifyMigration({...});
  
  // Assert: Check expected vs actual
  assert(result.overall_result === 'PASS');
  assert(result.deployment_eligible === true);
  
  // Evidence: Generate artifact
  await generateEvidence(result);
  
  await client.query('ROLLBACK'); // Cleanup
} finally {
  client.release();
}
```

**Problem:** DDL may not be transactional, and verification engine uses separate connection pool.

### Option B: Isolated Test Schema (Recommended)

```typescript
// Setup: Create isolated schema
await client.query('CREATE SCHEMA IF NOT EXISTS test_t1');
await client.query('SET search_path TO test_t1, public');

// Create fixture in test_t1 schema
await setupT1Fixture(client);

// Execute verification (engine queries test_t1 schema)
const result = await verifyMigration({...});

// Evidence
await generateEvidence(result);

// Cleanup: Drop schema (preserves evidence artifacts)
await client.query('DROP SCHEMA test_t1 CASCADE');
```

**Problem:** Contract invariants may expect `public` schema tables.

### Option C: Prefixed Test Tables (Safest)

```typescript
// Setup: Create test tables with unique prefix
const testPrefix = `test_t1_${Date.now()}`;
await client.query(`CREATE TABLE ${testPrefix}_appointments (...)`);

// Execute verification
const result = await verifyMigration({
  migration_id: `test-t1-${Date.now()}`,
  ...
});

// Cleanup: Drop test tables (preserve evidence)
await client.query(`DROP TABLE IF EXISTS ${testPrefix}_appointments CASCADE`);
```

**Chosen:** Option C (safest, no namespace conflicts)

---

## 📋 PHASE T2: Evidence Writer

### Artifact Structure

**Path:** `artifacts/verification/v-t{1-7}-{scenario}-{timestamp}.json`

**Required fields:**
```json
{
  "test_id": "v-t1-happy-path",
  "test_execution_timestamp": "2026-08-25T...",
  
  "contract_version": "1.0.0",
  "contract_commit": "37ae4544",
  "harness_version": "1.0.0",
  "harness_commit": "e535ad0c",
  
  "setup_state": {
    "description": "Happy path: all invariants satisfied",
    "fixture_tables": ["test_t1_xxx_appointments"],
    "declaration_provided": true,
    "declaration": {...}
  },
  
  "expected_outcome": {
    "verification_result": "PASS",
    "deployment_eligible": true,
    "blocking_reason": null
  },
  
  "actual_outcome": {
    "verification_id": "...",
    "migration_id": "...",
    "verification_result": "PASS",
    "deployment_eligible": true,
    "overall_result": "PASS",
    "checks": [...],
    "summary": {...}
  },
  
  "assertion": {
    "expected_matches_actual": true,
    "verification_result_match": true,
    "deployment_eligible_match": true
  },
  
  "evidence": {
    "json_artifact_path": "artifacts/verification/v-xxx.json",
    "json_artifact_sha256": "...",
    "database_record_inserted": true,
    "verification_results_table": "migration_governance.verification_results",
    "verification_id": "..."
  },
  
  "cleanup": {
    "fixture_tables_dropped": true,
    "artifact_preserved": true,
    "status": "SUCCESS"
  }
}
```

### SHA-256 Artifact Hash

```typescript
import { createHash } from 'crypto';
import { readFileSync } from 'fs';

function computeArtifactHash(artifactPath: string): string {
  const content = readFileSync(artifactPath, 'utf8');
  return createHash('sha256').update(content).digest('hex');
}
```

---

## 📋 PHASE T3: Execute T1 First

**Sequence:**
1. Implement T1 fixture setup
2. Run verification engine against T1 fixture
3. Generate T1 artifact
4. Verify T1 evidence:
   - JSON artifact exists
   - SHA-256 hash computed
   - DB record inserted
   - deployment_eligible = true
5. Inspect T1 artifact manually
6. **STOP.** Do not proceed to T2-T7 until T1 approved.

**Approval criteria:**
- Artifact structure correct
- Engine execution correct
- Evidence persistence correct
- Cleanup correct
- Fixture pattern safe

**After T1 approved:**
- Reuse framework for T2-T7
- Each test uses same evidence writer
- Each test uses same cleanup pattern

---

## 🚫 NEGATIVE TEST SEMANTICS

### T2/T3/T5/T6 Are NOT Failures

**Common misunderstanding:**
```
T2 result: FAIL → Test FAILED ❌ (WRONG)
```

**Correct understanding:**
```
T2 expected: FAIL
T2 actual: FAIL
T2 assertion: PASS ✅
```

**Test pass/fail vs verification pass/fail:**

| Test | Verification Result | Deployment Eligible | Test Assertion |
|------|---------------------|---------------------|----------------|
| T1 | PASS | true | ✅ PASS |
| T2 | FAIL | false | ✅ PASS (expected FAIL) |
| T3 | FAIL | false | ✅ PASS (expected FAIL) |
| T4 | WARNING | true | ✅ PASS (expected WARNING) |
| T5 | FAIL | false | ✅ PASS (expected FAIL) |
| T6 | FAIL | false | ✅ PASS (expected FAIL) |
| T7 | varies | varies | ✅ PASS (matches contract) |

**Gate D success criteria:** 7/7 test assertions PASS

---

## 📋 IMPLEMENTATION CHECKLIST

### Pre-Implementation
- [x] Inspect verification engine
- [x] Inspect database adapter
- [x] Inspect evidence generator
- [x] Map test scenarios to engine checks
- [x] Choose fixture isolation strategy
- [ ] Review Test Harness specification
- [ ] Review Contract invariants

### T1 Implementation
- [ ] Create T1 fixture setup function
- [ ] Create T1 declaration
- [ ] Execute verification engine
- [ ] Assert expected vs actual
- [ ] Generate evidence artifact
- [ ] Compute SHA-256 hash
- [ ] Verify DB record insertion
- [ ] Verify deployment_eligible = true
- [ ] Cleanup fixture
- [ ] Preserve artifact

### T1 Verification
- [ ] Inspect artifact structure
- [ ] Verify provenance fields
- [ ] Verify evidence persistence
- [ ] Verify cleanup safety
- [ ] Architect approval for T1

### T2-T7 Implementation
- [ ] T2: Fixture mutation (disable RLS)
- [ ] T2: Assert FAIL + BLOCKED
- [ ] T3: Fixture mutation (missing FK)
- [ ] T3: Assert FAIL + BLOCKED
- [ ] T4: Fixture mutation (extra column)
- [ ] T4: Assert WARNING + ELIGIBLE
- [ ] T5: Fixture mutation (incomplete RLS)
- [ ] T5: Assert FAIL + BLOCKED
- [ ] T6: Fixture mutation (missing column)
- [ ] T6: Assert FAIL + BLOCKED
- [ ] T7: No declaration provided
- [ ] T7: Assert contract-defined behavior

### Evidence Consolidation
- [ ] Collect 7 artifacts
- [ ] Verify 7 DB records
- [ ] Generate consolidated report
- [ ] Document any discrepancies

### Gate D Submission
- [ ] Present evidence to architect
- [ ] Resolve any unexpected outcomes
- [ ] Obtain Gate D approval

---

## 🚫 FORBIDDEN ACTIONS

❌ Modify Contract v1.0.0 (37ae4544)  
❌ Modify verification engine semantics to make tests pass  
❌ Mock expected results without running engine  
❌ Remove SupabaseAdapter before Certificate  
❌ Remove RPC migration before Certificate  
❌ Bypass Architecture Guard  
❌ Delete evidence artifacts during cleanup  
❌ Claim "T1-T7 PASS" before execution  
❌ Convert T2/T3/T5/T6 to PASS artificially  
❌ Run T6 against production tables  

---

## 📊 Definition of Done

**T1-T7 Complete:**
- [ ] 7 test scenarios executed against real DB
- [ ] 7 evidence artifacts generated
- [ ] 7 DB records in verification_results
- [ ] Provenance present (contract/harness commits)
- [ ] deployment_eligible proven for each test
- [ ] Negative tests prove blocking (T2/T3/T5/T6)
- [ ] T4 proves WARNING + ELIGIBLE
- [ ] T7 proves OPC semantics
- [ ] Cleanup verified (fixtures removed, artifacts preserved)
- [ ] Consolidated report generated

**Governance Preserved:**
- [ ] Contract v1.0.0 unchanged
- [ ] Verification Engine semantics unchanged
- [ ] SupabaseAdapter retained
- [ ] RPC migration retained
- [ ] Architecture Guard intact

**Gate D Ready:**
- [ ] All evidence artifacts available
- [ ] All DB records queryable
- [ ] Consolidated report complete
- [ ] Ready for architect review

---

**Status:** 🟡 **PLANNING COMPLETE → READY FOR T1 IMPLEMENTATION**  
**Next:** Implement T1 fixture + runner → Execute T1 → Verify evidence → Architect approval → T2-T7
