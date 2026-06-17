# Spa Module - Types

This directory contains all TypeScript type definitions specific to the spa and babycare industry.

## Purpose

The spa types directory provides type safety for spa-specific domain entities that extend beyond the core platform contract types. These types represent spa-specific business concepts and data structures.

## Organization

### Core Type Categories

1. **Package Types** (`package.ts`)
   - Spa package definitions
   - Package categories (basic, premium, VIP)
   - Session multipliers (1.0x, 1.5x, 2.0x)
   - Total sessions and pricing tiers

2. **Booking Types** (`booking.ts`)
   - Spa-specific booking extensions
   - Session tracking (completed vs. total)
   - KTV assignments
   - Package category metadata

3. **Employee Types** (`employee.ts`)
   - KTV (employee) profiles
   - Employee roles and permissions
   - Performance metrics
   - Commission tiers

4. **Session Types** (`session.ts`)
   - Session scheduling
   - Session status (scheduled, completed, cancelled)
   - Session multiplier calculations
   - KTV assignments per session

5. **Salary Types** (`salary.ts`)
   - KTV salary record structure
   - Pro-rata base salary calculations
   - Session bonuses and commissions
   - KPI bonuses and violation deductions
   - Salary record status (draft, pending, approved, finalized)

## Relationship to Core Types

Spa types **extend** core platform contract types defined in `src/core/types/`:

```typescript
// Core contract type (industry-neutral)
import type { CoreBookingOrder } from '@/core/types';

// Spa-specific extension
export interface SpaBooking extends CoreBookingOrder {
  // Spa-specific fields stored in metadata
  sessionsCompleted: number;
  sessionsTotal: number;
  assignedKtvId: string;
  packageCategory: 'basic' | 'premium' | 'vip';
}
```

## Type Safety Principles

### 1. Strict Database Typing

All database operations use Supabase auto-generated schemas:

```typescript
import type { Database } from '@/types/supabase';

type SalaryRecordInsert = Database['public']['Tables']['salary_records']['Insert'];
type SalaryRecordRow = Database['public']['Tables']['salary_records']['Row'];
```

**Never use `any` or loose object types** for database payloads.

### 2. Metadata Field Typing

Spa-specific fields are stored in the `metadata` JSONB field of core tables. Use type guards and strict typing:

```typescript
export interface SpaBookingMetadata {
  sessions_completed: number;
  sessions_total: number;
  assigned_ktv_id: string;
  package_category: 'basic' | 'premium' | 'vip';
}

// Type guard for runtime validation
export function isSpaBookingMetadata(
  metadata: unknown
): metadata is SpaBookingMetadata {
  return (
    typeof metadata === 'object' &&
    metadata !== null &&
    'sessions_completed' in metadata &&
    typeof metadata.sessions_completed === 'number'
  );
}
```

### 3. Decimal Precision for Session Counts

Session counts support decimal values due to package multipliers:

```typescript
export interface SessionCount {
  totalSessions: number; // NUMERIC(5,2) - supports 14.5, 21.0, etc.
  sessionMultiplier: number; // 1.0, 1.5, or 2.0
}
```

## Usage Examples

### Importing Spa Types

```typescript
// Import specific types
import type { SpaPackage, SpaBooking } from '@/modules/spa/types/package';
import type { KtvEmployee, KtvPerformance } from '@/modules/spa/types/employee';

// Import all spa types (via barrel export)
import type { SpaPackage, SpaBooking, KtvEmployee } from '@/modules/spa/types';
```

### Type Transformation

The `SpaModuleAdapter` transforms core types to spa types:

```typescript
import type { CoreBookingOrder } from '@/core/types';
import type { SpaBooking } from '@/modules/spa/types';

function transformToSpaBooking(order: CoreBookingOrder): SpaBooking {
  return {
    ...order,
    sessionsCompleted: order.metadata.sessions_completed as number,
    sessionsTotal: order.metadata.sessions_total as number,
    assignedKtvId: order.metadata.assigned_ktv_id as string,
    packageCategory: order.metadata.package_category as 'basic' | 'premium' | 'vip',
  };
}
```

## Validation

All spa types should have corresponding validation functions:

```typescript
export function validateSpaPackage(pkg: unknown): pkg is SpaPackage {
  // Runtime validation logic
}

export function validateKtvSalaryRecord(record: unknown): record is KtvSalaryRecord {
  // Runtime validation logic
}
```

## Critical Development Rules

When defining or modifying spa types:

1. **Never add non-existent columns**: If a field doesn't exist in the database schema (e.g., adding `notes` to `attendance` table), TypeScript compilation must fail.

2. **Preserve backward compatibility**: New fields should be optional (`?`) unless a database migration adds them as required.

3. **Document metadata structure**: If a type uses metadata fields, document the exact structure in the type definition.

4. **Use strict enums**: Prefer union types over string literals for status fields:
   ```typescript
   type SalaryStatus = 'draft' | 'pending_approval' | 'approved' | 'finalized';
   ```

## Related Documentation

- [Phase 3 Requirements - REQ-3.4.2](/.kiro/specs/phase-3-physical-extraction/requirements.md)
- [Core Platform Types](/src/core/types/README.md)
- [Database Schema](/docs/database-schema.md)

## Migration Status

This directory structure was created as part of **Phase 3 - Task 13.1**.

Spa-specific types were successfully migrated to this directory in **Task 13.2** (✅ Completed).

### Extracted Type Files

The following type files were created and populated with spa-specific types:

1. **`package.ts`** - Extracted from:
   - `src/app/dashboard/services/types.ts` (ServicePackage, ServiceFormState)
   - `src/lib/business-rules/salary.ts` (PackageMultiplierLike, SessionPackageLike)
   - `src/lib/business-rules/inventory.ts` (PackageMaterialInput, SessionMaterialLike)
   - `src/services/package-actions.ts` (PackageActionInput)
   - `src/types/domain.ts` (HqPackageTemplate)

2. **`booking.ts`** - Extracted from:
   - `src/lib/business-rules/session-completion.ts` (BookingCompletionStatus, BookingCompletionSnapshot)
   - `src/lib/business-rules/payment.ts` (BookingPaymentStateInput, BookingPaymentState)
   - `src/lib/business-rules/booking-resource.ts` (BookingResourceInput, BookingResourcePayload)
   - `src/lib/business-rules/financial-integrity.ts` (BookingFinancialIntegritySnapshot)
   - `src/app/dashboard/services/types.ts` (BookingResourceFormState)
   - `src/core/services/order/invoice-print-actions.ts` (BookingInvoicePrintLog)

3. **`employee.ts`** - Extracted from:
   - `src/types/domain.ts` (KtvAttendanceLog, KtvAttendanceSummary, KtvSessionMatrix)
   - `src/core/services/analytics/dashboard-actions.ts` (KtvPerformanceViewModel)
   - `src/types/rpc.ts` (KtvLeaderboardRow)
   - `src/app/dashboard/customers/[id]/types.ts` (KtvOption)
   - `src/app/dashboard/sessions/types.ts` (KtvUser)

4. **`session.ts`** - Extracted from:
   - `src/app/dashboard/sessions/types.ts` (SessionLog, SessionBooking, ConflictSession, LeaveRequest, KtvUser)
   - `src/lib/business-rules/payment.ts` (SessionRevenueRecognitionInput, SessionRevenueRecognition)
   - `src/lib/business-rules/salary.ts` (SessionLike, SessionBookingLike)
   - `src/modules/hr-salary/actions/base-salary-actions.ts` (KtvSalaryConfirmationSession)

5. **`salary.ts`** - Extracted from:
   - `src/types/domain.ts` (KtvSalaryRecord, TenantSalaryConfig)
   - `src/lib/business-rules/salary.ts` (All salary calculation types)
   - `src/services/salary-reconciliation-actions.ts` (SalaryReconRow, SalaryReconSummary)
   - `src/modules/hr-salary/actions/salary-recalculation-engine.ts` (SalaryRecordDbAdmin, SalaryRecalculationOverrides)
   - `src/core/services/analytics/export-actions.ts` (SalaryExportSnapshot)

All types maintain backward compatibility with existing database schemas and contracts.
