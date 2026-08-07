# Event Bus Integration Examples

**Phase:** Phase 0 (Week 6)  
**Constitution:** Law 5 (Event-First Architecture)  
**Status:** Implementation Guide

---

## Overview

Event Bus enables loose coupling between Healthcare Platform engines and downstream consumers via domain event publishing/subscription.

**Architecture:**
```
Bed Engine → Event Bus → [Billing Engine, Nursing Engine, Notification Hub]
     ↓           ↓              ↓
  Publish   Route/Filter   Subscribe
```

---

## Example 1: Bed Allocated Event

### Publisher (Bed Engine)

```typescript
// src/platform/healthcare/engines/bed-engine/bed-engine.service.ts

import { EventBusService } from '@/platform/host/event-bus';
import type { BedAllocatedEvent } from '../../contracts/bed-engine.contract';

export class BedEngineService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly eventBus: EventBusService
  ) {}

  async allocateBed(request: BedAllocationRequest): Promise<EngineResponse<Bed>> {
    // 1. Allocate bed in database
    const bed = await this.allocateBedInDB(request);

    // 2. Publish domain event
    const event: BedAllocatedEvent = {
      eventType: 'BedAllocated',
      version: '1.0.0',
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tenantId: request.tenantId,
      aggregateId: request.encounterId, // Encounter is aggregate root (Law 1)
      aggregateType: 'encounter',
      payload: {
        bedId: bed.id,
        patientId: request.patientId,
        admissionId: request.admissionId,
        wardId: request.wardId,
        bedType: bed.bedType,
        allocatedBy: request.requestedBy,
      },
      metadata: {
        userId: request.requestedBy,
        source: 'bed-engine',
        correlationId: crypto.randomUUID(),
      },
    };

    await this.eventBus.publish(event);

    console.log(`[BedEngine] Published BedAllocated event: ${event.eventId}`);

    return { success: true, data: bed };
  }
}
```

### Subscriber (Billing Engine)

```typescript
// src/platform/healthcare/engines/billing-engine/billing-engine.service.ts

import { EventBusService } from '@/platform/host/event-bus';
import type { BedAllocatedEvent } from '../../contracts/bed-engine.contract';

export class BillingEngineService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly eventBus: EventBusService
  ) {
    // Subscribe to BedAllocated events
    this.eventBus.subscribe<BedAllocatedEvent>(
      'BedAllocated',
      this.handleBedAllocated.bind(this)
    );
  }

  private async handleBedAllocated(event: BedAllocatedEvent): Promise<void> {
    console.log(`[BillingEngine] Received BedAllocated: ${event.eventId}`);

    // Create billing item for bed allocation
    const billingItem = {
      tenant_id: event.tenantId,
      encounter_id: event.aggregateId,
      patient_id: event.payload.patientId,
      item_type: 'room',
      code: 'BED-ALLOCATION',
      description: `Bed allocation - Ward ${event.payload.wardId}`,
      quantity: 1,
      unit_price: 50000, // VND per day (TODO: Get from pricing table)
      status: 'pending',
      billed_date: event.timestamp,
    };

    const { error } = await this.supabase
      .from('billing_items')
      .insert(billingItem);

    if (error) {
      console.error('[BillingEngine] Failed to create billing item:', error);
      // TODO: Retry logic or dead letter queue
    } else {
      console.log('[BillingEngine] Created billing item for bed allocation');
    }
  }
}
```

---

## Example 2: Medication Administered Event

### Publisher (Pharmacy Engine)

```typescript
// src/platform/healthcare/engines/pharmacy-engine/pharmacy-engine.service.ts

export class PharmacyEngineService {
  async recordMedicationAdministration(
    request: MARAdministrationRequest
  ): Promise<EngineResponse<{ id: string }>> {
    // 1. Record in MAR
    const marRecord = await this.recordMAR(request);

    // 2. Publish event
    const event: MedicationAdministeredEvent = {
      eventType: 'MedicationAdministered',
      version: '1.0.0',
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tenantId: request.tenantId,
      aggregateId: request.encounterId,
      aggregateType: 'encounter',
      payload: {
        marRecordId: marRecord.id,
        medicationOrderId: request.medicationOrderId,
        patientId: request.patientId,
        administeredBy: request.administeredBy,
        dosageGiven: request.dosageGiven,
        route: request.route,
      },
    };

    await this.eventBus.publish(event);

    return { success: true, data: { id: marRecord.id } };
  }
}
```

### Subscriber (Clinical Engine)

```typescript
// src/platform/healthcare/engines/clinical-engine/clinical-engine.service.ts

export class ClinicalEngineService {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly eventBus: EventBusService
  ) {
    // Subscribe to medication events for clinical timeline
    this.eventBus.subscribe<MedicationAdministeredEvent>(
      'MedicationAdministered',
      this.handleMedicationAdministered.bind(this)
    );
  }

  private async handleMedicationAdministered(
    event: MedicationAdministeredEvent
  ): Promise<void> {
    // Add to clinical timeline
    const timelineEntry = {
      tenant_id: event.tenantId,
      encounter_id: event.aggregateId,
      patient_id: event.payload.patientId,
      entry_type: 'medication',
      title: 'Medication Administered',
      description: `Dosage: ${event.payload.dosageGiven.value} ${event.payload.dosageGiven.unit}`,
      recorded_by: event.payload.administeredBy,
      recorded_at: event.timestamp,
      metadata: {
        marRecordId: event.payload.marRecordId,
        route: event.payload.route,
      },
    };

    await this.supabase.from('clinical_timeline').insert(timelineEntry);

    console.log('[ClinicalEngine] Added medication to clinical timeline');
  }
}
```

---

## Example 3: Vitals Recorded Event (AI Integration)

### Publisher (Nursing Engine)

```typescript
export class NursingEngineService {
  async recordVitalSigns(request: RecordVitalsRequest): Promise<EngineResponse<VitalSigns>> {
    const vitals = await this.saveVitals(request);

    // Publish event
    const event: VitalsRecordedEvent = {
      eventType: 'VitalsRecorded',
      version: '1.0.0',
      eventId: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      tenantId: request.tenantId,
      aggregateId: request.encounterId,
      aggregateType: 'encounter',
      payload: {
        vitalsId: vitals.id,
        patientId: request.patientId,
        temperature: vitals.temperature,
        bloodPressure: vitals.bloodPressure,
        heartRate: vitals.heartRate,
        oxygenSaturation: vitals.oxygenSaturation,
        recordedBy: request.recordedBy,
      },
    };

    await this.eventBus.publish(event);

    return { success: true, data: vitals };
  }
}
```

### Subscriber (AI Runtime - Critical Value Detection)

```typescript
// src/platform/host/ai-runtime/ai-runtime.service.ts

export class AIRuntimeService {
  constructor(
    private readonly eventBus: EventBusService,
    private readonly notificationHub: NotificationHubService
  ) {
    this.eventBus.subscribe<VitalsRecordedEvent>(
      'VitalsRecorded',
      this.detectCriticalVitals.bind(this)
    );
  }

  private async detectCriticalVitals(event: VitalsRecordedEvent): Promise<void> {
    const { bloodPressure, heartRate, oxygenSaturation } = event.payload;

    // Critical value detection
    const criticalConditions = [];

    if (bloodPressure && bloodPressure.systolic > 180) {
      criticalConditions.push('Severe Hypertension');
    }
    if (heartRate && heartRate.value > 120) {
      criticalConditions.push('Tachycardia');
    }
    if (oxygenSaturation && oxygenSaturation.value < 90) {
      criticalConditions.push('Hypoxemia');
    }

    if (criticalConditions.length > 0) {
      // Send alert
      await this.notificationHub.sendAlert({
        tenantId: event.tenantId,
        priority: 'critical',
        title: 'Critical Vital Signs Detected',
        message: `Patient ${event.payload.patientId}: ${criticalConditions.join(', ')}`,
        recipients: ['doctor', 'charge-nurse'],
        encounterId: event.aggregateId,
      });

      console.log(`[AIRuntime] Critical vitals alert sent: ${criticalConditions.join(', ')}`);
    }
  }
}
```

---

## Event Bus Implementation (Simplified)

```typescript
// src/platform/host/event-bus/event-bus.service.ts

import type { DomainEvent, EventMetadata } from '@/platform/healthcare/shared-kernel/types';

type EventHandler<T = unknown> = (event: DomainEvent<T>) => Promise<void>;

export class EventBusService {
  private subscribers: Map<string, EventHandler[]> = new Map();

  /**
   * Publish a domain event
   */
  async publish<T>(event: DomainEvent<T>): Promise<void> {
    console.log(`[EventBus] Publishing: ${event.eventType} (${event.eventId})`);

    // Get subscribers for this event type
    const handlers = this.subscribers.get(event.eventType) || [];

    // Execute handlers in parallel
    await Promise.allSettled(
      handlers.map(handler => handler(event))
    );

    // Optional: Persist event to event_store table for audit
    await this.persistEvent(event);
  }

  /**
   * Subscribe to an event type
   */
  subscribe<T>(eventType: string, handler: EventHandler<T>): void {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(handler as EventHandler);

    console.log(`[EventBus] Subscribed to: ${eventType}`);
  }

  private async persistEvent<T>(event: DomainEvent<T>): Promise<void> {
    // TODO: Persist to event_store table for audit trail and event replay
  }
}
```

---

## Event Catalog (Contract Registry)

Register all events in Contract Registry for governance:

```typescript
// src/platform/healthcare/contracts/index.ts

import { contractRegistry } from '@/platform/host/contract-registry';
import { BED_ENGINE_CONTRACT, NURSING_ENGINE_CONTRACT } from './contracts';

export function registerHealthcareEngineContracts() {
  contractRegistry.registerContract(BED_ENGINE_CONTRACT);
  contractRegistry.registerContract(NURSING_ENGINE_CONTRACT);
  // ... register all engine contracts

  console.log('[HealthcarePlatform] Registered 13 engine contracts');
}
```

---

## Testing Event Handlers

```typescript
// src/platform/healthcare/engines/billing-engine/__tests__/bed-allocated-handler.test.ts

describe('BillingEngine - BedAllocated Handler', () => {
  it('should create billing item when bed allocated', async () => {
    const event: BedAllocatedEvent = {
      eventType: 'BedAllocated',
      version: '1.0.0',
      eventId: 'test-event-123',
      timestamp: '2026-08-07T10:00:00Z',
      tenantId: 'test-tenant',
      aggregateId: 'encounter-456',
      aggregateType: 'encounter',
      payload: {
        bedId: 'bed-789',
        patientId: 'patient-101',
        admissionId: 'admission-202',
        wardId: 'ward-303',
        bedType: 'standard',
        allocatedBy: 'nurse-404',
      },
    };

    // Trigger handler
    await billingEngine.handleBedAllocated(event);

    // Assert billing item created
    const billingItems = await supabase
      .from('billing_items')
      .select('*')
      .eq('encounter_id', 'encounter-456');

    expect(billingItems.data).toHaveLength(1);
    expect(billingItems.data[0].item_type).toBe('room');
    expect(billingItems.data[0].code).toBe('BED-ALLOCATION');
  });
});
```

---

## Next Steps

1. **Week 6:** Implement Event Bus Service skeleton
2. **Week 6:** Add event publishing to 3 placeholder engines
3. **Week 6:** Create 2-3 example subscribers (Billing, Clinical, AI)
4. **Post-Phase 0:** Add event_store table for audit
5. **Post-Phase 0:** Add event replay capability
6. **Post-Phase 0:** Add dead letter queue for failed handlers

---

**Constitution Compliance:** ✅ Law 5 (Event-First Architecture)  
**Status:** Implementation guide complete, awaiting Week 6 execution
