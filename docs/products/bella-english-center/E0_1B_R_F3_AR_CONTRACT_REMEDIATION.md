# E0.1B-R — PLATFORM F3 AR CONTRACT REMEDIATION

**Remediation ID:** E0.1B-R  
**Status:** 🔴 **AUTHORIZED — PREFLIGHT RECONCILIATION**  
**Date:** 2026-09-12

---

## MISSION

**Transform Platform Finance F3 AR from database capability → reusable Platform Finance capability.**

**NOT a data migration. NOT reusing P71 tables.**

**Goal:** Enable Products to consume canonical F3 AR operations via Contract boundary, without owning Finance internals.

---

## ARCHITECTURAL PRINCIPLE

**Correct Pattern:**
```text
Bella Preschool ──────┐
                      │
Bella English Center ─┼──→ Platform Finance F3 AR (Contract)
                      │         ↓
Future Products ──────┘    Single Writer Engine
                                ↓
                           F3 Schema + RPCs
```

**BLOCKED Pattern (Product→Product coupling):**
```text
English Center
      ↓
Preschool P71 Finance (edu_fin_* tables)
```

**Rationale:** English Center must prove Bella accumulates **reusable platform capability**, not build workarounds.

---

## REMEDIATION SCOPE (CORRECTED)

### Required Work

**1. F3 Preflight Reconciliation**
- Freeze existing F3 schema (6 tables)
- Freeze existing F3 RPCs (lifecycle operations)
- Freeze existing F3 tests (24 test targets)
- Document Single Writer ownership
- Prove tenant isolation + accounting invariants

**2. F3 AR Contract Definition**
- Define canonical Contract interface (Product → Platform boundary)
- Operations: createInvoice, finalizeInvoice, voidInvoice, recordPayment, allocatePayment
- Input/output types (Party-based or Customer-based — TBD after reconciliation)
- Error handling + idempotency contracts

**3. F3 AR Engine Implementation**
- Wrap existing F3 RPCs in Engine service layer
- Enforce Single Writer pattern
- Implement Contract interface
- Preserve existing F3 lifecycle logic (no rewrite)

**4. Product-Facing Boundary**
- Export F3 AR Contract to Products
- Wire Platform Finance module exports
- Enable English Center to consume F3 via Contract

**5. Lifecycle Verification**
- Prove invoice creation → finalization → payment → allocation
- Prove tenant isolation (RLS)
- Prove accounting invariants (balance reconciliation)
- Prove idempotency (duplicate prevention)

**6. English Center Integration**
- English Center Finance integration via F3 Contract
- Student billing flow (Student → Invoice → Payment)
- Verification tests (E2E billing scenarios)

---

### Conditional Work (Deferred Pending Reconciliation)

**Customer ↔ Party Relationship**

**NOT automatically migrating `customer_id → party_id`.**

**Reason:** Customer may be valid commercial account aggregate (not identity proxy).

**Valid architecture:**
```text
Party (identity)
  ↓ ownership relationship
Customer Account (commercial aggregate)
  ↓ invoicing relationship
Invoice
  ↓ settlement
Payment
```

**Reconciliation needed:**
1. Is `customer_id` semantic = identity or commercial account?
2. Does F3 need `party_id` as canonical identity?
3. Or does F3 need `customer.party_id` FK (customer belongs to party)?

**Decision:** Defer until F3 preflight completes semantic reconciliation.

---

## PREFLIGHT RECONCILIATION PLAN

### Phase 1: F3 Schema Reconciliation (30 min)

**Objective:** Lock denominator — exact F3 tables, columns, constraints, RLS.

**Tasks:**
1. Read full F3 AR schema migration (`20260817000000_finance_ar_engine_v1.sql`)
2. Document 6 canonical tables
3. Document identity pattern (`customer_id` semantics)
4. Document constraints (immutability, check constraints, unique indexes)
5. Document RLS policies (tenant isolation)

**Exit Criteria:**
- [ ] 6 F3 tables documented
- [ ] customer_id semantic understood
- [ ] Tenant isolation proven
- [ ] Immutability guarantees documented

---

### Phase 2: F3 RPC Reconciliation (30 min)

**Objective:** Lock F3 operational surface — exact RPCs, parameters, lifecycle.

**Tasks:**
1. Read F3 invoice lifecycle RPCs (`20260817010000_finance_invoice_lifecycle_rpcs.sql`)
2. Document RPC signatures
3. Document lifecycle state machine (DRAFT → FINALIZED → VOIDED)
4. Document idempotency keys
5. Document posting integration (F1 General Ledger)

**Exit Criteria:**
- [ ] RPC catalog complete (create/finalize/void/allocate)
- [ ] Lifecycle state machine documented
- [ ] Idempotency pattern understood
- [ ] F1 posting integration understood

---

### Phase 3: F3 Test Reconciliation (20 min)

**Objective:** Prove F3 operational integrity via existing tests.

**Tasks:**
1. Read F3 invoice lifecycle tests (`finance-f3-invoice-lifecycle.test.ts`)
2. Document 24 test targets
3. Verify tests PASS (run locally)
4. Document test patterns (fixtures, assertions, coverage)

**Exit Criteria:**
- [ ] 24 test targets cataloged
- [ ] Tests run PASS
- [ ] Coverage gaps identified (if any)

---

### Phase 4: Single Writer Ownership (20 min)

**Objective:** Establish F3 as canonical Single Writer for AR operations.

**Tasks:**
1. Verify no Product code directly mutates `finance_*` tables
2. Verify P71 Preschool uses `edu_fin_*` (separate domain)
3. Verify English Center has NO finance tables yet
4. Document F3 ownership boundary

**Exit Criteria:**
- [ ] F3 AR owns `finance_invoices` + related tables
- [ ] P71 separate (no F3 dependency)
- [ ] No Products bypass F3 (direct table writes)

---

### Phase 5: Customer Semantic Reconciliation (30 min)

**Objective:** Determine if `customer_id` is identity proxy or commercial account.

**Tasks:**
1. Trace `customers` table usage across codebase
2. Check if Products use `customers` for identity
3. Check if `customers` has separate lifecycle from Party
4. Determine if Customer = Person proxy or Account aggregate
5. Decide: Add `party_id` to customers OR replace `customer_id` with `party_id` in F3

**Exit Criteria:**
- [ ] Customer semantic classification complete
- [ ] Party relationship design locked
- [ ] Migration scope determined (if needed)

---

## PREFLIGHT EXIT CRITERIA

**PASS (Proceed to Contract/Engine implementation):**
- [ ] F3 schema reconciled (6 tables, constraints, RLS)
- [ ] F3 RPCs reconciled (lifecycle operations)
- [ ] F3 tests reconciled (24 targets PASS)
- [ ] Single Writer ownership established
- [ ] Customer semantic reconciliation complete
- [ ] Contract design locked
- [ ] Engine wrapper approach defined

**BLOCK (Escalate architectural gaps):**
- [ ] F3 schema fundamentally broken
- [ ] F3 RPCs missing critical operations
- [ ] F3 tests fail (regression detected)
- [ ] Multiple writers detected (ownership conflict)
- [ ] Customer semantics irreconcilable

---

## EXECUTION PHASES (POST-PREFLIGHT)

### R0: F3 Baseline Assessment

**Deliverable:** F3 capability inventory (schema, RPCs, tests, ownership)

**Exit Criteria:** Denominator locked, no unknowns

---

### R1: F3 AR Contract Definition

**Deliverable:** TypeScript Contract interface (`F3ARContract`)

**Methods:**
- `createInvoice(input: CreateInvoiceInput): Promise<Invoice>`
- `finalizeInvoice(invoiceId: string): Promise<FinalizeResult>`
- `voidInvoice(invoiceId: string): Promise<VoidResult>`
- `recordPayment(input: RecordPaymentInput): Promise<Payment>`
- `allocatePayment(input: AllocatePaymentInput): Promise<Allocation>`

**Exit Criteria:** Contract interface frozen, TypeScript compiles

---

### R2: F3 AR Engine Implementation

**Deliverable:** Engine service wrapping F3 RPCs

**Pattern:**
```typescript
class F3AREngine implements F3ARContract {
  async createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
    // Validate input
    // Call DB RPC: finance_create_draft_invoice()
    // Return typed result
  }
}
```

**Exit Criteria:** Engine implements Contract, wraps all F3 RPCs

---

### R3: Contract Tests

**Deliverable:** Contract-level integration tests

**Coverage:**
- Invoice lifecycle (create → finalize → void)
- Payment recording + allocation
- Tenant isolation
- Idempotency
- Error handling

**Exit Criteria:** Contract tests PASS, 100% method coverage

---

### R4: Platform Finance Exports

**Deliverable:** Wire F3 AR Contract to Platform Finance module

**Files:**
- `src/platform/finance/contracts/f3-ar.contract.ts`
- `src/platform/finance/engines/f3-ar/index.ts`
- `src/platform/finance/index.ts` (export Contract)

**Exit Criteria:** Products can import F3 AR Contract

---

### R5: English Center Integration

**Deliverable:** English Center Finance integration via F3 Contract

**Flow:**
```text
Student enrolls
    ↓
English Center creates invoice (via F3 Contract)
    ↓
F3 AR Engine creates finance_invoices record
    ↓
Parent pays
    ↓
English Center records payment (via F3 Contract)
    ↓
F3 AR Engine allocates payment to invoice
```

**Exit Criteria:** E2E billing test PASS

---

### R6: Full Verification

**Deliverable:** Regression + integration tests PASS

**Coverage:**
- F3 existing 24 tests PASS
- Contract tests PASS
- English Center E2E PASS
- Tenant isolation proven
- Accounting invariants proven

**Exit Criteria:** 0 regressions, full coverage

---

### R7: Governance Seal

**Deliverable:** F3 AR operational, English Center unblocked

**Evidence:**
- Contract interface frozen
- Engine implementation complete
- Tests PASS
- Platform exports wired
- English Center consuming F3
- Documentation complete

**Exit Criteria:** E0.1B-R CLOSED, E1 Readiness Gate unblocked

---

## TIMELINE ESTIMATE (POST-PREFLIGHT)

```text
R0 Baseline          2 hours
R1 Contract          4 hours
R2 Engine            8 hours
R3 Contract Tests    6 hours
R4 Platform Exports  2 hours
R5 English Center    8 hours
R6 Verification      4 hours
R7 Seal              2 hours

Total:               36 hours (4-5 days)
```

---

## AUTHORIZATION

**E0.1B-R Status:** 🟢 **AUTHORIZED**

**Scope:** Platform F3 AR Contract/Engine completion

**Pattern:** NOT data migration, NOT P71 reuse

**Next Step:** Begin Preflight Phase 1 (F3 Schema Reconciliation)

---

**E0.1B-R authorized. Proceeding with F3 preflight reconciliation (5 phases, 2.5 hours).**
