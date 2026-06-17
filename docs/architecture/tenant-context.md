# Tenant Context Architecture

**Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active

---

## Table of Contents

- [Overview](#overview)
- [TenantContext Interface](#tenantcontext-interface)
- [How Tenant Configuration is Loaded](#how-tenant-configuration-is-loaded)
- [Tenant Configuration Caching](#tenant-configuration-caching)
- [Tenant Isolation & Security](#tenant-isolation--security)
- [Using TenantContext in Code](#using-tenantcontext-in-code)
- [Tenant-Specific Feature Flags](#tenant-specific-feature-flags)
- [Best Practices](#best-practices)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Bella ERP platform is designed as a **multi-tenant SaaS application** where each tenant (spa branch, cleaning company, home service provider) operates in isolation with their own configuration, data, and feature entitlements.

**TenantContext** is the core abstraction that encapsulates tenant-specific configuration and makes it available throughout the application without requiring repeated database queries.

### Key Benefits

- **Single Source of Truth**: Tenant configuration loaded once per request and passed to all services
- **Type Safety**: Strong TypeScript typing prevents invalid configuration access
- **Performance**: Configuration cached in memory and Redis to minimize database queries
- **Security**: Enforces tenant isolation at the data access layer
- **Flexibility**: Supports per-tenant feature flags, settings, and module enablement
- **Immutability**: Read-only after construction to prevent accidental mutations

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Request                           │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              Authentication Middleware                       │
│  • Validates user session (Supabase Auth)                   │
│  • Extracts user ID from session                            │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│           Tenant Context Middleware                          │
│  • Queries user's tenant_id from users table                │
│  • Fetches tenant configuration from tenants table          │
│  • Constructs TenantContext object                          │
│  • Attaches context to request object                       │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                 API Route Handler                            │
│  • Receives request with TenantContext                      │
│  • Passes context to core services                          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Core Services                               │
│  • Accept TenantContext as first parameter                  │
│  • Use tenantId for data filtering                          │
│  • Check feature flags before executing features            │
│  • Use settings for tenant-specific business logic          │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   Database Query                             │
│  • All queries filter by tenantId                           │
│  • RLS policies enforce tenant isolation                    │
└─────────────────────────────────────────────────────────────┘
```

---

## TenantContext Interface

The `TenantContext` interface is defined in `src/core/types/tenant.ts` and represents the complete configuration for a single tenant.

### Type Definition

```typescript
import type { ModuleId } from './module';

export type SubscriptionPlan = 'free' | 'basic' | 'professional' | 'enterprise';

export interface TenantContext {
  /** Unique tenant identifier (UUID from tenants table) */
  readonly tenantId: string;
  
  /** Human-readable tenant name for display purposes */
  readonly tenantName: string;
  
  /** List of enabled industry modules for this tenant */
  readonly enabledModules: readonly ModuleId[];
  
  /** Current subscription plan tier */
  readonly subscriptionPlan: SubscriptionPlan;
  
  /** Feature flags controlling optional functionality */
  readonly featureFlags: Readonly<Record<string, boolean>>;
  
  /** Tenant-specific configuration settings */
  readonly settings: Readonly<Record<string, any>>;
}
```

### Field Descriptions

#### `tenantId: string`

Unique identifier for the tenant (UUID). This is the primary key from the `tenants` table and is used for:
- Filtering all database queries to ensure tenant isolation
- Constructing cache keys for tenant-specific data
- Audit logging and tracking

**Example**: `"550e8400-e29b-41d4-a716-446655440000"`

#### `tenantName: string`

Human-readable name for the tenant, used for display in UI components.

**Examples**:
- `"Bella Spa Hà Nội"`
- `"Clean & Shine Services"`
- `"HomeCare Pro Đà Nẵng"`

#### `enabledModules: readonly ModuleId[]`

Array of enabled industry modules for this tenant. Modules are enabled/disabled based on the tenant's subscription plan and purchased add-ons.

**Common Module IDs**:
- `'spa'` - Spa & babycare management module
- `'cleaning'` - Cleaning services module (Phase 4+)
- `'homecare'` - Home service module (Phase 4+)

**Example**:
```typescript
enabledModules: ['spa']  // Single-module tenant
enabledModules: ['spa', 'cleaning']  // Multi-module tenant
```


#### `subscriptionPlan: SubscriptionPlan`

Current subscription tier that determines feature access and quotas.

**Plan Tiers**:
- `'free'` - Limited features, single user, demo data, suitable for trial
- `'basic'` - Core features, up to 5 users, single branch
- `'professional'` - Advanced features, up to 20 users, API access, multi-branch
- `'enterprise'` - All features, unlimited users, dedicated support, custom integrations

**Example**:
```typescript
subscriptionPlan: 'professional'
```

#### `featureFlags: Record<string, boolean>`

Feature flags control optional functionality that can be enabled/disabled per tenant. This allows gradual rollout of features, A/B testing, and premium feature gating.

**Common Feature Flags**:
- `ai_salary_reconciliation` - AI-powered salary calculation validation
- `inventory_transfer` - Multi-branch inventory transfer
- `meta_ads_integration` - Facebook/Instagram ads integration
- `advanced_analytics` - Business intelligence dashboards
- `api_access` - RESTful API access for integrations

**Example**:
```typescript
featureFlags: {
  'ai_salary_reconciliation': true,
  'inventory_transfer': true,
  'meta_ads_integration': false,
  'advanced_analytics': true,
}
```

#### `settings: Record<string, any>`

Tenant-specific configuration that doesn't fit in other fields. Settings are stored as flexible key-value pairs to accommodate diverse tenant needs.

**Common Settings Categories**:

1. **Localization**:
   - `currency: string` - ISO 4217 code (e.g., `'VND'`, `'USD'`)
   - `timezone: string` - IANA timezone (e.g., `'Asia/Ho_Chi_Minh'`)
   - `locale: string` - Language code (e.g., `'vi-VN'`, `'en-US'`)
   - `dateFormat: string` - Date format (e.g., `'DD/MM/YYYY'`)

2. **Branding**:
   - `logoUrl: string` - Tenant logo URL
   - `primaryColor: string` - Brand primary color
   - `companyName: string` - Legal company name

3. **Operational**:
   - `autoApprovalThreshold: number` - Auto-approve payments below this amount
   - `inventoryAlertThreshold: number` - Stock level to trigger alerts
   - `defaultTaxRate: number` - Default tax rate for invoices
   - `businessHours: object` - Operating hours configuration

4. **Payment & Banking**:
   - `qrPayment: object` - QR code payment configuration
   - `bankAccounts: array` - Bank account details

5. **Module-Specific**:
   - `salaryConfig: object` - Salary calculation parameters (spa module)
   - `sessionDuration: number` - Default session duration in minutes (spa module)
   - `cleaningRates: object` - Pricing per square meter (cleaning module)

**Example**:
```typescript
settings: {
  currency: 'VND',
  timezone: 'Asia/Ho_Chi_Minh',
  locale: 'vi-VN',
  companyName: 'Công ty TNHH Bella Spa',
  logoUrl: 'https://cdn.example.com/logos/bella-spa.png',
  primaryColor: '#4F46E5',
  autoApprovalThreshold: 500000,
  qrPayment: {
    bankCode: 'VCB',
    accountNumber: '1234567890',
    accountName: 'CONG TY BELLA SPA',
  },
}
```

### Type Guard

Use `isTenantContext()` to validate TenantContext structure at runtime:

```typescript
import { isTenantContext } from '@/core/types/tenant';

if (isTenantContext(req.context)) {
  // TypeScript now knows req.context is TenantContext
  console.log(req.context.tenantId);
}
```

---

## How Tenant Configuration is Loaded


Tenant configuration is loaded differently depending on the execution context (server-side API routes vs. client-side React components).

### Server-Side Loading (API Routes)

API routes use the `withTenantContext` middleware from `@/core/middleware/tenantContext` to automatically extract and attach tenant context to requests.

**Implementation Flow**:

1. **User Authentication**: Supabase Auth validates the user session
2. **User Profile Lookup**: Query `users` table to get `tenant_id` for authenticated user
3. **Tenant Configuration Fetch**: Query `tenants` table with the `tenant_id`
4. **Context Construction**: Transform database row to `TenantContext` object
5. **Attachment**: Attach context to `request.tenantContext`

**Example Usage**:

```typescript
// src/app/api/bookings/route.ts
import { withTenantContext, type NextRequestWithContext } from '@/core/middleware';
import { createOrder } from '@/core/services/order';

export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext;
  const orderData = await request.json();
  
  // Pass context to service
  const order = await createOrder(context, orderData);
  
  return Response.json(order);
});
```

**Error Handling**:

The middleware returns appropriate HTTP status codes:
- `401 Unauthorized` - User not authenticated
- `403 Forbidden` - User has no tenant assigned
- `404 Not Found` - Tenant not found in database
- `500 Internal Server Error` - Database query failed

### Client-Side Loading (React Components)

React components use the `TenantContextProvider` and `useTenantContext` hook to access tenant configuration.

**Implementation Flow**:

1. **Provider Mount**: `TenantContextProvider` mounts in root layout
2. **API Call**: Provider calls `/api/tenant/context` endpoint
3. **Loading State**: Displays loading spinner while fetching
4. **Context Storage**: Stores context in React Context
5. **Hook Access**: Child components use `useTenantContext()` hook


**Example Usage**:

```typescript
// src/app/layout.tsx
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

```typescript
// src/components/Dashboard.tsx
'use client';

import { useTenantContext } from '@/core/hooks';

export function Dashboard() {
  const context = useTenantContext();
  
  return (
    <div>
      <h1>Welcome to {context.tenantName}</h1>
      <p>Plan: {context.subscriptionPlan}</p>
      <p>Modules: {context.enabledModules.join(', ')}</p>
    </div>
  );
}
```

**Error Handling**:

The provider displays user-friendly error screens:
- **Loading State**: Shows spinner with "Đang tải cấu hình chi nhánh..."
- **Error State**: Shows error message with retry button
- **Success State**: Renders children with context available

---

## Tenant Configuration Caching

To minimize database queries and improve performance, tenant configuration is cached at multiple levels.

### Memory Cache (Module Registry)

Module adapters are registered once at application startup and cached in memory. No repeated database queries required.

**Scope**: Per-application (shared across all requests)  
**Lifetime**: Until application restart  
**Invalidation**: Not needed (configuration changes require redeployment)


### Redis Cache (Recommended for Production)

Tenant configuration can be cached in Redis to reduce database load.

**Implementation Example**:

```typescript
// src/core/lib/tenant-cache.ts
import { Redis } from 'ioredis';
import type { TenantContext } from '@/core/types/tenant';

const redis = new Redis(process.env.REDIS_URL);
const CACHE_TTL = 300; // 5 minutes

export async function getCachedTenantContext(tenantId: string): Promise<TenantContext | null> {
  const cacheKey = `tenant:${tenantId}:context`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached) as TenantContext;
  }
  
  return null;
}

export async function setCachedTenantContext(context: TenantContext): Promise<void> {
  const cacheKey = `tenant:${context.tenantId}:context`;
  await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(context));
}

export async function invalidateTenantCache(tenantId: string): Promise<void> {
  const cacheKey = `tenant:${tenantId}:context`;
  await redis.del(cacheKey);
}
```

**Scope**: Per-tenant (isolated by tenantId)  
**Lifetime**: 5 minutes (configurable)  
**Invalidation**: On tenant configuration update

### Client-Side Cache (React Context)

Once loaded, tenant context is stored in React Context and available to all child components without re-fetching.

**Scope**: Per-user session (browser tab)  
**Lifetime**: Until page reload  
**Invalidation**: Page refresh or logout

### Cache Strategy Recommendations

**Development**:
- Use memory cache only
- No Redis required
- Fast configuration changes

**Production**:
- Use Redis cache with 5-minute TTL
- Memory cache for module registry
- Automatic invalidation on tenant config updates

---

## Tenant Isolation & Security

Tenant isolation is critical for multi-tenant SaaS applications. Bella ERP enforces isolation at multiple layers.


### Layer 1: Authentication

**Mechanism**: Supabase Auth validates user sessions before any tenant context extraction.

**Security Controls**:
- JWT token validation
- Session expiration enforcement
- Refresh token rotation
- Multi-factor authentication support

**Code Example**:

```typescript
const { data: { user }, error } = await supabase.auth.getUser();

if (error || !user) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Layer 2: Tenant Assignment Validation

**Mechanism**: Verify that the authenticated user has a valid tenant assignment.

**Security Controls**:
- Query `users.tenant_id` to confirm assignment
- Reject requests from users without tenant
- Audit log all tenant access attempts

**Code Example**:

```typescript
const { data: userProfile } = await supabase
  .from('users')
  .select('tenant_id')
  .eq('id', user.id)
  .single();

if (!userProfile?.tenant_id) {
  return Response.json({ error: 'Forbidden: No tenant assigned' }, { status: 403 });
}
```

### Layer 3: Database Query Filtering

**Mechanism**: All database queries MUST include `tenantId` filter.

**Security Controls**:
- Mandatory `tenantId` parameter in service functions
- TypeScript enforces `TenantContext` as first parameter
- Code reviews verify tenant filtering

**Code Example**:

```typescript
// ✅ GOOD: Tenant filtering enforced
export async function getOrderById(
  context: TenantContext,
  orderId: string
): Promise<CoreBookingOrder | null> {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', orderId)
    .eq('tenant_id', context.tenantId)  // CRITICAL: Tenant filter
    .single();
  
  return data;
}

// ❌ BAD: No tenant filtering - security vulnerability!
export async function getOrderById(orderId: string) {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', orderId)
    .single();
  
  return data;
}
```


### Layer 4: Row-Level Security (RLS)

**Mechanism**: PostgreSQL Row-Level Security policies enforce tenant isolation at the database level.

**Security Controls**:
- RLS policies enabled on all tenant-scoped tables
- Policies verify `tenant_id` matches session variable
- Automatic enforcement even if application code has bugs

**Example RLS Policy**:

```sql
-- Enable RLS on bookings table
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see bookings from their tenant
CREATE POLICY "Users can view own tenant bookings"
ON bookings
FOR SELECT
USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Policy: Users can only insert bookings for their tenant
CREATE POLICY "Users can insert own tenant bookings"
ON bookings
FOR INSERT
WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

**Setting Session Variable**:

```typescript
// Before querying, set session tenant context
await supabase.rpc('set_session_tenant', {
  p_tenant_id: context.tenantId,
});

// Now all queries automatically filter by tenant_id
const { data } = await supabase.from('bookings').select('*');
// RLS ensures only current tenant's bookings are returned
```

### Layer 5: API Rate Limiting

**Mechanism**: Rate limiting per tenant to prevent abuse and ensure fair resource allocation.

**Security Controls**:
- Rate limits based on subscription plan
- Separate limits for read vs. write operations
- Automatic throttling when limits exceeded

**Implementation Example**:

```typescript
const rateLimits = {
  free: { requests: 100, window: 60 }, // 100 requests/minute
  basic: { requests: 500, window: 60 },
  professional: { requests: 2000, window: 60 },
  enterprise: { requests: 10000, window: 60 },
};

const limit = rateLimits[context.subscriptionPlan];
const isAllowed = await checkRateLimit(context.tenantId, limit);

if (!isAllowed) {
  return Response.json({ error: 'Rate limit exceeded' }, { status: 429 });
}
```


### Security Best Practices

1. **Never Trust Client Input for Tenant ID**: Always extract tenant ID from authenticated session, never from request body or query parameters.

2. **Immutable Context**: TenantContext is read-only. Services must not mutate it.

3. **Audit Logging**: Log all tenant context extraction failures for security monitoring.

4. **Regular Security Audits**: Review all service functions to verify tenant filtering.

5. **Principle of Least Privilege**: Grant database permissions only for tenant-scoped operations.

---

## Using TenantContext in Code

### Server-Side (API Routes)

Always use the `withTenantContext` middleware for API routes:

```typescript
// src/app/api/orders/create/route.ts
import { withTenantContext, type NextRequestWithContext } from '@/core/middleware';
import { createOrder } from '@/core/services/order';

export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  // Context automatically extracted and attached
  const context = request.tenantContext;
  
  // Parse request body
  const orderData = await request.json();
  
  // Pass context to service (tenant filtering enforced)
  const order = await createOrder(context, orderData);
  
  return Response.json(order, { status: 201 });
});
```

### Server Actions

For Next.js Server Actions, manually extract tenant context:

```typescript
'use server';

import { extractTenantContext } from '@/core/middleware';
import { createOrder } from '@/core/services/order';
import { cookies } from 'next/headers';

export async function createOrderAction(orderData: unknown) {
  // Construct mock request with cookies for auth
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


### Client-Side (React Components)

Use the `useTenantContext` hook in client components:

```typescript
'use client';

import { useTenantContext } from '@/core/hooks';

export function FeatureToggle({ featureFlag, children }: { 
  featureFlag: string; 
  children: React.ReactNode;
}) {
  const context = useTenantContext();
  
  // Check if feature is enabled for this tenant
  const isEnabled = context.featureFlags[featureFlag] === true;
  
  if (!isEnabled) {
    return null; // Hide feature
  }
  
  return <>{children}</>;
}

// Usage
<FeatureToggle featureFlag="ai_salary_reconciliation">
  <AISalaryReconciliationPanel />
</FeatureToggle>
```

### Service Functions

All core service functions MUST accept `TenantContext` as the first parameter:

```typescript
// src/core/services/order/create.ts
import type { TenantContext, CoreBookingOrder } from '@/core/types';
import { createClient } from '@/lib/supabase-server';

export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> {
  const supabase = await createClient();
  
  // Set session tenant for RLS
  await supabase.rpc('set_session_tenant', {
    p_tenant_id: context.tenantId,
  });
  
  // Insert order (tenant_id automatically set by RLS or explicitly)
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      ...orderData,
      tenant_id: context.tenantId, // Explicit tenant filter
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create order: ${error.message}`);
  }
  
  return data as CoreBookingOrder;
}
```

### Testing with Mock Context

Create mock TenantContext for unit tests:

```typescript
// src/__tests__/utils/mock-tenant-context.ts
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


**Test Example**:

```typescript
// src/__tests__/services/order.test.ts
import { createOrder } from '@/core/services/order';
import { createMockTenantContext } from '@/tests/utils/mock-tenant-context';

describe('createOrder', () => {
  it('creates order with tenant isolation', async () => {
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

## Tenant-Specific Feature Flags

Feature flags enable gradual feature rollout, A/B testing, and premium feature gating on a per-tenant basis.

### Defining Feature Flags

Feature flags are stored in the `tenants` table (typically in a JSON column like `role_permissions.feature_flags`) and loaded into `TenantContext.featureFlags`.

**Database Schema Example**:

```sql
-- Add feature_flags column to tenants table
ALTER TABLE tenants 
ADD COLUMN feature_flags JSONB DEFAULT '{}'::jsonb;

-- Example data
UPDATE tenants 
SET feature_flags = '{
  "ai_salary_reconciliation": true,
  "inventory_transfer": true,
  "meta_ads_integration": false,
  "advanced_analytics": true,
  "api_access": false
}'::jsonb
WHERE id = 'tenant-123';
```

### Checking Feature Flags

#### In Server-Side Code

```typescript
export async function reconcileSalary(context: TenantContext, month: string) {
  // Check if AI reconciliation is enabled
  const useAI = context.featureFlags['ai_salary_reconciliation'] === true;
  
  if (useAI) {
    return await reconcileSalaryWithAI(context, month);
  } else {
    return await reconcileSalaryManually(context, month);
  }
}
```


#### In Client-Side Components

```typescript
'use client';

import { useTenantContext } from '@/core/hooks';

export function SalaryReconciliation() {
  const context = useTenantContext();
  const aiEnabled = context.featureFlags['ai_salary_reconciliation'] === true;
  
  return (
    <div>
      <h2>Salary Reconciliation</h2>
      
      {aiEnabled ? (
        <AISalaryPanel />
      ) : (
        <ManualSalaryPanel />
      )}
      
      {!aiEnabled && (
        <UpgradePrompt feature="AI Salary Reconciliation" />
      )}
    </div>
  );
}
```

#### Using Helper Function

Use the `isFeatureEnabled` helper for cleaner code:

```typescript
import { isFeatureEnabled } from '@/core/types/feature-flag';
import type { TenantContext } from '@/core/types/tenant';

const aiSalaryFlag = {
  key: 'ai_salary_reconciliation',
  name: 'AI Salary Reconciliation',
  enabled: true,
  requiredPlan: 'professional',
};

export function reconcileSalary(context: TenantContext, month: string) {
  if (isFeatureEnabled(aiSalaryFlag, context)) {
    return reconcileSalaryWithAI(context, month);
  } else {
    return reconcileSalaryManually(context, month);
  }
}
```

### Common Feature Flag Patterns

#### Pattern 1: Premium Feature Gating

```typescript
export function shouldShowPremiumFeature(
  context: TenantContext,
  featureKey: string,
  requiredPlan: SubscriptionPlan
): boolean {
  // Check feature flag
  if (!context.featureFlags[featureKey]) {
    return false;
  }
  
  // Check subscription plan
  const planTiers = ['free', 'basic', 'professional', 'enterprise'];
  const currentTier = planTiers.indexOf(context.subscriptionPlan);
  const requiredTier = planTiers.indexOf(requiredPlan);
  
  return currentTier >= requiredTier;
}

// Usage
if (shouldShowPremiumFeature(context, 'advanced_analytics', 'professional')) {
  // Show advanced analytics dashboard
}
```


#### Pattern 2: Gradual Rollout

```typescript
// Enable feature for 10% of tenants
export function isInRolloutGroup(
  context: TenantContext,
  featureKey: string,
  rolloutPercentage: number
): boolean {
  // Check if feature flag is enabled
  if (!context.featureFlags[featureKey]) {
    return false;
  }
  
  // Hash tenant ID to determine rollout group
  const hash = hashString(context.tenantId);
  const group = hash % 100;
  
  return group < rolloutPercentage;
}

// Usage: Enable for 10% of tenants
if (isInRolloutGroup(context, 'new_dashboard_ui', 10)) {
  return <NewDashboard />;
} else {
  return <OldDashboard />;
}
```

#### Pattern 3: Module-Specific Features

```typescript
export function isModuleFeatureEnabled(
  context: TenantContext,
  moduleId: ModuleId,
  featureKey: string
): boolean {
  // Check if module is enabled
  if (!context.enabledModules.includes(moduleId)) {
    return false;
  }
  
  // Check if feature is enabled
  return context.featureFlags[`${moduleId}_${featureKey}`] === true;
}

// Usage
if (isModuleFeatureEnabled(context, 'spa', 'session_reminder_sms')) {
  await sendSessionReminderSMS(booking);
}
```

### Example Feature Flags by Subscription Plan

```typescript
const featureFlagsByPlan: Record<SubscriptionPlan, Record<string, boolean>> = {
  free: {
    ai_salary_reconciliation: false,
    inventory_transfer: false,
    meta_ads_integration: false,
    advanced_analytics: false,
    api_access: false,
    multi_branch: false,
  },
  basic: {
    ai_salary_reconciliation: false,
    inventory_transfer: false,
    meta_ads_integration: false,
    advanced_analytics: false,
    api_access: false,
    multi_branch: false,
  },
  professional: {
    ai_salary_reconciliation: true,
    inventory_transfer: true,
    meta_ads_integration: true,
    advanced_analytics: true,
    api_access: true,
    multi_branch: true,
  },
  enterprise: {
    ai_salary_reconciliation: true,
    inventory_transfer: true,
    meta_ads_integration: true,
    advanced_analytics: true,
    api_access: true,
    multi_branch: true,
  },
};
```

---

## Best Practices


### 1. Always Pass TenantContext as First Parameter

Service functions should consistently accept `TenantContext` as the first parameter:

```typescript
// ✅ GOOD: Consistent signature
export async function createOrder(
  context: TenantContext,
  orderData: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> { }

export async function updateOrder(
  context: TenantContext,
  orderId: string,
  updates: Partial<CoreBookingOrder>
): Promise<CoreBookingOrder> { }

// ❌ BAD: Inconsistent signature
export async function createOrder(
  orderData: Partial<CoreBookingOrder>,
  context: TenantContext  // Context should be first
): Promise<CoreBookingOrder> { }
```

### 2. Never Mutate TenantContext

TenantContext is read-only. Do not attempt to modify it:

```typescript
// ❌ BAD: Attempting to mutate context
export async function enableFeature(context: TenantContext, feature: string) {
  context.featureFlags[feature] = true; // TypeScript error: readonly
}

// ✅ GOOD: Return new context or update database
export async function enableFeature(
  context: TenantContext,
  feature: string
): Promise<TenantContext> {
  // Update database
  await updateTenantFeatureFlag(context.tenantId, feature, true);
  
  // Return new context
  return {
    ...context,
    featureFlags: {
      ...context.featureFlags,
      [feature]: true,
    },
  };
}
```

### 3. Validate Tenant ID in All Database Queries

Never trust request parameters for tenant ID. Always use `context.tenantId`:

```typescript
// ❌ BAD: Using tenant ID from request body
export async function getOrders(context: TenantContext, requestData: any) {
  const tenantId = requestData.tenantId; // User could fake this!
  
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', tenantId);
  
  return data;
}

// ✅ GOOD: Using tenant ID from context
export async function getOrders(context: TenantContext) {
  const { data } = await supabase
    .from('bookings')
    .select('*')
    .eq('tenant_id', context.tenantId); // From authenticated context
  
  return data;
}
```


### 4. Use Type Guards for Settings Access

Settings are untyped. Use type guards when extracting values:

```typescript
// ✅ GOOD: Type-safe settings access
export function getTenantCurrency(context: TenantContext): string {
  const currency = context.settings.currency;
  
  if (typeof currency === 'string' && currency.length === 3) {
    return currency;
  }
  
  return 'VND'; // Fallback default
}

// ❌ BAD: Assuming settings structure
export function getTenantCurrency(context: TenantContext): string {
  return context.settings.currency; // Could be undefined or wrong type
}
```

### 5. Cache Context at Request Scope, Not Component Scope

Do not fetch tenant context in individual components. Use the provider:

```typescript
// ❌ BAD: Fetching context in component
export function MyComponent() {
  const [context, setContext] = useState<TenantContext | null>(null);
  
  useEffect(() => {
    fetch('/api/tenant/context')
      .then(r => r.json())
      .then(setContext);
  }, []);
  
  if (!context) return <div>Loading...</div>;
  
  return <div>{context.tenantName}</div>;
}

// ✅ GOOD: Using provider and hook
export function MyComponent() {
  const context = useTenantContext(); // From provider
  
  return <div>{context.tenantName}</div>;
}
```

### 6. Document Feature Flags in Code

Document what each feature flag controls:

```typescript
/**
 * Feature flag: ai_salary_reconciliation
 * 
 * **Description**: Enables AI-powered salary reconciliation that compares
 * manual salary records with AI-calculated totals and highlights discrepancies.
 * 
 * **Required Plan**: professional or higher
 * 
 * **Behavior When Disabled**:
 * - Manual salary reconciliation only
 * - No AI comparison or discrepancy detection
 * - Users see "Upgrade to Professional" prompt
 */
const AI_SALARY_FLAG = 'ai_salary_reconciliation';

if (context.featureFlags[AI_SALARY_FLAG]) {
  // Show AI reconciliation panel
}
```

### 7. Fail Gracefully on Feature Flag Checks

Provide fallback behavior when feature flags are missing or false:

```typescript
export async function sendNotification(
  context: TenantContext,
  notification: NotificationEvent
) {
  // Check if SMS notifications are enabled
  const smsEnabled = context.featureFlags['sms_notifications'] === true;
  
  // Send in-app notification (always)
  await sendInAppNotification(notification);
  
  // Send SMS only if enabled
  if (smsEnabled) {
    try {
      await sendSMS(notification);
    } catch (error) {
      console.error('SMS failed, but in-app notification sent:', error);
      // Don't throw - notification was still delivered via in-app
    }
  }
}
```

---

## Common Patterns


### Pattern 1: Conditional Feature Rendering

```typescript
'use client';

import { useTenantContext } from '@/core/hooks';

export function FeatureGate({ 
  feature, 
  children,
  fallback = null 
}: { 
  feature: string; 
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const context = useTenantContext();
  const isEnabled = context.featureFlags[feature] === true;
  
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

// Usage
<FeatureGate 
  feature="advanced_analytics"
  fallback={<UpgradePremiumBanner />}
>
  <AdvancedAnalyticsDashboard />
</FeatureGate>
```

### Pattern 2: Multi-Module Tenant

```typescript
export function DashboardWidgets() {
  const context = useTenantContext();
  
  return (
    <div className="grid gap-4">
      {/* Show spa widgets if spa module enabled */}
      {context.enabledModules.includes('spa') && (
        <>
          <SpaRevenueWidget />
          <KtvPerformanceWidget />
          <SessionCompletionWidget />
        </>
      )}
      
      {/* Show cleaning widgets if cleaning module enabled */}
      {context.enabledModules.includes('cleaning') && (
        <>
          <CleaningJobsWidget />
          <TeamPerformanceWidget />
          <SuppliesInventoryWidget />
        </>
      )}
      
      {/* Show home service widgets if homecare module enabled */}
      {context.enabledModules.includes('homecare') && (
        <>
          <HomeCareVisitsWidget />
          <CaregiverAvailabilityWidget />
          <ClientSatisfactionWidget />
        </>
      )}
    </div>
  );
}
```

### Pattern 3: Tenant-Specific Pricing

```typescript
export async function calculateOrderPrice(
  context: TenantContext,
  item: CoreServiceCatalogItem
): Promise<number> {
  let price = item.basePrice;
  
  // Apply subscription-tier discount
  switch (context.subscriptionPlan) {
    case 'enterprise':
      price *= 0.85; // 15% discount
      break;
    case 'professional':
      price *= 0.9; // 10% discount
      break;
    case 'basic':
      price *= 0.95; // 5% discount
      break;
    case 'free':
      // No discount
      break;
  }
  
  // Apply tenant-specific discount from settings
  const customDiscount = context.settings.customDiscountRate as number;
  if (customDiscount && customDiscount > 0) {
    price *= (1 - customDiscount);
  }
  
  // Apply tax based on tenant location
  const taxRate = context.settings.taxRate as number || 0.1;
  const finalPrice = price * (1 + taxRate);
  
  return Math.round(finalPrice);
}
```


### Pattern 4: Localization Using Tenant Settings

```typescript
export function formatCurrency(
  context: TenantContext,
  amount: number
): string {
  const currency = context.settings.currency as string || 'VND';
  const locale = context.settings.locale as string || 'vi-VN';
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount);
}

export function formatDate(
  context: TenantContext,
  date: Date
): string {
  const locale = context.settings.locale as string || 'vi-VN';
  const dateFormat = context.settings.dateFormat as string;
  
  if (dateFormat === 'MM/DD/YYYY') {
    return date.toLocaleDateString('en-US');
  } else {
    return date.toLocaleDateString(locale);
  }
}

// Usage
const price = formatCurrency(context, 500000); // "500.000 ₫"
const date = formatDate(context, new Date()); // "06/01/2025"
```

### Pattern 5: Dynamic Module Adapter Loading

```typescript
import { moduleRegistry } from '@/core/adapters';

export async function processOrder(
  context: TenantContext,
  order: CoreBookingOrder
) {
  // Get module ID from first enabled module
  const moduleId = context.enabledModules[0];
  
  if (!moduleId) {
    throw new Error('No modules enabled for tenant');
  }
  
  // Get module adapter (if registered)
  const adapter = moduleRegistry.get(moduleId);
  
  // Validate order using module-specific rules (if available)
  if (adapter?.validateBookingRules) {
    const isValid = await adapter.validateBookingRules(order, context);
    if (!isValid) {
      throw new Error('Order validation failed');
    }
  }
  
  // Process order
  const result = await createOrder(context, order);
  
  // Execute module-specific side effects (if available)
  if (adapter?.onBookingCompleted) {
    await adapter.onBookingCompleted(result, context);
  }
  
  return result;
}
```

### Pattern 6: Tenant Branding

```typescript
'use client';

import { useTenantContext } from '@/core/hooks';

export function AppHeader() {
  const context = useTenantContext();
  
  const logoUrl = context.settings.logoUrl as string;
  const primaryColor = context.settings.primaryColor as string || '#4F46E5';
  const companyName = context.settings.companyName as string || context.tenantName;
  
  return (
    <header style={{ backgroundColor: primaryColor }}>
      {logoUrl && (
        <img src={logoUrl} alt={companyName} className="h-10" />
      )}
      <h1 className="text-white text-xl font-bold">{companyName}</h1>
    </header>
  );
}
```

---

## Troubleshooting


### Problem: "useTenantContext must be used within TenantContextProvider"

**Error Message**:
```
Error: useTenantContext must be used within TenantContextProvider. 
Ensure your component tree is wrapped with <TenantContextProvider> in the root layout.
```

**Cause**: Component using `useTenantContext()` hook is not wrapped by `TenantContextProvider`.

**Solution**:

1. Verify provider is added in root layout:

```typescript
// src/app/layout.tsx
import { TenantContextProvider } from '@/core/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
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

2. If using Pages Router, add to `_app.tsx`:

```typescript
// src/pages/_app.tsx
import { TenantContextProvider } from '@/core/providers';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <TenantContextProvider>
      <Component {...pageProps} />
    </TenantContextProvider>
  );
}
```

### Problem: "Unauthorized: Please log in to access this resource"

**Error Message**:
```
401 Unauthorized: Please log in to access this resource
```

**Cause**: User session is invalid or expired.

**Solution**:

1. Check if user is logged in:

```typescript
import { createClient } from '@/lib/supabase-server';

const supabase = await createClient();
const { data: { user } } = await supabase.auth.getUser();

if (!user) {
  // Redirect to login page
  redirect('/login');
}
```

2. Verify session cookies are being sent:

```typescript
// Ensure credentials are included in fetch
const response = await fetch('/api/tenant/context', {
  credentials: 'same-origin',
});
```

3. Check Supabase Auth configuration in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```


### Problem: "Forbidden: User has no tenant assigned"

**Error Message**:
```
403 Forbidden: User has no tenant assigned
```

**Cause**: Authenticated user exists but has no `tenant_id` in `users` table.

**Solution**:

1. Verify user has tenant assigned in database:

```sql
SELECT id, email, tenant_id 
FROM users 
WHERE id = 'user-uuid';
```

2. If `tenant_id` is NULL, assign a tenant:

```sql
UPDATE users 
SET tenant_id = 'tenant-uuid' 
WHERE id = 'user-uuid';
```

3. For new user registration, ensure tenant is assigned during signup:

```typescript
// During user registration
const { data: user } = await supabase.auth.signUp({
  email,
  password,
});

if (user) {
  // Assign user to tenant
  await supabase
    .from('users')
    .update({ tenant_id: selectedTenantId })
    .eq('id', user.id);
}
```

### Problem: "Not Found: Tenant configuration not found"

**Error Message**:
```
404 Not Found: Tenant configuration not found
```

**Cause**: User has a `tenant_id` but no matching record exists in `tenants` table.

**Solution**:

1. Verify tenant exists:

```sql
SELECT id, name, subscription_tier 
FROM tenants 
WHERE id = 'tenant-uuid';
```

2. If tenant doesn't exist, create it:

```sql
INSERT INTO tenants (id, name, subscription_tier, enabled_modules)
VALUES (
  'tenant-uuid',
  'Tenant Name',
  'basic',
  ARRAY['spa']
);
```

3. Check for data integrity issues:

```sql
-- Find users with invalid tenant_id
SELECT u.id, u.email, u.tenant_id
FROM users u
LEFT JOIN tenants t ON u.tenant_id = t.id
WHERE u.tenant_id IS NOT NULL AND t.id IS NULL;
```


### Problem: Feature Flag Not Working

**Symptom**: Feature flag is enabled in database but not working in code.

**Solution**:

1. Check feature flag value in database:

```sql
SELECT id, name, feature_flags
FROM tenants
WHERE id = 'tenant-uuid';
```

2. Verify feature flag structure in TenantContext:

```typescript
// Add logging in component
const context = useTenantContext();
console.log('Feature flags:', context.featureFlags);
console.log('AI Salary flag:', context.featureFlags['ai_salary_reconciliation']);
```

3. Check if feature flag is being loaded correctly in middleware:

```typescript
// In src/core/middleware/tenantContext.ts
// Ensure feature flags are extracted from database row
const featureFlags = tenant.feature_flags || {};
```

4. Clear cache if using Redis:

```bash
# Clear Redis cache for tenant
redis-cli DEL tenant:tenant-uuid:context
```

### Problem: Tenant Context Not Updating After Changes

**Symptom**: Changes to tenant configuration in database don't reflect in application.

**Solution**:

1. **For Client-Side**: Refresh the page to reload tenant context from provider.

2. **For Server-Side with Redis Cache**: Invalidate cache after updating tenant:

```typescript
import { invalidateTenantCache } from '@/core/lib/tenant-cache';

// After updating tenant in database
await supabase
  .from('tenants')
  .update({ subscription_tier: 'professional' })
  .eq('id', tenantId);

// Invalidate cache
await invalidateTenantCache(tenantId);
```

3. **For Production**: Implement automatic cache invalidation on tenant updates:

```typescript
// Database trigger or application hook
export async function onTenantUpdate(tenantId: string) {
  // Invalidate Redis cache
  await invalidateTenantCache(tenantId);
  
  // Optionally: Send webhook to refresh connected clients
  await sendWebhookNotification(tenantId, 'tenant_config_updated');
}
```

### Problem: Cross-Tenant Data Leakage

**Symptom**: User can see data from other tenants.

**Critical Security Issue**: This is a serious vulnerability that must be addressed immediately.

**Solution**:

1. **Verify All Queries Filter by Tenant**:

```typescript
// Audit all database queries to ensure tenant filtering
// ❌ BAD: No tenant filter
const { data } = await supabase.from('bookings').select('*');

// ✅ GOOD: Tenant filter applied
const { data } = await supabase
  .from('bookings')
  .select('*')
  .eq('tenant_id', context.tenantId);
```


2. **Enable and Verify RLS Policies**:

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- Enable RLS if not already enabled
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

-- Verify policies exist
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'bookings';
```

3. **Test Tenant Isolation**:

```typescript
// Create test script to verify isolation
async function testTenantIsolation() {
  const tenant1Context = { tenantId: 'tenant-1', ... };
  const tenant2Context = { tenantId: 'tenant-2', ... };
  
  // Create order for tenant 1
  const order1 = await createOrder(tenant1Context, orderData);
  
  // Try to fetch order using tenant 2 context (should fail)
  const order2 = await getOrderById(tenant2Context, order1.id);
  
  if (order2) {
    throw new Error('SECURITY VIOLATION: Cross-tenant data access detected!');
  }
  
  console.log('✅ Tenant isolation verified');
}
```

4. **Audit Logs**:

```typescript
// Log all tenant context extractions
console.log('[TenantContext] User:', user.id, 'Tenant:', tenantId);

// Monitor for suspicious patterns:
// - User accessing multiple tenants
// - Tenant ID mismatches
// - Unauthorized tenant access attempts
```

---

## Related Documentation

- [Module System Architecture](./module-system.md) - Learn about module adapters and how they integrate with TenantContext
- [Core Platform Design](./core-platform.md) - Overview of core platform services and architecture
- [API Documentation](../api-reference.md) - API endpoints and authentication
- [Phase 3 Requirements](../../.kiro/specs/phase-3-physical-extraction/requirements.md) - Phase 3 implementation requirements
- [Phase 3 Design](../../.kiro/specs/phase-3-physical-extraction/design.md) - Detailed Phase 3 architecture design

---

## Summary

TenantContext is the foundation of Bella ERP's multi-tenant architecture, providing:

1. **Single Source of Truth**: Load tenant configuration once per request and pass to all services
2. **Type Safety**: Strong TypeScript typing prevents configuration errors
3. **Security**: Enforces tenant isolation at multiple layers (auth, query filtering, RLS)
4. **Flexibility**: Supports per-tenant feature flags, settings, and module enablement
5. **Performance**: Configuration cached in memory and Redis to minimize database queries

**Key Takeaways**:

- Always use `withTenantContext` middleware for API routes
- Always pass `TenantContext` as first parameter to service functions
- Always filter database queries by `context.tenantId`
- Never trust client input for tenant ID
- Use feature flags to control optional functionality per tenant
- Test tenant isolation thoroughly to prevent data leakage

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Active  
**Maintainer**: Platform Team
