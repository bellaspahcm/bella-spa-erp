# Tenant Context Middleware - Usage Guide

## Overview

The `withTenantContext` middleware automatically extracts tenant configuration from authenticated requests and provides it to your API route handlers. This ensures all API operations are tenant-aware and properly isolated.

## Quick Start

### Basic Usage

```typescript
// src/app/api/orders/route.ts
import { NextResponse } from 'next/server';
import { withTenantContext, type NextRequestWithContext } from '@/core/middleware/tenantContext';
import { createOrder } from '@/core/services/order/create';

export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  // Extract tenant context (already validated by middleware)
  const context = request.tenantContext;
  
  // Parse request body
  const orderData = await request.json();
  
  // Call service with tenant context
  const order = await createOrder(context, orderData);
  
  return NextResponse.json(order, { status: 201 });
});
```

### GET Request Example

```typescript
// src/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { withTenantContext, type NextRequestWithContext } from '@/core/middleware/tenantContext';
import { getOrderById } from '@/core/services/order/query';

export const GET = withTenantContext(async (
  request: NextRequestWithContext,
  { params }: { params: { id: string } }
) => {
  const context = request.tenantContext;
  const orderId = params.id;
  
  const order = await getOrderById(context, orderId);
  
  if (!order) {
    return NextResponse.json(
      { error: 'Order not found' },
      { status: 404 }
    );
  }
  
  return NextResponse.json(order);
});
```

### PUT Request Example

```typescript
// src/app/api/orders/[id]/route.ts
import { NextResponse } from 'next/server';
import { withTenantContext, type NextRequestWithContext } from '@/core/middleware/tenantContext';
import { updateOrder } from '@/core/services/order/update';

export const PUT = withTenantContext(async (
  request: NextRequestWithContext,
  { params }: { params: { id: string } }
) => {
  const context = request.tenantContext;
  const orderId = params.id;
  const updates = await request.json();
  
  const updatedOrder = await updateOrder(context, orderId, updates);
  
  return NextResponse.json(updatedOrder);
});
```

## What the Middleware Does

The `withTenantContext` middleware automatically:

1. **Extracts authenticated user** from Supabase session
2. **Fetches tenant ID** from user profile
3. **Loads tenant configuration** from database
4. **Constructs TenantContext** with:
   - Tenant ID and name
   - Enabled modules
   - Subscription plan
   - Feature flags
   - Custom settings
5. **Attaches context** to request object
6. **Validates authorization** before calling your handler

## Error Responses

The middleware returns standardized error responses:

### 401 Unauthorized
```json
{
  "error": "Unauthorized: Please log in to access this resource"
}
```

**Cause**: User is not authenticated (no valid session).

**Solution**: Client should redirect to login page.

### 403 Forbidden
```json
{
  "error": "Forbidden: User has no tenant assigned"
}
```

**Cause**: User exists but has no `tenant_id` in their profile.

**Solution**: Admin must assign user to a tenant.

### 404 Not Found
```json
{
  "error": "Not Found: Tenant configuration not found"
}
```

**Cause**: Tenant ID exists in user profile but tenant record doesn't exist.

**Solution**: Admin must create tenant record or fix user profile.

### 500 Internal Server Error
```json
{
  "error": "Internal server error: <details>"
}
```

**Cause**: Database query failed or unexpected error occurred.

**Solution**: Check server logs for details.

## Using Tenant Context in Services

### Pattern 1: Pass Context to Service Functions

All core service functions accept `TenantContext` as the first parameter:

```typescript
// In API route
export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext;
  const data = await request.json();
  
  // Pass context to service
  const result = await createOrder(context, data);
  
  return NextResponse.json(result);
});
```

### Pattern 2: Access Tenant Configuration

Use tenant context to customize behavior:

```typescript
export const GET = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext;
  
  // Check feature flags
  if (context.featureFlags.advanced_reports) {
    return await generateAdvancedReport(context);
  }
  
  // Check subscription plan
  if (context.subscriptionPlan === 'enterprise') {
    return await generateEnterpriseReport(context);
  }
  
  // Default behavior
  return await generateBasicReport(context);
});
```

### Pattern 3: Module-Specific Logic

Check which modules are enabled for the tenant:

```typescript
export const GET = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext;
  
  // Check if spa module is enabled
  if (context.enabledModules.includes('spa')) {
    // Fetch spa-specific data
    const spaOrders = await getSpaOrders(context);
    return NextResponse.json({ orders: spaOrders });
  }
  
  // Module not enabled
  return NextResponse.json(
    { error: 'Spa module is not enabled for this tenant' },
    { status: 403 }
  );
});
```

## Testing with Tenant Context

### Unit Testing API Routes

```typescript
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/orders/route';

// Mock the middleware (will be done by test utilities)
jest.mock('@/core/middleware/tenantContext', () => ({
  withTenantContext: (handler: any) => handler,
}));

describe('POST /api/orders', () => {
  it('creates an order with tenant context', async () => {
    const mockRequest = {
      json: async () => ({ customerId: '123', items: [...] }),
      tenantContext: {
        tenantId: 'tenant-1',
        tenantName: 'Test Tenant',
        enabledModules: ['spa'],
        subscriptionPlan: 'basic',
        featureFlags: {},
        settings: {},
      },
    } as any;
    
    const response = await POST(mockRequest);
    const data = await response.json();
    
    expect(response.status).toBe(201);
    expect(data.id).toBeDefined();
  });
});
```

### Integration Testing with Real Middleware

```typescript
import { extractTenantContext } from '@/core/middleware/tenantContext';

describe('extractTenantContext', () => {
  it('extracts context for authenticated user', async () => {
    // Create mock request with auth session
    const request = createMockAuthenticatedRequest('user-123');
    
    const result = await extractTenantContext(request);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.context.tenantId).toBeDefined();
      expect(result.context.tenantName).toBeDefined();
    }
  });
  
  it('returns 401 for unauthenticated user', async () => {
    const request = createMockRequest(); // No auth
    
    const result = await extractTenantContext(request);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.statusCode).toBe(401);
    }
  });
});
```

## Advanced Patterns

### Chaining Multiple Middleware

You can chain tenant context middleware with other middleware:

```typescript
import { withTenantContext } from '@/core/middleware/tenantContext';
import { withErrorHandler } from '@/core/middleware/errorHandler';
import { withRateLimit } from '@/core/middleware/rateLimit';

// Apply multiple middleware layers
export const POST = withErrorHandler(
  withRateLimit(
    withTenantContext(async (request) => {
      // All middleware applied in order
      const context = request.tenantContext;
      // ... handler logic
    })
  )
);
```

### Custom Authorization Checks

Add additional authorization checks after tenant context:

```typescript
export const DELETE = withTenantContext(async (
  request: NextRequestWithContext,
  { params }: { params: { id: string } }
) => {
  const context = request.tenantContext;
  
  // Additional authorization check
  if (context.subscriptionPlan === 'free') {
    return NextResponse.json(
      { error: 'Delete operation not available on free plan' },
      { status: 403 }
    );
  }
  
  // Proceed with deletion
  await deleteOrder(context, params.id);
  
  return NextResponse.json({ success: true });
});
```

### Using Tenant Settings

Access custom tenant settings:

```typescript
export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext;
  const data = await request.json();
  
  // Use tenant-specific currency
  const currency = context.settings.currency || 'VND';
  
  // Use tenant-specific timezone
  const timezone = context.settings.timezone || 'Asia/Ho_Chi_Minh';
  
  // Create order with tenant settings
  const order = await createOrder(context, {
    ...data,
    currency,
    timezone,
  });
  
  return NextResponse.json(order);
});
```

## Performance Considerations

### Caching Tenant Context

The middleware fetches tenant configuration from the database on every request. Consider adding caching:

```typescript
// Future enhancement: Redis caching
const TENANT_CONTEXT_CACHE_TTL = 300; // 5 minutes

async function getCachedTenantContext(tenantId: string): Promise<TenantContext> {
  const cached = await redis.get(`tenant:${tenantId}:context`);
  if (cached) return JSON.parse(cached);
  
  const context = await fetchTenantContext(tenantId);
  await redis.setex(`tenant:${tenantId}:context`, TENANT_CONTEXT_CACHE_TTL, JSON.stringify(context));
  return context;
}
```

### Request Performance Impact

- **Average overhead**: ~10-20ms per request
- **Database queries**: 3 queries (auth, user profile, tenant config)
- **Mitigation**: Use database connection pooling and consider caching

## Security Best Practices

1. **Never skip tenant context validation** - Always use the middleware for API routes that handle tenant data

2. **Verify tenant ID matches authenticated user** - The middleware automatically validates this

3. **Log unauthorized access attempts** - All errors are logged by the middleware

4. **Use tenant context for database queries** - Always filter by `tenantId` from context

5. **Don't trust client-provided tenant IDs** - Always extract from authenticated session

## Troubleshooting

### Issue: "User has no tenant assigned"

**Solution**: Run migration to assign existing users to tenants:

```sql
-- Assign users to default tenant
UPDATE users
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE tenant_id IS NULL;
```

### Issue: Middleware not working in API route

**Checklist**:
- ✅ Import `withTenantContext` from `@/core/middleware/tenantContext`
- ✅ Wrap the handler function: `export const POST = withTenantContext(async (req) => { ... })`
- ✅ Use `NextRequestWithContext` type for request parameter
- ✅ Access context via `request.tenantContext`

### Issue: TypeScript error "Property 'tenantContext' does not exist"

**Solution**: Use the `NextRequestWithContext` type:

```typescript
import type { NextRequestWithContext } from '@/core/middleware/tenantContext';

export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext; // ✅ TypeScript knows about tenantContext
  // ...
});
```

## Migration Guide

### Before (without middleware)

```typescript
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();
  
  const tenantId = profile?.tenant_id;
  
  // Manual tenant context construction...
}
```

### After (with middleware)

```typescript
export const POST = withTenantContext(async (request: NextRequestWithContext) => {
  const context = request.tenantContext; // ✅ Automatic tenant context
  
  // Use context directly in services
  const result = await someService(context, data);
  return NextResponse.json(result);
});
```

## References

- **TenantContext Type**: `src/core/types/tenant.ts`
- **Middleware Implementation**: `src/core/middleware/tenantContext.ts`
- **Example API Route**: `src/app/api/tenant/context/route.ts`
- **Module Adapter System**: `src/core/adapters/registry.ts`
