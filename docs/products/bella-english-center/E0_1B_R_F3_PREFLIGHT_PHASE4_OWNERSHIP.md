# E0.1B-R F3 PREFLIGHT — PHASE 4: SINGLE WRITER OWNERSHIP

**Phase:** 4/5  
**Status:** ✅ **COMPLETE**  
**Date:** 2026-09-12

---

## SINGLE WRITER VERIFICATION

### Objective

Establish Platform F3 AR as canonical Single Writer for `finance_*` AR tables.

**Verification Criteria:**
1. No Product code directly mutates F3 tables
2. No Product code directly calls F3 RPCs (should use Contract when available)
3. Preschool P71 uses separate `edu_fin_*` domain (no F3 dependency)
4. F3 AR owns `finance_invoices` + 5 related tables exclusively

---

## VERIFICATION RESULTS

### 1. Product Code Analysis

**Search Pattern:** Product code directly accessing F3 tables or RPCs

**Searched:**
- `src/products/bella-english-center/**/*.ts`
- `src/products/bella-preschool/**/*.ts`
- `src/products/**/*.ts`

**Queries:**
```bash
# Search for edu_fin_invoices in English Center
grep -r "edu_fin_invoices" src/products/bella-english-center/

# Search for F3 RPC calls
grep -r "finance_create_draft_invoice|finance_finalize_invoice|finance_void_invoice" src/products/

# Search for finance_invoices table references
grep -r "finance_invoices" src/products/

# Search for direct INSERT/UPDATE
grep -r "INSERT INTO.*finance_invoices|UPDATE.*finance_invoices" src/products/
```

**Results:** ✅ **NO MATCHES**

**Verdict:** No Product code directly touches F3 AR tables or RPCs.

---

### 2. Preschool P71 Independence

**Search Pattern:** Verify P71 uses separate `edu_fin_*` tables

**Findings:**
- Preschool Product code: NOT FOUND in `src/products/bella-preschool/`
- P71 Finance schema: EXISTS in `supabase/migrations/20260909000058_p71_preschool_finance.sql`
- P71 tables: `edu_fin_*` (8 tables: fee_structures, billing_periods, invoices, payments, etc.)

**Schema Comparison:**

| Domain | Tables | Identity | Status |
|--------|--------|----------|--------|
| Platform F3 AR | `finance_invoices` + 5 | customer_id | Canonical |
| Preschool P71 | `edu_fin_invoices` + 7 | student_id + payer_party_id | Product-specific |

**Verdict:** ✅ P71 Finance is **separate domain** (no overlap with F3 AR).

---

### 3. Platform Finance Code Analysis

**Search Pattern:** Platform Finance code directly mutating tables (bypassing RPCs)

**Found:**
- `src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts` — Uses RPCs (no direct mutations in test logic)
- `src/platform/finance/__tests__/finance-f3-db-rls.test.ts` — Contains direct INSERT/UPDATE

**Context Analysis:**

**File:** `finance-f3-db-rls.test.ts`  
**Purpose:** Test RLS policies, immutability triggers, status transitions

**Direct mutations found:**
```typescript
// T02: Immutability verification
INSERT INTO finance_invoices ... (setup test data)
UPDATE finance_invoices SET status = 'FINALIZED' ... (test transition)
UPDATE finance_invoices SET total_invoice_amount_minor = 500000 ... (expect BLOCK)

// T03: Tenant isolation verification
INSERT INTO finance_invoices ... (setup multi-tenant data)

// T05: Authenticated role mutation blocked
INSERT INTO finance_invoices ... (expect BLOCK, verify RLS)

// T08: Status transition guard
UPDATE finance_invoices SET status = 'VOIDED' ... (expect BLOCK)
```

**Classification:** ✅ **TEST FIXTURES ONLY** (verifying database guards work)

**Verdict:** Direct mutations acceptable in tests (testing security/immutability enforcement).

---

### 4. F3 AR Ownership Boundary

**Owned by Platform F3 AR:**

**Tables:**
1. `finance_invoices` (invoice headers)
2. `finance_invoice_lines` (line items)
3. `finance_receivable_ledger` (immutable AR subledger log)
4. `finance_receivable_positions` (derived AR position cache)
5. `finance_receivable_allocations` (payment allocation log)
6. `finance_receivable_adjustments` (credit/debit memos)

**Operations:**
1. `finance_create_draft_invoice()` — Create DRAFT invoice
2. `finance_add_invoice_line()` — Add line items with rounding
3. `finance_finalize_invoice()` — Finalize + F1 accrual posting
4. `finance_void_invoice()` — Void + F1 reversal posting

**Mutation Path:**
```text
Product
   ↓ (NOT YET — Contract missing)
F3 AR Contract (TO BE IMPLEMENTED)
   ↓
F3 AR Engine (TO BE IMPLEMENTED)
   ↓
F3 RPCs (EXISTS)
   ↓
finance_* tables
```

**Current State:**
- Products: ❌ NO access path (Contract/Engine missing)
- Tests: ✅ Direct RPC calls (temporary, until Contract available)
- Production: 🚫 BLOCKED (no Product consumption yet)

---

## OWNERSHIP VIOLATIONS DETECTED

**Violation Count:** ✅ **ZERO**

**No violations found:**
- No Product code bypasses F3 RPCs
- No direct table mutations outside RPCs/tests
- Preschool P71 uses separate domain
- F3 AR Single Writer ownership intact

---

## ARCHITECTURAL DEPENDENCIES

### F3 AR Depends On:

**1. F1 General Ledger (finance_transactions)**
- Required: `finance_post_transaction()` RPC
- Required: `finance_reverse_transaction()` RPC
- Evidence: F3 finalize/void calls F1 posting operations

**2. F2 Cash Engine (cash_movements)**
- Required: `cash_movement_id` for payment allocation
- Evidence: `finance_receivable_allocations.cash_movement_id` FK
- Status: NOT TESTED (allocation operations not covered in F3 tests)

**3. Platform Tenant System (tenants)**
- Required: `tenants.id` FK for RLS
- Required: `get_auth_tenant_id()` function

---

## DEPENDENCY ANALYSIS

### F1 Integration Status

**Evidence:**
```typescript
// From finance-f3-invoice-lifecycle.test.ts
// beforeAll setup:
await pgClientAdmin.query(`
  INSERT INTO public.finance_accounts (tenant_id, code, name, type, normal_balance, currency, is_active) VALUES
  ('${testTenantId}', '131', 'Receivables Control', 'ASSET', 'DEBIT', 'VND', true),
  ('${testTenantId}', '5111', 'Revenue Packages', 'REVENUE', 'CREDIT', 'VND', true),
  ...
`);

await supabaseAdmin
  .from('finance_accounting_periods')
  .insert({
    tenant_id: testTenantId,
    name: '2026-08',
    period_start: '2026-08-01T00:00:00Z',
    period_end: '2026-08-31T23:59:59Z',
    status: 'OPEN'
  });
```

**Verdict:** F1 GL **required dependency** — F3 AR cannot operate without F1 Chart of Accounts + Accounting Periods.

---

### F2 Integration Status

**Evidence:**
- `finance_receivable_allocations.cash_movement_id UUID NOT NULL` (schema)
- NO tests cover payment allocation
- NO RPC found for `allocate_payment()`

**Verdict:** F2 Cash **declared dependency** (schema FK), but **integration incomplete** (no RPC, no tests).

---

## MISSING OPERATIONS

**Identified gaps in F3 AR operational coverage:**

1. **Payment Allocation**
   - Schema: `finance_receivable_allocations` table exists
   - RPC: NOT FOUND (`finance_allocate_payment()` missing)
   - Tests: NOT COVERED

2. **Adjustment Memos**
   - Schema: `finance_receivable_adjustments` table exists
   - RPC: NOT FOUND (`finance_create_adjustment()` missing)
   - Tests: NOT COVERED

3. **Position Reconstruction**
   - Schema: `finance_receivable_positions.last_reconstructed_at` suggests periodic rebuild
   - RPC: NOT FOUND (`finance_reconstruct_position()` missing)
   - Tests: NOT COVERED

**Implication:** F3 AR is **invoice lifecycle complete**, but **payment allocation incomplete**.

---

## PHASE 4 EXIT CRITERIA

**PASS:**
- [x] No Product code bypasses F3 tables
- [x] No Product code directly calls F3 RPCs (no Contract available yet)
- [x] Preschool P71 verified separate (edu_fin_* domain)
- [x] F3 AR Single Writer ownership established
- [x] F1/F2 dependencies documented
- [x] Missing operations identified

**BLOCK:** None

---

## SINGLE WRITER VERDICT

**Status:** ✅ **ESTABLISHED**

**Owner:** Platform Finance F3 AR

**Boundary:** `finance_invoices` + 5 related tables

**Mutation Path:** Products → Contract (missing) → Engine (missing) → RPCs (exists) → Tables

**Violations:** ZERO

**Dependencies:** F1 GL (required), F2 Cash (partial)

**Missing Operations:** Payment allocation, adjustment memos, position reconstruction

---

**Phase 4 complete. Proceeding Phase 5: Customer Semantic Reconciliation (final preflight phase).**
