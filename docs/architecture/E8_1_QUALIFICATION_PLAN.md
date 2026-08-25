# E8.1: Deployment Adapter Qualification Phase

**Date:** 2026-08-24  
**Status:** 🟡 PLANNING  
**Phase:** QUALIFICATION (READ-ONLY)

---

## Purpose

**E8.1 is NOT deployment. E8.1 is QUALIFICATION.**

Prove that E8.0.4 deployment adapter works correctly with:
- Real migration files
- Real database schema
- Real E7 baseline
- Real legacy conflicts
- Real fail-closed behavior

**NO production modification. READ-ONLY qualification.**

---

## Qualification Test Matrix

### Q1: Identity Validation (G1)

**Test Case A: Valid 14-digit timestamp**
```
Input:  20260824000000_finance_test_cleanup_rpc.sql
Expect: G1 PASS
Verify: 
  - Format matches /^\d{14}$/
  - Timestamp components valid
  - File exists in Git
  - Filename canonical
```

**Test Case B: Legacy format (rejected)**
```
Input:  20260820_r4_3_gate_tokens.sql
Expect: G1 FAIL
Reason: Non-canonical format
Action: STOP (no deployment)
```

**Test Case C: Duplicate version**
```
Input:  20260824000000_duplicate.sql (if exists)
Expect: G1 FAIL
Reason: Version already exists
Action: STOP
```

---

### Q2: Checksum Validation (G2)

**Test Case A: Checksum matches file**
```
Input:  20260824000000 with correct SHA-256
Expect: G2 PASS
Verify: Calculated checksum === provided checksum
```

**Test Case B: Checksum mismatch (tampering)**
```
Input:  Modified 20260824000000, old checksum
Expect: G2 FAIL
Reason: File modified after checksum calculation
Action: STOP
Evidence: Log both checksums
```

**Test Case C: Missing checksum**
```
Input:  Migration without checksum metadata
Expect: G2 FAIL
Reason: Checksum required for deployment
Action: STOP
```

---

### Q3: Schema Drift Detection (G3)

**Test Case A: E7 baseline integrity**
```
Query:  SELECT COUNT(*) FROM schema_migrations WHERE version <= '20260823010000'
Expect: 23 (16 canonical + 7 legacy)
Verify: E7 baseline FROZEN
```

**Test Case B: No unexpected migrations**
```
Query:  SELECT * FROM schema_migrations WHERE version > '20260823010000' AND version != '20260824000000'
Expect: 0 rows
Verify: No unknown migrations between E7 and E8
```

**Test Case C: Schema objects match migration history**
```
Verify: 
  - All E7 tables exist
  - No unmigrated manual changes
  - RLS active where expected
```

---

### Q4: Dependency Validation (G4)

**Test Case A: All prior migrations applied**
```
Input:  20260824000000
Verify: All migrations < 20260824000000 are applied
Expect: G4 PASS
```

**Test Case B: Missing prerequisite**
```
Input:  20260825000000 (hypothetical future migration)
Verify: 20260824000000 not yet applied
Expect: G4 FAIL
Action: STOP
```

**Test Case C: Referenced objects exist**
```
Input:  Migration references existing tables/functions
Verify: Dependencies exist in schema
Expect: G4 PASS
```

---

### Q5: Destructive Change Detection (G5)

**Test Case A: Clean additive migration**
```
Input:  20260824000000 (CREATE FUNCTION only)
Verify: No DROP, no TRUNCATE, no RLS disable
Expect: G5 PASS
```

**Test Case B: Kernel table modification (hypothetical)**
```
SQL:    UPDATE hc_patients SET ...
Expect: G5 FAIL
Reason: Healthcare Kernel (H1-H12) is FROZEN
Action: STOP
```

**Test Case C: RLS disable attempt (hypothetical)**
```
SQL:    ALTER TABLE users DISABLE ROW LEVEL SECURITY
Expect: G5 FAIL
Reason: Tenant isolation violation (P0)
Action: STOP
```

**Test Case D: Legacy Kernel modification**
```
SQL:    UPDATE supabase_migrations.schema_migrations WHERE version <= '20260823010000'
Expect: G5 FAIL
Reason: E7 baseline is FROZEN
Action: STOP
```

---

### Q6: RLS/Tenant Safety (G6)

**Test Case A: New table with RLS**
```
SQL:
  CREATE TABLE test_table (..., tenant_id UUID);
  ALTER TABLE test_table ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON test_table USING (tenant_id = auth.current_tenant_id());
Expect: G6 PASS
```

**Test Case B: New table without RLS (if tenant-scoped)**
```
SQL:
  CREATE TABLE users (..., tenant_id UUID);
  -- Missing: ENABLE ROW LEVEL SECURITY
Expect: G6 FAIL
Reason: Tenant-scoped table requires RLS
Action: STOP
```

**Test Case C: Existing table RLS maintained**
```
Verify: All existing tenant-scoped tables still have RLS enabled
Expect: G6 PASS
```

---

### Q7: Recovery Strategy (G10)

**Test Case A: Valid strategy declared**
```
Input:  20260824000000 with recoveryStrategy: 'ROLLBACK'
Verify: Strategy is one of [ROLLBACK, COMPENSATING, RESTORE, FORWARD_FIX]
Expect: G10 PASS
```

**Test Case B: Missing strategy**
```
Input:  Migration without recoveryStrategy
Expect: G10 FAIL
Reason: All migrations require explicit recovery strategy
Action: STOP
```

**Test Case C: Strategy matches migration characteristics**
```
Input:  Destructive migration with ROLLBACK strategy
Expect: G10 WARNING (recommend COMPENSATING or RESTORE)
```

---

### Q8: Fail-Closed Behavior

**Test Case A: Preflight failure stops deployment**
```
Scenario: Any gate (G1-G6, G10) fails
Expect:   Deployment STOPS immediately
Verify:   NO execution attempted
          NO schema_migrations write
          NO psql fallback
          NO CLI fallback
          NO Dashboard fallback
```

**Test Case B: Multiple gate failures**
```
Scenario: G2 FAIL (checksum) + G5 FAIL (destructive)
Expect:   STOP at first failure (G2)
          G5 not evaluated (already stopped)
```

**Test Case C: Bypass attempt detection**
```
Scenario: Developer tries psql after adapter fails
Expect:   Architecture Guard blocks (if installed)
          Evidence logged
          Next deployment attempt shows drift
```

---

### Q9: AI Boundary Enforcement

**Test Case A: AI agent detection**
```
Context: KIRO_AGENT=true
Actor:   detectActor() → AI_AGENT
Expect:  Constructor throws
Error:   "AI DEPLOYMENT BLOCKED"
```

**Test Case B: AI with approval flag**
```
Context: AI_AGENT + hasDeploymentApproval: true
Expect:  Still blocked
Reason:  AI cannot deploy regardless of flags
```

**Test Case C: Developer without approval**
```
Context: DEVELOPER + hasDeploymentApproval: false
Expect:  deploy() throws
Error:   "AUTHORIZATION VIOLATION"
```

---

### Q10: Kernel Protection Audit

**⚠️  CRITICAL: Review Kernel blocking rules**

**Test Case A: Frozen E7 Kernel**
```
Tables:  inventory_items, inventory_movements, ... (E7.1)
Status:  FROZEN (cannot modify)
Verify:  Adapter blocks modifications
```

**Test Case B: Active Finance Kernel**
```
Tables:  fin_* (if F1/F2 exists)
Status:  Active development OR frozen?
Action:  CLARIFY before E8.1
Question: Should adapter block ALL fin_* or only frozen contracts?
```

**Test Case C: Future Healthcare Kernel**
```
Tables:  hc_* (H1-H12 frozen, but H13+ may exist)
Status:  H1-H12 FROZEN, H13+ ???
Action:  DEFINE policy: 
         - Kernel team CAN add new Kernel tables
         - Product Verticals CANNOT modify Kernel (frozen or new)
         - Frozen contracts require ACR to modify
```

**Decision required:**
```typescript
// Option 1: Block ALL Kernel tables (too strict)
if (tableName.startsWith('hc_') || tableName.startsWith('fin_') || tableName.startsWith('inventory_')) {
  BLOCK;
}

// Option 2: Block only frozen contracts (recommended)
const frozenContracts = {
  logistics: ['inventory_items', 'inventory_movements', ...], // E7.1
  healthcare: ['hc_patients', 'hc_doctors', ...],            // H1-H12
  finance: [] // Not yet frozen
};

if (actor === 'PRODUCT_VERTICAL' && modifiesKernelTable(any)) {
  BLOCK; // Use Public Contracts
}

if (actor === 'KERNEL_TEAM' && modifiesFrozenContract) {
  REQUIRE_ACR; // Architecture Change Request
}
```

**E8.1 deliverable:** Clear policy documented.

---

### Q11: Legacy Migration Reconciliation

**Test Case A: Adapter recognizes legacy format**
```
Query:  schema_migrations WHERE version LIKE '%\_%'
Found:  7 legacy migrations (20260820_r4_3, etc.)
Expect: Adapter recognizes mixed format
        Does NOT attempt to "fix" history
        Logs legacy format for audit
```

**Test Case B: New migrations use canonical format only**
```
Input:  20260824000000 (canonical)
Verify: G1 enforces 14-digit format
        G1 rejects legacy format for NEW migrations
```

**Test Case C: CLI reconciliation conflict handled**
```
Scenario: `supabase migration list` shows blank Remote
Expect:   Adapter does NOT rely on CLI reconciliation
          Adapter queries schema_migrations directly
          Deployment proceeds via Adapter (not CLI)
```

---

## Qualification Execution Plan

### Phase 1: Dry-Run (No DB Access)
```bash
# Test with file system only
npm run test:e8.1:identity
npm run test:e8.1:checksum
npm run test:e8.1:recovery
```

### Phase 2: Read-Only Validation (DB Read)
```bash
# Connect to DB, READ ONLY
npm run test:e8.1:drift
npm run test:e8.1:dependency
npm run test:e8.1:rls
```

### Phase 3: Preflight Complete (Full Qualification)
```bash
# Run complete preflight on 20260824000000
npm run test:e8.1:preflight -- 20260824000000

# Expected output:
# G1: PASS
# G2: PASS (if checksum provided)
# G3: PASS (E7 intact)
# G4: PASS (no prerequisites)
# G5: PASS (additive only)
# G6: PASS (no tables created)
# G10: PASS (strategy declared)
```

### Phase 4: Fail-Closed Verification
```bash
# Intentionally break each gate
npm run test:e8.1:fail-closed

# Test scenarios:
# - Wrong checksum → STOP
# - E7 modified → STOP
# - Missing dependency → STOP
# - RLS violation → STOP
# - AI actor → STOP
```

---

## Acceptance Criteria: E8.1

| Criteria | Status |
|----------|--------|
| Q1-Q7: All gates tested with real migration | ⏳ |
| Q8: Fail-closed verified (no fallback) | ⏳ |
| Q9: AI boundary verified | ⏳ |
| Q10: Kernel protection policy defined | ⏳ |
| Q11: Legacy reconciliation tested | ⏳ |
| 20260824000000 preflight PASS | ⏳ |
| E7 baseline remains FROZEN | ⏳ |
| NO production DB modification | ⏳ |
| Evidence collected and documented | ⏳ |

**E8.1 PASS = All criteria met**

---

## Deliverables

1. **Test Report:** All qualification test results
2. **Evidence Log:** Preflight results for 20260824000000
3. **Kernel Policy:** Frozen contracts vs active development
4. **Legacy Handling:** Documented reconciliation approach
5. **Fail-Closed Proof:** Evidence that fallback paths blocked
6. **Risk Assessment:** Updated risks for E8.2/E8.3

---

## Constraints

**DO NOT:**
- ❌ Deploy to production
- ❌ Execute migrations
- ❌ Modify schema_migrations
- ❌ "Fix" legacy records
- ❌ Bypass Architecture Guard

**CAN DO:**
- ✅ Read database schema
- ✅ Query schema_migrations
- ✅ Run preflight validation
- ✅ Generate evidence
- ✅ Test fail-closed behavior

---

## After E8.1

**IF E8.1 PASS:**
```
E8.1 PASS
   ↓
E8.2: Evidence & Provenance Qualification
   ↓
Human Architect Approval
   ↓
E8.3: Production Deployment
```

**IF E8.1 FAIL:**
```
E8.1 FAIL
   ↓
Root Cause Analysis
   ↓
Fix Deployment Adapter
   ↓
Retry E8.1
```

**E8.1 = Prove governance works. NOT deploy production.**
