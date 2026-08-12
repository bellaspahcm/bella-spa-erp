# Gate 4A: Clinical Order Foundation - Execution Plan

**Status:** 🟢 IN PROGRESS  
**Start Date:** 2026-08-12  
**Owner:** Healthcare Platform Team  
**Goal:** Build Clinical Order Engine with Encounter linkage validation, proving cross-engine architecture.

---

## 🎯 Strategic Context

**Why This Matters:**
- Gate 1C proved single-engine architecture (Encounter)
- Gate 4A proves cross-engine orchestration (Encounter → Order)
- This is the foundation for Pharmacy Engine (Gate 4B)

**Critical Success Factors:**
1. ✅ Contract-first development (contract already exists)
2. ✅ Zero `any` types (Constitution Law 11)
3. ✅ Encounter linkage validated (not independent aggregate)
4. ✅ Tenant isolation enforced (same rigor as Gate 1C)
5. ✅ Event ordering validated (DB write before event publish)
6. ✅ Repository tests fixed from start (avoid DEBT-HC-001 repeat)

---

## 📋 Architecture Inventory (STEP 2 Complete)

### Existing Contracts ✅
- **Order Engine Contract:** `src/platform/healthcare/contracts/order-engine.contract.ts` (exists, comprehensive)
- **Pharmacy Engine Contract:** `src/platform/healthcare/contracts/pharmacy-engine.contract.ts` (exists, basic MAR)
- **Encounter Engine Contract:** `src/platform/healthcare/contracts/encounter-engine.contract.ts` (exists, 11 events)

### Contract Analysis

#### Order Engine Contract Quality: 9/10 ✅
**Strengths:**
- Strong typing (OrderType, OrderStatus, OrderPriority)
- State machine defined (PENDING → VALIDATED → APPROVED → ACTIVE → COMPLETED)
- CDS integration mandatory for MEDICATION orders
- Idempotency via requestId
- Detailed order types (MedicationOrderDetails, LabOrderDetails, ImagingOrderDetails)
- Audit trail (CdsOverrideRecord)

**Alignment with Gate 4A Requirements:**
| Requirement | Contract Coverage | Status |
|---|---|---|
| Order Aggregate Root | ✅ ClinicalOrder interface | COVERED |
| Order lifecycle | ✅ State machine defined | COVERED |
| Encounter linkage | ✅ `encounterId` required | COVERED |
| Provider authorization | ⚠️ `orderedBy` field only | PARTIAL |
| Tenant isolation | ✅ `tenantId` required | COVERED |
| Event contracts | ⚠️ Events not defined in contract | MISSING |
| Idempotency | ✅ `requestId` pattern | COVERED |

**Gaps to Address:**
1. ❌ **Event contracts missing** - Need to add OrderCreated, OrderStatusChanged, OrderCancelled, OrderCompleted, OrderFailed
2. ⚠️ **Provider authorization validation** - Need to validate provider has ordering privileges
3. ⚠️ **Encounter status validation** - Need to check encounter allows ordering (not finished/cancelled)

---

## 📐 Architecture Decision: Encounter Linkage

### Decision ADR-011: Clinical Order MUST Reference Encounter

**Context:**
- Order Engine is second engine in Healthcare Platform
- Need to prove cross-engine relationship works
- Must avoid creating independent aggregate that duplicates Encounter data

**Decision:**
```
Person
  └── Encounter (Aggregate Root from Gate 1C)
        ├── Diagnosis
        ├── Provider Assignment
        └── Clinical Order (NEW - child aggregate)
              ├── Order Items
              └── CDS Overrides
```

**Constraints:**
1. ✅ Order CANNOT exist without Encounter
2. ✅ Order MUST validate Encounter exists before creation
3. ✅ Order MUST validate Encounter status allows ordering
4. ✅ Order MUST use Patient ID from Encounter (no separate patient field)
5. ✅ Encounter MUST remain oblivious to Order (no FK from Encounter to Order)

**Validation Rules:**
```typescript
// ✅ CORRECT: Order validates Encounter
async createOrder(request: CreateOrderRequest) {
  // 1. Validate encounter exists
  const encounter = await encounterEngine.getEncounter(request.tenantId, request.encounterId);
  if (!encounter) {
    throw new Error('Encounter not found');
  }
  
  // 2. Validate encounter status allows ordering
  if (encounter.status === 'finished' || encounter.status === 'cancelled') {
    throw new Error('Cannot create order for finished/cancelled encounter');
  }
  
  // 3. Validate patient matches encounter
  if (request.patientId && request.patientId !== encounter.patientId) {
    throw new Error('Patient ID mismatch with encounter');
  }
  
  // 4. Create order with validated encounter context
  return await orderRepository.create({
    ...request,
    patientId: encounter.patientId, // Use encounter's patient
  });
}
```

**Anti-Pattern to Avoid:**
```typescript
// ❌ WRONG: Order bypasses Encounter
async createOrder(request: CreateOrderRequest) {
  // ❌ No encounter validation
  // ❌ Patient specified independently
  return await orderRepository.create(request);
}
```

**Impact:**
- ✅ Proves cross-engine architecture works
- ✅ Prevents duplicate patient/encounter data
- ✅ Enforces Encounter as Aggregate Root (Law 1)
- ✅ Enables cross-engine events (Gate 4C validation)

---

## 🛠️ Implementation Plan (STEP 3-11)

### STEP 3: ✅ COMPLETE
- Architecture decision documented (ADR-011)
- Contract analysis complete
- Gaps identified

### STEP 4: Enhance Contract with Events ⏭️ NEXT

**Task:** Add missing event definitions to Order Engine Contract

**Events to Add:**
```typescript
export const ORDER_ENGINE_EVENTS = {
  OrderCreated: {
    eventType: 'OrderCreated',
    version: '1.0.0',
    summary: 'Published when a new clinical order is created',
    payloadSchema: { /* OrderCreatedPayload */ },
    publisher: 'order-engine',
    subscribers: ['pharmacy-engine', 'laboratory-engine', 'billing-engine'],
  },
  OrderValidated: {
    eventType: 'OrderValidated',
    version: '1.0.0',
    summary: 'Published when order passes CDS validation',
    payloadSchema: { /* OrderValidatedPayload */ },
    publisher: 'order-engine',
    subscribers: ['pharmacy-engine'],
  },
  OrderApproved: {
    eventType: 'OrderApproved',
    version: '1.0.0',
    summary: 'Published when provider approves order',
    payloadSchema: { /* OrderApprovedPayload */ },
    publisher: 'order-engine',
    subscribers: ['pharmacy-engine', 'laboratory-engine'],
  },
  OrderActivated: {
    eventType: 'OrderActivated',
    version: '1.0.0',
    summary: 'Published when order becomes active (ready for fulfillment)',
    payloadSchema: { /* OrderActivatedPayload */ },
    publisher: 'order-engine',
    subscribers: ['pharmacy-engine'],
  },
  OrderCompleted: {
    eventType: 'OrderCompleted',
    version: '1.0.0',
    summary: 'Published when order is fulfilled',
    payloadSchema: { /* OrderCompletedPayload */ },
    publisher: 'order-engine',
    subscribers: ['billing-engine', 'analytics-engine'],
  },
  OrderDiscontinued: {
    eventType: 'OrderDiscontinued',
    version: '1.0.0',
    summary: 'Published when order is cancelled',
    payloadSchema: { /* OrderDiscontinuedPayload */ },
    publisher: 'order-engine',
    subscribers: ['pharmacy-engine', 'billing-engine'],
  },
  OrderRejected: {
    eventType: 'OrderRejected',
    version: '1.0.0',
    summary: 'Published when order fails CDS validation (BLOCK)',
    payloadSchema: { /* OrderRejectedPayload */ },
    publisher: 'order-engine',
    subscribers: ['notification-hub', 'analytics-engine'],
  },
};
```

### STEP 5: Domain Aggregate

**Files to Create:**
```
src/platform/healthcare/engines/order-engine/
├── domain/
│   ├── clinical-order.entity.ts        # Order aggregate
│   ├── order-item.entity.ts            # Order line items
│   ├── order-status.vo.ts              # OrderStatus value object
│   ├── order-type.vo.ts                # OrderType value object
│   ├── order-priority.vo.ts            # OrderPriority value object
│   └── index.ts
```

**Key Classes:**
```typescript
// clinical-order.entity.ts
export class ClinicalOrder {
  readonly id: string;
  readonly tenantId: string;
  readonly encounterId: string;
  readonly patientId: string; // Denormalized from encounter
  private status: OrderStatus;
  private orderType: OrderType;
  private priority: OrderPriority;
  
  // State machine methods
  validate(): void;
  approve(approvedBy: string): void;
  activate(): void;
  complete(): void;
  discontinue(reason: string, discontinuedBy: string): void;
  
  // Business rules
  canApprove(): boolean;
  canDiscontinue(): boolean;
  requiresCdsCheck(): boolean;
}
```

### STEP 6: Repository + Migration

**Files to Create:**
```
src/platform/healthcare/engines/order-engine/
├── infrastructure/
│   ├── repository.interface.ts
│   ├── supabase-order.repository.ts
│   └── __tests__/
│       └── supabase-order.repository.test.ts  # 21/21 PASS target
```

**Migration:**
```sql
-- supabase/migrations/20260812030000_create_clinical_orders_table.sql
CREATE TABLE hc_clinical_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  encounter_id UUID NOT NULL REFERENCES hc_encounters(id),
  patient_party_id UUID NOT NULL REFERENCES parties(id),
  order_type TEXT NOT NULL CHECK (order_type IN ('MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING')),
  order_status TEXT NOT NULL CHECK (order_status IN ('PENDING', 'VALIDATED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DISCONTINUED', 'REJECTED')),
  priority TEXT NOT NULL CHECK (priority IN ('STAT', 'URGENT', 'ROUTINE')),
  ordered_by UUID NOT NULL REFERENCES parties(id),
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_by UUID REFERENCES parties(id),
  approved_at TIMESTAMPTZ,
  discontinued_by UUID REFERENCES parties(id),
  discontinued_at TIMESTAMPTZ,
  discontinue_reason TEXT,
  cds_check_id UUID,
  cds_check_status TEXT CHECK (cds_check_status IN ('PASSED', 'WARNED', 'BLOCKED')),
  order_details JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_hc_clinical_orders_tenant ON hc_clinical_orders(tenant_id);
CREATE INDEX idx_hc_clinical_orders_encounter ON hc_clinical_orders(encounter_id);
CREATE INDEX idx_hc_clinical_orders_patient ON hc_clinical_orders(patient_party_id);
CREATE INDEX idx_hc_clinical_orders_status ON hc_clinical_orders(order_status);
CREATE INDEX idx_hc_clinical_orders_type ON hc_clinical_orders(order_type);

-- RLS (Tenant Isolation)
ALTER TABLE hc_clinical_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their tenant's orders"
  ON hc_clinical_orders
  FOR ALL
  USING (tenant_id = auth.jwt() ->> 'tenant_id'::text);
```

### STEP 7: Service Layer

**Files to Create:**
```
src/platform/healthcare/engines/order-engine/
├── order-engine.service.ts              # Main service
├── order-engine.interface.ts            # TypeScript interface
├── order-engine.factory.ts              # Factory pattern
└── __tests__/
    └── order-engine.service.test.ts     # 80+ unit tests
```

**Service Methods (from contract):**
```typescript
export class OrderEngineService implements OrderEngineContract {
  async createOrder(request: CreateOrderRequest): Promise<EngineResponse<CreateOrderResult>> {
    // 1. Validate encounter
    // 2. Validate provider authorization
    // 3. Run CDS check (if MEDICATION)
    // 4. Persist order
    // 5. Publish OrderCreated event
  }
  
  async approveOrder(request: ApproveOrderRequest): Promise<EngineResponse<ClinicalOrder>> {
    // 1. Validate order exists
    // 2. Validate status allows approval
    // 3. Update status
    // 4. Publish OrderApproved event
  }
  
  async discontinueOrder(request: DiscontinueOrderRequest): Promise<EngineResponse<ClinicalOrder>> {
    // 1. Validate order exists
    // 2. Validate status allows discontinuation
    // 3. Update status + reason
    // 4. Publish OrderDiscontinued event
  }
  
  async getActiveOrders(request: GetActiveOrdersRequest): Promise<EngineResponse<ClinicalOrder[]>> {
    // Query orders by encounter + status filter
  }
}
```

### STEP 8: Events

**Files to Create:**
```
src/platform/healthcare/engines/order-engine/
├── events/
│   ├── order-created.event.ts
│   ├── order-validated.event.ts
│   ├── order-approved.event.ts
│   ├── order-completed.event.ts
│   ├── order-discontinued.event.ts
│   └── index.ts
```

**Event Publishing Pattern (from Gate 1C):**
```typescript
// ✅ CORRECT: DB write BEFORE event publish
async createOrder(request: CreateOrderRequest): Promise<EngineResponse<CreateOrderResult>> {
  // 1. Persist to DB
  const order = await this.repository.create(orderData);
  
  // 2. Publish event AFTER successful DB write
  await this.eventBus.publish({
    eventType: 'OrderCreated',
    version: '1.0.0',
    payload: {
      orderId: order.id,
      encounterId: order.encounterId,
      orderType: order.orderType,
      tenantId: order.tenantId,
    },
  });
  
  return { success: true, data: { order, cdsAlerts: [], cdsCheckStatus: 'PASSED' } };
}
```

### STEP 9: Unit Tests (80+ tests)

**Test Files:**
```
src/platform/healthcare/engines/order-engine/__tests__/
├── clinical-order.entity.test.ts        # 20+ tests (domain logic)
├── order-status.vo.test.ts              # 5+ tests
├── order-type.vo.test.ts                # 5+ tests
├── order-engine.service.test.ts         # 50+ tests (service methods)
└── order-events.test.ts                 # 10+ tests (event publishing)
```

**Test Coverage:**
- Domain: State transitions, business rules, validation
- Service: createOrder, approveOrder, discontinueOrder, getActiveOrders
- Events: Event ordering, payload validation
- Error handling: Invalid encounter, duplicate order, status violation

### STEP 10: Integration Tests with Encounter (15+ tests)

**Test File:**
```
src/platform/healthcare/engines/order-engine/__tests__/
└── order-encounter-integration.test.ts  # 15+ tests
```

**Test Scenarios:**
1. ✅ Create order for valid encounter
2. ❌ Create order for non-existent encounter (should fail)
3. ❌ Create order for finished encounter (should fail)
4. ❌ Create order for cancelled encounter (should fail)
5. ✅ Create order with patient ID matching encounter
6. ❌ Create order with mismatched patient ID (should fail)
7. ✅ Order references encounter's patient automatically
8. ✅ Tenant isolation: Order for Tenant A not visible to Tenant B
9. ✅ Event ordering: DB write before event publish
10. ✅ Encounter transition (in-progress → finished) blocks new orders
11. ✅ Multiple orders for same encounter allowed
12. ✅ Order search by encounter ID
13. ✅ Order search by patient ID
14. ✅ Provider authorization validation
15. ✅ Idempotency: Same requestId returns same order

### STEP 11: Gate 4A Validation

**Validation Checklist:**
```
╔══════════════════════════════════════════════╗
║            GATE 4A - VALIDATION              ║
╠══════════════════════════════════════════════╣
║ Domain Tests         20+ PASS       [ ]      ║
║ Service Tests        50+ PASS       [ ]      ║
║ Integration Tests    15+ PASS       [ ]      ║
║ Smoke Tests           5+ PASS       [ ]      ║
║ Repository Tests     21+ PASS       [ ]      ║
║                                              ║
║ Total:              111+ PASS       [ ] 100% ║
╠══════════════════════════════════════════════╣
║ Encounter linkage validated         [ ]      ║
║ Tenant isolation enforced           [ ]      ║
║ Event ordering validated            [ ]      ║
║ Constitution compliance             [ ]      ║
║ Zero `any` types                    [ ]      ║
║ Repository tests fixed              [ ]      ║
╚══════════════════════════════════════════════╝
```

---

## 🔬 Test Strategy Improvements (vs Gate 1C)

### Lesson from DEBT-HC-001: Repository Test Suite

**Gate 1C Reality:**
- Encounter repository tests: 2/21 PASS
- Root cause: Test data bootstrap issues, not repository logic
- Result: DEBT-HC-001 tracked to Gate 4D

**Gate 4A Strategy:**
1. ✅ **Fix repository tests from start** (not defer to Gate 4D)
2. ✅ **Use real test data** (seed via `scripts/seed-healthcare-test-data.js`)
3. ✅ **Separate unit from integration** (mock DB in unit, real DB in integration)
4. ✅ **Test RLS policies** (cross-tenant access blocked)
5. ✅ **Test FK constraints** (encounter, patient, provider references)
6. ✅ **Test idempotency** (same requestId handled gracefully)

**Repository Test Coverage Target: 21/21 PASS**
```typescript
describe('SupabaseOrderRepository', () => {
  describe('Unit Tests (mocked Supabase)', () => {
    it('should create order with valid data');
    it('should throw error if encounter not found');
    it('should throw error if patient mismatch');
    it('should enforce tenant isolation');
    it('should handle database errors gracefully');
  });
  
  describe('Integration Tests (real Supabase)', () => {
    it('should create order and persist to DB');
    it('should enforce FK constraints (encounter)');
    it('should enforce RLS policies (tenant isolation)');
    it('should return order by ID');
    it('should search orders by encounter');
    it('should search orders by patient');
    it('should update order status');
    it('should delete order');
  });
});
```

---

## 📊 Progress Tracking

**Current Status:** STEP 3 Complete (Architecture Decision)

| Step | Task | Status | Tests | Effort |
|---|---|---|---|---|
| 1 | Read architecture docs | ✅ DONE | - | 30 min |
| 2 | Inventory contracts | ✅ DONE | - | 30 min |
| 3 | Architecture decision (ADR-011) | ✅ DONE | - | 1 hour |
| 4 | Enhance contract with events | ⏭️ NEXT | - | 2 hours |
| 5 | Domain aggregate | ⏳ TODO | 20+ | 6 hours |
| 6 | Repository + migration | ⏳ TODO | 21+ | 8 hours |
| 7 | Service layer | ⏳ TODO | 50+ | 10 hours |
| 8 | Events | ⏳ TODO | 10+ | 4 hours |
| 9 | Unit tests | ⏳ TODO | 80+ | 8 hours |
| 10 | Integration tests | ⏳ TODO | 15+ | 6 hours |
| 11 | Gate validation | ⏳ TODO | 111+ | 2 hours |

**Total Estimated Effort:** 47.5 hours (~6 days)

---

## 🎯 Success Criteria (Exit Gate 4A)

**ALL must be TRUE:**
- [ ] Order Engine Contract enhanced with 7 events
- [ ] Domain aggregate implements state machine correctly
- [ ] Repository tests: 21/21 PASS (no DEBT repeat)
- [ ] Service tests: 50+ PASS
- [ ] Integration tests with Encounter: 15/15 PASS
- [ ] Smoke tests: 5/5 PASS
- [ ] **Total: 111+ tests PASS (100%)**
- [ ] Encounter linkage validated (orders cannot bypass encounter)
- [ ] Tenant isolation enforced (RLS policies pass)
- [ ] Event ordering validated (DB write before publish)
- [ ] Constitution compliance: 11 Laws checked
- [ ] Zero `any` types (tsc --strict passes)
- [ ] Migration applied successfully (no rollback needed)
- [ ] Test data bootstrap extended (orders + encounters)

**Blocker Conditions (Gate CANNOT close if any are true):**
- ❌ Any test fails (even 110/111 is NOT acceptable)
- ❌ Repository tests deferred (DEBT-HC-001 repeat)
- ❌ Orders can be created without encounter validation
- ❌ Cross-tenant orders visible (RLS failure)
- ❌ Events published before DB write
- ❌ Any `any` types found in Order Engine code

---

**Plan Version:** 1.0  
**Created:** 2026-08-12  
**Owner:** Healthcare Platform Team  
**Next Step:** STEP 4 - Enhance Order Engine Contract with Events
