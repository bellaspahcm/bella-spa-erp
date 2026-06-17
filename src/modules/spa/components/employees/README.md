# Spa Employee Management Components

This directory contains spa-specific KTV/employee management UI components.

## Components

- KTV list and profile views
- KTV performance dashboards
- KTV leaderboards
- KTV assignment interfaces
- Employee scheduling components

## Usage

```tsx
import { KtvLeaderboard } from '@/modules/spa/components/employees';
```

## Architecture

These components:
- Use spa employee types from `@/modules/spa/types/employee`
- Use `SpaKtvPerformanceService` for performance data
- Display KTV-specific metrics (sessions completed, ratings, KPI bonuses)

