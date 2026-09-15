# H1 Contract Extraction Roadmap

**Date:** 2026-09-15  
**Status:** 🟡 **PROPOSED** (Pending H1 Architecture Gate Approval)  
**Owner:** Beauty Services Team (Interim - Architecture Council)  
**Timeline:** 6 Weeks (Week 1-6) - Phased Contract Extraction  
**Objective:** Extract 8 Beauty Capability Contracts from Bella Spa for Haircut MVP

---

## Executive Summary

**Mission:** Extract 8 contracts from Bella Spa to enable Bella Haircut Shop launch with 73.33% code reuse.

**Strategy:** Hybrid phased extraction (ADR-002):
- **Phase 1 (Week 1-2):** Extract 4 critical contracts → Spa migration
- **Phase 2 (Week 3-4):** Haircut MVP (mixed: contracts + Spa tables)
- **Phase 3 (Week 5-6):** Extract remaining 4 contracts → Full formalization

**Deliverables:**
- 8 Beauty Capability Contracts in `src/contracts/beauty/`
- Engines remain in `src/products/bella-spa/engines/` (ADR-003 intermediate layer)
- Contract Registry with versioning, governance, documentation
- 2 verticals consuming contracts (Spa + Haircut)

**Success Metrics:**
- ✅ 4-week Haircut MVP launch
- ✅ 6-week full contract formalization
- ✅ Zero breaking changes to Spa
- ✅ 73.33% code reuse validated

---

## The 8 Contracts (Prioritized)

### Phase 1: Critical 4 Contracts (Week 1-2)

**High Priority - Extract NOW:**

1. **IWaitlistEngine** - Waitlist Management (Strongest platform candidate)
2. **IStaffAssignment** - Provider/Stylist Assignment (Core booking logic)
3. **IAppointmentEngine** - Appointment Booking (Foundation capability)
4. **IResourceAllocation** - Station/Resource Allocation (Multi-resource pattern)

**Rationale:** These 4 contracts are:
- ✅ Most critical for Haircut MVP (booking flow depends on all 4)
- ✅ Highest platform potential (reusable across beauty verticals)
- ✅ Most complex (better to extract early, validate with Haircut)

---

### Phase 3: Deferred 4 Contracts (Week 5-6)

**Medium Priority - Extract AFTER Haircut MVP:**

5. **IServiceCatalog** - Service Catalog (Simpler extraction)
6. **ISessionTracking** - Service Execution/Tracking (Low coupling)
7. **IDomainEvents** - Lifecycle Events (Cross-cutting concern)
8. **IServiceHistory** - Service History (Query pattern only)

**Rationale:** These 4 contracts are:
- ⏸️ Less critical for MVP (Haircut can use Spa tables directly)
- ⏸️ Simpler extraction (1 day per contract vs 2 days for Phase 1)
- ⏸️ Can defer without major technical debt

---

## Phase 1: Week 1-2 (Extract Critical 4)

### Week 1: Waitlist + Assignment

**Timeline:** 5 working days  
**Engineers:** 2-3 FTE (parallelized work)  
**Deliverable:** 2 contracts extracted, Spa migrated

---

#### Day 1-2: IWaitlistEngine Contract Extraction

**Engineer 1 - Contract Definition (Day 1):**

**Step 1: Define Contract Interface**
```typescript
// src/contracts/beauty/IWaitlistEngine.ts

export interface IWaitlistEngine {
  // Waitlist entry management
  addToWaitlist(request: WaitlistRequest): Promise<WaitlistEntry>;
  getWaitlistEntry(entryId: string): Promise<WaitlistEntry>;
  updateWaitlistEntry(entryId: string, updates: Partial<WaitlistEntry>): Promise<WaitlistEntry>;
  removeFromWaitlist(entryId: string): Promise<void>;
  
  // Position management
  getPosition(entryId: string): Promise<number>;
  updatePosition(entryId: string, newPosition: number): Promise<void>;
  recalculatePositions(): Promise<void>;
  
  // Queue queries
  getWaitingEntries(filter?: WaitlistFilter): Promise<WaitlistEntry[]>;
  getNextInQueue(filter?: WaitlistFilter): Promise<WaitlistEntry | null>;
  getCustomerWaitlistStatus(customerId: string): Promise<WaitlistStatus>;
  
  // Status transitions
  markNotified(entryId: string): Promise<void>;
  markReserved(entryId: string, expiresAt: Date): Promise<void>;
  markConverted(entryId: string, appointmentId: string): Promise<void>;
  markExpired(entryId: string): Promise<void>;
  markCancelled(entryId: string, reason?: string): Promise<void>;
  
  // Priority management
  calculatePriority(customerId: string, request: WaitlistRequest): Promise<number>;
  updatePriority(entryId: string, priority: number): Promise<void>;
}

export interface WaitlistRequest {
  customerId: string;
  packageId: string;
  preferredDate?: Date;
  preferredStartTime?: string;
  flexibilityScore?: number;
  notes?: string;
}

export interface WaitlistEntry {
  id: string;
  tenantId: string;
  customerId: string;
  packageId: string;
  preferredDate?: Date;
  preferredStartTime?: string;
  priorityScore: number;
  tierScore: number;
  valueScore: number;
  waitTimeScore: number;
  position: number;
  status: 'active' | 'notified' | 'reserved' | 'converted' | 'expired' | 'cancelled';
  expiresAt?: Date;
  convertedToAppointmentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface WaitlistFilter {
  status?: string | string[];
  packageId?: string;
  preferredDate?: Date;
  customerId?: string;
}

export interface WaitlistStatus {
  inWaitlist: boolean;
  entry?: WaitlistEntry;
  position?: number;
  estimatedWaitTime?: number;
  aheadInQueue?: number;
}
```

**Step 2: Define Supporting Types**
```typescript
// src/contracts/beauty/types/waitlist.types.ts

export enum WaitlistStatus {
  ACTIVE = 'active',
  NOTIFIED = 'notified',
  RESERVED = 'reserved',
  CONVERTED = 'converted',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled'
}

export interface WaitlistPriorityConfig {
  tierWeights: {
    VIP: number;      // 40
    Loyal: number;    // 25
    New: number;      // 10
  };
  valueWeight: number;  // 0-30 based on package value
  waitTimeWeight: number;  // 0-20 based on days waiting
  flexibilityWeight: number;  // 0-10 based on date flexibility
}

export interface WaitlistMetrics {
  totalActive: number;
  averageWaitTime: number;  // days
  conversionRate: number;   // percentage
  expirationRate: number;   // percentage
}
```

**Step 3: Register Contract**
```typescript
// src/contracts/registry.ts

export const CONTRACT_REGISTRY = {
  'IWaitlistEngine': {
    version: '1.0.0',
    location: 'src/contracts/beauty/IWaitlistEngine.ts',
    owner: 'Beauty Services Team (interim)',
    consumers: ['bella-spa', 'bella-haircut'],
    status: 'stable',
    extractedFrom: 'bella-spa',
    extractionDate: '2026-09-15',
    breaking_changes: []
  }
};
```

**Engineer 1 - Documentation (Day 1 afternoon):**
```markdown
# IWaitlistEngine Contract

## Purpose
Manages customer waitlist for future service availability with priority-based positioning.

## Distinction from Walk-in Queue
- **Waitlist:** Customer wants service in FUTURE (next week, next month)
- **Walk-in Queue:** Customer wants service NOW (immediate, real-time)

## Use Cases
- Customer requests appointment but no slots available
- Customer added to waitlist, notified when slot opens
- Priority-based: VIP customers notified first

## Priority Algorithm
priority = tierScore (40) + valueScore (30) + waitTimeScore (20) + flexibilityScore (10)

## Status Lifecycle
active → notified → reserved → converted (or expired/cancelled)

## Implementation
- Database: waitlist_entries, waitlist_notification_logs
- Service: waitlist-service.ts (547 lines)
- Decision Engine: waitlist-management-provider.ts
```

---

**Engineer 2 - Adapter Implementation (Day 2):**

**Step 1: Create Adapter**
```typescript
// src/products/bella-spa/adapters/waitlist-engine.adapter.ts

import { IWaitlistEngine, WaitlistRequest, WaitlistEntry } from '@contracts/beauty';
import { WaitlistService } from '../services/waitlist/waitlist-service';

export class WaitlistEngineAdapter implements IWaitlistEngine {
  constructor(private waitlistService: WaitlistService) {}
  
  async addToWaitlist(request: WaitlistRequest): Promise<WaitlistEntry> {
    return this.waitlistService.addToWaitlist(request);
  }
  
  async getWaitlistEntry(entryId: string): Promise<WaitlistEntry> {
    return this.waitlistService.getEntry(entryId);
  }
  
  async updateWaitlistEntry(entryId: string, updates: Partial<WaitlistEntry>): Promise<WaitlistEntry> {
    return this.waitlistService.updateEntry(entryId, updates);
  }
  
  async removeFromWaitlist(entryId: string): Promise<void> {
    return this.waitlistService.removeFromWaitlist(entryId);
  }
  
  async getPosition(entryId: string): Promise<number> {
    const entry = await this.waitlistService.getEntry(entryId);
    return entry.position;
  }
  
  // ... implement all 15 methods from IWaitlistEngine
}
```

**Step 2: Move Implementation to Engine Directory**
```bash
# Refactor: Move waitlist implementation to engines/
mkdir -p src/products/bella-spa/engines/waitlist-engine/
mv src/services/waitlist/waitlist-service.ts src/products/bella-spa/engines/waitlist-engine/
mv src/lib/decision-engine/providers/booking/waitlist-management-provider.ts src/products/bella-spa/engines/waitlist-engine/
```

**Step 3: Update Internal Imports**
```typescript
// Update bella-spa services to use adapter
// Before:
import { WaitlistService } from '../services/waitlist/waitlist-service';

// After:
import { IWaitlistEngine } from '@contracts/beauty';
import { WaitlistEngineAdapter } from '../adapters/waitlist-engine.adapter';
```

---

**Engineer 3 - Testing (Day 2 afternoon):**

**Unit Tests:**
```typescript
// src/contracts/beauty/__tests__/waitlist-engine.adapter.spec.ts

describe('WaitlistEngineAdapter', () => {
  it('should add customer to waitlist', async () => {
    const adapter = new WaitlistEngineAdapter(mockWaitlistService);
    const entry = await adapter.addToWaitlist({
      customerId: 'customer-1',
      packageId: 'package-1',
      preferredDate: new Date('2026-09-20')
    });
    
    expect(entry.position).toBe(1);
    expect(entry.status).toBe('active');
  });
  
  it('should calculate priority correctly', async () => {
    const priority = await adapter.calculatePriority('vip-customer', request);
    expect(priority).toBeGreaterThan(50);  // VIP + value + wait time
  });
  
  // ... 20+ test cases
});
```

**Integration Tests:**
```typescript
// Spa services consume contract
describe('Booking Service Integration', () => {
  it('should add to waitlist when no slots available', async () => {
    const bookingService = new BookingService({
      waitlistEngine: new WaitlistEngineAdapter(waitlistService)
    });
    
    const result = await bookingService.bookAppointment({
      customerId: 'customer-1',
      packageId: 'package-1',
      preferredDate: fullyBookedDate
    });
    
    expect(result.status).toBe('waitlisted');
    expect(result.waitlistEntry).toBeDefined();
  });
});
```

**Regression Tests:**
```bash
# Run Spa regression tests (547 tests)
npm test -- --testPathPattern=bella-spa
# All tests MUST pass (no functionality change)
```

---

#### Day 3-4: IStaffAssignment Contract Extraction

**Similar process:**
1. Day 3: Define `IStaffAssignment` interface + types + documentation
2. Day 4: Create adapter, move auto-assignment-provider to engines/, test

**IStaffAssignment Interface (10 methods):**
```typescript
export interface IStaffAssignment {
  // Assignment operations
  findAvailableStaff(criteria: AssignmentCriteria): Promise<Staff[]>;
  assignStaff(appointmentId: string, staffId: string): Promise<Assignment>;
  unassignStaff(appointmentId: string): Promise<void>;
  reassignStaff(appointmentId: string, newStaffId: string, reason: string): Promise<Assignment>;
  
  // Availability queries
  checkStaffAvailability(staffId: string, timeSlot: TimeSlot): Promise<boolean>;
  getStaffSchedule(staffId: string, dateRange: DateRange): Promise<Schedule>;
  
  // Auto-assignment
  autoAssign(request: AutoAssignmentRequest): Promise<Assignment>;
  evaluateAssignment(input: AutoAssignmentInput): Promise<AssignmentScore>;
  
  // Workload management
  getStaffWorkload(staffId: string, dateRange: DateRange): Promise<Workload>;
  balanceWorkload(staffIds: string[], dateRange: DateRange): Promise<WorkloadBalance>;
}
```

---

#### Day 5: Spa Migration + Testing

**Morning: Spa Migration**
- Update all Spa services to use `IWaitlistEngine` and `IStaffAssignment` contracts
- Remove direct imports of waitlist-service.ts and auto-assignment-provider.ts
- Inject adapters via dependency injection

**Afternoon: Full Regression Testing**
- Run 547 Spa regression tests → All MUST pass
- Manual smoke testing: Create booking, add to waitlist, assign stylist
- Performance testing: Contract abstraction overhead < 5ms

**Feature Flag Rollout:**
```typescript
// Feature flag for gradual rollout
const useWaitlistContract = featureFlags.isEnabled('waitlist_contract', tenantId);

if (useWaitlistContract) {
  return waitlistEngineAdapter.addToWaitlist(request);
} else {
  return waitlistService.addToWaitlist(request);  // Old implementation
}
```

---

### Week 2: Appointment + Resource

**Timeline:** 5 working days  
**Engineers:** 2-3 FTE  
**Deliverable:** 2 contracts extracted, Spa fully migrated to 4 contracts

---

#### Day 1-2: IAppointmentEngine Contract Extraction

**Most Complex Contract (20 methods):**

```typescript
export interface IAppointmentEngine {
  // Appointment CRUD
  createAppointment(request: AppointmentRequest): Promise<Appointment>;
  getAppointment(appointmentId: string): Promise<Appointment>;
  updateAppointment(appointmentId: string, updates: Partial<Appointment>): Promise<Appointment>;
  cancelAppointment(appointmentId: string, reason: string): Promise<void>;
  
  // Status transitions (state machine)
  transitionStatus(appointmentId: string, newStatus: AppointmentStatus, reason?: string): Promise<Appointment>;
  validateTransition(currentStatus: AppointmentStatus, newStatus: AppointmentStatus): boolean;
  
  // Scheduling
  findAvailableSlots(criteria: SlotSearchCriteria): Promise<TimeSlot[]>;
  checkSlotAvailability(slot: TimeSlot, resourceIds: string[]): Promise<boolean>;
  reserveSlot(slot: TimeSlot, appointmentId: string): Promise<Reservation>;
  releaseSlot(reservationId: string): Promise<void>;
  
  // Conflict management
  detectConflicts(appointmentId: string): Promise<Conflict[]>;
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>;
  
  // Session management
  startSession(appointmentId: string): Promise<Session>;
  completeSession(appointmentId: string, completion: SessionCompletion): Promise<Session>;
  pauseSession(appointmentId: string, reason: string): Promise<Session>;
  resumeSession(appointmentId: string): Promise<Session>;
  
  // Queries
  getAppointmentsByCustomer(customerId: string, filter?: AppointmentFilter): Promise<Appointment[]>;
  getAppointmentsByStaff(staffId: string, dateRange: DateRange): Promise<Appointment[]>;
  getUpcomingAppointments(dateRange: DateRange, filter?: AppointmentFilter): Promise<Appointment[]>;
  
  // Lifecycle events
  emitEvent(appointmentId: string, eventType: string, eventData: any): Promise<void>;
}
```

**Complexity Drivers:**
- State machine: 7 states (inquiry → deposit_pending → booked → in_progress → completed → cancelled → no_show)
- Resource integration: beds, rooms, equipment assignment
- Conflict detection: time, resource, staff conflicts
- Session lifecycle: start, pause, resume, complete

**Implementation Evidence:**
- Database: bookings table (20+ columns)
- Service: booking-decision.service.ts
- Decision Engine: Multiple providers (capacity, conflict, assignment)
- Audit: booking_events table (13 event types)

---

#### Day 3-4: IResourceAllocation Contract Extraction

```typescript
export interface IResourceAllocation {
  // Resource allocation
  allocateResource(request: AllocationRequest): Promise<Allocation>;
  deallocateResource(allocationId: string): Promise<void>;
  reallocateResource(allocationId: string, newResourceId: string): Promise<Allocation>;
  
  // Availability queries
  findAvailableResources(criteria: ResourceSearchCriteria): Promise<Resource[]>;
  checkResourceAvailability(resourceId: string, timeSlot: TimeSlot): Promise<boolean>;
  getResourceSchedule(resourceId: string, dateRange: DateRange): Promise<Schedule>;
  
  // Conflict detection
  detectResourceConflicts(resourceId: string, timeSlot: TimeSlot): Promise<Conflict[]>;
  resolveResourceConflict(conflictId: string, resolution: ConflictResolution): Promise<void>;
  
  // Multi-resource allocation
  allocateMultipleResources(requests: AllocationRequest[]): Promise<Allocation[]>;
  optimizeResourceAllocation(criteria: OptimizationCriteria): Promise<AllocationPlan>;
  
  // Resource management
  getResourceUtilization(resourceId: string, dateRange: DateRange): Promise<Utilization>;
  getResourcesByType(resourceType: string, filter?: ResourceFilter): Promise<Resource[]>;
}
```

**Implementation Evidence:**
- Database: booking_resources (generic), beds, rooms, equipment (specific)
- Pattern: Multi-resource allocation (bed + room + equipment for 1 appointment)
- Integration: bookings table links (assigned_bed_id, assigned_room_id, required_equipment_ids)

---

#### Day 5: Full Spa Migration + Phase 1 Completion

**Morning: Complete Spa Migration**
- All 4 contracts integrated into Spa services
- All Spa services use adapters (no direct engine imports)
- Feature flags enabled (gradual rollout)

**Afternoon: Phase 1 Validation**
```bash
# Regression tests
npm test -- --testPathPattern=bella-spa  # 547 tests MUST pass

# Integration tests
npm test -- --testPathPattern=contracts  # Contract adapter tests

# Performance tests
npm run test:performance -- --contracts  # < 5ms overhead per contract call
```

**Phase 1 Deliverables Checklist:**
- ✅ 4 contracts extracted (Waitlist, Assignment, Appointment, Resource)
- ✅ 4 adapters implemented in Bella Spa
- ✅ Spa migrated to contracts (547 regression tests pass)
- ✅ Contract Registry updated (4 contracts registered, versioned 1.0.0)
- ✅ Documentation complete (contract usage examples, Spa migration guide)

---

## Phase 2: Week 3-4 (Haircut MVP)

### Week 3: Walk-in Queue + Inventory + Core Services

**Haircut Consumes 4 Extracted Contracts:**

**Day 1: Haircut Service Setup**
```typescript
// src/products/bella-haircut/services/haircut-booking.service.ts

import { IWaitlistEngine, IStaffAssignment, IAppointmentEngine, IResourceAllocation } from '@contracts/beauty';

export class HaircutBookingService {
  constructor(
    // Via contracts (Phase 1 extracted)
    private waitlistEngine: IWaitlistEngine,
    private staffAssignment: IStaffAssignment,
    private appointmentEngine: IAppointmentEngine,
    private resourceAllocation: IResourceAllocation,
    
    // Direct Spa table access (Phase 3 not yet extracted)
    private db: Database  // For packages, session_logs, booking_events
  ) {}
  
  async bookHaircut(request: HaircutBookingRequest): Promise<Booking> {
    // Via contract: Check stylist availability
    const stylists = await this.staffAssignment.findAvailableStaff({
      skills: ['haircut', request.serviceType],
      timeSlot: request.timeSlot,
      preferredStaffId: request.preferredStylistId
    });
    
    if (stylists.length === 0) {
      // Via contract: Add to waitlist
      const waitlistEntry = await this.waitlistEngine.addToWaitlist({
        customerId: request.customerId,
        packageId: request.serviceId,
        preferredDate: request.preferredDate
      });
      
      return { status: 'waitlisted', waitlistEntry };
    }
    
    // Via contract: Allocate station
    const station = await this.resourceAllocation.allocateResource({
      resourceType: 'cutting_station',
      timeSlot: request.timeSlot,
      features: request.stationPreferences
    });
    
    // Via contract: Create appointment
    const appointment = await this.appointmentEngine.createAppointment({
      customerId: request.customerId,
      serviceId: request.serviceId,
      assignedStaffId: stylists[0].id,
      assignedResourceId: station.id,
      timeSlot: request.timeSlot,
      status: 'booked'
    });
    
    return { status: 'booked', appointment };
  }
}
```

**Day 2-3: Walk-in Queue (NEW capability - ADR-004)**
- Build walk-in-queue-engine/ in Haircut product
- Database: walkin_queue table
- Integration with 4 contracts (Waitlist, Assignment, Appointment, Resource)

**Day 4-5: Service Inventory (ADR-005 decision)**
- IF E7 applicable: Integrate Logistics Kernel E7
- ELSE: Extend packages.product_usage

---

### Week 4: Extensions + Integration + Launch

**Day 1-2: Capability Extensions**
- Appointment Status: Haircut-specific states (simpler than Spa)
- Capacity Management: Real-time capacity (walk-in integration)
- Conflict Detection: Station-specific rules
- Voucher/Promo: Redemption tracking

**Day 3-4: End-to-End Testing**
- Walk-in flow: Queue → Assignment → Station → Service
- Appointment flow: Book → Assign → Arrive → Complete
- Waitlist flow: Add → Notify → Convert
- Contract integration testing: All 4 contracts working

**Day 5: Haircut MVP Launch Preparation**
```bash
# Pre-launch checklist
- [ ] 4 contracts working (Waitlist, Assignment, Appointment, Resource)
- [ ] Walk-in Queue operational
- [ ] Service Inventory tracking
- [ ] Extensions complete (Status, Capacity, Conflict, Promo)
- [ ] Integration tests pass (100% coverage)
- [ ] Performance acceptable (< 200ms booking flow)
- [ ] Documentation complete (API docs, user guides)
- [ ] Feature flags configured
- [ ] Monitoring dashboards
- [ ] Rollback plan ready
```

**🚀 HAIRCUT MVP LAUNCH** (End of Week 4)

---

## Phase 3: Week 5-6 (Extract Remaining 4)

### Week 5: Catalog + Execution

**Timeline:** 5 working days  
**Engineers:** 1-2 FTE (simpler extractions)  
**Deliverable:** 2 contracts extracted, Haircut migrated

---

#### Day 1-2: IServiceCatalog Contract Extraction

**Simpler Contract (8 methods):**
```typescript
export interface IServiceCatalog {
  // Service CRUD
  createService(service: ServiceInput): Promise<Service>;
  getService(serviceId: string): Promise<Service>;
  updateService(serviceId: string, updates: Partial<Service>): Promise<Service>;
  deleteService(serviceId: string): Promise<void>;
  
  // Service queries
  listServices(filter?: ServiceFilter): Promise<Service[]>;
  searchServices(query: string, filter?: ServiceFilter): Promise<Service[]>;
  getServicesByCategory(category: string): Promise<Service[]>;
  
  // Pricing
  calculatePrice(serviceId: string, customerId: string, promotionCode?: string): Promise<Price>;
}
```

**Implementation Evidence:**
- Database: packages table (straightforward CRUD)
- Extensions: module_key, service_kind, product_usage columns
- Simpler than Appointment (no state machine, no conflicts)

---

#### Day 3-4: ISessionTracking Contract Extraction

**Simple Contract (10 methods):**
```typescript
export interface ISessionTracking {
  // Session CRUD
  createSession(appointment: Appointment): Promise<Session>;
  getSession(sessionId: string): Promise<Session>;
  updateSession(sessionId: string, updates: Partial<Session>): Promise<Session>;
  
  // Status transitions
  markScheduled(sessionId: string, scheduledDate: Date): Promise<Session>;
  markInProgress(sessionId: string, startedBy: string): Promise<Session>;
  markCompleted(sessionId: string, completion: SessionCompletion): Promise<Session>;
  markCancelled(sessionId: string, reason: string): Promise<Session>;
  
  // Session queries
  getSessionsByAppointment(appointmentId: string): Promise<Session[]>;
  getSessionsByStaff(staffId: string, dateRange: DateRange): Promise<Session[]>;
  getCompletedSessions(customerId: string): Promise<Session[]>;
}
```

**Implementation Evidence:**
- Database: session_logs table (simple status tracking)
- No complex business logic (just status + timestamps)

---

#### Day 5: Testing + Haircut Migration

**Migrate Haircut from Spa Tables to Contracts:**
```typescript
// Before (Haircut Week 3-4):
const service = await this.db.packages.findById(serviceId);  // Direct DB access

// After (Week 5):
const service = await this.serviceCatalog.getService(serviceId);  // Via contract
```

**Regression Testing:**
- Spa: 547 tests MUST pass
- Haircut: Integration tests MUST pass
- No functionality change (abstraction only)

---

### Week 6: Events + History + Documentation

**Timeline:** 5 working days  
**Engineers:** 1-2 FTE  
**Deliverable:** 8 contracts complete, full formalization

---

#### Day 1-2: IDomainEvents Contract Extraction

**Cross-Cutting Contract (5 methods):**
```typescript
export interface IDomainEvents {
  // Event publishing
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
  
  // Event subscription
  subscribe(eventType: string, handler: EventHandler): Subscription;
  unsubscribe(subscriptionId: string): Promise<void>;
  
  // Event queries
  getEvents(filter: EventFilter): Promise<DomainEvent[]>;
}
```

**Implementation Evidence:**
- Database: booking_events table (13 event types)
- Event types: created, assigned, confirmed, rescheduled, cancelled, completed, etc.
- Integration: accounting_outbox for cross-module events

---

#### Day 3: IServiceHistory API Extraction

**Query-Only Contract (6 methods):**
```typescript
export interface IServiceHistory {
  // Customer history
  getCustomerHistory(customerId: string, filter?: HistoryFilter): Promise<ServiceRecord[]>;
  getCustomerServiceCount(customerId: string, serviceId?: string): Promise<number>;
  
  // Staff history
  getStaffHistory(staffId: string, dateRange: DateRange): Promise<ServiceRecord[]>;
  getStaffServiceCount(staffId: string, dateRange: DateRange): Promise<number>;
  
  // Service analytics
  getPopularServices(dateRange: DateRange, limit: number): Promise<ServiceStats[]>;
  getServiceTrends(serviceId: string, dateRange: DateRange): Promise<Trend[]>;
}
```

**Implementation Evidence:**
- Query pattern over bookings + session_logs tables
- No dedicated table (derived views)
- API formalization (REST/GraphQL endpoints)

---

#### Day 4-5: Documentation + Contract Governance

**Documentation Deliverables:**

1. **Contract Reference Documentation:**
```markdown
# Beauty Capability Contracts Reference

## IWaitlistEngine
- Purpose: Waitlist management for future service availability
- Methods: 15 methods (add, get, update, remove, position, status)
- Use Cases: No slots available, customer wants notification
- Examples: [See examples/waitlist-usage.ts]
- Migration Guide: [See migration-guides/waitlist-migration.md]
```

2. **Migration Guides:**
```markdown
# Migrating from Spa Tables to Contracts

## Before (Direct Database Access)
```typescript
const waitlist = await db.waitlistEntries.insert({...});
```

## After (Via Contract)
```typescript
const waitlist = await waitlistEngine.addToWaitlist({...});
```

## Benefits
- Abstraction: Decoupled from database schema
- Versioning: Breaking changes managed via contract versions
- Reusability: Nail Shop consumes same contract
```

3. **Governance Documentation:**
```markdown
# Beauty Capability Contracts Governance

## Contract Ownership
- Owner: Architecture Council (interim)
- Future Owner: Beauty Services Platform Team (Q2 2027, if formalized)

## Versioning
- Semantic Versioning: MAJOR.MINOR.PATCH
- MAJOR: Breaking changes (require ADR + Architecture Council approval)
- MINOR: New methods (backward compatible)
- PATCH: Bug fixes (no API change)

## Breaking Change Process
1. Proposal: Create ADR
2. Impact Analysis: Identify all consumers (Spa, Haircut, Nail)
3. Approval: Architecture Council + 2+ vertical teams
4. Migration Period: 2 quarters
5. Deprecation: Mark old version deprecated
6. Removal: After all consumers migrated
```

4. **Contract Registry Complete:**
```typescript
export const CONTRACT_REGISTRY = {
  'IWaitlistEngine': { version: '1.0.0', ... },
  'IStaffAssignment': { version: '1.0.0', ... },
  'IAppointmentEngine': { version: '1.0.0', ... },
  'IResourceAllocation': { version: '1.0.0', ... },
  'IServiceCatalog': { version: '1.0.0', ... },
  'ISessionTracking': { version: '1.0.0', ... },
  'IDomainEvents': { version: '1.0.0', ... },
  'IServiceHistory': { version: '1.0.0', ... }
};
```

**✅ 8 CONTRACTS COMPLETE** (End of Week 6)

---

## Success Metrics & Validation

### Phase 1 Success (Week 2)

**Checklist:**
- ✅ 4 critical contracts extracted
- ✅ Spa migrated (547 regression tests pass)
- ✅ Zero production issues
- ✅ Performance acceptable (< 5ms contract overhead)

**Metrics:**
- Contract extraction time: 10 days (target: 10 days) ✅
- Spa downtime: 0 hours (target: 0 hours) ✅
- Breaking changes: 0 (target: 0) ✅
- Test coverage: 100% (target: 100%) ✅

---

### Phase 2 Success (Week 4)

**Checklist:**
- ✅ Haircut MVP launched
- ✅ 4 contracts consumed (Waitlist, Assignment, Appointment, Resource)
- ✅ Walk-in Queue operational
- ✅ Service Inventory tracking
- ✅ MVP features complete

**Metrics:**
- Time to MVP: 4 weeks (target: 4 weeks) ✅
- Contract reuse: 4/8 = 50% (target: 50%) ✅
- Code reuse: 73.33% (target: 70%) ✅
- Contract bugs: 0 critical (target: 0) ✅

---

### Phase 3 Success (Week 6)

**Checklist:**
- ✅ 8 contracts extracted (all capabilities formalized)
- ✅ Haircut fully decoupled from Spa database schema
- ✅ Contract documentation complete
- ✅ Contract governance established

**Metrics:**
- Total extraction time: 6 weeks (target: 6 weeks) ✅
- Contracts extracted: 8/8 = 100% (target: 100%) ✅
- Contract stability: 0 breaking changes (target: 0) ✅
- Documentation complete: 100% (target: 100%) ✅

---

## Risk Mitigation

### Risk: Spa Breaks During Contract Extraction

**Mitigation:**
1. Feature flags: Gradual rollout (contract vs old implementation)
2. Regression testing: 547 tests MUST pass after each extraction
3. Rollback plan: Keep old implementation active (feature flag)
4. Phased extraction: 4 contracts at a time (smaller blast radius)

**Contingency:**
- IF Spa breaks: Flip feature flag to old implementation (< 5 min rollback)
- IF contract issues: Fix contract, re-test, gradual rollout
- IF unfixable: Rollback extraction, investigate root cause, re-plan

---

### Risk: Haircut MVP Delayed

**Mitigation:**
1. Parallelize Phase 1: 2-3 engineers (not sequential)
2. Prioritize critical 4: Defer non-critical 4 to Phase 3
3. MVP scope clarity: Walk-in Queue + 4 contracts = MVP (no extras)
4. Engineering capacity: 4-6 engineers for Phase 1 (not 1-2)

**Contingency:**
- IF Week 2 delayed: Reduce critical 4 to critical 2 (Waitlist + Appointment)
- IF Week 4 delayed: Launch with 2 contracts + Spa tables (minimal viable extraction)
- IF severely delayed: Fallback to Option B (launch Haircut first, extract later)

---

### Risk: Contracts Require Rework After Haircut Validation

**Mitigation:**
1. Phase 1 validation: Spa uses contracts (smoke test contract design)
2. Phase 2 validation: Haircut uses contracts (real use case validation)
3. Versioning: Use v1.0.0 with flexibility for v1.1.0 additions
4. Feedback loop: Weekly contract review (Architecture Council + Product Teams)

**Contingency:**
- IF minor issues: Publish v1.1.0 with backward-compatible additions
- IF major issues: Publish v2.0.0 with breaking changes (migration required)
- IF severe issues: Pause Phase 3, fix critical contracts, resume

---

## Deliverables Checklist

### Week 2 (Phase 1 Complete)

- ✅ 4 contracts defined: IWaitlistEngine, IStaffAssignment, IAppointmentEngine, IResourceAllocation
- ✅ 4 adapters implemented in Bella Spa
- ✅ Spa migrated to contracts (547 regression tests pass)
- ✅ Contract Registry updated (4 contracts v1.0.0)
- ✅ Documentation: Contract usage examples, Spa migration guide

---

### Week 4 (Phase 2 Complete - Haircut MVP)

- ✅ Haircut MVP launched
- ✅ 4 contracts consumed by Haircut
- ✅ Walk-in Queue operational (new capability)
- ✅ Service Inventory tracking (E7 or product-level)
- ✅ Extensions complete (Status, Capacity, Conflict, Promo)

---

### Week 6 (Phase 3 Complete - Full Formalization)

- ✅ 8 contracts extracted (all capabilities)
- ✅ Haircut fully decoupled from Spa tables
- ✅ Contract documentation complete (reference + migration guides)
- ✅ Contract governance established (versioning, breaking changes)
- ✅ Contract Registry complete (8 contracts v1.0.0)

---

## Next Steps After H1 Approval

### Week 0 (Pre-Kickoff)

**Architecture Council Approval:**
- Review H1 Architecture Gate document
- Approve 4 ADRs (ADR-002, ADR-003, ADR-004, ADR-005)
- Approve contract extraction roadmap
- Confirm timeline (6 weeks) and capacity (4-6 engineers)

**Team Formation:**
- Beauty Services Team (interim): 4-6 engineers
- Roles: 2 Contract Engineers, 2 Adapter Engineers, 1 QA, 1 Tech Writer
- Training: Platform-of-Platforms architecture, contract design, versioning

**Preparation:**
- Set up contract repository structure: `src/contracts/beauty/`
- Create Contract Registry template
- Set up CI pipeline (contract validation, versioning checks)
- Configure feature flags (gradual rollout)

---

### Week 1 Kickoff

**Day 1: Kickoff Meeting**
- Review roadmap (6 weeks, 3 phases)
- Assign contracts to engineers
- Review success metrics
- Set up weekly sync (Architecture Council + Product + Engineering)

**Day 1 Afternoon: Begin Phase 1**
- Engineer 1: IWaitlistEngine contract definition
- Engineer 2: IStaffAssignment contract definition
- Begin parallel work (2 contracts simultaneously)

---

**H1 Contract Extraction Roadmap Complete**  
**Status:** 🟡 PROPOSED - Awaiting H1 Architecture Gate Approval  
**Next:** Week 1 Kickoff (after Architecture Council approval)

