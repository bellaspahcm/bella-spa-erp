# Real Estate Module - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Deploy Migrations (2 min)

```bash
# Supabase Dashboard → SQL Editor → Run:
scripts/deploy-critical-fixes.sql  # RLS + Partner Portal
supabase/migrations/20260802150000_real_estate_core_schema.sql  # Tables
supabase/migrations/20260802151000_real_estate_rpc_functions.sql  # RPCs
```

### 2. Verify (1 min)

```sql
-- Check tables
SELECT COUNT(*) FROM real_estate_projects;  -- Should work

-- Test RPC
SELECT * FROM get_sales_dashboard_stats('[tenant-id]', NULL);
```

### 3. Create Test Data (2 min)

```sql
-- Insert project
INSERT INTO real_estate_projects (tenant_id, project_code, project_name, status)
VALUES ('[tenant-id]', 'DEMO-001', 'Demo Project', 'selling');

-- Insert product
INSERT INTO real_estate_products (
  tenant_id, project_id, product_code, product_type, unit_code,
  area_m2, base_price, floor_price, unit_price, status
)
VALUES (
  '[tenant-id]', '[project-id]', 'A101', 'apartment', 'A101',
  75.5, 2000000000, 1800000000, 2000000000, 'available'
);
```

---

## 📚 Core Workflows

### Booking Flow (Complete Journey)

```typescript
// 1. Reserve
const { data: reservationId } = await supabase.rpc('reserve_product', {
  p_tenant_id: tenantId,
  p_product_id: productId,
  p_customer_id: customerId,
  p_deposit_amount: 50000000,
  p_created_by: userId,
});

// 2. Confirm Deposit
await supabase.rpc('confirm_reservation_deposit', {
  p_tenant_id: tenantId,
  p_reservation_id: reservationId,
  p_updated_by: userId,
});

// 3. Create Booking
const { data: booking } = await supabase
  .from('re_bookings')
  .insert({ tenant_id: tenantId, product_id: productId, ... })
  .select().single();

// 4. Submit for Approval
await supabase.rpc('transition_booking_state', {
  p_booking_id: booking.id,
  p_new_state: 'PENDING_APPROVAL',
  ...
});

// 5. Create Contract
const { data: contract } = await supabase
  .from('re_contracts')
  .insert({ booking_id: booking.id, ... })
  .select().single();

// 6. Generate Installments
await supabase.rpc('generate_contract_installments', {
  p_contract_id: contract.id,
  p_installments_count: 12,
  p_start_date: '2026-09-01',
  ...
});

// 7. Activate
await supabase.rpc('transition_contract_state', {
  p_contract_id: contract.id,
  p_new_state: 'ACTIVE',
  ...
});
```

### Lead Flow (Simple)

```typescript
// 1. Create Lead
const { data: lead } = await supabase
  .from('re_leads')
  .insert({ name: 'John Doe', phone: '0901234567', state: 'NEW' })
  .select().single();

// 2. Assign
await supabase.rpc('transition_lead_state', {
  p_lead_id: lead.id,
  p_new_state: 'ASSIGNED',
  p_assigned_to: agentId,
});

// 3. Advance States
// ASSIGNED → CONTACTED → QUALIFIED → VISIT_SCHEDULED → NEGOTIATING → CONVERTED
```

---

## 🔧 Common Tasks

### Check Available Products
```typescript
const { data } = await supabase.rpc('get_available_products', {
  p_tenant_id: tenantId,
  p_project_id: projectId,
});
```

### Cancel Reservation
```typescript
await supabase.rpc('cancel_reservation', {
  p_reservation_id: reservationId,
  p_reason: 'Customer changed mind',
});
```

### Get Dashboard Stats
```typescript
const { data } = await supabase.rpc('get_sales_dashboard_stats', {
  p_tenant_id: tenantId,
});
// Returns: { total_products, available, sold, total_revenue, ... }
```

---

## 🐛 Troubleshooting

**"infinite recursion detected"**
→ Run RLS fix: `scripts/deploy-critical-fixes.sql`

**"function does not exist"**
→ Deploy RPCs: `supabase/migrations/20260802151000_*`

**"Invalid transition from X to Y"**
→ Check FSM rules in `docs/real-estate/API_REFERENCE.md`

---

## 📖 Full Docs

- API Reference: `docs/real-estate/API_REFERENCE.md`
- Migrations: `docs/real-estate/MIGRATIONS_GUIDE.md`
- Testing: `docs/real-estate/E2E_TESTING_GUIDE.md`
