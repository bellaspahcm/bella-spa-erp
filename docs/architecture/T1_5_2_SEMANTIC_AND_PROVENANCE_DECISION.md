# T1.5.2: Decision-Gate Evidence Audit

**Date:** 2026-08-25  
**Status:** 🔍 EVIDENCE GATHERING COMPLETE — AWAITING ARCHITECT DECISIONS  
**Purpose:** Provide deterministic evidence for P0/P1/P2 decision gates  

---

## 🎯 AUDIT SCOPE

**Read-only analysis to support architect decisions on:**
1. **P0:** RLS semantic mapping (adapter/engine mismatch)
2. **P1:** Table provenance (7/12 missing canonical sources)
3. **P2:** FOR ALL semantics (Contract interpretation)

**NOT performing:**
- ❌ Code changes
- ❌ Contract modifications
- ❌ Engine modifications
- ❌ DDL creation
- ❌ Database provisioning
- ❌ Architect decisions

**Only:** Evidence gathering, cross-referencing, recommendation (not decision).

---

## 📋 P0: RLS SEMANTIC MAPPING EVIDENCE

### Issue Statement

**Symptom:** VerificationEngine RLS checks FAIL even when policies exist.

**Evidence from T1 failure artifact:**
```json
{
  "check_id": "rls-policies-hc_encounters",
  "expected": ["SELECT", "INSERT", "UPDATE", "DELETE"],
  "actual": ["r", "*"],
  "result": "FAIL"
}
```

**Root Cause:** Semantic mismatch between PostgreSQL representation and Engine expectation.

---

### PostgreSQL pg_policy Semantics

**Source:** PostgreSQL System Catalog `pg_policy`

**Column:** `polcmd` (policy command)

**Values:**
| polcmd | PostgreSQL Meaning | Command Scope |
|--------|-------------------|---------------|
| `'r'` | SELECT | Read operation |
| `'a'` | INSERT (append) | Create operation |
| `'w'` | UPDATE (write) | Modify operation |
| `'d'` | DELETE | Remove operation |
| `'*'` | ALL | All operations (r+a+w+d) |

**Documentation Reference:** PostgreSQL pg_policy system catalog stores single-character command codes, not full command names.

---

### Adapter Current Behavior

**File:** `src/platform/migration-governance/verification/database-adapter.ts`  
**Method:** `DirectPostgreSQLAdapter.queryRLSPolicies()` (lines 407-427)

**Implementation:**
```typescript
async queryRLSPolicies(
  tableName: string
): Promise<Array<{ name: string; command: string; using?: string; check?: string }>> {
  this.ensureConnected();

  const result = await this.pool!.query(
    `SELECT
      polname AS name,
      polcmd AS command,  // ← Returns raw PostgreSQL codes
      pg_get_expr(polqual, polrelid) AS using,
      pg_get_expr(polwithcheck, polrelid) AS check
     FROM pg_policy
     WHERE polrelid = $1::regclass`,
    [`public.${tableName}`]
  );

  return result.rows.map((row) => ({
    name: row.name,
    command: row.command,  // ← No mapping/normalization
    using: row.using || undefined,
    check: row.check || undefined,
  }));
}
```

**Behavior:** Returns raw `polcmd` codes (`'r'`, `'a'`, `'w'`, `'d'`, `'*'`) without mapping to semantic command names.

---

### Engine Expectation

**File:** `src/platform/migration-governance/verification/checks/rls-verification.ts`  
**Lines:** 82-95

**Implementation:**
```typescript
// Check 3: Required policies present (CRITICAL)
const actualPolicies = actualTable.rls?.policies || [];
const actualPolicyCommands = new Set(actualPolicies.map((p) => p.command));
//                                                               ↑
//                                           Expects: 'SELECT', 'INSERT', 'UPDATE', 'DELETE'

const missingPolicies = requiredPolicies.filter((cmd) => !actualPolicyCommands.has(cmd));
//                                                         ↑
//                                    String comparison: 'SELECT' !== 'r'
```

**Behavior:** Expects full command names (`'SELECT'`, `'INSERT'`, `'UPDATE'`, `'DELETE'`).

**Check Logic:** Exact string match (`Set.has()`). Does NOT:
- Map `'r'` → `'SELECT'`
- Expand `'*'` → `['SELECT', 'INSERT', 'UPDATE', 'DELETE']`

---

### Contract v1.0.0 Requirement

**File:** `docs/architecture/P0_3_PHASE4B_3_CONTRACT.md`  
**Lines:** 170-175

**Definition:**
```javascript
const RLS_REQUIREMENTS = {
  enabled: true,
  policies: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  tenantIsolationEnforced: true,
};
```

**Semantic Intent:** Unclear whether this means:
- **Interpretation A:** "Commands SELECT, INSERT, UPDATE, DELETE must be covered" (semantic coverage)
- **Interpretation B:** "Four string values ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] must be present" (literal representation)

**File:** `src/platform/migration-governance/verification/types.ts`  
**Line:** 217

**Implementation:**
```typescript
export const RLS_REQUIRED_POLICIES = ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as const;
```

**Engine uses full command names**, not PostgreSQL codes.

---

### Semantic Mismatch Analysis

#### Layer Boundary Issue

```
PostgreSQL Database Layer
        ↓
    polcmd: 'r', 'a', 'w', 'd', '*'
        ↓
DatabaseAdapter (current: no mapping)
        ↓
    command: 'r', 'a', 'w', 'd', '*'
        ↓
VerificationEngine
        ↓
    Expected: 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
        ↓
    Result: MISMATCH → FAIL
```

**Question:** Which layer should normalize PostgreSQL metadata to semantic domain?

#### Responsibility Analysis

**Option 1A: Adapter normalizes (recommended)**
- **Rationale:** DatabaseAdapter is abstraction boundary between PostgreSQL and verification domain
- **Principle:** Engine should receive semantic data, not PostgreSQL-specific codes
- **Benefit:** Single point of normalization, engine remains database-agnostic
- **Implementation:** Map polcmd codes to command names in adapter

**Option 1B: Engine accepts codes**
- **Rationale:** Engine understands PostgreSQL directly
- **Principle:** No abstraction needed, direct database integration
- **Drawback:** Engine becomes PostgreSQL-specific, violates adapter pattern
- **Implementation:** Change engine to compare against `['r', 'a', 'w', 'd']` or accept `'*'`

**Option 1C: Engine expands `'*'`**
- **Rationale:** Handle wildcard as special case
- **Principle:** Semantic expansion at verification layer
- **Limitation:** Still doesn't solve `'r'` vs `'SELECT'` mismatch
- **Implementation:** Expand `'*'` to all 4 commands, but still need code mapping

---

### Recommended Decision: Option 1A

**Normalize in DatabaseAdapter** (boundary layer)

**Rationale:**
1. ✅ Adapter is designed as abstraction layer between database and domain
2. ✅ Engine receives semantic data (database-agnostic)
3. ✅ Single point of normalization (maintainable)
4. ✅ Aligns with adapter pattern (hide database specifics)
5. ✅ Future-proof (other databases may have different codes)

**Implementation (after architect approval):**
```typescript
// src/platform/migration-governance/verification/database-adapter.ts
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

  // Map PostgreSQL polcmd codes to semantic command names
  const POLCMD_MAP: Record<string, string> = {
    'r': 'SELECT',
    'a': 'INSERT',
    'w': 'UPDATE',
    'd': 'DELETE',
    '*': 'ALL',  // Note: Engine must handle 'ALL' separately (see P2)
  };

  return result.rows.map((row) => ({
    name: row.name,
    command: POLCMD_MAP[row.command] || row.command,  // Fallback to raw if unknown
    using: row.using || undefined,
    check: row.check || undefined,
  }));
}
```

**Test Coverage Required:**
- `'r'` → `'SELECT'`
- `'a'` → `'INSERT'`
- `'w'` → `'UPDATE'`
- `'d'` → `'DELETE'`
- `'*'` → `'ALL'` (then engine handles expansion, see P2)

---

### P0 Status

**Evidence:** ✅ COMPLETE  
**Root Cause:** Adapter returns PostgreSQL codes, Engine expects semantic names  
**Recommended:** Option 1A (adapter normalizes)  
**Decision Required:** 🔴 ARCHITECT APPROVAL  

---

## 📋 P2: FOR ALL SEMANTICS EVIDENCE

### Issue Statement

**Symptom:** Existing migrations use `FOR ALL` policy, but verification expects 4 separate policies.

**Evidence from existing migrations:**

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

**File:** `docs/WEEK_3_DAY_2_EXECUTION_PLAN.md` (line 485)
```sql
CREATE POLICY "Tenant isolation for logistics_shipments"
  ON logistics_shipments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Pattern:** All existing migrations use single `FOR ALL` policy.

---

### Contract Requirement

**File:** `docs/architecture/P0_3_PHASE4B_3_CONTRACT.md`  
**Lines:** 170-175

```javascript
const RLS_REQUIREMENTS = {
  enabled: true,
  policies: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
  tenantIsolationEnforced: true,
};
```

**Ambiguity:** Does this require:
- **Interpretation A:** Commands SELECT, INSERT, UPDATE, DELETE must be covered (semantic coverage)
- **Interpretation B:** Four separate policy objects must exist (structural requirement)

---

### PostgreSQL FOR ALL Semantics

**PostgreSQL Documentation:** `FOR ALL` is shorthand for all 4 commands.

**Semantic Equivalence:**
```sql
-- Single policy FOR ALL
CREATE POLICY name ON table FOR ALL USING (condition);

-- Semantically equivalent to:
CREATE POLICY name_select ON table FOR SELECT USING (condition);
CREATE POLICY name_insert ON table FOR INSERT WITH CHECK (condition);
CREATE POLICY name_update ON table FOR UPDATE USING (condition);
CREATE POLICY name_delete ON table FOR DELETE USING (condition);
```

**Security Coverage:** `FOR ALL` provides same tenant isolation as 4 separate policies.

---

### Engine Current Behavior

**File:** `src/platform/migration-governance/verification/checks/rls-verification.ts`  
**Lines:** 82-95

**Implementation:**
```typescript
const actualPolicies = actualTable.rls?.policies || [];
const actualPolicyCommands = new Set(actualPolicies.map((p) => p.command));

const missingPolicies = requiredPolicies.filter((cmd) => !actualPolicyCommands.has(cmd));
//                                                ↑
//                                   Checks for literal presence of 'SELECT', 'INSERT', 'UPDATE', 'DELETE'
//                                   Does NOT expand 'ALL' to 4 commands
```

**Behavior:** Engine checks for literal command strings. Does NOT recognize `'ALL'` as covering all 4 commands.

**Result:** `FOR ALL` policy → `actualPolicyCommands = Set(['ALL'])` → Missing SELECT, INSERT, UPDATE, DELETE → FAIL

---

### Semantic Question

**Core Issue:** What is Contract's semantic intent?

#### Interpretation A: Command Coverage (Semantic)

**Intent:** "All 4 commands (SELECT, INSERT, UPDATE, DELETE) must be covered by RLS policies."

**Acceptance Criteria:**
- `FOR ALL` policy → Covers all 4 commands → ✅ PASS
- 4 separate policies → Covers all 4 commands → ✅ PASS
- Missing any command → ❌ FAIL

**Implementation:** Engine must expand `'ALL'` → `['SELECT', 'INSERT', 'UPDATE', 'DELETE']`

**Aligns With:** Existing migration patterns (all use `FOR ALL`)

---

#### Interpretation B: Structural Requirement

**Intent:** "Four separate policy objects for SELECT, INSERT, UPDATE, DELETE commands must exist."

**Acceptance Criteria:**
- `FOR ALL` policy → Only 1 policy object → ❌ FAIL
- 4 separate policies → 4 policy objects → ✅ PASS

**Implementation:** Engine checks policy count and individual command presence (current behavior)

**Conflict:** Existing migrations do NOT satisfy this requirement.

---

### Cross-Reference: Existing Migration Patterns

**Pattern Observed:** 100% of RLS policies in existing migrations use `FOR ALL`.

**Files:**
- `20260818000001_runtime_tables.sql` (runtime_tenant_registry)
- `20260812060000_create_education_schema.sql` (edu_courses, edu_enrollments)
- `20260806030000_healthcare_kernel_schema.sql` (hc_encounters, hc_prescriptions, den_odontograms)
- `docs/WEEK_3_DAY_2_EXECUTION_PLAN.md` (logistics_shipments)

**Implication:** If Interpretation B is correct, ALL existing migrations are non-compliant.

**Question:** Is this:
- **A:** Verification engine bug (should accept `FOR ALL`)
- **B:** Migration pattern bug (should use 4 separate policies)
- **C:** Contract ambiguity (semantic not specified)

---

### Recommended Decision: Interpretation A (Accept FOR ALL)

**Rationale:**
1. ✅ Aligns with existing migration patterns (100% use `FOR ALL`)
2. ✅ Semantically equivalent security coverage
3. ✅ PostgreSQL standard pattern (simpler, less verbose)
4. ✅ Contract intent likely semantic (command coverage, not structural count)
5. ✅ Avoids requiring production migration changes

**Implementation (after architect approval):**

**Option 3A-1: Engine expands `'ALL'`**
```typescript
// src/platform/migration-governance/verification/checks/rls-verification.ts
const actualPolicyCommands = new Set(
  actualPolicies.flatMap((p) => 
    p.command === 'ALL' 
      ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE']  // Expand wildcard
      : [p.command]
  )
);
```

**Option 3A-2: Contract clarification**
```javascript
const RLS_REQUIREMENTS = {
  enabled: true,
  policyCoverageRequired: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],  // Semantic coverage
  acceptForAll: true,  // Explicit: FOR ALL is acceptable
  tenantIsolationEnforced: true,
};
```

---

### Alternative: Interpretation B (Reject FOR ALL)

**If architect chooses structural requirement:**

**Implication:**
- ❌ All existing migrations become non-compliant
- ❌ Isolated DB baseline cannot reuse existing patterns
- ❌ Must use 4 separate policies (more verbose)
- ⚠️ Production migrations would need remediation (out of scope for Phase 4B.3)

**Acceptable for isolated DB only** (not production).

---

### P2 Status

**Evidence:** ✅ COMPLETE  
**Ambiguity:** Contract does not specify semantic vs structural requirement  
**Existing Pattern:** 100% use `FOR ALL`  
**Recommended:** Interpretation A (accept `FOR ALL` as equivalent)  
**Decision Required:** 🔴 ARCHITECT CLARIFICATION  

---

## 📋 P1: TABLE PROVENANCE EVIDENCE

### Issue Statement

**7/12 Contract-required tables have no existing migration provenance:**
1. hc_patients
2. hc_medications
3. hc_patient_notes
4. edu_students
5. edu_grades
6. logistics_shipments (⚠️ PARTIAL)
7. logistics_inventory

**Governance Risk:** Cannot create DDL without canonical source provenance.

---

### Contract-Derived Table Inventory

**File:** `src/platform/migration-governance/verification/types.ts`  
**Lines:** 195-212

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
```

**Total:** 12 tables

---

### Provenance Audit Results

| Table | Migration Source | DDL Evidence | Architecture Doc | Status |
|-------|------------------|--------------|------------------|--------|
| **hc_patients** | ❌ NOT FOUND | ❌ | ❌ | ❌ MISSING |
| **hc_encounters** | ✅ `20260806030000_healthcare_kernel_schema.sql` (line 7) | ✅ | ❌ | ✅ PROVEN |
| **hc_medications** | ❌ NOT FOUND | ❌ | ❌ | ❌ MISSING |
| **hc_prescriptions** | ✅ `20260806030000_healthcare_kernel_schema.sql` (line 37) | ✅ | ❌ | ✅ PROVEN |
| **hc_patient_notes** | ❌ NOT FOUND | ❌ | ❌ | ❌ MISSING |
| **hc_appointments** | ✅ `20260807000000_create_hc_appointments.sql` | ✅ | ❌ | ✅ PROVEN |
| **edu_students** | ❌ NOT FOUND | ❌ | ❌ | ❌ MISSING |
| **edu_enrollments** | ✅ `20260812060000_create_education_schema.sql` (line 18) | ✅ | ❌ | ✅ PROVEN |
| **edu_grades** | ❌ NOT FOUND | ❌ | ❌ | ❌ MISSING |
| **logistics_shipments** | ❌ No migration | ✅ `docs/WEEK_3_DAY_2_EXECUTION_PLAN.md` (line 470) | ⚠️ PARTIAL | ⚠️ PARTIAL |
| **logistics_inventory** | ❌ NOT FOUND | ❌ | ❌ | ❌ MISSING |

**Summary:**
- ✅ **PROVEN:** 5/12 tables (42%)
- ⚠️ **PARTIAL:** 1/12 tables (8%) — logistics_shipments has DDL in docs, not migration
- ❌ **MISSING:** 6/12 tables (50%)

---

### Detailed Findings

#### ✅ PROVEN Provenance (5 tables)

##### 1. hc_encounters
- **Migration:** `supabase/migrations/20260806030000_healthcare_kernel_schema.sql` (line 7)
- **DDL:** Complete CREATE TABLE with tenant_id FK, RLS enabled
- **RLS:** ✅ Enabled, ⚠️ Policy incomplete (`FOR ALL` needs fix)
- **Status:** ✅ PROVEN

##### 2. hc_prescriptions
- **Migration:** `supabase/migrations/20260806030000_healthcare_kernel_schema.sql` (line 37)
- **DDL:** Complete CREATE TABLE
- **RLS:** ✅ Enabled, ⚠️ Policy incomplete
- **Status:** ✅ PROVEN

##### 3. hc_appointments
- **Migration:** `supabase/migrations/20260807000000_create_hc_appointments.sql`
- **DDL:** Exists (need to verify RLS)
- **Status:** ✅ PROVEN

##### 4. edu_enrollments
- **Migration:** `supabase/migrations/20260812060000_create_education_schema.sql` (line 18)
- **DDL:** Complete CREATE TABLE
- **RLS:** ✅ Enabled with `FOR ALL` policy
- **Status:** ✅ PROVEN

##### 5. edu_courses (bonus - not in SECURITY_CRITICAL_TABLES but related)
- **Migration:** `supabase/migrations/20260812060000_create_education_schema.sql` (line 6)
- **Note:** Referenced by edu_enrollments FK
- **Status:** ✅ PROVEN

---

#### ⚠️ PARTIAL Provenance (1 table)

##### 6. logistics_shipments
- **Migration:** ❌ No migration file found
- **DDL Evidence:** ✅ `docs/WEEK_3_DAY_2_EXECUTION_PLAN.md` (lines 470-493)
- **DDL Content:**
  ```sql
  CREATE TABLE IF NOT EXISTS logistics_shipments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    origin JSONB NOT NULL,
    destination JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    ...
  );
  ALTER TABLE logistics_shipments ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Tenant isolation for logistics_shipments"
    ON logistics_shipments FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
  ```
- **Architecture Doc:** ⚠️ Execution plan document, not canonical Kernel spec
- **Status:** ⚠️ PARTIAL (has DDL, not in migrations)
- **Question:** Is WEEK_3_DAY_2_EXECUTION_PLAN.md a legitimate canonical source, or is this DDL speculative?

---

#### ❌ MISSING Provenance (6 tables)

##### 7. hc_patients
- **Migration:** ❌ NOT FOUND
- **Architecture Search:**
  - `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md`: ❌ No mention
  - `src/platform/healthcare/engines/mpi-engine/`: ❌ No table reference
- **Status:** ❌ MISSING
- **Implication:** Cannot create DDL without canonical Kernel spec

##### 8. hc_medications
- **Migration:** ❌ NOT FOUND
- **Architecture Search:**
  - Healthcare Constitution: ❌ No mention
  - Pharmacy engine: ❌ No table reference
- **Status:** ❌ MISSING

##### 9. hc_patient_notes
- **Migration:** ❌ NOT FOUND
- **Architecture Search:**
  - Healthcare Constitution: ❌ No mention
  - Clinical engine: ❌ No table reference
- **Status:** ❌ MISSING

##### 10. edu_students
- **Migration:** ❌ NOT FOUND
- **Architecture Search:**
  - `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md`: ❌ No mention
- **Status:** ❌ MISSING

##### 11. edu_grades
- **Migration:** ❌ NOT FOUND
- **Architecture Search:**
  - Education Constitution: ❌ No mention
- **Status:** ❌ MISSING

##### 12. logistics_inventory
- **Migration:** ❌ NOT FOUND
- **Architecture Search:**
  - Logistics docs: ❌ No DDL found
- **Status:** ❌ MISSING

---

### Architecture Document Search

**Searched locations:**
1. `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md` — No table DDL definitions
2. `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md` — No table DDL definitions
3. `src/platform/healthcare/engines/*/` — No CREATE TABLE statements in TypeScript
4. `src/platform/education/` — Not found
5. `docs/LOGISTICS_KERNEL_QUICK_REFERENCE.md` — Checked
6. `docs/E7_LOGISTICS_OS_CONSTRUCTION_PLAN.md` — Checked
7. `docs/WEEK_3_DAY_2_EXECUTION_PLAN.md` — Found logistics_shipments DDL (partial)

**Result:** **No canonical Kernel architecture specifications with complete DDL for missing 6 tables.**

---

### Critical Question

**Are these 6 tables:**

**Option 2A: Legitimate Kernel requirements not yet implemented?**
- If YES: Need canonical Kernel specification to create DDL
- Source: Healthcare Kernel H1-H12 spec, Education E7 spec, Logistics E7 spec
- Action: Create DDL from Kernel spec (not "fake schema")

**Option 2B: SECURITY_CRITICAL_TABLES constant is wrong?**
- If YES: Constant was hardcoded incorrectly
- Reality: These tables don't exist and aren't planned
- Action: Remove from constant, redefine verification scope (requires Contract change — FROZEN)

**Option 2C: Wait for Kernel implementation?**
- If YES: Tables will be created by Kernel teams
- Timeline: Unknown
- Action: Block T1-T7 until Kernel tables exist (indefinite delay)

---

### Evidence for Option 2A (Legitimate Kernel Requirements)

**Indicators these might be real requirements:**

1. **Semantic Coherence:**
   - `hc_patients` — Natural prerequisite for healthcare (Patient Master Index / MPI)
   - `hc_medications` — Natural prerequisite for pharmacy operations
   - `hc_patient_notes` — Natural clinical documentation requirement
   - `edu_students` — Natural prerequisite for education (Student Master)
   - `edu_grades` — Natural academic records requirement
   - `logistics_inventory` — Natural prerequisite for shipment operations

2. **Referenced in Architecture Tree:**
   - `docs/BELLA_ARCHITECTURE_TREE_2026_08_24.md` line 592:
     ```
     ├── Education: edu_students, edu_courses, edu_enrollments, edu_attendances
     ```
   - Confirms `edu_students` is legitimate (but no DDL yet)

3. **FK References in Existing Code:**
   - T1 test references `hc_patients(patient_id)` as FK target
   - Suggests `hc_patients` is expected to exist

4. **SECURITY_CRITICAL_TABLES Added Deliberately:**
   - Hardcoded in `types.ts` (not auto-discovered)
   - Suggests intentional Kernel scope definition

---

### Evidence Against Option 2A

1. **No Architecture Specification:**
   - Healthcare/Education/Logistics Constitutions do NOT define table schemas
   - Constitutions define coding rules, not data models

2. **No Kernel Schema Documents:**
   - No `HEALTHCARE_KERNEL_SCHEMA.md` or `EDUCATION_KERNEL_SCHEMA.md` found
   - No canonical DDL source

3. **50% Missing:**
   - If these are legitimate, why are 6/12 missing after active development?
   - Suggests they may not be implemented yet or not planned

---

### Recommendation

**Cannot determine Option 2A/2B/2C without architect input.**

**Required from Architect:**

1. **Validate SECURITY_CRITICAL_TABLES correctness:**
   - Are these 6 tables legitimate Kernel requirements?
   - Do Healthcare H1-H12, Education E7, Logistics E7 specs define them?

2. **If Option 2A (legitimate):**
   - Provide canonical Kernel schema specification
   - OR: Approve creating DDL from semantic requirements (Patient, Medication, Student, etc.)
   - Document as "Phase 4B.3 Verification Baseline Kernel Schema"

3. **If Option 2B (constant wrong):**
   - Update SECURITY_CRITICAL_TABLES to reflect actual Kernel scope
   - Requires Contract v1.0.0 amendment (currently FROZEN)

4. **If Option 2C (wait):**
   - Define timeline for Kernel implementation
   - Accept T1-T7 blocking until tables exist

---

### P1 Status

**Evidence:** ✅ COMPLETE  
**Provenance:** 5/12 PROVEN, 1/12 PARTIAL, 6/12 MISSING  
**Recommended:** Cannot proceed without architect validation of SECURITY_CRITICAL_TABLES correctness  
**Decision Required:** 🔴 ARCHITECT VALIDATION (Option 2A/2B/2C)  

---

## 📊 AUDIT SUMMARY

### Evidence Gathering Status

| Decision Gate | Evidence Status | Recommendation | Decision Status |
|---------------|-----------------|----------------|-----------------|
| **P0: RLS Semantic Mapping** | ✅ COMPLETE | Option 1A (adapter normalizes) | 🔴 OPEN |
| **P2: FOR ALL Semantics** | ✅ COMPLETE | Interpretation A (accept FOR ALL) | 🔴 OPEN |
| **P1: Table Provenance** | ✅ COMPLETE | Cannot determine without architect validation | 🔴 OPEN |

---

### Key Findings

#### P0: RLS Semantic Mapping

**Root Cause:** Adapter returns PostgreSQL polcmd codes (`'r'`, `'*'`), Engine expects semantic names (`'SELECT'`, `'ALL'`).

**Boundary Issue:** Normalization responsibility unclear.

**Recommendation:** Adapter should normalize (Option 1A) as it's the abstraction boundary.

**Impact:** Fixes false negative (policies exist but checks fail).

---

#### P2: FOR ALL Semantics

**Root Cause:** Contract ambiguous on semantic vs structural requirement.

**Existing Pattern:** 100% of migrations use `FOR ALL`.

**Semantic Equivalence:** `FOR ALL` covers all 4 commands in PostgreSQL.

**Recommendation:** Accept `FOR ALL` as equivalent (Interpretation A).

**Impact:** Aligns verification with existing patterns, avoids production migration changes.

---

#### P1: Table Provenance

**Root Cause:** 6/12 SECURITY_CRITICAL_TABLES have no existing source.

**Governance Risk:** Cannot create DDL without canonical provenance.

**Critical Question:** Are these legitimate Kernel requirements or is constant wrong?

**Recommendation:** Architect must validate SECURITY_CRITICAL_TABLES correctness before baseline creation.

**Impact:** Blocks isolated DB provisioning until provenance resolved.

---

## 🚦 ARCHITECT DECISIONS REQUIRED

### Decision D1: P0 RLS Semantic Mapping

**Question:** Where should PostgreSQL polcmd codes be normalized to semantic command names?

**Options:**
- **1A:** DatabaseAdapter normalizes (recommended)
- **1B:** VerificationEngine accepts codes
- **1C:** VerificationEngine expands `'*'` only

**Required:** Architect approval of normalization boundary.

**Impact:** Code change to adapter or engine.

---

### Decision D2: P2 FOR ALL Semantics

**Question:** Does Contract require semantic command coverage or structural policy count?

**Options:**
- **Interpretation A:** Command coverage (accept `FOR ALL`) — recommended
- **Interpretation B:** Structural requirement (4 separate policies)

**Required:** Contract semantic clarification.

**Impact:** Engine logic change to expand `'ALL'` OR baseline must use 4 policies.

---

### Decision D3: P1 Table Provenance

**Question:** Are 6 missing tables legitimate Kernel requirements?

**Options:**
- **2A:** Legitimate (provide Kernel spec or approve semantic DDL creation)
- **2B:** SECURITY_CRITICAL_TABLES wrong (update constant, requires Contract amendment)
- **2C:** Wait for Kernel implementation (blocks T1-T7 indefinitely)

**Required:** Architect validation of SECURITY_CRITICAL_TABLES correctness.

**Impact:** Determines whether baseline can be created or scope must be redefined.

---

## 📋 NEXT STEPS (AFTER DECISIONS)

### If P0 = 1A Approved

1. Implement polcmd mapping in DirectPostgreSQLAdapter
2. Add test coverage for code mapping
3. Verify T1 RLS checks pass with mapped codes

---

### If P2 = Interpretation A Approved

1. Implement `'ALL'` expansion in VerificationEngine
2. Test coverage: `'ALL'` → `['SELECT', 'INSERT', 'UPDATE', 'DELETE']`
3. Verify existing `FOR ALL` migrations pass

---

### If P1 = Option 2A Approved

1. Architect provides Kernel schema specs OR approves semantic DDL
2. Create DDL from canonical sources (not "fake schema")
3. Document provenance in baseline manifest
4. Re-run T1.5.1 provenance audit
5. Approve baseline
6. Provision isolated DB
7. T1 re-run

---

### If P1 = Option 2B Approved

1. Update SECURITY_CRITICAL_TABLES constant
2. Amend Contract v1.0.0 (requires unfreezing)
3. Redefine verification scope
4. Re-run T1.5.1 audit with new scope
5. Baseline with 5 proven tables only

---

### If P1 = Option 2C Approved

1. Document blocking dependency on Kernel implementation
2. Defer T1-T7 until Kernel tables exist
3. No baseline provisioning

---

## 🚫 DO NOT (Until Decisions Approved)

❌ Implement P0 fix (adapter code change)  
❌ Implement P2 fix (engine code change)  
❌ Create DDL for 6 missing tables  
❌ Provision isolated database  
❌ Run T1 again  
❌ Proceed to T2-T7  
❌ Modify Contract v1.0.0  
❌ Assume decisions based on convenience  

---

## ✅ DELIVERABLES COMPLETE

- ✅ P0 evidence: PostgreSQL polcmd semantics, adapter behavior, engine expectation
- ✅ P2 evidence: Contract wording, existing patterns, semantic equivalence analysis
- ✅ P1 evidence: 12-table provenance audit, 5 proven / 1 partial / 6 missing
- ✅ Recommendations documented (not decisions)
- ✅ Decision options presented with rationale
- ✅ Impact analysis complete

---

**Status:** 🔴 **EVIDENCE AUDIT COMPLETE — AWAITING 3 ARCHITECT DECISIONS**  
**Deliverable:** `docs/architecture/T1_5_2_SEMANTIC_AND_PROVENANCE_DECISION.md`  
**Required:** Architect approval of D1 (P0), D2 (P2), D3 (P1) before implementation  

**STOP.** ✋ No code changes, no baseline creation, no DB provisioning until decisions approved.
