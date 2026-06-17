# Phase 3 Migration Guide for Developers

**Version**: 1.0  
**Last Updated**: 2025-06-01  
**Audience**: Bella ERP Developers  
**Prerequisites**: Familiarity with TypeScript, React, Next.js, and Bella ERP codebase

---

## Table of Contents

1. [Overview](#overview)
2. [What Changed in Phase 3](#what-changed-in-phase-3)
3. [Migration Checklist](#migration-checklist)
4. [Updating Service Function Signatures](#updating-service-function-signatures)
5. [Using TenantContext in React Components](#using-tenantcontext-in-react-components)
6. [Using TenantContext in API Routes](#using-tenantcontext-in-api-routes)
7. [Adding Module-Specific Logic to Adapters](#adding-module-specific-logic-to-adapters)
8. [Updating Database Queries](#updating-database-queries)
9. [Updating Tests](#updating-tests)
10. [Code Migration Patterns](#code-migration-patterns)
11. [Common Migration Issues](#common-migration-issues)
12. [FAQ](#faq)

---

## Overview

Phase 3 physically extracts core platform services from the monolithic Bella Spa codebase and introduces:

- **Core Platform**: Industry-neutral services in `src/core/`
- **Module System**: Industry-specific logic in `src/modules/spa/`
- **TenantContext**: Multi-tenant configuration passed to all services
- **Module Adapters**: Plugin pattern for industry-specific behavior

**Goal**: Transform the monolithic spa-specific codebase into a modular, multi-industry platform while maintaining 100% backward compatibility.

**Impact**: All developers must update their code to use the new architecture.

---

## What Changed in Phase 3

### Directory Structure Changes

**Before Phase 3**:
```
src/
├── services/           # Mixed core + spa logic
│   ├── auth/
│   ├── bookings/      # Spa-specific booking logic
│   ├── payments/
│   └── finance/
├── components/         # Mixed core + spa components
└── types/              # Mixed type definitions
```

**After Phase 3**:
```
src/
├── core/               # NEW: Core platform (industry-neutral)
│   ├── types/
│   ├── services/
│   │   ├── auth/
│   │   ├── order/     # RENAMED: bookings → order
│   │   ├── payment/
│   │   ├── audit/
│   │   ├── notification/
│   │   ├── finance/
│   │   ├── payroll/   # NEW: Extracted from finance
│   │   └── analytics/ # NEW: Extracted from various services
│   ├── adapters/      # NEW: Module registry
│   ├── providers/     # NEW: TenantContextProvider
│   ├── hooks/         # NEW: useTenantContext
│   └── middleware/    # NEW: withTenantContext
│
└── modules/            # NEW: Industry-specific modules
    └── spa/
        ├── types/      # Spa-specific types
        ├── adapters/   # SpaModuleAdapter
        ├── services/   # Spa business logic
        └── components/ # Spa UI components
```

### Key Architecture Changes

1. **Service Function Signatures**: All service functions now accept `TenantContext` as first parameter
2. **Terminology**: "Booking" → "Order" for industry neutrality (but contract type remains `CoreBookingOrder`)
3. **Module Adapters**: Spa-specific logic moved to `SpaModuleAdapter`
4. **Import Paths**: Changed from `@/services/` to `@/core/services/` or `@/modules/spa/`
5. **React Context**: New `TenantContextProvider` for client-side tenant configuration

---

## Migration Checklist

Use this checklist to migrate your feature branch to Phase 3 architecture:

### Step 1: Update Dependencies
- [ ] Pull latest `main` branch with Phase 3 changes
- [ ] Run `npm install` to ensure dependencies are up to date
- [ ] Run `npm run build` to verify TypeScript compilation

### Step 2: Update Imports
- [ ] Replace `@/services/auth/` with `@/core/services/auth/`
- [ ] Replace `@/services/bookings/` with `@/core/services/order/`
- [ ] Replace `@/services/payments/` with `@/core/services/payment/`
- [ ] Replace `@/services/notifications/` with `@/core/services/notification/`
- [ ] Replace `@/services/audit/` with `@/core/services/audit/`
- [ ] Replace `@/services/finance/` with `@/core/services/finance/`
- [ ] Replace spa-specific imports with `@/modules/spa/`

### Step 3: Update Service Function Calls
- [ ] Add `TenantContext` as first parameter to all service function calls
- [ ] Extract tenant context using middleware or hooks

### Step 4: Update React Components
- [ ] Wrap app with `TenantContextProvider` (if not already done)
- [ ] Use `useTenantContext()` hook to access tenant configuration
- [ ] Update spa-specific components to use `@/modules/spa/components/`

### Step 5: Update API Routes
- [ ] Wrap API routes with `withTenantContext` middleware
- [ ] Extract `context` from `request.tenantContext`
- [ ] Pass context to service functions

### Step 6: Update Tests
- [ ] Create mock `TenantContext` in test setup
- [ ] Update service function calls to pass mock context
- [ ] Run test suite: `npm run test`

### Step 7: Verify
- [ ] Run `npm run build` — no TypeScript errors
- [ ] Run `npm run test` — all tests pass
- [ ] Test manually in browser — features work unchanged
- [ ] Review git diff — only necessary changes

---

## Updating Service Function Signatures

### Pattern: Service Functions Accept TenantContext First

All service functions in `src/core/services/` now accept `TenantContext` as the first parameter.

**Before Phase 3**:
```typescript
// src/services/bookings/create.ts
export async function createBooking(orderData: BookingData): Promise<Booking> {
  const { data, error } = await supabase
    .from('bookings')
    .insert(orderData)
    .select()
    .single();
  
  if (error) throw error;
  return data;
}
```

**After Phase 3**:
```typescript
// src/core/services/order/create.ts
import type { TenantContext, CoreBookingOrder } from '@/core/types';

export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...orderData,
      tenant_id: context.tenantId, // CRITICAL: Tenant isolation
    })
    .select()
    .single();
  
  if (error) throw error;
  return data as CoreBookingOrder;
}
```

### Key Changes

1. **First Parameter**: `context: TenantContext` is now first parameter
2. **Tenant Filtering**: Use `context.tenantId` to filter database queries
3. **Return Type**: Use core contract types (`CoreBookingOrder`, `PaymentIntent`)
4. **Function Name**: "Booking" functions renamed to "Order" for neutrality

---

### Migration Example: Authentication Service

**Before Phase 3**:
```typescript
// src/services/auth/authenticate.ts
export async function authenticateUser(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  return data.user;
}
```

**After Phase 3**:
```typescript
// src/core/services/auth/authenticate.ts
import type { TenantContext } from '@/core/types';

export async function authenticateUser(
  context: TenantContext,
  email: string,
  password: string
) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) throw error;
  
  // Verify user belongs to current tenant
  if (data.user.user_metadata.tenant_id !== context.tenantId) {
    throw new Error('User does not belong to this tenant');
  }
  
  return data.user;
}
```

### Migration Example: Order Service

**Before Phase 3**:
```typescript
// src/services/bookings/getBookingsByCustomer.ts
export async function getBookingsByCustomer(customerId: string): Promise<Booking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId);
  
  if (error) throw error;
  return data;
}
```

**After Phase 3**:
```typescript
// src/core/services/order/getOrdersByCustomer.ts
import type { TenantContext, CoreBookingOrder } from '@/core/types';

export async function getOrdersByCustomer(
  context: TenantContext,
  customerId: string
): Promise<CoreBookingOrder[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', context.tenantId); // CRITICAL: Tenant filter
  
  if (error) throw error;
  return data as CoreBookingOrder[];
}
```

---

## Using TenantContext in React Components

### Step 1: Wrap App with TenantContextProvider

**File**: `src/app/layout.tsx` (Next.js App Router)

```typescript
import { TenantContextProvider } from '@/core/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>
        <TenantContextProvider>
          {children}
        </TenantContextProvider>
      </body>
    </html>
  );
}
```

**Alternative**: `src/pages/_app.tsx` (Next.js Pages Router)

```typescript
import { AppProps } from 'next/app';
import { TenantContextProvider } from '@/core/providers';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <TenantContextProvider>
      <Component {...pageProps} />
    </TenantContextProvider>
  );
}
```

### Step 2: Use useTenantContext Hook

**Before Phase 3**:
```typescript
'use client';

export function Dashboard() {
  const [tenantName, setTenantName] = useState('');
  
  useEffect(() => {
    // Fetch tenant data manually
    fetch('/api/tenant').then(res => res.json()).then(data => {
      setTenantName(data.name);
    });
  }, []);
  
  return <h1>Welcome to {tenantName}</h1>;
}
```

**After Phase 3**:
```typescript
'use client';

import { useTenantContext } from '@/core/hooks';

export function Dashboard() {
  const context = useTenantContext();
  
  return <h1>Welcome to {context.tenantName}</h1>;
}
```

### Example: Feature Flag Gating

```typescript
'use client';

import { useTenantContext } from '@/core/hooks';
import { AISalaryReconciliation } from '@/modules/spa/components/salary/AISalaryReconciliation';
import { ManualSalaryReconciliation } from '@/modules/spa/components/salary/ManualSalaryReconciliation';

export function SalaryReconciliationPage() {
  const context = useTenantContext();
  
  // Check if AI reconciliation feature is enabled
  const aiEnabled = context.featureFlags['ai_salary_reconciliation'] === true;
  
  return (
    <div>
      <h1>Salary Reconciliation</h1>
      {aiEnabled ? (
        <AISalaryReconciliation />
      ) : (
        <ManualSalaryReconciliation />
      )}
    </div>
  );
}
```

---

### Example: Module-Specific Components

```typescript
'use client';

import { useTenantContext } from '@/core/hooks';
import { SpaOrderList } from '@/modules/spa/components/order/SpaOrderList';

export function OrdersPage() {
  const context = useTenantContext();
  
  // Only show spa module components if spa module is enabled
  if (!context.enabledModules.includes('spa')) {
    return <div>Spa module not enabled for your account.</div>;
  }
  
  return (
    <div>
      <h1>Orders</h1>
      <SpaOrderList />
    </div>
  );
}
```

### Example: Subscription Plan Gating

```typescript
'use client';

import { useTenantContext } from '@/core/hooks';

export function AdvancedAnalytics() {
  const context = useTenantContext();
  
  // Check subscription plan
  const planTiers = ['free', 'basic', 'professional', 'enterprise'];
  const currentTier = planTiers.indexOf(context.subscriptionPlan);
  const requiredTier = planTiers.indexOf('professional');
  
  if (currentTier < requiredTier) {
    return (
      <div>
        <h2>Advanced Analytics</h2>
        <p>This feature requires a Professional or Enterprise plan.</p>
        <button>Upgrade Now</button>
      </div>
    );
  }
  
  return <AdvancedAnalyticsDashboard />;
}
```

---

## Using TenantContext in API Routes

### Pattern: withTenantContext Middleware

Use the `withTenantContext` middleware to automatically extract and attach tenant context to API requests.

**Before Phase 3**:
```typescript
// src/app/api/bookings/route.ts
export async function POST(request: Request) {
  const orderData = await request.json();
  
  // Create booking without tenant context
  const booking = await createBooking(orderData);
  
  return Response.json(booking);
}
```

**After Phase 3**:
```typescript
// src/app/api/orders/route.ts
import { withTenantContext, type NextRequestWithContext } from '@/core/middleware';
import { createOrder } from '@/core/services/order';

export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  // Context automatically extracted and attached
  const context = request.tenantContext;
  
  const orderData = await request.json();
  
  // Pass context to service
  const order = await createOrder(context, orderData);
  
  return Response.json(order, { status: 201 });
});
```

### Error Handling

The `withTenantContext` middleware automatically handles auth and tenant errors:

- **401 Unauthorized**: User not authenticated
- **403 Forbidden**: User has no tenant assigned
- **404 Not Found**: Tenant not found in database
- **500 Internal Server Error**: Database query failed

**Example with custom error handling**:

```typescript
export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext;
  
  try {
    const orderData = await request.json();
    const order = await createOrder(context, orderData);
    return Response.json(order, { status: 201 });
  } catch (error) {
    console.error('[API] Order creation failed:', error);
    return Response.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
});
```

---

### Multiple Endpoints in One File

```typescript
// src/app/api/orders/[id]/route.ts
import { withTenantContext, type NextRequestWithContext } from '@/core/middleware';
import { getOrderById, updateOrder, deleteOrder } from '@/core/services/order';

// GET /api/orders/:id
export const GET = withTenantContext(async (
  request: NextRequestWithContext,
  { params }: { params: { id: string } }
) => {
  const context = request.tenantContext;
  const order = await getOrderById(context, params.id);
  
  if (!order) {
    return Response.json({ error: 'Order not found' }, { status: 404 });
  }
  
  return Response.json(order);
});

// PATCH /api/orders/:id
export const PATCH = withTenantContext(async (
  request: NextRequestWithContext,
  { params }: { params: { id: string } }
) => {
  const context = request.tenantContext;
  const updates = await request.json();
  
  const order = await updateOrder(context, params.id, updates);
  return Response.json(order);
});

// DELETE /api/orders/:id
export const DELETE = withTenantContext(async (
  request: NextRequestWithContext,
  { params }: { params: { id: string } }
) => {
  const context = request.tenantContext;
  
  await deleteOrder(context, params.id);
  return Response.json({ success: true }, { status: 200 });
});
```

---

## Adding Module-Specific Logic to Adapters

### When to Use Module Adapters

Use module adapters when you need to:

1. **Validate module-specific business rules** (e.g., KTV availability in spa module)
2. **Apply dynamic pricing** (e.g., member discounts, package promotions)
3. **Transform core types to module-specific types** with strongly-typed metadata
4. **Execute side effects** after order completion (e.g., update salary, deduct inventory)
5. **Provide module-specific dashboard widgets**

### Pattern: Extending SpaModuleAdapter

**File**: `src/modules/spa/adapters/SpaModuleAdapter.ts`

```typescript
import type {
  ModuleAdapter,
  CoreServiceCatalogItem,
  CoreBookingOrder,
  TenantContext,
} from '@/core/types';
import type { SpaPackage, SpaBooking } from '../types';

export class SpaModuleAdapter implements ModuleAdapter {
  readonly moduleId = 'spa' as const;
  readonly moduleName = 'Bella Spa & Babycare';

  /**
   * Validate spa-specific booking rules.
   */
  async validateBookingRules(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    // Check KTV availability
    const ktvId = order.metadata.assigned_ktv_id as string;
    if (!ktvId) {
      console.error('[SpaAdapter] Missing KTV assignment');
      return false;
    }

    // Check session limits
    const completed = order.metadata.sessions_completed as number || 0;
    const total = order.metadata.sessions_total as number;
    if (completed >= total) {
      console.error('[SpaAdapter] All sessions already completed');
      return false;
    }

    return true;
  }

  /**
   * Calculate spa-specific pricing.
   */
  async calculatePricing(
    item: CoreServiceCatalogItem,
    context: TenantContext
  ): Promise<number> {
    let price = item.basePrice;
    
    // Apply subscription-based discount
    if (context.subscriptionPlan === 'enterprise') {
      price *= 0.9; // 10% discount
    }
    
    // Apply package category discount
    const category = item.metadata.category as string;
    if (category === 'vip') {
      price *= 0.95; // 5% discount for VIP packages
    }
    
    return Math.round(price);
  }

  /**
   * Execute side effects when session completes.
   */
  async onBookingCompleted(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<void> {
    console.log(`[SpaAdapter] Processing completion for order ${order.id}`);
    
    try {
      // Update KTV salary
      await this.creditKtvSalary(order, context);
      
      // Deduct product inventory
      const products = order.metadata.products_used as Record<string, number>;
      if (products) {
        await this.deductInventory(products, context);
      }
      
      // Update KTV performance metrics
      await this.updateKtvPerformance(order, context);
    } catch (error) {
      console.error('[SpaAdapter] Side effect failed:', error);
      // Don't throw - log and continue
    }
  }

  private async creditKtvSalary(order: CoreBookingOrder, context: TenantContext) {
    // Implementation: Update salary_records table
  }

  private async deductInventory(products: Record<string, number>, context: TenantContext) {
    // Implementation: Update inventory_items table
  }

  private async updateKtvPerformance(order: CoreBookingOrder, context: TenantContext) {
    // Implementation: Update kpi_records table
  }
}
```

---

### How Core Services Invoke Adapters

Core services use the module registry to look up and invoke adapters.

**File**: `src/core/services/order/create.ts`

```typescript
import { moduleRegistry } from '@/core/adapters';
import type { TenantContext, CoreBookingOrder } from '@/core/types';

export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Look up module adapter (graceful - returns undefined if not found)
  const adapter = moduleRegistry.get(context.moduleId);
  
  // Invoke adapter validation (optional)
  if (adapter?.validateBookingRules) {
    const isValid = await adapter.validateBookingRules(
      orderData as CoreBookingOrder,
      context
    );
    if (!isValid) {
      throw new Error('Booking validation failed');
    }
  }
  
  // Create order in database
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...orderData,
      tenant_id: context.tenantId,
    })
    .select()
    .single();
  
  if (error) throw error;
  
  return data as CoreBookingOrder;
}
```

### Best Practices for Adapters

1. **Keep Adapters Stateless**: Don't store instance state (reused across requests)
2. **Use Core Services for Data Access**: Don't query database directly
3. **Validate Input Parameters**: Check metadata fields exist before accessing
4. **Handle Errors Gracefully**: Log errors, don't throw (except critical failures)
5. **Use Descriptive Console Logs**: Prefix with `[ModuleName]` for debugging

---

## Updating Database Queries

### Pattern: Always Filter by tenantId

All database queries MUST include `tenant_id` filter to ensure tenant isolation.

**Before Phase 3**:
```typescript
export async function getBookings() {
  const { data } = await supabase
    .from('bookings')
    .select('*');
  
  return data;
}
```

**After Phase 3**:
```typescript
import type { TenantContext, CoreBookingOrder } from '@/core/types';

export async function getOrders(context: TenantContext): Promise<CoreBookingOrder[]> {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', context.tenantId); // CRITICAL: Tenant filter
  
  return data as CoreBookingOrder[];
}
```

### Pattern: Use Core Contract Types

Database queries should return core contract types for type safety.

**Before Phase 3**:
```typescript
export async function getBookingById(id: string) {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .single();
  
  return data; // Type: any
}
```

**After Phase 3**:
```typescript
import type { TenantContext, CoreBookingOrder } from '@/core/types';

export async function getOrderById(
  context: TenantContext,
  id: string
): Promise<CoreBookingOrder | null> {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', context.tenantId)
    .single();
  
  return data as CoreBookingOrder | null;
}
```

---

### Pattern: Use Strict Supabase Types

Use Supabase auto-generated types for insert/update operations.

**Before Phase 3**:
```typescript
export async function createBooking(orderData: any) {
  const { data } = await supabase
    .from('bookings')
    .insert(orderData) // No type checking!
    .select()
    .single();
  
  return data;
}
```

**After Phase 3**:
```typescript
import type { TenantContext, CoreBookingOrder } from '@/core/types';
import type { Database } from '@/types/supabase';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Type-checked insert payload
  const insertPayload: BookingInsert = {
    customer_id: orderData.customerId,
    total_amount: orderData.totalAmount,
    status: orderData.status || 'pending',
    tenant_id: context.tenantId,
    // TypeScript catches missing or invalid fields!
  };
  
  const { data, error } = await supabase
    .from('bookings')
    .insert(insertPayload)
    .select()
    .single();
  
  if (error) throw error;
  
  return data as CoreBookingOrder;
}
```

### Pattern: Row-Level Security (RLS)

Use RLS to enforce tenant isolation at the database level.

```sql
-- Enable RLS on bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see bookings from their tenant
CREATE POLICY "Users can view own tenant bookings"
ON bookings
FOR SELECT
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Set session tenant in queries**:

```typescript
export async function getOrders(context: TenantContext): Promise<CoreBookingOrder[]> {
  // Set session tenant for RLS
  await supabase.rpc('set_session_tenant', {
    p_tenant_id: context.tenantId,
  });
  
  // RLS automatically filters by tenant_id
  const { data } = await supabase
    .from('bookings')
    .select('*');
  
  return data as CoreBookingOrder[];
}
```

---

## Updating Tests

### Pattern: Create Mock TenantContext

**File**: `src/__tests__/utils/mock-tenant-context.ts`

```typescript
import type { TenantContext } from '@/core/types/tenant';

export function createMockTenantContext(
  overrides?: Partial<TenantContext>
): TenantContext {
  return {
    tenantId: 'test-tenant-id',
    tenantName: 'Test Tenant',
    enabledModules: ['spa'],
    subscriptionPlan: 'professional',
    featureFlags: {},
    settings: {
      currency: 'VND',
      timezone: 'Asia/Ho_Chi_Minh',
      locale: 'vi-VN',
    },
    ...overrides,
  };
}
```

### Pattern: Update Unit Tests

**Before Phase 3**:
```typescript
import { createBooking } from '@/services/bookings/create';

describe('createBooking', () => {
  it('creates a booking', async () => {
    const orderData = {
      customerId: 'customer-123',
      totalAmount: 500000,
    };
    
    const booking = await createBooking(orderData);
    
    expect(booking.totalAmount).toBe(500000);
  });
});
```

**After Phase 3**:
```typescript
import { createOrder } from '@/core/services/order/create';
import { createMockTenantContext } from '@/__tests__/utils/mock-tenant-context';

describe('createOrder', () => {
  it('creates an order with tenant isolation', async () => {
    const context = createMockTenantContext({
      tenantId: 'tenant-123',
    });
    
    const orderData = {
      customerId: 'customer-456',
      totalAmount: 500000,
    };
    
    const order = await createOrder(context, orderData);
    
    expect(order.tenant_id).toBe('tenant-123');
    expect(order.totalAmount).toBe(500000);
  });
});
```

---

### Pattern: Test Feature Flags

```typescript
import { createMockTenantContext } from '@/__tests__/utils/mock-tenant-context';
import { reconcileSalary } from '@/core/services/payroll/reconcile';

describe('reconcileSalary', () => {
  it('uses AI when feature flag is enabled', async () => {
    const context = createMockTenantContext({
      featureFlags: {
        'ai_salary_reconciliation': true,
      },
    });
    
    const result = await reconcileSalary(context, '2025-01');
    
    expect(result.method).toBe('ai');
  });
  
  it('uses manual calculation when feature flag is disabled', async () => {
    const context = createMockTenantContext({
      featureFlags: {
        'ai_salary_reconciliation': false,
      },
    });
    
    const result = await reconcileSalary(context, '2025-01');
    
    expect(result.method).toBe('manual');
  });
});
```

### Pattern: Test Module Adapters

```typescript
import { SpaModuleAdapter } from '@/modules/spa/adapters/SpaModuleAdapter';
import { createMockTenantContext } from '@/__tests__/utils/mock-tenant-context';
import type { CoreBookingOrder } from '@/core/types';

describe('SpaModuleAdapter', () => {
  const adapter = new SpaModuleAdapter();
  const context = createMockTenantContext();
  
  it('validates booking rules correctly', async () => {
    const order: CoreBookingOrder = {
      id: 'order-123',
      customerId: 'customer-456',
      totalAmount: 500000,
      status: 'pending',
      metadata: {
        assigned_ktv_id: 'ktv-789',
        sessions_completed: 0,
        sessions_total: 10,
      },
    } as CoreBookingOrder;
    
    const isValid = await adapter.validateBookingRules!(order, context);
    
    expect(isValid).toBe(true);
  });
  
  it('rejects booking when sessions exhausted', async () => {
    const order: CoreBookingOrder = {
      id: 'order-123',
      metadata: {
        assigned_ktv_id: 'ktv-789',
        sessions_completed: 10,
        sessions_total: 10, // All sessions used
      },
    } as CoreBookingOrder;
    
    const isValid = await adapter.validateBookingRules!(order, context);
    
    expect(isValid).toBe(false);
  });
});
```

---

## Code Migration Patterns

### Pattern 1: Update Import Paths

**Find and Replace Strategy**:

```bash
# Replace auth service imports
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@\/services\/auth/@\/core\/services\/auth/g'

# Replace booking service imports
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@\/services\/bookings/@\/core\/services\/order/g'

# Replace payment service imports
find . -name "*.ts" -o -name "*.tsx" | xargs sed -i 's/@\/services\/payments/@\/core\/services\/payment/g'
```

**Manual Review Required**:
- Check if spa-specific logic should move to `@/modules/spa/`
- Verify contract type imports use `@/core/types/`

### Pattern 2: Add TenantContext Parameter

**Before**:
```typescript
const booking = await getBookingById(bookingId);
```

**After**:
```typescript
const context = request.tenantContext; // API route
// OR
const context = useTenantContext(); // React component

const order = await getOrderById(context, bookingId);
```

### Pattern 3: Rename "Booking" to "Order"

**Function Names**:
- `createBooking` → `createOrder`
- `getBookingById` → `getOrderById`
- `updateBooking` → `updateOrder`
- `deleteBooking` → `deleteOrder`

**Note**: Contract type remains `CoreBookingOrder` (unchanged from Phase 2)

**Example**:
```typescript
// Before
import { createBooking, getBookingById } from '@/services/bookings';

const booking = await getBookingById(id);
const newBooking = await createBooking(data);

// After
import { createOrder, getOrderById } from '@/core/services/order';

const order = await getOrderById(context, id);
const newOrder = await createOrder(context, data);
```

---

### Pattern 4: Move Spa-Specific Logic to Module

**Before Phase 3**: Spa-specific logic mixed with core logic

```typescript
// src/services/bookings/complete.ts
export async function completeBooking(bookingId: string) {
  // Update booking status (core logic)
  await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .eq('id', bookingId);
  
  // Credit KTV salary (spa-specific logic)
  const booking = await getBookingById(bookingId);
  const ktvId = booking.metadata.assigned_ktv_id;
  await creditKtvSalary(ktvId, booking.totalAmount);
  
  // Deduct inventory (spa-specific logic)
  await deductInventory(booking.metadata.products_used);
}
```

**After Phase 3**: Core logic separated from module logic

```typescript
// src/core/services/order/complete.ts
import { moduleRegistry } from '@/core/adapters';

export async function completeOrder(
  context: TenantContext,
  orderId: string
): Promise<CoreBookingOrder> {
  // Update order status (core logic)
  const { data } = await supabase
    .from('bookings')
    .update({ status: 'completed', completedAt: new Date() })
    .eq('id', orderId)
    .eq('tenant_id', context.tenantId)
    .select()
    .single();
  
  // Invoke module adapter for side effects (spa-specific logic)
  const adapter = moduleRegistry.get(context.moduleId);
  if (adapter?.onBookingCompleted) {
    await adapter.onBookingCompleted(data, context);
  }
  
  return data as CoreBookingOrder;
}
```

```typescript
// src/modules/spa/adapters/SpaModuleAdapter.ts
export class SpaModuleAdapter implements ModuleAdapter {
  async onBookingCompleted(order: CoreBookingOrder, context: TenantContext) {
    // Credit KTV salary (spa-specific)
    const ktvId = order.metadata.assigned_ktv_id as string;
    await creditKtvSalary(ktvId, order.totalAmount, context);
    
    // Deduct inventory (spa-specific)
    const products = order.metadata.products_used as Record<string, number>;
    if (products) {
      await deductInventory(products, context);
    }
  }
}
```

---

### Pattern 5: Extract Tenant Context in Server Actions

**Server Actions** don't have `request` objects, so you need to manually extract tenant context.

**Before Phase 3**:
```typescript
'use server';

import { createBooking } from '@/services/bookings';

export async function createBookingAction(orderData: unknown) {
  const booking = await createBooking(orderData);
  return booking;
}
```

**After Phase 3**:
```typescript
'use server';

import { cookies } from 'next/headers';
import { extractTenantContext } from '@/core/middleware';
import { createOrder } from '@/core/services/order';

export async function createOrderAction(orderData: unknown) {
  // Construct mock request for auth extraction
  const mockRequest = {
    headers: new Headers(),
    cookies: await cookies(),
  } as any;
  
  // Extract tenant context
  const result = await extractTenantContext(mockRequest);
  
  if (!result.success) {
    throw new Error(result.error);
  }
  
  // Pass context to service
  const order = await createOrder(result.context, orderData);
  return order;
}
```

### Pattern 6: Update Component Data Fetching

**Before Phase 3**:
```typescript
'use client';

import { useEffect, useState } from 'react';

export function OrderList() {
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    fetch('/api/bookings')
      .then(res => res.json())
      .then(data => setOrders(data));
  }, []);
  
  return <div>{/* Render orders */}</div>;
}
```

**After Phase 3**:
```typescript
'use client';

import { useEffect, useState } from 'react';
import { useTenantContext } from '@/core/hooks';

export function OrderList() {
  const context = useTenantContext();
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    // API route automatically uses tenant context via middleware
    fetch('/api/orders')
      .then(res => res.json())
      .then(data => setOrders(data));
  }, []);
  
  return (
    <div>
      <h2>Orders for {context.tenantName}</h2>
      {/* Render orders */}
    </div>
  );
}
```

---

## Common Migration Issues

### Issue 1: TypeScript Error - Missing TenantContext Parameter

**Error**:
```
Expected 2 arguments, but got 1.
```

**Cause**: Service function now requires `TenantContext` as first parameter.

**Solution**:
```typescript
// Before (incorrect)
const order = await createOrder(orderData);

// After (correct)
const context = request.tenantContext; // or useTenantContext()
const order = await createOrder(context, orderData);
```

### Issue 2: Import Not Found

**Error**:
```
Cannot find module '@/services/bookings'
```

**Cause**: Service moved to new location.

**Solution**:
```typescript
// Before (incorrect)
import { createBooking } from '@/services/bookings';

// After (correct)
import { createOrder } from '@/core/services/order';
```

### Issue 3: TenantContext Hook Error

**Error**:
```
Error: useTenantContext must be used within TenantContextProvider
```

**Cause**: Component not wrapped in `TenantContextProvider`.

**Solution**: Wrap app with provider in `src/app/layout.tsx`:

```typescript
import { TenantContextProvider } from '@/core/providers';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <TenantContextProvider>
          {children}
        </TenantContextProvider>
      </body>
    </html>
  );
}
```

---

### Issue 4: Database Query Not Filtering by Tenant

**Error**: User can see data from other tenants.

**Cause**: Missing `tenant_id` filter in query.

**Solution**:
```typescript
// Before (SECURITY VULNERABILITY!)
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('id', bookingId);

// After (SECURE)
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('id', bookingId)
  .eq('tenant_id', context.tenantId); // CRITICAL
```

### Issue 5: Adapter Method Not Found

**Error**:
```
TypeError: adapter.validateBookingRules is not a function
```

**Cause**: Adapter method is optional. Core service must check if method exists.

**Solution**:
```typescript
// Before (incorrect)
const isValid = await adapter.validateBookingRules(order, context);

// After (correct)
const adapter = moduleRegistry.get(context.moduleId);
if (adapter?.validateBookingRules) {
  const isValid = await adapter.validateBookingRules(order, context);
  if (!isValid) {
    throw new Error('Validation failed');
  }
}
```

### Issue 6: Tests Failing After Migration

**Error**:
```
TypeError: Cannot read property 'tenantId' of undefined
```

**Cause**: Tests not providing mock `TenantContext`.

**Solution**: Update tests to pass mock context:

```typescript
import { createMockTenantContext } from '@/__tests__/utils/mock-tenant-context';

it('should create order', async () => {
  const context = createMockTenantContext();
  const order = await createOrder(context, orderData);
  expect(order).toBeDefined();
});
```

---

## FAQ

### Q1: Why did "booking" terminology change to "order"?

**A**: To make the core platform industry-neutral. "Booking" is spa-specific terminology. "Order" works for spa (service orders), cleaning (job orders), and home service (appointment orders). The contract type remains `CoreBookingOrder` to avoid breaking changes from Phase 2.

### Q2: Do I need to update all my code at once?

**A**: No. You can migrate incrementally:
1. Update imports first (TypeScript will catch errors)
2. Add TenantContext parameters to service calls
3. Update tests last

### Q3: What if I forget to filter by tenantId?

**A**: Row-Level Security (RLS) policies provide defense-in-depth. Even if application code has bugs, RLS ensures tenant isolation at the database level. However, you should still explicitly filter by `tenantId` in application code.

### Q4: Can I use the old service paths temporarily?

**A**: No. The old service paths no longer exist after Phase 3. You must update all imports to the new paths.

### Q5: How do I test tenant-specific features?

**A**: Use `createMockTenantContext()` with custom overrides:

```typescript
const context = createMockTenantContext({
  featureFlags: {
    'ai_salary_reconciliation': true,
  },
  subscriptionPlan: 'enterprise',
});
```

### Q6: What happens if a module adapter is not registered?

**A**: Core services gracefully handle missing adapters. If `moduleRegistry.get()` returns `undefined`, adapter methods are skipped and default behavior is used.

### Q7: Can I add spa-specific logic to core services?

**A**: No. Spa-specific logic must be in `src/modules/spa/`. Core services must remain industry-neutral. Use module adapters for spa-specific behavior.

---

### Q8: How do I migrate custom hooks?

**A**: Update custom hooks to accept or use TenantContext:

**Before**:
```typescript
export function useBookings() {
  const [bookings, setBookings] = useState([]);
  
  useEffect(() => {
    fetch('/api/bookings')
      .then(res => res.json())
      .then(data => setBookings(data));
  }, []);
  
  return bookings;
}
```

**After**:
```typescript
import { useTenantContext } from '@/core/hooks';

export function useOrders() {
  const context = useTenantContext();
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    // API automatically uses tenant context
    fetch('/api/orders')
      .then(res => res.json())
      .then(data => setOrders(data));
  }, []);
  
  return orders;
}
```

### Q9: What if I need to query multiple tenants (admin view)?

**A**: Admin features require special handling:

1. **Backend**: Create dedicated admin API routes that don't use `withTenantContext` middleware
2. **Authorization**: Verify user has admin role before allowing cross-tenant queries
3. **Explicit Filtering**: Pass specific `tenantId` to queries instead of using context

```typescript
// Admin API route (no tenant middleware)
export async function GET(request: Request) {
  const user = await verifyAdmin(request);
  const tenantId = request.url.searchParams.get('tenantId');
  
  // Query specific tenant
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId);
  
  return Response.json(data);
}
```

### Q10: How do I handle module-specific UI components?

**A**: Move components to module directory and use conditional rendering:

```typescript
import { useTenantContext } from '@/core/hooks';
import { SpaOrderForm } from '@/modules/spa/components/order/SpaOrderForm';

export function OrderPage() {
  const context = useTenantContext();
  
  // Check if spa module is enabled
  if (!context.enabledModules.includes('spa')) {
    return <div>Spa module not available</div>;
  }
  
  return <SpaOrderForm />;
}
```

---

### Q11: What about background jobs and cron tasks?

**A**: Background jobs need to construct TenantContext manually:

```typescript
// Before
export async function processPayments() {
  const pendingPayments = await getAllPendingPayments();
  for (const payment of pendingPayments) {
    await processPayment(payment.id);
  }
}

// After
import { constructTenantContext } from '@/core/lib/tenant-context';

export async function processPayments() {
  const pendingPayments = await getAllPendingPayments();
  
  for (const payment of pendingPayments) {
    // Construct context for each payment's tenant
    const context = await constructTenantContext(payment.tenant_id);
    await processPayment(context, payment.id);
  }
}
```

### Q12: How do I debug tenant context issues?

**A**: Add logging to see tenant context values:

```typescript
export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext;
  
  // Debug log
  console.log('[API] Tenant Context:', {
    tenantId: context.tenantId,
    tenantName: context.tenantName,
    enabledModules: context.enabledModules,
    subscriptionPlan: context.subscriptionPlan,
  });
  
  // ... rest of handler
});
```

### Q13: Can I cache TenantContext in React state?

**A**: No need. `TenantContextProvider` already caches context in React Context. Just use the `useTenantContext()` hook wherever needed.

### Q14: What if Phase 3 breaks my feature?

**A**: Follow this debugging checklist:

1. **Check TypeScript errors**: Run `npm run build`
2. **Check test failures**: Run `npm run test`
3. **Check console errors**: Look for runtime errors in browser console
4. **Verify imports**: Ensure all imports use new paths
5. **Verify TenantContext**: Check all service calls pass context
6. **Verify tenant filtering**: Check all queries filter by `tenantId`
7. **Ask for help**: Ping team in Slack with error details

---

## Quick Reference

### Import Path Changes

| Before Phase 3 | After Phase 3 |
|----------------|---------------|
| `@/services/auth/` | `@/core/services/auth/` |
| `@/services/bookings/` | `@/core/services/order/` |
| `@/services/payments/` | `@/core/services/payment/` |
| `@/services/notifications/` | `@/core/services/notification/` |
| `@/services/audit/` | `@/core/services/audit/` |
| `@/services/finance/` | `@/core/services/finance/` |
| N/A | `@/core/services/payroll/` (new) |
| N/A | `@/core/services/analytics/` (new) |
| Spa-specific code | `@/modules/spa/` |

### Function Name Changes

| Before Phase 3 | After Phase 3 |
|----------------|---------------|
| `createBooking()` | `createOrder()` |
| `getBookingById()` | `getOrderById()` |
| `getBookingsByCustomer()` | `getOrdersByCustomer()` |
| `updateBooking()` | `updateOrder()` |
| `deleteBooking()` | `deleteOrder()` |
| `completeBooking()` | `completeOrder()` |

### Key Files to Review

- **TenantContext Provider**: `src/core/providers/TenantContextProvider.tsx`
- **Module Registry**: `src/core/adapters/registry.ts`
- **Spa Adapter**: `src/modules/spa/adapters/SpaModuleAdapter.ts`
- **Middleware**: `src/core/middleware/tenantContext.ts`
- **Core Types**: `src/core/types/`
- **Test Utilities**: `src/__tests__/utils/mock-tenant-context.ts`

### Helpful Commands

```bash
# Build and check TypeScript errors
npm run build

# Run test suite
npm run test

# Run specific test file
npm run test -- path/to/test.test.ts

# Check for security issues
npm run security:audit

# Format code
npm run format
```

---

## Additional Resources

### Architecture Documentation

- **Core Platform Architecture**: `docs/architecture/core-platform.md`
- **Module System Architecture**: `docs/architecture/module-system.md`
- **Tenant Context Architecture**: `docs/architecture/tenant-context.md`

### Phase Documentation

- **Phase 2 Requirements**: `.kiro/specs/phase-2-core-contracts/requirements.md`
- **Phase 3 Requirements**: `.kiro/specs/phase-3-physical-extraction/requirements.md`
- **Phase 3 Design**: `.kiro/specs/phase-3-physical-extraction/design.md`
- **Phase 3 Tasks**: `.kiro/specs/phase-3-physical-extraction/tasks.md`

### Code Examples

Look at these completed migrations for reference:

1. **Auth Service**: `src/core/services/auth/`
2. **Order Service**: `src/core/services/order/`
3. **Spa Module Adapter**: `src/modules/spa/adapters/SpaModuleAdapter.ts`
4. **API Routes**: `src/app/api/orders/route.ts`
5. **React Components**: `src/modules/spa/components/`

### Getting Help

- **Slack Channel**: `#phase-3-migration`
- **Migration Support**: Tag `@dev-team` in Slack
- **Technical Lead**: Contact the Phase 3 technical lead for guidance

---

## Conclusion

Phase 3 migration transforms Bella ERP from a monolithic spa application to a modular, multi-industry platform. While the changes are extensive, they follow clear patterns and maintain backward compatibility.

**Key Takeaways**:

1. **TenantContext is mandatory**: All service functions now require `TenantContext` as first parameter
2. **Tenant isolation is critical**: Always filter database queries by `tenant_id`
3. **Module adapters enable extensibility**: Spa-specific logic moves to `SpaModuleAdapter`
4. **Import paths changed**: Update all imports to use `@/core/` or `@/modules/spa/`
5. **Tests need mock context**: Use `createMockTenantContext()` in all tests

**Migration Timeline**:

- **Week 1**: Update imports and service function signatures
- **Week 2**: Update React components and API routes
- **Week 3**: Update tests and verify functionality
- **Week 4**: Code review and production deployment

**Success Criteria**:

✅ All TypeScript compilation errors resolved  
✅ All 1304+ tests passing  
✅ Manual testing confirms zero regression  
✅ Code review approved by technical lead  

Good luck with your migration! 🚀

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active
