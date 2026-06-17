# Spa Module - Adapters

This directory contains the `SpaModuleAdapter` implementation that provides spa-specific behavior to the core platform.

## Purpose

The spa adapters directory implements the **Module Adapter Pattern** defined in Phase 3. The adapter encapsulates all spa-specific business logic for validation, pricing, side effects, and UI customization.

## Architecture

### Module Adapter Pattern

The adapter pattern allows the core platform to remain industry-neutral while delegating module-specific behavior to adapters:

```
┌─────────────────────────────┐
│    Core Platform Services    │
│  (Auth, Orders, Payments)   │
└──────────┬──────────────────┘
           │ invokes
           ▼
┌─────────────────────────────┐
│     Module Adapter          │
│  (SpaModuleAdapter)         │
│  • validateBookingRules()   │
│  • calculatePricing()       │
│  • onBookingCompleted()     │
└─────────────────────────────┘
```

### SpaModuleAdapter Implementation

The `SpaModuleAdapter` class implements the `ModuleAdapter` interface from `@/core/types/module.ts`:

```typescript
import type { ModuleAdapter } from '@/core/types';

export class SpaModuleAdapter implements ModuleAdapter {
  readonly moduleId = 'spa' as const;
  readonly moduleName = 'Bella Spa & Babycare';
  
  // Transform core types to spa types
  transformServiceItem(item: CoreServiceCatalogItem): SpaPackage;
  transformBookingOrder(order: CoreBookingOrder): SpaBooking;
  
  // Spa-specific validation
  validateBookingRules(order: CoreBookingOrder, context: TenantContext): Promise<boolean>;
  
  // Spa-specific pricing
  calculatePricing(item: CoreServiceCatalogItem, context: TenantContext): Promise<number>;
  
  // Spa-specific side effects
  onBookingCompleted(order: CoreBookingOrder, context: TenantContext): Promise<void>;
  
  // Spa dashboard widgets
  getModuleWidgets(): ModuleWidget[];
}
```

## Adapter Methods

### 1. Type Transformations

**Purpose**: Convert core contract types to spa-specific types by extracting metadata fields.

```typescript
transformServiceItem(item: CoreServiceCatalogItem): SpaPackage {
  return {
    ...item,
    totalSessions: item.metadata.total_sessions as number,
    sessionMultiplier: item.metadata.session_multiplier as number,
    category: item.metadata.category as 'basic' | 'premium' | 'vip',
  };
}
```

### 2. Booking Validation

**Purpose**: Validate spa-specific booking rules before order creation.

Validation checks:
- KTV availability for scheduled time
- Session limits (completed < total)
- Package validity (not expired)
- Customer eligibility

```typescript
async validateBookingRules(
  order: CoreBookingOrder,
  context: TenantContext
): Promise<boolean> {
  const ktvId = order.metadata.assigned_ktv_id;
  // Check KTV availability via core services
  // Validate session limits
  // Return true if valid, false otherwise
}
```

### 3. Pricing Calculations

**Purpose**: Apply spa-specific pricing rules and discounts.

Pricing factors:
- Subscription-based discounts (enterprise, professional, basic)
- Package category multipliers
- Seasonal promotions
- Loyalty program discounts

```typescript
async calculatePricing(
  item: CoreServiceCatalogItem,
  context: TenantContext
): Promise<number> {
  const discount = context.subscriptionPlan === 'enterprise' ? 0.1 : 0;
  return item.basePrice * (1 - discount);
}
```

### 4. Completion Side Effects

**Purpose**: Execute spa-specific actions after order completion.

Side effects:
- Update KTV salary calculations
- Deduct inventory (if applicable)
- Send completion notifications to customer and KTV
- Update KTV performance metrics

```typescript
async onBookingCompleted(
  order: CoreBookingOrder,
  context: TenantContext
): Promise<void> {
  // Trigger salary recalculation for assigned KTV
  // Send notifications via core notification service
  // Update performance metrics
}
```

### 5. Widget Registry

**Purpose**: Register spa-specific dashboard widgets.

```typescript
getModuleWidgets(): ModuleWidget[] {
  return [
    { id: 'spa-bookings-today', component: 'SpaBookingsWidget' },
    { id: 'spa-revenue-chart', component: 'SpaRevenueWidget' },
    { id: 'ktv-performance', component: 'KtvPerformanceWidget' },
  ];
}
```

## Adapter Registration

The adapter is registered on application startup:

```typescript
// src/modules/spa/register.ts
import { moduleRegistry } from '@/core/adapters/registry';
import { SpaModuleAdapter } from './adapters/SpaModuleAdapter';

export function registerSpaModule() {
  const adapter = new SpaModuleAdapter();
  moduleRegistry.register(adapter);
  console.log('[SpaModule] Adapter registered successfully');
}
```

Registration is called in `src/app/layout.tsx`:

```typescript
import { registerSpaModule } from '@/modules/spa/register';

// Call once on app startup
registerSpaModule();
```

## Adapter Usage in Core Services

Core services invoke adapter methods via the module registry:

```typescript
// src/core/services/order/create.ts
import { moduleRegistry } from '@/core/adapters/registry';

async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Look up module adapter
  const adapter = moduleRegistry.get(context.moduleId);
  
  // Invoke adapter validation
  if (adapter) {
    const isValid = await adapter.validateBookingRules(orderData, context);
    if (!isValid) throw new Error('Booking validation failed');
  }
  
  // Create order in database
  const order = await db.insert(orderData);
  
  // Invoke adapter side effects
  if (adapter) {
    await adapter.onBookingCompleted(order, context);
  }
  
  return order;
}
```

## Security Principles

### No Direct Database Access

Adapters **must never access the database directly**. All data operations must go through core platform services.

❌ **WRONG**:
```typescript
async onBookingCompleted(order: CoreBookingOrder) {
  // Direct database access - FORBIDDEN
  await supabase.from('salary_records').update({ ... });
}
```

✅ **CORRECT**:
```typescript
async onBookingCompleted(order: CoreBookingOrder, context: TenantContext) {
  // Use core services for data operations
  await updateSalaryRecord(context, ktvId, salaryData);
}
```

### Tenant Isolation

All adapter methods receive `TenantContext` to ensure tenant isolation. Adapters must respect tenant boundaries.

### Input Validation

Adapter methods must validate all input parameters before processing:

```typescript
async validateBookingRules(order: CoreBookingOrder, context: TenantContext): Promise<boolean> {
  if (!order.metadata.assigned_ktv_id) {
    throw new Error('KTV assignment required for spa bookings');
  }
  // Additional validation...
}
```

## Testing Strategy

### Unit Tests

Test adapter methods in isolation with mock data:

```typescript
describe('SpaModuleAdapter', () => {
  it('should validate booking rules correctly', async () => {
    const adapter = new SpaModuleAdapter();
    const mockOrder = createMockCoreBookingOrder();
    const mockContext = createMockTenantContext();
    
    const isValid = await adapter.validateBookingRules(mockOrder, mockContext);
    expect(isValid).toBe(true);
  });
});
```

### Integration Tests

Test adapter integration with core services:

```typescript
describe('Order creation with SpaAdapter', () => {
  it('should invoke adapter validation before creating order', async () => {
    // Register adapter
    registerSpaModule();
    
    // Create order via core service
    const context = await getTenantContext('spa-tenant-id');
    const order = await createOrder(context, orderData);
    
    // Verify adapter validation was called
    expect(order.status).toBe('confirmed');
  });
});
```

## Critical Development Rules

When working with adapters:

1. **Never bypass adapter validation**: Core services must always invoke `validateBookingRules()` before creating orders.

2. **Always propagate errors**: If adapter methods throw errors, core services must propagate them to the caller.

3. **Use core services for data operations**: Adapters must never access the database directly.

4. **Respect tenant boundaries**: All adapter methods must receive and respect `TenantContext`.

5. **Test side effects**: Integration tests must assert that side effects (salary updates, notifications) actually execute.

## Related Documentation

- [Phase 3 Requirements - REQ-3.3.2](/.kiro/specs/phase-3-physical-extraction/requirements.md)
- [Module Adapter Interface](/src/core/types/module.ts)
- [Module Registry](/src/core/adapters/registry.ts)
- [Module System Guide](/docs/architecture/module-system.md)

## Migration Status

This directory structure was created as part of **Phase 3 - Task 13.1**.

`SpaModuleAdapter` implementation will be added in **Task 14.1-14.4**.
