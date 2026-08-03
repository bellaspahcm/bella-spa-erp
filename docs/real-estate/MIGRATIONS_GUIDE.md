# Real Estate Module - Migrations Guide

## 📋 Overview

This guide covers database migrations for the Real Estate ERP module, extracted from Domain-Driven Design aggregates in the codebase.

**Migration Files:**
- `20260802150000_real_estate_core_schema.sql` - Core tables and enums
- `20260802151000_real_estate_rpc_functions.sql` - Stored procedures

**Total Objects:**
- 9 tables
- 5 enums
- 9 RPC functions
- 9 RLS policies

---

## 🏗️ Schema Architecture

### Domain Context Mapping

Migrations extracted from bounded contexts:

| Context | Domain Model | Database Table |
|---------|--------------|----------------|
| **Product Catalog** | `ProductCatalogAggregate` | `real_estate_products` |
| Product Catalog | N/A | `real_estate_projects` |
| **CRM** | `LeadAggregate` | `re_leads` |
| CRM | `Customer360Aggregate` | `re_customers` |
| **Sales** | `ReservationDomainModel` | `re_reservations` |
| Sales | `BookingAggregate` | `re_bookings` |
| Sales | `ContractAggregate` | `re_contracts` |
| **Finance** | N/A | `re_transactions` |
| CRM | `CommissionCalculator` | `re_commissions` |

### State Machines (FSM)

3 aggregates use Finite State Machines:

**1. LeadAggregate:**
```
NEW → ASSIGNED → CONTACTED → QUALIFIED → VISIT_SCHEDULED → NEGOTIATING → CONVERTED
  └──────────────────────────────────────────────────────────┴→ LOST
```

**2. BookingAggregate:**
```
DRAFT → PENDING_APPROVAL → CONFIRMED
  └────────────┴─────────────┴→ CANCELLED
```

**3. ContractAggregate:**
```
DRAFT → PENDING_APPROVAL → ACTIVE
  └────────────┴───────────┴→ TERMINATED
```

---

## 📦 Migration 1: Core Schema

### File: `20260802150000_real_estate_core_schema.sql`

#### Enums Created

```sql
-- Product types
product_type: 'apartment' | 'townhouse' | 'shophouse' | 'villa'

-- Lead state machine
lead_state: 'NEW' | 'ASSIGNED' | 'CONTACTED' | 'QUALIFIED' | 
            'VISIT_SCHEDULED' | 'NEGOTIATING' | 'CONVERTED' | 'LOST'

-- Booking state machine
booking_state: 'DRAFT' | 'PENDING_APPROVAL' | 'CONFIRMED' | 'CANCELLED'

-- Contract state machine
contract_state: 'DRAFT' | 'PENDING_APPROVAL' | 'ACTIVE' | 'TERMINATED'

-- Reservation status
reservation_status: 'pending_deposit' | 'deposited' | 
                    'converted_to_contract' | 'cancelled'
```

#### Tables Created

**1. real_estate_projects**
- Primary key: `id` (UUID)
- Unique constraint: `(tenant_id, project_code)`
- Indexes: tenant_id, status, deleted_at

**2. real_estate_products** ← ProductCatalogAggregate
- Primary key: `id` (UUID)
- Foreign keys: `project_id` → real_estate_projects
- Unique constraints: 
  - `(tenant_id, project_id, product_code)`
  - `(project_id, unit_code)`
- Check constraints:
  - `area > 0`
  - `base_price >= 0`
  - `floor_price >= 0`
  - `floor_price <= base_price`
- Indexes: tenant_id, project_id, status, product_type, deleted_at

**3. re_customers** ← Customer360Aggregate
- Primary key: `id` (UUID)
- Unique constraint: `(tenant_id, phone)`
- JSONB columns:
  - `family_members`: Array of {name, relationship, phone}
  - `co_owners`: Array of {name, phone, relationToPrimary}
  - `investment_profile`: {budgetRange, preferredTypes[], preferredAreas[]}
- Array column: `tags` (TEXT[])
- Indexes: tenant_id, phone, email, tags (GIN), deleted_at

**4. re_leads** ← LeadAggregate (with FSM)
- Primary key: `id` (UUID)
- Enum: `state` (lead_state)
- Fields: assigned_to, lost_reason
- Indexes: tenant_id, state, assigned_to, phone, source, deleted_at

**5. re_reservations** ← ReservationDomainModel
- Primary key: `id` (UUID)
- Foreign keys:
  - `product_id` → real_estate_products (ON DELETE RESTRICT)
  - `customer_id` → re_customers (ON DELETE RESTRICT)
- Enum: `status` (reservation_status)
- Timestamps: reserved_at, deposited_at, converted_at, cancelled_at
- Indexes: tenant_id, product_id, customer_id, status, deleted_at

**6. re_bookings** ← BookingAggregate (with FSM)
- Primary key: `id` (UUID)
- Foreign keys:
  - `product_id` → real_estate_products (ON DELETE RESTRICT)
  - `customer_id` → re_customers (ON DELETE RESTRICT)
  - `reservation_id` → re_reservations (ON DELETE SET NULL)
- Enum: `state` (booking_state)
- Check constraint: `booking_fee >= 0`
- Timestamps: submitted_at, confirmed_at, cancelled_at, state_changed_at
- Indexes: tenant_id, product_id, customer_id, reservation_id, state, deleted_at

**7. re_contracts** ← ContractAggregate (with FSM)
- Primary key: `id` (UUID)
- Foreign keys:
  - `product_id` → real_estate_products (ON DELETE RESTRICT)
  - `customer_id` → re_customers (ON DELETE RESTRICT)
  - `booking_id` → re_bookings (ON DELETE SET NULL)
- Unique constraint: `(tenant_id, contract_number)`
- Enum: `state` (contract_state)
- Check constraint: `contract_price > 0`
- JSONB: `installments` (from ContractAggregate.installments)
  ```json
  [
    {
      "installmentNumber": 1,
      "dueDate": "2026-09-01",
      "percentage": 33.33,
      "amount": 500000000,
      "milestoneLabel": "Đợt 1 - Thanh toán định kỳ tháng 1"
    }
  ]
  ```
- Timestamps: signed_date, start_date, end_date, submitted_at, activated_at, terminated_at, state_changed_at
- Indexes: tenant_id, product_id, customer_id, booking_id, state, contract_number, deleted_at

**8. re_transactions**
- Primary key: `id` (UUID)
- Foreign keys:
  - `contract_id` → re_contracts (ON DELETE CASCADE)
  - `customer_id` → re_customers (ON DELETE RESTRICT)
- Fields: transaction_type, amount, transaction_date, installment_number, payment_method, reference_number, status
- Indexes: tenant_id, contract_id, customer_id, transaction_type, status, transaction_date, deleted_at

**9. re_commissions** ← CommissionCalculator
- Primary key: `id` (UUID)
- Foreign keys:
  - `contract_id` → re_contracts (ON DELETE CASCADE)
  - `booking_id` → re_bookings (ON DELETE SET NULL)
- Fields: agent_id, commission_amount, commission_percentage, base_amount, status
- Timestamps: earned_at, approved_at, paid_at
- Indexes: tenant_id, agent_id, contract_id, status, deleted_at

#### Row-Level Security (RLS)

All tables have RLS enabled with simple tenant isolation:

```sql
-- Policy pattern (same for all 9 tables)
CREATE POLICY "Authenticated users can view [table] from their tenant"
  ON [table_name] FOR SELECT
  TO authenticated
  USING (tenant_id IN (
    SELECT tenant_id FROM tenants 
    WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid
  ));
```

**Note:** These are simplified policies. Production should use role-based policies (admin, manager, agent).

---

## 📦 Migration 2: RPC Functions

### File: `20260802151000_real_estate_rpc_functions.sql`

#### Product Catalog Functions

**1. get_available_products(tenant_id, project_id)**
- Returns available products for a project
- Filters: status = 'available', deleted_at IS NULL
- Security: DEFINER, STABLE

#### Reservation Functions

**2. reserve_product(tenant_id, product_id, customer_id, deposit_amount, created_by)**
- Atomically reserves a product
- Checks product availability (FOR UPDATE lock)
- Creates reservation record
- Updates product status to 'reserved'
- Returns reservation_id
- Throws exception if product not available

**3. confirm_reservation_deposit(tenant_id, reservation_id, updated_by)**
- Confirms deposit received
- Validates status: must be 'pending_deposit'
- Updates status to 'deposited'
- Sets deposited_at timestamp

**4. cancel_reservation(tenant_id, reservation_id, reason, updated_by)**
- Cancels reservation
- Validates: cannot cancel if 'converted_to_contract'
- Updates status to 'cancelled'
- Releases product back to 'available'

#### Booking Functions

**5. transition_booking_state(tenant_id, booking_id, new_state, updated_by)**
- Implements FSM transitions from BookingAggregate
- Validates state transitions:
  - DRAFT → PENDING_APPROVAL ✓
  - DRAFT → CANCELLED ✓
  - PENDING_APPROVAL → CONFIRMED ✓
  - PENDING_APPROVAL → CANCELLED ✓
  - CONFIRMED → CANCELLED ✓
- Updates timestamps (submitted_at, confirmed_at, cancelled_at)
- Sets state_changed_at

#### Contract Functions

**6. transition_contract_state(tenant_id, contract_id, new_state, updated_by)**
- Implements FSM transitions from ContractAggregate
- Validates state transitions:
  - DRAFT → PENDING_APPROVAL ✓
  - DRAFT → TERMINATED ✓
  - PENDING_APPROVAL → ACTIVE ✓
  - PENDING_APPROVAL → TERMINATED ✓
  - ACTIVE → TERMINATED ✓
- Updates timestamps (submitted_at, activated_at, terminated_at)
- When state = ACTIVE: updates product status to 'sold'

**7. generate_contract_installments(tenant_id, contract_id, installments_count, start_date, updated_by)**
- Implements ContractAggregate.generatePaymentSchedule()
- Divides contract_price into equal installments
- Last installment gets remainder (to handle rounding)
- Monthly schedule (dueDate = start_date + i months)
- Stores in contract.installments JSONB column
- Validates installments_count > 0

#### Lead Functions

**8. transition_lead_state(tenant_id, lead_id, new_state, assigned_to, lost_reason, updated_by)**
- Implements FSM transitions from LeadAggregate
- Validates state transitions:
  - NEW → ASSIGNED ✓
  - ASSIGNED → CONTACTED ✓
  - CONTACTED → QUALIFIED ✓
  - QUALIFIED → VISIT_SCHEDULED ✓
  - VISIT_SCHEDULED → NEGOTIATING ✓
  - NEGOTIATING → CONVERTED ✓
  - Any → LOST ✓
- Sets assigned_to when state = ASSIGNED
- Sets lost_reason when state = LOST
- Updates state_changed_at

#### Dashboard Functions

**9. get_sales_dashboard_stats(tenant_id, project_id?)**
- Returns aggregated stats:
  - Product stats: total, available, reserved, sold
  - Booking stats: total, confirmed
  - Contract stats: active count, total revenue
- Optional project filter
- Security: DEFINER, STABLE

---

## 🚀 Deployment Instructions

### Prerequisites

- Supabase Dashboard access (Project Owner/Admin)
- PostgreSQL 14+ (Supabase default)
- Existing `tenants` table (for RLS policies)

### Step 1: Deploy Core Schema

1. Open Supabase Dashboard → SQL Editor
2. Copy content from `supabase/migrations/20260802150000_real_estate_core_schema.sql`
3. Click "Run"
4. Verify output:
   ```
   ✅ Real Estate tables created: 9
   ✅ Real Estate enums created: 5
   ✅ RLS policies created: 9
   ✅ REAL ESTATE CORE SCHEMA DEPLOYED SUCCESSFULLY
   ```

### Step 2: Deploy RPC Functions

1. Open Supabase Dashboard → SQL Editor
2. Copy content from `supabase/migrations/20260802151000_real_estate_rpc_functions.sql`
3. Click "Run"
4. Verify output:
   ```
   ✅ Real Estate RPC functions created: 9
   ✅ REAL ESTATE RPC FUNCTIONS DEPLOYED SUCCESSFULLY
   ```

### Step 3: Verification

Run verification queries:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_name LIKE 're_%' OR table_name LIKE 'real_estate_%'
ORDER BY table_name;
-- Expected: 9 tables

-- Check enums
SELECT typname 
FROM pg_type 
WHERE typname IN (
  'product_type', 'lead_state', 'booking_state', 
  'contract_state', 'reservation_status'
);
-- Expected: 5 enums

-- Check RPC functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%product%' 
   OR routine_name LIKE '%reservation%'
   OR routine_name LIKE '%booking%'
   OR routine_name LIKE '%contract%'
   OR routine_name LIKE '%lead%'
   OR routine_name = 'get_sales_dashboard_stats'
ORDER BY routine_name;
-- Expected: 9 functions

-- Check RLS policies
SELECT tablename, COUNT(*) AS policy_count
FROM pg_policies
WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%'
GROUP BY tablename
ORDER BY tablename;
-- Expected: 9 tables with at least 1 policy each
```

---

## 🔄 Rollback Procedures

### Rollback Migration 2 (RPC Functions)

```sql
-- Drop all Real Estate RPC functions
DROP FUNCTION IF EXISTS get_available_products CASCADE;
DROP FUNCTION IF EXISTS reserve_product CASCADE;
DROP FUNCTION IF EXISTS confirm_reservation_deposit CASCADE;
DROP FUNCTION IF EXISTS cancel_reservation CASCADE;
DROP FUNCTION IF EXISTS transition_booking_state CASCADE;
DROP FUNCTION IF EXISTS transition_contract_state CASCADE;
DROP FUNCTION IF EXISTS generate_contract_installments CASCADE;
DROP FUNCTION IF EXISTS transition_lead_state CASCADE;
DROP FUNCTION IF EXISTS get_sales_dashboard_stats CASCADE;

-- Verify
SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%reservation%' OR proname LIKE '%booking%';
-- Expected: 0
```

### Rollback Migration 1 (Core Schema)

**⚠️ WARNING:** This will delete all Real Estate data!

```sql
-- Drop tables (CASCADE will drop dependent objects)
DROP TABLE IF EXISTS re_commissions CASCADE;
DROP TABLE IF EXISTS re_transactions CASCADE;
DROP TABLE IF EXISTS re_contracts CASCADE;
DROP TABLE IF EXISTS re_bookings CASCADE;
DROP TABLE IF EXISTS re_reservations CASCADE;
DROP TABLE IF EXISTS re_leads CASCADE;
DROP TABLE IF EXISTS re_customers CASCADE;
DROP TABLE IF EXISTS real_estate_products CASCADE;
DROP TABLE IF EXISTS real_estate_projects CASCADE;

-- Drop enums
DROP TYPE IF EXISTS reservation_status CASCADE;
DROP TYPE IF EXISTS contract_state CASCADE;
DROP TYPE IF EXISTS booking_state CASCADE;
DROP TYPE IF EXISTS lead_state CASCADE;
DROP TYPE IF EXISTS product_type CASCADE;

-- Verify
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 're_%' OR table_name LIKE 'real_estate_%';
-- Expected: No rows

SELECT typname FROM pg_type 
WHERE typname IN ('product_type', 'lead_state', 'booking_state', 'contract_state', 'reservation_status');
-- Expected: No rows
```

---

## 🧪 Testing Migrations

### Test 1: Create Project and Products

```sql
-- Insert test project
INSERT INTO real_estate_projects (tenant_id, project_code, project_name, status)
VALUES (
  'your-tenant-id',
  'PRJ001',
  'Bella Gardens',
  'selling'
);

-- Insert test products
INSERT INTO real_estate_products (
  tenant_id, project_id, product_code, product_type, unit_code,
  area_m2, base_price, floor_price, unit_price, status
)
SELECT
  'your-tenant-id',
  id,
  'A101',
  'apartment'::product_type,
  'A101',
  75.5,
  2000000000,
  1800000000,
  2000000000,
  'available'
FROM real_estate_projects WHERE project_code = 'PRJ001';

-- Query available products
SELECT * FROM get_available_products('your-tenant-id', (SELECT id FROM real_estate_projects WHERE project_code = 'PRJ001'));
```

### Test 2: Reservation Flow

```sql
-- Create customer
INSERT INTO re_customers (tenant_id, name, phone, email)
VALUES ('your-tenant-id', 'Test Customer', '0901234567', 'test@example.com')
RETURNING id;

-- Reserve product
SELECT reserve_product(
  'your-tenant-id',
  (SELECT id FROM real_estate_products WHERE product_code = 'A101'),
  (SELECT id FROM re_customers WHERE phone = '0901234567'),
  50000000, -- deposit
  'user-id'
);

-- Confirm deposit
SELECT confirm_reservation_deposit(
  'your-tenant-id',
  (SELECT id FROM re_reservations ORDER BY created_at DESC LIMIT 1),
  'user-id'
);

-- Check status
SELECT status FROM re_reservations ORDER BY created_at DESC LIMIT 1;
-- Expected: 'deposited'
```

### Test 3: Lead State Machine

```sql
-- Create lead
INSERT INTO re_leads (tenant_id, name, phone, state)
VALUES ('your-tenant-id', 'Test Lead', '0907654321', 'NEW')
RETURNING id;

-- Transition: NEW → ASSIGNED
SELECT transition_lead_state(
  'your-tenant-id',
  (SELECT id FROM re_leads WHERE phone = '0907654321'),
  'ASSIGNED'::lead_state,
  'agent-user-id',
  NULL,
  'user-id'
);

-- Check state
SELECT state, assigned_to FROM re_leads WHERE phone = '0907654321';
-- Expected: state = 'ASSIGNED', assigned_to = 'agent-user-id'

-- Try invalid transition (should fail)
SELECT transition_lead_state(
  'your-tenant-id',
  (SELECT id FROM re_leads WHERE phone = '0907654321'),
  'CONVERTED'::lead_state,
  NULL,
  NULL,
  'user-id'
);
-- Expected: ERROR: Invalid transition from ASSIGNED to CONVERTED
```

### Test 4: Contract Installments

```sql
-- Create contract
INSERT INTO re_contracts (
  tenant_id, product_id, customer_id, contract_price, state
)
SELECT
  'your-tenant-id',
  p.id,
  c.id,
  2000000000,
  'DRAFT'::contract_state
FROM real_estate_products p, re_customers c
WHERE p.product_code = 'A101' AND c.phone = '0901234567'
RETURNING id;

-- Generate 12 monthly installments
SELECT generate_contract_installments(
  'your-tenant-id',
  (SELECT id FROM re_contracts ORDER BY created_at DESC LIMIT 1),
  12, -- 12 months
  '2026-09-01'::DATE,
  'user-id'
);

-- Check installments
SELECT 
  jsonb_array_length(installments) AS installment_count,
  installments
FROM re_contracts 
ORDER BY created_at DESC LIMIT 1;
-- Expected: installment_count = 12
```

---

## 📊 Post-Deployment Monitoring

### Health Checks

Run these queries after deployment:

```sql
-- 1. Check for orphaned records (referential integrity)
SELECT 'Orphaned products' AS issue, COUNT(*) AS count
FROM real_estate_products p
LEFT JOIN real_estate_projects pr ON p.project_id = pr.id
WHERE pr.id IS NULL;

-- 2. Check for invalid product prices
SELECT 'Invalid floor_price' AS issue, COUNT(*) AS count
FROM real_estate_products
WHERE floor_price > base_price;

-- 3. Check for duplicate customer phones per tenant
SELECT tenant_id, phone, COUNT(*) AS duplicate_count
FROM re_customers
GROUP BY tenant_id, phone
HAVING COUNT(*) > 1;

-- 4. Check for reservations without products
SELECT 'Reservations without products' AS issue, COUNT(*) AS count
FROM re_reservations r
LEFT JOIN real_estate_products p ON r.product_id = p.id
WHERE p.id IS NULL;

-- 5. Check RLS policy count
SELECT 
  COUNT(DISTINCT tablename) AS tables_with_rls,
  COUNT(*) AS total_policies
FROM pg_policies
WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%';
-- Expected: 9 tables, at least 9 policies
```

---

## 🔗 Related Documents

- **Codebase Analysis:** `docs/real-estate/REAL_ESTATE_MODULE_COMPREHENSIVE_ANALYSIS.md`
- **Architecture Diagrams:** `docs/real-estate/ARCHITECTURE_DIAGRAM.md`
- **Chief Architect Review:** `docs/real-estate/CHIEF_ARCHITECT_REVIEW.md`
- **Assessment Report:** `docs/real-estate/REAL_ESTATE_ASSESSMENT_REPORT.html`

---

## 📝 Migration History

| Version | Date | Description | Status |
|---------|------|-------------|--------|
| 1.0.0 | 2026-08-02 | Initial schema + RPC functions | ✅ Ready |

---

**Last Updated:** 2026-08-02  
**Version:** 1.0.0  
**Maintainer:** DevOps Team
