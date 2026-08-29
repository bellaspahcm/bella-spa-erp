# T1 Failure Forensics — Contract Scope Analysis

**Date:** 2026-08-25  
**Status:** 🔴 ARCHITECT REVIEW REQUIRED  
**T1 Result:** FAIL (17/95 checks failed)  
**deployment_eligible:** false  

---

## 🎯 FINDING SUMMARY

**T1 fixture satisfied its own declaration but verification FAILED on global Contract invariants.**

This is NOT a test bug. This reveals **Contract scope semantics** that must be clarified before T2-T7.

---

## 📊 T1 EXECUTION RESULTS

### Checks Breakdown

**Total:** 95 checks
- ✅ **11 PASS** (fixture-specific checks)
- ⚠️ **67 WARNING** (additive drift on existing tables)
- ❌ **17 FAIL** (15 CRITICAL)

### Categories

| Check Type | PASS | FAIL | WARNING |
|------------|------|------|---------|
| Schema (fixture) | 5 | 0 | 0 |
| Constraints (fixture) | 1 | 2 | 0 |
| RLS (fixture) | 0 | 0 | 0 |
| RLS (production tables) | 4 | 4 | 0 |
| Drift (missing Kernel) | 0 | 6 | 0 |
| Drift (security) | 0 | 2 | 0 |
| Drift (additive) | 0 | 0 | 67 |
| Constraint (FK) | 0 | 2 | 0 |

---

## 🔍 FAILURE CLASSIFICATION

### Category 1: Fixture Dependencies (2 FAIL)

**Foreign key constraints failed:**
```
test_t1_xxx_appointments.patient_id → hc_patients(patient_id)     ❌ Missing
test_t1_xxx_appointments.tenant_id → runtime_tenant_registry(...)  ❌ Missing
```

**Cause:** Reference tables don't exist in test database.

**Fixture issue:** FK declarations assume production Kernel tables exist.

**Not a Contract violation.** FK check failed because fixture setup incomplete.

---

### Category 2: Production Table RLS (4 FAIL)

**Tables with incomplete RLS policies:**
```
hc_encounters:      RLS enabled ✅, policies incomplete ❌ (only 'r', '*')
hc_prescriptions:   RLS enabled ✅, policies missing ❌ (expected: SELECT, INSERT, UPDATE, DELETE)
hc_appointments:    RLS enabled ✅, policies missing ❌
edu_enrollments:    RLS enabled ✅, policies incomplete ❌ (only '*')
```

**Cause:** Existing production tables don't satisfy Contract RLS policy requirements.

**Contract invariant:** All security-critical tables must have complete RLS policies (SELECT, INSERT, UPDATE, DELETE).

**Finding:** **Production database baseline doesn't satisfy Contract v1.0.0.**

---

### Category 3: Missing Kernel Tables (6 FAIL)

**Contract expects these security-critical tables:**
```
hc_patients           ❌ Missing
hc_medications        ❌ Missing
hc_patient_notes      ❌ Missing
edu_students          ❌ Missing
edu_grades            ❌ Missing
logistics_shipments   ❌ Missing
logistics_inventory   ❌ Missing
```

**Cause:** Contract defines expected Kernel table set. Current DB missing these tables.

**Contract invariant:** Kernel tables must exist (defined in contract security invariants).

**Finding:** **Current database is NOT a complete Contract-compliant baseline.**

---

### Category 4: Undeclared Security Columns (2 FAIL)

**Additive drift with security implications:**
```
hc_encounters.tenant_id    ❌ CRITICAL (security column not declared)
edu_enrollments.tenant_id  ❌ CRITICAL (security column not declared)
```

**Cause:** Existing tables have `tenant_id` columns not covered by T1 declaration.

**Contract invariant:** Security-critical columns (tenant_id) require explicit declaration.

**Finding:** Existing production tables have schema drift not covered by declaration.

---

## 🎯 ROOT CAUSE ANALYSIS

### Engine Behavior

**Verification Engine checks:**
1. ✅ Declared tables/columns (migration-specific)
2. ✅ **Global Contract invariants (entire database)**
3. ✅ **Existing production tables (security-critical)**

**NOT just:**
- Declared tables only

**This is BY DESIGN per Contract v1.0.0.**

---

## 📋 CONTRACT SCOPE QUESTION

### Critical Clarification Needed

**Question 1: What is T1 "Happy Path"?**

**Option A: Scenario-Level Test**
```
T1 = Migration adds one table successfully
     ↓
Verify: That one table satisfies declaration
     ↓
Ignore: Rest of database state
```

**Option B: System-Level Test**
```
T1 = Database in valid state + migration applied
     ↓
Verify: Entire database satisfies Contract invariants
     ↓
Include: All security-critical tables (Kernel + products)
```

**Current engine implements:** **Option B**

**Test Harness assumes:** Unclear (needs Contract review)

---

**Question 2: Is isolated test database allowed?**

**Contract v1.0.0 states:**
> "4B.3 MAY read: PostgreSQL system catalogs, information_schema views, application tables (SELECT-only)"

**Interpretation A:** Verification must run against production-like database
- Must include all Kernel tables
- Must include all security-critical product tables
- T1 FAIL is legitimate (baseline doesn't satisfy Contract)

**Interpretation B:** Verification can run against isolated test database
- Only includes tables relevant to migration under test
- T1 fixture strategy valid
- Global invariant checks should be scoped

**Current implementation:** Interpretation A (checks entire database)

---

## 🚫 FORBIDDEN REMEDIATIONS

### DO NOT

❌ **Modify VerificationEngine to skip production tables**
```typescript
// ❌ WRONG
if (tableName.startsWith('test_t1_')) {
  // Only check fixture
}
```
**Why:** Breaks Contract security invariants.

❌ **Modify Contract v1.0.0 to make T1 pass**
```yaml
# ❌ WRONG
securityInvariants:
  tenantIsolation:
    tables: [] # Remove global checks
```
**Why:** Contract 37ae4544 is frozen.

❌ **Proceed to T2-T7 before resolving T1**
**Why:** T2-T7 will inherit same scope issue.

❌ **Claim T1 PASS by ignoring FAIL checks**
**Why:** Evidence shows deployment_eligible=false.

---

## ✅ VALID REMEDIATION PATHS

### Path 1: Clarify Contract Scope

**Action:** Review Contract v1.0.0 (37ae4544) to determine intended verification scope.

**Deliverable:** Documented interpretation:
- Does Contract require global database validation?
- Or scenario-specific validation?
- What is minimum prerequisite database state?

**If global:** T1 FAIL is legitimate. Database baseline must be fixed.

**If scenario-specific:** Fixture strategy needs adjustment (isolated DB or scoped invariants).

---

### Path 2: Provision Contract-Compliant Test Database

**Action:** Create test database that satisfies Contract baseline requirements:
- All Kernel tables (hc_patients, hc_medications, etc.)
- All security-critical tables with complete RLS
- runtime_tenant_registry with sample data
- Complete RLS policies on all tenant-isolated tables

**Deliverable:** Isolated test database for T1-T7.

**Then:** Re-run T1 against compliant baseline.

**Expected:** T1 PASS (fixture + baseline both satisfy Contract).

---

### Path 3: Document Baseline Deviation

**Action:** Accept that current database doesn't satisfy Contract v1.0.0.

**Deliverable:** ADR documenting baseline deviation:
- Missing Kernel tables
- Incomplete RLS policies
- Remediation plan for production

**Then:** Define T1 success criteria as "fixture satisfies declaration despite baseline deficiencies."

**Risk:** T1-T7 evidence won't prove deployment blocking for baseline violations.

---

## 📋 FORENSICS SUMMARY

### 17 FAIL Breakdown

| Failure Type | Count | Fixture Issue | Baseline Issue | Contract Scope Issue |
|--------------|-------|---------------|----------------|----------------------|
| Missing FK references | 2 | ✅ | Partial | - |
| Production table RLS incomplete | 4 | - | ✅ | ✅ |
| Missing Kernel tables | 6 | - | ✅ | ✅ |
| Undeclared security columns | 2 | - | ✅ | ✅ |
| **TOTAL** | **14** | **2** | **12** | **12** |

**Key Insight:** 12/14 FAIL are **baseline deficiencies**, not fixture bugs.

---

## 🎯 ARCHITECT DECISION REQUIRED

**Before proceeding to T2-T7, clarify:**

1. **Contract Scope:** Global database validation or scenario-specific?
2. **Test Environment:** Production-like or isolated test database?
3. **Baseline Requirements:** What is minimum prerequisite state?
4. **T1 Success Criteria:** Fixture-only or fixture + baseline?

**Options:**
- **A:** Fix production baseline → Re-run T1 (expect PASS)
- **B:** Provision isolated test DB → Re-run T1 (expect PASS)
- **C:** Document baseline deviation → Adjust T1 expectations
- **D:** Clarify Contract scope → Adjust verification engine (requires Contract amendment)

**Current Status:** T1 BLOCKED on architect decision.

---

## 📝 EVIDENCE PRESERVED

**T1 Artifact:** `artifacts/verification/v-54c2bde7-5982-42f1-b658-bd5cdd90d6d6.json`

**Contents:**
- 95 verification checks
- 17 FAIL details
- 67 WARNING details
- 11 PASS details
- Full check breakdown
- Fixture state
- Declaration
- Timestamp

**DB Record:** `migration_governance.verification_results`
- verification_id: `v-54c2bde7-5982-42f1-b658-bd5cdd90d6d6`
- migration_id: `t1-happy-path-test_t1_1787670247522`
- overall_result: `FAIL`
- deployment_eligible: `false`

**Evidence immutable.** Ready for architect review.

---

## 🚦 NEXT STEPS

**DO NOT:**
- Modify Contract v1.0.0
- Modify VerificationEngine
- Proceed to T2-T7
- Claim T1 PASS

**DO:**
1. Review Contract v1.0.0 scope semantics
2. Review Test Harness assumptions
3. Architect decision on remediation path
4. Document decision in ADR
5. Implement approved remediation
6. Re-run T1 (if applicable)
7. Only then proceed to T2-T7

---

**Status:** 🔴 **T1 BLOCKED — AWAITING ARCHITECT REVIEW**  
**Evidence:** ✅ **PRESERVED**  
**Contract:** 🔒 **FROZEN**  
**Engine:** 🔒 **DO NOT MODIFY**
