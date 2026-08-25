# T1.5.1: Baseline Provenance Audit

**Date:** 2026-08-25  
**Status:** 🔍 AUDIT IN PROGRESS  
**Purpose:** Verify T1.5 proposed baseline against Contract v1.0.0 with exact provenance  

---

## 🎯 AUDIT OBJECTIVE

**Verify:**
1. ✅ Contract inventory = Baseline inventory (derived from Contract, not T1 failures)
2. ✅ Every object has exact provenance (file, version, DDL)
3. ✅ RLS semantics verified from Contract/Engine (not assumed)
4. ✅ No missing dependencies

**Approval Criteria:**
```
Contract inventory = Baseline inventory
        AND
Every object has provenance
        AND
RLS semantics verified
        AND
No missing dependencies
```

Only then: Approve Option C → Generate provisioning script → Provision isolated DB → T1 rerun

---

## 📚 SOURCE OF TRUTH

### Contract v1.0.0 (commit 37ae4544)

**From `docs/architecture/P0_3_PHASE4B_3_CONTRACT.md`:**

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

**Contract Scope:** **GLOBAL** (checks entire database, not just declared tables)

---

### VerificationEngine Implementation

**From `src/platform/migration-governance/verification/types.ts` (lines 195-217):**

```typescript
export const SECURITY_CRITICAL_TABLES = [
  // Healthcare Kernel
  'hc_patients',
  'hc_encounters',
  'hc_medications',
  'hc_prescriptions',
  'hc_patient_notes',
  'hc_appointments',

  // Education Kernel
  'edu_students',
  'edu_enrollments',
  'edu_grades',

  // Logistics Kernel
  'logistics_shipments',
  'logistics_inventory',
] as const;

export const RLS_REQUIRED_POLICIES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
```

**Note:** `runtime_tenant_registry` NOT in SECURITY_CRITICAL_TABLES constant, only used for connection testing.

---

## 🔍 FINDINGS

### Finding 1: Contract-Derived Table Count

**T1.5 Proposal:** 15 tables  
**Contract Implementation (types.ts):** **12 tables** (SECURITY_CRITICAL_TABLES constant)

**Discrepancy Analysis:**

| Table | T1.5 Proposed | Contract (types.ts) | Classification |
|-------|---------------|---------------------|----------------|
| runtime_tenant_registry | ✅ | ❌ (not in constant) | **Connection test only** |
| hc_patients | ✅ | ✅ | ✅ Contract-derived |
| hc_medications | ✅ | ✅ | ✅ Contract-derived |
| hc_patient_notes | ✅ | ✅ | ✅ Contract-derived |
| hc_encounters | ✅ | ✅ | ✅ Contract-derived |
| hc_prescriptions | ✅ | ✅ | ✅ Contract-derived |
| hc_appointments | ✅ | ✅ | ✅ Contract-derived |
| edu_students | ✅ | ✅ | ✅ Contract-derived |
| edu_grades | ✅ | ✅ | ✅ Contract-derived |
| edu_enrollments | ✅ | ✅ | ✅ Contract-derived |
| logistics_shipments | ✅ | ✅ | ✅ Contract-derived |
| logistics_inventory | ✅ | ✅ | ✅ Contract-derived |

**✅ PASS:** 12/12 Contract-required tables included in T1.5 baseline  
**⚠️ CLARIFICATION NEEDED:** `runtime_tenant_registry` role in verification

---

### Finding 2: RLS Policy Semantics

**T1.5 Proposal:** 60 policies (4 per table × 15 tables)  
**Contract Requirement:** `policies: ['SELECT', 'INSERT', 'UPDATE', 'DELETE']`  
**Existing Migrations Use:** **Single `FOR ALL` policy**

#### Evidence from Existing Migrations

**File:** `supabase/migrations/20260818000001_runtime_tables.sql` (line 39)
```sql
CREATE POLICY tenant_isolation_policy_registry ON runtime_tenant_registry
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
```

**File:** `supabase/migrations/20260812060000_create_education_schema.sql` (line 44)
```sql
CREATE POLICY edu_courses_tenant_isolation ON public.edu_courses
  FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid);
```

**File:** `supabase/migrations/20260806030000_healthcare_kernel_schema.sql` (line 95)
```sql
CREATE POLICY tenant_isolation_hc_encounters ON public.hc_encounters 
  FOR ALL USING (tenant_id = public.get_auth_tenant_id());
```

#### PostgreSQL RLS Semantics

**Single `FOR ALL` policy:**
- Maps to ALL commands (SELECT, INSERT, UPDATE, DELETE) in PostgreSQL
- `polcmd = '*'` in `pg_policy` system catalog
- VerificationEngine queries `pg_policy.polcmd` to get actual commands

**VerificationEngine Check Logic:**
```typescript
const actualPolicyCommands = new Set(actualPolicies.map((p) => p.command));
const missingPolicies = requiredPolicies.filter((cmd) => !actualPolicyCommands.has(cmd));
```

#### T1 Failure Evidence

**From `artifacts/verification/v-54c2bde7-5982-42f1-b658-bd5cdd90d6d6.json`:**

```json
{
  "check_id": "rls-policies-hc_encounters",
  "check_type": "RLS_VERIFICATION",
  "check_name": "hc_encounters.rls_policies",
  "expected": ["SELECT", "INSERT", "UPDATE", "DELETE"],
  "actual": ["r", "*"],
  "result": "FAIL",
  "severity": "CRITICAL",
  "message": "Missing RLS policies on hc_encounters: SELECT, INSERT, UPDATE, DELETE. Tenant isolation incomplete."
}
```

**Analysis:**
- `actual: ["r", "*"]` suggests:
  - `"r"` = SELECT (PostgreSQL single-char command code)
  - `"*"` = ALL (wildcard command)
- VerificationEngine expected explicit ["SELECT", "INSERT", "UPDATE", "DELETE"]
- Engine does NOT expand `"*"` to individual commands

#### PostgreSQL Policy Command Mapping

| polcmd | Meaning | VerificationEngine Interpretation |
|--------|---------|-----------------------------------|
| `'r'` | SELECT | `"r"` (not `"SELECT"`) |
| `'a'` | INSERT | `"a"` (not `"INSERT"`) |
| `'w'` | UPDATE | `"w"` (not `"UPDATE"`) |
| `'d'` | DELETE | `"d"` (not `"DELETE"`) |
| `'*'` | ALL | `"*"` (not expanded) |

**🔴 CRITICAL FINDING:**

VerificationEngine expects command strings ["SELECT", "INSERT", "UPDATE", "DELETE"]  
BUT PostgreSQL stores single-char codes ['r', 'a', 'w', 'd', '*']

**Root Cause:** **Adapter or Engine Bug** — Database adapter returns raw polcmd codes, but Engine expects full command names.

**Impact:**
- Existing migrations with `FOR ALL` policies → FAIL verification (as seen in T1)
- T1.5 proposed "4 separate policies" approach would also FAIL unless adapter maps codes correctly

**❌ FAIL:** RLS semantics verification reveals Engine/Adapter mismatch

---

### Finding 3: Provenance Map

#### Tables with Complete Provenance

| Table | Migration File | Version | DDL Present | RLS Present | Policies Complete |
|-------|----------------|---------|-------------|-------------|-------------------|
| hc_encounters | `20260806030000_healthcare_kernel_schema.sql` | 20260806030000 | ✅ | ✅ | ❌ (FOR ALL only) |
| hc_prescriptions | `20260806030000_healthcare_kernel_schema.sql` | 20260806030000 | ✅ | ✅ | ❌ (FOR ALL only) |
| hc_appointments | `20260807000000_create_hc_appointments.sql` | 20260807000000 | ✅ | ❓ (need to verify) | ❓ |
| edu_enrollments | `20260812060000_create_education_schema.sql` | 20260812060000 | ✅ | ✅ | ❌ (FOR ALL only) |
| edu_courses | `20260812060000_create_education_schema.sql` | 20260812060000 | ✅ | ✅ | ❌ (FOR ALL only) |
| runtime_tenant_registry | `20260818000001_runtime_tables.sql` | 20260818000001 | ✅ | ✅ | ❌ (FOR ALL only) |

#### Tables with NO Provenance (Not in Existing Migrations)

| Table | Status | Evidence |
|-------|--------|----------|
| hc_patients | ❌ NOT FOUND | No migration creates this table |
| hc_medications | ❌ NOT FOUND | No migration creates this table |
| hc_patient_notes | ❌ NOT FOUND | No migration creates this table |
| edu_students | ❌ NOT FOUND | No migration creates this table |
| edu_grades | ❌ NOT FOUND | No migration creates this table |
| logistics_shipments | ❌ NOT FOUND | No migration creates this table |
| logistics_inventory | ❌ NOT FOUND | No migration creates this table |

**❌ FAIL:** 7/12 Contract-required tables have NO existing provenance

---

### Finding 4: T1 Fixture Dependencies

Reading T1 test to understand FK requirements:


**From `test/phase4b3/t1-happy-path.ts` (lines 115-142):**

T1 fixture creates table with FK constraints:
```typescript
// Foreign key to hc_patients
ALTER TABLE ${tableName}
ADD CONSTRAINT ${testPrefix}_patient_fk
FOREIGN KEY (patient_id) REFERENCES hc_patients(patient_id);

// Foreign key to runtime_tenant_registry
ALTER TABLE ${tableName}
ADD CONSTRAINT ${testPrefix}_tenant_fk
FOREIGN KEY (tenant_id) REFERENCES runtime_tenant_registry(tenant_id);
```

**T1 Prerequisite Tables:**
1. ✅ `hc_patients(patient_id)` — FK reference target
2. ✅ `runtime_tenant_registry(tenant_id)` — FK reference target

**T1 Failure Evidence (FAIL #5, #6):**
- FAIL #5: `foreign-key-test_t1_xxx_appointments-patient_id` → Missing hc_patients
- FAIL #6: `foreign-key-test_t1_xxx_appointments-tenant_id` → Missing runtime_tenant_registry

**✅ PASS:** T1.5 baseline includes both prerequisite tables

---

## 📊 AUDIT SUMMARY

### 1. Contract Inventory vs Baseline Inventory

| Dimension | Contract (types.ts) | T1.5 Proposed | Match |
|-----------|---------------------|---------------|-------|
| Table Count | 12 | 15 (12 + 3 extra) | ⚠️ |
| Core Tables | 12 security-critical | 12 + runtime_tenant_registry | ⚠️ |
| RLS Policies | `['SELECT', 'INSERT', 'UPDATE', 'DELETE']` | 4 per table | ❌ |

**Status:** ⚠️ **PARTIAL MATCH**
- 12/12 Contract tables included ✅
- `runtime_tenant_registry` not in SECURITY_CRITICAL_TABLES but required for T1 FK ⚠️
- Additional edu_* tables proposed but not in Contract constant ⚠️

---

### 2. Provenance Verification

| Category | Count | Status |
|----------|-------|--------|
| Tables with existing migration | 5/12 | ❌ 41% |
| Tables with no provenance | 7/12 | ❌ 59% |
| Tables with complete RLS | 0/12 | ❌ 0% |

**Missing Provenance Tables:**
1. hc_patients ❌
2. hc_medications ❌
3. hc_patient_notes ❌
4. edu_students ❌
5. edu_grades ❌
6. logistics_shipments ❌
7. logistics_inventory ❌

**Status:** ❌ **FAIL** — 59% of baseline has no existing source

---

### 3. RLS Semantics Verification

**Critical Bug Identified:**

```
VerificationEngine expects: ["SELECT", "INSERT", "UPDATE", "DELETE"]
PostgreSQL stores:          ['r', 'a', 'w', 'd'] or ['*']
Adapter returns:            Raw polcmd codes unchanged
Engine checks:              Exact string match
Result:                     FAIL (mismatch)
```

**Evidence:**
- T1 failure shows `actual: ["r", "*"]` not `["SELECT", "INSERT", "UPDATE", "DELETE"]`
- All existing migrations use `FOR ALL` → stored as `polcmd='*'`
- Engine does NOT map codes to command names
- Engine does NOT expand `'*'` to individual commands

**Impact on T1.5 Baseline:**
- ❌ Proposed "4 separate policies" will ALSO fail if adapter doesn't map codes
- ❌ Existing migrations with `FOR ALL` cannot satisfy Contract checks
- ❌ Isolated DB baseline will fail RLS checks unless adapter is fixed

**Status:** ❌ **FAIL** — RLS verification has Engine/Adapter bug

---

### 4. Dependency Completeness

**T1 FK Dependencies:**
- ✅ hc_patients(patient_id) — Required, but NO provenance
- ✅ runtime_tenant_registry(tenant_id) — Required, HAS provenance

**Status:** ⚠️ **PARTIAL** — T1 dependencies identified, but hc_patients has no provenance

---

## 🔴 CRITICAL FINDINGS

### Finding A: Adapter/Engine RLS Bug

**Symptom:** VerificationEngine expects full command names but PostgreSQL stores single-char codes.

**Root Cause:** `DirectPostgreSQLAdapter.queryRLSPolicies()` returns raw `polcmd` without mapping:

```typescript
// Current (BUGGY):
return result.rows.map((row) => ({
  name: row.name,
  command: row.command,  // Returns 'r', 'a', 'w', 'd', '*'
  ...
}));

// Should be (FIXED):
const POLCMD_MAP = { 'r': 'SELECT', 'a': 'INSERT', 'w': 'UPDATE', 'd': 'DELETE', '*': 'ALL' };
return result.rows.map((row) => ({
  name: row.name,
  command: POLCMD_MAP[row.command] || row.command,
  ...
}));
```

**Impact:**
- ❌ ALL RLS policy checks will FAIL (even with correct policies)
- ❌ T1.5 baseline cannot achieve PASS without fixing adapter
- ❌ Existing `FOR ALL` policies fail because engine doesn't expand `'*'` → `['SELECT', 'INSERT', 'UPDATE', 'DELETE']`

**Remediation Required:**
1. Fix `DirectPostgreSQLAdapter.queryRLSPolicies()` to map polcmd codes
2. Fix VerificationEngine to expand `'ALL'` to all 4 commands
3. OR: Change Contract/Engine to accept `'ALL'` as valid coverage

---

### Finding B: 59% Missing Provenance

**Problem:** 7/12 Contract-required tables have no existing migrations:
- hc_patients
- hc_medications
- hc_patient_notes
- edu_students
- edu_grades
- logistics_shipments
- logistics_inventory

**Implications:**
- Cannot "reuse existing migrations" (Option B rejected)
- Must create new schema from scratch
- NOT violating "no fake schema" if these are legitimate Kernel tables that don't exist yet
- BUT: Need to verify if these tables SHOULD exist or if SECURITY_CRITICAL_TABLES constant is wrong

**Question for Architect:**
> Are these 7 tables legitimate Healthcare/Education/Logistics Kernel requirements that haven't been implemented yet, OR is the SECURITY_CRITICAL_TABLES constant incorrectly hardcoded?

---

### Finding C: runtime_tenant_registry Ambiguity

**Issue:** `runtime_tenant_registry` is:
- ✅ Required for T1 FK constraint
- ✅ Has provenance (`20260818000001_runtime_tables.sql`)
- ❌ NOT in SECURITY_CRITICAL_TABLES constant
- ✅ Used for connection testing only in adapter

**BUT:** T1 failure shows it was NOT checked by verification engine (only the 12 SECURITY_CRITICAL_TABLES were checked).

**Impact:**
- T1.5 baseline includes it (correct for FK dependencies)
- Engine will NOT verify its RLS policies (not in constant)
- No Contract violation, but inconsistent with "all tables with tenant_id" requirement from Contract doc

---

## ❌ AUDIT RESULT: CONDITIONAL FAIL

### Approval Criteria Evaluation

| Criterion | Status | Details |
|-----------|--------|---------|
| Contract inventory = Baseline inventory | ⚠️ PARTIAL | 12/12 core tables match, but 3 extra tables unexplained |
| Every object has provenance | ❌ FAIL | 7/12 tables (59%) have no existing source |
| RLS semantics verified | ❌ FAIL | Adapter/Engine bug prevents correct RLS verification |
| No missing dependencies | ✅ PASS | T1 FK dependencies identified |

**Overall:** ❌ **FAIL**

---

## 🚧 BLOCKING ISSUES

### Issue 1: RLS Verification Bug (P0 - BLOCKER)

**Cannot proceed with isolated DB provisioning until:**
1. DirectPostgreSQLAdapter.queryRLSPolicies() fixed to map polcmd codes
2. OR: VerificationEngine.verifyRLS() fixed to accept raw codes
3. OR: Contract/Engine updated to accept `'ALL'` as equivalent to 4 separate policies

**Without fix:** T1 will FAIL on isolated DB for same reason (polcmd mismatch)

---

### Issue 2: Missing Provenance (P1 - REQUIRES DECISION)

**7 tables have no existing migrations. Architect must decide:**

**Option 2A:** These are legitimate Kernel tables not yet implemented
- ✅ Create new DDL from scratch (not "fake schema")
- ✅ Document as "Phase 4B.3 Kernel baseline"
- ✅ Provision isolated DB with new schema

**Option 2B:** SECURITY_CRITICAL_TABLES constant is wrong
- ❌ Remove non-existent tables from constant
- ❌ Update Contract v1.0.0 (but frozen)
- ❌ Redefine verification scope

**Option 2C:** Wait for Kernel implementation
- ❌ Blocks T1-T7 indefinitely
- ❌ No deterministic timeline

**Recommendation:** Option 2A (create Kernel baseline schema)

---

### Issue 3: `FOR ALL` vs 4 Separate Policies (P2 - SEMANTIC CHOICE)

**Existing migrations use `FOR ALL`, but verification expects 4 separate policies.**

**Option 3A:** Accept `FOR ALL` as equivalent (fix Engine to expand `'*'`)
- ✅ Aligns with existing migration patterns
- ✅ Simpler policy management
- ⚠️ Requires Engine change

**Option 3B:** Require 4 separate policies (update existing migrations)
- ❌ Breaks existing migrations
- ❌ More verbose policy definitions
- ✅ Explicit command coverage

**Recommendation:** Option 3A (accept FOR ALL, fix Engine to expand)

---

## 🎯 REQUIRED ACTIONS BEFORE T1.5 APPROVAL

### Action 1: Fix RLS Adapter/Engine Bug (MANDATORY)

**File:** `src/platform/migration-governance/verification/database-adapter.ts`

**Change:**
```typescript
async queryRLSPolicies(
  tableName: string
): Promise<Array<{ name: string; command: string; using?: string; check?: string }>> {
  this.ensureConnected();

  const result = await this.pool!.query(
    `SELECT
      polname AS name,
      polcmd AS command,
      pg_get_expr(polqual, polrelid) AS using,
      pg_get_expr(polwithcheck, polrelid) AS check
     FROM pg_policy
     WHERE polrelid = $1::regclass`,
    [`public.${tableName}`]
  );

  // Map PostgreSQL polcmd codes to full command names
  const POLCMD_MAP: Record<string, string> = {
    'r': 'SELECT',
    'a': 'INSERT',
    'w': 'UPDATE',
    'd': 'DELETE',
    '*': 'ALL',
  };

  return result.rows.map((row) => ({
    name: row.name,
    command: POLCMD_MAP[row.command] || row.command,
    using: row.using || undefined,
    check: row.check || undefined,
  }));
}
```

**AND/OR:**

**File:** `src/platform/migration-governance/verification/checks/rls-verification.ts`

**Change:**
```typescript
// Expand 'ALL' to all 4 commands
const actualPolicyCommands = new Set(
  actualPolicies.flatMap((p) => 
    p.command === 'ALL' 
      ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] 
      : [p.command]
  )
);
```

---

### Action 2: Architect Decision on Missing Tables (REQUIRED)

**Question:** Are these 7 tables legitimate Kernel requirements?
- hc_patients, hc_medications, hc_patient_notes
- edu_students, edu_grades
- logistics_shipments, logistics_inventory

**If YES:**
- Approve creating DDL from Kernel specifications
- Document as "Phase 4B.3 Verification Baseline" (not production schema)
- Provision isolated DB with Kernel-compliant schema

**If NO:**
- Update SECURITY_CRITICAL_TABLES constant to remove non-existent tables
- Redefine verification scope
- Re-run T1.5 analysis

---

### Action 3: Architect Decision on RLS Policy Format (REQUIRED)

**Question:** Accept `FOR ALL` as equivalent to 4 separate policies?

**If YES:**
- Fix Engine to expand `'ALL'` → `['SELECT', 'INSERT', 'UPDATE', 'DELETE']`
- Baseline can use `FOR ALL` (aligns with existing migrations)

**If NO:**
- Baseline must use 4 separate policies
- Existing migrations remain non-compliant (acceptable for isolated DB)

---

## 📋 REVISED T1.5 RECOMMENDATION

### DO NOT PROCEED WITH DB PROVISIONING YET

**Reasons:**
1. ❌ RLS verification bug will cause T1 FAIL even with correct baseline
2. ⚠️ 7/12 tables have no provenance (need architect decision)
3. ⚠️ RLS policy format ambiguous (FOR ALL vs 4 separate)

### NEXT STEPS

1. **Fix RLS bug** (Action 1 — code change required)
2. **Architect decision** on missing tables (Action 2)
3. **Architect decision** on RLS format (Action 3)
4. **Re-run T1.5.1 audit** after fixes
5. **Only then:** Approve baseline + provision DB

---

## 🚦 CHECKPOINT STATUS

```
Gate C                    🟢 COMPLETE
T0                        🟢 COMPLETE
T1 Implementation         🟢 COMPLETE
T1 Execution              🟢 EXECUTED
T1 Forensics              🟢 COMPLETE
17-failure classification 🟢 COMPLETE
Architect Decision        🟢 PATH A APPROVED

T1.5 Baseline Spec        🟡 CONDITIONAL APPROVAL
T1.5.1 Provenance Audit   ✅ COMPLETE ← YOU ARE HERE
                          ↓
                    🔴 BLOCKER IDENTIFIED
                          ↓
                    RLS Bug Fix Required
                          ↓
                    Architect Decisions Required
                          ↓
Isolated DB Provision     🔒 BLOCKED
T1 Re-run                 🔒 BLOCKED
T2-T7                     🔒 BLOCKED
```

---

**Status:** 🔴 **AUDIT COMPLETE — BLOCKERS IDENTIFIED**  
**Deliverable:** `docs/architecture/T1_5_1_BASELINE_PROVENANCE_AUDIT.md`  
**Required:** Architect decisions + RLS bug fix before DB provisioning

**STOP.** Awaiting architect resolution of 3 blocking issues.
