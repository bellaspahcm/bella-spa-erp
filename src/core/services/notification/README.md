# Notification Services

This directory contains services for multi-channel notification delivery (in-app, email, SMS, webhook) across all modules.

## Purpose

Provides industry-neutral notification logic that works across all modules and delivery channels.

## Key Services

### Notification Creation
- Create notification events
- Support multiple channels (in-app, email, SMS, webhook)
- Link notifications to resources (orders, payments, etc.)
- Store channel-specific details in metadata

### Notification Delivery
- Deliver notifications via multiple channels
- Handle delivery failures and retries
- Track delivery status
- Send delivery confirmations

### Notification Queries
- Get notifications by user
- Get notifications by resource
- Get notifications by date range
- Filter by tenant and status

## Usage Patterns

### 1. Creating a Notification

```typescript
import { createNotification } from '@/core/services/notification';
import type { NotificationEvent, TenantContext } from '@/core/types';

const notification = await createNotification(context, {
  userId: 'user-123',
  channel: 'email',
  subject: 'Order Confirmation',
  body: 'Your order has been confirmed.',
  resourceType: 'order',
  resourceId: order.id,
  metadata: {
    emailTo: 'customer@example.com',
    emailFrom: 'noreply@bella-spa.com'
  }
});
```

### 2. Sending Notifications

```typescript
import { sendNotification } from '@/core/services/notification';

await sendNotification(context, notificationId);
```

### 3. Querying Notifications

```typescript
import { getNotificationsByUser } from '@/core/services/notification';

const notifications = await getNotificationsByUser(context, userId);
const unread = notifications.filter(n => !n.readAt);
```

## Notification Channels

Supported channels:
- **in_app**: In-app notifications (displayed in UI)
- **email**: Email notifications
- **sms**: SMS notifications
- **webhook**: Webhook notifications for integrations

Channel-specific details are stored in the `metadata` field.

## Notification Status Flow

```
pending → sent → delivered
         ↓
       failed → retrying → delivered/failed
```

## Type Mapping

Notifications are stored in database tables and mapped to `NotificationEvent` contract type:

```typescript
import { mapDbRowToNotification } from '@/core/lib/database';

const { data } = await supabase.from('app_notifications').select('*').eq('id', notificationId);
const notification: NotificationEvent = mapDbRowToNotification(data[0]);
```

## Tenant Isolation

All notification queries filter by `tenantId` from TenantContext to ensure tenant isolation.

## Tenant-Specific Templates

Notification templates can be customized per tenant via TenantContext configuration.
