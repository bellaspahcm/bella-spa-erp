# R5 English Center Integration — SCOPE FREEZE

**Phase**: E0.1B-R Finance Remediation R5  
**Status**: 🟢 AUTHORIZED  
**Goal**: Prove English Center billing flow works through Platform F3 AR contract (NOT direct DB/RPC)

---

## Objective

Wire **one real billing flow** from English Center to Platform Finance F3 AR:

```
English Enrollment Context
        ↓
Billing Service (Product layer)
        ↓
createF3AREngine() (Platform import)
        ↓
F3 AR Contract methods
        ↓
Platform Finance Engine
        ↓
F3 DB/RPCs
```

---

## Scope (Minimal)

### IN SCOPE

**Single Billing Flow**:
```
1. Enrollment confirmed
   ↓
2. Calculate course fee (Product logic)
   ↓
3. Create DRAFT invoice (Platform F3)
   ↓
4. Add line items (tuition, materials)
   ↓
5. Finalize invoice (triggers F1 posting)
   ↓
6. Retrieve invoice view (header + lines + position)
```

**Ownership Boundaries**:

| Layer | Owner | Responsibility |
|-------|-------|---------------|
| Course fee policy | English Center | Fee calculation, discount logic |
| Installment terms | English Center | Payment schedule, commercial terms |
| Enrollment ↔ Invoice context | English Center | Business entity mapping |
| **Invoice identity** | **Platform Finance** | **Invoice lifecycle, receivable position** |
| **Accounting posting** | **Platform Finance** | **F1 GL transactions, audit trail** |

**Files to Create**:
```
src/products/bella-english-center/
  billing/
    ar-service.ts           ← Billing orchestrator (imports Platform)
    __tests__/
      ar-service.test.ts    ← Unit tests (mocked engine)
      ar-service.integration.test.ts  ← Real flow with test enrollment
```

### OUT OF SCOPE

**NOT in R5**:
- ❌ Payment allocation (F2 Cash incomplete, deferred)
- ❌ Adjustment memos (F2 Cash incomplete, deferred)
- ❌ Installment scheduling (complex commercial logic, E1.1 scope)
- ❌ Discount engine (complex commercial logic, E1.1 scope)
- ❌ Multi-line complex invoicing (E1.1 scope)
- ❌ Invoice templates/printing (E1.4 UI scope)
- ❌ Student billing portal (E1.4 UI scope)

**Why deferred**:
- F2 Cash Payment Allocation not complete (P0 dependency)
- E1.1 Chain Management will implement full commercial terms
- R5 only proves **contract works end-to-end**, not full feature coverage

---

## Implementation Pattern

### Billing Service

**File**: `src/products/bella-english-center/billing/ar-service.ts`

```typescript
import {
  createF3AREngine,
  IF3AccountsReceivable,
  CreateInvoiceInput,
  AddInvoiceLineInput,
  InvoiceResult,
  InvoiceView,
  F3InvoiceNotFoundError
} from '@/platform/finance';

/**
 * English Center Billing Service
 * 
 * Orchestrates invoice creation for enrollments.
 * Uses Platform Finance F3 AR contract (NOT direct DB).
 */
export class EnglishCenterBillingService {
  private arEngine: IF3AccountsReceivable;

  constructor() {
    this.arEngine = createF3AREngine();
  }

  /**
   * Create invoice for confirmed enrollment
   */
  async createEnrollmentInvoice(params: {
    tenantId: string;
    enrollmentId: string;
    studentPartyId: string;
    courseId: string;
    courseFeeMinor: number;
    materialsFeeMinor: number;
    taxRate: number;
    startDate: string;
    paymentDueDate: string;
  }): Promise<InvoiceResult> {
    // 1. Create DRAFT invoice
    const invoice = await this.arEngine.createDraftInvoice({
      tenantId: params.tenantId,
      partyId: params.studentPartyId,
      invoiceNumber: `ENR-${params.enrollmentId}`,
      currency: 'VND',
      issueDate: params.startDate,
      dueDate: params.paymentDueDate
    });

    // 2. Add tuition line
    await this.arEngine.addInvoiceLine({
      tenantId: params.tenantId,
      invoiceId: invoice.invoiceId,
      description: `Tuition - Course ${params.courseId}`,
      quantity: 1,
      unitPriceMinor: params.courseFeeMinor,
      taxRate: params.taxRate,
      revenueAccountCode: '5111'  // Revenue Packages
    });

    // 3. Add materials line (if applicable)
    if (params.materialsFeeMinor > 0) {
      await this.arEngine.addInvoiceLine({
        tenantId: params.tenantId,
        invoiceId: invoice.invoiceId,
        description: 'Course Materials',
        quantity: 1,
        unitPriceMinor: params.materialsFeeMinor,
        taxRate: params.taxRate,
        revenueAccountCode: '5112'  // Revenue Retail
      });
    }

    // 4. Finalize invoice (triggers F1 posting)
    return await this.arEngine.finalizeInvoice({
      tenantId: params.tenantId,
      invoiceId: invoice.invoiceId
    });
  }

  /**
   * Get invoice view with position
   */
  async getEnrollmentInvoice(
    tenantId: string,
    invoiceId: string
  ): Promise<InvoiceView> {
    return await this.arEngine.getInvoice({
      tenantId,
      invoiceId
    });
  }
}

// Factory
export function createEnglishBillingService(): EnglishCenterBillingService {
  return new EnglishCenterBillingService();
}
```

---

## Exit Criteria (Exact)

### Implementation
```
✅ EnglishCenterBillingService created
✅ Uses public '@/platform/finance' import only
✅ Direct finance_* table access = 0
✅ Direct F3 RPC calls from Product = 0
```

### Semantic Correctness
```
✅ partyId propagated correctly (student Party ID)
✅ tenantId propagated correctly (English Center tenant)
✅ DRAFT invoice created
✅ Line items added (tuition + materials)
✅ Finalize succeeds
✅ F1 posting observed (transaction + ledger + position)
✅ getInvoice reconciles result
```

### Tests
```
✅ Unit tests: 5/5 PASS (mocked engine)
✅ Integration test: 1/1 PASS (real flow, test enrollment)
✅ Build PASS
```

### Ownership Compliance
```
✅ English Center does NOT call finance_* tables directly
✅ English Center does NOT call F3 RPCs directly
✅ English Center does NOT call P71 Product tables
✅ Platform Finance owns invoice lifecycle
✅ Platform Finance owns F1 posting
```

---

## Test Strategy

### Unit Tests (Mocked Engine)

**File**: `src/products/bella-english-center/billing/__tests__/ar-service.test.ts`

```typescript
import { EnglishCenterBillingService } from '../ar-service';
import type { IF3AccountsReceivable } from '@/platform/finance';

describe('EnglishCenterBillingService', () => {
  let service: EnglishCenterBillingService;
  let mockEngine: jest.Mocked<IF3AccountsReceivable>;

  beforeEach(() => {
    mockEngine = {
      createDraftInvoice: jest.fn(),
      addInvoiceLine: jest.fn(),
      finalizeInvoice: jest.fn(),
      voidInvoice: jest.fn(),
      getInvoice: jest.fn()
    };

    service = new EnglishCenterBillingService();
    (service as any).arEngine = mockEngine;  // Inject mock
  });

  it('should create enrollment invoice with tuition + materials', async () => {
    mockEngine.createDraftInvoice.mockResolvedValue({
      invoiceId: 'inv-123',
      status: 'DRAFT',
      totalInvoiceAmountMinor: 0
    });

    mockEngine.finalizeInvoice.mockResolvedValue({
      invoiceId: 'inv-123',
      status: 'FINALIZED',
      totalInvoiceAmountMinor: 11000000,
      f1TransactionId: 'tx-456'
    });

    const result = await service.createEnrollmentInvoice({
      tenantId: 'tenant-1',
      enrollmentId: 'enr-001',
      studentPartyId: 'party-student-1',
      courseId: 'course-A',
      courseFeeMinor: 10000000,
      materialsFeeMinor: 1000000,
      taxRate: 0.1,
      startDate: '2026-09-01',
      paymentDueDate: '2026-09-15'
    });

    expect(mockEngine.createDraftInvoice).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      partyId: 'party-student-1',
      invoiceNumber: 'ENR-enr-001',
      currency: 'VND',
      issueDate: '2026-09-01',
      dueDate: '2026-09-15'
    });

    expect(mockEngine.addInvoiceLine).toHaveBeenCalledTimes(2);
    expect(mockEngine.finalizeInvoice).toHaveBeenCalled();
    expect(result.status).toBe('FINALIZED');
  });
});
```

### Integration Test (Real Flow)

**File**: `src/products/bella-english-center/billing/__tests__/ar-service.integration.test.ts`

```typescript
import { createEnglishBillingService } from '../ar-service';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { createClient } from '@supabase/supabase-js';

describe('EnglishCenterBillingService Integration', () => {
  let service: ReturnType<typeof createEnglishBillingService>;
  let supabaseAdmin: ReturnType<typeof createClient>;

  const RUN_ID = Date.now().toString(36).toUpperCase();
  let testTenantId: string;
  let testStudentPartyId: string;

  beforeAll(async () => {
    service = createEnglishBillingService();

    const { url, adminKey } = requireSupabaseAdminEnv();
    supabaseAdmin = createClient(url, adminKey);

    // Create test tenant + student Party
    const { data: tenant } = await supabaseAdmin
      .from('tenants')
      .insert({ name: `EC-BILLING-${RUN_ID}`, status: 'active' })
      .select('id')
      .single();
    testTenantId = tenant!.id;

    const { data: party } = await supabaseAdmin
      .from('party_parties')
      .insert({
        tenant_id: testTenantId,
        party_type: 'person',
        display_name: 'Test Student'
      })
      .select('id')
      .single();
    testStudentPartyId = party!.id;

    // Seed F1 Chart of Accounts
    await supabaseAdmin.from('finance_accounts').insert([
      { tenant_id: testTenantId, code: '131', name: 'Receivables Control', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true },
      { tenant_id: testTenantId, code: '5111', name: 'Revenue Packages', type: 'REVENUE', normal_balance: 'CREDIT', currency: 'VND', is_active: true },
      { tenant_id: testTenantId, code: '5112', name: 'Revenue Retail', type: 'REVENUE', normal_balance: 'CREDIT', currency: 'VND', is_active: true },
      { tenant_id: testTenantId, code: '3331', name: 'VAT Payable', type: 'LIABILITY', normal_balance: 'CREDIT', currency: 'VND', is_active: true }
    ]);

    // Seed accounting period
    await supabaseAdmin.from('finance_accounting_periods').insert({
      tenant_id: testTenantId,
      name: '2026-09',
      period_start: '2026-09-01T00:00:00Z',
      period_end: '2026-09-30T23:59:59Z',
      status: 'OPEN'
    });
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabaseAdmin.from('tenants').delete().eq('id', testTenantId);
    }
  });

  it('should create enrollment invoice end-to-end', async () => {
    const result = await service.createEnrollmentInvoice({
      tenantId: testTenantId,
      enrollmentId: `ENR-${RUN_ID}`,
      studentPartyId: testStudentPartyId,
      courseId: 'COURSE-A',
      courseFeeMinor: 5000000,
      materialsFeeMinor: 500000,
      taxRate: 0.1,
      startDate: '2026-09-01',
      paymentDueDate: '2026-09-15'
    });

    expect(result.status).toBe('FINALIZED');
    expect(result.f1TransactionId).toBeDefined();
    expect(result.totalInvoiceAmountMinor).toBeGreaterThan(0);

    // Verify F1 posting
    const { data: transaction } = await supabaseAdmin
      .from('finance_transactions')
      .select('*')
      .eq('id', result.f1TransactionId!)
      .single();

    expect(transaction?.status).toBe('POSTED');

    // Verify AR position created
    const { data: position } = await supabaseAdmin
      .from('finance_receivable_positions')
      .select('*')
      .eq('invoice_id', result.invoiceId)
      .single();

    expect(position).toBeDefined();
    expect(parseInt(position!.outstanding_amount_minor)).toBeGreaterThan(0);
  });
});
```

---

## Risks & Mitigations

### Risk 1: Missing F1 Accounts

**Risk**: Integration test fails if F1 Chart of Accounts not seeded.

**Mitigation**: Seed accounts in `beforeAll()` (131, 5111, 5112, 3331).

### Risk 2: Payment Allocation Expectation

**Risk**: User expects payment flow after invoice creation.

**Mitigation**: Document **payment allocation deferred** (F2 Cash incomplete). R5 scope ends at invoice finalization.

### Risk 3: Complex Commercial Terms

**Risk**: User expects discount/installment logic in R5.

**Mitigation**: R5 proves **contract works**, not feature completeness. Discount/installment logic belongs to E1.1 Chain Management.

---

## Canonical Status After R5

```
E0.1B-R FINANCE REMEDIATION

R0 Baseline               🔒 FROZEN
R1 Contract               🔒 SEALED
R2 Engine                 🔒 SEALED
R3 Runtime Integration    🔒 SEALED (14/14 PASS)
R4 Platform Exports       🔒 SEALED (10/10 PASS)
R5 English Integration    🟢 IN PROGRESS
R6 Full Verification      ⏸️ BLOCKED (R5)
R7 Evidence Seal          ⏸️ BLOCKED (R6)

English Center E1         🚫 BLOCKED (R6→R7→Readiness Gate)
```

**Critical Path**: R5 → R6 → R7 → E1 Readiness Gate → E1 Authorized

---

**R5 AUTHORIZATION**: Proceed with minimal billing flow implementation — NO full Finance module.
