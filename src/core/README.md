# Core Platform

This directory contains the industry-neutral core platform code for the Bella ERP system. All services, utilities, and infrastructure in this directory should be reusable across multiple industry modules (spa, cleaning, home-service, etc.).

## Directory Structure

- **types/** - Contract type definitions for core platform entities (Phase 2)
- **services/** - Core business logic services (auth, order, payment, etc.)
- **lib/** - Utility functions and helpers
- **adapters/** - Module adapter system and registry
- **middleware/** - Request/response middleware for API routes
- **hooks/** - React hooks for core functionality
- **providers/** - React context providers for core state management

## Key Principles

1. **Industry Neutrality**: No industry-specific logic should exist in core platform code. Use module adapters for industry-specific behavior.

2. **Tenant-Aware**: All service functions accept `TenantContext` as the first parameter to enable multi-tenancy.

3. **Contract Types**: All services use contract types from `src/core/types/` for type safety and consistency.

4. **Module Adapters**: Core services invoke module adapters for module-specific validation, pricing, and side effects.

## Usage Example

```typescript
import { TenantContext } from '@/core/types';
import { createOrder } from '@/core/services/order';

async function handleOrderCreation(context: TenantContext, orderData: Partial<CoreBookingOrder>) {
  // Core service handles industry-neutral logic
  // Module adapter handles industry-specific logic
  const order = await createOrder(context, orderData);
  return order;
}
```

## Migration Status

- ✅ Phase 2: Contract types defined
- 🚧 Phase 3: Core services extraction in progress
- ⏳ Phase 4: Additional industry modules (planned)
