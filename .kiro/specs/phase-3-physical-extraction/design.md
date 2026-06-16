# Phase 3: Core Platform Physical Extraction & Migration - Design

**Feature**: phase-3-physical-extraction  
**Status**: Planning  
**Last Updated**: 2025-06-01

---

## Architecture Overview

Phase 3 transforms the monolithic Bella Spa codebase into a modular architecture with clear boundaries between core platform and industry modules.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Bella ERP Platform                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │            Core Platform (src/core/)                │    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │    │
│  │  │   Services   │  │  Adapters    │  │  Types   │ │    │
│  │  │              │  │              │  │          │ │    │
│  │  │ • Auth       │  │ • Registry   │  │ Contract │ │    │
│  │  │ • Bookings   │  │ • Adapter    │  │ Types    │ │    │
│  │  │ • Payments   │  │   Loader     │  │          │ │    │
│  │  │ • Audit      │  │              │  │          │ │    │
│  │  │ • Notif      │  │              │  │          │ │    │
│  │  └──────────────┘  └──────────────┘  └──────────┘ │    │
│  └────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           │ ModuleAdapter Interface          │
│                           ▼                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Industry Modules (src/modules/)             │    │
│  │                                                      │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐         │    │
│  │  │   Spa    │  │ Cleaning │  │   Home   │ Future  │    │
│  │  │  Module  │  │  Module  │  │ Service  │ Modules │    │
│  │  │          │  │ (Phase 4)│  │ (Phase 4)│         │    │
│  │  │ Adapter  │  │          │  │          │         │    │
│  │  │ Services │  │          │  │          │         │    │
│  │  │ Comps    │  │          │  │          │         │    │
│  │  └──────────┘  └──────────┘  └──────────┘         │    │
│  └────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```


### Directory Structure (After Phase 3)

```
src/
├── core/                          # Core platform code (industry-neutral)
│   ├── types/                     # Contract type definitions (from Phase 2)
│   │   ├── tenant.ts
│   │   ├── module.ts
│   │   ├── booking-order.ts       # CoreBookingOrder contract
│   │   ├── payment.ts
│   │   └── ... (all Phase 2 contracts)
│   │
│   ├── services/                  # Core business logic
│   │   ├── auth/
│   │   │   ├── authenticate.ts
│   │   │   └── authorize.ts
│   │   ├── order/                 # Customer order management
│   │   │   ├── create.ts
│   │   │   ├── update.ts
│   │   │   ├── complete.ts
│   │   │   └── query.ts
│   │   ├── payment/
│   │   │   ├── process.ts
│   │   │   └── query.ts
│   │   ├── notification/
│   │   │   └── send.ts
│   │   ├── audit/
│   │   │   └── log.ts
│   │   ├── finance/               # Revenue, expenses, P&L
│   │   │   ├── revenue.ts
│   │   │   ├── expense.ts
│   │   │   ├── invoice.ts
│   │   │   └── reports.ts
│   │   ├── payroll/               # Employee compensation
│   │   │   ├── calculate.ts
│   │   │   ├── approve.ts
│   │   │   └── reports.ts
│   │   └── analytics/             # Business intelligence
│   │       ├── dashboard.ts
│   │       ├── reports.ts
│   │       └── export.ts
│   │
│   ├── adapters/                  # Module adapter system
│   │   ├── registry.ts            # Module registry
│   │   └── types.ts               # Adapter utilities
│   │
│   ├── providers/                 # React context providers
│   │   ├── TenantContextProvider.tsx
│   │   └── ModuleRegistryProvider.tsx
│   │
│   ├── hooks/                     # React hooks
│   │   ├── useTenantContext.ts
│   │   └── useModuleAdapter.ts
│   │
│   ├── lib/                       # Utility functions
│   │   ├── database.ts            # DB utilities
│   │   └── validation.ts          # Validation helpers
│   │
│   └── middleware/                # API middleware
│       └── tenantContext.ts       # Extract tenant from request
│
├── modules/                       # Industry-specific modules
│   └── spa/                       # Spa module (Phase 3)
│       ├── types/                 # Spa-specific types
│       │   ├── package.ts
│       │   ├── session.ts
│       │   ├── employee.ts
│       │   └── salary.ts
│       │
│       ├── adapters/              # Spa module adapter
│       │   └── SpaModuleAdapter.ts
│       │
│       ├── services/              # Spa business logic
│       │   ├── session.ts         # Session scheduling & tracking
│       │   ├── salary.ts          # KTV salary calculations
│       │   ├── package.ts         # Package session multipliers
│       │   └── ktvPerformance.ts  # KTV performance tracking
│       │
│       ├── components/            # Spa UI components
│       │   ├── dashboard/
│       │   ├── order/             # Spa order components
│       │   └── employees/
│       │
│       └── hooks/                 # Spa-specific hooks
│           └── useSpaOrder.ts
│
└── app/                           # Next.js app directory (existing)
    └── (existing structure)
```

---

## Component Design

### 1. TenantContext Provider

**Purpose**: Provide tenant configuration to all React components.

**Implementation**:

```typescript
// src/core/providers/TenantContextProvider.tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { TenantContext } from '@/core/types';

const TenantContextContext = createContext<TenantContext | null>(null);

export function TenantContextProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<TenantContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch tenant configuration from database
    async function loadTenantContext() {
      const response = await fetch('/api/tenant/context');
      const data = await response.json();
      setContext(data);
      setLoading(false);
    }
    loadTenantContext();
  }, []);

  if (loading) return <div>Loading tenant configuration...</div>;
  if (!context) return <div>Error loading tenant</div>;

  return (
    <TenantContextContext.Provider value={context}>
      {children}
    </TenantContextContext.Provider>
  );
}

export function useTenantContext(): TenantContext {
  const context = useContext(TenantContextContext);
  if (!context) throw new Error('useTenantContext must be used within TenantContextProvider');
  return context;
}
```

### 2. Module Registry

**Purpose**: Register and lookup module adapters at runtime.

**Implementation**:

```typescript
// src/core/adapters/registry.ts
import type { ModuleAdapter, ModuleId } from '@/core/types';

class ModuleRegistry {
  private adapters = new Map<ModuleId, ModuleAdapter>();

  register(adapter: ModuleAdapter): void {
    if (this.adapters.has(adapter.moduleId)) {
      throw new Error(`Module adapter already registered: ${adapter.moduleId}`);
    }
    this.adapters.set(adapter.moduleId, adapter);
    console.log(`[ModuleRegistry] Registered adapter: ${adapter.moduleName}`);
  }

  get(moduleId: ModuleId): ModuleAdapter | undefined {
    return this.adapters.get(moduleId);
  }

  getRequired(moduleId: ModuleId): ModuleAdapter {
    const adapter = this.get(moduleId);
    if (!adapter) {
      throw new Error(`Module adapter not found: ${moduleId}`);
    }
    return adapter;
  }

  has(moduleId: ModuleId): boolean {
    return this.adapters.has(moduleId);
  }
}

export const moduleRegistry = new ModuleRegistry();
```

### 3. Spa Module Adapter

**Purpose**: Encapsulate spa-specific booking, pricing, and workflow logic.

**Implementation**:

```typescript
// src/modules/spa/adapters/SpaModuleAdapter.ts
import type {
  ModuleAdapter,
  CoreServiceCatalogItem,
  CoreBookingOrder,
  TenantContext,
} from '@/core/types';
import type { SpaPackage, SpaBooking } from '@/modules/spa/types';

export class SpaModuleAdapter implements ModuleAdapter {
  readonly moduleId = 'spa' as const;
  readonly moduleName = 'Bella Spa & Babycare';

  transformServiceItem(item: CoreServiceCatalogItem): SpaPackage {
    return {
      ...item,
      totalSessions: item.metadata.total_sessions as number,
      sessionMultiplier: item.metadata.session_multiplier as number,
      category: item.metadata.category as 'basic' | 'premium' | 'vip',
      durationMinutes: item.metadata.duration_minutes as number,
    };
  }

  transformBookingOrder(order: CoreBookingOrder): SpaBooking {
    return {
      ...order,
      sessionsCompleted: order.metadata.sessions_completed as number,
      sessionsTotal: order.metadata.sessions_total as number,
      assignedKtvId: order.metadata.assigned_ktv_id as string,
      packageCategory: order.metadata.package_category as string,
    };
  }

  async validateBookingRules(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<boolean> {
    // Check KTV availability
    const ktvId = order.metadata.assigned_ktv_id;
    if (!ktvId) return false;

    // Check session limits
    const completed = order.metadata.sessions_completed || 0;
    const total = order.metadata.sessions_total || 0;
    if (completed >= total) return false;

    return true;
  }

  async calculatePricing(
    item: CoreServiceCatalogItem,
    context: TenantContext
  ): Promise<number> {
    // Apply subscription-based discounts
    const discount =
      context.subscriptionPlan === 'enterprise' ? 0.1 : 
      context.subscriptionPlan === 'professional' ? 0.05 : 0;
    return item.basePrice * (1 - discount);
  }

  async onBookingCompleted(
    order: CoreBookingOrder,
    context: TenantContext
  ): Promise<void> {
    // Update KTV salary calculations
    // Deduct inventory (if applicable)
    // Send completion notifications
    console.log(`[SpaAdapter] Booking ${order.id} completed`);
  }

  getModuleWidgets() {
    return [
      { id: 'spa-bookings-today', component: 'SpaBookingsWidget' },
      { id: 'spa-revenue-chart', component: 'SpaRevenueWidget' },
      { id: 'ktv-performance', component: 'KtvPerformanceWidget' },
    ];
  }
}
```

---

## Data Flow

### Booking Creation Flow (After Phase 3)

```
1. User submits order form (spa package purchase)
   ↓
2. API route extracts tenant ID from session
   ↓
3. Middleware constructs TenantContext
   ↓
4. Core order service receives (context, orderData)
   ↓
5. Service looks up module adapter: moduleRegistry.get(context.moduleId)
   ↓
6. Service calls adapter.validateBookingRules(order, context)
   ↓
7. If valid, service creates CoreBookingOrder in database
   ↓
8. Service calls adapter.onBookingCompleted(order, context)
   ↓
9. Response returns CoreBookingOrder to client
```

**Note**: Function parameter name is `orderData`, return type is `CoreBookingOrder`. We keep Phase 2 contract name `CoreBookingOrder` to avoid breaking changes.

---

## Migration Strategy

### Wave-Based Migration Approach

**Wave 1: Foundation** (Week 1-2)
- Create core directory structure
- Implement TenantContext provider
- Implement module registry
- Update API middleware

**Wave 2: Core Services** (Week 3-4)
- Extract auth services to `src/core/services/auth/`
- Extract order services to `src/core/services/order/` (renamed from booking for industry neutrality)
- Extract payment services to `src/core/services/payment/`
- Extract notification services to `src/core/services/notification/`
- Extract audit services to `src/core/services/audit/`
- Extract finance services to `src/core/services/finance/`
- Extract payroll services to `src/core/services/payroll/`
- Extract analytics services to `src/core/services/analytics/`
- Update service signatures to accept TenantContext

**Wave 3: Spa Module** (Week 5-6)
- Implement SpaModuleAdapter
- Extract spa types to `src/modules/spa/types/`
- Extract spa services to `src/modules/spa/services/` (session, salary, package, ktvPerformance)
- Move spa components to `src/modules/spa/components/`

**Note**: Spa services handle module-specific scheduling (sessions), commissions (KTV salary), and business logic. Core services remain industry-neutral.

**Wave 4: Integration** (Week 7-8)
- Update core services to invoke adapters
- Migrate database queries to use contract types
- Update all imports across codebase
- Run full test suite

**Wave 5: Validation** (Week 9-10)
- Run E2E tests
- Performance benchmarking
- UAT with stakeholders
- Production deployment

---

## Testing Strategy

### Unit Tests

- Mock TenantContext in all service unit tests
- Test adapter methods in isolation
- Test module registry registration/lookup
- Verify service functions respect tenant configuration

### Integration Tests

- Test adapter integration with core services
- Test booking flow end-to-end with adapter
- Test payment flow with adapter pricing
- Test notification delivery with adapter

### E2E Tests

- Test full spa order flow (customer purchasing package → payment → session completion → salary calculation)
- Test full payment flow
- Test full session completion flow
- Test full salary calculation flow

**Note**: Tests use "order" terminology for customer-facing flows, but still use `CoreBookingOrder` type internally.

---

## Performance Considerations

### TenantContext Caching

```typescript
// Cache tenant context in Redis for 5 minutes
const TENANT_CONTEXT_CACHE_TTL = 300; // seconds

async function getTenantContext(tenantId: string): Promise<TenantContext> {
  const cached = await redis.get(`tenant:${tenantId}:context`);
  if (cached) return JSON.parse(cached);

  const context = await constructTenantContext(tenantId);
  await redis.setex(`tenant:${tenantId}:context`, TENANT_CONTEXT_CACHE_TTL, JSON.stringify(context));
  return context;
}
```

### Module Adapter Optimization

- Module registry uses in-memory Map (O(1) lookup)
- Adapters instantiated once and reused
- No database queries in adapter methods (use core services)

---

## Rollback Plan

If Phase 3 migration causes critical issues:

1. **Feature Flag Rollback**: Toggle feature flag to use old code paths
2. **Code Rollback**: Revert Git commits to pre-migration state
3. **Database Rollback**: NOT NEEDED (no schema changes)
4. **Cache Invalidation**: Clear Redis cache for tenant contexts

---

## Security Considerations

### Tenant Isolation

- All service functions MUST validate `tenantId` matches authenticated user
- Database queries MUST filter by `tenantId` from TenantContext
- RLS policies remain unchanged and enforced

### Module Adapter Security

- Adapters MUST NOT have direct database access
- Adapters MUST use core services for data operations
- Adapter methods MUST validate input parameters

---

## Next Steps

1. Review and approve this design document
2. Create detailed tasks.md with granular implementation steps
3. Assign development teams to each wave
4. Begin Wave 1 implementation
5. Conduct daily standup to track progress

---

**Document Version**: 1.0  
**Last Updated**: 2025-06-01  
**Status**: Draft - Awaiting Review
