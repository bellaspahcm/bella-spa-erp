# Phase 4: Cross-Engine Healthcare Kernel Roadmap

**Status:** 🟡 PLANNED  
**Start Date:** 2026-08-12  
**Owner:** Healthcare Platform Team  
**Goal:** Prove Bella Healthcare can scale from single engine (Encounter) to cross-engine workflows without breaking Meta-Platform invariants.

---

## 🎯 Strategic Rationale

**Why Pharmacy + Clinical Order (not UI or Event Sourcing)?**

Gate 1C proved **single-engine architecture**:
```
Service → Repository → DB → Events (validated ✅)
```

Phase 4 must prove **multi-engine orchestration**:
```
Encounter Engine
   ↓
Clinical Order Engine
   ↓
Pharmacy Engine
   ↓
Cross-Engine Events
   ↓
Inventory / Revenue Engines
```

**Key Architecture Question:**
> Can Bella Healthcare Kernel coordinate multiple engines in a business workflow while maintaining:
> - Tenant isolation across engines?
> - Event ordering across engines?
> - Transaction boundaries across engines?
> - Constitution compliance (11 Laws)?

**Answer:** Phase 4 will prove YES or reveal architectural gaps.

---

## 📋 Phase 4 Gate Structure

```
PHASE 4
   │
   ├── Gate 4A: Clinical Order Foundation
   │     └── Order Aggregate, lifecycle, events
   │
   ├── Gate 4B: Pharmacy Engine
   │     └── Medication catalog, dispensing, MAR
   │
   ├── Gate 4C: Cross-Engine Integration
   │     └── End-to-end: Encounter → Order → Pharmacy
   │
   └── Gate 4D: Quality & Debt Resolution
         └── DEBT-HC-001, benchmarks, load tests
```

---

## 🔴 Gate 4A: Clinical Order Foundation

**Duration:** 2-3 weeks  
**Test Target:** 150+ tests (unit + integration + smoke)  
**Acceptance:** Order Engine validated in isolation (like Gate 1C for Encounter)

### Scope

#### 1. Domain Model
- **Order Aggregate Root**
  - Order ID (UUID)
  - Order type (medication, lab, imaging, procedure)
  - Order status (draft, active, completed, cancelled, error)
  - Priority (routine, urgent, stat, asap)
  - Clinical indication (reason, diagnosis codes)
  - Ordering provider
  - Encounter reference
  - Patient reference
  - Tenant ID

- **Order Lifecycle State Machine**
  ```
  draft → submitted → active → completed
           ↓          ↓
       cancelled   on-hold
                     ↓
                  active
  ```

- **Business Rules**
  - Provider must have authorization to order
  - Encounter must be active
  - Patient must belong to encounter
  - Tenant isolation enforced
  - Audit trail required

#### 2. Service Layer
- **OrderEngineService**
  - `createOrder(request: CreateOrderRequest): Promise<Order>`
  - `updateOrderStatus(request: UpdateOrderStatusRequest): Promise<Order>`
  - `cancelOrder(request: CancelOrderRequest): Promise<Order>`
  - `getOrder(orderId: string, tenantId: string): Promise<Order>`
  - `searchOrders(query: OrderSearchQuery): Promise<Order[]>`

#### 3. Repository Layer
- **SupabaseOrderRepository**
  - Table: `hc_clinical_orders`
  - Indexes: tenant_id, encounter_id, patient_party_id, ordering_provider_id, status
  - RLS: Tenant isolation
  - FK constraints: encounter, patient, provider

#### 4. Event Contracts
- `OrderCreated`
- `OrderStatusChanged`
- `OrderCancelled`
- `OrderCompleted`
- `OrderFailed`

#### 5. Integration with Encounter Engine
- Order MUST reference valid Encounter ID
- Encounter status must allow ordering (not finished/cancelled)
- Event bus propagates order events to encounter subscribers

### Deliverables

1. ✅ **Domain**
   - Order entity with state machine
   - Order value objects (OrderType, OrderPriority)
   - Order business rules

2. ✅ **Service**
   - OrderEngineService with 5+ methods
   - Provider authorization validation
   - Encounter linkage validation

3. ✅ **Repository**
   - SupabaseOrderRepository
   - Migration: `hc_clinical_orders` table
   - Test data bootstrap extension

4. ✅ **Events**
   - 5 domain events defined
   - Contract registration
   - Event validation tests

5. ✅ **Tests**
   - Unit tests: 80+ (domain + service)
   - Integration tests: 15+ (service → repository → DB → events)
   - Smoke tests: 5+ (DB connection, insert, query, update, delete)

### Gate 4A Acceptance Criteria

```
╔══════════════════════════════════════════════╗
║            GATE 4A - ACCEPTANCE              ║
╠══════════════════════════════════════════════╣
║ Unit Tests           80+ PASS       ✅       ║
║ Integration Tests    15+ PASS       ✅       ║
║ Smoke Tests           5+ PASS       ✅       ║
║                                              ║
║ Total:              100+ PASS       ✅ 100%  ║
╠══════════════════════════════════════════════╣
║ Encounter linkage validated         ✅       ║
║ Tenant isolation enforced           ✅       ║
║ Event ordering validated            ✅       ║
║ Constitution compliance             ✅       ║
╚══════════════════════════════════════════════╝
```

---

## 🟡 Gate 4B: Pharmacy Engine

**Duration:** 2-3 weeks  
**Test Target:** 150+ tests  
**Acceptance:** Pharmacy Engine validated in isolation

### Scope

#### 1. Domain Model
- **Medication Aggregate**
  - Drug ID, name, generic name
  - Form (tablet, capsule, syrup, injection)
  - Strength, unit
  - Drug class, therapeutic category
  - Controlled substance schedule (if applicable)

- **Prescription Aggregate**
  - Prescription ID (UUID)
  - Order reference (Clinical Order)
  - Medication reference
  - Dosage, frequency, duration
  - Route (oral, IV, IM, topical, etc.)
  - Instructions
  - Quantity dispensed
  - Refills allowed
  - Status (pending, dispensed, on-hold, cancelled)

- **MAR (Medication Administration Record)**
  - MAR entry ID
  - Prescription reference
  - Encounter reference
  - Patient reference
  - Scheduled time
  - Actual administration time
  - Administered by (nurse/provider)
  - Status (scheduled, administered, refused, held, missed)
  - Notes

#### 2. Service Layer
- **PharmacyEngineService**
  - `createPrescription(request: CreatePrescriptionRequest): Promise<Prescription>`
  - `dispenseMedication(request: DispenseMedicationRequest): Promise<Prescription>`
  - `recordMAR(request: RecordMARRequest): Promise<MAREntry>`
  - `checkDrugInteraction(drugIds: string[]): Promise<InteractionResult>`
  - `getMedicationHistory(patientId: string, tenantId: string): Promise<MAREntry[]>`

#### 3. Repository Layer
- **SupabasePharmacyRepository**
  - Tables: `hc_medications`, `hc_prescriptions`, `hc_medication_administration`
  - RLS: Tenant isolation
  - FK: order, patient, provider, encounter

#### 4. Event Contracts
- `PrescriptionCreated`
- `MedicationDispensed`
- `MedicationAdministered`
- `MedicationRefused`
- `DrugInteractionDetected`

#### 5. Integration with Clinical Order Engine
- Prescription MUST reference valid Clinical Order (type = medication)
- Order status must be "active"
- Event bus propagates pharmacy events to order subscribers

### Deliverables

1. ✅ **Domain**
   - Medication, Prescription, MAR entities
   - Pharmacy business rules
   - Drug interaction checking (basic)

2. ✅ **Service**
   - PharmacyEngineService with 5+ methods
   - Order linkage validation
   - Dispensing workflow

3. ✅ **Repository**
   - SupabasePharmacyRepository
   - Migrations: 3 tables
   - Test data: medication catalog

4. ✅ **Events**
   - 5 domain events
   - Contract registration
   - Event validation

5. ✅ **Tests**
   - Unit tests: 80+
   - Integration tests: 15+
   - Smoke tests: 5+

### Gate 4B Acceptance Criteria

```
╔══════════════════════════════════════════════╗
║            GATE 4B - ACCEPTANCE              ║
╠══════════════════════════════════════════════╣
║ Unit Tests           80+ PASS       ✅       ║
║ Integration Tests    15+ PASS       ✅       ║
║ Smoke Tests           5+ PASS       ✅       ║
║                                              ║
║ Total:              100+ PASS       ✅ 100%  ║
╠══════════════════════════════════════════════╣
║ Order linkage validated             ✅       ║
║ Medication catalog loaded           ✅       ║
║ MAR recording validated             ✅       ║
║ Drug interaction check working      ✅       ║
╚══════════════════════════════════════════════╝
```

---

## 🟢 Gate 4C: Cross-Engine Integration

**Duration:** 1-2 weeks  
**Test Target:** 50+ integration tests  
**Acceptance:** End-to-end workflow validated across 3 engines

### Scope

#### Cross-Engine Workflow: Medication Order

```
1. Create Encounter (Encounter Engine)
   ↓
2. Create Medication Order (Clinical Order Engine)
   ↓
3. Create Prescription (Pharmacy Engine)
   ↓
4. Dispense Medication (Pharmacy Engine)
   ↓
5. Record MAR Administration (Pharmacy Engine)
   ↓
6. Complete Order (Clinical Order Engine)
   ↓
7. Update Encounter (Encounter Engine - order completed event subscriber)
```

### Test Scenarios

#### 1. Happy Path
- Create encounter → order → prescription → dispense → administer → complete
- All events published in correct order
- All state transitions valid
- Tenant isolation maintained across all engines

#### 2. Error Scenarios
- Order created for finished encounter (should fail)
- Prescription created for cancelled order (should fail)
- Dispense medication for inactive prescription (should fail)
- Administer medication for different patient (should fail)
- Cross-tenant order reference (should fail)

#### 3. Event Ordering
- DB write before event publish (across all engines)
- Events propagate to subscribers in correct order
- No lost events
- No duplicate events

#### 4. Transaction Boundaries
- Order creation failure doesn't leave orphan prescription
- Dispensing failure rolls back inventory deduction
- MAR recording failure doesn't mark as administered

### Deliverables

1. ✅ **End-to-End Tests**
   - 10+ happy path scenarios
   - 15+ error scenarios
   - 10+ event ordering tests
   - 10+ transaction boundary tests

2. ✅ **Event Orchestration**
   - Order created → Pharmacy subscribes
   - Medication dispensed → Order updates
   - MAR administered → Encounter dashboard updates

3. ✅ **Documentation**
   - Cross-engine workflow diagrams
   - Event flow documentation
   - Error handling patterns

### Gate 4C Acceptance Criteria

```
╔══════════════════════════════════════════════╗
║            GATE 4C - ACCEPTANCE              ║
╠══════════════════════════════════════════════╣
║ End-to-End Tests     50+ PASS       ✅       ║
║ Event Ordering       ✅ Validated            ║
║ Transaction Safety   ✅ Enforced             ║
║ Cross-Tenant Block   ✅ Working              ║
║                                              ║
║ CROSS-ENGINE ARCH    ✅ PROVEN               ║
╚══════════════════════════════════════════════╝
```

**Success Definition:**
> Bella Healthcare proves it can coordinate 3 engines (Encounter, Order, Pharmacy) in a real clinical workflow with zero architecture violations.

---

## 🔵 Gate 4D: Quality & Debt Resolution

**Duration:** 1 week  
**Test Target:** DEBT-HC-001 closed, benchmarks added  
**Acceptance:** Zero P1/P2 debt, performance validated

### Scope

#### 1. DEBT-HC-001 Resolution
- Fix repository test suite: 2/21 → 21/21 PASS
- Extend test data bootstrap
- Separate unit from integration tests
- Update documentation

#### 2. Performance Benchmarks
- Query by ID: < 50ms
- Query by tenant: < 100ms
- Insert encounter: < 200ms
- Event publishing: < 50ms
- Cross-engine workflow: < 2s (end-to-end)

#### 3. Load Testing
- 100 concurrent encounter creations
- 1000 queries/second
- Event bus throughput: 500 events/second
- No deadlocks, no race conditions

#### 4. Regression Suite
- All Gate 1C tests: 322/322 PASS
- All Gate 4A tests: 100+ PASS
- All Gate 4B tests: 100+ PASS
- All Gate 4C tests: 50+ PASS
- **Total: 572+ tests PASS**

### Gate 4D Acceptance Criteria

```
╔══════════════════════════════════════════════╗
║            GATE 4D - ACCEPTANCE              ║
╠══════════════════════════════════════════════╣
║ DEBT-HC-001          ✅ CLOSED               ║
║ Repository Tests     21/21 PASS     ✅       ║
║ Performance          ✅ BENCHMARKED          ║
║ Load Tests           ✅ PASSED               ║
║ Regression Suite     572+ PASS      ✅       ║
╚══════════════════════════════════════════════╝
```

---

## 📊 Phase 4 Success Metrics

```
BEFORE Phase 4 (Gate 1C):
├── Engines:          1 (Encounter)
├── Test Coverage:    322 tests
├── Architecture:     Single-engine validated
└── Cross-Engine:     NOT PROVEN

AFTER Phase 4 (Gate 4D):
├── Engines:          3 (Encounter, Order, Pharmacy)
├── Test Coverage:    572+ tests
├── Architecture:     Cross-engine validated ✅
└── Debt:             Zero P1/P2 debt ✅
```

**Key Architecture Proof Points:**
1. ✅ Multi-engine orchestration without platform violation
2. ✅ Event-driven coordination across engines
3. ✅ Transaction boundaries across engines
4. ✅ Tenant isolation across engines
5. ✅ Constitution compliance across engines (11 Laws)

---

## 🚫 Out of Scope (Defer to Phase 5+)

**Do NOT implement in Phase 4:**
- Hospital Product Pack UI
- Event Sourcing / CQRS
- Saga orchestration framework
- Multi-region deployment
- Chaos testing
- AI/CDS engine integration
- Full drug interaction database

**Rationale:** Phase 4 proves **cross-engine architecture**. Features above are Phase 5+ (after architecture proven).

---

## 📅 Timeline

```
Week 1-3:  Gate 4A (Clinical Order Foundation)
Week 4-6:  Gate 4B (Pharmacy Engine)
Week 7-8:  Gate 4C (Cross-Engine Integration)
Week 9:    Gate 4D (Quality & Debt)

Total: 9 weeks (~2 months)
```

**Milestones:**
- Week 3: Gate 4A CLOSED
- Week 6: Gate 4B CLOSED
- Week 8: Gate 4C CLOSED (🎯 Architecture Proof Complete)
- Week 9: Gate 4D CLOSED (Quality Validated)

---

## 🎯 Phase 4 Exit Criteria

**ALL of the following must be TRUE:**
- [ ] Gate 4A: 100+ tests PASS (Clinical Order isolated)
- [ ] Gate 4B: 100+ tests PASS (Pharmacy isolated)
- [ ] Gate 4C: 50+ tests PASS (Cross-engine integration)
- [ ] Gate 4D: DEBT-HC-001 CLOSED + benchmarks added
- [ ] Total test suite: 572+ tests PASS
- [ ] Zero P1/P2 technical debt
- [ ] Constitution compliance: 95/100 (all 11 laws)
- [ ] Cross-engine workflow: Encounter → Order → Pharmacy (end-to-end validated)

**Phase 4 Success Statement:**
> Bella Healthcare Kernel has proven it can orchestrate multiple engines in a real clinical workflow (medication ordering) without violating Meta-Platform architecture invariants. Foundation ready for Hospital Product Pack (Phase 5).

---

**Roadmap Version:** 1.0  
**Created:** 2026-08-12  
**Owner:** Healthcare Platform Team  
**Next Review:** Week 3 (Gate 4A closure)
