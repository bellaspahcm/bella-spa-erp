# ADR-004: Event-Driven Architecture

**Status:** APPROVED  
**Date:** 2026-08-02  
**Decision Makers:** Chief Architect, Platform Team Lead  
**Consulted:** All Engineering Teams  
**Informed:** Product, QA, DevOps

---

## Context

Bella AI Platform serves multiple industries with shared capabilities (Identity, Finance, CRM, Analytics, Audit, Notification, AI). As the platform grows:

**Current Problems:**
- **Tight coupling:** Modules call each other directly (`approveRegistration()` → `sendEmail()` → `createAuditLog()` → `notifyCRM()`)
- **Brittleness:** Adding a new subscriber (e.g., Analytics) requires modifying core code
- **Testing difficulty:** Cannot test modules in isolation
- **Deployment coupling:** Cannot deploy modules independently
- **Scalability bottleneck:** Synchronous calls block the request thread

**Question:** How do we decouple modules while maintaining data consistency and auditability?

---

## Decision

We will adopt **Event-Driven Architecture** as the primary inter-module communication pattern.

**Core Principle:** *"Modules communicate through events, not direct calls."*

---

## Architecture

### Event Bus (Message Broker)

```
┌──────────────┐
│  Publisher   │ (e.g., Identity Module)
└──────┬───────┘
       │ Publish Event
       ↓
┌──────────────────────────────────────┐
│           Event Bus                  │
│  (PostgreSQL LISTEN/NOTIFY + Queue)  │
└──────┬──────┬──────┬──────┬──────────┘
       │      │      │      │
       ↓      ↓      ↓      ↓
   ┌────┐  ┌────┐  ┌────┐  ┌────┐
   │ S1 │  │ S2 │  │ S3 │  │ S4 │  Subscribers
   └────┘  └────┘  └────┘  └────┘  (Audit, Notification, CRM, Analytics)
```

**Implementation:**
- **Primary:** PostgreSQL `LISTEN/NOTIFY` for real-time events
- **Queue:** Supabase Edge Functions + Background Jobs for guaranteed delivery
- **Backup:** Redis Streams (future, if needed for high-throughput)

---

## Event Schema

### Standard Event Envelope

```typescript
interface DomainEvent {
  // Identification
  eventId: string;              // UUID, unique event ID
  eventType: string;            // 'IdentityApproved', 'BookingConfirmed'
  eventVersion: string;         // '1.0', for schema evolution
  
  // Aggregate
  aggregateId: string;          // ID of the entity (Identity, Booking, etc.)
  aggregateType: string;        // 'Identity', 'Booking', 'Invoice'
  
  // Payload
  payload: Record<string, any>; // Event-specific data
  
  // Metadata
  metadata: {
    tenantId: string;           // Multi-tenant isolation
    userId?: string;            // Who triggered the event
    timestamp: string;          // ISO8601
    correlationId: string;      // Track related events across services
    causationId?: string;       // Event that caused this event
    source: string;             // 'identity-service', 'booking-service'
    environment: string;        // 'production', 'staging', 'development'
  };
}
```

### Example Event: IdentityApproved

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "eventType": "IdentityApproved",
  "eventVersion": "1.0",
  "aggregateId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "aggregateType": "Identity",
  "payload": {
    "identityId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "identityCategory": "partner",
    "displayName": "Sunshine Realty",
    "email": "contact@sunshine-realty.com",
    "approvedBy": "admin-user-id",
    "approvalNotes": "All documents verified",
    "provisioning": {
      "tenantId": "tenant-real-estate-001",
      "package": "professional",
      "modules": ["lead", "inventory", "commission"]
    }
  },
  "metadata": {
    "tenantId": "tenant-real-estate-001",
    "userId": "admin-user-id",
    "timestamp": "2026-08-02T10:30:00.000Z",
    "correlationId": "req-12345-67890",
    "causationId": "evt-identity-verified",
    "source": "identity-service",
    "environment": "production"
  }
}
```

---

## Domain Events Catalog

### Identity Lifecycle
- `IdentityRegistered` - New identity created
- `IdentityVerified` - Email/phone verified
- `IdentityApproved` - Admin approved registration
- `IdentityRejected` - Admin rejected registration
- `IdentityProvisioned` - Tenant, user, roles created
- `IdentityActivated` - Password set, account active
- `IdentitySuspended` - Account suspended
- `IdentityReactivated` - Account reactivated
- `IdentityDeleted` - Account soft-deleted

### Tenant Lifecycle
- `TenantCreated` - New tenant provisioned
- `TenantConfigured` - Modules assigned
- `TenantSuspended` - Tenant suspended (payment issue)
- `TenantArchived` - Tenant archived (inactive)

### Financial
- `InvoiceCreated` - New invoice generated
- `InvoiceApproved` - Invoice approved by manager
- `PaymentReceived` - Payment recorded
- `ExpenseSubmitted` - Expense claim submitted
- `ExpenseApproved` - Expense claim approved

### Booking (Industry-Specific, but still events)
- `BookingCreated` - New booking
- `BookingConfirmed` - Booking confirmed
- `BookingCancelled` - Booking cancelled
- `SessionCompleted` - Service session completed

### Notification
- `EmailSent` - Email successfully sent
- `EmailFailed` - Email delivery failed
- `SMSSent` - SMS successfully sent

---

## Event Subscribers

### Example: IdentityApproved Event

**Subscribers:**

1. **Audit Service**
   - Log approval action
   - Store approver, timestamp, notes
   - Create audit trail entry

2. **Notification Service**
   - Send approval email to partner
   - Send Slack notification to admin team
   - Create in-app notification

3. **CRM Service**
   - Create contact record
   - Tag as "approved partner"
   - Trigger welcome email sequence

4. **Analytics Service**
   - Track approval metrics (time-to-approval, approval rate)
   - Update dashboard counters
   - Feed data to BI tools

5. **AI Service**
   - Update AI model training data (what admins approve/reject)
   - Improve fraud detection accuracy
   - Log AI recommendation vs human decision

6. **Finance Service**
   - Create billing account
   - Assign package pricing
   - Schedule first invoice

7. **Webhook Service**
   - Notify external systems (CRM, marketing automation)
   - Send webhook to integrations

---

## Implementation Patterns

### Pattern 1: Publisher (Fire and Forget)

```typescript
// src/services/identity-actions.ts
export async function approveRegistration(registrationId: string, approvedBy: string, notes: string) {
  // 1. Update database
  await db.update('identity_registrations')
    .set({ 
      status: 'approved', 
      approved_by: approvedBy,
      approved_at: new Date(),
      approval_notes: notes 
    })
    .where('id', registrationId);
  
  // 2. Publish event (fire and forget)
  await eventBus.publish({
    eventType: 'IdentityApproved',
    aggregateId: registrationId,
    aggregateType: 'Identity',
    payload: {
      identityId: registrationId,
      approvedBy,
      approvalNotes: notes
    },
    metadata: {
      tenantId: getTenantId(),
      userId: approvedBy,
      timestamp: new Date().toISOString(),
      correlationId: getRequestId(),
      source: 'identity-service',
      environment: process.env.NODE_ENV
    }
  });
  
  // 3. Return immediately (subscribers handle the rest)
  return { success: true };
}
```

### Pattern 2: Subscriber (Event Handler)

```typescript
// src/services/notification-event-handlers.ts
eventBus.subscribe('IdentityApproved', async (event: DomainEvent) => {
  const { identityId, displayName, email } = event.payload;
  
  // Send approval email
  await sendEmail({
    to: email,
    subject: 'Chúc mừng! Tài khoản đối tác của bạn đã được phê duyệt',
    template: 'identity-approved',
    data: {
      name: displayName,
      loginUrl: `${process.env.APP_URL}/login`,
      supportEmail: 'support@bella.com'
    }
  });
  
  // Send Slack notification to admin team
  await sendSlackNotification({
    channel: '#partner-approvals',
    message: `:white_check_mark: ${displayName} has been approved by <@${event.metadata.userId}>`
  });
  
  // Log event processing
  console.log(`[NotificationService] Processed IdentityApproved event: ${event.eventId}`);
});
```

### Pattern 3: Transactional Outbox (Guaranteed Delivery)

For critical events that MUST NOT be lost:

```typescript
// src/lib/event-bus/transactional-outbox.ts
export async function publishWithOutbox(event: DomainEvent) {
  // 1. Insert event into outbox table (same transaction as business logic)
  await db.transaction(async (trx) => {
    // Business logic (e.g., update registration status)
    await trx.update('identity_registrations').set({ status: 'approved' });
    
    // Insert event into outbox
    await trx.insert('event_outbox').values({
      event_id: event.eventId,
      event_type: event.eventType,
      aggregate_id: event.aggregateId,
      payload: event.payload,
      metadata: event.metadata,
      status: 'pending',
      created_at: new Date()
    });
  });
  
  // 2. Background worker picks up events from outbox and publishes
  // (separate process, retries on failure)
}
```

---

## Event Bus Implementation

### Option A: PostgreSQL LISTEN/NOTIFY (Chosen for MVP)

**Pros:**
- No external dependencies (we already use PostgreSQL)
- Real-time delivery (< 100ms latency)
- Simple to implement

**Cons:**
- Not durable (if subscriber is offline, event is lost)
- No retry mechanism
- Limited throughput (~10k events/sec)

**Use Case:** Real-time notifications, audit logging, non-critical events.

**Implementation:**
```typescript
// Publish
await db.query("SELECT pg_notify('identity_events', $1)", [JSON.stringify(event)]);

// Subscribe
await db.query("LISTEN identity_events");
client.on('notification', (msg) => {
  const event = JSON.parse(msg.payload);
  handleEvent(event);
});
```

---

### Option B: Outbox + Background Job (Chosen for Critical Events)

**Pros:**
- Guaranteed delivery (events stored in database)
- Retry on failure
- Survives subscriber downtime

**Cons:**
- Higher latency (~1-5 seconds)
- Requires background worker

**Use Case:** Critical events (payment, provisioning, financial transactions).

**Implementation:**
```typescript
// Background worker (runs every 5 seconds)
setInterval(async () => {
  const pendingEvents = await db.select('*')
    .from('event_outbox')
    .where('status', 'pending')
    .orderBy('created_at', 'asc')
    .limit(100);
  
  for (const event of pendingEvents) {
    try {
      await publishToSubscribers(event);
      await db.update('event_outbox').set({ status: 'published' }).where('event_id', event.event_id);
    } catch (error) {
      await db.update('event_outbox').set({ 
        status: 'failed', 
        error_message: error.message,
        retry_count: event.retry_count + 1 
      });
    }
  }
}, 5000);
```

---

## Event Versioning Strategy

### Problem: Event schema changes over time

**Example:**
```typescript
// Version 1.0
{ eventType: 'IdentityApproved', payload: { identityId, approvedBy } }

// Version 2.0 (added new field)
{ eventType: 'IdentityApproved', payload: { identityId, approvedBy, package } }
```

**Solution: Event Version Field**

```typescript
interface DomainEvent {
  eventVersion: string; // '1.0', '2.0'
  // ...
}

// Subscriber handles multiple versions
eventBus.subscribe('IdentityApproved', async (event: DomainEvent) => {
  if (event.eventVersion === '1.0') {
    // Handle old schema
    const { identityId, approvedBy } = event.payload;
  } else if (event.eventVersion === '2.0') {
    // Handle new schema
    const { identityId, approvedBy, package } = event.payload;
  }
});
```

**Rules:**
- **Additive changes** (new field) → Keep same version, make field optional
- **Breaking changes** (rename field, change type) → Bump version
- **Support old versions** for at least 6 months (deprecation period)

---

## Error Handling

### Dead Letter Queue (DLQ)

If a subscriber fails to process an event after N retries, move it to DLQ:

```typescript
const MAX_RETRIES = 3;

try {
  await processEvent(event);
} catch (error) {
  if (event.retry_count >= MAX_RETRIES) {
    // Move to DLQ
    await db.insert('event_dead_letter_queue').values({
      event_id: event.eventId,
      event_type: event.eventType,
      payload: event.payload,
      error_message: error.message,
      failed_at: new Date()
    });
    
    // Alert engineering team
    await sendAlert({
      severity: 'high',
      message: `Event ${event.eventType} moved to DLQ after ${MAX_RETRIES} retries`
    });
  } else {
    // Retry later
    await scheduleRetry(event, event.retry_count + 1);
  }
}
```

### Idempotency

Subscribers must be idempotent (processing the same event multiple times has the same effect):

```typescript
eventBus.subscribe('IdentityApproved', async (event: DomainEvent) => {
  const { identityId } = event.payload;
  
  // Check if already processed
  const existing = await db.select('*')
    .from('processed_events')
    .where('event_id', event.eventId);
  
  if (existing) {
    console.log(`Event ${event.eventId} already processed, skipping`);
    return;
  }
  
  // Process event
  await sendApprovalEmail(identityId);
  
  // Mark as processed
  await db.insert('processed_events').values({
    event_id: event.eventId,
    processed_at: new Date()
  });
});
```

---

## Testing Strategy

### Unit Tests (Subscribers)

```typescript
describe('NotificationService: IdentityApproved handler', () => {
  it('should send approval email', async () => {
    const event = createMockEvent('IdentityApproved', {
      email: 'test@example.com',
      displayName: 'Test Partner'
    });
    
    await handleIdentityApproved(event);
    
    expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
      to: 'test@example.com',
      subject: expect.stringContaining('phê duyệt'),
      template: 'identity-approved'
    });
  });
});
```

### Integration Tests (End-to-End)

```typescript
describe('Identity Approval Flow', () => {
  it('should publish event and trigger all subscribers', async () => {
    // 1. Approve registration
    await approveRegistration('reg-123', 'admin-1', 'Approved');
    
    // 2. Wait for event processing (async)
    await waitForEventProcessing(5000);
    
    // 3. Verify all subscribers processed the event
    expect(await getAuditLog('reg-123')).toBeDefined();
    expect(await getEmailLog('test@example.com')).toHaveLength(1);
    expect(await getCRMContact('reg-123')).toHaveProperty('status', 'approved');
  });
});
```

---

## Monitoring & Observability

### Metrics

- **Event publish rate** (events/second)
- **Event processing latency** (p50, p95, p99)
- **Subscriber failure rate** (% of events that failed)
- **Dead letter queue size** (should be near zero)
- **Event type distribution** (most common events)

### Alerts

- ⚠️ **Dead letter queue size > 10** → Subscriber is broken
- ⚠️ **Event processing latency > 5s (p95)** → Performance issue
- ⚠️ **Subscriber failure rate > 5%** → Bug in subscriber logic
- ⚠️ **Event publish rate spike (> 10x normal)** → Potential spam or attack

### Dashboards

```
Event Bus Health Dashboard
├── Total events published (24h)
├── Events per type (pie chart)
├── Processing latency (line chart)
├── Subscriber success rate (bar chart)
├── Dead letter queue trend (line chart)
└── Top failing events (table)
```

---

## Migration Path

### Phase 1: Parallel Run (Week 1-2)
- Implement event bus infrastructure
- Publish events alongside existing direct calls
- Do NOT remove direct calls yet
- Monitor event delivery

### Phase 2: Subscriber Migration (Week 3-4)
- Move Audit logging to event subscriber
- Move Notification to event subscriber
- Keep direct calls as fallback

### Phase 3: Remove Direct Calls (Week 5-6)
- Remove direct calls from business logic
- Event bus is now primary communication
- Monitor for regressions

### Phase 4: Add More Subscribers (Week 7+)
- Add Analytics subscriber
- Add CRM subscriber
- Add AI subscriber
- Add Webhook subscriber

---

## Benefits

✅ **Loose Coupling** - Modules don't know about each other  
✅ **Extensibility** - Add new subscribers without modifying publishers  
✅ **Scalability** - Async processing, no blocking  
✅ **Auditability** - All events logged for compliance  
✅ **Testability** - Test modules in isolation  
✅ **Resilience** - Retry on failure, DLQ for persistent failures  

---

## Trade-offs

⚠️ **Eventual Consistency** - Subscribers process events asynchronously  
⚠️ **Debugging Complexity** - Harder to trace flows across services  
⚠️ **Operational Overhead** - Need monitoring, alerting, DLQ management  

---

## Related ADRs

- [ADR-001: Identity Platform](./ADR-001-identity-platform.md)
- [ADR-005: Provisioning Architecture](./ADR-005-provisioning-architecture.md)
- [ADR-010: Domain Model](./ADR-010-domain-model.md)
- [ADR-012: Notification Architecture](./ADR-012-notification-architecture.md)

---

## Approval

- [x] **Chief Architect:** Approved - 2026-08-02
- [x] **Platform Team Lead:** Approved - 2026-08-02
- [x] **All Engineering Teams:** Approved - 2026-08-02

---

**Decision:** APPROVED  
**Effective Date:** 2026-08-02  
**Review Date:** 2026-11-02

---

**"Modules communicate through events, not direct calls."**
