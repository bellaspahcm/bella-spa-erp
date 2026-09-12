# R5 English Center Integration — COMPLETION REPORT

**Phase**: E0.1B-R Finance Remediation R5  
**Status**: ✅ COMPLETE  
**Date**: 2026-09-12  
**Duration**: ~30 minutes

---

## Summary

R5 proves **English Center can consume Platform Finance F3 AR via public contract**. Billing flow works end-to-end: enrollment → invoice creation → finalization → F1 posting.

**Key Achievement**: English Center billing **does NOT access** `finance_*` tables or RPCs directly — all operations go through `@/platform/finance` public API.

---

## Deliverables

### English Center Billing Service

**File**: `src/products/bella-english-center/billing/ar-service.ts` (157 lines)

**Responsibilities**:
- Orchestrate invoice creation for enrollments
- Map English Center context → Platform Finance contract
- Handle course fees, materials, tax rates
- Support void operations (enrollment cancellations)

**Import Pattern**:
```typescript
import {
  createF3AREngine,
  IF3AccountsReceivable,
  CreateInvoiceInput,
  InvoiceResult,
  InvoiceView
} from '@/platform/finance';  // ← Public Platform API ONLY
```

**Key Methods**:
```typescript
async createEnrollmentInvoice(params: CreateEnrollmentInvoiceParams): Promise<InvoiceResult>
async getEnrollmentInvoice(tenantId: string, invoiceId: string): Promise<InvoiceView>
async voidEnrollmentInvoice(tenantId: string, invoiceId: string): Promise<InvoiceResult>
```

### Billing Flow

```
English Center Enrollment Context
        ↓
EnglishCenterBillingService
        ↓
createF3AREngine()
        ↓
Platform Finance F3 AR Contract
        ↓
createDraftInvoice()
        ↓
addInvoiceLine() (tuition)
        ↓
addInvoiceLine() (materials, optional)
        ↓
finalizeInvoice()
        ↓
F1 GL Posting (automatic)
        ↓
AR Subledger + Position (automatic)
```

---

## Test Results

### Unit Tests (Mocked Engine)

**File**: `src/products/bella-english-center/billing/__tests__/ar-service.test.ts`

```
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Time:        0.589 s
```

**Coverage**:
| Test Suite | Tests | Status |
|------------|-------|--------|
| createEnrollmentInvoice | 3 | ✅ PASS |
| getEnrollmentInvoice | 1 | ✅ PASS |
| voidEnrollmentInvoice | 1 | ✅ PASS |
| **Total** | **5** | **✅ 5/5** |

**Evidence**:
- ✅ Invoice created with tuition + materials lines
- ✅ Invoice created with tuition only (no materials)
- ✅ partyId propagated correctly (NOT customer_id)
- ✅ Invoice view retrieved
- ✅ Invoice voided successfully

### Integration Tests (Real Platform Finance)

**File**: `src/products/bella-english-center/billing/__tests__/ar-service.integration.test.ts`

```
Test Suites: 1 passed, 1 total
Tests:       6 passed, 6 total
Time:        11.457 s
```

**Coverage**:
| Test Suite | Tests | Status |
|------------|-------|--------|
| R5.1: Enrollment Invoice Creation | 2 | ✅ PASS |
| R5.2: Get Invoice View | 1 | ✅ PASS |
| R5.3: Void Enrollment Invoice | 1 | ✅ PASS |
| R5.4: Ownership Boundary Compliance | 2 | ✅ PASS |
| **Total** | **6** | **✅ 6/6** |

**Evidence**:
- ✅ End-to-end invoice creation via Platform Finance
- ✅ Invoice finalized successfully
- ✅ F1 GL transaction created (status: POSTED)
- ✅ F1 transaction lines created (DR: 131, CR: 5111/5112/3331)
- ✅ AR subledger entry created (DEBIT_ACCRUAL)
- ✅ AR position created (outstanding > 0)
- ✅ Invoice retrieved with header + lines + position
- ✅ Invoice voided with F1 reversal
- ✅ NO direct `finance_*` table access from Product code
- ✅ NO direct F3 RPC calls from Product code
- ✅ partyId propagated (customer_id internal only)

### Build Verification

```bash
npm run build
Exit Code: 0
```

---

## R5 Exit Criteria — ALL MET

```
✅ EnglishCenterBillingService created
✅ Uses public '@/platform/finance' import only
✅ Direct finance_* table access = 0
✅ Direct F3 RPC calls = 0

✅ partyId → F3 (Party-native identity)
✅ tenantId → F3 (tenant isolation)
✅ DRAFT invoice created
✅ Invoice lines added (tuition + materials)
✅ Finalize succeeds
✅ F1 posting observed (transaction + ledger + position)
✅ getInvoice reconciliation

✅ Build PASS
✅ Unit tests: 5/5 PASS
✅ Integration tests: 6/6 PASS

✅ English Center does NOT call finance_* tables directly
✅ English Center does NOT call F3 RPCs directly
✅ English Center does NOT call P71 Product tables
✅ Platform Finance owns invoice lifecycle
✅ Platform Finance owns F1 posting
```

---

## Ownership Boundaries (Verified)

### English Center Owns

**Business Logic**:
- Course fee policy (pricing, discounts)
- Materials fee calculation
- Tax rate determination
- Enrollment → Invoice context mapping
- Invoice number format (`ENR-{enrollmentId}`)

**Product Code**:
- `src/products/bella-english-center/billing/ar-service.ts`
- Billing orchestration
- Commercial terms (installments, discounts — deferred to E1.1)

### Platform Finance Owns

**Financial Capabilities**:
- Invoice identity (invoice_id)
- Invoice lifecycle (DRAFT → FINALIZED → VOIDED)
- Receivable position management
- Accounting posting (F1 GL transactions)
- Financial audit trail

**Platform Code**:
- `src/platform/finance/contracts/f3-ar.contract.ts`
- `src/platform/finance/engines/f3-ar-engine.ts`
- F3 DB schema (`finance_invoices`, `finance_invoice_lines`)
- F3 RPCs (`finance_create_draft_invoice`, etc.)

---

## Integration Evidence

### Invoice Creation Flow

**1. English Center creates invoice**:
```typescript
const result = await service.createEnrollmentInvoice({
  tenantId: 'tenant-123',
  enrollmentId: 'enr-001',
  studentPartyId: 'party-456',  // ← Party-native identity
  courseId: 'COURSE-A1',
  courseName: 'English Elementary A1',
  courseFeeMinor: 5000000,  // 5,000,000 VND
  materialsFeeMinor: 500000,  // 500,000 VND
  taxRate: 0.1,  // 10% VAT
  startDate: '2026-09-01',
  paymentDueDate: '2026-09-15'
});
```

**2. Platform Finance processes**:
- Creates DRAFT invoice (`ENR-enr-001`)
- Adds tuition line (5,000,000 VND → account 5111)
- Adds materials line (500,000 VND → account 5112)
- Finalizes invoice → triggers F1 posting

**3. F1 GL Posting (automatic)**:
```
DR: Receivables Control (131)        6,050,000 VND
CR: Revenue Packages (5111)           5,000,000 VND
CR: Revenue Retail (5112)               500,000 VND
CR: VAT Payable (3331)                  550,000 VND
```

**4. AR Subledger (automatic)**:
- Entry type: DEBIT_ACCRUAL
- Amount: 6,050,000 VND
- Linked to invoice + F1 transaction

**5. AR Position (automatic)**:
- Original amount: 6,050,000 VND
- Outstanding amount: 6,050,000 VND
- Allocated: 0 (payment allocation deferred)

### Verification Queries

**Invoice persisted**:
```sql
SELECT * FROM finance_invoices
WHERE invoice_number = 'ENR-enr-001'
  AND status = 'FINALIZED'
  AND customer_id = 'party-456';
```

**F1 transaction created**:
```sql
SELECT * FROM finance_transactions
WHERE id = <f1TransactionId>
  AND status = 'POSTED';
```

**AR position created**:
```sql
SELECT * FROM finance_receivable_positions
WHERE invoice_id = <invoiceId>
  AND customer_id = 'party-456'
  AND outstanding_amount_minor > 0;
```

---

## Code Compliance

### NO Direct DB Access

**Verified by inspection** (`ar-service.ts`):
```typescript
// ✅ ALLOWED
import { createF3AREngine } from '@/platform/finance';

// ❌ NOT FOUND (compliance verified)
// import { supabase } from '@/lib/supabase';
// .from('finance_invoices')
// .from('finance_invoice_lines')
// .from('finance_receivable_ledger')
// .from('finance_receivable_positions')
```

### NO Direct RPC Calls

**Verified by code inspection**:
```typescript
// ✅ ALLOWED
await arEngine.createDraftInvoice({ ... });
await arEngine.addInvoiceLine({ ... });
await arEngine.finalizeInvoice({ ... });

// ❌ NOT FOUND (compliance verified)
// .rpc('finance_create_draft_invoice')
// .rpc('finance_add_invoice_line')
// .rpc('finance_finalize_invoice')
```

### Party-Native Identity

**Product sees `partyId` only**:
```typescript
const view = await service.getEnrollmentInvoice(tenantId, invoiceId);
expect(view.header.partyId).toBe('party-456');
expect((view.header as any).customer_id).toBeUndefined();  // ✅ NOT exposed
```

**Platform maps internally**:
```sql
-- finance_invoices.customer_id = party-456 (internal mapping)
```

---

## Deferred Scope (Out of R5)

**NOT Implemented**:
- ❌ Payment allocation (F2 Cash incomplete)
- ❌ Adjustment memos (F2 Cash incomplete)
- ❌ Installment scheduling (E1.1 Chain Management scope)
- ❌ Discount engine (E1.1 Chain Management scope)
- ❌ Invoice templates/printing (E1.4 UI scope)
- ❌ Student billing portal (E1.4 UI scope)

**Why Deferred**:
- F2 Cash Payment Allocation not complete (P0 dependency for R5)
- Commercial terms (discounts, installments) belong to E1.1
- R5 proves **contract works**, not full feature coverage

---

## Files Created

### Product Code
- `src/products/bella-english-center/billing/ar-service.ts` (157 lines)
  - EnglishCenterBillingService class
  - createEnrollmentInvoice, getEnrollmentInvoice, voidEnrollmentInvoice
  - Uses Platform Finance public API only

### Tests
- `src/products/bella-english-center/billing/__tests__/ar-service.test.ts` (158 lines)
  - 5/5 unit tests PASS (mocked engine)
  
- `src/products/bella-english-center/billing/__tests__/ar-service.integration.test.ts` (344 lines)
  - 6/6 integration tests PASS (real Platform Finance)

### Documentation
- `docs/products/bella-english-center/R5_SCOPE.md` (frozen scope)
- `docs/products/bella-english-center/R5_COMPLETION_REPORT.md` (this document)

---

## Lessons Learned

### 1. Public API Imports Enforce Ownership

**Principle**: Product code importing from `@/platform/finance` only **prevents** direct DB/RPC access at compile time.

**Evidence**: Test verifies NO `finance_*` strings in Product code.

### 2. Integration Tests Verify Real Behavior

**Principle**: Unit tests prove logic; integration tests prove Platform compatibility.

**Evidence**: 6 integration tests verify F1 side effects (transactions, ledger, positions) with real DB.

### 3. Party-Native Identity Works End-to-End

**Principle**: Product uses `partyId`, Platform maps to `customer_id` internally.

**Evidence**: 
```typescript
// Product sees
view.header.partyId  // ← Party ID

// DB stores
finance_invoices.customer_id  // ← Same value, internal mapping
```

### 4. Deferred Scope Prevents Scope Creep

**Principle**: R5 proves **contract works**, not feature completeness.

**Why**: Payment allocation, discounts, installments belong to later phases (E1.1, F2 Cash).

---

## Next Steps

### R6: Full Verification ⏸️

**Goal**: Comprehensive evidence seal for Finance Remediation.

**Scope**:
- Contract coverage: 5/5 methods ✅
- RPC wrappers: 4/4 ✅
- Engine unit tests: 14/14 PASS ✅
- Engine integration tests: 14/14 PASS ✅
- Public exports: 10/10 PASS ✅
- **English Center integration: 5/5 unit + 6/6 integration PASS** ✅
- Total test coverage: 49/49 PASS
- Architecture compliance report
- Ownership boundaries verified
- No Product→Product coupling

**Exit Criteria**:
```
✅ All Finance tests PASS (49/49)
✅ Build PASS
✅ Architecture compliance verified
✅ Ownership boundaries documented
✅ No architectural gaps
✅ Evidence denominator complete
```

### R7: Evidence Seal ⏸️

**Goal**: Freeze F3 AR Contract + Engine as Platform capability.

**Scope**:
- Contract interface immutable (v1.0.0)
- Engine internals allowed to evolve
- Versioning policy defined
- Governance: Platform Finance ownership
- Deprecation policy: breaking changes require major version bump

### E1 Readiness Gate ⏸️

**Goal**: Verify English Center E1 can proceed safely.

**Blockers**:
- ✅ R5: English Center billing integration COMPLETE
- ⏸️ R6: Full verification
- ⏸️ R7: Evidence seal

**Exit Criteria**:
- Identity remediation: SEALED ✅
- Finance remediation: SEALED (after R6→R7)
- E1.1 Chain Management: billing flow proven ✅
- E1.2–E1.6: unblocked
- No architectural gaps remain

---

## Canonical Status

```
E0.1B-R FINANCE REMEDIATION

R0 Baseline               🔒 FROZEN
R1 Contract               🔒 SEALED
R2 Engine                 🔒 SEALED
R3 Runtime Integration    🔒 SEALED (14/14 PASS)
R4 Platform Exports       🔒 SEALED (10/10 PASS)
R5 English Integration    🔒 SEALED (5/5 unit + 6/6 integration PASS)
R6 Full Verification      🟢 AUTHORIZED
R7 Evidence Seal          ⏸️ BLOCKED (R6)

English Center E1         🚫 BLOCKED (R6→R7→Readiness Gate)
```

**Critical Path**: R6 → R7 → E1 Readiness Gate → E1 Authorized

---

**R5 EVIDENCE SEAL**: English Center billing consumes Platform Finance F3 AR via public contract — NO direct DB/RPC access.

**Denominator Governance**:
- English Center billing service: 1/1 created
- Unit tests: 5/5 PASS
- Integration tests: 6/6 PASS
- Build: PASS
- Ownership compliance: verified
- Total R5 verification: 11/11 ✅

**Authorization**: Proceed R6 Full Verification.
