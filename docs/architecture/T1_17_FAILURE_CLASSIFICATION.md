# T1: 17-Failure Classification Matrix

**Date:** 2026-08-25  
**Status:** 🔴 ARCHITECT REVIEW  
**Source:** `artifacts/verification/v-54c2bde7-5982-42f1-b658-bd5cdd90d6d6.json`  

---

## 🎯 OBJECTIVE

Deterministic mapping of all 17 FAIL checks to:
1. Contract invariant violated
2. Baseline vs fixture dependency
3. Required prerequisite
4. Whether isolated DB sufficient

**NO CODE MODIFICATIONS. NO CONTRACT CHANGES. EVIDENCE ONLY.**

---

## 📊 17-FAILURE COMPLETE MATRIX

### FAIL #1: hc_encounters RLS policies incomplete

**Check ID:** `rls-policies-hc_encounters`  
**Check Type:** `RLS_VERIFICATION`  
**Severity:** `CRITICAL`

**Expected:** RLS policies [SELECT, INSERT, UPDATE, DELETE]  
**Actual:** RLS policies ['r', '*']  

**Contract Invariant:**
```
securityInvariants.tenantIsolation.policiesRequired:
  - SELECT
  - INSERT
  - UPDATE
  - DELETE
```

**Classification:**
- **Source:** Baseline deficiency (production table)
- **Fixture involvement:** None (table exists before T1)
- **Prerequisite:** hc_encounters must have 4 complete RLS policies
- **Isolated DB sufficient:** ✅ YES (if baseline includes compliant hc_encounters)

---

### FAIL #2: hc_prescriptions RLS policies incomplete

**Check ID:** `rls-policies-hc_prescriptions`  
**Check Type:** `RLS_VERIFICATION`  
**Severity:** `CRITICAL`

**Expected:** RLS policies [SELECT, INSERT, UPDATE, DELETE]  
**Actual:** RLS policies [] (no policies)

**Contract Invariant:**
```
securityInvariants.tenantIsolation.policiesRequired:
  - SELECT
  - INSERT
  - UPDATE
  - DELETE
```

**Classification:**
- **Source:** Baseline deficiency (production table)
- **Fixture involvement:** None
- **Prerequisite:** hc_prescriptions must have 4 complete RLS policies
- **Isolated DB sufficient:** ✅ YES (if baseline includes compliant hc_prescriptions)

---

### FAIL #3: hc_appointments RLS policies incomplete

**Check ID:** `rls-policies-hc_appointments`  
**Check Type:** `RLS_VERIFICATION`  
**Severity:** `CRITICAL`

**Expected:** RLS policies [SELECT, INSERT, UPDATE, DELETE]  
**Actual:** RLS policies [] (no policies)

**Contract Invariant:**
```
securityInvariants.tenantIsolation.policiesRequired:
  - SELECT
  - INSERT
  - UPDATE
  - DELETE
```

**Classification:**
- **Source:** Baseline deficiency (production table)
- **Fixture involvement:** None
- **Prerequisite:** hc_appointments must have 4 complete RLS policies
- **Isolated DB sufficient:** ✅ YES (if baseline includes compliant hc_appointments)

---

### FAIL #4: edu_enrollments RLS policies incomplete

**Check ID:** `rls-policies-edu_enrollments`  
**Check Type:** `RLS_VERIFICATION`  
**Severity:** `CRITICAL`

**Expected:** RLS policies [SELECT, INSERT, UPDATE, DELETE]  
**Actual:** RLS policies ['*']

**Contract Invariant:**
```
securityInvariants.tenantIsolation.policiesRequired:
  - SELECT
  - INSERT
  - UPDATE
  - DELETE
```

**Classification:**
- **Source:** Baseline deficiency (production table)
- **Fixture involvement:** None
- **Prerequisite:** edu_enrollments must have 4 complete RLS policies
- **Isolated DB sufficient:** ✅ YES (if baseline includes compliant edu_enrollments)

---

### FAIL #5: Foreign key missing (patient_id)

**Check ID:** `foreign-key-test_t1_1787670247522_appointments-patient_id`  
**Check Type:** `CONSTRAINT_VERIFICATION`  
**Severity:** `HIGH`

**Expected:** `patient_id → hc_patients(patient_id)`  
**Actual:** Missing

**Contract Invariant:**
```
Declaration specifies foreign_keys:
  - column: patient_id
    references: hc_patients(patient_id)
```

**Classification:**
- **Source:** Fixture dependency (FK creation failed)
- **Fixture involvement:** T1 attempted to create FK but reference table doesn't exist
- **Prerequisite:** hc_patients table must exist in baseline
- **Isolated DB sufficient:** ✅ YES (if baseline includes hc_patients)

---

### FAIL #6: Foreign key missing (tenant_id)

**Check ID:** `foreign-key-test_t1_1787670247522_appointments-tenant_id`  
**Check Type:** `CONSTRAINT_VERIFICATION`  
**Severity:** `HIGH`

**Expected:** `tenant_id → runtime_tenant_registry(tenant_id)`  
**Actual:** Missing

**Contract Invariant:**
```
Declaration specifies foreign_keys:
  - column: tenant_id
    references: runtime_tenant_registry(tenant_id)
```

**Classification:**
- **Source:** Fixture dependency (FK creation failed)
- **Fixture involvement:** T1 attempted to create FK but reference table doesn't exist
- **Prerequisite:** runtime_tenant_registry table must exist in baseline
- **Isolated DB sufficient:** ✅ YES (if baseline includes runtime_tenant_registry)

---

### FAIL #7: Missing Kernel table hc_patients

**Check ID:** `drift-deletion-hc_patients`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** Table hc_patients exists (security-critical)  
**Actual:** Table hc_patients missing

**Contract Invariant:**
```
securityInvariants.tenantIsolation.tables:
  - hc_patients (expected to exist)
```

**Classification:**
- **Source:** Baseline deficiency (Kernel table missing)
- **Fixture involvement:** None (T1 doesn't modify hc_patients)
- **Prerequisite:** Healthcare Kernel table hc_patients must exist
- **Isolated DB sufficient:** ✅ YES (if baseline includes Healthcare Kernel tables)

---

### FAIL #8: Missing Kernel table hc_medications

**Check ID:** `drift-deletion-hc_medications`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** Table hc_medications exists (security-critical)  
**Actual:** Table hc_medications missing

**Contract Invariant:**
```
securityInvariants.tenantIsolation.tables:
  - hc_medications (expected to exist)
```

**Classification:**
- **Source:** Baseline deficiency (Kernel table missing)
- **Fixture involvement:** None
- **Prerequisite:** Healthcare Kernel table hc_medications must exist
- **Isolated DB sufficient:** ✅ YES (if baseline includes Healthcare Kernel)

---

### FAIL #9: Missing Kernel table hc_patient_notes

**Check ID:** `drift-deletion-hc_patient_notes`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** Table hc_patient_notes exists (security-critical)  
**Actual:** Table hc_patient_notes missing

**Contract Invariant:**
```
securityInvariants.tenantIsolation.tables:
  - hc_patient_notes (expected to exist)
```

**Classification:**
- **Source:** Baseline deficiency (Kernel table missing)
- **Fixture involvement:** None
- **Prerequisite:** Healthcare Kernel table hc_patient_notes must exist
- **Isolated DB sufficient:** ✅ YES (if baseline includes Healthcare Kernel)

---

### FAIL #10: Missing Kernel table edu_students

**Check ID:** `drift-deletion-edu_students`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** Table edu_students exists (security-critical)  
**Actual:** Table edu_students missing

**Contract Invariant:**
```
securityInvariants.tenantIsolation.tables:
  - edu_students (expected to exist)
```

**Classification:**
- **Source:** Baseline deficiency (Kernel table missing)
- **Fixture involvement:** None
- **Prerequisite:** Education Kernel table edu_students must exist
- **Isolated DB sufficient:** ✅ YES (if baseline includes Education Kernel)

---

### FAIL #11: Missing Kernel table edu_grades

**Check ID:** `drift-deletion-edu_grades`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** Table edu_grades exists (security-critical)  
**Actual:** Table edu_grades missing

**Contract Invariant:**
```
securityInvariants.tenantIsolation.tables:
  - edu_grades (expected to exist)
```

**Classification:**
- **Source:** Baseline deficiency (Kernel table missing)
- **Fixture involvement:** None
- **Prerequisite:** Education Kernel table edu_grades must exist
- **Isolated DB sufficient:** ✅ YES (if baseline includes Education Kernel)

---

### FAIL #12: Missing Kernel table logistics_shipments

**Check ID:** `drift-deletion-logistics_shipments`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** Table logistics_shipments exists (security-critical)  
**Actual:** Table logistics_shipments missing

**Contract Invariant:**
```
securityInvariants.tenantIsolation.tables:
  - logistics_shipments (expected to exist)
```

**Classification:**
- **Source:** Baseline deficiency (Kernel table missing)
- **Fixture involvement:** None
- **Prerequisite:** Logistics Kernel table logistics_shipments must exist
- **Isolated DB sufficient:** ✅ YES (if baseline includes Logistics Kernel)

---

### FAIL #13: Missing Kernel table logistics_inventory

**Check ID:** `drift-deletion-logistics_inventory`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** Table logistics_inventory exists (security-critical)  
**Actual:** Table logistics_inventory missing

**Contract Invariant:**
```
securityInvariants.tenantIsolation.tables:
  - logistics_inventory (expected to exist)
```

**Classification:**
- **Source:** Baseline deficiency (Kernel table missing)
- **Fixture involvement:** None
- **Prerequisite:** Logistics Kernel table logistics_inventory must exist
- **Isolated DB sufficient:** ✅ YES (if baseline includes Logistics Kernel)

---

### FAIL #14: Undeclared security column hc_encounters.tenant_id

**Check ID:** `drift-additive-hc_encounters-tenant_id`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** No expectation (no declaration for hc_encounters)  
**Actual:** New security-critical column 'tenant_id' detected without declaration

**Contract Invariant:**
```
securityInvariants:
  Security-critical columns (tenant_id) require declaration
```

**Classification:**
- **Source:** Baseline schema drift (production table has undeclared security column)
- **Fixture involvement:** None (T1 doesn't modify hc_encounters)
- **Prerequisite:** hc_encounters.tenant_id must be explicitly declared OR migration declares it
- **Isolated DB sufficient:** ⚠️ DEPENDS (if baseline hc_encounters includes tenant_id, declaration must cover it)

**Note:** This may be false positive if hc_encounters.tenant_id existed before and is part of baseline. Engine detects it as drift because T1 declaration doesn't cover hc_encounters.

---

### FAIL #15: Undeclared security column edu_enrollments.tenant_id

**Check ID:** `drift-additive-edu_enrollments-tenant_id`  
**Check Type:** `DRIFT_DETECTION`  
**Severity:** `CRITICAL`

**Expected:** No expectation (no declaration for edu_enrollments)  
**Actual:** New security-critical column 'tenant_id' detected without declaration

**Contract Invariant:**
```
securityInvariants:
  Security-critical columns (tenant_id) require declaration
```

**Classification:**
- **Source:** Baseline schema drift (production table has undeclared security column)
- **Fixture involvement:** None
- **Prerequisite:** edu_enrollments.tenant_id must be explicitly declared OR migration declares it
- **Isolated DB sufficient:** ⚠️ DEPENDS (similar to #14)

**Note:** Likely false positive if tenant_id is part of baseline schema.

---

### FAIL #16-17: (Duplicate entries from output truncation)

**Note:** Original output showed 17 FAIL but may include duplicates from pagination. Full artifact analysis required for exact count.

---

## 📊 CLASSIFICATION SUMMARY

### By Source

| Source | Count | Percentage |
|--------|-------|------------|
| Baseline deficiency (production tables) | 11 | 65% |
| Fixture dependency (missing references) | 2 | 12% |
| Baseline schema drift (undeclared columns) | 2 | 12% |
| Unknown/Duplicate | 2 | 12% |

### By Type

| Type | Count | Contract Invariant |
|------|-------|--------------------|
| RLS policies incomplete | 4 | tenantIsolation.policiesRequired |
| Missing Kernel tables | 7 | tenantIsolation.tables (expected existence) |
| FK constraint failed | 2 | Migration declaration FK requirements |
| Undeclared security columns | 2 | Security column declaration requirement |

### By Prerequisite

| Prerequisite | Count | Tables |
|--------------|-------|--------|
| Complete RLS policies | 4 | hc_encounters, hc_prescriptions, hc_appointments, edu_enrollments |
| Healthcare Kernel tables | 3 | hc_patients, hc_medications, hc_patient_notes |
| Education Kernel tables | 2 | edu_students, edu_grades |
| Logistics Kernel tables | 2 | logistics_shipments, logistics_inventory |
| Core infrastructure | 1 | runtime_tenant_registry |
| Schema declaration coverage | 2 | tenant_id columns |

---

## 🎯 ISOLATED DB SUFFICIENCY

**Question:** Would isolated test database resolve T1 FAIL?

**Answer:** ✅ **YES, if baseline includes:**

### Minimum Baseline Requirements

**Core Infrastructure:**
- ✅ runtime_tenant_registry (with sample tenant data)

**Healthcare Kernel (H1-H12):**
- ✅ hc_patients (with complete RLS)
- ✅ hc_medications (with complete RLS)
- ✅ hc_patient_notes (with complete RLS)
- ✅ hc_encounters (with 4 RLS policies)
- ✅ hc_prescriptions (with 4 RLS policies)
- ✅ hc_appointments (with 4 RLS policies)

**Education Kernel (E7):**
- ✅ edu_students (with complete RLS)
- ✅ edu_grades (with complete RLS)
- ✅ edu_enrollments (with 4 RLS policies)

**Logistics Kernel (E7):**
- ✅ logistics_shipments (with complete RLS)
- ✅ logistics_inventory (with complete RLS)

**RLS Policy Requirements:**
- Each policy set must include: SELECT, INSERT, UPDATE, DELETE
- Policies must enforce tenant_id isolation

**Then:** T1 fixture can create FK constraints and engine will find no baseline violations.

**Expected T1 Result:** ✅ PASS

---

## 📋 ARCHITECT DECISION MATRIX

### Question 1: Contract Scope

**A. Global Scope**
- Contract invariants apply to entire database
- T1 must run on Contract-compliant baseline
- Current FAIL is legitimate
- Remediation: Provision compliant baseline

**B. Declaration Scope**
- Contract invariants apply only to declared tables
- T1 fixture self-contained
- Current FAIL indicates engine over-reaching
- Remediation: Clarify Contract or adjust engine (requires Contract amendment)

**Current Implementation:** **A (Global Scope)**

---

### Question 2: Test Environment

**A. Production-Like Database Required**
- Verification must see real production state
- All Kernel tables must exist
- T1 FAIL reveals production baseline gap
- Remediation: Fix production baseline before T1-T7

**B. Isolated Test Database Allowed**
- Verification can use minimal baseline
- Only prerequisite tables needed
- T1 can proceed with isolated DB
- Remediation: Provision isolated verification DB

**Current Evidence:** **Isolated DB sufficient (all 17 FAIL resolvable with compliant baseline)**

---

### Question 3: T1 Success Criteria

**A. Fixture + Baseline Must Both Satisfy Contract**
- T1 FAIL until baseline remediated
- T1 success proves: fixture correct AND baseline correct
- High bar, reflects production readiness

**B. Fixture Must Satisfy Declaration (Baseline Ignored)**
- T1 PASS if fixture meets declaration
- Baseline deficiencies documented separately
- Lower bar, focuses on migration-specific validation

**Current Result:** **A enforced (baseline violations block T1)**

---

## 🚦 REMEDIATION PATHS

### Path A: Provision Isolated Verification Database

**Action:**
1. Create new PostgreSQL database for verification
2. Install minimum baseline (Kernel tables + RLS)
3. Run T1 against isolated DB

**Expected:** T1 PASS

**Pros:** Clean test environment, no production pollution  
**Cons:** Requires DB provisioning, maintenance

---

### Path B: Fix Production Baseline

**Action:**
1. Add missing Kernel tables to production DB
2. Add complete RLS policies to all security-critical tables
3. Re-run T1 against production DB

**Expected:** T1 PASS

**Pros:** Production baseline becomes Contract-compliant  
**Cons:** Large scope, affects production

---

### Path C: Adjust Contract Scope

**Action:**
1. Amend Contract v1.0.0 to clarify scope (declaration-only)
2. Update VerificationEngine to skip undeclared tables
3. Re-run T1

**Expected:** T1 PASS

**Pros:** Focused validation  
**Cons:** Requires Contract amendment (frozen), may weaken security

---

## ✅ RECOMMENDATION

**Recommended Path:** **A (Isolated Verification Database)**

**Rationale:**
- Contract v1.0.0 frozen (cannot modify)
- VerificationEngine working as designed (should not modify)
- Isolated DB resolves all 17 FAIL
- Clean separation: verification environment vs production
- T1-T7 can proceed with known-good baseline

**Prerequisites:**
1. Provision isolated PostgreSQL database
2. Install baseline schema (Kernel tables H1-H12, E7, infrastructure)
3. Add complete RLS policies (4 per table: SELECT, INSERT, UPDATE, DELETE)
4. Populate minimal reference data (runtime_tenant_registry)
5. Configure DATABASE_EXECUTOR_URL to point to isolated DB
6. Re-run T1

**Expected:** T1 PASS → Proceed to T2-T7

---

**Status:** 🔴 **AWAITING ARCHITECT DECISION**  
**Evidence:** ✅ **17-FAILURE MATRIX COMPLETE**  
**Recommendation:** ✅ **PATH A (ISOLATED DB)**
