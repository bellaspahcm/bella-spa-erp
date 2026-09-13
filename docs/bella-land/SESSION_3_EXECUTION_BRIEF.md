# Session 3 — Execution Brief

**Date:** TBD  
**Phase:** P2 Products Evidence Closure  
**Baseline:** `RC_BASELINE_OFFICIAL.md` v1.0

---

## 🎯 Mission

Close Products evidence gap: 15% → 100%

---

## 📋 Execution Sequence

```text
P2.1  Write Flow        → 5 tests  → PASS required
P2.2  Isolation + L5    → 10 tests → PASS required
P2.3  Browser Runtime   → 1 test   → PASS required
P2.4  Regression        → Rerun    → PASS required
P2.5  Documentation     → 2 docs   → Complete
```

**Gate-based:** Each phase blocks next until PASS.

---

## 🚀 P2.1: Production Write Flow

### Create: `scripts/bella-land/test-product-creation.ts`

**Pattern:** Replicate `test-project-creation.ts`

**Tests (5):**

```typescript
T1  Create product (apartment type)
    ├─ Authenticate Tenant A
    ├─ Get valid project_id (Tenant A)
    ├─ Call ProductService.createProduct
    ├─ product_type = 'apartment'
    └─ ASSERT: Row created, tenant_id = A

T2  Field semantics
    ├─ product_code, product_type, status, area, unit_price
    └─ ASSERT: All fields persisted

T3  Reload/read-back
    └─ ASSERT: Query returns product

T4  Tenant injection
    └─ ASSERT: product.tenant_id = authenticated user

T5  Parent relationship + Layer 5
    ├─ Test 1: Non-existent project_id → FK violation
    ├─ Test 2: Cross-tenant project_id → Layer 5 block
    └─ ASSERT: Both blocked
```

**Success:** 5/5 PASS → Move to P2.2

**Failure:** Freeze → RCA → Fix → Rerun

---

## 🔐 P2.2: Tenant Isolation + Layer 5

### Create: `scripts/bella-land/test-product-tenant-isolation.ts`

**Tests (10):**

```text
A1  Own-tenant create           ✅
A2  Own-tenant read             ✅
A3  Cross-tenant read blocked   ✅
A4  Cross-tenant update blocked ✅
A5  Cross-tenant delete blocked ✅
A6  Tenant forgery (WITH CHECK) ✅
A7  Tenant escape (WITH CHECK)  ✅
A8  No query leakage            ✅

A9  Cross-entity forgery (Layer 5)
    ├─ Tenant A creates product
    ├─ product.tenant_id = A (valid)
    ├─ product.project_id = Project B (Tenant B)
    └─ ASSERT: BLOCKED

A10 Cross-entity escape (Layer 5)
    ├─ Tenant A owns Product A under Project A
    ├─ Tenant A UPDATE product.project_id = Project B
    └─ ASSERT: BLOCKED
```

**Critical:** Use authenticated users (NOT service-role)

**Success:** 10/10 PASS → Move to P2.3

**Failure:** Identify which layer blocks (service/RLS/constraint) → Deploy fix if needed → Rerun

---

## 🖥️ P2.3: Browser Runtime

### Manual UI Test

**Flow:**
1. Login Tenant A
2. Navigate `/dashboard/real-estate/apartments`
3. Select Project A (Tenant A)
4. Create apartment
5. Verify UI success + list updated
6. Reload page
7. Verify persistence
8. DB verification (script or direct query)

**Evidence:** Screenshot + DB confirmation

**Success:** PASS → Move to P2.4

---

## 🔄 P2.4: Regression

**Action:** Re-run P2.1 (all 5 tests)

**Purpose:** Verify no breaks after P2.2 fixes (if any)

**Success:** 5/5 PASS → Move to P2.5

---

## 📄 P2.5: Documentation + Seal

### Create (2 docs):

1. `PRODUCTS_EVIDENCE_COMPLETE.md`
   - Test results (P2.1-P2.4)
   - Evidence quality assessment
   - Acceptance criteria (10/10)

2. `PRODUCTS_PHASE_SEALED.md`
   - Phase seal declaration
   - Security model verified
   - Layer 5 evidence
   - Deliverables summary

### Update (1 doc):

- `RC_PROGRESS_STATUS.md` — Mark Products CLOSED

---

## 🔴 Failure Protocol

### If Any Test Fails

```text
STEP 1: FREEZE
├─ Stop execution
├─ Do NOT proceed to next phase
└─ Capture exact failure (error message, logs)

STEP 2: RCA
├─ Identify root cause
├─ Service layer issue?
├─ RLS policy missing/incorrect?
├─ Layer 5 enforcement missing?
└─ Document finding

STEP 3: REMEDIATION
├─ Minimal fix (service validation / RLS / constraint)
├─ Do NOT modify test to make it pass
├─ Do NOT bypass security
└─ Document fix

STEP 4: RERUN
├─ Execute same test
├─ PASS → Continue
└─ FAIL → Escalate to user
```

**No shortcuts. No workarounds. Evidence integrity maintained.**

---

## ✅ Session Success Criteria

| Criterion | Target |
|-----------|--------|
| P2.1 Write flow | 5/5 PASS |
| P2.2 Isolation + L5 | 10/10 PASS |
| P2.3 Browser runtime | PASS + screenshot |
| P2.4 Regression | 5/5 PASS |
| P2.5 Documentation | 2 docs complete |
| Products sealed | ✅ CLOSED |

**Result:** 6/6 → Products Phase 2 SEALED

---

## 📍 Post-Session 3

**If Products sealed:**
```text
Move to Phase 3: Customers (P3.0–P3.5)
Same evidence standard
Same 5-layer security model
```

**If blocked:**
```text
Document blocker
User decision on remediation approach
Resume when unblocked
```

---

## 🔒 Rules Enforced

✅ No discovery re-do  
✅ Test first, fix second  
✅ Evidence integrity maintained  
✅ No architecture changes for green tests  
✅ Gate-based progression  
✅ Authenticated testing only  
✅ Layer 5 required (hierarchical data)

**Baseline:** `RC_BASELINE_OFFICIAL.md` v1.0

---

**Session 3:** 🟡 **READY TO EXECUTE**  
**First Action:** → **Create test-product-creation.ts (P2.1)**  
**Estimated Duration:** 2-3 hours

