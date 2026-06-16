# Core Platform Hooks

React hooks for accessing core platform functionality.

## Overview

This directory contains React hooks that provide access to core platform services and configuration. These hooks follow standard React patterns and must be used within appropriate context providers.

## Available Hooks

### useTenantContext()

Returns the current tenant's configuration and entitlements.

**Returns**: `TenantContext` object containing:
- `tenantId`: Unique tenant identifier
- `tenantName`: Human-readable tenant name
- `enabledModules`: Array of enabled industry modules (`['spa', 'babycare']`)
- `subscriptionPlan`: Subscription tier (`'free' | 'basic' | 'professional' | 'enterprise'`)
- `featureFlags`: Record of enabled/disabled features
- `settings`: Tenant-specific configuration (currency, timezone, branding, etc.)

**Requirements**: Must be used within `TenantContextProvider`.

**Throws**: Error if used outside provider (standard React context pattern).

**Usage Examples**:

```tsx
'use client';

import { useTenantContext } from '@/core/hooks/useTenantContext';

export function MyComponent() {
  const context = useTenantContext();

  // Check if a module is enabled
  if (!context.enabledModules.includes('spa')) {
    return <div>Spa module not available</div>;
  }

  // Check feature flag
  const aiEnabled = context.featureFlags['ai_salary_reconciliation'];

  // Get tenant settings
  const currency = context.settings.currency || 'VND';

  return (
    <div>
      <h1>{context.tenantName}</h1>
      <p>Plan: {context.subscriptionPlan}</p>
      <p>Currency: {currency}</p>
      {aiEnabled && <AIFeatureComponent />}
    </div>
  );
}
```

**Conditional Rendering Based on Subscription Plan**:

```tsx
function PremiumFeature() {
  const context = useTenantContext();
  
  if (context.subscriptionPlan === 'free') {
    return (
      <div className="text-gray-500">
        Upgrade to Professional or Enterprise to access this feature
      </div>
    );
  }

  return <ActualFeatureComponent />;
}
```

**Module-Specific Component**:

```tsx
function SpaBookingWidget() {
  const context = useTenantContext();
  
  // This widget only renders if spa module is enabled
  if (!context.enabledModules.includes('spa')) {
    return null;
  }

  return <SpaBookingsTable tenantId={context.tenantId} />;
}
```

## Common Use Cases

### 1. Feature Flags

Check if a feature is enabled for the tenant:

```tsx
const context = useTenantContext();
const inventoryEnabled = context.featureFlags['inventory_transfer'];
```

### 2. Module Gating

Conditionally render module-specific UI:

```tsx
const context = useTenantContext();
const showBabycareTab = context.enabledModules.includes('babycare');
```

### 3. Subscription Tier Checks

Enforce subscription-based access control:

```tsx
const context = useTenantContext();
const canAccessAdvancedReports = 
  context.subscriptionPlan === 'professional' || 
  context.subscriptionPlan === 'enterprise';
```

### 4. Branding

Apply tenant-specific branding:

```tsx
const context = useTenantContext();
const logoUrl = context.settings.logoUrl;
const primaryColor = context.settings.primaryColor || '#3B82F6';
```

### 5. Localization

Use tenant's preferred locale and timezone:

```tsx
const context = useTenantContext();
const locale = context.settings.locale || 'vi-VN';
const timezone = context.settings.timezone || 'Asia/Ho_Chi_Minh';
```

## Performance Considerations

- Hook returns the same context object throughout the session (no re-renders)
- Context is loaded once on app mount by `TenantContextProvider`
- No network requests are made by the hook itself (data pre-fetched by provider)
- Safe to call multiple times in different components (no performance penalty)

## Error Handling

The hook throws an error if used outside `TenantContextProvider`:

```
Error: useTenantContext must be used within TenantContextProvider.
Ensure your component tree is wrapped with <TenantContextProvider> in the root layout.
```

**Solution**: Ensure `TenantContextProvider` is added to `app/layout.tsx`:

```tsx
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

## Testing

When testing components that use `useTenantContext()`, wrap them with a mock provider:

```tsx
import { TenantContextContext } from '@/core/hooks/useTenantContext';
import { render } from '@testing-library/react';

const mockContext = {
  tenantId: 'test-tenant',
  tenantName: 'Test Spa',
  enabledModules: ['spa'],
  subscriptionPlan: 'professional',
  featureFlags: { ai_enabled: true },
  settings: { currency: 'VND' },
};

function renderWithTenantContext(component) {
  return render(
    <TenantContextContext.Provider value={mockContext}>
      {component}
    </TenantContextContext.Provider>
  );
}

test('renders with tenant context', () => {
  renderWithTenantContext(<MyComponent />);
  // ...assertions
});
```

## Related Files

- **Provider**: `src/core/providers/TenantContextProvider.tsx`
- **API Route**: `src/app/api/tenant/context/route.ts`
- **Types**: `src/core/types/tenant.ts`
- **Tests**: `src/__tests__/api-tenant-context.test.ts`
