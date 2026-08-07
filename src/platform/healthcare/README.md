# Bella Healthcare Platform

**Architecture Layer:** INDUSTRY PLATFORM  
**Version:** 1.0.0  
**Status:** Active Development (Phase 0)  
**Constitution Compliance:** Laws 2, 3, 5, 7

---

## Overview

Healthcare Platform is an **Industry-specific platform layer** sitting between:
- **Host Platform** (foundation services: IAM, Workflow, Event Bus, Contract Registry)
- **Product Packs** (Hospital, Medical Clinic, Dental Clinic, Pharmacy, Laboratory, Home Care)

This architecture follows the **Platform-of-Platforms** pattern:

```
Host Platform (Foundation)
      ↓
Healthcare Platform (Industry-Specific Engines)
      ↓
Product Packs (Hospital, Clinic, Pharmacy, Lab)
```

---

## Directory Structure

```
src/platform/healthcare/
├── engines/              # Healthcare domain engines
│   ├── bed-engine/       # Bed allocation, transfer, discharge
│   ├── nursing-engine/   # Vital signs, nursing notes, care plans
│   ├── pharmacy-engine/  # MAR, dispensing, drug interactions
│   ├── mpi-engine/       # Master Patient Index
│   ├── encounter-engine/ # Patient encounters (visits, admissions)
│   ├── clinical-engine/  # Clinical workflows, orders, results
│   ├── order-engine/     # Clinical orders (lab, imaging, procedures)
│   ├── billing-engine/   # Healthcare billing, BHYT claims
│   ├── insurance-engine/ # Insurance verification, claims
│   ├── scheduling-engine/# Appointment scheduling
│   ├── queue-engine/     # Patient queue management
│   ├── laboratory-engine/# LIS (Laboratory Information System)
│   └── imaging-engine/   # RIS/PACS (Radiology/Imaging)
├── contracts/            # Engine contract definitions (interfaces)
│   ├── bed-engine.contract.ts
│   ├── nursing-engine.contract.ts
│   ├── pharmacy-engine.contract.ts
│   └── ...
├── shared-kernel/        # Healthcare domain types, utilities
│   ├── types.ts          # Common healthcare types
│   ├── validators.ts     # Healthcare-specific validators
│   └── constants.ts      # Healthcare constants (HL7 codes, etc.)
├── index.ts              # Platform exports
└── README.md             # This file
```

---

## Design Principles

### 1. Engine Isolation (Constitution Law 3)
- Each engine is **self-contained** with its own:
  - Service class (business logic)
  - Contract interface (API definition)
  - Types (domain models)
  - Tests (unit + integration)

### 2. Contract-First Development (Constitution Law 8)
- All engines expose **versioned contracts**
- Contracts registered in **Contract Registry**
- Product Packs consume engines via contracts (not direct imports)

### 3. Event-First Architecture (Constitution Law 5)
- All engines publish **domain events** to Event Bus
- Examples:
  - `BedAllocated`, `BedReleased`
  - `VitalsRecorded`, `NursingNoteCreated`
  - `MedicationDispensed`, `DrugInteractionDetected`

### 4. Zero Direct DB Access (Constitution Law 2)
- Product Packs **NEVER** query Supabase directly
- All data access goes through engines
- Engines provide **abstraction layer** for database operations

### 5. Capability Registration (Constitution Law 7)
- Each engine registers its **capabilities** in Capability Registry
- Product Packs declare **required capabilities** in manifest
- Runtime validates capability dependencies before loading

---

## Engine Lifecycle

### Phase 1: Contract Definition
```typescript
// src/platform/healthcare/contracts/bed-engine.contract.ts
export interface BedEngineContract extends EngineContract {
  allocateBed(request: BedAllocationRequest): Promise<EngineResponse<Bed>>;
  releaseBed(bedId: string, reason: string): Promise<EngineResponse<void>>;
  transferBed(fromBedId: string, toBedId: string): Promise<EngineResponse<BedTransfer>>;
}
```

### Phase 2: Engine Implementation
```typescript
// src/platform/healthcare/engines/bed-engine/bed-engine.service.ts
export class BedEngineService implements BedEngineContract {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly eventBus: EventBusService,
    private readonly contractRegistry: ContractRegistryService
  ) {}

  async allocateBed(request: BedAllocationRequest): Promise<EngineResponse<Bed>> {
    // Business logic
    const bed = await this.allocateBedLogic(request);
    
    // Publish event
    await this.eventBus.publish({
      eventType: 'BedAllocated',
      version: '1.0.0',
      payload: { bedId: bed.id, patientId: request.patientId }
    });
    
    return { success: true, data: bed };
  }
}
```

### Phase 3: Product Pack Consumption
```typescript
// src/products/bella-hospital/hooks/use-bed-engine.ts
export function useBedEngine() {
  const bedEngine = useEngine<BedEngineContract>('bed-engine', '1.0.0');
  
  const allocateBed = async (request: BedAllocationRequest) => {
    return await bedEngine.allocateBed(request);
  };
  
  return { allocateBed, releaseBed, transferBed };
}

// src/products/bella-hospital/pages/BedsPage.tsx
const { allocateBed } = useBedEngine();
const handleAllocate = () => allocateBed({ patientId, wardId, bedType });
```

---

## Constitution Compliance

| Law | Description | Status | Implementation |
|-----|-------------|--------|----------------|
| **Law 2** | No Direct DB Access | ✅ | Engines provide abstraction |
| **Law 3** | Execution-Engine Decoupled | ✅ | Engines in Healthcare Platform, not Hospital |
| **Law 5** | Event-First Architecture | ✅ | All engines publish domain events |
| **Law 7** | Capability-First Enforcement | ✅ | Engines register capabilities |
| **Law 8** | Registry-First & ADR | ✅ | Contracts in Contract Registry |
| **Law 11** | No `any` Types | 🚧 | In progress (Phase 0 Week 5) |

---

## Migration Strategy (Phase 0)

### Week 1-2: Foundation
- ✅ Create Healthcare Platform directory structure
- ✅ Define engine contracts
- ✅ Implement Contract Registry Service

### Week 3-4: Engine Extraction
- Extract **Bed Engine** from Hospital services
- Extract **Nursing Engine** from Hospital services
- Extract **Pharmacy Engine (MAR)** from Hospital services

### Week 5: Dual-Path Support
- Maintain **old service path** (Hospital services)
- Add **new engine path** (Healthcare Platform engines)
- Gradual migration with feature flags

### Week 6: Cutover
- Switch Hospital to use engines
- Deprecate old services
- Remove direct Supabase queries from Hospital

---

## Testing Strategy

### Unit Tests
```typescript
// src/platform/healthcare/engines/bed-engine/__tests__/bed-engine.test.ts
describe('BedEngineService', () => {
  it('should allocate bed and publish event', async () => {
    const result = await bedEngine.allocateBed(request);
    expect(result.success).toBe(true);
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'BedAllocated' })
    );
  });
});
```

### Integration Tests
```typescript
// src/platform/healthcare/engines/bed-engine/__tests__/bed-engine.integration.test.ts
describe('BedEngine Integration', () => {
  it('should allocate bed, update database, and trigger downstream workflows', async () => {
    // Test full workflow: allocate → DB update → event publish → billing trigger
  });
});
```

### Contract Tests
```typescript
// src/platform/healthcare/contracts/__tests__/bed-engine.contract.test.ts
describe('BedEngineContract', () => {
  it('should comply with contract schema', () => {
    const implementation = new BedEngineService(...);
    expect(implementation).toImplementContract(BedEngineContract);
  });
});
```

---

## Future Engines (Phase B+)

- **Emergency Engine** (ED workflows, triage, resuscitation)
- **OR Engine** (Operating room scheduling, surgical workflows)
- **ICU Engine** (Critical care, ventilator management)
- **Blood Bank Engine** (Blood inventory, transfusion tracking)
- **Infection Control Engine** (Surveillance, outbreak detection)
- **Rehabilitation Engine** (PT/OT workflows)
- **Nutrition Engine** (Dietary orders, meal planning)
- **CSSD Engine** (Central Sterile Supply Department)
- **Ambulance Engine** (EMS dispatch, patient transfer)
- **Asset Engine** (Biomedical equipment tracking)

---

## References

- [Bella Hospital Enterprise Architecture](../../../docs/architecture/BELLA_HOSPITAL_ENTERPRISE_ARCHITECTURE.md)
- [Platform-of-Platforms Constitution](../../../docs/architecture/BELLA_ENTERPRISE_PLATFORM_INTEGRATION.md)
- [Phase 0 Roadmap](../../../docs/architecture/PHASE_0_PLATFORM_REFACTOR_ROADMAP.md)
- [Phase 0 Current Status Audit](../../../docs/architecture/PHASE_0_CURRENT_STATUS_AUDIT.md)

---

**Last Updated:** 2026-08-07  
**Phase:** Phase 0 (Platform Refactor)  
**Status:** Active Development  
**Next Milestone:** Engine Extraction (Week 3-4)
