# Spa Module

This directory contains all spa-specific code for the Bella Spa & Babycare ERP system. The spa module is part of the Phase 3 modular architecture that separates industry-specific logic from the core platform.

## Purpose

The spa module encapsulates all business logic, types, components, and services specific to the spa and babycare industry. This includes:

- Spa package management (types, session multipliers, categories)
- KTV (employee) management and performance tracking
- Session tracking and scheduling
- Spa-specific salary calculations (commissions, bonuses, pro-rata)
- Spa-specific UI components and workflows

## Directory Structure

```
src/modules/spa/
├── types/          # Spa-specific TypeScript type definitions
├── adapters/       # SpaModuleAdapter implementation
├── services/       # Spa business logic and data operations
├── components/     # Spa-specific UI components
├── hooks/          # Spa-specific React hooks
└── lib/            # Spa utility functions and helpers
```

## Architecture Principles

### Core Platform Integration

The spa module integrates with the core platform through:

1. **Contract Types**: Uses core contract types (`CoreBookingOrder`, `PaymentIntent`, etc.) as base types and extends them with spa-specific fields stored in the `metadata` field.

2. **Module Adapter**: Implements the `ModuleAdapter` interface to provide spa-specific behavior for validation, pricing, and side effects.

3. **TenantContext**: All services accept `TenantContext` as the first parameter for multi-tenancy support.

### Module Boundaries

- **Core Platform** (`src/core/`): Industry-neutral services (auth, orders, payments, finance, payroll, analytics)
- **Spa Module** (`src/modules/spa/`): Spa-specific logic (sessions, KTV management, spa salary calculations)

The spa module should **never directly access the database**. All data operations must go through core platform services.

## Key Features

### 1. Session Management
- Session scheduling and assignment to KTVs
- Session completion tracking
- Package-based session multipliers (1.0x, 1.5x, 2.0x)
- Decimal session counting (NUMERIC(5,2))

### 2. KTV Performance Tracking
- Performance metrics and ratings
- Customer feedback integration
- Leaderboard calculations
- Commission and bonus tracking

### 3. Spa-Specific Salary Calculations
- Pro-rata base salary calculations
- Session-based bonuses
- KPI bonuses synced from `kpi_records`
- Violation deductions
- Draft vs. finalized salary record handling

### 4. Package Management
- Package categories (basic, premium, VIP)
- Total sessions and session multipliers
- Package-specific pricing and discounts

## Usage Guidelines

### Importing Spa Types

```typescript
import type { SpaPackage, SpaBooking, KtvEmployee } from '@/modules/spa/types';
```

### Using Spa Services

```typescript
import { calculateKtvSalary, getSessionsByBooking } from '@/modules/spa/services/salary';
import { useTenantContext } from '@/core/hooks/useTenantContext';

const context = useTenantContext();
const salary = await calculateKtvSalary(context, ktvId, month);
```

### Using Spa Components

```typescript
import { SpaBookingForm } from '@/modules/spa/components/bookings';
import { KtvPerformanceDashboard } from '@/modules/spa/components/employees';
```

## Development Rules

### Critical Bella ERP Development Rules

When working in the spa module, you must adhere to these rules to prevent regression bugs:

1. **Zero Silent Database Failures**: Never swallow database errors. Always re-throw or return explicit failure status.

2. **Mandatory Side-Effect Assertions**: When testing actions with side effects (session completion → salary update), always query and assert the side-effect tables.

3. **Strict Database Payload Typing**: Use Supabase auto-generated schemas. No `any` or loose object casts.

4. **Atomic Salary Recalculations**: Always use `recalculateAndSaveSalaryRecord` engine. Never partial updates to salary fields.

5. **Pro-Rata and Draft Lifecycle**: Respect draft vs. finalized status. Recalculate only for drafts, preserve manual adjustments otherwise.

6. **Package Session Multipliers**: Always fetch package details and sum sessions using `session_multiplier` coefficients.

## Related Documentation

- [Phase 3 Requirements](/.kiro/specs/phase-3-physical-extraction/requirements.md)
- [Phase 3 Design](/.kiro/specs/phase-3-physical-extraction/design.md)
- [Core Platform Architecture](/docs/architecture/core-platform.md)
- [Module System Guide](/docs/architecture/module-system.md)

## Migration Status

This directory was created as part of **Phase 3 - Wave 3: Spa Module Separation**.

See [Phase 3 Tasks](/.kiro/specs/phase-3-physical-extraction/tasks.md) for migration progress.
