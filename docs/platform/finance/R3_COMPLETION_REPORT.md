# R3 Runtime Integration Tests — COMPLETION REPORT

**Phase**: E0.1B-R Finance Remediation R3  
**Status**: ✅ COMPLETE  
**Date**: 2026-09-12  
**Duration**: ~4 hours (blocked → unblocked → 14/14 PASS)

---

## Summary

R3 Runtime Integration Tests verify that **F3 AR Contract works with deployed F3 schema/RPCs using real database**. All 14 tests PASS, proving:

1. ✅ Real RPC calls succeed (no signature mismatches)
2. ✅ F1 side effects verified (transactions, ledger, positions)
3. ✅ Party validation enforced (exists + tenant isolation)
4. ✅ Typed errors match actual DB behavior
5. ✅ Idempotency works (finalize retry returns success)
6. ✅ customer_id → partyId mapping transparent to Product

---

## Test Results

### R3.1: createDraftInvoice Runtime ✅

```
✓ should create DRAFT invoice with real RPC (339ms)
✓ should reject invalid Party (does not exist) (156ms)
✓ should reject duplicate invoice number (1207ms)
```

**Evidence**:
- DRAFT invoice persisted in `finance_invoices`
- `customer_id` stored as `partyId` (Party-native identity)
- Duplicate invoice number blocked (F3InvoiceNumberDuplicateError)
- Non-existent Party blocked (F3InvalidInputError)

### R3.2: addInvoiceLine Runtime ✅

```
✓ should add line and update header totals (369ms)
✓ should reject adding line to non-existent invoice (129ms)
```

**Evidence**:
- Line persisted in `finance_invoice_lines`
- Header totals updated (`total_pretax_amount_minor`, `tax_amount_minor`, `total_invoice_amount_minor`)
- Non-existent invoice blocked

### R3.3: finalizeInvoice Runtime ✅

```
✓ should finalize invoice and create F1 transaction (1095ms)
✓ should reject finalizing empty invoice (390ms)
✓ should be idempotent (retry returns success) (338ms)
```

**Evidence**:
- Invoice status → FINALIZED
- F1 transaction created in `finance_transactions` (status: POSTED)
- AR subledger entry created (`finance_receivable_ledger`, type: DEBIT_ACCRUAL)
- AR position created (`finance_receivable_positions`, outstanding > 0)
- Empty invoice blocked (F3InvoiceEmptyError)
- **Idempotency**: Retry returns existing `f1TransactionId` with `isDuplicate: true` (no duplicate transactions)

### R3.4: voidInvoice Runtime ✅

```
✓ should void finalized invoice and create F1 reversal (897ms)
✓ should reject voiding DRAFT invoice (563ms)
```

**Evidence**:
- Invoice status → VOIDED
- F1 reversal transaction created (status: POSTED)
- AR subledger entry created (type: CREDIT_ADJUSTMENT)
- AR position outstanding → 0
- DRAFT invoice void blocked (F3InvoiceNotFinalizedError)

### R3.5: getInvoice Runtime ✅

```
✓ should retrieve invoice with header + lines (253ms)
✓ should include AR position for finalized invoice (935ms)
```

**Evidence**:
- Header + lines retrieved correctly
- `customer_id` mapped to `partyId` (NOT exposed to Product)
- AR position included for FINALIZED invoices
- AR position undefined for DRAFT invoices

### R3.6: Party + Tenant Isolation ✅

```
✓ should reject Party from different tenant (98ms)
```

**Evidence**:
- Cross-tenant Party usage blocked (F3InvalidInputError)
- Tenant isolation enforced at Engine validation layer

### R3.7: Typed Error Mapping ✅

```
✓ should throw F3InvoiceNotDraftError when adding line to finalized invoice (200ms)
```

**Evidence**:
- Wrong lifecycle transition blocked
- Typed error `F3InvoiceNotDraftError` thrown with code `F3003`
- Error messages match actual DB/RPC behavior

---

## Technical Implementation

### Refactoring: Supabase Client Only

**Problem**: Initial test used `pg` Client requiring `DATABASE_URL` (postgres password).

**Solution**: Refactored to use **Supabase Client exclusively** (service_role bypasses RLS):

```typescript
// BEFORE: Required PG Client
import { Client } from 'pg';
const pgClient = new Client({ connectionString: dbUrl });
await pgClient.query('INSERT INTO finance_accounts ...');

// AFTER: Supabase Client only
const { error } = await supabaseAdmin
  .from('finance_accounts')
  .insert({ ... });
```

**Benefits**:
- No raw Postgres connection needed
- Service role key sufficient (already in `.env.test`)
- Simpler test setup (no connection string management)
- Consistent with Engine implementation pattern

### Environment Configuration

**`.env.test` fixes**:

1. ✅ `SUPABASE_SECRET_KEY` = `SUPABASE_SERVICE_ROLE_KEY` (was placeholder)
2. ✅ Removed PG Client dependency (DATABASE_URL not needed)

### Schema Alignment

**Party table**: Uses soft-delete pattern (`deleted_at`), not `is_active`:

```typescript
// WRONG
party_type: 'PERSON',  // ← CHECK constraint: lowercase only
is_active: true        // ← Column does not exist

// CORRECT
party_type: 'person',  // ← lowercase per CHECK constraint
// is_active removed (uses deleted_at)
```

### Idempotency Fix

**Engine enhancement**: `finalizeInvoice` now returns idempotent result instead of throwing error:

```typescript
// Check if already FINALIZED before enforcing DRAFT-only rule
if (invoice.status === 'FINALIZED') {
  return {
    invoiceId: input.invoiceId,
    status: 'FINALIZED',
    totalInvoiceAmountMinor: invoice.totalInvoiceAmountMinor,
    f1TransactionId: invoice.f1TransactionId || undefined,
    isDuplicate: true  // ← Signal to caller
  };
}
```

---

## Files Modified

### Integration Test
- `src/platform/finance/engines/__tests__/f3-ar-engine.integration.test.ts` (691 lines)
  - Removed `pg` Client dependency
  - Fixed Party schema (lowercase type, no is_active)
  - All 14 tests PASS

### Engine (Idempotency)
- `src/platform/finance/engines/f3-ar-engine.ts`
  - Added idempotency check in `finalizeInvoice()`
  - Returns existing result if already FINALIZED

### Environment
- `.env.test`
  - Fixed `SUPABASE_SECRET_KEY` (was placeholder)
  - Clarified DATABASE_URL not needed for integration tests

---

## Verification Evidence

### Test Execution

```bash
npm run test -- src/platform/finance/engines/__tests__/f3-ar-engine.integration.test.ts --runInBand

Test Suites: 1 passed, 1 total
Tests:       14 passed, 14 total
Time:        14.17 s
```

### Test Coverage

| Suite | Tests | Status | Runtime |
|-------|-------|--------|---------|
| R3.1 createDraftInvoice | 3 | ✅ PASS | ~1.7s |
| R3.2 addInvoiceLine | 2 | ✅ PASS | ~0.5s |
| R3.3 finalizeInvoice | 3 | ✅ PASS | ~1.8s |
| R3.4 voidInvoice | 2 | ✅ PASS | ~1.5s |
| R3.5 getInvoice | 2 | ✅ PASS | ~1.2s |
| R3.6 Party/tenant | 1 | ✅ PASS | ~0.1s |
| R3.7 Typed errors | 1 | ✅ PASS | ~0.2s |
| **Total** | **14** | **✅ 14/14** | **~14s** |

### Database Side Effects Verified

**F1 GL Integration**:
- ✅ `finance_transactions` created (status: POSTED)
- ✅ `finance_transaction_lines` created (DR: 131, CR: 5111/5112/3331)
- ✅ `finance_receivable_ledger` entries (DEBIT_ACCRUAL, CREDIT_ADJUSTMENT)
- ✅ `finance_receivable_positions` updated (outstanding amounts)

**F3 AR State**:
- ✅ `finance_invoices` status transitions (DRAFT → FINALIZED → VOIDED)
- ✅ `finance_invoice_lines` persisted with correct totals
- ✅ `posting_attempt_id` used for idempotency
- ✅ `f1_transaction_id` foreign key set

**Party Validation**:
- ✅ Non-existent Party blocked
- ✅ Cross-tenant Party blocked
- ✅ `customer_id = partyId` enforced

---

## R3 Exit Criteria — ALL MET

```
✅ 14/14 integration tests PASS
✅ Real RPC calls succeed
✅ F1 side effects verified
✅ Party validation enforced
✅ Tenant isolation enforced
✅ Typed errors match actual DB behavior
✅ No schema/RPC signature mismatches
✅ Idempotency proven (finalize retry works)
✅ customer_id → partyId mapping transparent to Product
✅ No direct table access from Product code
```

---

## Blockers Resolved

### Blocker 1: Database Connection ❌→✅

**Problem**: `getaddrinfo ENOTFOUND base` (invalid DATABASE_URL)

**Root Cause**: Test used `pg` Client requiring Postgres password

**Solution**: Refactored to Supabase Client only (service_role sufficient)

### Blocker 2: Invalid API Key ❌→✅

**Problem**: `Invalid API key` error

**Root Cause**: `.env.test` had `SUPABASE_SECRET_KEY=placeholder`

**Solution**: Set `SUPABASE_SECRET_KEY = SUPABASE_SERVICE_ROLE_KEY`

### Blocker 3: Schema Mismatch ❌→✅

**Problem**: `Could not find 'is_active' column of 'party_parties'`

**Root Cause**: Party table uses `deleted_at` soft-delete, not `is_active`

**Solution**: Fixed test inserts (`party_type: 'person'`, removed `is_active`)

### Blocker 4: Idempotency Test Failure ❌→✅

**Problem**: `finalizeInvoice` retry threw `F3InvoiceNotDraftError`

**Root Cause**: Engine enforced DRAFT-only without idempotency check

**Solution**: Check if already FINALIZED before throwing, return existing result

---

## Next Steps

### R4: Platform Exports ⏸️

**Goal**: Export `IF3AccountsReceivable` contract + `createF3AREngine()` factory for Product consumption.

**Scope**:
```typescript
// src/platform/finance/index.ts
export {
  IF3AccountsReceivable,
  createF3AREngine
} from './engines/f3-ar-engine';

export type {
  CreateInvoiceInput,
  AddInvoiceLineInput,
  FinalizeInvoiceInput,
  VoidInvoiceInput,
  GetInvoiceInput,
  InvoiceResult,
  InvoiceView
} from './contracts/f3-ar.contract';
```

**Exit Criteria**:
- Public API surface frozen
- No leakage of RPC/table names
- TypeScript exports verified
- Build PASS

### R5: English Center Integration ⏸️

**Goal**: English Center consumes F3 AR via Platform contract (not direct DB).

**Scope**:
```typescript
// Product code
import { createF3AREngine } from '@/platform/finance';

const arEngine = createF3AREngine();
await arEngine.createDraftInvoice({ ... });
```

**Exit Criteria**:
- English Center creates invoices via contract
- No direct `finance_invoices` access from Product
- E1 Chain Management unblocked

### R6: Verification ⏸️

**Goal**: Prove remediation complete with evidence.

**Scope**:
- Contract coverage: 5/5 methods
- RPC wrappers: 4/4
- Tests: 14/14 PASS (unit + integration)
- Architecture compliance: Party-native, no Product→Product coupling

### R7: Seal 🔒

**Goal**: Freeze F3 AR Contract + Engine as Platform capability.

**Scope**:
- Contract interface immutable
- Engine internals allowed to evolve
- Versioning: v1.0.0
- Governance: Platform Finance ownership

---

## Lessons Learned

### 1. Use Supabase Client for Tests

**Principle**: Prefer official client libraries over raw database connections in integration tests.

**Why**: Service role key provides full access via REST API, simpler than managing Postgres credentials.

### 2. Align with Actual Schema

**Principle**: Read migrations before assuming column names or constraints.

**Why**: Assumptions like `is_active` or `PERSON` (uppercase) cause runtime failures even if TypeScript compiles.

### 3. Test Idempotency Explicitly

**Principle**: Network-level retry scenarios must be covered in integration tests.

**Why**: Production systems retry on timeout; duplicates must be prevented at application layer, not just DB constraints.

### 4. Verify Side Effects, Not Just Responses

**Principle**: Integration tests must query actual state (ledger, positions), not just trust RPC return values.

**Why**: DB triggers, RLS policies, or RPC bugs can cause silent failures.

---

## Canonical Status

```
Identity remediation      🔒 CLOSED

Finance:
Preflight                 ✅
R0 Baseline               🔒
R1 Contract               🔒
R2 Engine                 🔒
R3 Runtime Contract Tests ✅ COMPLETE (14/14 PASS)
R4 Platform Exports       🟢 READY TO PROCEED
R5 English Integration    ⏸️ BLOCKED (R4)
R6 Verification           ⏸️ BLOCKED (R5)
R7 Seal                   ⏸️ BLOCKED (R6)

English Center E1         🚫 BLOCKED (R4→R5)
```

**Critical Path**: R4 → R5 → E1 unblocked

---

**R3 EVIDENCE SEAL**: 14/14 runtime integration tests PASS with real F3 database/RPCs.

**Denominator Governance**:
- Contract methods: 5/5
- Engine RPC wrappers: 4/4
- Unit tests: 14/14 PASS
- Integration tests: 14/14 PASS
- Total verification: 28/28 ✅

**Authorization**: Proceed R4 Platform Exports.
