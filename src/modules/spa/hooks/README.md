# Spa Module - Hooks

This directory contains React hooks for spa-specific state management and data fetching.

## Purpose

The spa hooks directory provides reusable React hooks that encapsulate spa-specific business logic and state management. These hooks bridge spa services and React components, providing a clean API for component state.

## Organization

### Hook Categories

1. **Order Hooks** (`useSpaBooking.ts`, `useSpaOrder.ts`)
   - Fetch spa bookings/orders with session tracking
   - Create and update spa bookings
   - Handle booking state (loading, error, data)

2. **Session Hooks** (`useSpaSession.ts`)
   - Fetch sessions by booking
   - Complete sessions with side effects
   - Track session counts with multipliers

3. **Salary Hooks** (`useSalary.ts`, `useKtvSalary.ts`)
   - Fetch KTV salary data
   - Trigger salary recalculation
   - Handle draft vs. finalized status

4. **Package Hooks** (`useSpaPackage.ts`)
   - Fetch spa packages with categories
   - Filter packages by category
   - Handle package selection state

5. **KTV Hooks** (`useKtv.ts`, `useKtvPerformance.ts`)
   - Fetch KTV employee data
   - Track KTV performance metrics
   - Fetch leaderboard data

## Hook Architecture Principles

### 1. Use TenantContext

All hooks should use `useTenantContext()` to get tenant configuration:

```typescript
import { useTenantContext } from '@/core/hooks/useTenantContext';

export function useSpaBooking(bookingId: string) {
  const context = useTenantContext();
  
  // Use context in service calls
  const { data, error, isLoading } = useSWR(
    ['booking', bookingId],
    () => getBookingById(context, bookingId)
  );
  
  return { booking: data, error, loading: isLoading };
}
```

### 2. Use SWR for Data Fetching

Use SWR (or React Query) for data fetching with caching:

```typescript
import useSWR from 'swr';
import { getSalaryData } from '@/modules/spa/services/salary';

export function useKtvSalary(ktvId: string, month: string) {
  const context = useTenantContext();
  
  const { data, error, mutate } = useSWR(
    ['salary', ktvId, month],
    () => getSalaryData(context, ktvId, month),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  );
  
  return {
    salary: data,
    error,
    loading: !data && !error,
    refresh: mutate,
  };
}
```

### 3. Provide Action Methods

Hooks should provide methods for mutations:

```typescript
export function useSpaBooking(bookingId: string) {
  const context = useTenantContext();
  const { data, mutate } = useSWR(['booking', bookingId], /* ... */);
  
  const updateBooking = async (updates: Partial<SpaBooking>) => {
    // Optimistic update
    mutate({ ...data, ...updates }, false);
    
    try {
      const updated = await updateSpaBooking(context, bookingId, updates);
      mutate(updated); // Revalidate with server response
      return updated;
    } catch (error) {
      mutate(); // Rollback on error
      throw error;
    }
  };
  
  return {
    booking: data,
    updateBooking,
    loading: !data,
  };
}
```

### 4. Type Safety

All hooks should have proper TypeScript types:

```typescript
import type { SpaBooking } from '@/modules/spa/types';

interface UseSpaBookingReturn {
  booking: SpaBooking | undefined;
  error: Error | undefined;
  loading: boolean;
  updateBooking: (updates: Partial<SpaBooking>) => Promise<SpaBooking>;
  refresh: () => Promise<void>;
}

export function useSpaBooking(bookingId: string): UseSpaBookingReturn {
  // Implementation
}
```

## Hook Examples

### Booking Hook

```typescript
// src/modules/spa/hooks/useSpaBooking.ts
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { getBookingById, updateBooking } from '@/modules/spa/services/bookings';
import type { SpaBooking } from '@/modules/spa/types';
import useSWR from 'swr';

export function useSpaBooking(bookingId: string) {
  const context = useTenantContext();
  
  const { data, error, mutate } = useSWR(
    ['spa-booking', bookingId],
    () => getBookingById(context, bookingId)
  );
  
  const update = async (updates: Partial<SpaBooking>) => {
    const updated = await updateBooking(context, bookingId, updates);
    mutate(updated);
    return updated;
  };
  
  return {
    booking: data,
    error,
    loading: !data && !error,
    updateBooking: update,
    refresh: () => mutate(),
  };
}
```

### Session Hook

```typescript
// src/modules/spa/hooks/useSpaSession.ts
import { useTenantContext } from '@/core/hooks/useTenantContext';
import {
  getSessionsByBooking,
  completeSession as completeSessionService,
} from '@/modules/spa/services/session';
import type { Session } from '@/modules/spa/types';
import useSWR from 'swr';

export function useSpaSession(bookingId: string) {
  const context = useTenantContext();
  
  const { data, error, mutate } = useSWR(
    ['spa-sessions', bookingId],
    () => getSessionsByBooking(context, bookingId)
  );
  
  const completeSession = async (sessionId: string) => {
    try {
      const completed = await completeSessionService(context, sessionId);
      
      // Optimistically update sessions list
      const updated = data?.map(s => s.id === sessionId ? completed : s);
      mutate(updated, false);
      
      // Revalidate from server
      mutate();
      
      return completed;
    } catch (error) {
      // Rollback optimistic update
      mutate();
      throw error;
    }
  };
  
  return {
    sessions: data || [],
    error,
    loading: !data && !error,
    completeSession,
    refresh: () => mutate(),
  };
}
```

### Salary Hook

```typescript
// src/modules/spa/hooks/useKtvSalary.ts
import { useTenantContext } from '@/core/hooks/useTenantContext';
import {
  getSalaryData,
  recalculateAndSaveSalaryRecord,
} from '@/modules/spa/services/salary';
import type { SalaryRecord } from '@/modules/spa/types';
import useSWR from 'swr';

export function useKtvSalary(ktvId: string, month: string) {
  const context = useTenantContext();
  
  const { data, error, mutate } = useSWR(
    ['ktv-salary', ktvId, month],
    () => getSalaryData(context, ktvId, month),
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000, // 10 seconds
    }
  );
  
  const recalculate = async (overrides?: Partial<SalaryRecord>) => {
    const recalculated = await recalculateAndSaveSalaryRecord(
      context,
      ktvId,
      month,
      overrides
    );
    mutate(recalculated);
    return recalculated;
  };
  
  const isDraft = data?.status === 'draft';
  
  return {
    salary: data,
    error,
    loading: !data && !error,
    isDraft,
    recalculate,
    refresh: () => mutate(),
  };
}
```

### Package Hook

```typescript
// src/modules/spa/hooks/useSpaPackage.ts
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { getPackageById, getPackagesByCategory } from '@/modules/spa/services/package';
import type { SpaPackage, PackageCategory } from '@/modules/spa/types';
import useSWR from 'swr';

export function useSpaPackage(packageId: string) {
  const context = useTenantContext();
  
  const { data, error } = useSWR(
    ['spa-package', packageId],
    () => getPackageById(context, packageId)
  );
  
  return {
    package: data,
    error,
    loading: !data && !error,
  };
}

export function useSpaPackages(category?: PackageCategory) {
  const context = useTenantContext();
  
  const { data, error } = useSWR(
    ['spa-packages', category],
    () => category
      ? getPackagesByCategory(context, category)
      : getAllPackages(context)
  );
  
  return {
    packages: data || [],
    error,
    loading: !data && !error,
  };
}
```

### KTV Performance Hook

```typescript
// src/modules/spa/hooks/useKtvPerformance.ts
import { useTenantContext } from '@/core/hooks/useTenantContext';
import {
  getKtvPerformance,
  calculateLeaderboard,
} from '@/modules/spa/services/ktvPerformance';
import type { KtvPerformance, DateRange } from '@/modules/spa/types';
import useSWR from 'swr';

export function useKtvPerformance(ktvId: string, period: DateRange) {
  const context = useTenantContext();
  
  const { data, error } = useSWR(
    ['ktv-performance', ktvId, period],
    () => getKtvPerformance(context, ktvId, period)
  );
  
  return {
    performance: data,
    error,
    loading: !data && !error,
  };
}

export function useKtvLeaderboard(month: string) {
  const context = useTenantContext();
  
  const { data, error } = useSWR(
    ['ktv-leaderboard', month],
    () => calculateLeaderboard(context, month),
    {
      refreshInterval: 60000, // Refresh every minute
    }
  );
  
  return {
    leaderboard: data || [],
    error,
    loading: !data && !error,
  };
}
```

## Hook Guidelines

### 1. Error Handling

Always expose errors to components:

```typescript
export function useSpaBooking(bookingId: string) {
  const { data, error } = useSWR(/* ... */);
  
  return {
    booking: data,
    error, // Expose error to component
    loading: !data && !error,
  };
}
```

### 2. Loading States

Provide loading state for better UX:

```typescript
export function useSpaBooking(bookingId: string) {
  const { data, error } = useSWR(/* ... */);
  
  const loading = !data && !error;
  
  return { booking: data, error, loading };
}
```

### 3. Optimistic Updates

Use optimistic updates for better perceived performance:

```typescript
export function useSpaBooking(bookingId: string) {
  const { data, mutate } = useSWR(/* ... */);
  
  const updateBooking = async (updates: Partial<SpaBooking>) => {
    // Optimistic update (don't revalidate)
    mutate({ ...data, ...updates }, false);
    
    try {
      const updated = await updateService(updates);
      mutate(updated); // Revalidate with server response
    } catch (error) {
      mutate(); // Rollback on error
      throw error;
    }
  };
  
  return { booking: data, updateBooking };
}
```

### 4. Caching Strategy

Configure SWR caching appropriately:

```typescript
export function useKtvSalary(ktvId: string, month: string) {
  const { data } = useSWR(
    ['salary', ktvId, month],
    fetcher,
    {
      revalidateOnFocus: false, // Don't revalidate on tab focus
      dedupingInterval: 10000,  // Dedupe requests within 10 seconds
      refreshInterval: 0,       // No auto-refresh (manual only)
    }
  );
  
  return { salary: data };
}
```

## Testing Strategy

### Unit Tests

Test hooks with React Testing Library:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useSpaBooking } from './useSpaBooking';

describe('useSpaBooking', () => {
  it('should fetch booking data', async () => {
    const { result } = renderHook(() => useSpaBooking('booking-1'));
    
    expect(result.current.loading).toBe(true);
    
    await waitFor(() => {
      expect(result.current.booking).toBeDefined();
      expect(result.current.loading).toBe(false);
    });
  });
});
```

### Integration Tests

Test hooks with actual components:

```typescript
import { render, screen, waitFor } from '@testing-library/react';

function TestComponent() {
  const { booking, loading } = useSpaBooking('booking-1');
  
  if (loading) return <div>Loading...</div>;
  return <div>{booking.packageName}</div>;
}

describe('useSpaBooking integration', () => {
  it('should render booking data in component', async () => {
    render(<TestComponent />);
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    
    await waitFor(() => {
      expect(screen.getByText('Combo Mẹ & Bé')).toBeInTheDocument();
    });
  });
});
```

## Related Documentation

- [Phase 3 Requirements - REQ-3.4.1](/.kiro/specs/phase-3-physical-extraction/requirements.md)
- [Spa Services](/src/modules/spa/services/README.md)
- [Spa Components](/src/modules/spa/components/README.md)
- [Core Hooks](/src/core/hooks/README.md)

## Migration Status

This directory structure was created as part of **Phase 3 - Task 13.1**.

Spa-specific hooks will be created in **Tasks 17.1-17.2**.
