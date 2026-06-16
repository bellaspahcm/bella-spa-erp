# Core Platform Providers

React context providers for core platform functionality.

## Overview

This directory contains React context providers that supply global configuration and state to the application. These providers should be wrapped around the application root in `app/layout.tsx`.

## Available Providers

### TenantContextProvider

Provides tenant configuration and entitlements to all components via the `useTenantContext()` hook.

**Features**:
- Fetches tenant configuration from `/api/tenant/context` on mount
- Handles loading and error states gracefully
- Makes tenant config available to all child components
- Caches tenant data for the session duration

**Usage**:

```tsx
// In app/layout.tsx
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

**Loading State**: Displays a loading spinner and message while fetching tenant data.

**Error State**: Displays an error message with a retry button if tenant fetch fails.

**Success State**: Once loaded, tenant context is available via `useTenantContext()` hook.

## Implementation Notes

### Performance

- Tenant configuration is fetched once on app mount
- HTTP response is cached for 5 minutes (see API route)
- Context value remains stable throughout the session
- No unnecessary re-renders unless page is reloaded

### Security

- Requires authenticated user session
- Tenant ID extracted from user profile (not from URL or headers)
- Users can only access their own tenant's configuration
- RLS policies enforce tenant isolation at database level

### Error Handling

The provider handles three error scenarios:

1. **Authentication Error**: User not logged in (redirects to login)
2. **Authorization Error**: User has no tenant assigned (shows error)
3. **Network/Database Error**: Failed to fetch tenant config (shows retry option)

## Testing

Unit tests for the API route are located in:
- `src/__tests__/api-tenant-context.test.ts`

Integration tests for the provider component should be added to:
- `src/__tests__/core-tenant-context-provider.test.tsx` (TODO)

## Related Files

- **Hook**: `src/core/hooks/useTenantContext.ts`
- **API Route**: `src/app/api/tenant/context/route.ts`
- **Types**: `src/core/types/tenant.ts`
