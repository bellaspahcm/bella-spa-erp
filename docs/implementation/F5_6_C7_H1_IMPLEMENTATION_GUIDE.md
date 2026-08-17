# F5.6 C7-H1 Hospital Finance Integration — Implementation Guide

> **Document Type:** Implementation Guide  
> **Date:** 2026-08-16  
> **Status:** READY FOR IMPLEMENTATION  
> **Purpose:** Step-by-step guide to implement Hospital → Finance OS integration (Flow H1)

---

## Overview

This guide walks through implementing **Flow H1: Patient Service → Revenue → AR/Cash** connecting Hospital OS to Finance OS using the proven C7-H1 integration contract.

**Architecture:**
```
Hospital OS (H1-H12)
    ↓
Finance Event Publisher
    ↓
Finance OS Event Handler
    ↓
Semantic Resolution (C.2)
    ↓
Intent Generation (C.2)
    ↓
Policy Context (A.4)
    ↓
COA Resolution (C.3)
    ↓
Posting Instruction
    ↓
F1-F4 Kernel
```

---

## Files Created

### 1. Contract Types
**File:** `src/platform/integration-hub/finance-event-contract.types.ts`

Defines:
- `FinanceEventEnvelope` - Standard event structure for ALL Vertical OS
- `BusinessContext` - Vertical-specific context (Hospital, Beauty, etc.)
- `FinanceEventResult` - Response from Finance OS
- `IdempotencyEntry` - Prevents duplicate processing

### 2. Event Publisher
**File:** `src/platform/integration-hub/finance-event-publisher.ts`

Responsibilities:
- Generate event envelope
- Validate event structure
- Publish to Finance OS
- Handle retry with exponential backoff
- Implement failure isolation

### 3. Event Handler (Finance OS)
**File:** `src/platform/finance/finance-event-handler.ts`

Responsibilities:
- Receive events from Vertical OS
- Check idempotency
- Resolve semantic (C.2)
- Generate intent (C.2)
- Apply policy context (A.4)
- Resolve COA (C.3)
- Generate posting instruction
- Persist to F1-F4 Kernel

### 4. Hospital Adapter
**File:** `src/platform/healthcare/finance-integration/hospital-finance-adapter.ts`

Convenience methods for Hospital OS:
- `publishPatientServiceCompleted()` - Flow H1 step 1
- `publishPatientPaymentReceived()` - Flow H1 step 2
- `publishMedicationDispensed()` - Flow H2
- `publishSupplierPrepaymentMade()` - Flow H3
- `publishInsuranceServiceCompleted()` - Flow H4

---

## Implementation Steps

### Phase 1: Setup (Infrastructure)

**Step 1.1: Install Dependencies**
```bash
npm install uuid
npm install --save-dev @types/uuid
```

**Step 1.2: Environment Configuration**
```bash
# .env.local
FINANCE_OS_ENDPOINT=http://localhost:3000/api/finance
HOSPITAL_OS_VERSION=1.0.0
```

**Step 1.3: Database Schema (Idempotency Store)**
```sql
-- Finance OS database
CREATE TABLE finance_event_idempotency (
    idempotency_key VARCHAR(255) PRIMARY KEY,
    event_id VARCHAR(255) NOT NULL,
    transaction_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    tenant_id VARCHAR(255) NOT NULL,
    INDEX idx_tenant_created (tenant_id, created_at)
);
```

---

### Phase 2: Finance OS Implementation

**Step 2.1: Implement Semantic Resolver (C.2)**

Create `src/platform/finance/semantic-resolver.ts`:

```typescript
import { SemanticResolver, CanonicalSemantic } from './finance-event-handler';
import { FinanceEventEnvelope } from '../integration-hub/finance-event-contract.types';

export class DefaultSemanticResolver implements SemanticResolver {
  async resolve(envelope: FinanceEventEnvelope): Promise<CanonicalSemantic> {
    // Map Hospital event type → Canonical semantic
    const mappings: Record<string, CanonicalSemantic> = {
      'PATIENT_SERVICE_COMPLETED': {
        canonical_semantic: 'PATIENT_SERVICE_REVENUE',
        semantic_category: 'REVENUE',
        description: 'Patient service revenue recognition',
      },
      'PATIENT_PAYMENT_RECEIVED': {
        canonical_semantic: 'CASH_RECEIPT',
        semantic_category: 'CASH',
        description: 'Cash receipt from patient',
      },
      'MEDICATION_DISPENSED': {
        canonical_semantic: 'INVENTORY_CONSUMED',
        semantic_category: 'COGS',
        description: 'Inventory consumed (medication dispensed)',
      },
      // Add more mappings...
    };
    
    const semantic = mappings[envelope.event_type];
    if (!semantic) {
      throw new Error(`Unknown event type: ${envelope.event_type}`);
    }
    
    return semantic;
  }
}
```

**Step 2.2: Implement Intent Generator (C.2)**

Create `src/platform/finance/intent-generator.ts`:

```typescript
import { IntentGenerator, CanonicalSemantic, AccountingIntent } from './finance-event-handler';
import { FinanceEventEnvelope } from '../integration-hub/finance-event-contract.types';

export class DefaultIntentGenerator implements IntentGenerator {
  async generate(
    semantic: CanonicalSemantic,
    envelope: FinanceEventEnvelope
  ): Promise<AccountingIntent[]> {
    // Generate intents based on semantic
    switch (semantic.canonical_semantic) {
      case 'PATIENT_SERVICE_REVENUE':
        return [
          {
            intent_type: 'RECOGNIZE_REVENUE',
            credit_amount: envelope.amount,
            description: 'Recognize patient service revenue',
          },
          {
            intent_type: 'RECOGNIZE_RECEIVABLE',
            debit_amount: envelope.amount,
            description: 'Recognize patient accounts receivable',
          },
        ];
      
      case 'CASH_RECEIPT':
        return [
          {
            intent_type: 'RECOGNIZE_CASH',
            debit_amount: envelope.amount,
            description: 'Recognize cash receipt',
          },
          {
            intent_type: 'SETTLE_RECEIVABLE',
            credit_amount: envelope.amount,
            description: 'Settle patient accounts receivable',
          },
        ];
      
      case 'INVENTORY_CONSUMED':
        return [
          {
            intent_type: 'RECOGNIZE_COGS',
            debit_amount: envelope.amount,
            description: 'Recognize cost of goods sold',
          },
          {
            intent_type: 'REDUCE_INVENTORY',
            credit_amount: envelope.amount,
            description: 'Reduce inventory',
          },
        ];
      
      default:
        throw new Error(`Unknown semantic: ${semantic.canonical_semantic}`);
    }
  }
}
```

**Step 2.3: Implement COA Resolver (C.3)**

Create `src/platform/finance/coa-resolver.ts`:

```typescript
import { COAResolver, AccountingIntent, AccountMapping, PolicyContext } from './finance-event-handler';

export class DefaultCOAResolver implements COAResolver {
  async resolve(
    tenantId: string,
    intents: AccountingIntent[],
    policyContext: PolicyContext
  ): Promise<AccountMapping[]> {
    // Load tenant COA from database
    // For now, use default mapping
    
    const mappings: Record<string, string> = {
      'RECOGNIZE_REVENUE': '4111', // Service Revenue
      'RECOGNIZE_RECEIVABLE': '1311', // AR - Patient
      'RECOGNIZE_CASH': '1111', // Cash
      'SETTLE_RECEIVABLE': '1311', // AR - Patient
      'RECOGNIZE_COGS': '6211', // COGS - Pharmacy
      'REDUCE_INVENTORY': '1521', // Inventory - Medication
    };
    
    return intents.map(intent => ({
      intent_type: intent.intent_type,
      account_code: mappings[intent.intent_type] || '9999',
      account_name: intent.intent_type,
    }));
  }
}
```

**Step 2.4: Implement Finance Kernel Client (F1-F4)**

Create `src/platform/finance/kernel-client.ts`:

```typescript
import { FinanceKernelClient, PostingInstruction, FinanceTransaction } from './finance-event-handler';

export class DefaultFinanceKernelClient implements FinanceKernelClient {
  async persist(instruction: PostingInstruction): Promise<FinanceTransaction> {
    // TODO: Call existing F1-F4 Kernel API
    // For now, simulate persistence
    
    const transactionId = `TXN-${Date.now()}`;
    
    console.log('Persisting to Kernel:', {
      transaction_id: transactionId,
      tenant_id: instruction.tenant_id,
      entries: instruction.entries,
      source_event_id: instruction.source_event_id,
    });
    
    // In production, call ledger-engine or cash-engine
    // await this.ledgerEngine.createTransaction(instruction);
    
    return {
      transaction_id: transactionId,
      status: 'COMMITTED',
    };
  }
}
```

**Step 2.5: Implement Idempotency Store**

Create `src/platform/finance/idempotency-store.ts`:

```typescript
import { IdempotencyStore } from './finance-event-handler';
import { IdempotencyEntry } from '../integration-hub/finance-event-contract.types';

export class DatabaseIdempotencyStore implements IdempotencyStore {
  async get(key: string): Promise<IdempotencyEntry | null> {
    // TODO: Query database
    // SELECT * FROM finance_event_idempotency WHERE idempotency_key = ?
    return null;
  }
  
  async store(entry: IdempotencyEntry): Promise<void> {
    // TODO: Insert into database
    // INSERT INTO finance_event_idempotency (...)
    console.log('Storing idempotency entry:', entry);
  }
}
```

**Step 2.6: Wire Up Finance Event Handler**

Create `src/platform/finance/finance-event-handler.factory.ts`:

```typescript
import { FinanceEventHandler } from './finance-event-handler';
import { DefaultSemanticResolver } from './semantic-resolver';
import { DefaultIntentGenerator } from './intent-generator';
import { DefaultPolicyContextResolver } from './policy-context-resolver';
import { DefaultCOAResolver } from './coa-resolver';
import { DefaultFinanceKernelClient } from './kernel-client';
import { DatabaseIdempotencyStore } from './idempotency-store';

export function createFinanceEventHandler(): FinanceEventHandler {
  return new FinanceEventHandler(
    new DefaultSemanticResolver(),
    new DefaultIntentGenerator(),
    new DefaultPolicyContextResolver(),
    new DefaultCOAResolver(),
    new DefaultFinanceKernelClient(),
    new DatabaseIdempotencyStore()
  );
}
```

**Step 2.7: Create Finance OS API Endpoint**

Create `src/app/api/finance/v1/events/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEventHandler } from '@/platform/finance/finance-event-handler.factory';
import { FinanceEventEnvelope } from '@/platform/integration-hub/finance-event-contract.types';

export async function POST(request: NextRequest) {
  try {
    const envelope = await request.json() as FinanceEventEnvelope;
    
    // Validate tenant ID from header matches envelope
    const tenantId = request.headers.get('X-Tenant-ID');
    if (tenantId !== envelope.tenant_id) {
      return NextResponse.json(
        { error: 'Tenant ID mismatch' },
        { status: 403 }
      );
    }
    
    // Handle event
    const handler = createFinanceEventHandler();
    const result = await handler.handle(envelope);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Finance event handling error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: Hospital OS Implementation

**Step 3.1: Initialize Finance Event Publisher**

Create `src/platform/healthcare/finance-integration/index.ts`:

```typescript
import { FinanceEventPublisher } from '../../integration-hub/finance-event-publisher';
import { HospitalFinanceAdapter } from './hospital-finance-adapter';

// Singleton instance
let hospitalFinanceAdapter: HospitalFinanceAdapter | null = null;

export function getHospitalFinanceAdapter(): HospitalFinanceAdapter {
  if (!hospitalFinanceAdapter) {
    const publisher = new FinanceEventPublisher({
      financeOsEndpoint: process.env.FINANCE_OS_ENDPOINT || 'http://localhost:3000/api/finance',
      sourceSystem: 'HOSPITAL_OS',
      sourceVersion: process.env.HOSPITAL_OS_VERSION || '1.0.0',
    });
    
    hospitalFinanceAdapter = new HospitalFinanceAdapter(publisher);
  }
  
  return hospitalFinanceAdapter;
}
```

**Step 3.2: Integrate with Billing Engine**

Modify `src/platform/healthcare/engines/billing-engine/billing.service.ts`:

```typescript
import { getHospitalFinanceAdapter } from '../../finance-integration';

export class BillingService {
  async completeService(params: CompleteServiceParams) {
    // 1. Hospital business logic (existing)
    const service = await this.markServiceCompleted(params);
    const bill = await this.generateBill(service);
    
    // 2. Publish finance event (NEW)
    const financeAdapter = getHospitalFinanceAdapter();
    
    try {
      const result = await financeAdapter.publishPatientServiceCompleted({
        tenantId: params.tenantId,
        patientId: service.patient_id,
        encounterId: service.encounter_id,
        serviceId: service.service_id,
        amount: service.charge_amount.toString(),
        currency: 'VND',
        serviceType: service.service_type,
        idempotencyKey: `service_${service.service_id}`,
      });
      
      console.log('Finance event published:', result);
    } catch (error) {
      // Finance event failed, but Hospital operation succeeded
      // Event will be retried via queue
      console.error('Finance event publish failed:', error);
    }
    
    return { service, bill };
  }
  
  async recordPayment(params: RecordPaymentParams) {
    // 1. Hospital business logic (existing)
    const payment = await this.createPayment(params);
    
    // 2. Publish finance event (NEW)
    const financeAdapter = getHospitalFinanceAdapter();
    
    try {
      const result = await financeAdapter.publishPatientPaymentReceived({
        tenantId: params.tenantId,
        patientId: payment.patient_id,
        billId: payment.bill_id,
        amount: payment.amount.toString(),
        currency: 'VND',
        idempotencyKey: `payment_${payment.payment_id}`,
      });
      
      console.log('Finance event published:', result);
    } catch (error) {
      console.error('Finance event publish failed:', error);
    }
    
    return payment;
  }
}
```

**Step 3.3: Integrate with Pharmacy Engine**

Modify `src/platform/healthcare/engines/pharmacy-engine/pharmacy.service.ts`:

```typescript
import { getHospitalFinanceAdapter } from '../../finance-integration';

export class PharmacyService {
  async dispenseMedication(params: DispenseMedicationParams) {
    // 1. Hospital business logic (existing)
    const dispensing = await this.createDispensing(params);
    await this.updateInventory(dispensing);
    
    // 2. Publish finance event (NEW)
    const financeAdapter = getHospitalFinanceAdapter();
    
    try {
      const result = await financeAdapter.publishMedicationDispensed({
        tenantId: params.tenantId,
        medicationId: dispensing.medication_id,
        medicationName: dispensing.medication_name,
        quantity: dispensing.quantity,
        unit: dispensing.unit,
        amount: dispensing.cost_value.toString(), // Cost, not selling price
        currency: 'VND',
        patientId: params.patientId,
        encounterId: params.encounterId,
        batchNumber: dispensing.batch_number,
        idempotencyKey: `dispense_${dispensing.dispensing_id}`,
      });
      
      console.log('Finance event published:', result);
    } catch (error) {
      console.error('Finance event publish failed:', error);
    }
    
    return dispensing;
  }
}
```

---

### Phase 4: Testing

**Step 4.1: Unit Tests**

Create `src/platform/integration-hub/__tests__/finance-event-publisher.test.ts`:

```typescript
import { FinanceEventPublisher } from '../finance-event-publisher';

describe('FinanceEventPublisher', () => {
  it('should validate required fields', async () => {
    const publisher = new FinanceEventPublisher({
      financeOsEndpoint: 'http://localhost:3000',
      sourceSystem: 'HOSPITAL_OS',
      sourceVersion: '1.0.0',
    });
    
    await expect(
      publisher.publish({
        eventType: 'PATIENT_SERVICE_COMPLETED',
        tenantId: '', // Invalid
        amount: '500000',
        currency: 'VND',
        businessContext: {},
        businessReferences: [],
      })
    ).rejects.toThrow('Tenant ID is required');
  });
  
  it('should generate idempotency key', async () => {
    // Test idempotency key generation
  });
});
```

**Step 4.2: Integration Test**

Create `src/platform/healthcare/finance-integration/__tests__/hospital-finance-integration.test.ts`:

```typescript
import { getHospitalFinanceAdapter } from '../index';

describe('Hospital Finance Integration', () => {
  it('should publish patient service completed event', async () => {
    const adapter = getHospitalFinanceAdapter();
    
    const result = await adapter.publishPatientServiceCompleted({
      tenantId: 'tenant_test',
      patientId: 'PAT-001',
      encounterId: 'ENC-001',
      serviceId: 'SRV-001',
      amount: '500000',
      currency: 'VND',
    });
    
    expect(result.status).toBe('CREATED');
    expect(result.transaction_id).toBeDefined();
  });
});
```

**Step 4.3: End-to-End Test**

Test complete flow: Hospital → Finance OS → F1-F4 Kernel

```typescript
describe('E2E: Patient Service Flow', () => {
  it('should create financial transaction from hospital event', async () => {
    // 1. Hospital: Service completed
    const billingService = new BillingService();
    const { service, bill } = await billingService.completeService({
      tenantId: 'tenant_test',
      patientId: 'PAT-001',
      encounterId: 'ENC-001',
      serviceType: 'CONSULTATION',
      chargeAmount: 500000,
    });
    
    // 2. Wait for finance processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 3. Verify finance transaction created
    const kernelClient = new DefaultFinanceKernelClient();
    const transaction = await kernelClient.getBySourceEvent(`service_${service.service_id}`);
    
    expect(transaction).toBeDefined();
    expect(transaction.entries).toHaveLength(2);
    expect(transaction.entries[0].account_id).toBe('1311'); // AR
    expect(transaction.entries[1].account_id).toBe('4111'); // Revenue
  });
});
```

---

## Verification Checklist

### Five Proof Tests (from C7-H1)

**✅ H-C7-T1: Domain Independence**
- [ ] Hospital events contain NO account codes
- [ ] Hospital events contain NO debit/credit
- [ ] Hospital events contain NO regime (TT99/TT133)
- [ ] Hospital events contain ONLY business context

**✅ H-C7-T2: Financial Translation**
- [ ] Hospital event → Semantic resolution works
- [ ] Semantic → Intent generation works
- [ ] Intent → COA resolution works
- [ ] COA → Posting instruction works
- [ ] Posting → F1-F4 persistence works

**✅ H-C7-T3: Idempotency**
- [ ] Same idempotency_key → Same transaction ID
- [ ] Retry does NOT create duplicate
- [ ] Idempotency store prevents duplicates

**✅ H-C7-T4: Failure Isolation**
- [ ] Finance OS down → Hospital continues
- [ ] Events queued during downtime
- [ ] Events processed when Finance OS recovers

**✅ H-C7-T5: Historical Reconstruction**
- [ ] Transaction stores original context
- [ ] Future analysis uses original context
- [ ] Current system state does NOT overwrite history

---

## Deployment Checklist

### Database
- [ ] Create `finance_event_idempotency` table
- [ ] Create indexes for performance
- [ ] Set up data retention policy

### Configuration
- [ ] Set `FINANCE_OS_ENDPOINT` environment variable
- [ ] Set `HOSPITAL_OS_VERSION` environment variable
- [ ] Configure retry policy (max attempts, backoff)

### Monitoring
- [ ] Add logging for finance events
- [ ] Add metrics (event count, success rate, latency)
- [ ] Add alerts (high failure rate, queue backlog)

### Security
- [ ] Validate tenant isolation (P0 Gate)
- [ ] Add authentication for Finance OS endpoint
- [ ] Encrypt sensitive data in events

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Deploy to development environment
- Test with synthetic Hospital data
- Verify all 5 proof tests pass

### Phase 2: Pilot Tenant (Week 2)
- Deploy to production with 1 pilot tenant
- Monitor for 1 week
- Collect feedback

### Phase 3: Gradual Rollout (Week 3-4)
- Roll out to 10% of tenants
- Monitor metrics
- Roll out to 50% of tenants
- Roll out to 100% of tenants

### Phase 4: Complete Flows (Week 5-8)
- Flow H2: Pharmacy/Inventory
- Flow H3: Procurement/AP
- Flow H4: Insurance

---

## Troubleshooting

### Issue: Events Not Reaching Finance OS
**Check:**
- Finance OS endpoint URL correct?
- Network connectivity?
- Authentication headers?

### Issue: Duplicate Transactions Created
**Check:**
- Idempotency key generation correct?
- Idempotency store working?
- Database constraints?

### Issue: Balance Mismatch
**Check:**
- Intent generation creates balanced entries?
- Amount parsing correct (decimal precision)?
- Debit/credit assignment correct?

---

## Success Metrics

**Target Metrics (Week 4):**
- Event success rate: > 99.9%
- Idempotency effectiveness: 100% (no duplicates)
- End-to-end latency: < 2 seconds (p95)
- Hospital operation impact: 0% (failure isolation)

---

## Next Steps

After Flow H1 is stable:
1. Implement Flow H2 (Pharmacy/Inventory)
2. Implement Flow H3 (Procurement/AP)
3. Implement Flow H4 (Insurance)
4. Replicate pattern for Beauty/Land/Auto/Retail OS

---

**Document Status:** Implementation guide complete ✅  
**Implementation Files:** 4 files created (contract, publisher, handler, adapter) ✅  
**Ready for:** Development → Testing → Pilot → Rollout ✅
