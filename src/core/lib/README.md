# Core Utilities Library

This directory contains utility functions and helpers used across the core platform.

## Purpose

Provides reusable utility functions that are commonly needed by core services.

## Key Utilities

### Database Utilities
- Database row to contract type mappers
- Query builders
- Transaction helpers
- Connection pooling

### Validation Utilities
- Input validation helpers
- Schema validators
- Business rule validators
- Type guards

### Date/Time Utilities
- Date formatting
- Timezone conversions
- Date range calculations
- Business day calculations

### Formatting Utilities
- Currency formatting
- Number formatting
- String transformations
- Phone number formatting

## Usage Patterns

### 1. Database Mappers

```typescript
import { mapDbRowToBooking } from '@/core/lib/database';

const { data } = await supabase.from('bookings').select('*').eq('id', orderId);
const order: CoreBookingOrder = mapDbRowToBooking(data[0]);
```

### 2. Validation

```typescript
import { validateEmail, validatePhoneNumber } from '@/core/lib/validation';

if (!validateEmail(email)) {
  throw new Error('Invalid email address');
}
```

### 3. Formatting

```typescript
import { formatCurrency, formatDate } from '@/core/lib/formatting';

const priceDisplay = formatCurrency(1500000, 'VND'); // "1,500,000 ₫"
const dateDisplay = formatDate(new Date(), 'DD/MM/YYYY'); // "16/06/2025"
```

## File Organization

- **database.ts** - Database utilities and mappers
- **validation.ts** - Input validation functions
- **formatting.ts** - Display formatting functions
- **dates.ts** - Date/time utilities
- **types.ts** - Type guards and type utilities

## Tenant-Aware Utilities

Some utilities require TenantContext for tenant-specific behavior:

```typescript
import { formatCurrency } from '@/core/lib/formatting';

// Uses tenant's currency settings
const display = formatCurrency(amount, context.currency);
```
