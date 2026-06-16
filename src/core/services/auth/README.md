# Authentication & Authorization Services

This directory contains services for user authentication, session management, and authorization across the Bella ERP platform.

## Purpose

Provides industry-neutral authentication and authorization logic that works across all modules (spa, cleaning, home-service, etc.).

## Key Services

### Authentication
- User login/logout
- Session creation and validation
- Password management
- Multi-factor authentication (future)

### Authorization
- Role-based access control (RBAC)
- Permission validation
- Resource-level authorization
- Tenant-based access control

## Usage Patterns

### 1. User Authentication

```typescript
import { authenticateUser } from '@/core/services/auth';

const session = await authenticateUser(context, {
  email: 'user@example.com',
  password: 'secure-password'
});
```

### 2. Authorization Checks

```typescript
import { authorizeAction } from '@/core/services/auth';

const canEdit = await authorizeAction(context, {
  userId: session.userId,
  resource: 'orders',
  action: 'update'
});
```

## Tenant Isolation

All auth services validate that users can only access resources within their tenant:

- Session validation includes `tenantId` check
- Authorization queries filter by `context.tenantId`
- Cross-tenant access is prevented by default

## Security Considerations

- Passwords are hashed using bcrypt
- Sessions are stored securely with httpOnly cookies
- RLS policies enforce database-level access control
- All authentication events are logged via audit service
