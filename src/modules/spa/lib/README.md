# Spa Module - Library/Utilities

This directory contains utility functions, helpers, and shared logic for the spa module.

## Purpose

The spa library directory provides reusable utility functions that support spa-specific business logic. These utilities handle common operations like data transformation, validation, formatting, and calculations.

## Organization

### Utility Categories

1. **Session Utilities** (`session-utils.ts`)
   - Calculate total sessions with multipliers
   - Convert raw sessions to weighted sessions
   - Format session counts for display
   - Calculate session completion percentage

2. **Salary Utilities** (`salary-utils.ts`)
   - Pro-rata salary calculations
   - Decimal precision handling
   - Salary component aggregation
   - Working days calculation

3. **Validation Utilities** (`validation.ts`)
   - Validate spa booking rules
   - Validate KTV assignments
   - Validate package configurations
   - Type guards for spa types

4. **Formatting Utilities** (`formatting.ts`)
   - Format currency (VND)
   - Format dates and times
   - Format session counts with decimals
   - Format KTV names and roles

5. **Data Transformation** (`transformers.ts`)
   - Transform core types to spa types
   - Transform database rows to domain objects
   - Extract metadata from JSONB fields
   - Type-safe metadata accessors

## Utility Examples

### Session Utilities

```typescript
// src/modules/spa/lib/session-utils.ts
import type { Session, SpaPackage } from '@/modules/spa/types';

/**
 * Calculate total weighted sessions based on package multipliers
 * @param sessions - Array of completed sessions
 * @param packageMultiplier - Package session multiplier (1.0, 1.5, or 2.0)
 * @returns Total weighted sessions with 2 decimal precision
 */
export function calculateWeightedSessions(
  sessions: Session[],
  packageMultiplier: number
): number {
  const total = sessions.reduce((sum, session) => {
    const multiplier = session.multiplier || packageMultiplier;
    return sum + multiplier;
  }, 0);
  
  // Round to 2 decimal places
  return Math.round(total * 100) / 100;
}

/**
 * Calculate session completion percentage
 * @param completed - Number of completed sessions
 * @param total - Total sessions in package
 * @returns Percentage (0-100)
 */
export function calculateCompletionPercentage(
  completed: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Format session count for display with appropriate precision
 * @param count - Session count (may be decimal)
 * @returns Formatted string (e.g., "14.5 ca", "20.0 ca")
 */
export function formatSessionCount(count: number): string {
  const formatted = count % 1 === 0 ? count.toFixed(0) : count.toFixed(1);
  return `${formatted} ca`;
}

/**
 * Get session multiplier for package category
 * @param category - Package category
 * @returns Session multiplier (1.0, 1.5, or 2.0)
 */
export function getSessionMultiplier(
  category: 'basic' | 'premium' | 'vip'
): number {
  const multipliers = {
    basic: 1.0,
    premium: 1.5,
    vip: 2.0,
  };
  return multipliers[category];
}
```

### Salary Utilities

```typescript
// src/modules/spa/lib/salary-utils.ts
import type { SalaryRecord } from '@/modules/spa/types';

/**
 * Calculate pro-rata base salary based on working days
 * @param monthlyBaseSalary - Full monthly base salary
 * @param workingDays - Actual working days
 * @param totalDays - Total working days in month (typically 26)
 * @returns Pro-rata base salary
 */
export function calculateProRataBaseSalary(
  monthlyBaseSalary: number,
  workingDays: number,
  totalDays: number = 26
): number {
  if (totalDays === 0) return 0;
  return Math.round((monthlyBaseSalary / totalDays) * workingDays);
}

/**
 * Calculate total salary from all components
 * @param record - Salary record with all components
 * @returns Total salary amount
 */
export function calculateTotalSalary(record: Partial<SalaryRecord>): number {
  const base = record.baseSalary || 0;
  const sessionBonus = record.sessionBonus || 0;
  const kpiBonus = record.kpiBonus || 0;
  const ratingBonus = record.ratingBonus || 0;
  const servicePercentage = record.servicePercentageBonus || 0;
  const deductions = record.violationsDeduction || 0;
  
  return base + sessionBonus + kpiBonus + ratingBonus - deductions - servicePercentage;
}

/**
 * Check if salary record is in draft status
 * @param record - Salary record
 * @returns True if draft or no status
 */
export function isSalaryDraft(record: SalaryRecord | null | undefined): boolean {
  return !record || record.status === 'draft';
}

/**
 * Calculate working days in month from attendance records
 * @param attendanceRecords - Array of attendance records
 * @returns Number of working days (excluding absents)
 */
export function calculateWorkingDays(
  attendanceRecords: Array<{ status: string }>
): number {
  return attendanceRecords.filter(record => record.status !== 'absent').length;
}

/**
 * Format salary amount with VND currency
 * @param amount - Salary amount
 * @returns Formatted string (e.g., "5,000,000 VND")
 */
export function formatSalary(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} VND`;
}
```

### Validation Utilities

```typescript
// src/modules/spa/lib/validation.ts
import type { SpaBooking, SpaPackage, KtvEmployee } from '@/modules/spa/types';

/**
 * Validate spa booking has all required fields
 * @param booking - Booking to validate
 * @returns True if valid
 */
export function validateSpaBooking(booking: Partial<SpaBooking>): boolean {
  return !!(
    booking.packageId &&
    booking.customerId &&
    booking.metadata?.assigned_ktv_id &&
    booking.metadata?.sessions_total > 0
  );
}

/**
 * Validate KTV is available for booking
 * @param ktv - KTV employee
 * @param scheduledDate - Booking date
 * @returns True if available
 */
export function validateKtvAvailability(
  ktv: KtvEmployee,
  scheduledDate: Date
): boolean {
  // Check if KTV is active
  if (ktv.status !== 'active') return false;
  
  // Add additional availability checks (schedule, max bookings, etc.)
  return true;
}

/**
 * Validate package configuration
 * @param pkg - Spa package
 * @returns True if valid
 */
export function validatePackageConfig(pkg: SpaPackage): boolean {
  return !!(
    pkg.totalSessions > 0 &&
    pkg.sessionMultiplier > 0 &&
    pkg.basePrice > 0 &&
    ['basic', 'premium', 'vip'].includes(pkg.category)
  );
}

/**
 * Type guard for SpaBooking
 * @param obj - Object to check
 * @returns True if obj is SpaBooking
 */
export function isSpaBooking(obj: unknown): obj is SpaBooking {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'packageId' in obj &&
    'customerId' in obj &&
    'metadata' in obj
  );
}

/**
 * Validate session count is within package limits
 * @param completed - Completed sessions
 * @param total - Total sessions
 * @returns True if within limits
 */
export function validateSessionLimits(
  completed: number,
  total: number
): boolean {
  return completed >= 0 && completed <= total;
}
```

### Data Transformation

```typescript
// src/modules/spa/lib/transformers.ts
import type { CoreBookingOrder, CoreServiceCatalogItem } from '@/core/types';
import type { SpaBooking, SpaPackage, SpaBookingMetadata } from '@/modules/spa/types';

/**
 * Transform CoreBookingOrder to SpaBooking
 * @param order - Core booking order
 * @returns Spa-specific booking
 */
export function toSpaBooking(order: CoreBookingOrder): SpaBooking {
  const metadata = order.metadata as SpaBookingMetadata;
  
  return {
    ...order,
    sessionsCompleted: metadata.sessions_completed || 0,
    sessionsTotal: metadata.sessions_total || 0,
    assignedKtvId: metadata.assigned_ktv_id || '',
    packageCategory: metadata.package_category || 'basic',
  };
}

/**
 * Transform CoreServiceCatalogItem to SpaPackage
 * @param item - Core service catalog item
 * @returns Spa package
 */
export function toSpaPackage(item: CoreServiceCatalogItem): SpaPackage {
  return {
    ...item,
    totalSessions: item.metadata.total_sessions as number || 0,
    sessionMultiplier: item.metadata.session_multiplier as number || 1.0,
    category: (item.metadata.category as 'basic' | 'premium' | 'vip') || 'basic',
    durationMinutes: item.metadata.duration_minutes as number || 60,
  };
}

/**
 * Extract and validate spa booking metadata
 * @param order - Core booking order
 * @returns Typed spa booking metadata
 */
export function extractSpaMetadata(order: CoreBookingOrder): SpaBookingMetadata {
  const metadata = order.metadata as Record<string, unknown>;
  
  return {
    sessions_completed: Number(metadata.sessions_completed || 0),
    sessions_total: Number(metadata.sessions_total || 0),
    assigned_ktv_id: String(metadata.assigned_ktv_id || ''),
    package_category: (metadata.package_category as 'basic' | 'premium' | 'vip') || 'basic',
  };
}

/**
 * Convert database row to SpaPackage domain object
 * @param row - Database row from packages table
 * @returns Spa package domain object
 */
export function dbRowToSpaPackage(row: any): SpaPackage {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    moduleId: row.module_id,
    name: row.name,
    description: row.description,
    basePrice: row.base_price,
    metadata: row.metadata,
    totalSessions: row.metadata.total_sessions,
    sessionMultiplier: row.metadata.session_multiplier,
    category: row.metadata.category,
    durationMinutes: row.metadata.duration_minutes,
  };
}
```

### Formatting Utilities

```typescript
// src/modules/spa/lib/formatting.ts

/**
 * Format Vietnamese currency
 * @param amount - Amount in VND
 * @returns Formatted string (e.g., "5,000,000 ₫")
 */
export function formatVND(amount: number): string {
  return `${amount.toLocaleString('vi-VN')} ₫`;
}

/**
 * Format date in Vietnamese locale
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format KTV name with role
 * @param ktv - KTV employee
 * @returns Formatted name (e.g., "Nguyễn Thị A (KTV Chính)")
 */
export function formatKtvName(ktv: { name: string; role: string }): string {
  return `${ktv.name} (${ktv.role})`;
}

/**
 * Format month for display
 * @param month - Month string (YYYY-MM)
 * @returns Formatted month (e.g., "Tháng 01/2025")
 */
export function formatMonth(month: string): string {
  const [year, monthNum] = month.split('-');
  return `Tháng ${monthNum}/${year}`;
}

/**
 * Format decimal with precision
 * @param value - Number to format
 * @param precision - Decimal places (default: 2)
 * @returns Formatted number
 */
export function formatDecimal(value: number, precision: number = 2): string {
  return value.toFixed(precision);
}
```

## Utility Guidelines

### 1. Pure Functions

All utilities should be pure functions (no side effects):

```typescript
// ✅ GOOD: Pure function
export function calculateTotal(a: number, b: number): number {
  return a + b;
}

// ❌ BAD: Side effects (database call)
export async function calculateTotalWithDb(id: string): Promise<number> {
  const data = await db.query(id); // Side effect
  return data.total;
}
```

### 2. Type Safety

All utilities should have proper TypeScript types:

```typescript
// ✅ GOOD: Proper types
export function formatSessionCount(count: number): string {
  return `${count.toFixed(1)} ca`;
}

// ❌ BAD: Using 'any'
export function formatSessionCount(count: any): any {
  return `${count} ca`;
}
```

### 3. Error Handling

Utilities should validate inputs and throw descriptive errors:

```typescript
export function calculateProRataBaseSalary(
  monthlyBaseSalary: number,
  workingDays: number,
  totalDays: number = 26
): number {
  if (totalDays <= 0) {
    throw new Error('Total days must be greater than 0');
  }
  if (workingDays < 0) {
    throw new Error('Working days cannot be negative');
  }
  if (workingDays > totalDays) {
    throw new Error('Working days cannot exceed total days');
  }
  
  return Math.round((monthlyBaseSalary / totalDays) * workingDays);
}
```

### 4. Documentation

All utilities should have JSDoc comments:

```typescript
/**
 * Calculate weighted sessions based on package multipliers.
 * 
 * Supports decimal session counts for accurate commission calculations.
 * 
 * @param sessions - Array of completed sessions
 * @param packageMultiplier - Package session multiplier (1.0, 1.5, or 2.0)
 * @returns Total weighted sessions with 2 decimal precision
 * 
 * @example
 * const sessions = [{ multiplier: 1.5 }, { multiplier: 1.5 }];
 * const total = calculateWeightedSessions(sessions, 1.0);
 * // Returns: 3.0
 */
export function calculateWeightedSessions(
  sessions: Session[],
  packageMultiplier: number
): number {
  // Implementation
}
```

## Testing Strategy

### Unit Tests

Test all utilities with comprehensive test cases:

```typescript
describe('calculateProRataBaseSalary', () => {
  it('should calculate full salary for full month', () => {
    const result = calculateProRataBaseSalary(5_000_000, 26, 26);
    expect(result).toBe(5_000_000);
  });
  
  it('should calculate pro-rata for partial month', () => {
    const result = calculateProRataBaseSalary(5_000_000, 13, 26);
    expect(result).toBe(2_500_000);
  });
  
  it('should throw error for invalid total days', () => {
    expect(() => {
      calculateProRataBaseSalary(5_000_000, 13, 0);
    }).toThrow('Total days must be greater than 0');
  });
  
  it('should handle decimal precision correctly', () => {
    const result = calculateProRataBaseSalary(5_000_000, 15, 26);
    expect(result).toBe(2_884_615); // Rounded
  });
});
```

### Edge Cases

Test edge cases and boundary conditions:

```typescript
describe('calculateWeightedSessions', () => {
  it('should handle empty sessions array', () => {
    const result = calculateWeightedSessions([], 1.0);
    expect(result).toBe(0);
  });
  
  it('should handle decimal multipliers correctly', () => {
    const sessions = [{ multiplier: 1.5 }];
    const result = calculateWeightedSessions(sessions, 1.0);
    expect(result).toBe(1.5);
  });
  
  it('should round to 2 decimal places', () => {
    const sessions = [{ multiplier: 1.333 }];
    const result = calculateWeightedSessions(sessions, 1.0);
    expect(result).toBe(1.33);
  });
});
```

## Critical Development Rules

### 1. Never Modify Input Parameters

Utilities should not mutate input parameters:

```typescript
// ❌ BAD: Mutates input
export function sortSessions(sessions: Session[]): Session[] {
  return sessions.sort((a, b) => a.date - b.date);
}

// ✅ GOOD: Returns new array
export function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => a.date - b.date);
}
```

### 2. Consistent Decimal Precision

Always use consistent decimal precision for monetary values:

```typescript
// ✅ GOOD: Consistent rounding
export function calculateTotal(amounts: number[]): number {
  const sum = amounts.reduce((a, b) => a + b, 0);
  return Math.round(sum); // Round to integer for VND
}
```

### 3. Type Guards for Runtime Safety

Use type guards when working with unknown data:

```typescript
export function isSpaBooking(obj: unknown): obj is SpaBooking {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'packageId' in obj &&
    'customerId' in obj
  );
}

// Usage
export function processSpaBooking(data: unknown): void {
  if (!isSpaBooking(data)) {
    throw new Error('Invalid spa booking data');
  }
  
  // TypeScript knows data is SpaBooking here
  console.log(data.packageId);
}
```

## Related Documentation

- [Phase 3 Requirements - REQ-3.4.1](/.kiro/specs/phase-3-physical-extraction/requirements.md)
- [Spa Services](/src/modules/spa/services/README.md)
- [Spa Types](/src/modules/spa/types/README.md)

## Migration Status

This directory structure was created as part of **Phase 3 - Task 13.1**.

Spa utility functions will be extracted and organized in this directory during **Wave 3**.
