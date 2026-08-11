# Encounter Engine Gap Analysis (Gate 0 Audit)

**Date:** 2026-08-11  
**Engine:** Encounter Engine (Aggregate Root - Constitution Law 1)  
**Status:** Pre-Implementation Audit  
**Auditor:** Platform Team

---

## Executive Summary

**Current State:** Encounter Engine directory EXISTS but is EMPTY. No implementation, no contract, no tests.

**Critical Finding:** Hospital currently uses `InpatientAdmissionService` from legacy services (`healthcare-hospital-services.ts`) instead of Encounter Engine. This violates Constitution Law 2 (No direct DB access from product packs).

**Severity:** **HIGH** - Encounter is the Aggregate Root (Law 1). Without it, no other engine can function correctly.

**Recommendation:** Implement Encounter Engine FIRST before Bed/Nursing engines. All Hospital pages depend on it.

---

## Detailed Gap Analysis

### 1. Domain Model

| Component | Existing | Missing | Decision |
|-----------|----------|---------|----------|
| **Encounter interface** | ✅ `src/platform/healthcare/shared-kernel/types.ts` | ❌ No domain entity class | **CREATE**: Encounter domain entity with business rules |
| **EncounterType** | ✅ Defined in types | ❌ No enum/validation | **CREATE**: Runtime validation for type |
| **EncounterClass** | ✅ Defined in types | ❌ No enum/validation | **CREATE**: Runtime validation for class |
| **EncounterStatus** | ✅ Defined in types (7 states) | ❌ No state machine | **CREATE**: State machine (planned → arrived → in-progress → finished) |
| **Diagnosis** | ✅ ICD-10 interface | ❌ No validation | **CREATE**: ICD-10 code validator |
| **Period** | ✅ Start/end datetime | ❌ No period validation | **CREATE**: Validate start < end, no overlaps |

**Key Finding:** Types exist but no business logic. Need rich domain entity with invariants.

---

### 2. Aggregate Root Behavior

| Behavior | Existing | Missing | Decision |
|----------|----------|---------|----------|
| **Create encounter** | ❌ None | ❌ createEncounter() | **IMPLEMENT**: Factory method with validation |
| **Arrive patient** | ❌ None | ❌ arrive() | **IMPLEMENT**: Transition planned → arrived |
| **Start encounter** | ❌ None | ❌ start() | **IMPLEMENT**: Transition arrived → in-progress |
| **Finish encounter** | ❌ None | ❌ finish() | **IMPLEMENT**: Transition in-progress → finished |
| **Cancel encounter** | ❌ None | ❌ cancel() | **IMPLEMENT**: Transition any → cancelled |
| **Add diagnosis** | ❌ None | ❌ addDiagnosis() | **IMPLEMENT**: Validate ICD-10, enforce primary diagnosis |
| **Update service provider** | ❌ None | ❌ assignProvider() | **IMPLEMENT**: Change doctor/practitioner |
| **Transfer department** | ❌ None | ❌ transfer() | **IMPLEMENT**: Change location/department |

**Critical Gap:** NO lifecycle management. Current legacy service only has "create admission" (not encounter).

---

### 3. State Machine

| State | Valid Transitions | Existing | Missing | Decision |
|-------|-------------------|----------|---------|----------|
| **planned** | → arrived, cancelled | ❌ None | ❌ All | **IMPLEMENT**: Initial state |
| **arrived** | → triaged, in-progress, cancelled | ❌ None | ❌ All | **IMPLEMENT**: Patient checked in |
| **triaged** | → in-progress, cancelled | ❌ None | ❌ All | **IMPLEMENT**: Emergency triage complete |
| **in-progress** | → on-hold, finished, cancelled | ❌ None | ❌ All | **IMPLEMENT**: Active encounter |
| **on-hold** | → in-progress, finished, cancelled | ❌ None | ❌ All | **IMPLEMENT**: Temporarily paused |
| **finished** | ❌ Terminal state | ❌ None | ❌ Enforcement | **IMPLEMENT**: No further transitions |
| **cancelled** | ❌ Terminal state | ❌ None | ❌ Enforcement | **IMPLEMENT**: No further transitions |

**Critical Gap:** NO state machine. Legacy service allows invalid state transitions.

---

### 4. Persistence

| Component | Existing | Missing | Decision |
|-----------|----------|---------|----------|
| **Database table** | ❌ None | ❌ `hc_encounters` | **CREATE**: Migration with full schema |
| **Encounter repository** | ❌ None | ❌ IEncounterRepository | **CREATE**: Interface for DB operations |
| **Repository implementation** | ❌ None | ❌ SupabaseEncounterRepository | **CREATE**: Supabase adapter |
| **Query methods** | ❌ None | ❌ getById, searchByPatient, etc. | **CREATE**: Query API |
| **RLS policies** | ❌ None | ❌ Tenant isolation | **CREATE**: `tenant_id` RLS |
| **Indexes** | ❌ None | ❌ Performance indexes | **CREATE**: Index on patient_id, tenant_id, status, period |
| **Audit columns** | ❌ None | ❌ created_by, updated_by | **CREATE**: Audit trail |

**Current Violation:** Legacy service queries `hc_inpatient_admissions` directly (violates Law 2). Admission is NOT the aggregate root, Encounter is.

---

### 5. Contract (API Interface)

| Component | Existing | Missing | Decision |
|-----------|----------|---------|----------|
| **Contract file** | ❌ None | ❌ `encounter-engine.contract.ts` | **CREATE**: Full API contract |
| **IEncounterEngine interface** | ❌ None | ❌ All methods | **CREATE**: Contract interface |
| **Request DTOs** | ❌ None | ❌ CreateEncounterRequest, etc. | **CREATE**: Strongly typed requests |
| **Response DTOs** | ❌ None | ❌ EncounterResponse | **CREATE**: Strongly typed responses |
| **Error codes** | ❌ None | ❌ Typed errors | **CREATE**: EncounterError enum |
| **Contract registration** | ❌ None | ❌ Register in Contract Registry | **CREATE**: Register on engine startup |
| **Versioning** | ❌ None | ❌ v1.0.0 | **CREATE**: Semantic versioning |

**Gap:** No contract exists. Cannot consume engine from Hospital pages.

---

### 6. Events (Domain Events)

| Event | Existing | Missing | Decision |
|-------|----------|---------|----------|
| **EncounterCreated** | ❌ None | ❌ Event definition | **CREATE**: Published on create |
| **EncounterArrived** | ⚠️ Mentioned in test | ❌ Implementation | **CREATE**: Published on arrive |
| **EncounterStarted** | ❌ None | ❌ Event definition | **CREATE**: Published on start |
| **EncounterFinished** | ❌ None | ❌ Event definition | **CREATE**: Published on finish |
| **EncounterCancelled** | ❌ None | ❌ Event definition | **CREATE**: Published on cancel |
| **DiagnosisAdded** | ❌ None | ❌ Event definition | **CREATE**: Published when diagnosis added |
| **ProviderAssigned** | ❌ None | ❌ Event definition | **CREATE**: Published when provider changes |
| **Event Bus integration** | ❌ None | ❌ Publish to Event Bus | **CREATE**: Integrate with platform Event Bus |
| **Event schemas** | ❌ None | ❌ JSON Schema validation | **CREATE**: Event contract schemas |

**Current State:** `EncounterSaga` exists in test files but no actual event publishing in production code.

---

### 7. Authorization & Security

| Component | Existing | Missing | Decision |
|-----------|----------|---------|----------|
| **RLS policies** | ❌ None | ❌ Tenant isolation | **CREATE**: `tenant_id = auth.jwt() -> 'tenant_id'` |
| **RBAC checks** | ❌ None | ❌ Permission checks | **CREATE**: Check `clinical.encounter.create`, etc. |
| **Capability checks** | ❌ None | ❌ Check hospital_inpatient capability | **CREATE**: Validate capability before operations |
| **Break-glass support** | ⚠️ Service exists | ❌ Not integrated | **INTEGRATE**: Allow emergency access |
| **Audit logging** | ❌ None | ❌ created_by, updated_by, action logs | **CREATE**: Full audit trail |
| **Data encryption** | ❌ None | ❌ Encrypt diagnosis, reason | **CREATE**: Field-level encryption |

**Security Gap:** Legacy service has NO tenant isolation checks in code (relies on DB RLS only).

---

### 8. Unit Tests

| Test Category | Existing | Missing | Decision |
|---------------|----------|---------|----------|
| **Domain entity tests** | ❌ None | ❌ 20+ test cases | **CREATE**: Test state machine, invariants |
| **State transition tests** | ❌ None | ❌ Valid/invalid transitions | **CREATE**: Test all 7 states |
| **Business rule tests** | ❌ None | ❌ Period validation, diagnosis rules | **CREATE**: Test all invariants |
| **Error handling tests** | ❌ None | ❌ Invalid input, duplicate keys | **CREATE**: Test error paths |
| **Mock repository** | ❌ None | ❌ In-memory repository for testing | **CREATE**: Fake implementation |

**Coverage:** 0%. No tests exist.

---

### 9. Integration Tests

| Test Category | Existing | Missing | Decision |
|---------------|----------|---------|----------|
| **Database tests** | ❌ None | ❌ CRUD operations | **CREATE**: Test with real Supabase client |
| **Event Bus tests** | ⚠️ Saga test exists | ❌ Production event publishing | **CREATE**: Test events published correctly |
| **RLS tests** | ❌ None | ❌ Tenant isolation | **CREATE**: Test cross-tenant access blocked |
| **Transaction tests** | ❌ None | ❌ Rollback on error | **CREATE**: Test atomicity |
| **Performance tests** | ❌ None | ❌ Load testing | **CREATE**: Test with 1000+ encounters |

**Current Testing:** Only `EncounterSaga` test exists, but it's for Saga pattern, not production engine.

---

### 10. Hospital Integration

| Component | Current (Legacy) | Target (Platform Engine) | Decision |
|-----------|------------------|--------------------------|----------|
| **Admissions page** | ✅ Uses `InpatientAdmissionService` | ❌ No engine integration | **MIGRATE**: Use `useEncounterEngine()` hook |
| **Dashboard page** | ✅ Uses legacy service | ❌ No engine integration | **MIGRATE**: Use platform engine |
| **MAR page** | ✅ Uses legacy service | ❌ No engine integration | **MIGRATE**: Use platform engine |
| **Nursing vitals page** | ✅ Uses legacy service | ❌ No engine integration | **MIGRATE**: Use platform engine |
| **React hooks** | ❌ None | ❌ `useEncounterEngine()` | **CREATE**: Hospital-facing hooks |
| **API routes** | ❌ None | ❌ `/api/v1/healthcare/encounters` | **CREATE**: Next.js API routes |

**Current Architecture Violation:**

```typescript
// ❌ WRONG (Current):
src/app/dashboard/hospital/admissions/page.tsx
  ↓
InpatientAdmissionService (legacy)
  ↓
Direct supabase.from('hc_inpatient_admissions') query
  ↓
Database

// ✅ CORRECT (Target):
src/app/dashboard/hospital/admissions/page.tsx
  ↓
useEncounterEngine() hook
  ↓
Encounter Engine (platform)
  ↓
Healthcare Shared Kernel
  ↓
Database + Event Bus
```

**Hospital Pages Using Legacy:**
1. `/dashboard/hospital/admissions/page.tsx` (create admission, discharge)
2. `/dashboard/hospital/page.tsx` (dashboard stats)
3. `/dashboard/hospital/mar/page.tsx` (load admissions)
4. `/dashboard/hospital/nursing-vitals/page.tsx` (load admissions)

**Critical Dependency:** All 4 pages call `InpatientAdmissionService.getInpatientAdmissions()` which queries `hc_inpatient_admissions` directly.

---

### 11. Legacy Migration

| Component | Current | Target | Decision |
|-----------|---------|--------|----------|
| **Legacy service** | ✅ `InpatientAdmissionService` (539 LOC) | ❌ Adapter not created | **CREATE**: Adapter with feature flag |
| **Feature flag** | ❌ None | ❌ `healthcare.new-encounter-engine` | **CREATE**: Feature flag for rollout |
| **Adapter pattern** | ❌ None | ❌ Dual-path (legacy + engine) | **CREATE**: Adapter routes to old/new based on flag |
| **Parity testing** | ❌ None | ❌ Compare old vs new output | **CREATE**: Validate same results |
| **Deprecation plan** | ❌ None | ❌ Mark legacy deprecated | **CREATE**: @deprecated annotation |
| **Removal timeline** | ❌ None | ❌ 4 weeks after 100% rollout | **PLAN**: Remove after validation |

**Migration Risk:** Current `InpatientAdmissionService` has 4 classes, ~539 lines. Cannot remove until encounter engine reaches parity.

---

### 12. Data Model Mismatch

**Critical Issue:** Current system uses `hc_inpatient_admissions` as primary entity, but Constitution Law 1 mandates **Encounter** as aggregate root.

| Entity | Current (Wrong) | Target (Correct) | Relationship |
|--------|-----------------|------------------|--------------|
| **Aggregate Root** | ❌ InpatientAdmission | ✅ Encounter | Encounter is parent |
| **Inpatient admission** | ❌ Primary entity | ✅ Child of Encounter | admission references encounter_id |
| **Bed allocation** | ❌ Direct in admission | ✅ Separate Bed Engine | Bed references encounter_id |
| **Vitals** | ❌ References admission_id | ✅ References encounter_id | Must change FK |
| **MAR** | ❌ References admission_id | ✅ References encounter_id | Must change FK |

**Database Migration Required:**

```sql
-- Current (WRONG):
CREATE TABLE hc_inpatient_admissions (
  id UUID PRIMARY KEY,
  encounter_id UUID,  -- ← Currently just a field, not FK
  patient_id UUID,
  ...
);

-- Target (CORRECT):
CREATE TABLE hc_encounters (
  id UUID PRIMARY KEY,
  patient_id UUID,
  encounter_type TEXT,
  status TEXT,
  ...
);

CREATE TABLE hc_inpatient_admissions (
  id UUID PRIMARY KEY,
  encounter_id UUID REFERENCES hc_encounters(id), -- ← FK constraint
  bed_id UUID,
  ...
);
```

**Impact:** All Hospital pages need to query encounters first, then load related admissions/beds/vitals.

---

## Implementation Plan (Gate 0 → Gate 1)

### Phase 1: Foundation (Week 1 Days 1-2)

**Domain Layer:**
- [ ] Create `Encounter` domain entity class
- [ ] Implement state machine (7 states, transition rules)
- [ ] Implement business rules (period validation, diagnosis validation)
- [ ] Create domain events (7 event types)
- [ ] Write 20+ unit tests (state machine, invariants)

**Expected Output:**
```typescript
// src/platform/healthcare/engines/encounter-engine/domain/encounter.entity.ts
export class Encounter {
  private constructor(private props: EncounterProps) {}
  
  static create(data: CreateEncounterData): Encounter { ... }
  arrive(): void { ... }
  start(): void { ... }
  finish(): void { ... }
  cancel(): void { ... }
  
  private assertCanTransition(to: EncounterStatus): void { ... }
}
```

### Phase 2: Persistence (Week 1 Days 3-4)

**Database:**
- [ ] Create migration: `20260811000000_create_encounters_table.sql`
- [ ] Add RLS policies (tenant isolation)
- [ ] Add indexes (performance)
- [ ] Add audit columns

**Repository:**
- [ ] Create `IEncounterRepository` interface
- [ ] Implement `SupabaseEncounterRepository`
- [ ] Write 10+ integration tests (CRUD, RLS, transactions)

**Expected Output:**
```sql
CREATE TABLE hc_encounters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES party_tenants(id),
  patient_id UUID NOT NULL,
  encounter_type TEXT NOT NULL,
  encounter_class TEXT NOT NULL,
  status TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ,
  service_provider_id UUID,
  department_id UUID,
  location_id UUID,
  reason_code TEXT[],
  diagnosis JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- RLS
ALTER TABLE hc_encounters ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON hc_encounters FOR ALL USING (tenant_id = auth.jwt() ->> 'tenant_id'::TEXT::UUID);
```

### Phase 3: Service & Contract (Week 1 Days 4-5)

**Service Layer:**
- [ ] Create `EncounterEngineService` class
- [ ] Implement all business methods
- [ ] Integrate Event Bus (publish events)
- [ ] Error handling (typed errors)

**Contract:**
- [ ] Create `encounter-engine.contract.ts`
- [ ] Define `IEncounterEngine` interface
- [ ] Define Request/Response DTOs
- [ ] Register in Contract Registry
- [ ] Write 15+ contract tests

**Expected Output:**
```typescript
// src/platform/healthcare/contracts/encounter-engine.contract.ts
export interface IEncounterEngine extends EngineContract {
  createEncounter(request: CreateEncounterRequest): Promise<EngineResponse<Encounter>>;
  getEncounter(encounterId: string): Promise<EngineResponse<Encounter>>;
  arrivePatient(encounterId: string): Promise<EngineResponse<Encounter>>;
  startEncounter(encounterId: string): Promise<EngineResponse<Encounter>>;
  finishEncounter(encounterId: string, summary: string): Promise<EngineResponse<Encounter>>;
  cancelEncounter(encounterId: string, reason: string): Promise<EngineResponse<Encounter>>;
  addDiagnosis(encounterId: string, diagnosis: Diagnosis): Promise<EngineResponse<Encounter>>;
  searchEncounters(query: EncounterSearchQuery): Promise<EngineResponse<Encounter[]>>;
}
```

### Phase 4: Hospital Integration (Week 2 Days 1-3)

**React Hooks:**
- [ ] Create `useEncounterEngine()` hook
- [ ] Create `useEncounterQuery()` hook
- [ ] Handle loading/error states
- [ ] Cache with React Query

**Adapter Layer:**
- [ ] Create adapter for `InpatientAdmissionService`
- [ ] Implement feature flag routing
- [ ] Ensure backward compatibility
- [ ] Parity testing (old vs new output)

**Expected Output:**
```typescript
// src/products/bella-hospital/hooks/use-encounter-engine.ts
export function useEncounterEngine() {
  const { createEncounter, arrivePatient, startEncounter, finishEncounter } = usePlatformEngine<IEncounterEngine>('encounter-engine');
  
  return {
    createEncounter: useCallback(async (data) => {
      if (await featureFlags.isEnabled('healthcare.new-encounter-engine')) {
        return createEncounter(data); // NEW
      } else {
        return legacyCreateAdmission(data); // OLD
      }
    }, []),
    // ... other methods
  };
}
```

### Phase 5: Migration & Testing (Week 2 Days 4-5)

**Hospital Pages Migration:**
- [ ] Migrate `/dashboard/hospital/admissions/page.tsx`
- [ ] Update to use `useEncounterEngine()` instead of legacy service
- [ ] Test create encounter flow
- [ ] Test discharge flow
- [ ] Validate event publishing

**E2E Testing:**
- [ ] Write E2E test: Create encounter → Arrive → Start → Finish
- [ ] Test with feature flag ON
- [ ] Test with feature flag OFF (legacy path)
- [ ] Validate events published to Event Bus
- [ ] Performance testing (response time <500ms)

**Deployment:**
- [ ] Deploy to staging
- [ ] Feature flag: 10% rollout
- [ ] Monitor errors/performance
- [ ] Gradual rollout: 10% → 50% → 100%

---

## Gate 1 Definition of Done

### Encounter Engine = Production-Ready when:

**✅ Domain Layer:**
- [ ] Encounter entity with full state machine
- [ ] 7 states with transition rules enforced
- [ ] Business rules: period validation, diagnosis validation
- [ ] 7 domain events defined and published
- [ ] 20+ unit tests passing

**✅ Persistence:**
- [ ] `hc_encounters` table created with migration
- [ ] RLS policies (tenant isolation)
- [ ] Indexes for performance
- [ ] Audit trail (created_by, updated_by)
- [ ] 10+ integration tests passing

**✅ Service & Contract:**
- [ ] `EncounterEngineService` with 8+ methods
- [ ] Contract registered in Contract Registry
- [ ] Event Bus integration (events published)
- [ ] Typed errors (no generic catch)
- [ ] 15+ contract tests passing

**✅ Hospital Integration:**
- [ ] `useEncounterEngine()` hook created
- [ ] Admissions page uses platform engine (NOT legacy)
- [ ] Adapter with feature flag (dual-path)
- [ ] Parity tests pass (old vs new output identical)

**✅ Testing:**
- [ ] 50+ tests total (unit + integration + E2E)
- [ ] E2E test: Full encounter lifecycle
- [ ] Performance test: <500ms response time
- [ ] Load test: 1000+ concurrent encounters

**✅ Legacy Migration:**
- [ ] Adapter created (feature flag routing)
- [ ] Parity validated (same output as legacy)
- [ ] Feature flag deployed to production
- [ ] 100% rollout successful
- [ ] Legacy service marked @deprecated

**✅ Governance:**
- [ ] Contract registered
- [ ] Capability registered
- [ ] Feature flag created
- [ ] Rollback plan documented
- [ ] Metrics dashboard (encounter creation rate, errors)

---

## Critical Decisions

### Decision 1: Encounter vs Admission as Aggregate Root

**Question:** Should we keep `InpatientAdmission` as primary entity or migrate to `Encounter`?

**Answer:** ✅ **MIGRATE to Encounter**

**Rationale:**
- Constitution Law 1 explicitly mandates Encounter as aggregate root
- Admission is Hospital-specific (not reusable for Clinic, Emergency, Home Health)
- Encounter enables multi-specialty support (outpatient, emergency, virtual visits)
- Current architecture violates platform principles

**Impact:**
- Database schema change (create `hc_encounters`, add FK from admissions)
- All Hospital pages must query encounters first
- Bed, Vitals, MAR must reference encounter_id (not admission_id)
- Migration path: Create encounters retroactively for existing admissions

### Decision 2: Big-Bang Migration vs Adapter Pattern

**Question:** Replace legacy service immediately or gradual migration?

**Answer:** ✅ **Adapter Pattern with Feature Flag**

**Rationale:**
- Risk mitigation (can rollback instantly)
- Zero downtime deployment
- Parity testing possible (compare old vs new)
- Hospital users unaffected during migration

**Implementation:**
```typescript
// Adapter routes to old/new based on feature flag
async createEncounter(data) {
  if (await featureFlags.isEnabled('healthcare.new-encounter-engine')) {
    return encounterEngine.createEncounter(data); // NEW
  } else {
    return legacyAdmissionService.createAdmission(data); // OLD
  }
}
```

### Decision 3: State Machine Complexity

**Question:** Implement full 7-state machine or simplified 3-state?

**Answer:** ✅ **Full 7-state machine**

**Rationale:**
- Emergency workflow requires "triaged" state
- Inpatient workflow requires "on-hold" state
- Future-proof for complex clinical workflows
- Constitution mandates production-quality, not MVP

**States:**
1. `planned` - Encounter scheduled
2. `arrived` - Patient checked in
3. `triaged` - Emergency triage complete
4. `in-progress` - Active encounter
5. `on-hold` - Temporarily paused
6. `finished` - Encounter complete
7. `cancelled` - Encounter cancelled

### Decision 4: Event Publishing Timing

**Question:** Publish events synchronously or asynchronously?

**Answer:** ✅ **Synchronous Event Publishing with Transactional Outbox**

**Rationale:**
- Guarantees events published (atomicity)
- Event order preserved
- Can replay from outbox if Event Bus down
- Saga pattern already exists in codebase

**Implementation:**
```typescript
async createEncounter(data) {
  await db.transaction(async (tx) => {
    // 1. Insert encounter
    const encounter = await tx.encounters.insert(data);
    
    // 2. Stage event in outbox
    await tx.outbox.insert({
      eventType: 'EncounterCreated',
      payload: encounter,
      status: 'pending'
    });
    
    // 3. Commit transaction
  });
  
  // 4. Async: Publish from outbox to Event Bus
  await eventBus.publishFromOutbox();
}
```

---

## Risks & Mitigation

### Risk 1: Database Schema Change

**Risk:** Creating `hc_encounters` table breaks existing queries

**Mitigation:**
- [ ] Additive migration only (no ALTER existing tables)
- [ ] Create encounters retroactively for existing admissions
- [ ] Adapter ensures backward compatibility
- [ ] Staging validation before production

### Risk 2: Hospital Pages Break During Migration

**Risk:** Users cannot create admissions during migration

**Mitigation:**
- [ ] Adapter with feature flag (dual-path)
- [ ] Gradual rollout (10% → 50% → 100%)
- [ ] Instant rollback (flip feature flag)
- [ ] E2E tests validate both paths

### Risk 3: Event Bus Failure

**Risk:** Events not published, downstream systems miss updates

**Mitigation:**
- [ ] Transactional outbox pattern
- [ ] Retry logic (exponential backoff)
- [ ] Dead letter queue for failed events
- [ ] Event monitoring dashboard

### Risk 4: Performance Degradation

**Risk:** Platform engine slower than legacy service

**Mitigation:**
- [ ] Performance tests (target <500ms)
- [ ] Database indexes on hot paths
- [ ] Caching for read queries
- [ ] Load testing before rollout

---

## Conclusion

**Gate 0 Status:** ✅ **AUDIT COMPLETE**

**Findings:**
- Encounter Engine directory EXISTS but EMPTY (0 LOC)
- NO implementation, NO contract, NO tests
- Hospital uses legacy service (violates Law 2)
- Database schema missing (no `hc_encounters` table)
- Critical architectural gap (Admission is NOT aggregate root)

**Next Steps:**
1. ✅ Gate 0 audit complete (this document)
2. ⏳ Implement Phase 1 (Domain Layer) - Week 1 Days 1-2
3. ⏳ Implement Phase 2 (Persistence) - Week 1 Days 3-4
4. ⏳ Implement Phase 3 (Service & Contract) - Week 1 Days 4-5
5. ⏳ Implement Phase 4 (Hospital Integration) - Week 2 Days 1-3
6. ⏳ Implement Phase 5 (Migration & Testing) - Week 2 Days 4-5
7. ⏳ Gate 1 validation (Definition of Done checklist)

**Estimated Effort:** 2 weeks (10 days) for production-ready Encounter Engine

**Critical Path:** Encounter Engine blocks Bed Engine and Nursing Engine (both reference encounter_id).

**Recommendation:** **START IMPLEMENTATION IMMEDIATELY**. No more planning. Audit complete. Begin coding Phase 1 (Domain Layer).

---

**Document Owner:** Platform Architecture Team  
**Reviewed By:** Healthcare Product Team  
**Status:** Approved for Implementation  
**Next Action:** Begin Phase 1 - Domain Layer Implementation
