# Audit Logging Services

This directory contains services for field-level audit logging of all resource changes across the platform.

## Purpose

Provides comprehensive audit logging for compliance, security, and debugging. Tracks who changed what, when, and why.

## Key Services

### Audit Event Creation
- Log resource creation, updates, and deletions
- Track field-level changes (before/after values)
- Record actor (user) and timestamp
- Support metadata for additional context

### Audit Queries
- Get audit logs by resource
- Get audit logs by user
- Get audit logs by date range
- Filter by tenant and action type

## Usage Patterns

### 1. Creating an Audit Event

```typescript
import { createAuditEvent } from '@/core/services/audit';
import type { AuditEvent, TenantContext } from '@/core/types';

const auditEvent = await createAuditEvent(context, {
  resourceType: 'order',
  resourceId: order.id,
  action: 'update',
  actorId: context.userId,
  changes: {
    status: { before: 'pending', after: 'confirmed' },
    totalPrice: { before: 1500000, after: 1600000 }
  },
  metadata: {
    reason: 'Customer requested price adjustment'
  }
});
```

### 2. Querying Audit Logs

```typescript
import { getAuditEventsByResource } from '@/core/services/audit';

const auditLogs = await getAuditEventsByResource(context, 'order', orderId);
const priceChanges = auditLogs.filter(log => 
  log.changes.totalPrice !== undefined
);
```

## Audit Actions

Supported actions:
- **create**: Resource created
- **update**: Resource updated
- **delete**: Resource deleted
- **access**: Resource accessed (for sensitive resources)

## Field-Level Tracking

The `changes` field stores before/after values for each modified field:

```typescript
{
  status: { before: 'pending', after: 'confirmed' },
  totalPrice: { before: 1500000, after: 1600000 }
}
```

## Type Mapping

Audit logs are stored in database tables and mapped to `AuditEvent` contract type:

```typescript
import { mapDbRowToAuditEvent } from '@/core/lib/database';

const { data } = await supabase.from('audit_log').select('*').eq('id', auditEventId);
const auditEvent: AuditEvent = mapDbRowToAuditEvent(data[0]);
```

## Tenant Isolation

All audit log queries filter by `tenantId` from TenantContext to ensure tenant isolation.

## Compliance

Audit logs are immutable and stored indefinitely for compliance purposes. They cannot be modified or deleted by users.

## Security Considerations

- Audit logs are write-only (no updates or deletes allowed)
- Sensitive field values (passwords, tokens) are never logged
- Access to audit logs is restricted to administrators
- RLS policies enforce database-level access control
