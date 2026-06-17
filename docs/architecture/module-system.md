# Module System Architecture

**Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active

---

## Table of Contents

- [Overview](#overview)
- [Architecture Pattern](#architecture-pattern)
- [Module Adapter Interface](#module-adapter-interface)
- [Module Registry](#module-registry)
- [Creating a Module Adapter](#creating-a-module-adapter)
- [Registering an Adapter](#registering-an-adapter)
- [Using Adapters in Core Services](#using-adapters-in-core-services)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Bella ERP module system enables industry-specific behavior through the **adapter pattern**, allowing the core platform to remain industry-neutral while supporting multiple verticals (spa, cleaning, home-service, etc.).

### Key Benefits

- **Zero Core Dependencies**: Core platform code never imports module-specific code
- **Dynamic Module Loading**: Modules register adapters at runtime via the module registry
- **Type Safety**: All adapter methods use core contract types (CoreBookingOrder, CoreServiceCatalogItem)
- **Graceful Degradation**: Core services work without adapters (default behavior)
- **Easy Extension**: New modules can be added without modifying core platform code

### When to Use Module Adapters

Use module adapters when you need to:


- Validate module-specific business rules (e.g., KTV availability in spa module)
- Apply dynamic pricing (e.g., member discounts, package promotions)
- Transform generic core types to module-specific types with strongly-typed metadata
- Execute side effects after order completion (e.g., update salary, deduct inventory)
- Provide module-specific dashboard widgets

---

## Architecture Pattern

```
┌─────────────────────────────────────────────────────────┐
│                   Core Platform                         │
│  (src/core/)                                            │
│                                                         │
│  ┌──────────────┐         ┌──────────────┐            │
│  │  Services    │────────>│   Registry   │            │
│  │              │         │              │            │
│  │ • createOrder│         │ get(moduleId)│            │
│  │ • payment    │         │ register()   │            │
│  └──────────────┘         └──────────────┘            │
│                                  │                      │
└──────────────────────────────────│──────────────────────┘
                                   │
                     ModuleAdapter interface
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────┐
│              Industry Modules (src/modules/)             │
│                                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ Spa Module  │  │  Cleaning   │  │ Home Service│    │
│  │             │  │   Module    │  │   Module    │    │
│  │ • Adapter   │  │ • Adapter   │  │ • Adapter   │    │
│  │ • Services  │  │ • Services  │  │ • Services  │    │
│  │ • Types     │  │ • Types     │  │ • Types     │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
│                                                          │
└──────────────────────────────────────────────────────────┘
```


### Flow: Core Service Invokes Module Adapter

1. **User Action**: User submits an order for a spa package
2. **API Route**: Middleware constructs `TenantContext` with `moduleId: 'spa'`
3. **Core Service**: `createOrder()` receives `context` and `orderData`
4. **Registry Lookup**: Service calls `moduleRegistry.get(context.moduleId)`
5. **Adapter Invocation**: Service calls `adapter.validateBookingRules(order, context)`
6. **Validation**: Adapter checks KTV availability, session limits, etc.
7. **Database Write**: If valid, core service creates order in database
8. **Side Effects**: Service calls `adapter.onBookingCompleted(order, context)`
9. **Response**: Core service returns `CoreBookingOrder` to client

---

## Module Adapter Interface

All module adapters implement the `ModuleAdapter` interface from `@/core/types/module-adapter`.

```typescript
export interface ModuleAdapter {
  /** Module identifier (e.g., 'spa', 'cleaning') */
  moduleId: ModuleId;
  
  /** Human-readable module name */
  moduleName: string;
  
  /** Transform core service item to module-specific type */
  transformServiceItem?: (item: CoreServiceCatalogItem) => unknown;
  
  /** Transform core booking order to module-specific type */
  transformBookingOrder?: (order: CoreBookingOrder) => unknown;
  
  /** Validate module-specific booking constraints */
  validateBookingRules?: (order: CoreBookingOrder, context: TenantContext) => Promise<boolean>;
  
  /** Calculate module-specific pricing rules */
  calculatePricing?: (item: CoreServiceCatalogItem, context: TenantContext) => Promise<number>;
  
  /** Execute module-specific side effects when booking completes */
  onBookingCompleted?: (order: CoreBookingOrder, context: TenantContext) => Promise<void>;
  
  /** Return dashboard widget components for this module */
  getModuleWidgets?: () => unknown[];
}
```


**All methods are optional.** Core services handle missing methods gracefully with default behavior.

---

## Module Registry

The module registry (`moduleRegistry`) is a singleton that manages adapter registration and lookup.

### Import Path

```typescript
import { moduleRegistry } from '@/core/adapters';
```

### Registry API

#### `register(adapter: ModuleAdapter): void`

Register a module adapter. Throws `DuplicateModuleError` if adapter with same `moduleId` already registered.

**Example:**

```typescript
import { moduleRegistry } from '@/core/adapters';
import { SpaModuleAdapter } from '@/modules/spa/adapters/SpaModuleAdapter';

const spaAdapter = new SpaModuleAdapter();
moduleRegistry.register(spaAdapter);
// Console: [ModuleRegistry] Registered adapter: Bella Spa & Babycare (spa)
```

#### `get(moduleId: ModuleId): ModuleAdapter | undefined`

Retrieve an adapter by ID (graceful). Returns `undefined` if not found.

**Use this when the adapter is optional.**

**Example:**

```typescript
const adapter = moduleRegistry.get('spa');
if (adapter?.validateBookingRules) {
  const isValid = await adapter.validateBookingRules(order, context);
}
```


#### `getRequired(moduleId: ModuleId): ModuleAdapter`

Retrieve an adapter by ID (strict). Throws `AdapterNotFoundError` if not found.

**Use this when the adapter MUST exist.**

**Example:**

```typescript
// In module-specific API route
const adapter = moduleRegistry.getRequired('spa');
const pricing = await adapter.calculatePricing(item, context);
```

#### `has(moduleId: ModuleId): boolean`

Check if an adapter is registered.

**Example:**

```typescript
if (moduleRegistry.has('spa')) {
  // Show spa-specific UI features
}
```

#### `getAllModuleIds(): ModuleId[]`

Get all registered module IDs.

**Example:**

```typescript
const modules = moduleRegistry.getAllModuleIds();
console.log('Available modules:', modules);
// Output: ['spa', 'cleaning']
```

---

## Creating a Module Adapter

Follow these steps to create a new module adapter for your industry vertical.

### Step 1: Create Module Directory Structure


```
src/modules/your-module/
├── adapters/
│   └── YourModuleAdapter.ts
├── types/
│   ├── index.ts
│   ├── booking.ts
│   └── package.ts
├── services/
│   └── yourService.ts
├── components/
│   └── YourComponent.tsx
└── README.md
```

### Step 2: Define Module-Specific Types

Create types that extend core contracts with module-specific metadata.

**Example: `src/modules/cleaning/types/booking.ts`**

```typescript
import type { CoreBookingOrder } from '@/core/types';

/**
 * Cleaning module booking with cleaning-specific fields.
 */
export interface CleaningBooking extends CoreBookingOrder {
  // Extract metadata to strongly-typed fields
  squareMeters: number;
  cleaningType: 'basic' | 'deep' | 'move-out';
  teamSize: number;
  estimatedHours: number;
  assignedTeamLeaderId: string;
}
```

### Step 3: Implement ModuleAdapter Interface

Create your adapter class implementing the `ModuleAdapter` interface.

**Example: `src/modules/cleaning/adapters/CleaningModuleAdapter.ts`**


```typescript
import type {
  ModuleAdapter,
  CoreServiceCatalogItem,
  CoreBookingOrder,
  TenantContext,
} from '@/core/types';
import type { CleaningBooking, CleaningPackage } from '../types';

export class CleaningModuleAdapter implements ModuleAdapter {
  readonly moduleId = 'cleaning' as const;
  readonly moduleName = 'Cleaning Services';

  /**
   * Transform core service item to cleaning package type.
   */
  transformServiceItem(item: CoreServiceCatalogItem): CleaningPackage {
    return {
      id: item.id,
      name: item.name,
      basePrice: item.basePrice,
      cleaningType: item.metadata.cleaning_type as 'basic' | 'deep' | 'move-out',
      pricePerSquareMeter: item.metadata.price_per_sqm as number,
      estimatedHours: item.metadata.estimated_hours as number,
    };
  }

  /**
   * Transform core booking order to cleaning booking type.
   */
  transformBookingOrder(order: CoreBookingOrder): CleaningBooking {
    return {
      ...order,
      squareMeters: order.metadata.square_meters as number,
      cleaningType: order.metadata.cleaning_type as 'basic' | 'deep' | 'move-out',
      teamSize: order.metadata.team_size as number,
      estimatedHours: order.metadata.estimated_hours as number,
      assignedTeamLeaderId: order.metadata.assigned_team_leader_id as string,
    };
  }


  /**
   * Validate cleaning-specific booking rules.
   */
  async validateBookingRules(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    // Check team leader availability
    const teamLeaderId = order.metadata.assigned_team_leader_id as string;
    if (!teamLeaderId) {
      console.error('[CleaningAdapter] Team leader not assigned');
      return false;
    }

    // Check team capacity for scheduled date
    const scheduledDate = new Date(order.scheduledStartTime);
    const teamCapacity = await this.checkTeamCapacity(scheduledDate, context.tenantId);
    if (teamCapacity === 0) {
      console.error('[CleaningAdapter] No team capacity available');
      return false;
    }

    // Validate square meters
    const squareMeters = order.metadata.square_meters as number;
    if (!squareMeters || squareMeters <= 0) {
      console.error('[CleaningAdapter] Invalid square meters');
      return false;
    }

    return true;
  }

  /**
   * Calculate cleaning-specific pricing based on square meters.
   */
  async calculatePricing(
    item: CoreServiceCatalogItem,
    context: TenantContext
  ): Promise<number> {
    const pricePerSqm = item.metadata.price_per_sqm as number;
    const squareMeters = context.settings.default_square_meters as number || 50;
    
    let totalPrice = item.basePrice + (pricePerSqm * squareMeters);

    // Apply member discount if applicable
    if (context.settings.membershipLevel === 'premium') {
      totalPrice *= 0.9; // 10% discount
    }

    return Math.round(totalPrice);
  }


  /**
   * Execute side effects when cleaning job completes.
   */
  async onBookingCompleted(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<void> {
    console.log(`[CleaningAdapter] Booking ${order.id} completed`);

    // Credit team member salaries
    const teamLeaderId = order.metadata.assigned_team_leader_id as string;
    const teamSize = order.metadata.team_size as number;
    await this.creditTeamSalary(teamLeaderId, teamSize, order.totalAmount);

    // Update inventory (cleaning supplies used)
    const suppliesUsed = order.metadata.supplies_used as Record<string, number>;
    if (suppliesUsed) {
      await this.deductSupplies(suppliesUsed, context.tenantId);
    }

    // Send completion notification to customer
    // (handled by core notification service)
  }

  /**
   * Return cleaning-specific dashboard widgets.
   */
  getModuleWidgets() {
    return [
      { id: 'cleaning-jobs-today', component: 'CleaningJobsWidget' },
      { id: 'team-performance', component: 'TeamPerformanceWidget' },
      { id: 'revenue-by-type', component: 'RevenueByTypeWidget' },
    ];
  }

  // Private helper methods
  private async checkTeamCapacity(date: Date, tenantId: string): Promise<number> {
    // Implementation: Query team availability
    return 5; // Example: 5 teams available
  }

  private async creditTeamSalary(leaderId: string, teamSize: number, amount: number): Promise<void> {
    // Implementation: Credit salary to team members
  }

  private async deductSupplies(supplies: Record<string, number>, tenantId: string): Promise<void> {
    // Implementation: Deduct inventory
  }
}
```


### Step 4: Export Adapter

**Example: `src/modules/cleaning/adapters/index.ts`**

```typescript
export { CleaningModuleAdapter } from './CleaningModuleAdapter';
```

---

## Registering an Adapter

Module adapters must be registered during application startup.

### Step 1: Create Module Registration File

**Example: `src/modules/cleaning/register.ts`**

```typescript
import { moduleRegistry } from '@/core/adapters';
import { CleaningModuleAdapter } from './adapters';

/**
 * Register the cleaning module adapter on app startup.
 * 
 * @remarks
 * This function should be called once during application initialization,
 * typically in the root layout or app entry point.
 */
export function registerCleaningModule(): void {
  const adapter = new CleaningModuleAdapter();
  moduleRegistry.register(adapter);
}
```

### Step 2: Call Registration in App Entry Point

**Example: `src/app/layout.tsx` (Next.js App Router)**

```typescript
import { registerCleaningModule } from '@/modules/cleaning/register';
import { registerSpaModule } from '@/modules/spa/register';

// Register all enabled modules on app startup
registerSpaModule();
registerCleaningModule();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```


**Alternative: `src/pages/_app.tsx` (Next.js Pages Router)**

```typescript
import { AppProps } from 'next/app';
import { registerCleaningModule } from '@/modules/cleaning/register';
import { registerSpaModule } from '@/modules/spa/register';

// Register modules once
registerSpaModule();
registerCleaningModule();

export default function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}
```

### Verification

After registration, you should see console logs:

```
[ModuleRegistry] Registered adapter: Bella Spa & Babycare (spa)
[ModuleRegistry] Registered adapter: Cleaning Services (cleaning)
```

---

## Using Adapters in Core Services

Core services invoke adapters via the module registry. All adapter methods are optional.

### Pattern 1: Graceful Invocation (Preferred)

Use `get()` when the adapter is optional. Provide fallback behavior.

**Example: Core Order Service**

```typescript
import { moduleRegistry } from '@/core/adapters';
import type { TenantContext, CoreBookingOrder } from '@/core/types';

export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  // Invoke adapter for validation (optional)
  const adapter = moduleRegistry.get(context.moduleId);
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
  const order = await db.insert('bookings').values(orderData).returning();

  return order;
}
```

### Pattern 2: Strict Invocation

Use `getRequired()` when the adapter MUST exist.

**Example: Module-Specific API Route**

```typescript
import { moduleRegistry } from '@/core/adapters';
import type { TenantContext } from '@/core/types';

export async function POST(request: Request) {
  const context: TenantContext = extractTenantContext(request);
  
  // This route requires the spa module adapter
  const adapter = moduleRegistry.getRequired('spa');
  
  const packageData = await request.json();
  const pricing = await adapter.calculatePricing(packageData, context);
  
  return Response.json({ pricing });
}
```

### Pattern 3: Conditional Feature Rendering

Use `has()` to check if a module is available before rendering UI.

**Example: Dashboard Component**

```typescript
'use client';

import { moduleRegistry } from '@/core/adapters';
import { useTenantContext } from '@/core/hooks';

export function Dashboard() {
  const context = useTenantContext();
  const hasSpaModule = moduleRegistry.has('spa');
  const hasCleaningModule = moduleRegistry.has('cleaning');
  
  return (
    <div>
      <h1>Dashboard</h1>
      {hasSpaModule && <SpaWidgets />}
      {hasCleaningModule && <CleaningWidgets />}
    </div>
  );
}
```

### Pattern 4: Side Effects After Order Completion

**Example: Core Order Completion Service**

```typescript
export async function completeOrder(
  context: TenantContext,
  orderId: string
): Promise<CoreBookingOrder> {
  // Update order status
  const order = await db
    .update('bookings')
    .set({ status: 'completed', completedAt: new Date() })
    .where({ id: orderId })
    .returning();

  // Invoke module adapter for side effects (optional)
  const adapter = moduleRegistry.get(context.moduleId);
  if (adapter?.onBookingCompleted) {
    await adapter.onBookingCompleted(order, context);
  }

  // Send completion notification (core service)
  await sendNotification({
    type: 'booking_completed',
    recipientId: order.customerId,
    data: { orderId: order.id },
  });

  return order;
}
```

---

## Best Practices

### 1. Keep Adapters Stateless

Module adapters should NOT store state. They are instantiated once and reused across requests.

**❌ Bad:**

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  private currentBooking: CoreBookingOrder | null = null; // Don't do this!
  
  async validateBookingRules(order: CoreBookingOrder) {
    this.currentBooking = order; // State mutation across requests!
    // ...
  }
}
```

**✅ Good:**

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async validateBookingRules(order: CoreBookingOrder, context: TenantContext) {
    // Use parameters, not instance state
    const ktvId = order.metadata.assigned_ktv_id;
    // ...
  }
}
```

### 2. Use Core Services for Data Access

Adapters should NOT directly query the database. Use core services instead.

**❌ Bad:**

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async validateBookingRules(order: CoreBookingOrder) {
    // Don't query database directly!
    const { data } = await supabase
      .from('employees')
      .select('*')
      .eq('id', ktvId);
    // ...
  }
}
```

**✅ Good:**

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async validateBookingRules(order: CoreBookingOrder, context: TenantContext) {
    // Use core service or module service
    const ktv = await getEmployeeById(ktvId, context);
    // ...
  }
}
```

### 3. Validate Input Parameters

Always validate adapter method inputs before processing.

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async validateBookingRules(order: CoreBookingOrder, context: TenantContext): Promise<boolean> {
    // Validate required metadata exists
    if (!order.metadata?.assigned_ktv_id) {
      console.error('[SpaAdapter] Missing required field: assigned_ktv_id');
      return false;
    }
    
    if (!order.metadata?.sessions_total) {
      console.error('[SpaAdapter] Missing required field: sessions_total');
      return false;
    }
    
    // Proceed with validation
    // ...
  }
}
```

### 4. Use Descriptive Console Logs

Prefix adapter logs with module ID for easier debugging.

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async onBookingCompleted(order: CoreBookingOrder, context: TenantContext): Promise<void> {
    console.log(`[SpaAdapter] Processing completion for order ${order.id}`);
    
    try {
      await this.creditKtvSalary(order);
      console.log(`[SpaAdapter] KTV salary credited for order ${order.id}`);
    } catch (error) {
      console.error(`[SpaAdapter] Failed to credit salary:`, error);
      // Don't throw - log and continue
    }
  }
}
```

### 5. Handle Errors Gracefully

Adapter methods should catch and log errors, not throw them (except for critical failures).

**❌ Bad:**

```typescript
async onBookingCompleted(order: CoreBookingOrder) {
  await this.creditSalary(order); // Throws on error - breaks order completion!
}
```

**✅ Good:**

```typescript
async onBookingCompleted(order: CoreBookingOrder, context: TenantContext) {
  try {
    await this.creditSalary(order);
  } catch (error) {
    console.error('[SpaAdapter] Salary credit failed, will retry later:', error);
    // Queue for retry or send alert
  }
}
```

### 6. Type Metadata Safely

Use type guards when extracting metadata fields.

```typescript
function isValidKtvId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export class SpaModuleAdapter implements ModuleAdapter {
  transformBookingOrder(order: CoreBookingOrder): SpaBooking {
    const ktvId = order.metadata.assigned_ktv_id;
    
    if (!isValidKtvId(ktvId)) {
      throw new Error('Invalid KTV ID in order metadata');
    }
    
    return {
      ...order,
      assignedKtvId: ktvId, // Now safely typed as string
    };
  }
}
```

### 7. Document Module-Specific Metadata Schema

Document the expected metadata schema for your module.

```typescript
/**
 * Spa Module Adapter
 * 
 * **Required Metadata Fields:**
 * - `assigned_ktv_id` (string): ID of assigned KTV employee
 * - `sessions_total` (number): Total sessions in package
 * - `sessions_completed` (number): Number of sessions completed
 * - `package_category` ('basic' | 'premium' | 'vip'): Package tier
 * 
 * **Optional Metadata Fields:**
 * - `session_multiplier` (number): Session coefficient (default: 1.0)
 * - `products_used` (Record<string, number>): Products consumed during session
 */
export class SpaModuleAdapter implements ModuleAdapter {
  // ...
}
```

---

## Common Patterns

### Pattern: Dynamic Pricing with Tiered Discounts

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async calculatePricing(
    item: CoreServiceCatalogItem,
    context: TenantContext
  ): Promise<number> {
    let price = item.basePrice;
    
    // Apply subscription-tier discount
    const discountRate = this.getDiscountRate(context.subscriptionPlan);
    price *= (1 - discountRate);
    
    // Apply membership-level discount
    const memberLevel = context.settings.membershipLevel as string;
    if (memberLevel === 'gold') {
      price *= 0.9; // 10% discount
    } else if (memberLevel === 'platinum') {
      price *= 0.85; // 15% discount
    }
    
    // Apply package category discount
    const category = item.metadata.category as string;
    if (category === 'vip') {
      price *= 0.9; // Additional 10% for VIP packages
    }
    
    return Math.round(price);
  }
  
  private getDiscountRate(plan: string): number {
    switch (plan) {
      case 'enterprise': return 0.15;
      case 'professional': return 0.10;
      case 'starter': return 0.05;
      default: return 0;
    }
  }
}
```

### Pattern: Multi-Step Validation

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async validateBookingRules(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    // Step 1: Validate required fields
    if (!this.validateRequiredFields(order)) {
      return false;
    }
    
    // Step 2: Check resource availability
    if (!await this.checkResourceAvailability(order, context)) {
      return false;
    }
    
    // Step 3: Validate business constraints
    if (!await this.validateBusinessConstraints(order, context)) {
      return false;
    }
    
    return true;
  }
  
  private validateRequiredFields(order: CoreBookingOrder): boolean {
    const required = ['assigned_ktv_id', 'sessions_total', 'package_category'];
    for (const field of required) {
      if (!order.metadata[field]) {
        console.error(`[SpaAdapter] Missing required field: ${field}`);
        return false;
      }
    }
    return true;
  }
  
  private async checkResourceAvailability(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    const ktvId = order.metadata.assigned_ktv_id as string;
    const scheduledTime = new Date(order.scheduledStartTime);
    
    // Check if KTV is available at scheduled time
    const isAvailable = await checkKtvAvailability(ktvId, scheduledTime, context.tenantId);
    if (!isAvailable) {
      console.error('[SpaAdapter] KTV not available at scheduled time');
      return false;
    }
    
    return true;
  }
  
  private async validateBusinessConstraints(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    // Check session limits
    const completed = order.metadata.sessions_completed as number || 0;
    const total = order.metadata.sessions_total as number;
    
    if (completed >= total) {
      console.error('[SpaAdapter] All sessions already completed');
      return false;
    }
    
    return true;
  }
}
```

### Pattern: Batch Side Effects

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  async onBookingCompleted(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<void> {
    console.log(`[SpaAdapter] Processing completion for order ${order.id}`);
    
    // Execute side effects in parallel
    const results = await Promise.allSettled([
      this.creditKtvSalary(order, context),
      this.deductInventory(order, context),
      this.updateKtvPerformance(order, context),
      this.awardLoyaltyPoints(order, context),
    ]);
    
    // Log any failures (don't throw - order is already completed)
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const operations = ['salary', 'inventory', 'performance', 'loyalty'];
        console.error(`[SpaAdapter] ${operations[index]} operation failed:`, result.reason);
      }
    });
  }
  
  private async creditKtvSalary(order: CoreBookingOrder, context: TenantContext): Promise<void> {
    // Implementation
  }
  
  private async deductInventory(order: CoreBookingOrder, context: TenantContext): Promise<void> {
    // Implementation
  }
  
  private async updateKtvPerformance(order: CoreBookingOrder, context: TenantContext): Promise<void> {
    // Implementation
  }
  
  private async awardLoyaltyPoints(order: CoreBookingOrder, context: TenantContext): Promise<void> {
    // Implementation
  }
}
```

### Pattern: Module-Specific Dashboard Widgets

```typescript
export class SpaModuleAdapter implements ModuleAdapter {
  getModuleWidgets() {
    return [
      {
        id: 'spa-revenue-chart',
        component: 'SpaRevenueChart',
        title: 'Spa Revenue Trends',
        description: 'Monthly revenue breakdown by package category',
        size: 'large',
        refreshInterval: 300, // seconds
      },
      {
        id: 'ktv-leaderboard',
        component: 'KtvLeaderboard',
        title: 'Top Performing KTVs',
        description: 'KTV performance ranking for current month',
        size: 'medium',
        refreshInterval: 60,
      },
      {
        id: 'session-completion-rate',
        component: 'SessionCompletionWidget',
        title: 'Session Completion Rate',
        description: 'Percentage of scheduled sessions completed on time',
        size: 'small',
        refreshInterval: 120,
      },
    ];
  }
}
```

---

## Troubleshooting

### Problem: Adapter Not Found Error

**Error Message:**

```
Error: Module adapter not found: spa
```

**Cause:** Adapter not registered or registration failed.

**Solution:**

1. Check that registration function is called in app entry point:

```typescript
// src/app/layout.tsx or src/pages/_app.tsx
import { registerSpaModule } from '@/modules/spa/register';

registerSpaModule(); // Must be called before rendering
```

2. Check console for registration logs:

```
[ModuleRegistry] Registered adapter: Bella Spa & Babycare (spa)
```

3. If no log appears, check for registration errors:

```typescript
export function registerSpaModule(): void {
  try {
    const adapter = new SpaModuleAdapter();
    moduleRegistry.register(adapter);
  } catch (error) {
    console.error('[SpaModule] Registration failed:', error);
    throw error;
  }
}
```

### Problem: Duplicate Module Error

**Error Message:**

```
Error: Module adapter already registered: spa
```

**Cause:** Registration function called multiple times.

**Solution:**

Use a guard to prevent duplicate registration:

```typescript
let registered = false;

export function registerSpaModule(): void {
  if (registered) {
    console.warn('[SpaModule] Already registered, skipping');
    return;
  }
  
  const adapter = new SpaModuleAdapter();
  moduleRegistry.register(adapter);
  registered = true;
}
```

### Problem: Metadata Fields Undefined

**Symptom:** `order.metadata.assigned_ktv_id` returns `undefined` even though data exists in database.

**Cause:** Metadata not loaded from database query.

**Solution:**

Ensure database queries select the `metadata` field:

```typescript
// ❌ Bad: metadata not selected
const order = await db
  .select('id', 'customer_id', 'status')
  .from('bookings')
  .where({ id: orderId })
  .single();

// ✅ Good: metadata included
const order = await db
  .select('*') // or explicitly list 'metadata'
  .from('bookings')
  .where({ id: orderId })
  .single();
```

### Problem: Type Errors with Metadata

**Error Message:**

```
Property 'assigned_ktv_id' does not exist on type 'Record<string, unknown>'
```

**Cause:** Metadata is typed as generic `Record<string, unknown>`.

**Solution:**

Use type assertions or type guards:

```typescript
// Option 1: Type assertion
const ktvId = order.metadata.assigned_ktv_id as string;

// Option 2: Type guard (safer)
function hasKtvId(metadata: Record<string, unknown>): metadata is { assigned_ktv_id: string } {
  return typeof metadata.assigned_ktv_id === 'string';
}

if (hasKtvId(order.metadata)) {
  const ktvId = order.metadata.assigned_ktv_id; // Type: string
}
```

### Problem: Adapter Methods Not Called

**Symptom:** Adapter registered successfully but methods never execute.

**Cause:** Core service not invoking adapter methods.

**Solution:**

1. Check that core service looks up adapter:

```typescript
const adapter = moduleRegistry.get(context.moduleId);
```

2. Check that adapter method exists:

```typescript
if (adapter?.validateBookingRules) {
  await adapter.validateBookingRules(order, context);
}
```

3. Add debug logging:

```typescript
const adapter = moduleRegistry.get(context.moduleId);
console.log('[CoreService] Adapter found:', !!adapter);
console.log('[CoreService] Has validateBookingRules:', !!adapter?.validateBookingRules);
```

### Problem: Performance Degradation

**Symptom:** API requests slow after adding adapter.

**Cause:** Adapter performing expensive operations synchronously.

**Solution:**

1. Profile adapter methods to identify bottlenecks:

```typescript
async validateBookingRules(order: CoreBookingOrder, context: TenantContext): Promise<boolean> {
  const startTime = Date.now();
  
  // Your validation logic
  const result = await this.performValidation(order, context);
  
  const duration = Date.now() - startTime;
  if (duration > 100) {
    console.warn(`[SpaAdapter] Validation took ${duration}ms (threshold: 100ms)`);
  }
  
  return result;
}
```

2. Optimize database queries (use indexes, reduce joins).

3. Cache frequently accessed data (use Redis or in-memory cache).

4. Make adapter methods async and parallel where possible.

### Problem: Adapter Side Effects Not Executing

**Symptom:** `onBookingCompleted` called but side effects not happening.

**Cause:** Errors swallowed silently or promises not awaited.

**Solution:**

Add proper error handling and logging:

```typescript
async onBookingCompleted(order: CoreBookingOrder, context: TenantContext): Promise<void> {
  console.log(`[SpaAdapter] Starting side effects for order ${order.id}`);
  
  try {
    await this.creditKtvSalary(order);
    console.log(`[SpaAdapter] ✓ Salary credited`);
  } catch (error) {
    console.error(`[SpaAdapter] ✗ Salary credit failed:`, error);
  }
  
  try {
    await this.deductInventory(order);
    console.log(`[SpaAdapter] ✓ Inventory deducted`);
  } catch (error) {
    console.error(`[SpaAdapter] ✗ Inventory deduction failed:`, error);
  }
  
  console.log(`[SpaAdapter] Finished side effects for order ${order.id}`);
}
```

---

## Related Documentation

- [Core Platform Architecture](./core-platform.md)
- [Tenant Context System](./tenant-context.md)
- [Phase 3 Migration Guide](../migration/phase-3-migration-guide.md)
- [API Reference](../api-reference.md)

---

**Document Version**: 1.1  
**Last Updated**: 2025-06-01  
**Status**: Complete

