# Customer Order Management Services

This directory contains services for managing customer orders across all industry modules.

## Purpose

Provides industry-neutral order management logic. Service is named "order" for industry neutrality, but uses `CoreBookingOrder` contract type from Phase 2 to maintain backward compatibility.

## Key Services

### Order Creation
- Create new customer orders
- Validate order data
- Invoke module adapter for industry-specific validation
- Assign unique order IDs

### Order Updates
- Update order status
- Modify order details (if status allows)
- Track order history
- Invoke module adapter for pricing changes

### Order Completion
- Mark orders as completed
- Invoke module adapter for side effects (salary updates, inventory deductions)
- Send completion notifications
- Update revenue recognition

### Order Queries
- Get orders by customer
- Get orders by status
- Get orders by date range
- Filter by tenant and module

## Usage Patterns

### 1. Creating an Order

```typescript
import { createOrder } from '@/core/services/order';
import type { CoreBookingOrder, TenantContext } from '@/core/types';

const order = await createOrder(context, {
  customerId: 'cust-123',
  serviceItemId: 'pkg-456',
  totalPrice: 1500000,
  status: 'pending',
  metadata: {
    // Module-specific fields
  }
});
```

### 2. Completing an Order

```typescript
import { completeOrder } from '@/core/services/order';

// Core service handles order status update
// Module adapter handles side effects (salary, inventory)
await completeOrder(context, orderId);
```

### 3. Querying Orders

```typescript
import { getOrdersByCustomer } from '@/core/services/order';

const orders = await getOrdersByCustomer(context, customerId);
```

## Module Adapter Integration

Order services invoke module adapters for industry-specific behavior:

### Validation
```typescript
const adapter = moduleRegistry.get(context.moduleId);
if (adapter) {
  const isValid = await adapter.validateBookingRules(order, context);
  if (!isValid) throw new Error('Order validation failed');
}
```

### Pricing
```typescript
if (adapter) {
  const finalPrice = await adapter.calculatePricing(serviceItem, context);
}
```

### Side Effects
```typescript
if (adapter) {
  await adapter.onBookingCompleted(order, context);
}
```

## Type Mapping

Orders are stored in the database as `bookings` table rows and mapped to `CoreBookingOrder` contract type:

```typescript
import { mapDbRowToBooking } from '@/core/lib/database';

const { data } = await supabase.from('bookings').select('*').eq('id', orderId);
const order: CoreBookingOrder = mapDbRowToBooking(data[0]);
```

## Tenant Isolation

All order queries filter by `tenantId` from TenantContext to ensure tenant isolation.
