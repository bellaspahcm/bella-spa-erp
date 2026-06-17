# Spa Salary Management Components

This directory contains spa-specific salary calculation and management UI components.

## Components

- Salary calculation dashboards
- Salary reconciliation reports
- Salary approval workflows
- KTV commission breakdowns
- Pro-rata salary displays

## Usage

```tsx
import { SalaryDashboard, SalaryReconciliation } from '@/modules/spa/components/salary';
```

## Architecture

These components:
- Use spa salary types from `@/modules/spa/types/salary`
- Use `SpaSalaryService` for salary operations
- Display decimal session counts (NUMERIC(5,2))
- Show commission breakdowns (session bonus, KPI bonus, rating bonus)
- Respect draft vs. finalized salary record statuses

