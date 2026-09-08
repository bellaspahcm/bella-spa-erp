# RETAIL OS — PHASE 3 KICKOFF

**Date:** 2026-09-06  
**Status:** ✅ AUTHORIZED (Gate 2 approved)  
**Objective:** Migrate `bella-retail-store` to R1/R2 Retail Core Baseline

---

## Phase 3 Objective

**Migrate bella-retail-store (Product #1) from duplicate implementation to R1/R2 Retail Core contracts.**

**Scope:** R1 Product Catalog + R2 Inventory Movement only. NO Customer, Pricing, or Sale Transaction extraction.

---

## Gate 2 Approval

**Approved:** [RETAIL_OS_GATE2_APPROVAL.md](RETAIL_OS_GATE2_APPROVAL.md)

**Authorized boundary:**
```
Retail OS
│
├── R1 Product Core ✅ (SKU, price, lifecycle, attributes)
├── R2 Inventory Core ✅ (quantity-based, movements, audit, reorder)
└── Extensions ⏸️ DEFERRED (Variant, Batch, Serial, Location)
```

**bella-retail-store archetype:** General Merchandise (R1/R2 Core sufficient)

---

## Phase 3 Scope

### IN SCOPE ✅

**1. Refactor bella-retail-store Product domain**
- Replace duplicate Product catalog logic with R1 Product Catalog contract
- Replace duplicate Inventory logic with R2 Inventory Movement contract
- Keep Sale Transaction in Product (not extracted)

**2. Integration tests**
- bella-retail-store → R1/R2 contracts → Engines → Repository → DB
- Tenant isolation verification
- Invariant validation

**3. Regression validation**
- Run existing bella-retail-store tests
- Verify no behavioral changes
- Document semantic adjustments (if any)

**4. Architecture Guard**
- Add Retail OS to frozen Kernel baseline
- Update Architecture Guard config
- Verify boundary protection

**5. Evidence collection**
- Reuse metrics (LOC saved, duplication reduced)
- Migration complexity assessment
- Integration test coverage
- Gate 3 evidence document

---

### OUT OF SCOPE ❌

**Prohibited activities (Gate 2 constraints):**

1. ❌ Contract expansion (R1/R2 frozen)
2. ❌ Extensions (Variant, Batch, Serial, Location)
3. ❌ Additional capability extraction (Customer, Pricing, Sale)
4. ❌ Product #2 development (Pharmacy, Electronics)
5. ❌ Universal Retail claims

---

## Implementation Plan

### Step 1: Analyze bella-retail-store Current State

**Objective:** Understand current Product catalog + Inventory implementation

**Tasks:**
- Map bella-retail-store Product operations to R1 contract
- Map bella-retail-store Inventory operations to R2 contract
- Identify duplicate logic to remove
- Identify semantic gaps (if any)

**Output:** Migration mapping document

**STOP condition:** If semantic gaps found that require contract changes → reopen Gate 2 architectural review.

---

### Step 2: Refactor Product Catalog (R1)

**Objective:** Replace bella-retail-store Product catalog with R1 contract

**Tasks:**
- Update bella-retail-store to import R1 IProductCatalogContract
- Replace Product creation logic with R1.createProduct()
- Replace Product price update logic with R1.updateProductPrice()
- Replace Product status update logic with R1.updateProductStatus()
- Replace Product queries with R1.getProductById() / getProductBySku()
- Remove duplicate Product catalog code

**Output:** bella-retail-store consuming R1 contract

**Verification:** Existing Product tests still pass (regression)

---

### Step 3: Refactor Inventory (R2)

**Objective:** Replace bella-retail-store Inventory with R2 contract

**Tasks:**
- Update bella-retail-store to import R2 IInventoryMovementContract
- Replace Inventory movement recording with R2.recordMovement()
- Replace movement history queries with R2.getMovementHistory()
- Replace stock queries with R2.getCurrentStock()
- Replace reorder detection with R2.detectReorderNeeds()
- Remove duplicate Inventory code

**Output:** bella-retail-store consuming R2 contract

**Verification:** Existing Inventory tests still pass (regression)

---

### Step 4: Integration Tests

**Objective:** Verify bella-retail-store → R1/R2 → Engines → DB integration

**Tasks:**
- Create integration test suite (bella-retail-store + Retail OS)
- Test Product creation flow (Product → R1 → Engine → DB)
- Test Inventory movement flow (Product → R2 → Engine → DB)
- Test tenant isolation (RLS verification)
- Test invariants (price positivity, no negative stock, DISCONTINUED final)
- Test Sale workflow (bella-retail-store → R1 + R2)

**Output:** Integration test suite (≥10 tests covering critical flows)

**Verification:** All integration tests pass

---

### Step 5: Regression Validation

**Objective:** Verify no behavioral changes in bella-retail-store

**Tasks:**
- Run existing bella-retail-store unit tests
- Run existing bella-retail-store integration tests (if any)
- Compare behavior before/after migration
- Document semantic adjustments (if any)

**Output:** Regression report

**Verification:** All existing tests pass OR justified semantic corrections documented

---

### Step 6: Architecture Guard Update

**Objective:** Add Retail OS to frozen Kernel baseline

**Tasks:**
- Update Architecture Guard config (add Retail OS frozen boundary)
- Run Architecture Guard verification
- Verify no boundary violations
- Document frozen contracts (R1 + R2)

**Output:** Retail OS added to Architecture Guard baseline

**Verification:** `npm run arch:guard` passes

---

### Step 7: Evidence Collection

**Objective:** Measure Phase 3 outcomes for Gate 3 review

**Tasks:**
- **Reuse metrics:**
  - LOC before migration (bella-retail-store Product + Inventory)
  - LOC after migration (bella-retail-store consuming R1 + R2)
  - LOC in Retail OS (R1 + R2 engines)
  - Duplication eliminated

- **Complexity metrics:**
  - Migration effort (estimated vs. actual)
  - Integration test count
  - Regression test pass rate

- **Quality metrics:**
  - TypeScript check status
  - Test coverage
  - Architecture Guard compliance

**Output:** Phase 3 evidence document

---

### Step 8: Gate 3 Checkpoint

**Objective:** Human review of Phase 3 outcomes

**STOP:** Do NOT proceed to SEAL without Gate 3 approval

**Gate 3 reviews:**
1. Migration success (bella-retail-store refactored?)
2. Reuse evidence (duplication reduced?)
3. Architecture conformance (R1/R2 boundaries preserved?)
4. Quality evidence (tests pass, TypeScript GREEN?)
5. SEAL decision (freeze Retail OS Core boundary?)

---

## Success Criteria

**Phase 3 succeeds if:**

1. ✅ bella-retail-store successfully migrated to R1/R2
2. ✅ Duplicate Product/Inventory logic removed
3. ✅ Regression tests pass (no behavioral change OR justified)
4. ✅ Integration tests pass (≥10 tests)
5. ✅ Architecture Guard updated + passes
6. ✅ Reuse metrics demonstrate value
7. ✅ TypeScript GREEN
8. ✅ Gate 3 evidence collected

**Phase 3 fails if:**

- ❌ Contract expansion required (R1/R2 boundaries insufficient)
- ❌ Regression failures unresolved
- ❌ Scope creep (Customer/Pricing/Sale extracted)
- ❌ Architecture boundaries violated

---

## Risk Management

### Risk 1: Contract Insufficient

**Risk:** bella-retail-store requires operations NOT in frozen R1/R2 contracts.

**Mitigation:**
- STOP migration immediately
- Reopen Gate 2 architectural review
- Do NOT expand contracts without human approval

**Likelihood:** LOW (Coverage Study validated General Merchandise archetype)

---

### Risk 2: Regression Failures

**Risk:** Migration changes bella-retail-store behavior unexpectedly.

**Mitigation:**
- Thorough regression testing
- Compare before/after behavior
- Document semantic adjustments
- Human review justifications

**Likelihood:** MEDIUM (refactoring risk)

---

### Risk 3: Scope Creep

**Risk:** Migration expands beyond R1/R2 (Customer, Pricing, Sale extraction).

**Mitigation:**
- Strict scope enforcement (R1 + R2 only)
- STOP if additional capabilities attempted
- Human review at Gate 3

**Likelihood:** LOW (Gate 2 constraints documented)

---

### Risk 4: Performance Degradation

**Risk:** Indirection through contracts degrades performance.

**Mitigation:**
- Performance baseline before migration
- Performance measurement after migration
- Optimize if degradation > 20%

**Likelihood:** LOW (contract indirection minimal overhead)

---

## Timeline Estimate

**Based on Phase 2 metrics (1,620 LOC, 17 days implementation):**

| Step | Estimated Effort | Notes |
|------|------------------|-------|
| 1. Analyze current state | 1 day | Mapping exercise |
| 2. Refactor R1 | 2-3 days | Product catalog migration |
| 3. Refactor R2 | 2-3 days | Inventory migration |
| 4. Integration tests | 2-3 days | ≥10 tests |
| 5. Regression | 1 day | Run existing tests |
| 6. Architecture Guard | 0.5 day | Config update |
| 7. Evidence | 1 day | Metrics collection |
| 8. Gate 3 | - | Human review |

**Total estimate:** 10-13 days (assumes no major regressions)

---

## Key Principles

**1. Scope discipline**

> **R1 + R2 migration only. No Customer, Pricing, Sale extraction.**

**2. Contract frozen**

> **R1/R2 contracts frozen. If insufficient, STOP and reopen Gate 2.**

**3. Evidence-based**

> **Measure reuse, duplication, quality. No claims without evidence.**

**4. Human gates**

> **Agent implements autonomously. Human reviews at Gate 3.**

---

## Phase 3 Ready

```
Gate 2                    ✅ APPROVED
R1/R2 Core                ✅ FROZEN
bella-retail-store        ✅ IDENTIFIED (General Merchandise)
Scope                     ✅ DEFINED (R1 + R2 only)
Constraints               ✅ DOCUMENTED
Success criteria          ✅ DEFINED
Risk mitigation           ✅ PLANNED

Phase 3                   ✅ READY TO START
```

---

**PHASE 3: AUTHORIZED ✅**

**Next:** Begin Step 1 (Analyze bella-retail-store current state)

**Reminder:** STOP at any STOP condition. Human reviews at Gate 3 before SEAL.
