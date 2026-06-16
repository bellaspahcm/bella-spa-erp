# API Middleware

This directory contains middleware for API routes that handle cross-cutting concerns.

## Purpose

Provides reusable middleware for API routes to extract tenant context, validate authentication, and handle common request/response transformations.

## Key Middleware

### Tenant Context Middleware
- Extracts tenant ID from request headers/session
- Constructs TenantContext object
- Attaches context to request object
- Rejects unauthorized requests

### Authentication Middleware
- Validates user session
- Checks authentication status
- Attaches user info to request
- Handles token refresh

### Error Handling Middleware
- Catches and formats errors
- Logs errors to audit service
- Returns consistent error responses
- Handles validation errors

## Usage Patterns

### 1. Using Tenant Context Middleware

```typescript
// In API route (Next.js App Router)
import { withTenantContext } from '@/core/middleware/tenantContext';

export const POST = withTenantContext(async (req, context) => {
  // context: TenantContext is available
  const order = await createOrder(context, orderData);
  return Response.json(order);
});
```

### 2. Chaining Middleware

```typescript
import { withAuth } from '@/core/middleware/auth';
import { withTenantContext } from '@/core/middleware/tenantContext';
import { withErrorHandler } from '@/core/middleware/errorHandler';

export const POST = withErrorHandler(
  withAuth(
    withTenantContext(async (req, context) => {
      // All middleware applied
    })
  )
);
```

## Tenant Context Extraction

The tenant context middleware extracts tenant ID from:
1. Request headers (`x-tenant-id`)
2. Session data (for logged-in users)
3. Subdomain (for multi-tenant deployments)

```typescript
// Priority order:
const tenantId = 
  req.headers.get('x-tenant-id') || 
  session.tenantId || 
  extractTenantFromSubdomain(req);
```

## Error Responses

Standard error response format:

```json
{
  "error": "Unauthorized",
  "message": "Missing or invalid tenant ID",
  "statusCode": 401
}
```

## File Organization

- **tenantContext.ts** - Tenant context extraction middleware
- **auth.ts** - Authentication middleware
- **errorHandler.ts** - Error handling middleware
- **validation.ts** - Request validation middleware

## Security Considerations

- All middleware validates tenant ID matches authenticated user
- Middleware rejects cross-tenant access attempts
- Errors are logged via audit service
- Sensitive data is never included in error responses
