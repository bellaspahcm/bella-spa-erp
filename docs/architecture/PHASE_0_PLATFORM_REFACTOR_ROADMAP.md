# Phase 0: Platform Architecture Refactor Roadmap

**Status:** CRITICAL - Must Complete Before Phase B
**Timeline:** 4-6 weeks
**Goal:** Transform from mixed architecture (70/100) to true Platform-of-Platforms (98/100)

---

## Executive Summary

**Current Problem:** Hospital Product Pack contains engines (BedEngineService, NursingVitalsService, MARService) that should be in Healthcare Platform. This violates Platform-of-Platforms architecture and creates risk of engine duplication when other products (Medical Clinic, Dental Clinic) are developed.

**Solution:** Extract all engines from Hospital Product Pack to Healthcare Platform, implement Platform Governance (Contract Registry, Capability Registry, Feature Flag Platform), and refactor Hospital to consume engines via API contracts.

**Impact:** 
- ✅ Zero engine duplication across products
- ✅ Contract-first development
- ✅ Feature flag-driven rollout
- ✅ Capability-based discovery
- ✅ True platform reusability

---

## Week 1-2: Foundation Setup

### Day 1-3: Platform Directory Structure

#### 1.1. Create Directory Structure
```bash
mkdir -p src/platform/host/contract-registry
mkdir -p src/platform/host/capability-registry
mkdir -p src/platform/host/feature-flags
mkdir -p src/platform/host/identity
mkdir -p src/platform/host/notification
mkdir -p src/platform/host/workflow
mkdir -p src/platform/host/ai-runtime

mkdir -p src/platform/healthcare/engines/mpi-engine
mkdir -p src/platform/healthcare/engines/encounter-engine
mkdir -p src/platform/healthcare/engines/clinical-engine
mkdir -p src/platform/healthcare/engines/order-engine
mkdir -p src/platform/healthcare/engines/billing-engine
mkdir -p src/platform/healthcare/engines/insurance-engine
mkdir -p src/platform/healthcare/engines/scheduling-engine
mkdir -p src/platform/healthcare/engines/queue-engine
mkdir -p src/platform/healthcare/engines/pharmacy-engine
mkdir -p src/platform/healthcare/engines/laboratory-engine
mkdir -p src/platform/healthcare/engines/imaging-engine
mkdir -p src/platform/healthcare/engines/bed-engine
mkdir -p src/platform/healthcare/engines/nursing-engine
mkdir -p src/platform/healthcare/engines/emergency-engine

mkdir -p src/platform/healthcare/contracts
mkdir -p src/products/bella-hospital/hooks
mkdir -p src/products/bella-hospital/components
```

#### 1.2. Create Base Contract Interfaces
```typescript
// src/platform/healthcare/contracts/base.contract.ts
export interface EngineContract {
  readonly name: string;
  readonly version: string;
  readonly description: string;
}

export interface EngineResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedRequest {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
```

### Day 4-7: Contract Registry Implementation

#### 2.1. Create Contract Registry Service
```typescript
// src/platform/host/contract-registry/contract-registry.service.ts
export interface ContractMetadata {
  name: string;
  version: string;
  description: string;
  endpoints: ContractEndpoint[];
  events: ContractEvent[];
  schemas: ContractSchema[];
  deprecationNotice?: string;
  replacedBy?: string;
}

export interface ContractEndpoint {
  method: string;
  path: string;
  requestSchema: string;
  responseSchema: string;
  description: string;
}

export interface ContractEvent {
  name: string;
  schema: string;
  description: string;
}

export interface ContractSchema {
  name: string;
  type: 'request' | 'response' | 'event';
  schema: unknown; // JSON Schema
}

export class ContractRegistryService {
  private contracts: Map<string, ContractMetadata> = new Map();

  registerContract(contract: ContractMetadata): void {
    const key = `${contract.name}@${contract.version}`;
    this.contracts.set(key, contract);
  }

  getContract(name: string, version: string): ContractMetadata | undefined {
    return this.contracts.get(`${name}@${version}`);
  }

  listContracts(name?: string): ContractMetadata[] {
    if (name) {
      return Array.from(this.contracts.values()).filter(c => c.name === name);
    }
    return Array.from(this.contracts.values());
  }

  validateContractCall(
    contractName: string,
    version: string,
    endpoint: string,
    request: unknown
  ): { valid: boolean; errors?: string[] } {
    const contract = this.getContract(contractName, version);
    if (!contract) {
      return { valid: false, errors: ['Contract not found'] };
    }

    const endpointDef = contract.endpoints.find(e => e.path === endpoint);
    if (!endpointDef) {
      return { valid: false, errors: ['Endpoint not found'] };
    }

    // TODO: Validate request against JSON Schema
    return { valid: true };
  }
}

export const contractRegistry = new ContractRegistryService();
```

#### 2.2. Create Contract Registry Database Schema
```sql
-- migrations/YYYYMMDD_contract_registry.sql
CREATE TABLE contract_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  version VARCHAR(50) NOT NULL,
  description TEXT,
  endpoints JSONB NOT NULL,
  events JSONB NOT NULL,
  schemas JSONB NOT NULL,
  deprecation_notice TEXT,
  replaced_by VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, version)
);

CREATE INDEX idx_contract_registry_name ON contract_registry(name);
CREATE INDEX idx_contract_registry_version ON contract_registry(version);
```

### Day 8-10: Capability Registry Implementation

#### 3.1. Create Capability Registry Service
```typescript
// src/platform/host/capability-registry/capability-registry.service.ts
export interface Capability {
  key: string;
  name: string;
  description: string;
  requiredContracts: string[]; // ['bed-engine@v1', 'nursing-engine@v1']
  dependencies: string[]; // Other capabilities required
  category: 'clinical' | 'operational' | 'administrative' | 'analytical';
  deprecated?: boolean;
  replacedBy?: string;
}

export class CapabilityRegistryService {
  private capabilities: Map<string, Capability> = new Map();

  registerCapability(capability: Capability): void {
    this.capabilities.set(capability.key, capability);
  }

  getCapability(key: string): Capability | undefined {
    return this.capabilities.get(key);
  }

  listCapabilities(category?: string): Capability[] {
    const caps = Array.from(this.capabilities.values());
    if (category) {
      return caps.filter(c => c.category === category);
    }
    return caps;
  }

  validateCapabilityDependencies(key: string): { valid: boolean; missingDependencies?: string[] } {
    const capability = this.getCapability(key);
    if (!capability) {
      return { valid: false, missingDependencies: [key] };
    }

    const missing: string[] = [];
    for (const dep of capability.dependencies) {
      if (!this.capabilities.has(dep)) {
        missing.push(dep);
      }
    }

    return missing.length > 0 
      ? { valid: false, missingDependencies: missing }
      : { valid: true };
  }
}

export const capabilityRegistry = new CapabilityRegistryService();
```

#### 3.2. Register Hospital Capabilities
```typescript
// src/platform/healthcare/capabilities.ts
import { capabilityRegistry } from '@/platform/host/capability-registry';

capabilityRegistry.registerCapability({
  key: 'hospital_inpatient',
  name: 'Hospital Inpatient Management',
  description: 'Inpatient admission, bed management, nursing care',
  requiredContracts: [
    'bed-engine@v1',
    'nursing-engine@v1',
    'encounter-engine@v1',
    'mpi-engine@v1',
  ],
  dependencies: [],
  category: 'clinical',
});

capabilityRegistry.registerCapability({
  key: 'hospital_icu',
  name: 'Intensive Care Unit',
  description: 'ICU real-time monitoring, ventilator management',
  requiredContracts: [
    'nursing-engine@v1',
    'bed-engine@v1',
  ],
  dependencies: ['hospital_inpatient'],
  category: 'clinical',
});

capabilityRegistry.registerCapability({
  key: 'hospital_emergency',
  name: 'Emergency Department',
  description: 'ED triage, emergency workflow',
  requiredContracts: [
    'emergency-engine@v1',
    'queue-engine@v1',
    'encounter-engine@v1',
  ],
  dependencies: [],
  category: 'clinical',
});
```

### Day 11-14: Feature Flag Platform Implementation

#### 4.1. Create Feature Flag Service
```typescript
// src/platform/host/feature-flags/feature-flag.service.ts
export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  rolloutStrategy: 'instant' | 'canary' | 'progressive' | 'dark';
  rolloutPercentage?: number; // 0-100
  enabledTenants?: string[];
  disabledTenants?: string[];
  enabledUsers?: string[];
  disabledUsers?: string[];
  expiresAt?: string;
}

export class FeatureFlagService {
  async isEnabled(
    flagKey: string,
    context: { tenantId?: string; userId?: string }
  ): Promise<boolean> {
    const flag = await this.getFlag(flagKey);
    if (!flag) {
      return false;
    }

    // Check expiration
    if (flag.expiresAt && new Date(flag.expiresAt) < new Date()) {
      return false;
    }

    // Check tenant override
    if (context.tenantId) {
      if (flag.disabledTenants?.includes(context.tenantId)) {
        return false;
      }
      if (flag.enabledTenants?.includes(context.tenantId)) {
        return true;
      }
    }

    // Check user override
    if (context.userId) {
      if (flag.disabledUsers?.includes(context.userId)) {
        return false;
      }
      if (flag.enabledUsers?.includes(context.userId)) {
        return true;
      }
    }

    // Check rollout strategy
    switch (flag.rolloutStrategy) {
      case 'instant':
        return flag.defaultEnabled;
      
      case 'canary':
      case 'progressive':
        return this.checkRolloutPercentage(
          flagKey,
          context.tenantId || context.userId || '',
          flag.rolloutPercentage || 0
        );
      
      case 'dark':
        return false; // Dark launch: always disabled
      
      default:
        return flag.defaultEnabled;
    }
  }

  private checkRolloutPercentage(
    flagKey: string,
    identifier: string,
    percentage: number
  ): boolean {
    // Deterministic hash-based rollout
    const hash = this.hashCode(`${flagKey}:${identifier}`);
    return (hash % 100) < percentage;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  private async getFlag(key: string): Promise<FeatureFlag | null> {
    // TODO: Fetch from database
    return null;
  }
}

export const featureFlagService = new FeatureFlagService();
```

#### 4.2. Feature Flag Database Schema
```sql
-- migrations/YYYYMMDD_feature_flags.sql
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  default_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  rollout_strategy VARCHAR(50) NOT NULL DEFAULT 'instant',
  rollout_percentage INTEGER,
  enabled_tenants JSONB,
  disabled_tenants JSONB,
  enabled_users JSONB,
  disabled_users JSONB,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_key ON feature_flags(key);
CREATE INDEX idx_feature_flags_strategy ON feature_flags(rollout_strategy);
```

---

## Week 3-4: Engine Extraction

### Day 15-17: Extract Bed Engine

#### 5.1. Define Bed Engine Contract
```typescript
// src/platform/healthcare/contracts/bed-engine.contract.ts
import { EngineContract, EngineResponse } from './base.contract';
import { Bed, Ward, BedStatus } from '@/types/healthcare';

export interface BedAllocationRequest {
  tenantId: string;
  patientId: string;
  wardId: string;
  preferredBedType?: string;
  isolationRequired?: boolean;
  genderRestriction?: 'male' | 'female';
}

export interface BedAllocationResponse {
  bed: Bed;
  allocationId: string;
}

export interface BedTransferRequest {
  tenantId: string;
  currentBedId: string;
  targetWardId: string;
  targetBedId?: string;
  reason: string;
  requestedBy: string;
}

export interface BedOccupancySnapshot {
  wardId: string;
  wardName: string;
  totalBeds: number;
  occupiedBeds: number;
  availableBeds: number;
  occupancyRate: number;
  bedsByType: Record<string, number>;
  bedsByStatus: Record<BedStatus, number>;
}

export interface BedEngineContract extends EngineContract {
  allocateBed(request: BedAllocationRequest): Promise<EngineResponse<BedAllocationResponse>>;
  releaseBed(bedId: string, reason: string): Promise<EngineResponse<void>>;
  transferBed(request: BedTransferRequest): Promise<EngineResponse<Bed>>;
  getOccupancy(tenantId: string, wardId?: string): Promise<EngineResponse<BedOccupancySnapshot[]>>;
  listAvailableBeds(tenantId: string, wardId?: string): Promise<EngineResponse<Bed[]>>;
  updateBedStatus(bedId: string, status: BedStatus): Promise<EngineResponse<Bed>>;
}
```

#### 5.2. Implement Bed Engine
```typescript
// src/platform/healthcare/engines/bed-engine/bed-engine.service.ts
import { BedEngineContract, BedAllocationRequest, BedAllocationResponse, BedOccupancySnapshot } from '@/platform/healthcare/contracts/bed-engine.contract';
import { EngineResponse } from '@/platform/healthcare/contracts/base.contract';
import { Bed, BedStatus } from '@/types/healthcare';

export class BedEngine implements BedEngineContract {
  readonly name = 'bed-engine';
  readonly version = 'v1.0.0';
  readonly description = 'Bed allocation, transfer, and occupancy management';

  async allocateBed(request: BedAllocationRequest): Promise<EngineResponse<BedAllocationResponse>> {
    try {
      // 1. Find available beds matching criteria
      const availableBeds = await this.findAvailableBeds(request);
      
      if (availableBeds.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_BEDS_AVAILABLE',
            message: 'No beds available matching criteria',
          },
        };
      }

      // 2. Select best bed (priority: isolation, gender, type, location)
      const selectedBed = this.selectOptimalBed(availableBeds, request);

      // 3. Allocate bed (update status, link patient)
      const allocatedBed = await this.performAllocation(selectedBed.id, request.patientId);

      // 4. Create allocation record (audit trail)
      const allocationId = await this.createAllocationRecord(selectedBed.id, request);

      return {
        success: true,
        data: {
          bed: allocatedBed,
          allocationId,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ALLOCATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error',
          details: error,
        },
      };
    }
  }

  async releaseBed(bedId: string, reason: string): Promise<EngineResponse<void>> {
    // Implementation...
  }

  async transferBed(request: BedTransferRequest): Promise<EngineResponse<Bed>> {
    // Implementation...
  }

  async getOccupancy(tenantId: string, wardId?: string): Promise<EngineResponse<BedOccupancySnapshot[]>> {
    // Implementation...
  }

  async listAvailableBeds(tenantId: string, wardId?: string): Promise<EngineResponse<Bed[]>> {
    // Implementation...
  }

  async updateBedStatus(bedId: string, status: BedStatus): Promise<EngineResponse<Bed>> {
    // Implementation...
  }

  // Private helper methods
  private async findAvailableBeds(request: BedAllocationRequest): Promise<Bed[]> {
    // TODO: Implement bed search logic
    return [];
  }

  private selectOptimalBed(beds: Bed[], request: BedAllocationRequest): Bed {
    // TODO: Implement bed selection algorithm
    return beds[0];
  }

  private async performAllocation(bedId: string, patientId: string): Promise<Bed> {
    // TODO: Update bed status in database
    return {} as Bed;
  }

  private async createAllocationRecord(bedId: string, request: BedAllocationRequest): Promise<string> {
    // TODO: Create audit record
    return 'alloc-' + Date.now();
  }
}

export const bedEngine = new BedEngine();
```

#### 5.3. Register Bed Engine Contract
```typescript
// src/platform/healthcare/engines/bed-engine/index.ts
import { contractRegistry } from '@/platform/host/contract-registry';
import { bedEngine } from './bed-engine.service';

contractRegistry.registerContract({
  name: 'bed-engine',
  version: 'v1.0.0',
  description: 'Bed allocation, transfer, and occupancy management',
  endpoints: [
    {
      method: 'POST',
      path: '/allocateBed',
      requestSchema: 'BedAllocationRequest',
      responseSchema: 'BedAllocationResponse',
      description: 'Allocate a bed to a patient',
    },
    {
      method: 'POST',
      path: '/releaseBed',
      requestSchema: '{ bedId: string, reason: string }',
      responseSchema: 'void',
      description: 'Release a bed',
    },
    {
      method: 'POST',
      path: '/transferBed',
      requestSchema: 'BedTransferRequest',
      responseSchema: 'Bed',
      description: 'Transfer a patient to a different bed',
    },
    {
      method: 'GET',
      path: '/getOccupancy',
      requestSchema: '{ tenantId: string, wardId?: string }',
      responseSchema: 'BedOccupancySnapshot[]',
      description: 'Get bed occupancy statistics',
    },
  ],
  events: [
    {
      name: 'BedAllocated',
      schema: 'BedAllocationResponse',
      description: 'Emitted when a bed is allocated',
    },
    {
      name: 'BedReleased',
      schema: '{ bedId: string, reason: string }',
      description: 'Emitted when a bed is released',
    },
  ],
  schemas: [],
});

export { bedEngine };
```

### Day 18-21: Extract Nursing Engine & Pharmacy Engine
(Similar pattern to Bed Engine - contracts, implementation, registration)

---

## Week 5: Product Pack Refactor

### Day 22-24: Create Hospital Hooks

#### 6.1. Create Platform Engine Hook Base
```typescript
// src/products/bella-hospital/hooks/use-platform-engine.ts
import { useCallback } from 'react';
import { EngineResponse } from '@/platform/healthcare/contracts/base.contract';

export function usePlatformEngine<T>(engineName: string): T {
  // TODO: Implement engine lookup and proxy
  // For now, return mock
  return {} as T;
}

export function useEngineCall<TRequest, TResponse>(
  engineMethod: (request: TRequest) => Promise<EngineResponse<TResponse>>
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<TResponse | null>(null);

  const call = useCallback(async (request: TRequest) => {
    setLoading(true);
    setError(null);

    const response = await engineMethod(request);

    if (response.success) {
      setData(response.data!);
      setError(null);
    } else {
      setError(response.error!.message);
      setData(null);
    }

    setLoading(false);
    return response;
  }, [engineMethod]);

  return { call, loading, error, data };
}
```

#### 6.2. Create Bed Engine Hook
```typescript
// src/products/bella-hospital/hooks/use-bed-engine.ts
import { usePlatformEngine } from './use-platform-engine';
import { BedEngineContract } from '@/platform/healthcare/contracts/bed-engine.contract';

export function useBedEngine() {
  return usePlatformEngine<BedEngineContract>('bed-engine');
}
```

### Day 25-28: Refactor Hospital Pages
- Update `/beds/page.tsx` to use `useBedEngine()` hook
- Update `/nursing-vitals/page.tsx` to use `useNursingEngine()` hook
- Update `/mar/page.tsx` to use `usePharmacyEngine()` hook
- Update `/admissions/page.tsx` to use `useEncounterEngine()` + `useBedEngine()` hooks

---

## Week 6: Feature Flags & Rollout

### Day 29-31: Feature Flag Implementation
1. Add feature flag: `healthcare.new-engine-architecture`
2. Implement dual-path in Hospital pages
3. Deploy to staging environment
4. Test both paths (old service + new engine)

### Day 32-35: Pilot Testing
1. Enable for 1 test tenant
2. Run regression test suite
3. Monitor logs for errors
4. Collect performance metrics

### Day 36-38: Progressive Rollout
1. Rollout to 25% tenants (canary)
2. Monitor for 24 hours
3. Rollout to 50% tenants
4. Monitor for 24 hours
5. Rollout to 100% tenants

### Day 39-42: Cleanup & Documentation
1. Remove old service files
2. Update architecture documentation
3. Update developer guides
4. Archive migration logs
5. Celebrate! 🎉

---

## Deliverables

### Week 1-2 Deliverables
- ✅ Platform directory structure created
- ✅ Contract Registry service implemented
- ✅ Capability Registry service implemented
- ✅ Feature Flag Platform implemented
- ✅ Base contract interfaces defined
- ✅ Database migrations created

### Week 3-4 Deliverables
- ✅ Bed Engine extracted and implemented
- ✅ Nursing Engine extracted and implemented
- ✅ Pharmacy Engine (MAR) extracted and implemented
- ✅ All engine contracts defined and registered
- ✅ Unit tests written for all engines

### Week 5 Deliverables
- ✅ Hospital hooks created (`useBedEngine`, `useNursingEngine`, `usePharmacyEngine`)
- ✅ All Hospital pages refactored to use hooks
- ✅ Old service imports removed
- ✅ Integration tests updated

### Week 6 Deliverables
- ✅ Feature flag `healthcare.new-engine-architecture` implemented
- ✅ Dual-path support added
- ✅ Pilot testing completed
- ✅ Progressive rollout completed
- ✅ Old service code removed
- ✅ Documentation updated
- ✅ Architecture score: 98/100 achieved

---

## Success Criteria

### Technical Criteria
- [ ] Zero engine duplication (Hospital, Clinic, Dental all use same engines)
- [ ] All engines have well-defined contracts
- [ ] All contracts registered in Contract Registry
- [ ] All capabilities registered in Capability Registry
- [ ] Feature flags functional for all new features
- [ ] 100% unit test coverage for engines
- [ ] 100% integration test coverage for Hospital pages
- [ ] TypeScript compilation with zero errors
- [ ] No console errors in browser

### Business Criteria
- [ ] Zero regression (all existing features work)
- [ ] Performance: < 2 second page load time
- [ ] Reliability: 99.9% uptime during rollout
- [ ] User satisfaction: No complaints from pilot users
- [ ] Developer experience: Clear documentation, easy to consume engines

### Architecture Criteria
- [ ] Platform-of-Platforms architecture achieved
- [ ] Clear separation: Host → Healthcare → Hospital
- [ ] Hospital only contains UI + workflows (no engines)
- [ ] Healthcare Platform contains ALL domain engines
- [ ] Host Platform contains ALL shared services
- [ ] Architecture freeze ready (98/100 score)

---

**Document Version:** 1.0
**Date:** 2026-08-07
**Author:** Bella AI Development Team
**Status:** Roadmap - Approved for Execution
**Timeline:** 4-6 weeks (Start immediately after Phase A sign-off)
