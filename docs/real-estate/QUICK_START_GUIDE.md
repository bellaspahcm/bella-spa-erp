# Real Estate Module - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Deploy Database (2 min)

```sql
-- Supabase Dashboard → SQL Editor
-- Copy & paste:
\i supabase/migrations/20260802150000_real_estate_core_schema.sql
\i supabase/migrations/20260802151000_real_estate_rpc_functions.sql
```

### 2. Seed Test Data (1 min)

```sql
-- Create test project
INSERT INTO real_estate_projects (tenant_id, project_code, project_name, status)
VALUES ('your-tenant-id', 'PRJ001', 'Bella Gardens', 'selling');

-- Create test product
INSERT INTO real_estate_products (
  tenant_id, project_id, product_code, product_type, unit_code,
  area_m2, base_price, floor_price, unit_price, status
)
VALUES (
  'your-tenant-id', 
  (SELECT id FROM real_estate_projects WHERE project_code = 'PRJ001'),
  'A101', 'apartment', 'A101',
  75.5, 2000000000, 1800000000, 2000000000, 'available'
);
```

### 3. Test in Browser (2 min)

```
1. Login → Dashboard
2. Click "Real Estate" → See products
3. Click "A101" → See details
4. Click "Reserve" → Fill form → Submit
5. Check status: "pending_deposit" ✅
```

---

## 📖 Core Workflows

### Reserve Product → Book → Contract

```typescript
// 1. Reserve
await supabase.rpc('reserve_product', {
  p_tenant_id, p_product_id, p_customer_id, p_deposit_amount: 50000000
});

// 2. Confirm deposit
await supabase.rpc('confirm_reservation_deposit', {
  p_tenant_id, p_reservation_id
});

// 3. Create booking
await supabase.from('re_bookings').insert({
  tenant_id, product_id, customer_id, booking_fee: 100000000, state: 'DRAFT'
});

// 4. Submit → Approve → Contract → Activate
```

### Lead → Customer → Reservation

```typescript
// 1. Create lead
await supabase.from('re_leads').insert({
  tenant_id, name, phone, state: 'NEW'
});

// 2. Assign
await supabase.rpc('transition_lead_state', {
  p_new_state: 'ASSIGNED', p_assigned_to: 'agent-id'
});

// 3. Convert
await supabase.rpc('transition_lead_state', {
  p_new_state: 'CONVERTED'
});

// 4. Reserve product (see above)
```

---

## 🧪 Run Tests

```bash
# E2E tests
npx playwright test e2e/tests/real-estate/

# Unit tests
npm run test src/modules/real_estate/

# Critical flows
npm run test:critical
```

---

## 📊 Monitoring

```bash
# Check errors
grep ERROR logs/app.log | tail -20

# Check slow queries
grep "Slow database query" logs/app.log
```

---

## 🔗 Full Docs

- **API Reference:** `docs/real-estate/API_REFERENCE.md`
- **Migrations:** `docs/real-estate/MIGRATIONS_GUIDE.md`
- **E2E Tests:** `docs/real-estate/E2E_TESTING_GUIDE.md`
- **Deployment:** `docs/deployment/PRODUCTION_DEPLOYMENT_CHECKLIST.md`
