# Spa Module - Services

This directory contains all spa-specific business logic and data operations for the Bella Spa & Babycare ERP system.

## Purpose

The spa services directory provides spa-specific business logic that extends beyond the core platform capabilities. These services handle domain-specific calculations, workflows, and data transformations unique to the spa industry.

## Organization

### Service Categories

1. **Session Management** (`session.ts`)
   - Session scheduling and assignment to KTVs
   - Session completion tracking
   - Session multiplier calculations (1.0x, 1.5x, 2.0x)
   - Decimal session counting (NUMERIC(5,2))

2. **Salary Calculations** (`salary.ts`)
   - KTV salary pro-rata calculations
   - Session-based bonuses and commissions
   - KPI bonus synchronization from `kpi_records` table
   - Violation deductions
   - Draft vs. finalized salary record lifecycle
   - Central `recalculateAndSaveSalaryRecord()` engine

3. **KTV Performance Tracking** (`ktvPerformance.ts`)
   - Performance metrics and ratings
   - Customer feedback aggregation
   - Leaderboard calculations
   - Commission tier tracking

4. **Package Management** (`package.ts`)
   - Package session multiplier handling
   - Package category logic (basic, premium, VIP)
   - Package validity and expiration checks
   - Package pricing and discount rules

## Service Architecture Principles

### 1. Core Platform Integration

Spa services **extend** core platform services, not replace them:

```typescript
// Core platform handles generic orders
import { createOrder as createCoreOrder } from '@/core/services/order';

// Spa service adds spa-specific logic
export async function createSpaBooking(
  context: TenantContext,
  bookingData: SpaBookingInput
): Promise<CoreBookingOrder> {
  // Add spa-specific metadata
  const orderData = {
    ...bookingData,
    metadata: {
      sessions_total: bookingData.packageTotalSessions,
      sessions_completed: 0,
      assigned_ktv_id: bookingData.ktvId,
      package_category: bookingData.category,
    },
  };
  
  // Use core service to create order
  return await createCoreOrder(context, orderData);
}
```

### 2. TenantContext-Aware

All service functions accept `TenantContext` as the first parameter:

```typescript
export async function calculateKtvSalary(
  context: TenantContext,
  ktvId: string,
  month: string
): Promise<SalaryRecord> {
  // Use context.tenantId for database filtering
  // Use context.features for feature flag checks
  // Use context.settings for tenant-specific configurations
}
```

### 3. Contract Type Usage

Services use core contract types and extend them with spa-specific fields:

```typescript
import type { CoreBookingOrder } from '@/core/types';
import type { SpaBooking } from '@/modules/spa/types';

// Transform core type to spa type
export function toSpaBooking(order: CoreBookingOrder): SpaBooking {
  return {
    ...order,
    sessionsCompleted: order.metadata.sessions_completed as number,
    sessionsTotal: order.metadata.sessions_total as number,
    assignedKtvId: order.metadata.assigned_ktv_id as string,
  };
}
```

### 4. No Direct Database Access

Services use core platform services or Supabase with strict typing:

```typescript
import type { Database } from '@/types/supabase';
import { supabase } from '@/lib/supabase';

type SalaryRecordInsert = Database['public']['Tables']['salary_records']['Insert'];

export async function saveSalaryRecord(
  context: TenantContext,
  record: SalaryRecordInsert
): Promise<SalaryRecord> {
  const { data, error } = await supabase
    .from('salary_records')
    .insert({ ...record, tenant_id: context.tenantId })
    .select()
    .single();
  
  if (error) throw error; // NEVER swallow database errors
  return data;
}
```

## Key Service Functions

### Session Management

```typescript
// Get sessions by booking
export async function getSessionsByBooking(
  context: TenantContext,
  bookingId: string
): Promise<Session[]>;

// Complete a session and update salary
export async function completeSession(
  context: TenantContext,
  sessionId: string
): Promise<Session>;

// Calculate total sessions with multiplier
export async function calculateTotalSessions(
  context: TenantContext,
  bookingId: string
): Promise<number>;
```

### Salary Calculations

```typescript
// Central salary recalculation engine
export async function recalculateAndSaveSalaryRecord(
  context: TenantContext,
  ktvId: string,
  month: string,
  overrides?: Partial<SalaryRecord>
): Promise<SalaryRecord>;

// Get salary data for display
export async function getSalaryData(
  context: TenantContext,
  ktvId: string,
  month: string
): Promise<SalaryRecord>;

// Pro-rata base salary calculation
export async function calculateProRataBaseSalary(
  context: TenantContext,
  ktvId: string,
  month: string
): Promise<number>;
```

### KTV Performance Tracking

```typescript
// Get KTV performance metrics
export async function getKtvPerformance(
  context: TenantContext,
  ktvId: string,
  period: DateRange
): Promise<KtvPerformance>;

// Calculate KTV leaderboard
export async function calculateLeaderboard(
  context: TenantContext,
  month: string
): Promise<KtvLeaderboardEntry[]>;

// Sync KPI bonus to salary record
export async function syncKpiBonus(
  context: TenantContext,
  ktvId: string,
  month: string
): Promise<void>;
```

### Package Management

```typescript
// Get package by ID with session multiplier
export async function getPackageById(
  context: TenantContext,
  packageId: string
): Promise<SpaPackage>;

// Calculate package-adjusted sessions
export async function calculatePackageSessions(
  context: TenantContext,
  packageId: string,
  rawSessions: number
): Promise<number>;
```

## Critical Development Rules

When implementing or modifying spa services, you **must** adhere to these rules:

### 1. Zero Silent Database Failures

❌ **WRONG**:
```typescript
try {
  await supabase.from('salary_records').insert(record);
} catch (error) {
  console.error('Error saving salary:', error);
  return { success: true }; // NEVER DO THIS
}
```

✅ **CORRECT**:
```typescript
const { data, error } = await supabase.from('salary_records').insert(record);
if (error) throw error; // Re-throw or return explicit failure
return { success: true, data };
```

### 2. Atomic Salary Recalculations

Always use the central `recalculateAndSaveSalaryRecord()` engine:

❌ **WRONG**:
```typescript
// Partial update - FORBIDDEN
await supabase
  .from('salary_records')
  .update({ total_sessions: newCount })
  .eq('ktv_id', ktvId);
```

✅ **CORRECT**:
```typescript
// Atomic recalculation
await recalculateAndSaveSalaryRecord(context, ktvId, month);
```

### 3. Pro-Rata and Draft Lifecycle Integrity

Respect salary record status:

```typescript
export async function recalculateAndSaveSalaryRecord(
  context: TenantContext,
  ktvId: string,
  month: string,
  overrides?: Partial<SalaryRecord>
): Promise<SalaryRecord> {
  const existing = await getSalaryRecord(context, ktvId, month);
  
  // Only recalculate if draft or no existing record
  const isDraft = !existing || existing.status === 'draft';
  
  if (isDraft) {
    // Recalculate pro-rata base salary
    const baseSalary = await calculateProRataBaseSalary(context, ktvId, month);
    // Recalculate auto-deductions
    const deductions = await calculateViolationDeductions(context, ktvId, month);
    // ... other dynamic calculations
  } else {
    // Preserve manual adjustments for non-draft records
    // Only update if overrides provided
  }
}
```

### 4. Package Session Multipliers

Always fetch package details and use session multipliers:

❌ **WRONG**:
```typescript
const sessions = await getSessionsByBooking(context, bookingId);
const totalSessions = sessions.length; // Ignores multipliers
```

✅ **CORRECT**:
```typescript
const sessions = await getSessionsByBooking(context, bookingId);
const pkg = await getPackageById(context, booking.packageId);
const totalSessions = sessions.reduce(
  (sum, session) => sum + (session.multiplier || pkg.sessionMultiplier),
  0
);
```

### 5. Mandatory Side-Effect Execution

When completing sessions, ensure side effects execute:

```typescript
export async function completeSession(
  context: TenantContext,
  sessionId: string
): Promise<Session> {
  // Mark session as completed
  const session = await markSessionCompleted(context, sessionId);
  
  // CRITICAL: Trigger salary recalculation
  const booking = await getBookingById(context, session.bookingId);
  await recalculateAndSaveSalaryRecord(
    context,
    booking.metadata.assigned_ktv_id,
    getCurrentMonth()
  );
  
  return session;
}
```

### 6. Strict Database Payload Typing

Use Supabase auto-generated schemas:

```typescript
import type { Database } from '@/types/supabase';

type SalaryRecordInsert = Database['public']['Tables']['salary_records']['Insert'];
type AttendanceInsert = Database['public']['Tables']['attendance']['Insert'];

// TypeScript will catch non-existent columns at compile-time
const record: SalaryRecordInsert = {
  ktv_id: ktvId,
  month: month,
  base_salary: baseSalary,
  // notes: 'test', // ❌ Compile error if 'notes' column doesn't exist
};
```

## Testing Strategy

### Unit Tests

Test service functions in isolation:

```typescript
describe('calculateKtvSalary', () => {
  it('should calculate pro-rata base salary correctly', async () => {
    const context = createMockTenantContext();
    const salary = await calculateKtvSalary(context, 'ktv-1', '2025-01');
    
    expect(salary.baseSalary).toBeCloseTo(expectedProRata);
  });
});
```

### Integration Tests with Side-Effect Assertions

Test side effects are executed:

```typescript
describe('completeSession', () => {
  it('should update KTV salary when session completed', async () => {
    const context = createMockTenantContext();
    
    // Complete session
    await completeSession(context, 'session-1');
    
    // CRITICAL: Assert salary was updated
    const salary = await getSalaryRecord(context, 'ktv-1', '2025-01');
    expect(salary.totalSessions).toBe(15.5); // Includes multiplier
  });
});
```

## Related Documentation

- [Phase 3 Requirements - REQ-3.4.4](/.kiro/specs/phase-3-physical-extraction/requirements.md)
- [Bella ERP Development Rules](/AGENTS.md)
- [Core Services](/src/core/services/README.md)
- [Spa Types](/src/modules/spa/types/README.md)

## Migration Status

This directory structure was created as part of **Phase 3 - Task 13.1**.

Spa-specific services will be migrated to this directory in **Tasks 15.1-15.4**.
