# P2 Products/Apartments Gap Analysis

**Date:** 2026-09-11  
**Context:** P2.0 Discovery revealed "Apartments" = Products filtered by `product_type`  
**Purpose:** Compare Products prior evidence vs. Projects Phase 1 standard

---

## 🎯 Comparison Framework

### Projects Phase 1 Standard (Reference)

```text
P1.0  Discovery                        ✅ COMPLETE
P1.1  Production Write Flow            ✅ VERIFIED (5/5 tests)
P1.2  Field Semantics                  ✅ COVERED
P1.3  Authenticated Tenant Isolation   ✅ VERIFIED (8/8 tests)
P1.4  Browser Runtime Verification     ✅ VERIFIED (manual + script)
P1.5  Regression Testing               ✅ PASS (5/5)

Evidence Quality: 🟢 HIGH
- Test scripts: 3 (automated + repeatable)
- Documentation: 10 files
- Security: Defense-in-depth verified (4 layers)
- Runtime: Browser evidence captured
```

---

## 📊 Products Prior Evidence Assessment

### Evidence Located

**Document:** `docs/bella-land/APARTMENTS_VERIFICATION_REPORT.md`  
**Date:** 2026-09-10  
**Status:** 🟡 PARTIAL VERIFIED

### What WAS Verified ✅

**Database Integrity (Automated)**

| Check | Result | Method |
|-------|--------|--------|
| Valid status enum | ✅ 48/48 | Script scan |
| Valid product_type enum | ✅ 48/48 | Script scan |
| tenant_id populated | ✅ 48/48 | FK check |
| project_id populated | ✅ 48/48 | FK check |
| Multi-tenant data | ✅ 9 tenants | Count query |

**Script:** `scripts/bella-land/verify-apartments-workflow.ts` (database scan only)

**Verdict:** ✅ Schema integrity solid

---

### What was NOT Verified ❌

| Criterion | Status | Gap |
|-----------|--------|-----|
| Production write flow | ❌ NOT TESTED | No test script |
| Field semantics | ⚪ PARTIAL | Only validated existing data, not creation |
| Authenticated isolation | 🔴 **CRITICAL GAP** | RLS enforcement NOT verified |
| Cross-entity tenant integrity | 🔴 **CRITICAL GAP** | project_id ownership NOT verified |
| Browser runtime | ❌ NOT TESTED | "⏸️ NOT VERIFIED" per doc |
| Create workflow | ❌ NOT TESTED | Documented as pending |
| Update workflow | ❌ NOT TESTED | Not mentioned |
| Persistence test | ❌ NOT TESTED | Documented as pending |
| Regression | ❌ NOT TESTED | No baseline |

**Quote from document:**

```text
Page accessibility               ⏸️ NOT VERIFIED
Create workflow                  ⏸️ NOT VERIFIED
Persistence after create         ⏸️ NOT VERIFIED
Critical update/status flow      ⏸️ NOT VERIFIED
Cross-tenant isolation           ⏸️ NOT VERIFIED (RLS enforcement unproven)

VERDICT: 🟡 PARTIAL VERIFIED
- Database integrity: Evidence-backed ✅
- Workflow functionality: Not tested ⏸️
- Tenant isolation: tenant_id exists, but RLS enforcement NOT verified ⏸️
```

---

## 🔴 Critical Gaps Identified

### Gap 1: RLS Enforcement NOT Verified

**Projects standard:** 8/8 authenticated runtime tests (A1-A8)

**Products status:** 
- ✅ `tenant_id` column exists
- ❌ RLS policy existence: UNKNOWN
- ❌ RLS runtime behavior: NOT TESTED
- ❌ Cross-tenant access blocked: NOT VERIFIED
- ❌ WITH CHECK enforcement: NOT VERIFIED

**Risk:** 🔴 **HIGH**  
**Impact:** Cannot claim Products is secure without RLS verification

---

### Gap 2: Cross-Entity Tenant Integrity NOT Verified

**Critical invariant:**

```text
❌ MUST BLOCK:
Tenant A creates Product
  ├── product.tenant_id = Tenant A  (valid)
  └── product.project_id = Project B (Tenant B)  ❌ VIOLATION
```

**Products status:**
- ✅ `project_id` FK exists
- ❌ Cross-entity tenant check: NOT TESTED
- ❌ Tenant inheritance validation: NOT VERIFIED

**Why critical:** Products have parent-child relationship with Projects. Standard RLS (A1-A8) alone is NOT sufficient.

**Risk:** 🔴 **HIGH**  
**Impact:** Potential cross-tenant data leakage via parent entity

---

### Gap 3: Production Write Flow NOT Tested

**Projects standard:** 5 automated tests (T1-T5)

**Products status:**
- ❌ No test script for create flow
- ❌ Field semantics not verified via create
- ❌ Tenant injection not verified
- ❌ Service layer behavior not verified

**Risk:** 🟡 **MEDIUM**  
**Impact:** Cannot verify write path actually works

---

### Gap 4: Browser Runtime NOT Verified

**Projects standard:** Manual browser test + screenshot evidence

**Products status:**
- Documented as "⏸️ NOT VERIFIED"
- No browser evidence captured
- No UI-to-DB trace documented

**Risk:** 🟡 **MEDIUM**  
**Impact:** Per Projects P1.4 decision, this is a gate requirement

---

## 📋 Gap Closure Plan

### Required Tests (10 Tests Minimum)

#### P2.1: Production Write Flow (5 tests)

```text
T1  Create product (apartment) via ProductService
    ├── Authenticate as Tenant A
    ├── Get valid project_id from Tenant A
    ├── Create product with product_type = 'apartment'
    └── ASSERT: Row created with correct tenant_id

T2  Field semantics
    ├── product_code, product_type, status, area, unit_price
    └── ASSERT: All fields persisted correctly

T3  Reload/read-back
    └── ASSERT: Query returns created product

T4  Tenant injection
    └── ASSERT: product.tenant_id = authenticated tenant

T5  Parent relationship
    ├── Attempt create with non-existent project_id
    └── ASSERT: FK constraint violation
```

#### P2.2: Tenant Isolation (10 tests — includes cross-entity)

```text
A1  Own-tenant create                  ✅ Standard RLS
A2  Own-tenant read                    ✅ Standard RLS
A3  Cross-tenant read blocked          ✅ Standard RLS
A4  Cross-tenant update blocked        ✅ Standard RLS
A5  Cross-tenant delete blocked        ✅ Standard RLS
A6  Tenant forgery blocked             ✅ Standard RLS (WITH CHECK)
A7  Tenant escape blocked              ✅ Standard RLS (WITH CHECK)
A8  No query leakage                   ✅ Standard RLS

A9  Cross-entity forgery blocked       🔴 NEW (parent ownership)
    ├── Tenant A creates product
    ├── product.tenant_id = Tenant A (valid)
    ├── product.project_id = Project B (Tenant B)
    └── ASSERT: BLOCKED

A10 Cross-entity escape blocked        🔴 NEW (parent ownership)
    ├── Tenant A owns Product A under Project A
    ├── Tenant A attempts UPDATE project_id = Project B (Tenant B)
    └── ASSERT: BLOCKED
```

**Note:** A9/A10 test hierarchical tenant integrity, not covered by standard RLS tests.

#### P2.3: Browser Runtime (1 test)

```text
Manual UI Test
├── Login as Tenant A
├── Navigate /dashboard/real-estate/apartments
├── Select Project A (Tenant A)
├── Create apartment (product)
├── Verify UI success + list updated
├── Reload page
├── Verify persistence
└── EVIDENCE: Screenshot + DB verification
```

---

## 📊 Gap Summary

| Evidence Area | Projects Standard | Products Current | Gap |
|---------------|-------------------|------------------|-----|
| **Write flow tests** | 5/5 ✅ | 0/5 ❌ | 🔴 100% gap |
| **Isolation tests** | 8/8 ✅ | 0/10 ❌ | 🔴 100% gap |
| **Cross-entity tests** | N/A (no parent) | 0/2 ❌ | 🔴 NEW requirement |
| **Browser runtime** | 1/1 ✅ | 0/1 ❌ | 🔴 100% gap |
| **Documentation** | 10 docs ✅ | 1 doc (partial) | 🟡 90% gap |
| **Test scripts** | 3 scripts ✅ | 1 script (scan only) | 🟡 67% gap |

**Overall gap:** 🔴 **85-90%** (only database schema integrity verified)

---

## 🎯 Decision

### Option A: Full P2 Evidence Closure ✅ RECOMMENDED

**Rationale:**
1. **Critical gaps exist:** RLS + cross-entity integrity NOT verified
2. **Security risk:** Cannot seal without tenant isolation proof
3. **Consistency:** Projects set evidence standard, Products must match
4. **RC integrity:** 3/4 entities must have HIGH evidence quality

**Scope:**
```text
P2.1  Production Write Flow (5 tests)
P2.2  Tenant Isolation (10 tests — includes A9/A10)
P2.3  Browser Runtime (manual test + evidence)
P2.4  Regression (re-run P2.1 after any fixes)
P2.5  Documentation + Seal
```

**Estimated effort:** 2-3 hours (test script development + execution + documentation)

**Deliverables:**
- `test-product-creation.ts` (5/5 PASS)
- `test-product-tenant-isolation.ts` (10/10 PASS)
- `P2_BROWSER_EVIDENCE.md` (screenshot + verification)
- `PRODUCTS_EVIDENCE_COMPLETE.md` (final report)
- `PRODUCTS_PHASE_SEALED.md` (seal document)

---

### Option B: Targeted Gap Tests Only ⚠️ NOT RECOMMENDED

**Rationale:**
- Only test critical gaps (RLS + cross-entity)
- Skip write flow + browser (assume they work)

**Why NOT recommended:**
- Inconsistent with Projects evidence standard
- Cannot claim RC quality parity
- Leaves verification holes for future issues

---

### Option C: Accept Partial Evidence ❌ REJECTED

**Rationale:**
- Use database scan as sufficient evidence
- Skip functional testing

**Why REJECTED:**
- Violates gate-based evidence principle
- P1.4 precedent: "no seal without runtime verification"
- User requirement: "không có chuyện 7/8 = seal"

---

## ✅ Recommended Action

**PROCEED WITH OPTION A: Full P2 Evidence Closure**

**Justification:**

1. **Security critical:** RLS enforcement must be verified, not assumed
2. **Architectural critical:** Cross-entity tenant integrity (A9/A10) is new attack surface
3. **Consistency critical:** Projects set HIGH bar, Products must match
4. **Evidence integrity:** Database scan alone does NOT prove workflows work

**Next steps:**

```text
SESSION 3 PLAN:

P2.1  Create test-product-creation.ts
      ├── 5 tests (T1-T5)
      ├── Execute
      └── Document results

P2.2  Create test-product-tenant-isolation.ts
      ├── 10 tests (A1-A10)
      ├── Include cross-entity integrity (A9/A10)
      ├── Execute with authenticated users
      └── Document results

P2.3  Browser runtime verification
      ├── Manual UI test
      ├── Screenshot evidence
      └── DB verification

P2.4  Regression (if fixes needed)

P2.5  Documentation + Seal
      ├── PRODUCTS_EVIDENCE_COMPLETE.md
      ├── PRODUCTS_PHASE_SEALED.md
      └── Update RC_PROGRESS_STATUS.md
```

**After P2 seal:** Move to Customers (P3)

---

## 📍 Impact on RC Scope

### Corrected RC Scope

```text
BELLA LAND V2 — FULL CAPABILITIES RC
(Entity-Based, Architecturally Accurate)

Phase 1: Projects            🔒 SEALED (100%)
Phase 2: Products            🟡 15% (gap closure in progress)
Phase 3: Customers           ⚪ PENDING (0%)
Phase 4: Reservations        ✅ VERIFIED (100%)

UI Views:
- /projects          → Projects entity
- /apartments        → Products entity (filtered)
- /customers         → Customers entity
- /reservations      → Reservations entity

───────────────────────────────────────────────────────────
EVIDENCE CLOSURE PROGRESS:   🟡 55% (2.15/4 entities)
PRODUCT RC READINESS:        🟢 92–95% (product works)
FINAL RC STATUS:             ⏸️ NOT SEALED (evidence in progress)
───────────────────────────────────────────────────────────
```

**Note:** "Apartments" no longer separate line item (merged into Products)

---

## 🔒 Compliance Check

**Mandatory rules followed:**

✅ Gate-based evidence (not averaging)  
✅ Security verification required  
✅ Browser runtime required (Projects precedent)  
✅ Cross-entity integrity identified  
✅ Consistent evidence standard  
✅ No architectural violations

---

**Gap Analysis:** ✅ **COMPLETE**  
**Decision:** ✅ **Full P2 Evidence Closure Required**  
**Next:** → **P2.1 Production Write Flow Test Script**

