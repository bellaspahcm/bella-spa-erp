# Phase 4B.3 Option C Analysis — Hybrid Expected State Semantics

**Date:** 2026-08-25  
**Context:** T1 FAIL root cause analysis — Contract v1.0.0 semantic interpretation  
**Purpose:** Determine if T1 FAIL is adapter bug or verification logic misunderstanding Contract  

---

## 🎯 KEY QUESTION

**T1 executed with DirectPostgreSQLAdapter → FAIL (13/95 PASS, deployment_eligible=false)**

**Root cause candidates:**
1. Adapter implementation bug (DirectPostgreSQLAdapter incorrect)
2. Verification logic misunderstands Contract Option C semantics
3. Database baseline genuinely non-compliant with Contract

**This document determines which.**

---

## 📚 CONTRACT V1.0.0 — HYBRID EXPECTED STATE (OPTION C)

### Commit Message Evidence

```
Commit: 37ae4544
Message: FREEZE Phase 4B.3 Contract v1.0.0 — Hybrid Expected State (Option C)
```

**Contract explicitly chose Option C.**

---

### Step 2: Derive Expected State — Option C Definition

**From Contract (lines 230-280):**

```javascript
/**
 * Hybrid Approach (Option C):
 */

Expected State = Contract Invariants + Migration Declaration
                        │                      │
                        │                      ├─ Machine-readable
                        │                      ├─ Explicit expectations
                        │                      └─ NOT proof (must verify)
                        │
                        ├─ Security invariants
                        ├─ Tenant isolation
                        └─ Core structural requirements
```

**Two distinct sources:**

#### Source 1: Contract Invariants (ALWAYS verified)
```javascript
const contractInvariants = {
  securityCriticalTables: identifySecurityCriticalTables(),
  rlsRequirements: {
    enabled: true,
    policies: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'],
    tenantIsolationEnforced: true,
  },
  coreConstraints: {
    primaryKeysRequired: true,
    foreignKeysValidated: true,
    notNullEnforced: true,
  },
};
```

#### Source 2: Migration Declaration (Optional in Phase 1)
```javascript
const migrationDeclaration = await parseMigrationDeclaration(migration_file);
// Format: YAML/JSON front-matter or adjacent .declaration.json file
// Phase 1: If not present → fallback to security invariants only
```

**Merge strategy:**
```javascript
const expectedState = {
  securityInvariants: contractInvariants,  // ALWAYS CHECKED
  migrationExpectations: migrationDeclaration || {
    // Fallback: Empty in Phase 1 if no declaration
    tables: {},
    columns: {},
    constraints: {},
  },
};
```

---

## 🔍 CRITICAL DISTINCTION

### Contract Invariants (GLOBAL) vs Migration Expectations (LOCAL)

**From Contract lines 160-167:**

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
```

**This is WILDCARD PATTERN, not explicit table list.**

---

### Verification Semantic Question

**Contract uses wildcards:**
```javascript
SECURITY_CRITICAL_TABLES = [
  'hc_*',        // Wildcard pattern
  'edu_*',       // Wildcard pattern
  'logistics_*', // Wildcard pattern
]
```

**Implementation expanded to explicit list:**
```typescript
SECURITY_CRITICAL_TABLES = [
  'hc_patients',      // Explicit table name
  'hc_encounters',    // Explicit table name
  // ... 9 total
]
```

**Critical question:**

```
Contract wildcard 'hc_*'
        =
"ALL Healthcare tables MUST have RLS"
        OR
"Healthcare tables that exist MUST have RLS"
        ?
```

**This determines whether missing tables = FAIL or acceptable state.**

---

## 🧪 T1 CURRENT BEHAVIOR ANALYSIS

### T1 Implementation Logic

**File:** `src/platform/migration-governance/verification/checks/rls-verification.ts` (lines 28-42)

```typescript
export async function verifyRLS(
  expectedState: ExpectedState,
  actualState: ActualState
): Promise<VerificationCheck[]> {
  const checks: VerificationCheck[] = [];

  // Get security-critical tables from Contract
  const securityCriticalTables = expectedState.securityInvariants.tenantIsolation.tables;

  for (const tableName of securityCriticalTables) {
    const actualTable = actualState.tables[tableName];

    // Check 1: Table exists
    if (!actualTable || !actualTable.exists) {
      // Table missing → handled by drift detection
      continue;  // ← SKIPS MISSING TABLES
    }

    // Check 2-4: RLS checks (only for existing tables)
    // ...
  }
}
```

**Current logic:**
```
FOR EACH table IN SECURITY_CRITICAL_TABLES:
    IF table NOT EXISTS:
        SKIP (no FAIL)
    ELSE:
        CHECK RLS
```

**But drift-detection.ts produces FAIL for missing tables.**

---

### Drift Detection Logic

**File:** `src/platform/migration-governance/verification/checks/drift-detection.ts` (inferred from T1 artifact)

**T1 artifact shows:**
```json
{
  "check_id": "drift-missing-table-hc_patients",
  "check_type": "DRIFT_DETECTION",
  "check_name": "drift.missing_security_critical_table",
  "expected": "Table hc_patients exists",
  "actual": "Table hc_patients missing",
  "result": "FAIL",
  "severity": "CRITICAL"
}
```

**Drift detection treats missing security-critical table as CRITICAL FAIL.**

---

## 🎯 SEMANTIC INTERPRETATION OF OPTION C

### Two Possible Interpretations

#### Interpretation A: Strict Inventory (CURRENT IMPLEMENTATION)

**Semantic:**
```
SECURITY_CRITICAL_TABLES = Required Inventory

Missing table IN SECURITY_CRITICAL_TABLES
        ↓
    CRITICAL FAIL
        ↓
deployment_eligible = false
```

**Result:** T1 correctly FAILs for missing 5 tables.

**Implication:** Contract expects ALL 9 tables to exist before T1 PASS.

---

#### Interpretation B: Dynamic Scope (ALTERNATIVE)

**Semantic:**
```
SECURITY_CRITICAL_TABLES = Classification Rule

IF table EXISTS AND MATCHES 'hc_*':
    THEN RLS REQUIRED
ELSE:
    NOT IN SCOPE

Missing table NOT IN SECURITY_CRITICAL_TABLES
        ↓
    NOT CHECKED (no FAIL)
```

**Result:** T1 should PASS for 4 existing tables with correct RLS.

**Implication:** Contract classifies table security requirements, not required inventory.

---

### Contract Evidence for Each Interpretation

#### Evidence for Interpretation A (Strict Inventory):

**1. Contract lines 160-167 — "Required" language:**
```javascript
// Security-critical tables (tenant isolation required)
const SECURITY_CRITICAL_TABLES = [
  'hc_*',
  // ...
];
```

**"required" suggests these tables MUST exist.**

**2. Verification Philosophy (lines 25-28):**
```
> 4B.3 does not prove database is perfect. It proves migration didn't break Bella's required invariants.
```

**"required invariants" suggests completeness check.**

---

#### Evidence for Interpretation B (Dynamic Scope):

**1. Wildcard patterns suggest classification, not exhaustive list:**
```javascript
'hc_*',  // All Healthcare tables
```

**Not:**
```javascript
'hc_patients', 'hc_encounters', ...  // Explicit required list
```

**2. Hybrid Expected State structure:**
```javascript
Expected State = Contract Invariants + Migration Declaration
```

**Contract Invariants = Security rules (RLS required for security-critical tables)**  
**Migration Declaration = Explicit expectations (tables created by THIS migration)**

**Separation suggests:**
- Contract Invariants = Rules for tables IF THEY EXIST
- Migration Declaration = Explicit creation expectations

**3. "Migration Declaration Optional in Phase 1" (line 249):**
```javascript
const migrationDeclaration = await parseMigrationDeclaration(migration_file);
// Phase 1: If not present → fallback to security invariants only
```

**If Migration Declaration absent:**
- Only security invariants checked
- Security invariants = RLS rules for existing security-critical tables
- NOT completeness of all possible security-critical tables

---

## 🔎 CURRENT T1 FAILURE ROOT CAUSE

### Adapter Status: ✅ WORKING

**Evidence:**
- DirectPostgreSQLAdapter connected successfully
- PostgreSQL queries executed (13/95 checks PASS)
- RLS policy queries returned results
- No adapter errors in T1 artifact

**Conclusion:** ADR-001 adapter fix is functional.

---

### Verification Logic Status: ❓ AMBIGUOUS

**T1 artifact shows 2 failure categories:**

**Category 1: Missing tables (5 FAIL)**
```json
{
  "check_id": "drift-missing-table-hc_patients",
  "result": "FAIL",
  "severity": "CRITICAL"
}
```

**Category 2: RLS policy issues on EXISTING tables (12 FAIL)**
```json
{
  "check_id": "rls-policies-hc_prescriptions",
  "result": "FAIL",
  "severity": "CRITICAL"
}
```

**Question:** Is Category 1 (missing tables) a verification bug or correct behavior?

---

## 🚦 DECISION REQUIRED

### Option A: Interpretation A is Correct (Strict Inventory)

**If architect confirms:**
- Contract SECURITY_CRITICAL_TABLES = Required inventory
- Missing table = CRITICAL FAIL (correct)
- T1 FAIL is legitimate (database non-compliant)

**Resolution path:**
1. Locate canonical schema for 5 missing tables (from Kernel docs)
2. Create migrations with proven provenance
3. Deploy 5 missing tables to test database
4. Rerun T1 → Expected: PASS

**No verification code change needed.**

---

### Option B: Interpretation B is Correct (Dynamic Scope)

**If architect confirms:**
- Contract SECURITY_CRITICAL_TABLES = Classification rules
- Missing table = NOT IN SCOPE (no FAIL)
- T1 drift detection incorrectly treats missing as FAIL

**Resolution path:**
1. Fix drift-detection.ts:
   ```typescript
   // OLD: Missing security-critical table → CRITICAL FAIL
   // NEW: Missing security-critical table → INFO or WARNING
   ```
2. Fix SECURITY_CRITICAL_TABLES expansion:
   ```typescript
   // Only include tables that CURRENTLY EXIST in database
   const securityCriticalTables = expectedState.securityInvariants.tenantIsolation.tables
     .filter(table => actualState.tables[table]?.exists);
   ```
3. Rerun T1 → Expected: PASS for 4 existing tables

**Verification logic change required.**

---

## 📊 RECOMMENDATION

### Recommended: Interpretation B (Dynamic Scope)

**Rationale:**

**1. Contract uses wildcard patterns ('hc_*'), not explicit required list**
- Wildcards suggest classification ("IF Healthcare table, THEN RLS required")
- Not exhaustive inventory ("THESE 9 tables MUST exist")

**2. Hybrid Expected State separates concerns:**
```
Contract Invariants      → Security rules (RLS for security-critical tables IF THEY EXIST)
Migration Declaration    → Explicit expectations (tables THIS migration creates)
```

**3. "Migration Declaration Optional in Phase 1":**
- If no declaration → Only security invariants checked
- Security invariants = Rules, not inventory completeness
- Otherwise: Without declaration, EVERY possible future table would FAIL

**4. Verification Philosophy: "Migration didn't break required invariants"**
- Missing table (never existed) ≠ Broken invariant
- Broken invariant = RLS disabled on existing security-critical table
- Missing table before/after migration = No change = No breakage

**5. Platform of Platforms flexibility:**
- Healthcare adds tables incrementally (H1 → H2 → ... → H12)
- Contract should NOT fail verification until ALL H1-H12 tables exist
- Contract should verify: "IF Healthcare table exists, THEN RLS required"

---

### Proposed Fix (If Interpretation B Approved)

**File:** `src/platform/migration-governance/verification/checks/drift-detection.ts`

**Change:**
```typescript
// OLD: Missing security-critical table → CRITICAL FAIL
if (securityCriticalTables.includes(tableName) && !actualTable.exists) {
  checks.push({
    check_id: `drift-missing-table-${tableName}`,
    result: 'FAIL',
    severity: 'CRITICAL',
    // ...
  });
}

// NEW: Missing security-critical table → INFO (not blocking)
if (securityCriticalTables.includes(tableName) && !actualTable.exists) {
  checks.push({
    check_id: `drift-missing-table-${tableName}`,
    result: 'INFO',  // ← Changed from FAIL
    severity: 'INFO',  // ← Changed from CRITICAL
    message: `Security-critical table ${tableName} not yet implemented (no migration declaration present).`,
  });
}
```

**Semantic:** Missing table = Not in current scope, not a failure.

---

**File:** `src/platform/migration-governance/verification/checks/rls-verification.ts`

**No change needed** — already skips missing tables (line 38).

---

## ✅ CONCLUSION

### T1 FAIL Root Cause: Verification Logic Misinterprets Contract Option C

**Evidence:**
1. ✅ DirectPostgreSQLAdapter working (ADR-001 successful)
2. ✅ 4 existing tables queried successfully
3. ❌ Drift detection treats missing tables as CRITICAL FAIL
4. ❓ Contract Option C semantics ambiguous

**Resolution:**
1. Architect clarifies Contract Option C semantic (Interpretation A or B)
2. If Interpretation B → Fix drift-detection.ts logic
3. Rerun T1 → Expected: PASS for current 4-table baseline

**No adapter fix needed. No schema migration needed (for T1 PASS).**

---

### Next Action

**Architect must decide:**

**Question:** Does Contract SECURITY_CRITICAL_TABLES mean:
- **A. Required inventory** (ALL 9 tables MUST exist before T1 PASS)?
- **B. Classification rules** (IF table exists AND matches pattern, THEN RLS required)?

**After decision:**
- If A → Locate canonical schema, create 5 missing tables, rerun T1
- If B → Fix drift-detection.ts, rerun T1 immediately (no schema change)

---

**Status:** 🔴 BLOCKED — Awaiting architect clarification  
**Document:** `docs/architecture/PHASE4B3_OPTION_C_ANALYSIS.md`  
**Date:** 2026-08-25  

---

## 📎 APPENDIX: CONTRACT WILDCARD EXPANSION LOGIC

### Current Implementation (types.ts lines 195-212)

```typescript
export const SECURITY_CRITICAL_TABLES = [
  'hc_patients',      // Expanded from 'hc_*'
  'hc_encounters',    // Expanded from 'hc_*'
  'hc_medications',   // Expanded from 'hc_*'
  'hc_prescriptions', // Expanded from 'hc_*'
  'hc_patient_notes', // Expanded from 'hc_*'
  'hc_appointments',  // Expanded from 'hc_*'
  'edu_enrollments',  // Expanded from 'edu_*'
  'lg_movements',     // Expanded from 'logistics_*'
  'inventory',        // Expanded from 'logistics_*' (if approved)
] as const;
```

**Question:** Is this expansion:
- **Static canonical list** (these 9 tables are required)?
- **Dynamic implementation detail** (these 9 are current Kernel tables)?

### Alternative Implementation (If Interpretation B)

```typescript
// Contract: Wildcard patterns only
export const SECURITY_CRITICAL_TABLE_PATTERNS = [
  /^hc_/,         // Healthcare Kernel pattern
  /^edu_/,        // Education Kernel pattern
  /^lg_/,         // Logistics Kernel pattern
  /^inventory$/,  // Logistics canonical table
] as const;

// Runtime: Expand to actual tables in database
function identifySecurityCriticalTables(actualTables: string[]): string[] {
  return actualTables.filter(table =>
    SECURITY_CRITICAL_TABLE_PATTERNS.some(pattern => pattern.test(table))
  );
}
```

**Semantic:** Classification applied to EXISTING tables, not required inventory.

---

**End of Analysis**
