# Phase 4B.3 T1 Architectural Decisions

**Date:** 2026-08-25  
**Context:** T1 execution identified 3 blocking issues requiring architect decisions  
**Evidence:** T1.5.1 Provenance Audit, T1.5.2 Decision-Gate Evidence Audit  
**Objective:** Resolve blockers to enable T1 PASS with governance-valid baseline  

---

## 🎯 PURPOSE

T1 execution (17 FAIL) revealed that current database baseline cannot satisfy Contract v1.0.0 global invariants. Three architectural decisions required before proceeding.

**Governance Principle:**
> `deployment_eligible = true` must mean Contract-compliant, not "partial compliance" or "technical PASS".

---

## 📊 CURRENT STATUS

```
Gate C                         🟢 COMPLETE
T1 Implementation              🟢 COMPLETE
T1 Execution                   🟢 EXECUTED (17 FAIL)
T1 Forensics                   🟢 COMPLETE
Provenance Audit               🟢 COMPLETE
Decision-Gate Evidence         🟢 COMPLETE
D3 Architecture Validation     🟢 COMPLETE
D3 Inventory Reconciliation    🟢 COMPLETE

                ↓
        ✅ D1/D2 APPROVED
        🟡 D3 PARTIAL (corrected inventory identified)
                ↓

D1: RLS Semantic Mapping       ✅ APPROVED (1A - Adapter normalization)
D2: FOR ALL Semantics          ✅ APPROVED (3A - Semantic coverage)
D3: Contract Inventory         � PARTIAL (8-9 tables identified, architect approval required)

                ↓

Implementation (D1/D2)         🔒 AWAITING D3
Isolated DB Provision          🔒 BLOCKED (awaiting D3)
T1 Rerun                       🔒 BLOCKED (awaiting D3)
```

---

## 🔍 D1: RLS SEMANTIC MAPPING

### Issue

**Symptom:** RLS policy checks FAIL even when policies exist.

**Root Cause:** Adapter returns PostgreSQL polcmd codes (`'r'`, `'*'`), Engine expects semantic command names (`'SELECT'`, `'ALL'`).

**Evidence:**
- PostgreSQL stores: `pg_policy.polcmd = 'r'/'a'/'w'/'d'/'*'`
- Adapter returns: raw codes (no normalization)
- Engine expects: `'SELECT'/'INSERT'/'UPDATE'/'DELETE'/'ALL'`
- T1 result: False negative (policies exist, checks fail)

**Example:**
```json
{
  "check_id": "rls-policies-hc_encounters",
  "expected": ["SELECT", "INSERT", "UPDATE", "DELETE"],
  "actual": ["r", "*"],
  "result": "FAIL"
}
```

---

### Proposed Decision

**Adapter normalizes PostgreSQL polcmd codes to semantic command names at boundary layer.**

**Boundary:**
```
PostgreSQL Layer
    polcmd: 'r', 'a', 'w', 'd', '*'
        ↓
DirectPostgreSQLAdapter (normalize here)
        ↓
Verification Domain
    command: 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'
        ↓
VerificationEngine (database-agnostic)
```

---

### Rationale

1. **Adapter is abstraction boundary** between PostgreSQL and verification domain
2. **Engine should remain database-agnostic** (doesn't know PostgreSQL internals)
3. **Single normalization point** (maintainable, testable)
4. **Aligns with adapter pattern** (hide database-specific representations)

---

### Implementation (After Approval)

**File:** `src/platform/migration-governance/verification/database-adapter.ts`  
**Method:** `DirectPostgreSQLAdapter.queryRLSPolicies()`

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

  // Map PostgreSQL polcmd codes to semantic command names
  const POLCMD_MAP: Record<string, string> = {
    'r': 'SELECT',
    'a': 'INSERT',
    'w': 'UPDATE',
    'd': 'DELETE',
    '*': 'ALL',
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
- `'*'` → `'ALL'`

---

### Status

🟡 **PROPOSED** (awaiting architect approval)

---

## 🔍 D2: FOR ALL POLICY SEMANTICS

### Issue

**Symptom:** Existing migrations use `FOR ALL` policy, but verification expects 4 separate command policies.

**Root Cause:** Contract ambiguity on semantic coverage vs structural requirement.

**Evidence:**
- **Contract:** `policies: ['SELECT', 'INSERT', 'UPDATE', 'DELETE']`
- **Existing migrations:** 100% use `FOR ALL`
- **Question:** Does Contract require command coverage OR 4 separate policy objects?

**Examples:**
```sql
-- All existing migrations use this pattern:
CREATE POLICY tenant_isolation ON table
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**Files:**
- `supabase/migrations/20260818000001_runtime_tables.sql` (line 39)
- `supabase/migrations/20260812060000_create_education_schema.sql` (line 44)
- `supabase/migrations/20260806030000_healthcare_kernel_schema.sql` (line 95)
- `docs/WEEK_3_DAY_2_EXECUTION_PLAN.md` (line 485)

---

### Proposed Decision

**Accept `FOR ALL` as semantic coverage of all 4 commands (not structural requirement).**

---

### Rationale

1. **Contract intent likely semantic:** "Commands SELECT, INSERT, UPDATE, DELETE must be covered"
2. **PostgreSQL semantic equivalence:** `FOR ALL` covers all 4 commands
3. **Existing pattern alignment:** 100% migrations use `FOR ALL`
4. **Security equivalence:** Same tenant isolation enforcement
5. **Avoids production migration changes:** If rejected, all existing migrations become non-compliant

**Semantic Interpretation:**
```
Contract Requirement:
  "All 4 commands must be covered by RLS policies"

PostgreSQL Reality:
  FOR ALL = covers SELECT + INSERT + UPDATE + DELETE

Verification Should Accept:
  policies: ['ALL'] → semantically equivalent to → ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
```

---

### Implementation (After Approval)

**File:** `src/platform/migration-governance/verification/checks/rls-verification.ts`

**Change:**
```typescript
// Check 3: Required policies present (CRITICAL)
const actualPolicies = actualTable.rls?.policies || [];

// Expand 'ALL' to individual commands for coverage check
const actualPolicyCommands = new Set(
  actualPolicies.flatMap((p) => 
    p.command === 'ALL' 
      ? ['SELECT', 'INSERT', 'UPDATE', 'DELETE']  // Semantic expansion
      : [p.command]
  )
);

const missingPolicies = requiredPolicies.filter((cmd) => !actualPolicyCommands.has(cmd));
```

**Test Coverage Required:**
- Single `FOR ALL` policy → Satisfies all 4 commands
- 4 separate policies → Satisfies all 4 commands
- Mix of `FOR ALL` + specific → Coverage union
- Missing any command → FAIL

---

### Alternative (If Rejected)

**If architect requires 4 separate policy objects:**
- All existing migrations become non-compliant
- Isolated DB baseline must use 4 separate policies
- Production migrations remain as-is (out of scope for Phase 4B.3)

---

### Status

🟡 **PROPOSED** (awaiting architect approval)

---

## 🔍 D3: CONTRACT INVENTORY CORRECTNESS

### Issue

**Symptom:** SECURITY_CRITICAL_TABLES claims 12 tables. Provenance audit found only 5 with proven canonical sources.

**Root Cause:** Contract documentation error — SECURITY_CRITICAL_TABLES constant actually has **11 entries (not 12)**, and contains 3 architecture violations/naming errors.

**Evidence:**

**Inventory Count Mismatch:**
- Contract documentation: "12 tables"
- SECURITY_CRITICAL_TABLES constant: **11 entries**
- Healthcare: 6, Education: 3, Logistics: 2 = **11 total**

**Architecture Validation Results:**
| Table | Kernel | Evidence | Verdict |
|-------|--------|----------|---------|
| hc_patients | Healthcare H1-H12 | Implementation gap | ⚠️ CANONICAL (missing schema) |
| hc_encounters | Healthcare H1-H12 | Proven | ✅ CANONICAL |
| hc_medications | Healthcare H1-H12 | Implementation gap | ⚠️ CANONICAL (missing schema) |
| hc_prescriptions | Healthcare H1-H12 | Proven | ✅ CANONICAL |
| hc_patient_notes | Healthcare H1-H12 | Implementation gap | ⚠️ CANONICAL (missing schema) |
| hc_appointments | Healthcare H1-H12 | Proven | ✅ CANONICAL |
| edu_students | Education | **Constitution Law #5 violation** | ❌ PROHIBITED |
| edu_enrollments | Education | Proven | ✅ CANONICAL |
| edu_grades | Education | Implementation gap | ⚠️ CANONICAL (missing schema) |
| logistics_shipments | E7 Logistics | **Does not exist as table** | ❌ MOVEMENTTYPE ENUM |
| logistics_inventory | E7 Logistics | **Wrong table name** | ❌ ACTUAL NAME: `inventory` |

**Contract Requirement (INCORRECT):**
```typescript
// src/platform/migration-governance/verification/types.ts lines 195-212
export const SECURITY_CRITICAL_TABLES = [
  'hc_patients',              // ⚠️ CANONICAL (implementation gap)
  'hc_encounters',            // ✅ CANONICAL
  'hc_medications',           // ⚠️ CANONICAL (implementation gap)
  'hc_prescriptions',         // ✅ CANONICAL
  'hc_patient_notes',         // ⚠️ CANONICAL (implementation gap)
  'hc_appointments',          // ✅ CANONICAL
  'edu_students',             // ❌ CONSTITUTION VIOLATION (Law #5)
  'edu_enrollments',          // ✅ CANONICAL
  'edu_grades',               // ⚠️ CANONICAL (implementation gap)
  'logistics_shipments',      // ❌ DOES NOT EXIST (SHIPMENT = MovementType enum in lg_movements)
  'logistics_inventory',      // ❌ WRONG NAME (E7 table = 'inventory', not 'logistics_inventory')
] as const;  // 11 entries, not 12
```

---

### Critical Findings

**1. INVENTORY COUNT ERROR:**
- Documentation claimed "12 tables"
- Constant actually has **11 entries**
- **No table #12 exists**

**2. ARCHITECTURE VIOLATIONS:**

**edu_students (Constitution Law #5):**
> "Do not create `education_students` tables. Students must register as a vertical `role` on the generic `Party` profile."

Source: `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md` line 87

**logistics_shipments:**
- E7 Logistics has `SHIPMENT` as **MovementType enum value**, NOT as separate entity
- Actual E7 table: `lg_movements` (stores all movement types including SHIPMENT)
- `logistics_shipments` table **does not exist in E7 architecture**

**logistics_inventory:**
- E7 Logistics has canonical `inventory` table
- SECURITY_CRITICAL_TABLES lists wrong name: `logistics_inventory`
- Actual E7 table name: `inventory` (confirmed in repository line 31)

**3. IMPLEMENTATION GAPS (LEGITIMATE):**
- 4 Healthcare tables: `hc_patients`, `hc_medications`, `hc_patient_notes`, `edu_grades`
- Architecturally required by H1-H12 Kernels
- Schema exists in docs, missing from migrations
- **Not Contract errors** — legitimate implementation backlog

---

### Corrected Canonical Inventory

**PROVEN CANONICAL (8 tables):**
```typescript
export const SECURITY_CRITICAL_TABLES = [
  // Healthcare Kernel (6 tables — H1-H12 canonical)
  'hc_patients',
  'hc_encounters',
  'hc_medications',
  'hc_prescriptions',
  'hc_patient_notes',
  'hc_appointments',

  // Education Kernel (1 table — canonical)
  'edu_enrollments',

  // Logistics E7 Kernel (1 table — canonical)
  'lg_movements',
] as const;
```

**CONDITIONAL 9TH TABLE:**
- E7 `inventory` table is canonical E7 artifact (✅ PROVEN)
- Currently **not named `logistics_inventory`** in SECURITY_CRITICAL_TABLES
- **Architect decision:** Does Contract RLS global invariant require `inventory` in security-critical scope?
- If YES → 9 tables | If NO → 8 tables

**REMOVED (4 entries):**
- ❌ `edu_students` — Constitution Law #5 violation (standalone table prohibited)
- ❌ `edu_grades` — Implementation gap (no current schema, separate backlog decision)
- ❌ `logistics_shipments` — Does not exist as table (MovementType enum only)
- ❌ `logistics_inventory` — Wrong table name (E7 uses `inventory`, not `logistics_inventory`)

---

### Architect Decision Required

**CRITICAL DISTINCTION:**

```
Canonical Architecture
      (E7 owns `inventory` table)
              ≠
Contract Security Scope
      (Contract RLS global invariant requires `inventory`)
              ≠
Current Implementation
      (Migration exists or not)
```

**QUESTION:** Does Contract v1.0.0 global RLS invariant require E7 `inventory` table in SECURITY_CRITICAL_TABLES?

**Evidence:**
- ✅ `inventory` is canonical E7 persistence table
- ✅ `inventory` is tenant-scoped business table
- ✅ `inventory` has RLS protection at E7 level
- ⚠️ **Unknown:** Is it within Platform-level global security invariant scope?

**OPTIONS:**

#### Option 1: YES — 9-table inventory (RECOMMENDED)
```typescript
SECURITY_CRITICAL_TABLES = [
  // 6 Healthcare + 1 Education + 2 Logistics (lg_movements, inventory)
]
```
**Rationale:** If `inventory` is tenant-scoped persistent business table with Platform-level RLS requirements, it belongs in global security scope.

**Condition:** Only if E7 `inventory` is confirmed within global RLS/security Contract scope.

#### Option 2: NO — 8-table inventory
```typescript
SECURITY_CRITICAL_TABLES = [
  // 6 Healthcare + 1 Education + 1 Logistics (lg_movements only)
]
```
**Rationale:** `inventory` is E7-internal artifact, not subject to Platform-level global security invariants.

---

### Governance Principle

**NO "Partial PASS":**

```
Contract claimed: 12 tables
Actual constant: 11 tables
Architecture violations: 3 tables
Canonical proven: 8 tables (or 9 with inventory)

CANNOT:
  ❌ T1 PASS for "5/12 tables satisfied"
  ❌ deployment_eligible=true with partial compliance
  ❌ Continue with wrong inventory count

deployment_eligible = true MUST mean:
  ✅ Correct inventory count (8 or 9, not 11 or 12)
  ✅ All tables are architecturally canonical
  ✅ Full Contract compliance with corrected inventory
```

---

### Implementation Path (After D3 Approval)

**PHASE 1: D1/D2 FIXES ONLY**

Implement approved decisions without schema changes:

1. **D1 Implementation:** Adapter polcmd normalization
   ```typescript
   // DirectPostgreSQLAdapter: normalize r/a/w/d/* → SELECT/INSERT/UPDATE/DELETE/ALL
   ```

2. **D2 Implementation:** Engine FOR ALL expansion
   ```typescript
   // VerificationEngine: expand 'ALL' → ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
   ```

**NO schema migrations yet.**

---

**PHASE 2: SCHEMA GAP RESOLUTION** (Separate Governance Decision)

**Implementation gaps identified:**
- `hc_patients` (H1-H12 canonical, no migration)
- `hc_medications` (H1-H12 canonical, no migration)
- `hc_patient_notes` (H1-H12 canonical, no migration)
- `edu_grades` (Education Kernel canonical, no migration)

**Critical distinction:**
```
Canonical Architecture  ≠  Required for Phase 4B.3 scope
```

**Architect decision required:**
- **Option A:** 4 gaps are required for Phase 4B.3 → Create migrations with Kernel provenance
- **Option B:** 4 gaps are backlog items → Document as implementation debt, proceed with 5-table baseline

**Do NOT create migrations without explicit scope decision.**

---

**PHASE 3: BASELINE CREATION**

Use architect-approved inventory (8 or 9 tables) with:
- Resolved schema gaps (if approved for Phase 4B.3 scope)
- OR 5 existing tables only (if gaps deferred to backlog)
- All tables with RLS policies satisfying Contract invariants

---

**PHASE 4: ISOLATED DB & T1**

1. Provision isolated verification database
2. Apply baseline DDL
3. T1 rerun
4. Expected: PASS with `deployment_eligible=true`
5. T2-T7 execution

---

### Status

🟡 **NEAR-RESOLVED** — One final architect decision required

**Resolved (evidence-based):**
- ✅ 11 entries (not 12) confirmed
- ✅ 3 architecture violations identified and removed
- ✅ 8 canonical tables proven

**Architect must decide:**
- Does Contract RLS global invariant require E7 `inventory` table?
  - **If YES → 9-table inventory**
  - **If NO → 8-table inventory**

**NOT decided by:** "E7 owns canonical `inventory` table" (already proven, but insufficient for security scope)

**Decided by:** Contract v1.0.0 global security invariant requirements

---

## 📋 DECISION SUMMARY

| Decision | Status | Approval |
|----------|--------|----------|
| **D1: RLS Semantic Mapping** | ✅ APPROVED | **1A** — Adapter normalizes polcmd codes |
| **D2: FOR ALL Semantics** | ✅ APPROVED | **3A** — FOR ALL = semantic coverage |
| **D3: Contract Inventory** | 🟡 PARTIAL | **Awaiting architect**: 8 or 9 tables? |

---

## 🚦 NEXT STEPS

**BLOCKED UNTIL D3 APPROVED:**
- ❌ Update SECURITY_CRITICAL_TABLES constant
- ❌ Create implementation gap migrations
- ❌ Create canonical baseline
- ❌ Provision isolated DB
- ❌ T1 rerun

**AFTER D3 APPROVED:**
1. Implement D1 fix (adapter polcmd normalization)
2. Implement D2 fix (engine FOR ALL expansion)
3. Create migrations for 4 implementation gaps (from Kernel docs)
4. Update SECURITY_CRITICAL_TABLES with corrected inventory
5. Create baseline DDL with corrected inventory
6. Provision isolated verification database
7. T1 rerun → Expected: PASS with `deployment_eligible=true`
8. T2-T7 execution

---

## 📚 RELATED ARTIFACTS

- **T1 Result:** `artifacts/verification/v-54c2bde7-5982-42f1-b658-bd5cdd90d6d6.json`
- **T1 Forensics:** `docs/architecture/T1_EXECUTION_FORENSICS.md`
- **Provenance Audit:** `docs/architecture/T1.5.1_PROVENANCE_AUDIT.md`
- **Decision-Gate Evidence:** `docs/architecture/T1.5.2_DECISION_GATE_EVIDENCE.md`
- **D3 Architecture Validation:** `docs/architecture/D3_CONTRACT_INVENTORY_VALIDATION.md`

---

**Last Updated:** 2026-08-25  
**Next Review:** After D3 architect approval
2. Confirm whether 6 missing tables are:
   - Legitimate current requirements (Option A)
   - Incorrectly included (Option B)
   - Future/optional (Option C)
3. Provide canonical Kernel architecture reference

---

### Status

🔴 **OPEN** (requires architect validation of Contract inventory correctness)

---

## 📋 IMPLEMENTATION PLAN (AFTER APPROVALS)

### Phase 1: Implement Approved Decisions

#### If D1 APPROVED:
1. Implement polcmd mapping in `DirectPostgreSQLAdapter`
2. Add test coverage for code normalization
3. Verify T1 RLS checks pass with mapped codes

#### If D2 APPROVED:
1. Implement `'ALL'` expansion in `VerificationEngine.verifyRLS()`
2. Add test coverage for `FOR ALL` semantic expansion
3. Verify existing `FOR ALL` migrations pass

#### If D3 = Option A:
1. **BLOCK T1** until canonical provenance found for 12 tables
2. Architect provides Kernel architecture specification
3. Create DDL from canonical sources (no fake schema)
4. Re-run provenance audit (verify 12/12 proven)
5. Only then: Proceed to Phase 2

#### If D3 = Option B:
1. Update SECURITY_CRITICAL_TABLES to corrected scope
2. Amend Contract v1.0.0 (governance process)
3. Re-run provenance audit with corrected inventory
4. Proceed to Phase 2 with corrected baseline

#### If D3 = Option C:
1. Document scope limitation (5 tables, 6 future)
2. Update Contract to clarify current scope
3. Proceed to Phase 2 with 5-table baseline

---

### Phase 2: Provision Isolated Baseline

1. **Create baseline DDL** from proven canonical sources only
2. **NO fake schema** for unproven tables
3. **Provision isolated PostgreSQL database**
4. **Apply baseline schema**
5. **Verify all RLS policies correct** (with D1/D2 fixes)

---

### Phase 3: T1 Rerun

1. **Configure DATABASE_EXECUTOR_URL** to isolated DB
2. **Execute T1** with VerificationEngine
3. **Expected:** PASS + `deployment_eligible=true`
4. **Verify evidence artifact** generated + SHA-256 valid

---

### Phase 4: Next Steps

**If T1 PASS:**
- ✅ T1 checkpoint complete
- ✅ Evidence preserved
- ✅ Proceed to T2-T7 (negative tests)

**If T1 FAIL:**
- ❌ Generate single forensics document
- ❌ Architect review (1 document, not 5 audits)
- ❌ Resolve blockers
- ❌ Rerun T1

---

## 🚫 DO NOT (Until Approvals)

❌ Implement D1 fix (adapter code change)  
❌ Implement D2 fix (engine code change)  
❌ Create DDL for 6 missing tables  
❌ Provision isolated database  
❌ Run T1 again  
❌ Proceed to T2-T7  
❌ Modify Contract v1.0.0  
❌ Self-approve any decision  

---

## ✅ DELIVERABLES

- ✅ `docs/architecture/T1_5_1_BASELINE_PROVENANCE_AUDIT.md` (evidence)
- ✅ `docs/architecture/T1_5_2_SEMANTIC_AND_PROVENANCE_DECISION.md` (evidence)
- ✅ `docs/architecture/PHASE4B3_T1_DECISIONS.md` (this document)

---

## 📊 DECISION STATUS SUMMARY

| Decision | Status | Blocker |
|----------|--------|---------|
| **D1: RLS Semantic Mapping** | 🟡 PROPOSED | Awaiting architect approval |
| **D2: FOR ALL Semantics** | 🟡 PROPOSED | Awaiting architect approval |
| **D3: Contract Inventory** | 🔴 OPEN | Requires architect validation |

---

## 🎯 NEXT HUMAN ACTION

**Architect must:**
1. Review evidence documents (T1.5.1, T1.5.2)
2. Approve/modify D1 (RLS mapping)
3. Approve/modify D2 (FOR ALL semantics)
4. Validate D3 (Contract inventory correctness)
5. Update this document with decisions
6. Change status: PROPOSED → APPROVED, OPEN → APPROVED

**After approvals:**
- Developer implements approved fixes
- Provisions isolated DB with proven baseline
- Executes T1 rerun
- If PASS → T2-T7
- If FAIL → Single forensics, architect review

---

**Status:** 🔴 **AWAITING 3 ARCHITECT DECISIONS**  
**Document:** `docs/architecture/PHASE4B3_T1_DECISIONS.md`  
**Date:** 2026-08-25  

**STOP.** ✋ No implementation until D1/D2/D3 approved.


---

## 🔍 APPENDIX: D3 INVENTORY RECONCILIATION EVIDENCE

**Date:** 2026-08-25  
**Purpose:** Final inventory count and architecture conflict resolution

### Inventory Count Verification

**Contract Documentation Claim:** 12 tables  
**SECURITY_CRITICAL_TABLES Constant:** 11 entries (lines 195-212)

```typescript
// src/platform/migration-governance/verification/types.ts
export const SECURITY_CRITICAL_TABLES = [
  // Healthcare Kernel (6)
  'hc_patients',
  'hc_encounters',
  'hc_medications',
  'hc_prescriptions',
  'hc_patient_notes',
  'hc_appointments',

  // Education Kernel (3)
  'edu_students',
  'edu_enrollments',
  'edu_grades',

  // Logistics Kernel (2)
  'logistics_shipments',
  'logistics_inventory',
] as const;  // COUNT: 11 (not 12)
```

**Finding:** No table #12 exists. Documentation error.

---

### Architecture Conflict Evidence

#### 1. edu_students (Constitution Violation)

**Source:** `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md` line 87

> **Law 5: Identity Primitive Reuse.** Do not create `education_students` tables. Students must register as a vertical `role` on the generic `Party` profile.

**Verdict:** ❌ Standalone `edu_students` table is **prohibited by Education Constitution**.

---

#### 2. logistics_shipments (Table Does Not Exist)

**E7 Logistics Architecture:**
- `SHIPMENT` exists as **MovementType enum value**, not as separate entity
- Actual E7 table: `lg_movements` (stores all movement types)
- No `logistics_shipments` table in E7 domain layer

**Evidence:**
```typescript
// src/platform/logistics/domain/movement.types.ts
export type MovementType =
  | 'RECEIPT'
  | 'ISSUE'
  | 'SHIPMENT'           // ← Enum value, not table
  | 'ADJUSTMENT_IN'
  | 'TRANSFER_OUT'
  // ... other types
```

**Repository Reference:**
```typescript
// src/platform/logistics/repositories/movement.repository.ts line 29
const { data, error } = await this.supabase
  .from('lg_movements')  // ← Actual table name
  .select('*')
```

**Verdict:** ❌ `logistics_shipments` table **does not exist** in E7 architecture.

---

#### 3. logistics_inventory (Wrong Table Name)

**E7 Logistics Architecture:**
- E7 has canonical `inventory` table
- SECURITY_CRITICAL_TABLES lists: `logistics_inventory` (WRONG)
- Actual E7 table name: `inventory`

**Evidence:**
```typescript
// src/platform/logistics/repositories/inventory.repository.ts line 31
const { data, error } = await this.db
  .from('inventory')  // ← Actual table name (NOT logistics_inventory)
  .select('*')
```

**Verdict:** ❌ `logistics_inventory` is **incorrect table name**. E7 uses `inventory`.

---

### Corrected Canonical Inventory Summary

| Category | Count | Tables |
|----------|-------|--------|
| **Healthcare (Canonical)** | 6 | hc_patients, hc_encounters, hc_medications, hc_prescriptions, hc_patient_notes, hc_appointments |
| **Education (Canonical)** | 1 | edu_enrollments |
| **Logistics E7 (Canonical)** | 1 | lg_movements |
| **Optional (E7 inventory table)** | 1? | inventory (if architect approves) |
| **TOTAL** | **8 or 9** | (Not 11 or 12) |

**Removed:**
- ❌ edu_students (Constitution violation)
- ❌ edu_grades (Implementation gap, no current schema)
- ❌ logistics_shipments (Does not exist)
- ❌ logistics_inventory (Wrong name)

---

**Reconciliation Status:** ✅ COMPLETE  
**Architect Decision Required:** 8-table or 9-table inventory?
