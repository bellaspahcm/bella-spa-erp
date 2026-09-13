# P5.1 — Scope Deduplication & Freeze

**Date:** 2026-09-11  
**Session:** 12  
**Phase:** Phase 5 Cross-Capability Integration  
**Step:** P5.1 Deduplication + Scope Freeze

---

## 🎯 Objective

Compare 17 preliminary P5 invariants against 83 existing verified invariants.  
Identify TRUE new cross-capability invariants.  
Freeze EXACT P5 scope.

---

## 📊 Existing Capability Evidence

### Projects (10 invariants)
- G1: Create project via production path
- G2: Field semantics validation
- G3: Reload/read-back
- G4: Service tenant injection
- G5: Own-tenant create
- G6: Own-tenant read
- G7: Cross-tenant read blocked
- G8: Cross-tenant update blocked
- G9: Tenant forgery blocked
- G10: No query leakage

**Coverage:** Projects standalone functionality + tenant isolation

### Products (35 invariants)
- P2.1 Write Flow (5 invariants)
- P2.2 Security (10 invariants) — includes cross-tenant blocking
- P2.3 Browser (10 invariants)
- P2.4 Regression (10 invariants) — includes Layer 5 FK validation

**Key Coverage:**
- ✅ Product → Project FK relationship (Layer 5 verified)
- ✅ Cannot create Product without valid project_id
- ✅ FK constraint enforced (CASCADE tested)
- ✅ Tenant isolation at Product level

### Customers (38 invariants)
- C3.1 Write Flow (5 invariants)
- C3.2 Security (9 invariants)
- C3.3 Browser (11 invariants)
- C3.4 New Coverage (13 invariants)

**Coverage:** Customers standalone functionality + tenant isolation + CRUD

**Total Existing:** 83 verified unique invariants

---

## 🔍 Deduplication Analysis

### Preliminary P5 Invariants

**Category 1: Integration (I1-I10)**

**I1: Cannot create Reservation for non-existent Product**
- **Type:** Database FK constraint
- **Similar to:** P2.2 Layer 5 FK validation (Product → Project)
- **Coverage:** Database enforces RESTRICT
- **Verdict:** ⚠️ PARTIAL — FK exists, but cross-capability error handling NOT tested
- **Status:** **NEW (error path verification)**

**I2: Cannot create Reservation for non-existent Customer**
- **Type:** Database FK constraint
- **Similar to:** P2.2 Layer 5 FK validation
- **Verdict:** ⚠️ PARTIAL — FK exists, error handling NOT tested
- **Status:** **NEW (error path verification)**

**I3: Product status updates when Reservation created**
- **Type:** Business logic / state synchronization
- **Similar to:** None (Products tested standalone, no Reservation interaction)
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (business logic)**

**I4: Cannot delete Product with active Reservations (FK RESTRICT)**
- **Type:** Database FK RESTRICT enforcement
- **Similar to:** None (Products delete not tested with Reservations)
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (referential integrity cross-capability)**

**I5: Cannot delete Customer with active Reservations (FK RESTRICT)**
- **Type:** Database FK RESTRICT enforcement
- **Similar to:** C3.4 D1-D4 (soft delete), but no Reservation interaction tested
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (referential integrity cross-capability)**

**I6: Reservation respects Product tenant isolation**
- **Type:** Tenant boundary enforcement
- **Similar to:** P2.2 cross-tenant blocking, but single-capability only
- **Verdict:** ⚠️ PARTIAL — Products isolated, but cross-capability not tested
- **Status:** **NEW (cross-capability tenant boundary)**

**I7: Reservation respects Customer tenant isolation**
- **Type:** Tenant boundary enforcement
- **Similar to:** C3.2 cross-tenant blocking, but single-capability only
- **Verdict:** ⚠️ PARTIAL — Customers isolated, but cross-capability not tested
- **Status:** **NEW (cross-capability tenant boundary)**

**I8: Cross-tenant Reservation blocked (Product Tenant A + Customer Tenant B)**
- **Type:** Adversarial tenant boundary violation
- **Similar to:** None (cross-capability adversarial not tested)
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (adversarial cross-capability)**

**I9: Reservation workflow: pending → deposited → converted**
- **Type:** State machine / business workflow
- **Similar to:** None (Reservations not tested in capabilities)
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (workflow state machine)**

**I10: Product availability check before Reservation**
- **Type:** Business rule enforcement
- **Similar to:** None
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (business logic)**

---

**Category 2: Workflow (W1-W3)**

**W1: End-to-end: Create Project → Product → Customer → Reservation**
- **Type:** Integration workflow
- **Similar to:** None (no E2E tested)
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (E2E workflow)**

**W2: Product cascade: Delete Project → Products deleted → Reservations blocked**
- **Type:** Cascade behavior + FK RESTRICT interaction
- **Similar to:** P2.2 Layer 5 CASCADE tested, but no Reservation interaction
- **Verdict:** ⚠️ PARTIAL — CASCADE tested, but RESTRICT interaction NOT tested
- **Status:** **NEW (cascade + restrict interaction)**

**W3: Reservation lifecycle: Create → Deposit → Convert → Product sold**
- **Type:** Business workflow + state synchronization
- **Similar to:** None
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (lifecycle workflow)**

---

**Category 3: Tenant Boundary (T1-T4)**

**T1: Cross-tenant Product access blocked in Reservation**
- **Type:** RLS enforcement at integration point
- **Similar to:** P2.2 A4-A6 cross-tenant blocking (Products only)
- **Verdict:** ⚠️ PARTIAL — Products RLS tested, Reservation interaction NOT tested
- **Status:** **NEW (cross-capability RLS)**

**T2: Cross-tenant Customer access blocked in Reservation**
- **Type:** RLS enforcement at integration point
- **Similar to:** C3.2 A4-A6 cross-tenant blocking (Customers only)
- **Verdict:** ⚠️ PARTIAL — Customers RLS tested, Reservation interaction NOT tested
- **Status:** **NEW (cross-capability RLS)**

**T3: Reservation tenant_id matches Product tenant_id**
- **Type:** Tenant consistency validation
- **Similar to:** None (cross-capability tenant validation not tested)
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (tenant consistency)**

**T4: Reservation tenant_id matches Customer tenant_id**
- **Type:** Tenant consistency validation
- **Similar to:** None
- **Verdict:** ❌ NOT COVERED
- **Status:** **NEW (tenant consistency)**

---

## 📊 Deduplication Summary

| Invariant | Type | Coverage | Status |
|-----------|------|----------|--------|
| I1 | FK error path | Partial (DB enforces, error path not tested) | **NEW** |
| I2 | FK error path | Partial (DB enforces, error path not tested) | **NEW** |
| I3 | Business logic | Not covered | **NEW** |
| I4 | FK RESTRICT | Not covered | **NEW** |
| I5 | FK RESTRICT | Not covered | **NEW** |
| I6 | Tenant boundary | Partial (single-capability only) | **NEW** |
| I7 | Tenant boundary | Partial (single-capability only) | **NEW** |
| I8 | Adversarial | Not covered | **NEW** |
| I9 | State machine | Not covered | **NEW** |
| I10 | Business rule | Not covered | **NEW** |
| W1 | E2E workflow | Not covered | **NEW** |
| W2 | Cascade interaction | Partial (CASCADE tested, RESTRICT not) | **NEW** |
| W3 | Lifecycle | Not covered | **NEW** |
| T1 | Cross-capability RLS | Partial (single-capability only) | **NEW** |
| T2 | Cross-capability RLS | Partial (single-capability only) | **NEW** |
| T3 | Tenant consistency | Not covered | **NEW** |
| T4 | Tenant consistency | Not covered | **NEW** |

**Result:** ALL 17 invariants are NEW (no full duplicates found)

**Reasoning:**
- Existing capability tests verified single-capability behavior
- Cross-capability interactions NOT tested
- FK constraints exist but error paths not verified at integration level
- Tenant boundaries tested per-capability, not cross-capability

---

## 🔒 FROZEN P5 SCOPE

### Phase 5 Unique Invariants: 17

**Group 1: Integration Constraints (10 invariants)**
- I1: Non-existent Product FK error
- I2: Non-existent Customer FK error
- I3: Product status sync on Reservation
- I4: Product delete blocked by Reservation (FK RESTRICT)
- I5: Customer delete blocked by Reservation (FK RESTRICT)
- I6: Product tenant isolation in Reservation
- I7: Customer tenant isolation in Reservation
- I8: Cross-tenant Reservation blocked (adversarial)
- I9: Reservation state machine (pending → deposited → converted)
- I10: Product availability check

**Group 2: E2E Workflows (3 invariants)**
- W1: End-to-end creation flow (Project → Product → Customer → Reservation)
- W2: Cascade interaction (Delete Project → Products cascade → Reservations block)
- W3: Reservation lifecycle workflow

**Group 3: Tenant Boundary Cross-Capability (4 invariants)**
- T1: Cross-tenant Product in Reservation blocked
- T2: Cross-tenant Customer in Reservation blocked
- T3: Reservation.tenant_id = Product.tenant_id
- T4: Reservation.tenant_id = Customer.tenant_id

---

## 📋 Test Strategy

### P5.2: Integration Tests (I1-I10)
**Scope:** 10 invariants  
**Type:** Server-side integration tests  
**Script:** `test-reservation-integration.ts`

### P5.3: E2E Workflow Tests (W1-W3)
**Scope:** 3 invariants  
**Type:** End-to-end workflow tests  
**Script:** `test-reservation-workflow.ts`

### P5.4: Tenant Boundary Tests (T1-T4)
**Scope:** 4 invariants  
**Type:** Adversarial tenant boundary tests  
**Script:** `test-reservation-tenant-boundary.ts`

### P5.5: Browser E2E (Optional)
**Scope:** Smoke test of reservation creation UI  
**Type:** Manual browser test  
**Checklist:** `P5_5_BROWSER_E2E_CHECKLIST.md`

### P5.6: Full Regression
**Scope:** Rerun capability tests + P5 tests  
**Purpose:** Verify no regressions introduced by integration

---

## 📊 Metrics Projection

**Before P5:**
- Known frozen: 83 unique invariants
- Program total: NOT FROZEN

**After P5 (projected):**
- Phase 5 new: 17 unique invariants
- Known frozen: 100 unique invariants (83 + 17)
- Program total: STILL NOT FROZEN (Reservations not reconciled)

**Note:** 100 = exact count after P5 verification, NOT an estimate.

---

## ⏭️ Next: P5.2 Integration Test Execution

**Status:** Scope frozen at 17 unique invariants  
**Ready:** Create test scripts  
**Execute:** Integration tests → Workflow → Tenant boundary → Regression

---

**P5.1 Deduplication: ✅ COMPLETE**  
**P5 Scope: 🔒 FROZEN at 17 unique invariants**

_No duplicates found — all cross-capability invariants are new_

