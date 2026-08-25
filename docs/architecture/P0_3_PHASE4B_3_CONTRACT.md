# P0.3 PHASE 4B.3 — DATABASE VERIFICATION CONTRACT

**Phase:** Phase 4B.3 — Database Verification  
**Status:** 🟡 DRAFT — PENDING FREEZE  
**Version:** 1.0.0-draft  
**Date:** 2026-08-25

**Foundation Documents:**
- ✅ `P0_3_PHASE4B_3_DISCOVERY.md` (commit d9f52c9c)
- ✅ `P0_3_PHASE4B_3_DECISIONS.md` (commit 2c64341f) 🔒 FROZEN

---

## 🎯 OBJECTIVE

**Verify database state after BDGF-authorized migration execution to ensure Bella's architectural invariants remain intact.**

**What 4B.3 Does:**
- Verify migration applied correctly (schema structure, constraints, RLS)
- Validate security invariants (tenant isolation, RLS policies)
- Detect unexpected schema destruction or modification
- Generate verification evidence
- Control deployment eligibility (PASS → proceed; FAIL → block)

**What 4B.3 Does NOT Do:**
- ❌ Execute migrations (BDGF responsibility)
- ❌ Authorize migrations (BDGF R4 responsibility)
- ❌ Repair database state (read-only verification)
- ❌ Audit database health (not a monitoring tool)
- ❌ Replace human judgment (automated invariant checking only)

**Verification Philosophy:**

> **4B.3 does not prove database is perfect. It proves migration didn't break Bella's required invariants.**

---

## 📚 FOUNDATION DOCUMENTS

**This contract builds on:**
- ✅ `P0_3_PHASE4B_CONTROL_PLANE_CONTRACT.md` — Overall control plane
- ✅ `P0_3_PHASE4B_2_CONTRACT.md` v1.2.0 (commit ff9fb498) — BDGF integration
- ✅ `P0_3_PHASE4B_3_DISCOVERY.md` (commit d9f52c9c) — Requirements analysis
- ✅ `P0_3_PHASE4B_3_DECISIONS.md` (commit 2c64341f) — Frozen decisions (D1-D7)

**All foundation documents FROZEN.**

---

## 🏗️ ARCHITECTURE

### Integration Flow

```
Developer Push
      ↓
GitHub Actions: detect-changes (4B.1)
      ├─ needs_migration = true
      ↓
GitHub Actions: migrate-database (4B.2)
      │
      ├─ Input: approval_id, commit_sha
      ├─ Discovery: migration files
      ├─ Validation: constraints
      ├─ BDGF Execution
      ├─ Execution Evidence
      │
      ▼
GitHub Actions: verify-database (4B.3 NEW)
      │
      ├─ Expected State (contract invariants)
      ├─ Actual State (PostgreSQL introspection)
      ├─ Verification Checks
      │   ├─ Schema structure
      │   ├─ Constraints
      │   ├─ RLS policies
      │   └─ Security invariants
      │
      ├─ Result: PASS / WARNING / FAIL / ERROR
      ├─ Verification Evidence
      │
      ▼
Result: PASS / WARNING
      │
      ▼
Deployment ELIGIBLE
      │
      ▼
promote job (4B.2)

Result: FAIL / ERROR
      │
      ▼
Deployment BLOCKED
```

### Boundary Definition

```
┌────────────────────────────────────────────────────────────┐
│  4B.2 BDGF Integration                                     │
│  - Canonical provenance                                    │
│  - Migration discovery                                     │
│  - BDGF wrapper invocation                                 │
│  - Execution evidence                                      │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼ Migration executed
┌────────────────────────────────────────────────────────────┐
│  4B.3 Database Verification (NEW)                          │
│  - Expected state derivation                               │
│  - Actual state introspection                              │
│  - Invariant validation                                    │
│  - Verification evidence                                   │
│  - Deployment eligibility decision                         │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼ Verification result
┌────────────────────────────────────────────────────────────┐
│  CI/CD Deployment (promote job)                            │
│  - Conditional: verification PASS/WARNING → proceed        │
│  - Conditional: verification FAIL/ERROR → block            │
└────────────────────────────────────────────────────────────┘
```

**4B.3 MUST NOT modify:**
- Application/business schema
- BDGF frozen components
- Healthcare/Logistics/Finance Kernels

**4B.3 MAY write:**
- `migration_governance.verification_results` (audit only)
- Verification evidence artifacts

---

## 📋 CONTRACT SPECIFICATION

### Input Parameters

**From 4B.2 (migrate-database job):**
```yaml
migration_id: string           # e.g., "20260825120000_add_patients"
migration_file: string          # Path to SQL file
commit_sha: string              # Canonical commit (P0.1/P0.2)
approval_id: string             # From BDGF approval
environment: string             # "production", "staging", "test"
```

**From Environment:**
```yaml
DATABASE_EXECUTOR_URL: secret   # PostgreSQL connection string
VERIFICATION_ENGINE_VERSION: string  # e.g., "1.0.0"
```

**From Contract Invariants (Internal):**
```javascript
// Security-critical tables (tenant isolation required)
const SECURITY_CRITICAL_TABLES = [
  'runtime_tenant_registry',
  'hc_*',  // Healthcare Kernel
  'edu_*', // Education Kernel
  'logistics_*', // Logistics Kernel
  'finance_*',   // Finance Kernel
  // All tables with tenant_id column
];

// RLS requirements
const RLS_REQUIREMENTS = {
  enabled: true,
  policies: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  tenantIsolationEnforced: true,
};
```

---

### Verification Steps

#### Step 0: Initialize Verification Context

**Purpose:** Establish verification session and safety checks

**Implementation:**
```javascript
const verificationId = generateUUID();
const timestamp = new Date().toISOString();

// Safety checks
if (!migration_id) throw new Error('migration_id REQUIRED');
if (!commit_sha) throw new Error('commit_sha REQUIRED');
if (!environment) throw new Error('environment REQUIRED');

// Validate commit_sha format (40-char hex)
if (!/^[0-9a-f]{40}$/.test(commit_sha)) {
  throw new Error('Invalid commit_sha format');
}

// Initialize result structure
const verificationResult = {
  verification_id: verificationId,
  migration_id,
  commit_sha,
  environment,
  timestamp,
  checks: [],
  overall_result: null, // PASS / WARNING / FAIL / ERROR
};
```

**Success Criteria:**
- ✅ Verification context initialized
- ✅ Input parameters validated
- ✅ Result structure created

**Failure Handling:**
- Invalid input → ERROR → FAIL verification → BLOCK deployment

---

#### Step 1: Connect to Database

**Purpose:** Establish PostgreSQL connection via adapter

**Implementation:**
```javascript
const adapter = createPostgreSQLAdapter({
  connectionString: process.env.DATABASE_EXECUTOR_URL,
  environment,
});

try {
  await adapter.connect();
  log('✅ Database connection established');
} catch (error) {
  return {
    overall_result: 'ERROR',
    error: `Cannot connect to database: ${error.message}`,
  };
}
```

**Success Criteria:**
- ✅ Database connection established
- ✅ Adapter initialized

**Failure Handling:**
- Connection failed → ERROR → FAIL (fail-closed) → BLOCK deployment

---

#### Step 2: Derive Expected State

**Purpose:** Determine what database state SHOULD be after migration

**Implementation:**
```javascript
// Phase 1: Derive from contract invariants
const expectedState = {
  securityCriticalTables: identifySecurityCriticalTables(),
  rlsRequirements: RLS_REQUIREMENTS,
  tenantIsolationEnforced: true,
};

// Future phases: Parse .expect.json if exists
// const declaredExpectations = parseExpectationFile(migration_id);
// expectedState = merge(expectedState, declaredExpectations);
```

**Expected State Structure:**
```javascript
{
  // Security invariants (always checked)
  securityInvariants: {
    tenantIsolation: {
      tables: ['hc_patients', 'edu_students', ...],
      rlsEnabled: true,
      policiesRequired: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    },
  },
  
  // Migration-specific expectations (Phase 1: minimal)
  migrationExpectations: {
    // Can be inferred from migration SQL or declared in .expect.json
    tablesCreated: [], // e.g., ['hc_appointments']
    columnsAdded: {},  // e.g., { hc_patients: ['status'] }
  },
}
```

**Success Criteria:**
- ✅ Expected state derived from invariants
- ✅ Security requirements identified

---

#### Step 3: Query Actual Database State

**Purpose:** Introspect current database schema and policies

**Implementation:**
```javascript
const actualState = {
  tables: await adapter.queryTables('public'),
  columns: {},
  constraints: {},
  rlsPolicies: {},
};

// For each security-critical table
for (const table of expectedState.securityInvariants.tenantIsolation.tables) {
  actualState.columns[table] = await adapter.queryColumns(table);
  actualState.constraints[table] = await adapter.queryConstraints(table);
  actualState.rlsPolicies[table] = await adapter.queryRLS(table);
}
```

**Introspection Queries:**
```sql
-- Tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- Columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = $1;

-- Constraints
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' AND table_name = $1;

-- RLS Policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = $1;
```

**Success Criteria:**
- ✅ Actual state captured
- ✅ Schema introspected
- ✅ RLS policies retrieved

**Failure Handling:**
- Query failed → ERROR → FAIL (fail-closed)

---

#### Step 4: Execute Verification Checks

**Purpose:** Compare expected vs actual state; validate invariants

**Check Types:**

**4.1: Security-Critical RLS Verification (MANDATORY)**
```javascript
for (const table of expectedState.securityInvariants.tenantIsolation.tables) {
  const check = {
    check_type: 'rls_policy',
    check_name: `${table}_rls_enabled`,
    severity: 'CRITICAL',
  };
  
  const rlsState = actualState.rlsPolicies[table];
  
  if (!rlsState || !rlsState.enabled) {
    check.result = 'FAIL';
    check.expected = 'RLS enabled';
    check.actual = 'RLS disabled or missing';
  } else if (!hasRequiredPolicies(rlsState, ['SELECT', 'INSERT', 'UPDATE', 'DELETE'])) {
    check.result = 'FAIL';
    check.expected = 'Policies: SELECT, INSERT, UPDATE, DELETE';
    check.actual = `Policies: ${rlsState.policies.join(', ')}`;
  } else {
    check.result = 'PASS';
    check.expected = 'RLS enabled with required policies';
    check.actual = 'RLS enabled with required policies';
  }
  
  verificationResult.checks.push(check);
}
```

**4.2: Schema Structure Verification**
```javascript
// Expected tables exist
for (const table of expectedState.migrationExpectations.tablesCreated) {
  const check = {
    check_type: 'schema_structure',
    check_name: `table_${table}_exists`,
    severity: 'CRITICAL',
  };
  
  if (!actualState.tables.includes(table)) {
    check.result = 'FAIL';
    check.expected = `Table '${table}' exists`;
    check.actual = `Table '${table}' missing`;
  } else {
    check.result = 'PASS';
  }
  
  verificationResult.checks.push(check);
}
```

**4.3: Constraint Verification**
```javascript
// Primary keys, foreign keys
for (const [table, columns] of Object.entries(expectedState.migrationExpectations.columnsAdded)) {
  const constraints = actualState.constraints[table];
  
  // Primary key check
  const pkCheck = {
    check_type: 'constraint',
    check_name: `${table}_primary_key`,
    severity: 'CRITICAL',
  };
  
  if (!constraints.find(c => c.type === 'PRIMARY KEY')) {
    pkCheck.result = 'FAIL';
    pkCheck.expected = 'Primary key exists';
    pkCheck.actual = 'Primary key missing';
  } else {
    pkCheck.result = 'PASS';
  }
  
  verificationResult.checks.push(pkCheck);
}
```

**4.4: Drift Detection**
```javascript
// Unexpected deletions (FAIL)
const previousTables = await queryPreviousSchema(commit_sha); // From migration history
const deletedTables = previousTables.filter(t => !actualState.tables.includes(t));

if (deletedTables.length > 0) {
  verificationResult.checks.push({
    check_type: 'drift_detection',
    check_name: 'unexpected_table_deletion',
    severity: 'CRITICAL',
    result: 'FAIL',
    expected: 'No table deletions',
    actual: `Tables deleted: ${deletedTables.join(', ')}`,
  });
}

// Unexpected additive changes (WARNING)
const newTables = actualState.tables.filter(t => !previousTables.includes(t) &&
                                                 !expectedState.migrationExpectations.tablesCreated.includes(t));

if (newTables.length > 0 && !isSecurityCritical(newTables)) {
  verificationResult.checks.push({
    check_type: 'drift_detection',
    check_name: 'unexpected_table_addition',
    severity: 'WARNING',
    result: 'WARNING',
    expected: 'No unexpected tables',
    actual: `Tables added: ${newTables.join(', ')}`,
  });
}
```

**Success Criteria:**
- ✅ All CRITICAL checks executed
- ✅ Results recorded for each check

---

#### Step 5: Aggregate Verification Result

**Purpose:** Determine overall result (PASS / WARNING / FAIL / ERROR)

**Implementation:**
```javascript
const criticalFailed = verificationResult.checks.filter(
  c => c.severity === 'CRITICAL' && c.result === 'FAIL'
).length;

const errors = verificationResult.checks.filter(
  c => c.result === 'ERROR'
).length;

const warnings = verificationResult.checks.filter(
  c => c.result === 'WARNING'
).length;

const passed = verificationResult.checks.filter(
  c => c.result === 'PASS'
).length;

if (errors > 0 || criticalFailed > 0) {
  verificationResult.overall_result = 'FAIL';
} else if (warnings > 0) {
  verificationResult.overall_result = 'WARNING';
} else {
  verificationResult.overall_result = 'PASS';
}

verificationResult.checks_passed = passed;
verificationResult.checks_failed = criticalFailed;
verificationResult.checks_warning = warnings;
verificationResult.checks_error = errors;
```

**Result Semantics:**

| Overall Result | Meaning | Deployment Action |
|----------------|---------|-------------------|
| **PASS** | All critical checks passed | ✅ ELIGIBLE |
| **WARNING** | Non-critical issues detected | ✅ ELIGIBLE (with warnings) |
| **FAIL** | Critical checks failed | ❌ BLOCKED |
| **ERROR** | Verification engine failure | ❌ BLOCKED (fail-closed) |

**Success Criteria:**
- ✅ Overall result determined
- ✅ Statistics calculated

---

#### Step 6: Record Verification Evidence

**Purpose:** Generate portable evidence artifact and authoritative DB record

**Evidence Artifact (JSON):**
```json
{
  "verification_id": "<UUID>",
  "migration_id": "20260825120000_add_patients",
  "commit_sha": "ac2bcef2f2db761af005b5efa19d91125f5ff6fa",
  "environment": "production",
  "timestamp": "2026-08-25T10:30:00Z",
  "verification_engine_version": "1.0.0",
  "database_identity_hash": "<SHA-256 of connection string>",
  
  "overall_result": "PASS",
  "checks_passed": 12,
  "checks_failed": 0,
  "checks_warning": 1,
  "checks_error": 0,
  
  "checks": [
    {
      "check_type": "rls_policy",
      "check_name": "hc_patients_rls_enabled",
      "severity": "CRITICAL",
      "result": "PASS",
      "expected": "RLS enabled with required policies",
      "actual": "RLS enabled with required policies"
    },
    {
      "check_type": "drift_detection",
      "check_name": "unexpected_table_addition",
      "severity": "WARNING",
      "result": "WARNING",
      "expected": "No unexpected tables",
      "actual": "Tables added: temp_analytics"
    }
  ]
}
```

**Database Record:**
```sql
INSERT INTO migration_governance.verification_results (
  id, approval_id, migration_id, commit_sha, environment,
  verification_timestamp, overall_result,
  checks_passed, checks_failed, checks_warning, checks_error,
  evidence_artifact_path, verification_engine_version
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
);
```

**Success Criteria:**
- ✅ Evidence artifact written (JSON file)
- ✅ Database record inserted
- ✅ Evidence uploaded to GitHub Actions artifacts

---

#### Step 7: Report Verification Result

**Purpose:** Output result to workflow for deployment decision

**Implementation:**
```javascript
// Log to workflow
console.log(`::notice::✅ Verification ${verificationResult.overall_result}`);
console.log(`::notice::  Checks passed: ${verificationResult.checks_passed}`);
console.log(`::notice::  Checks failed: ${verificationResult.checks_failed}`);
console.log(`::notice::  Checks warning: ${verificationResult.checks_warning}`);

// Set GitHub Actions output
console.log(`verification_result=${verificationResult.overall_result}`);

// Exit with appropriate code
if (verificationResult.overall_result === 'FAIL' || verificationResult.overall_result === 'ERROR') {
  process.exit(1); // Fail job → block deployment
} else {
  process.exit(0); // Pass job → deployment eligible
}
```

**Success Criteria:**
- ✅ Result logged
- ✅ Exit code set correctly
- ✅ Workflow receives result

---

### Workflow Integration

**Current (4B.2):**
```yaml
migrate-database:
  steps:
    - Step 6: Execute BDGF wrapper
    - Step 7: Record execution evidence
```

**Updated (4B.2 + 4B.3):**
```yaml
migrate-database:
  steps:
    - Step 6: Execute BDGF wrapper
    - Step 7: Record execution evidence
    - Step 8: Verify database state (NEW)
    - Step 9: Record verification evidence (NEW)
```

**Job Dependency (unchanged):**
```yaml
promote:
  needs: [detect-changes, preview, smoke, migrate-database]
  if: |
    always() &&
    needs.detect-changes.outputs.docs_only != 'true' &&
    (needs.detect-changes.outputs.needs_migration != 'true' ||
     needs.migrate-database.result == 'success')
```

**`migrate-database` result = SUCCESS** only if:
1. ✅ BDGF execution SUCCESS (Step 6)
2. ✅ Database verification PASS or WARNING (Step 8)

**`migrate-database` result = FAILURE** if:
1. ❌ BDGF execution FAIL, OR
2. ❌ Database verification FAIL or ERROR

---

## 🔒 ARCHITECTURAL CONSTRAINTS

### Non-Negotiable

1. ✅ **NO BDGF modifications** (frozen boundary)
2. ✅ **NO Kernel modifications** (Healthcare H1-H12, Logistics E7.1-E7.3, Finance frozen)
3. ✅ **Read-only verification** (no database repair)
4. ✅ **Fail-closed by default** (unknown → FAIL)
5. ✅ **Database-agnostic design** (PostgreSQL, not Supabase-specific)
6. ✅ **Security-first** (tenant isolation mandatory)
7. ✅ **Platform-friendly** (additive changes = WARNING)
8. ✅ **Automation boundary** (machine verification, not human confirmation)

### Automation Boundary Principle

> **If a state can be deterministically verified by machine, 4B.3 MUST automatically verify; MUST NOT require human confirmation to replace machine verification.**

**Automated (4B.3 responsibility):**
- ✅ RLS enabled/disabled (deterministic query)
- ✅ Table exists/missing (deterministic query)
- ✅ Column type correct/incorrect (deterministic query)
- ✅ Constraint exists/missing (deterministic query)

**Human intervention (exception handling only):**
- ⚠️ Verification FAIL → Human investigates root cause
- ⚠️ Unexpected architectural gap → Human ADR decision
- ⚠️ Emergency rollback → Human DBA action

**NOT human replacement:**
- ❌ "Please confirm RLS is enabled" → NO (machine verifies)
- ❌ "Please review schema changes" → NO (machine compares)
- ❌ "Approve verification result" → NO (machine decides PASS/FAIL)

---

## ✅ SUCCESS CRITERIA

### Verification PASS

**All conditions met:**
1. ✅ All CRITICAL checks passed
2. ✅ Security invariants validated (RLS, tenant isolation)
3. ✅ No unexpected deletions/modifications
4. ✅ Evidence artifact generated
5. ✅ Database record created

**Deployment:** ✅ ELIGIBLE

### Verification WARNING

**Conditions:**
1. ✅ All CRITICAL checks passed
2. ⚠️ Non-critical issues detected (e.g., additive schema, missing index)
3. ✅ Evidence artifact generated
4. ✅ Warnings documented

**Deployment:** ✅ ELIGIBLE (with warnings recorded)

### Verification FAIL

**One or more:**
1. ❌ CRITICAL check failed (RLS disabled, expected table missing, etc.)
2. ❌ Security invariant violated
3. ❌ Unexpected deletion/modification detected

**Deployment:** ❌ BLOCKED

### Verification ERROR

**One or more:**
1. ❌ Cannot connect to database
2. ❌ Query timeout or failure
3. ❌ Verification engine crash
4. ❌ Unknown database state

**Deployment:** ❌ BLOCKED (fail-closed)

---

## 🚫 FAILURE MODES

### F1: RLS Policy Missing (Security-Critical)

**Scenario:** Migration created `hc_appointments` table but forgot RLS.

**Detection:**
```javascript
const rlsState = await adapter.queryRLS('hc_appointments');
if (!rlsState.enabled) {
  return { result: 'FAIL', severity: 'CRITICAL' };
}
```

**Result:** FAIL → Deployment BLOCKED

**Resolution:** Fix migration, re-apply with RLS, re-verify.

---

### F2: Unexpected Table Deletion

**Scenario:** Migration accidentally dropped `hc_patients` table.

**Detection:**
```javascript
const previousTables = ['hc_patients', 'hc_doctors'];
const currentTables = ['hc_doctors'];
const deleted = previousTables.filter(t => !currentTables.includes(t));
// deleted = ['hc_patients']
```

**Result:** FAIL → Deployment BLOCKED

**Resolution:** Emergency rollback, restore table, investigation.

---

### F3: Type Change Breaking Referential Integrity

**Scenario:** `patient_id` changed from `UUID` to `TEXT`.

**Detection:**
```javascript
const expectedType = 'uuid';
const actualType = actualState.columns['hc_patients'].find(c => c.name === 'patient_id').type;
if (actualType !== expectedType) {
  return { result: 'FAIL', severity: 'CRITICAL' };
}
```

**Result:** FAIL → Deployment BLOCKED

**Resolution:** Fix migration, revert type change.

---

### F4: Database Unreachable

**Scenario:** Network issue, connection timeout.

**Detection:**
```javascript
try {
  await adapter.connect();
} catch (error) {
  return { overall_result: 'ERROR' };
}
```

**Result:** ERROR → FAIL (fail-closed) → Deployment BLOCKED

**Resolution:** Retry workflow, investigate network/database.

---

### F5: Additive Schema Expansion (Platform Development)

**Scenario:** Healthcare module added `hc_imaging`, Finance module added `finance_invoice` simultaneously.

**Detection:**
```javascript
const unexpectedTables = ['hc_imaging', 'finance_invoice'];
// Both not in migration expectations
```

**Result:** WARNING (not FAIL)

**Deployment:** ✅ ELIGIBLE (Platform of Platforms expansion allowed)

---

## 📊 EVIDENCE ARTIFACT SPECIFICATION

### Artifact Structure

```json
{
  "verification_id": "<UUID>",
  "migration_id": "<migration_id>",
  "commit_sha": "<canonical commit SHA from 4B.2>",
  "approval_id": "<approval_id from BDGF>",
  "environment": "production",
  "timestamp": "<ISO 8601>",
  "verification_engine_version": "1.0.0",
  "database_identity_hash": "<SHA-256 of connection string (not plaintext)>",
  
  "overall_result": "PASS | WARNING | FAIL | ERROR",
  "checks_passed": 15,
  "checks_failed": 0,
  "checks_warning": 2,
  "checks_error": 0,
  
  "checks": [
    {
      "check_type": "rls_policy | schema_structure | constraint | drift_detection",
      "check_name": "unique identifier",
      "severity": "CRITICAL | WARNING",
      "result": "PASS | FAIL | WARNING | ERROR",
      "expected": "description of expected state",
      "actual": "description of actual state",
      "details": "optional additional information"
    }
  ],
  
  "execution_metadata": {
    "verification_duration_ms": 1234,
    "adapter_type": "supabase | self-hosted",
    "postgres_version": "15.3"
  }
}
```

### Artifact Storage

**1. GitHub Actions Artifact:**
- **Name:** `verification-evidence-<migration_id>`
- **Format:** JSON
- **Retention:** 90 days
- **Access:** GitHub Actions API

**2. Database Record:**
- **Table:** `migration_governance.verification_results`
- **Retention:** Permanent
- **Access:** SQL query

### Evidence Chain

```
4B.2 Execution Evidence:
  {
    "approval_id": "...",
    "migration_file": "...",
    "commit_sha": "...",
    "result": "SUCCESS"
  }
         ↓
4B.3 Verification Evidence:
  {
    "migration_id": "...",
    "commit_sha": "...",  ← Same as 4B.2
    "overall_result": "PASS",
    "checks_passed": 15
  }
```

**Cross-reference:** `commit_sha` links 4B.2 execution to 4B.3 verification.

---

## 🇻🇳 VN MIGRATION READINESS

### Current (Supabase)

```
4B.3 Verification Engine
         │
         ▼
PostgreSQL Adapter (Interface)
         │
         ▼
Supabase Adapter (Implementation)
         │
         ▼
Supabase PostgreSQL (US/Singapore)
```

### Future (Self-Hosted VN)

```
4B.3 Verification Engine
         │
         ▼
PostgreSQL Adapter (Interface) ← NO CHANGE
         │
         ▼
Self-Hosted Adapter (Implementation) ← NEW
         │
         ▼
PostgreSQL Server (VN Data Center)
```

**Contract unchanged. Only adapter swapped.**

**Migration Checklist:**
1. ✅ Implement `SelfHostedAdapter extends PostgreSQLAdapter`
2. ✅ Update connection string env var
3. ✅ No contract modification
4. ✅ No verification logic modification
5. ✅ Run same test harness

---

## 📝 NEXT STEPS

**After Contract Freeze:**

```
✅ Discovery (d9f52c9c)
✅ Decisions (2c64341f) 🔒 FROZEN
⏳ Contract (CURRENT) → REVIEW → FREEZE 🔒
         ↓
⏳ Test Harness (7 scenarios)
         ↓
⏳ Implementation
         ↓
⏳ Evidence
         ↓
⏳ Certificate
```

**Test Harness Scenarios (Proposed):**
- T1: Valid migration + RLS enabled → PASS
- T2: RLS disabled on security-critical table → FAIL
- T3: Expected table missing → FAIL
- T4: Unexpected table deletion → FAIL
- T5: Additive schema expansion → WARNING
- T6: Database unreachable → ERROR → FAIL
- T7: Type change breaking integrity → FAIL

---

## 🔒 CONTRACT STATUS

**Status:** 🟡 DRAFT — PENDING FREEZE  
**Version:** 1.0.0-draft  
**Review Required:** Yes (Human Architect approval)

**Freeze Criteria:**
1. ✅ Aligned with frozen Decisions (D1-D7)
2. ✅ No architectural gaps identified
3. ✅ OPC automation principles upheld
4. ✅ VN migration path clear
5. ⏳ Human Architect approval

**After Freeze:**
- 🔒 Contract becomes authoritative
- 🔒 Test harness must validate contract
- 🔒 Implementation must follow contract exactly
- 🔒 Modifications require ADR

---

**END OF CONTRACT DRAFT**
