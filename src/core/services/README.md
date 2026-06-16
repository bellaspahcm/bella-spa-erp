# Core Services

This directory contains the core business logic services for the Bella ERP platform. All services are industry-neutral and reusable across multiple modules.

## Services Overview

### Authentication & Authorization (`auth/`)
Handles user authentication, session management, role-based access control, and permission validation.

**Key Functions:**
- User login/logout
- Session validation
- Role and permission checks
- Multi-tenant access control

### Customer Order Management (`order/`)
Manages customer orders across all industry modules. Service uses the term "order" for industry neutrality, but returns `CoreBookingOrder` contract type from Phase 2.

**Key Functions:**
- Order creation and updates
- Order status tracking
- Order completion and cancellation
- Cross-module order queries

### Payment Processing (`payment/`)
Handles payment intent creation, processing, and tracking across all payment methods.

**Key Functions:**
- Payment intent creation
- Payment method handling (cash, bank transfer, e-wallet)
- Payment status updates
- Multi-tenant payment isolation

### Notification Services (`notification/`)
Manages multi-channel notifications (in-app, email, SMS, webhook) across all modules.

**Key Functions:**
- Notification event creation
- Multi-channel delivery
- Notification preferences
- Tenant-specific notification templates

### Audit Logging (`audit/`)
Provides field-level audit logging for all resource changes across the platform.

**Key Functions:**
- Audit event creation
- Change tracking
- Audit log queries
- Tenant-specific audit isolation

### Finance Services (`finance/`)
Manages revenue recognition, expense tracking, invoicing, and P&L reporting.

**Key Functions:**
- Revenue recognition (order-based)
- Expense tracking (payment-based)
- Invoice generation
- P&L reports aggregating across modules

### Payroll Services (`payroll/`)
Handles employee compensation calculations and payroll cycle management.

**Key Functions:**
- Base salary calculations
- Payroll cycle management
- Payroll reports
- Multi-tenant payroll isolation

**Note:** Module-specific salary calculations (e.g., spa KTV commissions) are handled by module adapters.

### Analytics Services (`analytics/`)
Provides business intelligence, dashboard aggregation, and report generation.

**Key Functions:**
- Dashboard data aggregation
- Report generation (Excel, PDF)
- Cross-module analytics queries
- Tenant-specific analytics

## Service Design Patterns

### 1. TenantContext First Parameter

All service functions accept `TenantContext` as the first parameter:

```typescript
export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Function implementation
}
```

### 2. Contract Types

All services use contract types from `src/core/types/`:

```typescript
import { CoreBookingOrder, PaymentIntent, TenantContext } from '@/core/types';
```

### 3. Module Adapter Integration

Services invoke module adapters for module-specific behavior:

```typescript
import { moduleRegistry } from '@/core/adapters/registry';

const adapter = moduleRegistry.get(context.moduleId);
if (adapter) {
  const isValid = await adapter.validateBookingRules(order, context);
  if (!isValid) throw new Error('Validation failed');
}
```

### 4. Tenant Isolation

All database queries MUST filter by `tenantId`:

```typescript
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('tenant_id', context.tenantId)
  .eq('id', orderId);
```

## Testing

All services require unit tests with mock TenantContext:

```typescript
import { createMockTenantContext } from '@/test/utils';

test('createOrder creates an order', async () => {
  const context = createMockTenantContext();
  const order = await createOrder(context, { /* orderData */ });
  expect(order.id).toBeDefined();
});
```
