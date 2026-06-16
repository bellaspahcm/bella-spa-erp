# Payment Processing Services

This directory contains services for payment intent creation, processing, and tracking across all payment methods.

## Purpose

Provides industry-neutral payment processing logic that works across all modules and payment methods.

## Key Services

### Payment Intent Creation
- Create payment intents for orders
- Support multiple payment methods (cash, bank transfer, e-wallet)
- Link payments to orders
- Store payment method-specific details in metadata

### Payment Processing
- Process payment transactions
- Update payment status
- Handle payment confirmations
- Send payment notifications

### Payment Queries
- Get payments by order
- Get payments by customer
- Get payments by date range
- Filter by tenant and status

## Usage Patterns

### 1. Creating a Payment Intent

```typescript
import { createPayment } from '@/core/services/payment';
import type { PaymentIntent, TenantContext } from '@/core/types';

const payment = await createPayment(context, {
  orderId: order.id,
  customerId: order.customerId,
  amount: 500000,
  paymentMethod: 'bank_transfer',
  status: 'pending',
  metadata: {
    bankName: 'Vietcombank',
    accountNumber: '1234567890'
  }
});
```

### 2. Updating Payment Status

```typescript
import { updatePaymentStatus } from '@/core/services/payment';

await updatePaymentStatus(context, paymentId, 'completed');
```

### 3. Querying Payments

```typescript
import { getPaymentsByOrder } from '@/core/services/payment';

const payments = await getPaymentsByOrder(context, orderId);
const totalPaid = payments
  .filter(p => p.status === 'completed')
  .reduce((sum, p) => sum + p.amount, 0);
```

## Payment Methods

Supported payment methods:
- **cash**: Cash payment
- **bank_transfer**: Bank transfer
- **e_wallet**: E-wallet (Momo, ZaloPay, etc.)
- **credit_card**: Credit card (future)

Payment method-specific details are stored in the `metadata` field.

## Payment Status Flow

```
pending → processing → completed
         ↓
       failed/cancelled
```

## Type Mapping

Payments are stored in database tables and mapped to `PaymentIntent` contract type:

```typescript
import { mapDbRowToPayment } from '@/core/lib/database';

const { data } = await supabase.from('payment_intents').select('*').eq('id', paymentId);
const payment: PaymentIntent = mapDbRowToPayment(data[0]);
```

## Tenant Isolation

All payment queries filter by `tenantId` from TenantContext to ensure tenant isolation.

## Security Considerations

- Payment data is encrypted at rest
- Sensitive payment details stored in `metadata` field with restricted access
- All payment operations are logged via audit service
- RLS policies enforce database-level access control
