# ADR-004: Walk-in Queue Scope Decision

**Status:** ✅ **APPROVED**  
**Date:** 2026-09-15  
**Approved:** 2026-09-15 (H1 Final Gate Review)  
**Decision Makers:** Architecture Council, Platform Team  
**Context:** H1 Architecture Gate - Walk-in Queue is only genuine capability gap, scope decision needed

---

## Context

### Background

**H0 Finding:** Walk-in Queue Engine is the **only genuine capability gap** (0% reuse) among 15 Haircut requirements.

**Evidence:**
- ✅ Bella Spa has appointment-based booking (pre-booked only)
- ✅ Bella Spa has waitlist management (future booking, not immediate service)
- ❌ Bella Spa has NO walk-in queue (real-time customer queue for immediate service)
- ❌ Healthcare has patient queue (different domain - ER triage, not walk-in)

**Strategic Question:** Should Walk-in Queue be built as:
- **Option A:** Platform primitive (generic queue engine, cross-vertical reuse)
- **Option B:** Haircut product feature (beauty-specific, extract later if reused)
- **Option C:** Investigate Healthcare ER queue first (potential cross-vertical reuse)

**Key Distinction:**
- **Waitlist Management** = Future booking (customer wants service next week)
- **Walk-in Queue** = Immediate service (customer walks in NOW, wants service ASAP)

---

## Decision

**We adopt HAIRCUT PRODUCT FEATURE approach with OPTIONAL HEALTHCARE INVESTIGATION:**

### Primary Decision: Build as Haircut Product Feature

**Approach:** Build Walk-in Queue as Haircut product feature (Week 3), extract to platform LATER if Nail Shop or other vertical needs it.

**Location:**
```
src/products/bella-haircut/
├── engines/
│   └── walkin-queue-engine/
│       ├── queue-manager.ts          (FIFO + VIP priority)
│       ├── position-tracker.ts       (real-time position updates)
│       ├── notification.ts           (notify customer when ready)
│       └── capacity-integration.ts   (slot availability check)
└── services/
    └── walkin-queue.service.ts
```

**Database:**
```sql
CREATE TABLE walkin_queue (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  customer_id UUID NOT NULL,
  arrival_time TIMESTAMPTZ NOT NULL,
  estimated_wait INTEGER,  -- minutes
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'notified', 'in_progress', 'completed', 'left')),
  assigned_stylist_id UUID,
  assigned_station_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_walkin_queue_tenant_status ON walkin_queue(tenant_id, status);
CREATE INDEX idx_walkin_queue_position ON walkin_queue(position) WHERE status = 'waiting';
```

**Timeline:** Week 3 (2-3 days implementation)

---

### Optional Investigation: Healthcare ER Queue (Week 1)

**Approach:** Quick investigation (1-2 days) to check if Healthcare Kernel has reusable queue abstraction.

**Investigation Questions:**
1. Does Healthcare have patient queue implementation? (`hc_patient_queues` table found in H0)
2. Is ER queue generic enough for beauty walk-in use case?
3. Can queue abstraction be extracted from Healthcare?

**Decision Tree:**
```
Week 1 Investigation → Healthcare Queue Found?
    ├─ YES, Generic → Leverage Healthcare Queue Abstraction (Option A.1)
    ├─ YES, Medical-Specific → Build Haircut Queue (Option B)
    └─ NO → Build Haircut Queue (Option B)
```

**Investigation Timeline:** 1-2 days (Week 1, parallel with contract extraction)

**If Investigation Inconclusive or Healthcare Queue Not Reusable:** Default to Haircut product feature (primary decision).

---

## Rationale

### Why Haircut Product Feature (Not Platform Primitive)?

#### 1. Rule of Three Not Met

**Current State:**
- ❌ No other vertical currently needs walk-in queue
- ❌ Healthcare has ER queue (different domain - triage severity ≠ stylist availability)
- ❌ Retail checkout queue not in scope (not planned)
- ❌ Restaurant waiting list not in scope (not planned)

**Rule of Three Principle:**
> "Don't extract abstraction until you have 3 concrete use cases."

**Haircut walk-in queue = 1 use case only.** Insufficient for platform extraction.

---

#### 2. Domain-Specific Logic (Beauty Service Queue)

**Haircut Walk-in Queue Requirements:**

**Queue Position Algorithm:**
- FIFO (first in, first out) as base
- VIP priority override (VIP customers move ahead)
- Stylist skill matching (customer requests specific stylist)
- Station availability (customer needs specific station type)
- Service duration (quick services prioritized for efficiency)

**Example Prioritization:**
```typescript
function calculateQueuePosition(customer: Customer, request: WalkinRequest): number {
  let position = queue.length + 1;  // FIFO base
  
  // VIP override: move ahead of non-VIP
  if (customer.tier === 'VIP') {
    position = queue.filter(c => c.tier === 'VIP').length + 1;
  }
  
  // Stylist availability: if preferred stylist available, prioritize
  if (request.preferredStylist && isStylistAvailable(request.preferredStylist)) {
    position -= 2;
  }
  
  // Station availability: if required station available, prioritize
  if (request.requiredStation && isStationAvailable(request.requiredStation)) {
    position -= 1;
  }
  
  return Math.max(1, position);
}
```

**Beauty-Specific, NOT Generic:**
- Healthcare ER uses triage severity (critical → urgent → stable)
- Retail checkout uses # of items, express lanes
- Restaurant uses party size, table availability

**Conclusion:** Queue logic is domain-specific. Generic queue abstraction may be over-engineered.

---

#### 3. Integration with Beauty Capabilities

**Walk-in Queue Integrates Tightly with Beauty Services:**

```typescript
export class WalkinQueueService {
  constructor(
    private queueManager: QueueManager,
    private staffAssignment: IStaffAssignment,      // Beauty contract
    private resourceAllocation: IResourceAllocation, // Beauty contract
    private capacityManagement: CapacityManager,    // Beauty-specific
    private appointmentEngine: IAppointmentEngine   // Beauty contract
  ) {}
  
  async processNextInQueue(): Promise<void> {
    const next = await this.queueManager.getNext();
    
    // Beauty-specific: Check stylist availability (skill-based)
    const stylist = await this.staffAssignment.findAvailable({
      skills: next.requiredSkills,
      availability: 'now'
    });
    
    // Beauty-specific: Check station availability (resource type)
    const station = await this.resourceAllocation.allocate({
      resourceType: 'cutting_station',
      duration: next.estimatedDuration
    });
    
    // Beauty-specific: Convert walk-in to appointment
    await this.appointmentEngine.createAppointment({
      customerId: next.customerId,
      serviceId: next.serviceId,
      assignedStaffId: stylist.id,
      assignedResourceId: station.id,
      status: 'in_progress',
      source: 'walkin'
    });
    
    await this.queueManager.markInProgress(next.id);
  }
}
```

**Tight Coupling with Beauty Services:**
- Staff Assignment (skill-based)
- Resource Allocation (station-specific)
- Capacity Management (real-time beauty salon capacity)
- Appointment Engine (walk-in → appointment conversion)

**Conclusion:** Walk-in Queue is NOT standalone primitive. It's integrated with Beauty Services.

---

#### 4. Faster Implementation

**Platform Primitive (Generic Queue Engine):**
- Timeline: 3-4 weeks
- Complexity: Generic abstraction, configurable priority algorithms, multi-domain support
- Risk: Over-engineering (may not fit future use cases)

**Haircut Product Feature:**
- Timeline: 2-3 days
- Complexity: Beauty-specific, optimized for haircut use case
- Risk: Duplication if Nail Shop needs queue (mitigated by extraction later)

**Conclusion:** Product feature is 5× faster (3 days vs 3 weeks).

---

#### 5. Low Duplication Risk

**Future Verticals:**

**Nail Shop (Q1 2027):**
- Likely needs walk-in queue (nail salons have walk-ins)
- IF Nail Shop needs queue → Extract to platform then (2 use cases)
- Timeline for extraction: 1 week (haircut queue is well-defined, extraction is refactoring)

**Massage (Q2 2027):**
- Possibly needs walk-in queue (massage studios sometimes accept walk-ins)
- IF Massage needs queue → Validate extraction (3 use cases = Rule of Three)

**Other Verticals:**
- Healthcare ER: Has own queue (triage-based, different algorithm)
- Retail: Not in scope
- Restaurant: Not in scope

**Duplication Risk:** Low (only Nail Shop likely, 1 vertical duplication acceptable).

**Extraction Cost:** 1 week (if needed for Nail Shop).

**Conclusion:** Build now as product feature, extract later if Nail Shop validates reuse.

---

### Why NOT Platform Primitive (Yet)?

#### Rejected Reason 1: No Cross-Vertical Demand

**Platform Primitive Justification Requires:**
- ✅ 2+ verticals need capability (Rule of Two minimum for platform)
- ❌ Currently: Only Haircut needs walk-in queue
- ❌ Healthcare ER queue is different domain (not reusable abstraction)
- ❌ No other vertical in roadmap needs generic queue

**Conclusion:** Premature to build platform primitive with 1 use case.

---

#### Rejected Reason 2: Generic Abstraction Complexity

**Generic Queue Engine Requirements:**
```typescript
interface IQueueEngine {
  // Generic queue operations
  enqueue(item: QueueItem, priority?: Priority): Promise<QueueEntry>;
  dequeue(): Promise<QueueItem>;
  peek(): Promise<QueueItem>;
  
  // Configurable priority algorithm
  setPriorityAlgorithm(algorithm: PriorityAlgorithm): void;
  
  // Multi-domain support
  setQueueType(type: 'healthcare-triage' | 'beauty-walkin' | 'retail-checkout'): void;
  
  // Position tracking
  getPosition(itemId: string): Promise<number>;
  updatePosition(itemId: string, newPosition: number): Promise<void>;
  
  // Notification system
  notifyWhenReady(itemId: string, notification: NotificationConfig): Promise<void>;
}
```

**Complexity:**
- Configurable priority algorithms (FIFO, priority-based, time-weighted, custom)
- Multi-domain support (healthcare, beauty, retail, restaurant)
- Generic notification system (SMS, email, app push, configurable)
- Generic position tracking (may not fit all domains)

**Over-Engineering Risk:**
- Healthcare ER queue may not fit generic abstraction (triage severity ≠ FIFO)
- Beauty walk-in may need different position tracking than retail checkout
- Generic abstraction may be too rigid (hard to customize per domain)

**Conclusion:** Generic queue is 3× more complex than Haircut-specific queue. Not justified with 1 use case.

---

#### Rejected Reason 3: Platform Core Freeze May Block

**Platform Core Status:** Approaching freeze (Architecture Proof Week - August 2026).

**Risk:** If Walk-in Queue is platform primitive, it may:
- ❌ Block Core Freeze (new primitive addition)
- ❌ Require Architecture Council approval (platform change)
- ❌ Delay Haircut MVP (waiting for platform approval)

**Product Feature:** Bypasses Platform Core Freeze (product-level change, autonomous).

**Conclusion:** Product feature reduces risk of Platform Core dependency.

---

### Optional Healthcare Investigation Rationale

#### Why Investigate Healthcare ER Queue?

**Potential Benefits:**
1. **Leverage Existing Implementation:** If Healthcare has generic queue abstraction, reuse it
2. **Cross-Vertical Validation:** Test if Healthcare → Beauty queue abstraction works
3. **Platform-of-Platforms Validation:** Validate kernel reuse across verticals

**Investigation Scope (1-2 days, Week 1):**

**Step 1: Code Search**
- Search Healthcare Kernel for: `patient_queue`, `triage_queue`, `waiting_queue`, `er_queue`
- Check: `platform/healthcare/engines/` for queue implementation

**Step 2: Contract Analysis**
- IF queue found: Check if Healthcare has `IQueueEngine` contract
- Analyze: Is contract generic or healthcare-specific?
- Example: Does contract expose triage severity or generic priority?

**Step 3: Applicability Assessment**
```typescript
// Healthcare ER Queue (hypothetical)
interface ITriageQueue {
  addPatient(patient: Patient, severity: TriageSeverity): Promise<QueueEntry>;
  getNextCritical(): Promise<Patient>;
  getNextUrgent(): Promise<Patient>;
  // ...
}

// Question: Can this fit beauty walk-in queue?
// - TriageSeverity (critical/urgent/stable) ≠ VIP priority
// - getNextCritical() ≠ beauty queue processing (stylist skill-based)
// - Medical-specific semantics (patient, triage) vs beauty (customer, service)
```

**Decision Criteria:**
- ✅ **IF Healthcare queue is generic:** Extract abstraction, Haircut reuses
- ⚠️ **IF Healthcare queue is medical-specific:** Analyze if abstraction can be extracted
- ❌ **IF Healthcare queue doesn't exist or incompatible:** Build Haircut queue (product feature)

**Fallback:** If investigation takes > 2 days or inconclusive, default to Haircut product feature.

---

#### Why Optional (Not Required)?

**Low Probability of Reusable Abstraction:**
- Healthcare ER queue likely medical-specific (triage severity, emergency protocols)
- Cross-vertical queue reuse unproven (no precedent in Bella architecture)
- Investigation may find no queue or incompatible abstraction

**Cost-Benefit:**
- Investigation cost: 1-2 days (low)
- Benefit if successful: Reuse mature queue implementation (high)
- Risk if unsuccessful: 2 days lost (acceptable)

**Recommendation:** Attempt investigation (low cost), but timebox to 2 days. If inconclusive, proceed with Haircut product feature.

---

## Implementation Plan

### Week 1: Optional Healthcare Investigation (1-2 days)

**Day 1: Healthcare Queue Search**
1. Search Healthcare Kernel codebase:
   ```bash
   grep -r "patient_queue\|triage_queue\|waiting_queue\|er_queue" platform/healthcare/
   ```
2. Check Healthcare contracts:
   ```bash
   ls platform/healthcare/contracts/ | grep -i queue
   ```
3. Review Healthcare engine structure:
   ```bash
   ls -la platform/healthcare/engines/ | grep -i queue
   ```

**Day 2: Applicability Analysis (if queue found)**
1. Read queue implementation (contract + engine)
2. Assess: Is queue generic or medical-specific?
3. Prototype: Can beauty walk-in map to Healthcare queue?
4. Decision: Reuse abstraction OR build Haircut queue

**Decision Point (End of Day 2):**
- ✅ **Healthcare queue reusable:** Design abstraction extraction plan
- ❌ **Healthcare queue incompatible:** Proceed to Haircut product feature (Week 3)

---

### Week 3: Haircut Walk-in Queue Implementation (2-3 days)

**Prerequisite:** Week 1-2 contract extraction complete (4 critical contracts available).

**Day 1: Queue Manager + Database**

**Create Database Schema:**
```sql
-- Migration: 20260915000000_create_walkin_queue.sql
CREATE TABLE walkin_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  service_id UUID NOT NULL REFERENCES packages(id),
  
  -- Queue metadata
  arrival_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  estimated_wait INTEGER,  -- minutes
  position INTEGER NOT NULL,
  
  -- Status lifecycle
  status TEXT NOT NULL CHECK (status IN ('waiting', 'notified', 'in_progress', 'completed', 'cancelled', 'left')),
  
  -- Assignment
  assigned_stylist_id UUID REFERENCES users(id),
  assigned_station_id UUID REFERENCES booking_resources(id),
  notified_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Customer preferences
  preferred_stylist_id UUID REFERENCES users(id),
  required_skills JSONB DEFAULT '[]',
  notes TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_walkin_queue_tenant_status ON walkin_queue(tenant_id, status);
CREATE INDEX idx_walkin_queue_position ON walkin_queue(position) WHERE status = 'waiting';
CREATE INDEX idx_walkin_queue_arrival ON walkin_queue(arrival_time) WHERE status = 'waiting';
CREATE INDEX idx_walkin_queue_customer ON walkin_queue(customer_id);

-- RLS policies
ALTER TABLE walkin_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY walkin_queue_tenant_isolation ON walkin_queue
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Implement Queue Manager:**
```typescript
// src/products/bella-haircut/engines/walkin-queue-engine/queue-manager.ts

export class QueueManager {
  constructor(private db: Database) {}
  
  async addToQueue(request: WalkinRequest): Promise<QueueEntry> {
    const customer = await this.db.customers.findById(request.customerId);
    const position = await this.calculatePosition(customer, request);
    const estimatedWait = await this.estimateWait(position, request.serviceId);
    
    return this.db.walkinQueue.insert({
      customerId: request.customerId,
      serviceId: request.serviceId,
      position,
      estimatedWait,
      status: 'waiting',
      preferredStylistId: request.preferredStylistId,
      requiredSkills: request.requiredSkills
    });
  }
  
  private async calculatePosition(customer: Customer, request: WalkinRequest): Promise<number> {
    const waitingCount = await this.db.walkinQueue.count({ status: 'waiting' });
    let position = waitingCount + 1;
    
    // VIP priority: move ahead of non-VIP
    if (customer.tier === 'VIP' || customer.tier === 'Loyal') {
      const vipCount = await this.db.walkinQueue.count({
        status: 'waiting',
        'customer.tier': ['VIP', 'Loyal']
      });
      position = vipCount + 1;
    }
    
    return position;
  }
  
  private async estimateWait(position: number, serviceId: string): Promise<number> {
    const service = await this.db.packages.findById(serviceId);
    const avgDuration = service.duration || 60;  // minutes
    
    // Simple estimation: position × average service duration
    return position * avgDuration;
  }
  
  async getNext(): Promise<QueueEntry | null> {
    return this.db.walkinQueue.findOne({
      status: 'waiting'
    }, {
      orderBy: { position: 'ASC' }
    });
  }
  
  async updatePosition(entryId: string, newPosition: number): Promise<void> {
    await this.db.walkinQueue.update(entryId, { position: newPosition });
  }
  
  async markNotified(entryId: string): Promise<void> {
    await this.db.walkinQueue.update(entryId, {
      status: 'notified',
      notifiedAt: new Date()
    });
  }
  
  async markInProgress(entryId: string, stylistId: string, stationId: string): Promise<void> {
    await this.db.walkinQueue.update(entryId, {
      status: 'in_progress',
      assignedStylistId: stylistId,
      assignedStationId: stationId,
      startedAt: new Date()
    });
  }
  
  async markCompleted(entryId: string): Promise<void> {
    await this.db.walkinQueue.update(entryId, {
      status: 'completed',
      completedAt: new Date()
    });
  }
  
  async removeFromQueue(entryId: string, reason: 'cancelled' | 'left'): Promise<void> {
    await this.db.walkinQueue.update(entryId, {
      status: reason,
      completedAt: new Date()
    });
    
    // Recalculate positions for remaining entries
    await this.recalculatePositions();
  }
  
  private async recalculatePositions(): Promise<void> {
    const waiting = await this.db.walkinQueue.find({
      status: 'waiting'
    }, {
      orderBy: { position: 'ASC' }
    });
    
    for (let i = 0; i < waiting.length; i++) {
      await this.db.walkinQueue.update(waiting[i].id, {
        position: i + 1
      });
    }
  }
}
```

---

**Day 2: Position Tracker + Integration**

**Implement Position Tracker:**
```typescript
// src/products/bella-haircut/engines/walkin-queue-engine/position-tracker.ts

export class PositionTracker {
  constructor(
    private queueManager: QueueManager,
    private eventBus: EventBus
  ) {}
  
  async trackPosition(entryId: string): Promise<void> {
    const entry = await this.queueManager.getEntry(entryId);
    const currentPosition = entry.position;
    
    // Real-time position tracking (polling every 30 seconds)
    const interval = setInterval(async () => {
      const updated = await this.queueManager.getEntry(entryId);
      
      if (updated.position !== currentPosition) {
        // Position changed, emit event
        await this.eventBus.publish('queue.position.changed', {
          entryId: updated.id,
          customerId: updated.customerId,
          oldPosition: currentPosition,
          newPosition: updated.position,
          estimatedWait: updated.estimatedWait
        });
      }
      
      if (updated.status !== 'waiting') {
        clearInterval(interval);  // Stop tracking
      }
    }, 30000);  // 30 seconds
  }
  
  async getQueueStatus(customerId: string): Promise<QueueStatus> {
    const entry = await this.queueManager.getEntryByCustomer(customerId);
    
    if (!entry || entry.status !== 'waiting') {
      return { inQueue: false };
    }
    
    const ahead = await this.queueManager.countAhead(entry.position);
    const estimatedWait = entry.estimatedWait;
    
    return {
      inQueue: true,
      position: entry.position,
      ahead,
      estimatedWait,
      status: entry.status
    };
  }
}
```

**Integrate with Beauty Services:**
```typescript
// src/products/bella-haircut/services/walkin-queue.service.ts

export class WalkinQueueService {
  constructor(
    private queueManager: QueueManager,
    private positionTracker: PositionTracker,
    private staffAssignment: IStaffAssignment,      // Beauty contract
    private resourceAllocation: IResourceAllocation, // Beauty contract
    private appointmentEngine: IAppointmentEngine,   // Beauty contract
    private notificationService: NotificationService
  ) {}
  
  async addWalkin(request: WalkinRequest): Promise<QueueEntry> {
    // Add to queue
    const entry = await this.queueManager.addToQueue(request);
    
    // Start position tracking
    await this.positionTracker.trackPosition(entry.id);
    
    // Notify customer (SMS/app)
    await this.notificationService.send({
      customerId: request.customerId,
      type: 'walkin_added',
      data: {
        position: entry.position,
        estimatedWait: entry.estimatedWait
      }
    });
    
    return entry;
  }
  
  async processNextInQueue(): Promise<void> {
    const next = await this.queueManager.getNext();
    
    if (!next) {
      return;  // Queue empty
    }
    
    // Find available stylist (skill-based)
    const stylist = await this.staffAssignment.findAvailable({
      skills: next.requiredSkills,
      availability: 'now',
      preferredStaffId: next.preferredStylistId
    });
    
    if (!stylist) {
      // No stylist available, skip for now
      return;
    }
    
    // Allocate station
    const station = await this.resourceAllocation.allocate({
      resourceType: 'cutting_station',
      duration: 60  // estimated duration
    });
    
    if (!station) {
      // No station available, skip for now
      return;
    }
    
    // Notify customer (ready for service)
    await this.notificationService.send({
      customerId: next.customerId,
      type: 'walkin_ready',
      data: {
        stylistName: stylist.name,
        stationName: station.name
      }
    });
    
    // Mark as notified
    await this.queueManager.markNotified(next.id);
    
    // Convert walk-in to appointment (after customer confirms)
    // This happens when customer checks in at counter
  }
  
  async confirmWalkin(entryId: string): Promise<Appointment> {
    const entry = await this.queueManager.getEntry(entryId);
    
    // Create appointment (in_progress status)
    const appointment = await this.appointmentEngine.createAppointment({
      customerId: entry.customerId,
      serviceId: entry.serviceId,
      assignedStaffId: entry.assignedStylistId,
      assignedResourceId: entry.assignedStationId,
      status: 'in_progress',
      source: 'walkin',
      startTime: new Date()
    });
    
    // Mark queue entry as in_progress
    await this.queueManager.markInProgress(
      entry.id,
      entry.assignedStylistId!,
      entry.assignedStationId!
    );
    
    return appointment;
  }
  
  async cancelWalkin(entryId: string): Promise<void> {
    await this.queueManager.removeFromQueue(entryId, 'cancelled');
    
    // Customer left
    await this.notificationService.send({
      customerId: entry.customerId,
      type: 'walkin_cancelled'
    });
  }
  
  async getQueueStatus(customerId: string): Promise<QueueStatus> {
    return this.positionTracker.getQueueStatus(customerId);
  }
}
```

---

**Day 3: Notification + Testing**

**Implement Notification System:**
```typescript
// Integration with existing notification service
await this.notificationService.send({
  customerId: customer.id,
  channel: customer.preferredChannel || 'sms',  // SMS, email, app push
  template: 'walkin_added',
  data: {
    position: entry.position,
    estimatedWait: entry.estimatedWait,
    serviceName: service.name
  }
});
```

**Testing:**
1. Unit tests: Queue Manager (add, remove, recalculate positions)
2. Unit tests: Position Tracker (real-time updates)
3. Integration tests: Walkin Queue Service (end-to-end flow)
4. Integration tests: Beauty Services integration (Staff Assignment, Resource Allocation, Appointment Engine)

**Test Scenarios:**
- Add 5 customers to queue → verify positions (1-5)
- Add VIP customer → verify VIP jumps ahead
- Remove customer from middle → verify positions recalculated
- Process next in queue → verify stylist + station assigned
- Customer confirms walkin → verify appointment created
- Customer cancels → verify removed from queue

---

## Extraction Strategy (If Nail Shop Needs Queue - Q1 2027)

### Extraction Trigger

**IF Nail Shop needs walk-in queue (Q1 2027):**
- Extract to `src/contracts/beauty/IWalkinQueue.ts` (Beauty Capability Contract)
- Keep implementation in Haircut (Nail reuses contract)
- **OR** Extract to platform if 3rd vertical needs queue (Rule of Three)

---

### Extraction Plan (1 week)

**Step 1: Define IWalkinQueue Contract**
```typescript
// src/contracts/beauty/IWalkinQueue.ts

export interface IWalkinQueue {
  // Queue operations
  addToQueue(request: WalkinRequest): Promise<QueueEntry>;
  getNext(): Promise<QueueEntry | null>;
  removeFromQueue(entryId: string, reason: 'cancelled' | 'left'): Promise<void>;
  
  // Position tracking
  getPosition(entryId: string): Promise<number>;
  getQueueStatus(customerId: string): Promise<QueueStatus>;
  
  // Status updates
  markNotified(entryId: string): Promise<void>;
  markInProgress(entryId: string, staffId: string, resourceId: string): Promise<void>;
  markCompleted(entryId: string): Promise<void>;
}

export interface WalkinRequest {
  customerId: string;
  serviceId: string;
  preferredStaffId?: string;
  requiredSkills?: string[];
  notes?: string;
}

export interface QueueEntry {
  id: string;
  customerId: string;
  serviceId: string;
  position: number;
  estimatedWait: number;
  status: 'waiting' | 'notified' | 'in_progress' | 'completed' | 'cancelled' | 'left';
  assignedStaffId?: string;
  assignedResourceId?: string;
  arrivalTime: Date;
  notifiedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface QueueStatus {
  inQueue: boolean;
  position?: number;
  ahead?: number;
  estimatedWait?: number;
  status?: string;
}
```

**Step 2: Move Implementation to Shared Location**
```
src/products/bella-haircut/engines/walkin-queue-engine/
  → src/shared/engines/walkin-queue-engine/  (if shared across beauty verticals)
  OR keep in Haircut, Nail imports via contract
```

**Step 3: Migrate Haircut to Contract**
```typescript
// Haircut service
import { IWalkinQueue } from '@contracts/beauty';

export class WalkinQueueService {
  constructor(private walkinQueue: IWalkinQueue) {}  // Via contract
  
  async addWalkin(request: WalkinRequest) {
    return this.walkinQueue.addToQueue(request);  // Contract method
  }
}
```

**Step 4: Nail Shop Consumes Contract**
```typescript
// Nail Shop service
import { IWalkinQueue } from '@contracts/beauty';

export class NailWalkinService {
  constructor(private walkinQueue: IWalkinQueue) {}  // Same contract
  
  async addWalkin(request: WalkinRequest) {
    return this.walkinQueue.addToQueue(request);  // Reuses Haircut implementation
  }
}
```

**Extraction Timeline:** 1 week (contract definition + migration)

---

### Platform Extraction (If 3rd Vertical Needs Queue - Q2 2027+)

**IF Massage (or other vertical) needs walk-in queue:**
- Extract to `platform/core/queue-engine/` (generic queue primitive)
- OR `platform/beauty-services/engines/walkin-queue-engine/` (Beauty Services Platform)
- Requires Architecture Council approval (platform change)

**Timeline:** 2 weeks (generic abstraction + migration of 3 verticals)

---

## Alternatives Considered

### Alternative 1: Platform Primitive NOW (Rejected)

**Approach:** Build generic `QueueEngine` in Platform Core, Haircut configures for beauty use case.

**Rejected Because:**
- ⚠️ Only 1 use case (Rule of Three not met)
- ⚠️ Generic abstraction complexity (3× longer implementation)
- ⚠️ Platform Core Freeze risk (may block Haircut MVP)
- ⚠️ Over-engineering (may not fit future use cases)
- ⚠️ 3 weeks implementation vs 3 days product feature

---

### Alternative 2: Extract Healthcare ER Queue Abstraction (Conditional)

**Approach:** Extract generic queue abstraction from Healthcare ER, Haircut reuses.

**Conditional Because:**
- ✅ IF Healthcare has generic queue → Leverage existing implementation
- ❌ IF Healthcare queue is medical-specific → Not reusable
- ❓ Unknown until investigation (Week 1)

**Decision:** Attempt investigation (1-2 days), fallback to Haircut product feature if inconclusive.

---

### Alternative 3: Never Extract (Keep Product-Level Forever) (Rejected)

**Approach:** Build walk-in queue in Haircut, Nail Shop duplicates if needed, never extract.

**Rejected Because:**
- ⚠️ Duplication if Nail Shop needs queue (acceptable for 1 vertical, not 2+)
- ⚠️ Violates DRY principle (Don't Repeat Yourself)
- ⚠️ Maintenance burden (2+ implementations to maintain)
- ⚠️ Nail Shop launch slower (must rebuild queue)

**Conclusion:** Extract if 2nd vertical needs queue (Rule of Two for extraction trigger).

---

## Related Decisions

- **ADR-001:** Core vs Kernel Boundary Definition (Platform-of-Platforms, Rule of Three)
- **ADR-002:** Contract Extraction Strategy (Haircut product feature allowed)
- **ADR-003:** Beauty Services Platform Formalization (Walk-in Queue may join platform Phase 3)
- **ADR-005:** Service Inventory Source (Logistics E7 vs custom)
- **H0:** Bella Haircut Capability Reuse Assessment (Walk-in Queue = only genuine gap)
- **H1:** Architecture Gate (Decision 3: Walk-in Queue scope)

---

## Approval

**Status:** 🟡 **PROPOSED** - Awaiting Architecture Council approval

**Approval Criteria:**
- [ ] Architecture Council approves product feature approach
- [ ] Optional Healthcare investigation approved (1-2 days, Week 1)
- [ ] Extraction trigger confirmed (IF Nail Shop needs queue → extract)
- [ ] Timeline approved (Week 3 implementation, 2-3 days)

**If Approved:**
- Week 1: Optional Healthcare investigation (1-2 days, parallel with contract extraction)
- Week 3: Haircut Walk-in Queue implementation (2-3 days)
- Q1 2027: Extraction decision (if Nail Shop needs queue)

**If Rejected:**
- Fallback: Build generic Queue Engine (platform primitive)
- Timeline: 3-4 weeks (longer implementation)
- Risk: Over-engineering, Platform Core dependency

---

## Consequences

### Positive

1. **Fast Implementation:** 2-3 days (vs 3 weeks platform primitive)
2. **Haircut-Optimized:** Beauty-specific logic, no generic abstraction overhead
3. **Low Risk:** Product-level change, no Platform Core dependency
4. **Flexible Extraction:** Easy to extract if Nail Shop validates reuse (1 week)
5. **Rule of Three Respected:** Wait for 2nd use case before extraction

### Negative

1. **Duplication Risk:** If Nail Shop needs queue, must extract (1 week cost)
2. **Not Cross-Vertical:** Doesn't validate platform-wide queue reuse
3. **Healthcare Investigation May Fail:** 1-2 days investigation may find nothing

### Neutral

1. **Product Ownership:** Haircut team owns queue (not platform team)
2. **Governance:** Lightweight (product-level, not platform governance)
3. **Extraction Later:** Deferred decision to Q1 2027 (if Nail Shop validates)

---

**ADR-004 Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** 🟡 **PROPOSED**  
**Next Review:** After Nail Shop planning (Q1 2027) - extraction decision

