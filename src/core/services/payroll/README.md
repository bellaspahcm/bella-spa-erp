# Payroll Services

This directory contains services for employee compensation calculations and payroll cycle management.

## Purpose

Provides core payroll logic for base salary calculations and payroll cycles. Module-specific compensation logic (e.g., spa KTV commissions, session bonuses) is handled by module adapters.

## Key Services

### Base Salary Calculation
- Calculate employee base salary
- Handle pro-rata salary for partial months
- Apply standard deductions
- Support multiple pay periods

### Payroll Cycle Management
- Create and manage payroll cycles
- Lock payroll after approval
- Handle payroll adjustments
- Support payroll calendar

### Payroll Reports
- Generate payroll summary reports
- Export payroll data (Excel, PDF)
- Track payroll history
- Support multi-tenant payroll

## Usage Patterns

### 1. Calculating Base Salary

```typescript
import { calculateBaseSalary } from '@/core/services/payroll';

const salary = await calculateBaseSalary(context, {
  employeeId: 'emp-123',
  baseSalary: 10000000,
  workingDays: 20,
  totalDays: 26
});

// Returns: 7692307 (pro-rata: 10000000 / 26 * 20)
```

### 2. Creating a Payroll Cycle

```typescript
import { createPayrollCycle } from '@/core/services/payroll';

const cycle = await createPayrollCycle(context, {
  period: '2025-01',
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  status: 'draft'
});
```

### 3. Generating Payroll Report

```typescript
import { generatePayrollReport } from '@/core/services/payroll/reports';

const report = await generatePayrollReport(context, {
  cycleId: cycle.id,
  format: 'excel'
});
```

## Payroll Status Flow

```
draft → pending_approval → approved → paid
       ↓
    cancelled
```

## Module-Specific Compensation

Core payroll handles base salary only. Module adapters handle industry-specific compensation:

**Spa Module:**
- KTV session commissions
- Session bonuses based on package multipliers
- KPI bonuses from performance metrics
- Violation deductions
- Rating bonuses

**Cleaning Module (future):**
- Job completion bonuses
- Equipment maintenance bonuses

**Home Service Module (future):**
- Visit completion bonuses
- Customer satisfaction bonuses

## Tenant Isolation

All payroll queries filter by `tenantId` from TenantContext to ensure tenant isolation.

## Integration with Other Services

- Uses audit service for payroll change tracking
- Uses notification service for payroll alerts
- Module adapters provide industry-specific calculations
