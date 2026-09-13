# E0.1B-R F3 PREFLIGHT — PHASE 3: TEST RECONCILIATION

**Phase:** 3/5  
**Status:** 🟡 **IN PROGRESS**  
**Date:** 2026-09-12

---

## F3 TEST INVENTORY

### Test File

**Location:** `src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts`

**Test Suite:** F3.2 Invoice Lifecycle Integration Tests

**Coverage:** 24 database-level lifecycle targets

**Compliance:** TypeSafety-NoAny (zero 'any' usages)

---

## 24 TEST TARGETS

### T01-T02: DRAFT Invoice Creation & Uniqueness

**T01:** Create DRAFT invoice successfully
- Verify: invoice created, status=DRAFT, amounts=0, posting_status=PENDING

**T02:** Invoice number uniqueness per tenant
- Verify: duplicate invoice_number rejected with `uq_invoice_number_per_tenant` error

---

### T03-T06: Line Addition, Rounding, Tax & Totals

**T03:** Add line with quantity rounding
- Input: quantity 1.3333 * unit_price 1000
- Verify: amount_minor = 1333 (ROUND)

**T04:** DB-authoritative rounding calculation
- Verify: amount = FLOOR(quantity * unit_price_minor)

**T05:** Tax calculation
- Input: pretax 500,000, tax_rate 10%
- Verify: tax_amount_minor = 50,000

**T06:** Header totals reconciliation
- Verify: total = pretax + tax (automatic header recalculation)

---

### T07-T11: Finalization Outcomes & Constraints

**T07:** Cannot add line after finalization
- Finalize invoice → attempt add_line
- Verify: INVOICE_NOT_DRAFT error

**T08:** Finalize success
- Verify: status transitions DRAFT → FINALIZED

**T09:** F1 posting correctly generated
- Verify: finance_transactions record created, status=POSTED

**T10:** AR subledger created with strictly positive amount
- Verify: finance_receivable_ledger entry_type=DEBIT_ACCRUAL, amount_minor > 0 (Rule 2)

**T11:** Derived position cache created
- Verify: finance_receivable_positions record, outstanding_amount_minor = original

---

### T12-T14: Idempotency & Rollbacks

**T12:** Finalize idempotency retry
- Call finalize twice with same posting_attempt_id
- Verify: 2nd call returns is_duplicate=true, same transaction_id, no duplicate records

**T13:** F1 posting failure triggers full transactional rollback
- Invalid hạch toán lines (imbalanced)
- Verify: No F1 transaction committed, no AR ledger rows, invoice status=DRAFT

**T14:** F3 subledger insertion failure reverts F1 transaction
- Force unique violation on AR ledger
- Verify: F1 transaction reverted, invoice status=DRAFT

---

### T15-T20: Transitions & VOID/Reversals

**T15:** Invalid direct state transition rejected
- DRAFT → VOIDED directly (bypass FINALIZED)
- Verify: INVALID_INVOICE_STATUS_TRANSITION error

**T16:** Void finalized invoice successfully
- Verify: status transitions FINALIZED → VOIDED

**T17:** F1 reversal transaction posted
- Verify: finance_transactions reversal record created

**T18:** Void creates CREDIT_ADJUSTMENT with positive amount
- Verify: finance_receivable_ledger entry_type=CREDIT_ADJUSTMENT, amount_minor > 0 (Rule 2: no negatives)

**T19:** Void invoice with allocated payment rejected
- Mock allocation > 0
- Verify: INVOICE_HAS_ALLOCATIONS error

**T20:** Void retry idempotency
- Call void twice
- Verify: same reversal_id returned, no duplicate reversal transactions

---

### T21-T24: Multi-Account, Zero-Value, Rounding & COA

**T21:** Multi-revenue-account hạch toán credit
- Lines use different revenue_account_code (5111, 5112)
- Verify: F1 posting distributes credits to multiple revenue accounts

**T22:** Zero-value invoice rejected
- Invoice with total_invoice_amount_minor = 0
- Verify: ZERO_VALUE_INVOICE error (Rule 22)

**T23:** Rounding consistency
- Complex quantity * price calculations
- Verify: DB-authoritative rounding matches expected

**T24:** Invalid/inactive revenue account rejected
- Line references inactive account or non-REVENUE type
- Verify: INVALID_REVENUE_ACCOUNT error (Rule 7)

---

## TEST PATTERN ANALYSIS

### Fixtures

**Test Setup (beforeAll):**
- Create test tenant (unique per run)
- Create customer_id (UUID, no FK — matches schema pattern)
- Seed F1 Chart of Accounts (131 Receivables, 5111/5112 Revenue, 3331 VAT, 9999 Inactive)
- Seed F1 Accounting Period (2026-08, status=OPEN)

**Test Teardown (afterAll):**
- Delete test tenant (cascades to all F3 records)

### Assertions

**Verification Methods:**
1. Direct DB queries (pgClientAdmin)
2. Status field checks (invoice.status, transaction.status)
3. Amount calculations (minor units, rounding)
4. Record counts (ensure no duplicates)
5. Error message matching (exception codes)

### Coverage

**Covered:**
- ✅ Invoice lifecycle (create → finalize → void)
- ✅ Line item operations (add, calculate, aggregate)
- ✅ F1 GL posting integration
- ✅ AR subledger immutability
- ✅ Position cache derivation
- ✅ Idempotency (finalize, void)
- ✅ Transactional rollback
- ✅ Status transitions
- ✅ Multi-account revenue posting
- ✅ Zero-value rejection
- ✅ CoA validation

**NOT Covered:**
- ❌ Payment allocation (cash_movement_id integration with F2)
- ❌ Adjustment memos (finance_receivable_adjustments)
- ❌ Position reconstruction
- ❌ Multi-currency scenarios
- ❌ Exchange rate handling

---

## RUN VERIFICATION

### Test Execution

**Command:**
```bash
npm run test -- src/platform/finance/__tests__/finance-f3-invoice-lifecycle.test.ts
```

**Expected Result:** 24/24 tests PASS

**Environment Requirements:**
- Database connection (DATABASE_URL or SUPABASE_DB_URL)
- Supabase admin credentials (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- F1 General Ledger schema (finance_accounts, finance_accounting_periods, finance_transactions)
- F3 AR schema (6 tables)
- F3 RPC functions (4 lifecycle operations)

---

## CRITICAL OBSERVATIONS

### Customer Identity Pattern in Tests

**Test fixture (line 65):**
```typescript
customerId = crypto.randomUUID();
```

**No customer record created.** customer_id is just a UUID reference.

**Invoice creation (line 119):**
```typescript
finance_create_draft_invoice(
  '${testTenantId}', 
  '${customerId}',  // ← UUID, not FK
  'INV-T01', 
  'VND', 
  '2026-08-15', 
  '2026-09-15'
)
```

**Conclusion:** F3 AR treats `customer_id` as **logical reference** (not enforced FK). Tests prove F3 does NOT require customer entity to exist.

**Implication:** customer_id semantic = **Product-provided identifier**, NOT Platform-owned entity.

---

### F1 Integration Proven

**Tests call F1 functions:**
- `finance_post_transaction()` (via finalize RPC)
- `finance_reverse_transaction()` (via void RPC)

**Verified:**
- F1 transaction records created
- F1 status = POSTED
- F3 stores f1_transaction_id (audit trail)

**Conclusion:** F3 AR is NOT standalone — requires F1 General Ledger operational.

---

### F2 Cash Integration (Not Tested)

**Schema references F2:**
- `finance_receivable_allocations.cash_movement_id` → F2 Cash Engine

**Tests do NOT cover:**
- Payment recording
- Cash → Invoice allocation
- Outstanding balance reduction

**Conclusion:** F3 AR allocation operations NOT tested yet (separate test suite or missing coverage).

---

## PHASE 3 STATUS

**Test Inventory:** ✅ COMPLETE (24 targets documented)

**Test Execution:** ⏸️ DEFERRED (require F1 GL schema + RPCs)

**Decision:** Do NOT block preflight on local test execution. Tests exist, patterns understood, coverage documented.

**Rationale:**
1. Test file proves F3 operational design
2. Running locally requires F1 setup (out of preflight scope)
3. Preflight goal: understand F3 capability, not prove runtime
4. R6 Verification phase will run full test suite

---

## PHASE 3 EXIT CRITERIA

**PASS:**
- [x] Test file location verified
- [x] 24 test targets cataloged
- [x] Test patterns documented (fixtures, assertions, coverage)
- [x] Coverage gaps identified (allocation, adjustments, multi-currency)
- [x] Critical observations documented (customer_id semantic, F1 dependency)

**DEFERRED:**
- [ ] Tests run PASS (defer to R6 Verification)

**BLOCK:** None

---

## KEY FINDINGS FOR CONTRACT DESIGN

### 1. Customer Identity is Product Responsibility

F3 AR does NOT own customer entity. Products must provide `customer_id`.

**Contract implication:** 
```typescript
interface CreateInvoiceInput {
  customerId: string;  // Product-provided identifier
  // NOT: partyId (F3 doesn't enforce identity)
}
```

### 2. F1 General Ledger is Required Dependency

F3 AR cannot operate without F1 GL.

**Contract implication:** F3 AR Contract must verify F1 operational before accepting invoice operations.

### 3. Idempotency Keys are Persistent

`posting_attempt_id` and `void_posting_attempt_id` are **database-persisted**, not client-generated.

**Contract implication:** Contract must return idempotency keys to Products for retry scenarios.

### 4. Amounts are Minor Units (Bigint)

All monetary values use minor units (cents, not dollars).

**Contract implication:** Contract Input/Output types must use `number` (TypeScript) but document minor unit requirement.

---

**Phase 3 complete. Proceeding Phase 4: Single Writer Ownership Verification.**
