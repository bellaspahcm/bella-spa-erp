# Spa Order Components

This directory contains spa-specific order/booking UI components.

## Components

- Order forms for spa package purchases
- Order list and detail views
- Session scheduling and tracking interfaces
- KTV assignment components

## Usage

```tsx
import { SpaOrderForm } from '@/modules/spa/components/order';
```

## Architecture

These components:
- Use `CoreBookingOrder` as the base type
- Extend with spa-specific fields (sessions, KTV assignment, package tier)
- Use `useTenantContext()` for tenant-aware data fetching
- Delegate business logic to `@/modules/spa/services/`

