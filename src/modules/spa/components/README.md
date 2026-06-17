# Spa Module - Components

This directory contains all React UI components specific to the spa and babycare industry.

## Purpose

The spa components directory provides reusable React components for spa-specific user interfaces. These components handle rendering, user interactions, and state management for spa-specific features.

## Organization

### Component Categories

1. **Dashboard Components** (`dashboard/`)
   - Spa bookings widget (daily/weekly overview)
   - Spa revenue chart
   - KTV performance dashboard
   - Session completion metrics

2. **Order Components** (`order/` or `bookings/`)
   - Spa booking form (package selection, KTV assignment)
   - Booking list view (with session tracking)
   - Booking detail view (with session history)
   - Session completion interface

3. **Employee Components** (`employees/`)
   - KTV management list and detail views
   - KTV profile editor
   - KTV performance leaderboard
   - KTV assignment scheduler

4. **Package Components** (`packages/`)
   - Package list view (with categories)
   - Package detail view (with session multipliers)
   - Package creation/edit form
   - Package category selector

5. **Salary Components** (`salary/`)
   - Salary calculation dashboard
   - Salary reconciliation reports
   - Salary approval workflow
   - Pro-rata base salary display
   - KPI bonus sync indicator

## Component Architecture Principles

### 1. Use Core Platform Hooks

Components should use core hooks when possible:

```typescript
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { useModuleAdapter } from '@/core/hooks/useModuleAdapter';

export function SpaBookingForm() {
  const context = useTenantContext();
  const adapter = useModuleAdapter('spa');
  
  // Component logic
}
```

### 2. Spa-Specific Hooks

For spa-specific state management, use spa hooks:

```typescript
import { useSpaBooking } from '@/modules/spa/hooks/useSpaBooking';
import { useSpaSession } from '@/modules/spa/hooks/useSpaSession';

export function SessionCompletionForm({ bookingId }: Props) {
  const { booking, loading } = useSpaBooking(bookingId);
  const { completeSession } = useSpaSession();
  
  // Component logic
}
```

### 3. Type Safety

All components should use spa types:

```typescript
import type { SpaBooking, SpaPackage, KtvEmployee } from '@/modules/spa/types';

interface SpaBookingListProps {
  bookings: SpaBooking[];
  onSelect: (booking: SpaBooking) => void;
}

export function SpaBookingList({ bookings, onSelect }: SpaBookingListProps) {
  // Component logic
}
```

### 4. Accessibility Compliance

All components must follow WCAG accessibility guidelines:

```typescript
export function SpaBookingForm() {
  return (
    <form aria-label="Spa booking form">
      <label htmlFor="package-select">Select Package</label>
      <select id="package-select" aria-required="true">
        {/* options */}
      </select>
      
      <button type="submit" aria-label="Submit booking">
        Book Now
      </button>
    </form>
  );
}
```

## Component Examples

### Dashboard Widget

```typescript
// src/modules/spa/components/dashboard/SpaBookingsWidget.tsx
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { useSpaBookings } from '@/modules/spa/hooks/useSpaBooking';

export function SpaBookingsWidget() {
  const context = useTenantContext();
  const { bookings, loading } = useSpaBookings({
    status: 'confirmed',
    date: new Date().toISOString().split('T')[0],
  });
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="spa-bookings-widget">
      <h3>Today's Bookings</h3>
      <p>{bookings.length} confirmed bookings</p>
      <ul>
        {bookings.map(booking => (
          <li key={booking.id}>
            {booking.customerName} - {booking.packageName}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Booking Form

```typescript
// src/modules/spa/components/bookings/SpaBookingForm.tsx
import { useState } from 'react';
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { createSpaBooking } from '@/modules/spa/services/bookings';
import type { SpaPackage } from '@/modules/spa/types';

interface SpaBookingFormProps {
  packages: SpaPackage[];
  onSuccess: (bookingId: string) => void;
}

export function SpaBookingForm({ packages, onSuccess }: SpaBookingFormProps) {
  const context = useTenantContext();
  const [selectedPackageId, setSelectedPackageId] = useState('');
  const [ktvId, setKtvId] = useState('');
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const booking = await createSpaBooking(context, {
        packageId: selectedPackageId,
        ktvId: ktvId,
        customerId: context.userId,
      });
      
      onSuccess(booking.id);
    } catch (error) {
      console.error('Booking creation failed:', error);
      // Show error to user
    }
  };
  
  return (
    <form onSubmit={handleSubmit} aria-label="Spa booking form">
      <label htmlFor="package">Select Package</label>
      <select
        id="package"
        value={selectedPackageId}
        onChange={(e) => setSelectedPackageId(e.target.value)}
        required
      >
        <option value="">-- Select Package --</option>
        {packages.map(pkg => (
          <option key={pkg.id} value={pkg.id}>
            {pkg.name} - {pkg.totalSessions} sessions
          </option>
        ))}
      </select>
      
      <label htmlFor="ktv">Assign KTV</label>
      <select
        id="ktv"
        value={ktvId}
        onChange={(e) => setKtvId(e.target.value)}
        required
      >
        <option value="">-- Select KTV --</option>
        {/* KTV options */}
      </select>
      
      <button type="submit">Book Now</button>
    </form>
  );
}
```

### Salary Dashboard

```typescript
// src/modules/spa/components/salary/SalaryDashboard.tsx
import { useTenantContext } from '@/core/hooks/useTenantContext';
import { getSalaryData } from '@/modules/spa/services/salary';
import type { SalaryRecord } from '@/modules/spa/types';

export function SalaryDashboard({ ktvId, month }: { ktvId: string; month: string }) {
  const context = useTenantContext();
  const [salary, setSalary] = useState<SalaryRecord | null>(null);
  
  useEffect(() => {
    getSalaryData(context, ktvId, month).then(setSalary);
  }, [context, ktvId, month]);
  
  if (!salary) return <LoadingSpinner />;
  
  const isDraft = salary.status === 'draft';
  
  return (
    <div className="salary-dashboard">
      <h2>Salary Summary - {month}</h2>
      {isDraft && (
        <span className="badge-warning">Draft (Auto-calculated)</span>
      )}
      
      <div className="salary-breakdown">
        <div>Base Salary: {salary.baseSalary.toLocaleString()} VND</div>
        <div>Session Bonus: {salary.sessionBonus.toLocaleString()} VND</div>
        <div>KPI Bonus: {salary.kpiBonus.toLocaleString()} VND</div>
        <div>Rating Bonus: {salary.ratingBonus.toLocaleString()} VND</div>
        <div>Deductions: -{salary.violationsDeduction.toLocaleString()} VND</div>
        <div className="total">Total: {salary.totalSalary.toLocaleString()} VND</div>
      </div>
      
      <div className="session-info">
        <p>Total Sessions: {salary.totalSessions} ca</p>
        <p>Working Days: {salary.actualDays} / 26</p>
      </div>
    </div>
  );
}
```

## Component Guidelines

### 1. Loading States

Always show loading indicators:

```typescript
export function SpaBookingList() {
  const { bookings, loading, error } = useSpaBookings();
  
  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <>{/* Component content */}</>;
}
```

### 2. Error Handling

Show user-friendly error messages:

```typescript
export function SpaBookingForm() {
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async () => {
    try {
      await createSpaBooking(/* ... */);
    } catch (err) {
      setError('Failed to create booking. Please try again.');
      console.error(err);
    }
  };
  
  return (
    <>
      {error && <ErrorBanner message={error} />}
      {/* Form content */}
    </>
  );
}
```

### 3. Form Validation

Validate user input before submission:

```typescript
export function SpaBookingForm() {
  const [formData, setFormData] = useState({
    packageId: '',
    ktvId: '',
  });
  
  const isValid = formData.packageId && formData.ktvId;
  
  return (
    <form>
      {/* Form fields */}
      <button type="submit" disabled={!isValid}>
        Book Now
      </button>
    </form>
  );
}
```

### 4. Optimistic Updates

Show immediate feedback for better UX:

```typescript
export function SessionCompletionButton({ sessionId }: Props) {
  const [optimisticCompleted, setOptimisticCompleted] = useState(false);
  
  const handleComplete = async () => {
    setOptimisticCompleted(true); // Optimistic update
    
    try {
      await completeSession(context, sessionId);
    } catch (error) {
      setOptimisticCompleted(false); // Rollback on error
      console.error(error);
    }
  };
  
  return (
    <button onClick={handleComplete} disabled={optimisticCompleted}>
      {optimisticCompleted ? 'Completed ✓' : 'Complete Session'}
    </button>
  );
}
```

## Critical Development Rules

### 1. Never Swallow Errors

Always show errors to the user:

❌ **WRONG**:
```typescript
try {
  await createBooking(data);
} catch (error) {
  console.error(error); // User sees nothing
}
```

✅ **CORRECT**:
```typescript
try {
  await createBooking(data);
  setSuccess('Booking created successfully');
} catch (error) {
  setError('Failed to create booking');
  console.error(error);
}
```

### 2. Test Side Effects in UI

When testing components that trigger side effects:

```typescript
describe('SessionCompletionButton', () => {
  it('should update salary when session completed', async () => {
    render(<SessionCompletionButton sessionId="session-1" />);
    
    // Click complete button
    fireEvent.click(screen.getByText('Complete Session'));
    
    // CRITICAL: Assert salary was updated
    await waitFor(() => {
      expect(screen.getByText(/Salary updated/i)).toBeInTheDocument();
    });
  });
});
```

### 3. Accessibility Testing

Always test with accessibility tools:

```typescript
import { axe } from 'jest-axe';

describe('SpaBookingForm', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(<SpaBookingForm packages={[]} />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

## Styling Guidelines

### 1. Use Tailwind CSS

Components should use Tailwind utility classes:

```typescript
export function SpaBookingCard({ booking }: Props) {
  return (
    <div className="rounded-lg border border-gray-200 p-4 shadow-sm">
      <h3 className="text-lg font-semibold">{booking.packageName}</h3>
      <p className="text-sm text-gray-600">{booking.customerName}</p>
    </div>
  );
}
```

### 2. Responsive Design

All components should be mobile-friendly:

```typescript
export function SpaBookingList() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Booking cards */}
    </div>
  );
}
```

## Related Documentation

- [Phase 3 Requirements - REQ-3.4.3](/.kiro/specs/phase-3-physical-extraction/requirements.md)
- [Spa Hooks](/src/modules/spa/hooks/README.md)
- [Spa Services](/src/modules/spa/services/README.md)
- [Spa Types](/src/modules/spa/types/README.md)

## Migration Status

This directory structure was created as part of **Phase 3 - Task 13.1**.

Spa-specific components will be migrated to this directory in **Tasks 16.1-16.5**.
