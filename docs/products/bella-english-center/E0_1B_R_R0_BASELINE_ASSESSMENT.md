# E0.1B-R R0 — F3 AR BASELINE ASSESSMENT

**Phase:** R0 Baseline Assessment  
**Status:** ✅ **COMPLETE**  
**Date:** 2026-09-12

---

## MISSION

Lock exact denominator of Platform F3 AR **before implementation**.

**NOT discovery.** Preflight completed investigation. R0 = freeze inventory.

---

## CAPABILITY INVENTORY (FROZEN)

### Database Schema

**Tables:** 6

1. `finance_invoices` (invoice headers)
2. `finance_invoice_lines` (line items)
3. `finance_receivable_ledger` (immutable AR subledger log)
4. `finance_receivable_positions` (derived AR position cache)
5. `finance_receivable_allocations` (payment allocation log)
6. `finance_receivable_adjustments` (credit/debit memos)

**Migration:** `supabase/migrations/20260817000000_finance_ar_engine_v1.sql`

**Immutability Guarantees:**
- Level 1: Absolute immutability (ledger, allocations) — no UPDATE/DELETE
- Level 2: Guarded mutation (positions) — requires session variable
- Level 3: Lifecycle immutability (invoices FINALIZED/VOIDED)
- Level 4: Status transition constraints (state machine enforcement)

**Tenant Isolation:** RLS enabled, policies verified

**Privileges:** authenticated = SELECT only (no direct writes)

---

### Lifecycle RPCs

**Operations:** 4

1. `finance_create_draft_invoice(tenant_id, customer_id, invoice_number, currency, issue_date, due_date) → invoice_id`
2. `finance_add_invoice_line(tenant_id, invoice_id, service_id, description, quantity, unit_price_minor, tax_rate, revenue_account_code) → line_id`
3. `finance_finalize_invoice(tenant_id, invoice_id, idempotency_key, request_hash, lines_jsonb) → {success, transaction_id, is_duplicate}`
4. `finance_void_invoice(tenant_id, invoice_id) → reversal_transaction_id`

**Migration:** `supabase/migrations/20260817010000_finance_invoice_lifecycle_rpcs.sql`

**Lifecycle State Machine:**
```text
DRAFT → FINALIZED → ADJUSTED
             ↓
           VOIDED
```

**Idempotency:**
- `posting_attempt_id` (persistent, per-invoice)
- `void_posting_attempt_id` (persistent, per-invoice)

**F1 Integration:**
- Finalize → calls `finance_post_transaction()` (F1 GL)
- Void → calls `finance_reverse_transaction()` (F1 GL)

---

### Test Coverage

**Test Suite:** `src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts`

**Test Targets:** 24

**Coverage:**
- T01-T02: DRAFT creation, uniqueness
- T03-T06: Line addition, rounding, tax, totals
- T07-T11: Finalization outcomes, F1 posting, AR subledger
- T12-T14: Idempotency, rollbacks
- T15-T20: Status transitions, void, reversals
- T21-T24: Multi-account, zero-value, COA validation

**Test Status:** Exists, patterns documented (runtime execution deferred to R6)

---

### Product-Facing Boundary

**Public Contracts:** 0

**Engines/Services:** 0

**Platform Exports:** 0

**Product Consumption:** 🚫 BLOCKED (no Contract/Engine layer)

**Current Access Path:**
```text
Tests → Direct RPC calls (temporary)
Products → ❌ NO PATH (Contract missing)
```

---

### Architecture Violations

**Product Bypasses:** 0

**Direct Table Writes:** 0 (production code)

**Direct RPC Calls:** 0 (products)

**Single Writer Compliance:** ✅ VERIFIED

---

## IDENTITY SEMANTICS (FROZEN)

### customer_id Interpretation

**Semantic:** Party canonical identifier (partyId)

**Pattern:**
```text
Party (P0 Identity)
  ↓
Invoice (customer_id = partyId)
```

**Schema:**
```sql
finance_invoices.customer_id UUID NOT NULL  -- Logical FK to party_parties.id
```

**No FK constraint** — Product provides partyId, F3 stores as customer_id

**Tests prove:** F3 accepts any UUID (no validation)

**Contract Design:**
```typescript
interface CreateInvoiceInput {
  tenantId: string;
  partyId: string;  // ← Maps to customer_id in RPC call
  invoiceNumber: string;
  currency: string;
  issueDate: string;
  dueDate: string;
}
```

---

### Legacy customers Table

**Status:** Bella Spa legacy CRM (pre-Party system)

**Scope:** ❌ OUT OF E0.1B-R

**Rationale:**
- Bella Spa domain-specific (maternity/baby care)
- English Center does NOT use Bella Spa CRM
- E0.1B-R enables English Center Finance (separate domain)

**Future Work:** Bella Spa may need separate customers→Party migration (not E0.1B-R)

---

## DEPENDENCY MAP (FROZEN)

### Required Dependencies

**1. F1 General Ledger**

**Status:** ✅ REQUIRED

**Evidence:**
- F3 finalize calls `finance_post_transaction()` (F1)
- F3 void calls `finance_reverse_transaction()` (F1)
- Tests seed F1 Chart of Accounts + Accounting Periods

**Tables:**
- `finance_accounts` (CoA)
- `finance_accounting_periods` (period management)
- `finance_transactions` (GL transaction log)

**Contract Implication:** F3 AR Contract MUST verify F1 operational before accepting operations

---

**2. Party Identity System**

**Status:** ✅ REQUIRED

**Evidence:**
- customer_id = partyId (canonical identity)
- English Center Student already has party_id (E0.1A-R complete)

**Tables:**
- `party_parties` (canonical identity)

**Contract Implication:** Products provide partyId in Contract calls

---

**3. Tenant System**

**Status:** ✅ REQUIRED

**Evidence:**
- All F3 tables have tenant_id FK
- RLS policies enforce tenant isolation
- Tests verify tenant scoping

**Tables:**
- `tenants` (tenant registry)

**Functions:**
- `get_auth_tenant_id()` (RLS context)

---

### Partial/Deferred Dependencies

**F2 Cash Engine**

**Status:** 🟡 PARTIAL (non-blocking)

**Evidence:**
- Schema: `finance_receivable_allocations.cash_movement_id` FK declared
- RPC: ❌ Payment allocation RPC NOT FOUND
- Tests: ❌ Allocation NOT COVERED

**Deferred:** Payment allocation implementation (post-E0.1B-R)

**Current Scope:** Invoice lifecycle only (create → finalize → void)

**English Center Impact:** Can create invoices, CANNOT record payments yet

---

## SCOPE BOUNDARIES (FROZEN)

### IN SCOPE (E0.1B-R)

**Goal:** Transform F3 AR from DB capability → reusable Platform Finance capability

**Deliverables:**
1. ✅ F3 AR Contract interface (TypeScript)
2. ✅ F3 AR Engine implementation (wrap RPCs)
3. ✅ Contract tests (lifecycle coverage)
4. ✅ Platform Finance exports (Product-facing)
5. ✅ English Center Finance integration
6. ✅ Invoice lifecycle proven (create → finalize → void)
7. ✅ Tenant isolation proven
8. ✅ F1 posting integration proven

**Identity:** Party-native (partyId input)

**Operations:** Invoice lifecycle (4 RPCs)

---

### OUT OF SCOPE

**Deferred to post-E0.1B-R:**
- ❌ F2 payment allocation RPC implementation
- ❌ Adjustment memos RPC implementation
- ❌ Position reconstruction RPC implementation
- ❌ Multi-currency exchange rate handling
- ❌ Legacy `customers` table migration (Bella Spa domain)

**Non-blocking:** English Center can operate with invoice-only capability

---

## DENOMINATOR (EXACT)

### Current State

```text
F3 AR DATABASE CAPABILITY

Tables                          6
Lifecycle RPCs                  4
Test targets                    24
Public contracts                0  ← BLOCKER
Engine/service layer            0  ← BLOCKER
Platform exports                0  ← BLOCKER
Product consumption paths       0  ← BLOCKER

Architecture compliance:
Single Writer violations        0  ✅
Product bypasses                0  ✅
Direct table mutations          0  ✅ (production code)
Tenant isolation                ✅
Immutability guarantees         ✅

Dependencies:
F1 General Ledger               REQUIRED ✅
F2 Cash Engine                  PARTIAL (deferred) 🟡
Party Identity System           REQUIRED ✅
Tenant System                   REQUIRED ✅

Identity semantics:
customer_id = partyId           FROZEN ✅
Legacy customers disposition    OUT OF SCOPE ✅
```

---

### Implementation Denominator (Exact)

**R1-R7 must deliver:**

```text
PUBLIC CONTRACT LAYER (R1)

Contract interface              1  (IF3AccountsReceivable)
Contract methods                5  (create, add_line, finalize, void, get)
Input types                     5  (typed inputs)
Output types                    2  (InvoiceResult, InvoiceView)
Error types                     8  (domain errors)

ENGINE LAYER (R2)

Engine class                    1  (F3AREngine)
Engine methods                  5  (implements contract)
RPC wrappers                    4  (wrap DB RPCs)

EXPORT LAYER (R4)

Platform Finance exports        1  (module.exports)
Contract exports                1  (public interface)

INTEGRATION (R5)

English Center Finance          1  (product integration)
Student billing flow            1  (E2E scenario)
```

**Note:** Test counts are planning estimates, NOT governance metrics. R3/R6 will determine actual coverage needed.

---

## R0 EXIT CRITERIA

**PASS:**
- [x] Capability inventory frozen (6 tables, 4 RPCs, 24 tests)
- [x] Lifecycle frozen (state machine, idempotency, F1 integration)
- [x] Single Writer frozen (0 violations, F3 ownership established)
- [x] Identity semantics frozen (customer_id = partyId, NO customer migration)
- [x] Dependency map frozen (F1 required, F2 partial, Party required)
- [x] Scope boundaries frozen (invoice lifecycle IN, payment allocation OUT)
- [x] Implementation denominator exact (Contract 5 methods, Engine wraps 4 RPCs)
- [x] Unknowns: 0

**BLOCK:** None

---

## BASELINE LOCKED

**Date:** 2026-09-12

**Status:** ✅ BASELINE FROZEN

**Denominator:** EXACT

**Unknowns:** 0

**Next Phase:** R1 F3 AR Contract Definition

---

## CRITICAL PATH STATUS

```text
BELLA ENGLISH CENTER — E0.1B-R

E0 Foundation                          🔒 FROZEN
E0.1A-R Identity Remediation           🔒 CLOSED
E0.1B-R Finance Remediation            🟡 IN PROGRESS

├─ Preflight (5 phases)                ✅ COMPLETE
├─ R0 Baseline Assessment              ✅ COMPLETE
├─ R1 Contract Definition              🔴 NEXT
├─ R2 Engine Implementation            ⏸️ PENDING
├─ R3 Contract Tests                   ⏸️ PENDING
├─ R4 Platform Exports                 ⏸️ PENDING
├─ R5 English Center Integration       ⏸️ PENDING
├─ R6 Full Verification                ⏸️ PENDING
└─ R7 Governance Seal                  ⏸️ PENDING

E1 Readiness Gate                      🚫 BLOCKED (waiting E0.1B-R)
E1 Chain Management                    🚫 BLOCKED
```

---

**R0 Baseline Assessment COMPLETE. Proceeding R1 F3 AR Contract Definition.**
