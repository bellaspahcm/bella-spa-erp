# Core Service Contracts

## Overview

This directory contains TypeScript interface definitions for **10 core service contracts** that establish clear boundaries between the core platform and industry-specific modules. These contracts are part of **Phase 2** of the Core Platform Extraction Roadmap.

### Design Goals

- **Zero Runtime Overhead**: All contracts are compile-time-only TypeScript interfaces with no runtime footprint
- **Industry-Neutral Primitives**: Contracts work across spa, cleaning, home-service, and babycare modules
- **Module Extensibility**: All resource types include `metadata: Record<string, any>` fields for module-specific extensions
- **Type Safety**: Compile-time validation prevents invalid data structures and field mismatches
- **100% Backward Compatibility**: No functional changes to existing Bella Spa operations

### Phase 2 Status

✅ **Contract definitions complete**  
⏳ **Phase 3**: Migrate existing code to use these contracts (deferred)

## Contract Definitions

This directory defines 10 core service contract interfaces:

### 1. **TenantContext** (`tenant.ts`)
Encapsulates tenant-specific configuration passed to core platform services. Contains tenant ID, name, enabled modules, subscription plan, feature flags, and settings.

**Key Fields**: `tenantId`, `tenantName`, `enabledModules`, `subscriptionPlan`, `featureFlags`, `settings`

### 2. **ModuleId** (`module.ts`)
Strongly-typed module identifier ensuring only valid module strings are used throughout the codebase.

**Valid Modules**: `'spa'`, `'babycare'`, `'cleaning'`, `'home-service'`

### 3. **FeatureFlag** (`feature-flag.ts`)
Standardized feature flag structure for subscription-based feature gating. Enables/disables features based on tenant plan and enabled modules.

**Key Fields**: `key`, `enabled`, `requiredPlan`, `requiredModules`, `metadata`

### 4. **CoreServiceCatalogItem** (`service-catalog.ts`)
Industry-neutral service or product catalog item. Modules extend with module-specific fields via `metadata`.

**Key Fields**: `id`, `tenantId`, `moduleId`, `name`, `basePrice`, `currency`, `status`, `metadata`

**Spa Module Extensions** (in metadata):
- `total_sessions`: Number of sessions in package
- `session_multiplier`: Coefficient for session counting (1.0, 1.5, 2.0)
- `category`: 'basic' | 'premium' | 'vip'
- `duration_minutes`: Typical service duration

### 5. **CoreBookingOrder** (`booking-order.ts`)
Generic booking/order primitive representing a customer's purchase or appointment. Works across all industries.

**Key Fields**: `id`, `tenantId`, `moduleId`, `customerId`, `serviceItemId`, `status`, `scheduledStartTime`, `totalAmount`, `paidAmount`, `metadata`

**Spa Module Extensions** (in metadata):
- `sessions_completed`: Number of sessions completed
- `sessions_total`: Total sessions in package
- `assigned_ktv_id`: Assigned technician/KTV
- `package_category`: Package tier (basic/premium/vip)

### 6. **PaymentIntent** (`payment.ts`)
Core payment primitive representing an intent to collect payment from a customer.

**Key Fields**: `id`, `tenantId`, `customerId`, `bookingOrderId`, `amount`, `currency`, `method`, `status`, `metadata`

**Payment Methods**: `'cash'`, `'bank_transfer'`, `'credit_card'`, `'e_wallet'`, `'other'`

### 7. **Invoice** (`payment.ts`)
Core accounting primitive representing a financial document issued to a customer.

**Key Fields**: `id`, `tenantId`, `customerId`, `bookingOrderId`, `invoiceNumber`, `issueDate`, `dueDate`, `totalAmount`, `paidAmount`, `status`, `lineItems`

### 8. **AuditEvent** (`audit.ts`)
Core observability primitive for logging system events with actor, action, resource, and timestamp.

**Key Fields**: `id`, `tenantId`, `moduleId`, `actorId`, `actorType`, `action`, `resourceType`, `resourceId`, `timestamp`, `changes`, `metadata`

**Use Cases**: Booking creation/modification, payment processing, salary approval, expense approval, inventory transfers

### 9. **NotificationEvent** (`notification.ts`)
Core communication primitive for multi-channel system notifications.

**Key Fields**: `id`, `tenantId`, `moduleId`, `type`, `recipientId`, `recipientType`, `channels`, `priority`, `title`, `message`, `metadata`

**Channels**: `'in_app'`, `'email'`, `'sms'`, `'webhook'`, `'push'`

### 10. **ModuleAdapter** (`module-adapter.ts`)
Interface that modules implement to integrate with core platform services and provide module-specific behavior.

**Methods**: `transformServiceItem`, `transformBookingOrder`, `validateBookingRules`, `calculatePricing`, `onBookingCompleted`, `getModuleWidgets`

## Usage Examples

### Constructing TenantContext from Database Row

```typescript
import { TenantContext } from '@/core/types';

// Fetch tenant from database
const tenant = await supabase
  .from('tenants')
  .select('id, name, subscription_plan')
  .eq('id', tenantId)
  .single();

// Fetch enabled modules
const { data: modules } = await supabase
  .from('tenant_modules')
  .select('module_id')
  .eq('tenant_id', tenantId)
  .eq('enabled', true);

// Construct TenantContext
const context: TenantContext = {
  tenantId: tenant.id,
  tenantName: tenant.name,
  enabledModules: modules.map(m => m.module_id),
  subscriptionPlan: tenant.subscription_plan,
  featureFlags: {
    'ai_salary_reconciliation': true,
    'inventory_transfer': true,
    'meta_ads_integration': false,
  },
  settings: {
    currency: 'VND',
    timezone: 'Asia/Ho_Chi_Minh',
    locale: 'vi-VN',
  },
};
```

### Passing TenantContext to Service Functions

```typescript
import { TenantContext, CoreBookingOrder } from '@/core/types';

// Service function accepts TenantContext
async function createBooking(
  context: TenantContext,
  bookingData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Validate tenant has required modules
  if (!context.enabledModules.includes('spa')) {
    throw new Error('Spa module not enabled for this tenant');
  }

  // Create booking with tenant context
  const booking: CoreBookingOrder = {
    id: crypto.randomUUID(),
    tenantId: context.tenantId,
    moduleId: 'spa',
    customerId: bookingData.customerId!,
    serviceItemId: bookingData.serviceItemId!,
    status: 'draft',
    scheduledStartTime: bookingData.scheduledStartTime!,
    totalAmount: bookingData.totalAmount!,
    paidAmount: 0,
    metadata: {
      created_by: 'system',
      package_category: 'vip',
    },
  };

  // Insert into database...
  return booking;
}
```

### Storing Module-Specific Data in Metadata

```typescript
import { CoreServiceCatalogItem, CoreBookingOrder } from '@/core/types';

// Spa package with module-specific fields in metadata
const spaPackage: CoreServiceCatalogItem = {
  id: 'package-uuid',
  tenantId: 'tenant-uuid',
  moduleId: 'spa',
  name: 'Combo Mẹ & Bé VIP Toàn Diện',
  description: 'Premium spa package with 20 sessions',
  basePrice: 15000000,
  currency: 'VND',
  status: 'active',
  metadata: {
    // Spa-specific fields
    total_sessions: 20,
    session_multiplier: 2.0,
    category: 'vip',
    duration_minutes: 90,
    services_included: ['massage', 'facial', 'body_treatment'],
  },
};

// Spa booking with session progress tracking
const spaBooking: CoreBookingOrder = {
  id: 'booking-uuid',
  tenantId: 'tenant-uuid',
  moduleId: 'spa',
  customerId: 'customer-uuid',
  serviceItemId: spaPackage.id,
  status: 'in_progress',
  scheduledStartTime: '2025-06-01T09:00:00Z',
  scheduledEndTime: '2025-12-01T09:00:00Z',
  totalAmount: 15000000,
  paidAmount: 5000000,
  metadata: {
    // Spa-specific progress tracking
    sessions_completed: 5,
    sessions_total: 20,
    assigned_ktv_id: 'ktv-uuid',
    package_category: 'vip',
    last_session_date: '2025-06-15T10:00:00Z',
  },
};
```

### ModuleAdapter Registration (Phase 3)

```typescript
import { ModuleAdapter, CoreServiceCatalogItem, CoreBookingOrder, TenantContext } from '@/core/types';

// Spa module adapter implementation
const spaModuleAdapter: ModuleAdapter = {
  moduleId: 'spa',
  moduleName: 'Bella Spa & Babycare',

  // Transform core catalog item to spa-specific type
  transformServiceItem(item: CoreServiceCatalogItem) {
    return {
      ...item,
      totalSessions: item.metadata.total_sessions,
      sessionMultiplier: item.metadata.session_multiplier,
      category: item.metadata.category,
    };
  },

  // Transform core booking to spa-specific type
  transformBookingOrder(order: CoreBookingOrder) {
    return {
      ...order,
      sessionsCompleted: order.metadata.sessions_completed,
      sessionsTotal: order.metadata.sessions_total,
      assignedKtvId: order.metadata.assigned_ktv_id,
    };
  },

  // Validate spa-specific booking rules
  async validateBookingRules(order: CoreBookingOrder, context: TenantContext): Promise<boolean> {
    // Check KTV availability
    const ktvId = order.metadata.assigned_ktv_id;
    if (!ktvId) return false;

    // Check package session limits
    const completed = order.metadata.sessions_completed || 0;
    const total = order.metadata.sessions_total || 0;
    if (completed >= total) return false;

    return true;
  },

  // Calculate spa-specific pricing (packages, discounts)
  async calculatePricing(item: CoreServiceCatalogItem, context: TenantContext): Promise<number> {
    // Apply subscription-based discounts
    const discount = context.subscriptionPlan === 'enterprise' ? 0.1 : 0;
    return item.basePrice * (1 - discount);
  },

  // Handle booking completion side effects
  async onBookingCompleted(order: CoreBookingOrder, context: TenantContext): Promise<void> {
    // Update KTV salary calculations
    // Deduct inventory (if applicable)
    // Send completion notifications
    console.log(`Booking ${order.id} completed for tenant ${context.tenantId}`);
  },

  // Provide spa-specific dashboard widgets
  getModuleWidgets() {
    return [
      { id: 'spa-bookings-today', component: 'SpaBookingsWidget' },
      { id: 'spa-revenue-chart', component: 'SpaRevenueWidget' },
      { id: 'ktv-performance', component: 'KtvPerformanceWidget' },
    ];
  },
};

// Register adapter with core platform (Phase 3)
// registerModuleAdapter(spaModuleAdapter);
```

## Migration Path

### Phase 2 (Current): Contract Definitions Only

- ✅ All 10 core service contract interfaces defined
- ✅ Interfaces include comprehensive TSDoc comments
- ✅ Type guards and helper functions available
- ✅ Zero functional changes to existing Bella Spa operations
- ⏸️ **No immediate migration required** - existing code continues working unchanged

### Phase 3 (Future): Gradual Migration

1. **Service Layer Migration**: Refactor service functions to accept `TenantContext` and core contract types as parameters
2. **Module Adapter Implementation**: Create spa module adapter implementing `ModuleAdapter` interface
3. **Adapter Registration**: Build module registry system for registering and invoking adapters
4. **Database Query Migration**: Update queries to use contract types instead of ad-hoc interfaces
5. **Physical File Extraction**: Move core platform code to `src/core/` and spa-specific code to `src/modules/spa/`

### Migration Checklist (Phase 3)

- [ ] Migrate authentication/authorization services to use `TenantContext`
- [ ] Migrate booking services to use `CoreBookingOrder`
- [ ] Migrate payment services to use `PaymentIntent` and `Invoice`
- [ ] Migrate audit logging to use `AuditEvent`
- [ ] Migrate notification system to use `NotificationEvent`
- [ ] Implement `SpaModuleAdapter` with all optional methods
- [ ] Register spa adapter in module registry
- [ ] Extract core platform files to `src/core/` directory
- [ ] Extract spa-specific files to `src/modules/spa/` directory

## Database Mapping

All core service contracts map to existing database tables **without requiring schema changes**:

| Contract | Database Table(s) | Notes |
|----------|------------------|-------|
| `TenantContext` | `tenants`, `tenant_modules` | Constructed from tenant configuration tables |
| `ModuleId` | `tenant_modules.module_id` | Enforces valid module identifiers |
| `FeatureFlag` | `feature_flags`, `subscription_quotas` | Feature gate configuration |
| `CoreServiceCatalogItem` | `packages`, `services` | Spa packages stored in `packages` table |
| `CoreBookingOrder` | `bookings` | Maps to existing booking structure |
| `PaymentIntent` | `revenue`, `payments` | Payment tracking tables |
| `Invoice` | Generated from bookings | May need future `invoices` table |
| `AuditEvent` | `audit_log` | Existing audit logging table |
| `NotificationEvent` | `app_notifications` | In-app notification storage |
| `WorkflowInstance` | Future workflow table | Phase 3 implementation |

### Metadata Field Usage

The `metadata: Record<string, any>` field in each contract stores module-specific data without modifying core contracts:

- **Spa Packages**: Store `total_sessions`, `session_multiplier`, `category`, `duration_minutes` in `CoreServiceCatalogItem.metadata`
- **Spa Bookings**: Store `sessions_completed`, `sessions_total`, `assigned_ktv_id`, `package_category` in `CoreBookingOrder.metadata`
- **Other Modules**: Cleaning, home-service, and babycare modules store their own fields in the same `metadata` structure

This approach enables module extensibility without database schema changes and maintains backward compatibility with existing Bella Spa data.

## Type Safety

### Compile-Time Benefits

1. **Invalid Field Detection**: TypeScript compiler catches attempts to access non-existent fields
2. **Type Mismatches**: Prevents passing wrong types to service functions
3. **Autocomplete**: IDEs provide IntelliSense for all contract fields
4. **Refactoring Safety**: Renaming fields updates all usages automatically
5. **Documentation**: TSDoc comments appear in IDE tooltips

### Example: Preventing Runtime Errors

```typescript
// ❌ Compile-time error: Property 'invalidField' does not exist
const booking: CoreBookingOrder = { /* ... */ };
console.log(booking.invalidField);

// ❌ Compile-time error: Type 'string' is not assignable to type 'ModuleId'
const context: TenantContext = {
  enabledModules: ['spa', 'invalid-module'], // Error!
  // ...
};

// ✅ Correct usage with type safety
const context: TenantContext = {
  tenantId: 'uuid-here',
  tenantName: 'Bella Spa',
  enabledModules: ['spa', 'babycare'], // Valid ModuleId values
  subscriptionPlan: 'professional',
  featureFlags: {},
  settings: {},
};
```

### Zero Runtime Overhead

All core service contracts are **TypeScript interfaces** with no runtime representation:

```typescript
// TypeScript source (this file)
export interface TenantContext {
  readonly tenantId: string;
  readonly tenantName: string;
  // ...
}

// Compiled JavaScript output (no interface code!)
// (interfaces are completely erased during compilation)
```

**Bundle Size Impact**: Zero bytes added to JavaScript bundle  
**Performance Impact**: Zero runtime overhead  
**Type Safety**: Full compile-time validation

## Importing Contracts

### Barrel Export (Recommended)

```typescript
// Import all types from single entry point
import {
  TenantContext,
  ModuleId,
  CoreBookingOrder,
  PaymentIntent,
  Invoice,
  AuditEvent,
  NotificationEvent,
  isFeatureEnabled,
  getRemainingBalance,
} from '@/core/types';
```

### Direct Imports (Alternative)

```typescript
// Import from specific files
import { TenantContext } from '@/core/types/tenant';
import { CoreBookingOrder } from '@/core/types/booking-order';
import { PaymentIntent, Invoice } from '@/core/types/payment';
```

## Testing with Contracts

```typescript
import { TenantContext, CoreBookingOrder } from '@/core/types';

describe('Booking Service', () => {
  it('should create booking with valid tenant context', async () => {
    // Arrange: Create mock tenant context
    const mockContext: TenantContext = {
      tenantId: 'test-tenant-id',
      tenantName: 'Test Spa',
      enabledModules: ['spa'],
      subscriptionPlan: 'professional',
      featureFlags: {},
      settings: {},
    };

    // Act: Call service function
    const booking = await createBooking(mockContext, {
      customerId: 'customer-id',
      serviceItemId: 'package-id',
      scheduledStartTime: '2025-06-01T09:00:00Z',
      totalAmount: 15000000,
    });

    // Assert: Verify contract structure
    expect(booking).toMatchObject<Partial<CoreBookingOrder>>({
      tenantId: mockContext.tenantId,
      moduleId: 'spa',
      status: 'draft',
    });
  });
});
```

## References

- **Core Platform Extraction Roadmap**: `../../docs/plans/core-platform-extraction-roadmap.md`
- **Phase 1 Spec**: `.kiro/specs/dashboard-core-spa-boundary-refactor/`
- **Phase 2 Spec**: `.kiro/specs/core-service-contracts/`
- **Supabase Database Types**: `src/types/database.types.ts`

## Contributing

When adding new core service contracts:

1. Create interface in appropriate file under `src/core/types/`
2. Add comprehensive TSDoc comments with `@remarks` and `@example` blocks
3. Include `tenantId` field for multi-tenant isolation
4. Include `metadata: Record<string, any>` field for module extensibility
5. Export from `index.ts` barrel file
6. Update this README with contract description and usage examples
7. Ensure TypeScript compilation passes: `npx tsc --noEmit --pretty false`
8. Ensure all tests pass: `npm run test`

---

**Last Updated**: Phase 2 Complete  
**Status**: ✅ Contract definitions ready for Phase 3 migration
