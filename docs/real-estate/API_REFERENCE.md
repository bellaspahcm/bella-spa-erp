# Real Estate Module - API Reference

## 📋 Overview

Comprehensive API documentation for Real Estate ERP module.

**API Types:**
- 🔵 **RPC Functions** - Supabase stored procedures (PostgreSQL)
- 🟢 **Server Actions** - Next.js server-side functions
- 🟡 **REST Endpoints** - API routes (if any)

---

## 🔵 RPC Functions

### Product Catalog RPCs

#### `get_available_products`

Get available products for a project.

**Signature:**
```sql
get_available_products(
  p_tenant_id UUID,
  p_project_id UUID
)
RETURNS TABLE (
  id UUID,
  product_code TEXT,
  product_type product_type,
  unit_code TEXT,
  area NUMERIC,
  base_price NUMERIC,
  floor_price NUMERIC,
  unit_price NUMERIC,
  block TEXT,
  floor TEXT,
  direction TEXT,
  status TEXT
)
```

**Example (TypeScript):**
```typescript
const { data, error } = await supabase
  .rpc('get_available_products', {
    p_tenant_id: 'tenant-uuid',
    p_project_id: 'project-uuid',
  });

// Returns: Array of available products
```

**Response:**
```json
[
  {
    "id": "product-uuid",
    "product_code": "A101",
    "product_type": "apartment",
    "unit_code": "A101",
    "area": 75.5,
    "base_price": 2000000000,
    "floor_price": 1800000000,
    "unit_price": 2000000000,
    "block": "A",
    "floor": "10",
    "direction": "South",
    "status": "available"
  }
]
```

**Errors:**
- None (returns empty array if no products)

---

### Reservation RPCs

#### `reserve_product`

Atomically reserve a product for a customer.

**Signature:**
```sql
reserve_product(
  p_tenant_id UUID,
  p_product_id UUID,
  p_customer_id UUID,
  p_deposit_amount NUMERIC,
  p_created_by UUID
)
RETURNS UUID  -- reservation_id
```

**Example:**
```typescript
const { data: reservationId, error } = await supabase
  .rpc('reserve_product', {
    p_tenant_id: 'tenant-uuid',
    p_product_id: 'product-uuid',
    p_customer_id: 'customer-uuid',
    p_deposit_amount: 50000000,
    p_created_by: 'user-uuid',
  });

// Returns: reservation_id (UUID)
```

**Side Effects:**
- Creates `re_reservations` record with status `'pending_deposit'`
- Updates `real_estate_products.status` to `'reserved'`
- Uses `FOR UPDATE` lock to prevent race conditions

**Errors:**
```
ERROR: Product not found
ERROR: Product is not available for reservation (status: reserved)
```

#### `confirm_reservation_deposit`

Confirm deposit received for a reservation.

**Signature:**
```sql
confirm_reservation_deposit(
  p_tenant_id UUID,
  p_reservation_id UUID,
  p_updated_by UUID
)
RETURNS VOID
```

**Example:**
```typescript
const { error } = await supabase
  .rpc('confirm_reservation_deposit', {
    p_tenant_id: 'tenant-uuid',
    p_reservation_id: 'reservation-uuid',
    p_updated_by: 'user-uuid',
  });

if (error) throw error;
```

**Side Effects:**
- Updates `re_reservations.status` to `'deposited'`
- Sets `re_reservations.deposited_at` to `NOW()`

**Errors:**
```
ERROR: Reservation not found
ERROR: Cannot confirm deposit for reservation in status: deposited
```

#### `cancel_reservation`

Cancel a reservation and release the product.

**Signature:**
```sql
cancel_reservation(
  p_tenant_id UUID,
  p_reservation_id UUID,
  p_reason TEXT,
  p_updated_by UUID
)
RETURNS VOID
```

**Example:**
```typescript
const { error } = await supabase
  .rpc('cancel_reservation', {
    p_tenant_id: 'tenant-uuid',
    p_reservation_id: 'reservation-uuid',
    p_reason: 'Customer changed mind',
    p_updated_by: 'user-uuid',
  });
```

**Side Effects:**
- Updates `re_reservations.status` to `'cancelled'`
- Appends cancellation reason to `notes`
- Updates `real_estate_products.status` back to `'available'`

**Errors:**
```
ERROR: Reservation not found
ERROR: Cannot cancel reservation that is already converted to contract
```

---

### Booking RPCs

#### `transition_booking_state`

Transition booking state with FSM validation.

**Signature:**
```sql
transition_booking_state(
  p_tenant_id UUID,
  p_booking_id UUID,
  p_new_state booking_state,
  p_updated_by UUID
)
RETURNS VOID
```

**Valid Transitions:**
```
DRAFT → PENDING_APPROVAL
DRAFT → CANCELLED
PENDING_APPROVAL → CONFIRMED
PENDING_APPROVAL → CANCELLED
CONFIRMED → CANCELLED
```

**Example:**
```typescript
const { error } = await supabase
  .rpc('transition_booking_state', {
    p_tenant_id: 'tenant-uuid',
    p_booking_id: 'booking-uuid',
    p_new_state: 'PENDING_APPROVAL',
    p_updated_by: 'user-uuid',
  });
```

**Side Effects:**
- Updates `re_bookings.state`
- Sets `state_changed_at` to `NOW()`
- Sets appropriate timestamp field:
  - `submitted_at` when state = `PENDING_APPROVAL`
  - `confirmed_at` when state = `CONFIRMED`
  - `cancelled_at` when state = `CANCELLED`

**Errors:**
```
ERROR: Booking not found
ERROR: Invalid transition from DRAFT to CONFIRMED
```

---

### Contract RPCs

#### `transition_contract_state`

Transition contract state with FSM validation.

**Signature:**
```sql
transition_contract_state(
  p_tenant_id UUID,
  p_contract_id UUID,
  p_new_state contract_state,
  p_updated_by UUID
)
RETURNS VOID
```

**Valid Transitions:**
```
DRAFT → PENDING_APPROVAL
DRAFT → TERMINATED
PENDING_APPROVAL → ACTIVE
PENDING_APPROVAL → TERMINATED
ACTIVE → TERMINATED
```

**Example:**
```typescript
const { error } = await supabase
  .rpc('transition_contract_state', {
    p_tenant_id: 'tenant-uuid',
    p_contract_id: 'contract-uuid',
    p_new_state: 'ACTIVE',
    p_updated_by: 'user-uuid',
  });
```

**Side Effects:**
- Updates `re_contracts.state`
- Sets `state_changed_at` to `NOW()`
- When state = `ACTIVE`: Updates `real_estate_products.status` to `'sold'`

**Errors:**
```
ERROR: Contract not found
ERROR: Invalid transition from DRAFT to ACTIVE
```

#### `generate_contract_installments`

Generate installment schedule for a contract.

**Signature:**
```sql
generate_contract_installments(
  p_tenant_id UUID,
  p_contract_id UUID,
  p_installments_count INTEGER,
  p_start_date DATE,
  p_updated_by UUID
)
RETURNS VOID
```

**Example:**
```typescript
const { error } = await supabase
  .rpc('generate_contract_installments', {
    p_tenant_id: 'tenant-uuid',
    p_contract_id: 'contract-uuid',
    p_installments_count: 12,
    p_start_date: '2026-09-01',
    p_updated_by: 'user-uuid',
  });
```

**Algorithm:**
```
1. Divide contract_price by installments_count
2. Monthly schedule: dueDate = start_date + (i - 1) months
3. Last installment gets remainder (handles rounding)
4. Store in contract.installments JSONB array
```

**Response Format (in JSONB):**
```json
[
  {
    "installmentNumber": 1,
    "dueDate": "2026-09-01",
    "percentage": 8.33,
    "amount": 166666667,
    "milestoneLabel": "Đợt 1 - Thanh toán định kỳ tháng 1"
  },
  {
    "installmentNumber": 2,
    "dueDate": "2026-10-01",
    "percentage": 8.33,
    "amount": 166666667,
    "milestoneLabel": "Đợt 2 - Thanh toán định kỳ tháng 2"
  }
]
```

**Errors:**
```
ERROR: Contract not found
ERROR: Installments count must be greater than zero
```

---

### Lead RPCs

#### `transition_lead_state`

Transition lead state with FSM validation.

**Signature:**
```sql
transition_lead_state(
  p_tenant_id UUID,
  p_lead_id UUID,
  p_new_state lead_state,
  p_assigned_to UUID,
  p_lost_reason TEXT,
  p_updated_by UUID
)
RETURNS VOID
```

**Valid Transitions:**
```
NEW → ASSIGNED
ASSIGNED → CONTACTED
CONTACTED → QUALIFIED
QUALIFIED → VISIT_SCHEDULED
VISIT_SCHEDULED → NEGOTIATING
NEGOTIATING → CONVERTED
Any → LOST
```

**Example:**
```typescript
// Assign lead
const { error } = await supabase
  .rpc('transition_lead_state', {
    p_tenant_id: 'tenant-uuid',
    p_lead_id: 'lead-uuid',
    p_new_state: 'ASSIGNED',
    p_assigned_to: 'agent-uuid',
    p_lost_reason: null,
    p_updated_by: 'user-uuid',
  });

// Mark as lost
const { error: lostError } = await supabase
  .rpc('transition_lead_state', {
    p_tenant_id: 'tenant-uuid',
    p_lead_id: 'lead-uuid',
    p_new_state: 'LOST',
    p_assigned_to: null,
    p_lost_reason: 'Customer budget too low',
    p_updated_by: 'user-uuid',
  });
```

**Side Effects:**
- Updates `re_leads.state`
- Sets `assigned_to` when state = `ASSIGNED`
- Sets `lost_reason` when state = `LOST`
- Sets `state_changed_at` to `NOW()`

**Errors:**
```
ERROR: Lead not found
ERROR: Invalid transition from NEW to CONVERTED
```

---

### Dashboard RPCs

#### `get_sales_dashboard_stats`

Get aggregated sales dashboard statistics.

**Signature:**
```sql
get_sales_dashboard_stats(
  p_tenant_id UUID,
  p_project_id UUID DEFAULT NULL
)
RETURNS TABLE (
  total_products BIGINT,
  available_products BIGINT,
  reserved_products BIGINT,
  sold_products BIGINT,
  total_bookings BIGINT,
  confirmed_bookings BIGINT,
  active_contracts BIGINT,
  total_revenue NUMERIC
)
```

**Example:**
```typescript
const { data, error } = await supabase
  .rpc('get_sales_dashboard_stats', {
    p_tenant_id: 'tenant-uuid',
    p_project_id: 'project-uuid', // Optional
  });

// Returns: Single row with aggregated stats
```

**Response:**
```json
{
  "total_products": 120,
  "available_products": 45,
  "reserved_products": 15,
  "sold_products": 60,
  "total_bookings": 75,
  "confirmed_bookings": 70,
  "active_contracts": 60,
  "total_revenue": 120000000000
}
```

---

## 📊 Data Models

### Enums

#### `product_type`
```typescript
type ProductType = 'apartment' | 'townhouse' | 'shophouse' | 'villa';
```

#### `lead_state`
```typescript
type LeadState = 
  | 'NEW' 
  | 'ASSIGNED' 
  | 'CONTACTED' 
  | 'QUALIFIED' 
  | 'VISIT_SCHEDULED' 
  | 'NEGOTIATING' 
  | 'CONVERTED' 
  | 'LOST';
```

#### `booking_state`
```typescript
type BookingState = 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'CANCELLED';
```

#### `contract_state`
```typescript
type ContractState = 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'TERMINATED';
```

#### `reservation_status`
```typescript
type ReservationStatus = 
  | 'pending_deposit' 
  | 'deposited' 
  | 'converted_to_contract' 
  | 'cancelled';
```

---

## 🔐 Authentication & Authorization

### Row-Level Security (RLS)

All tables have RLS enabled with tenant isolation:

```sql
-- Policy pattern (applied to all 9 tables)
CREATE POLICY "Authenticated users can view [table] from their tenant"
  ON [table_name] FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenants 
    WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid
  ));
```

### RPC Security

All RPC functions use `SECURITY DEFINER`:
- Bypass RLS for internal logic
- **Critical:** Always filter by `tenant_id` first
- Prevents cross-tenant data leaks

---

## ⚠️ Error Handling

### Standard Error Format

```typescript
interface APIError {
  error: {
    message: string;
    code: string;
    details?: unknown; // Dev only
  };
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `CONFLICT` | 409 | Resource state conflict |
| `VALIDATION_ERROR` | 422 | Validation failed |
| `INTERNAL_ERROR` | 500 | Server error |

### RPC Errors

RPC functions throw PostgreSQL exceptions:

```typescript
try {
  const { error } = await supabase.rpc('reserve_product', params);
  if (error) {
    // error.message contains detailed error from RPC
    console.error(error.message);
  }
} catch (err) {
  // Network or unexpected errors
}
```

**Example RPC Error Messages:**
```
Product not found
Product is not available for reservation (status: reserved)
Cannot confirm deposit for reservation in status: deposited
Invalid transition from DRAFT to CONFIRMED
Installments count must be greater than zero
```

---

## 📖 Usage Examples

### Complete Booking Flow

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function completeBookingFlow() {
  const tenantId = 'tenant-uuid';
  const productId = 'product-uuid';
  const customerId = 'customer-uuid';
  const userId = 'user-uuid';
  
  try {
    // Step 1: Reserve product
    const { data: reservationId, error: reserveError } = await supabase
      .rpc('reserve_product', {
        p_tenant_id: tenantId,
        p_product_id: productId,
        p_customer_id: customerId,
        p_deposit_amount: 50000000,
        p_created_by: userId,
      });
    
    if (reserveError) throw reserveError;
    console.log('Reservation ID:', reservationId);
    
    // Step 2: Confirm deposit
    const { error: confirmError } = await supabase
      .rpc('confirm_reservation_deposit', {
        p_tenant_id: tenantId,
        p_reservation_id: reservationId,
        p_updated_by: userId,
      });
    
    if (confirmError) throw confirmError;
    console.log('Deposit confirmed');
    
    // Step 3: Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('re_bookings')
      .insert({
        tenant_id: tenantId,
        product_id: productId,
        customer_id: customerId,
        reservation_id: reservationId,
        booking_fee: 100000000,
        state: 'DRAFT',
        created_by: userId,
      })
      .select()
      .single();
    
    if (bookingError) throw bookingError;
    console.log('Booking created:', booking.id);
    
    // Step 4: Submit booking
    const { error: submitError } = await supabase
      .rpc('transition_booking_state', {
        p_tenant_id: tenantId,
        p_booking_id: booking.id,
        p_new_state: 'PENDING_APPROVAL',
        p_updated_by: userId,
      });
    
    if (submitError) throw submitError;
    console.log('Booking submitted for approval');
    
    // Step 5: Create contract
    const { data: contract, error: contractError } = await supabase
      .from('re_contracts')
      .insert({
        tenant_id: tenantId,
        product_id: productId,
        customer_id: customerId,
        booking_id: booking.id,
        contract_number: 'CT-2026-001',
        contract_price: 2000000000,
        state: 'DRAFT',
        created_by: userId,
      })
      .select()
      .single();
    
    if (contractError) throw contractError;
    console.log('Contract created:', contract.id);
    
    // Step 6: Generate installments
    const { error: installmentsError } = await supabase
      .rpc('generate_contract_installments', {
        p_tenant_id: tenantId,
        p_contract_id: contract.id,
        p_installments_count: 12,
        p_start_date: '2026-09-01',
        p_updated_by: userId,
      });
    
    if (installmentsError) throw installmentsError;
    console.log('Installments generated');
    
    // Step 7: Activate contract
    const { error: activateError } = await supabase
      .rpc('transition_contract_state', {
        p_tenant_id: tenantId,
        p_contract_id: contract.id,
        p_new_state: 'ACTIVE',
        p_updated_by: userId,
      });
    
    if (activateError) throw activateError;
    console.log('Contract activated - Product marked as SOLD');
    
    return { reservationId, booking, contract };
  } catch (error) {
    console.error('Booking flow failed:', error);
    throw error;
  }
}
```

### Lead Conversion Flow

```typescript
async function convertLeadToCustomer(leadId: string) {
  const tenantId = 'tenant-uuid';
  const userId = 'user-uuid';
  
  // Get lead details
  const { data: lead, error: leadError } = await supabase
    .from('re_leads')
    .select('*')
    .eq('id', leadId)
    .single();
  
  if (leadError) throw leadError;
  
  // Transition to CONVERTED
  const { error: transitionError } = await supabase
    .rpc('transition_lead_state', {
      p_tenant_id: tenantId,
      p_lead_id: leadId,
      p_new_state: 'CONVERTED',
      p_assigned_to: lead.assigned_to,
      p_lost_reason: null,
      p_updated_by: userId,
    });
  
  if (transitionError) throw transitionError;
  
  // Create customer from lead
  const { data: customer, error: customerError } = await supabase
    .from('re_customers')
    .insert({
      tenant_id: tenantId,
      name: lead.name,
      phone: lead.phone,
      email: lead.email,
      tags: ['converted_lead'],
      created_by: userId,
    })
    .select()
    .single();
  
  if (customerError) throw customerError;
  
  console.log('Lead converted to customer:', customer.id);
  return customer;
}
```

---

## 🔗 Related Documents

- **Migrations Guide:** `docs/real-estate/MIGRATIONS_GUIDE.md`
- **E2E Testing Guide:** `docs/real-estate/E2E_TESTING_GUIDE.md`
- **Architecture Analysis:** `docs/real-estate/REAL_ESTATE_MODULE_COMPREHENSIVE_ANALYSIS.md`
- **Monitoring Setup:** `docs/deployment/MONITORING_SETUP.md`

---

**Last Updated:** 2026-08-02  
**Version:** 1.0.0  
**Maintainer:** Development Team
