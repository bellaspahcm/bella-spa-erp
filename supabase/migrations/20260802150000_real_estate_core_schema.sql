-- ============================================================================
-- REAL ESTATE MODULE - CORE SCHEMA MIGRATION
-- ============================================================================
-- Version: 1.0.0
-- Date: 2026-08-02
-- Description: Core tables for Real Estate ERP module
--              Extracted from domain models in src/modules/real_estate/contexts
-- ============================================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'REAL ESTATE MODULE - CORE SCHEMA'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: ENUMS
-- ============================================================================

-- Product Type (Product Catalog Context)
DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('apartment', 'townhouse', 'shophouse', 'villa');
  RAISE NOTICE '  ✓ Created enum: product_type';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: product_type';
END $$;

-- Lead State (CRM Context)
DO $$ BEGIN
  CREATE TYPE lead_state AS ENUM (
    'NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 
    'VISIT_SCHEDULED', 'NEGOTIATING', 'CONVERTED', 'LOST'
  );
  RAISE NOTICE '  ✓ Created enum: lead_state';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: lead_state';
END $$;

-- Booking State (Sales Context)
DO $$ BEGIN
  CREATE TYPE booking_state AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED'
  );
  RAISE NOTICE '  ✓ Created enum: booking_state';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: booking_state';
END $$;

-- Contract State (Sales Context)
DO $$ BEGIN
  CREATE TYPE contract_state AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'TERMINATED'
  );
  RAISE NOTICE '  ✓ Created enum: contract_state';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: contract_state';
END $$;

-- Reservation Status (Sales Context)
DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'pending_deposit', 'deposited', 'converted_to_contract', 'cancelled'
  );
  RAISE NOTICE '  ✓ Created enum: reservation_status';
EXCEPTION WHEN duplicate_object THEN
  RAISE NOTICE '  ⚠️  Enum already exists: reservation_status';
END $$;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 2: CORE TABLES'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- ============================================================================
-- Projects Table (Product Catalog Context)
-- ============================================================================
CREATE TABLE IF NOT EXISTS real_estate_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  location TEXT,
  total_units INTEGER DEFAULT 0,
  developer TEXT,
  description TEXT,
  status TEXT DEFAULT 'planning', -- planning, selling, sold_out, completed
  launch_date DATE,
  completion_date DATE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_project_code_per_tenant UNIQUE (tenant_id, project_code)
);

CREATE INDEX IF NOT EXISTS idx_re_projects_tenant ON real_estate_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_projects_status ON real_estate_projects(status);
CREATE INDEX IF NOT EXISTS idx_re_projects_deleted ON real_estate_projects(deleted_at);

COMMENT ON TABLE real_estate_projects IS 'Real estate projects/developments';
COMMENT ON COLUMN real_estate_projects.tenant_id IS 'Tenant isolation - required for multi-tenancy';
COMMENT ON COLUMN real_estate_projects.project_code IS 'Unique project identifier per tenant';

-- ============================================================================
-- Products Table (Product Catalog Context - ProductCatalogAggregate)
-- ============================================================================
CREATE TABLE IF NOT EXISTS real_estate_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES real_estate_projects(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_type product_type NOT NULL,
  unit_code TEXT NOT NULL,
  
  -- Physical attributes
  block TEXT,
  floor TEXT,
  floor_number INTEGER,
  area NUMERIC(10, 2) NOT NULL CHECK (area > 0),
  area_m2 NUMERIC(10, 2) NOT NULL CHECK (area_m2 > 0),
  direction TEXT,
  
  -- Pricing (from ProductCatalogAggregate)
  base_price NUMERIC(15, 2) NOT NULL CHECK (base_price >= 0),
  floor_price NUMERIC(15, 2) NOT NULL CHECK (floor_price >= 0),
  unit_price NUMERIC(15, 2) NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'available', -- available, reserved, sold, unavailable
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_product_code_per_tenant UNIQUE (tenant_id, project_id, product_code),
  CONSTRAINT unique_unit_code_per_project UNIQUE (project_id, unit_code),
  CONSTRAINT floor_price_lte_base_price CHECK (floor_price <= base_price)
);

CREATE INDEX IF NOT EXISTS idx_re_products_tenant ON real_estate_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_products_project ON real_estate_products(project_id);
CREATE INDEX IF NOT EXISTS idx_re_products_status ON real_estate_products(status);
CREATE INDEX IF NOT EXISTS idx_re_products_type ON real_estate_products(product_type);
CREATE INDEX IF NOT EXISTS idx_re_products_deleted ON real_estate_products(deleted_at);

COMMENT ON TABLE real_estate_products IS 'Real estate products (apartments, villas, etc.) - ProductCatalogAggregate';
COMMENT ON COLUMN real_estate_products.product_code IS 'Unique product identifier within project';
COMMENT ON COLUMN real_estate_products.base_price IS 'Base price before adjustments';
COMMENT ON COLUMN real_estate_products.floor_price IS 'Floor price (minimum allowed), must be <= base_price';

-- ============================================================================
-- Customers Table (CRM Context - Customer360Aggregate)
-- ============================================================================
CREATE TABLE IF NOT EXISTS re_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  
  -- Customer360 extended info
  family_members JSONB DEFAULT '[]'::jsonb, -- Array of {name, relationship, phone}
  co_owners JSONB DEFAULT '[]'::jsonb, -- Array of {name, phone, relationToPrimary}
  investment_profile JSONB, -- {budgetRange, preferredTypes[], preferredAreas[]}
  tags TEXT[] DEFAULT '{}',
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_phone_per_tenant UNIQUE (tenant_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_re_customers_tenant ON re_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_customers_phone ON re_customers(phone);
CREATE INDEX IF NOT EXISTS idx_re_customers_email ON re_customers(email);
CREATE INDEX IF NOT EXISTS idx_re_customers_tags ON re_customers USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_re_customers_deleted ON re_customers(deleted_at);

COMMENT ON TABLE re_customers IS 'Real estate customers with 360-degree view - Customer360Aggregate';
COMMENT ON COLUMN re_customers.family_members IS 'Array of family member objects';
COMMENT ON COLUMN re_customers.co_owners IS 'Array of co-owner objects';
COMMENT ON COLUMN re_customers.investment_profile IS 'Investment preferences and budget';

-- ============================================================================
-- Leads Table (CRM Context - LeadAggregate with FSM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS re_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  
  -- Lead assignment
  assigned_to UUID, -- Sales agent user ID
  
  -- State machine (LeadAggregate)
  state lead_state NOT NULL DEFAULT 'NEW',
  lost_reason TEXT,
  
  -- Source tracking
  source TEXT, -- walk_in, online, referral, event, partner
  campaign_id TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_re_leads_tenant ON re_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_state ON re_leads(state);
CREATE INDEX IF NOT EXISTS idx_re_leads_assigned ON re_leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_re_leads_phone ON re_leads(phone);
CREATE INDEX IF NOT EXISTS idx_re_leads_source ON re_leads(source);
CREATE INDEX IF NOT EXISTS idx_re_leads_deleted ON re_leads(deleted_at);

COMMENT ON TABLE re_leads IS 'Sales leads with FSM - LeadAggregate';
COMMENT ON COLUMN re_leads.state IS 'Lead state machine: NEW → ASSIGNED → CONTACTED → QUALIFIED → VISIT_SCHEDULED → NEGOTIATING → CONVERTED/LOST';
COMMENT ON COLUMN re_leads.assigned_to IS 'Assigned sales agent user ID';

-- ============================================================================
-- Reservations Table (Sales Context - ReservationDomainModel)
-- ============================================================================
CREATE TABLE IF NOT EXISTS re_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  
  -- Reservation details
  deposit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status reservation_status NOT NULL DEFAULT 'pending_deposit',
  
  -- Timestamps
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  deposited_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_re_reservations_tenant ON re_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_product ON re_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_customer ON re_reservations(customer_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_status ON re_reservations(status);
CREATE INDEX IF NOT EXISTS idx_re_reservations_deleted ON re_reservations(deleted_at);

COMMENT ON TABLE re_reservations IS 'Product reservations - ReservationDomainModel';
COMMENT ON COLUMN re_reservations.status IS 'Reservation status: pending_deposit → deposited → converted_to_contract / cancelled';

-- ============================================================================
-- Bookings Table (Sales Context - BookingAggregate with FSM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS re_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  reservation_id UUID REFERENCES re_reservations(id) ON DELETE SET NULL,
  
  -- Booking details
  booking_fee NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (booking_fee >= 0),
  
  -- State machine (BookingAggregate)
  state booking_state NOT NULL DEFAULT 'DRAFT',
  
  -- Timestamps
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_re_bookings_tenant ON re_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_bookings_product ON re_bookings(product_id);
CREATE INDEX IF NOT EXISTS idx_re_bookings_customer ON re_bookings(customer_id);
CREATE INDEX IF NOT EXISTS idx_re_bookings_reservation ON re_bookings(reservation_id);
CREATE INDEX IF NOT EXISTS idx_re_bookings_state ON re_bookings(state);
CREATE INDEX IF NOT EXISTS idx_re_bookings_deleted ON re_bookings(deleted_at);

COMMENT ON TABLE re_bookings IS 'Product bookings with FSM - BookingAggregate';
COMMENT ON COLUMN re_bookings.state IS 'Booking state machine: DRAFT → PENDING_APPROVAL → CONFIRMED / CANCELLED';

-- ============================================================================
-- Contracts Table (Sales Context - ContractAggregate with FSM)
-- ============================================================================
CREATE TABLE IF NOT EXISTS re_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  booking_id UUID REFERENCES re_bookings(id) ON DELETE SET NULL,
  
  -- Contract details
  contract_number TEXT,
  contract_price NUMERIC(15, 2) NOT NULL CHECK (contract_price > 0),
  
  -- State machine (ContractAggregate)
  state contract_state NOT NULL DEFAULT 'DRAFT',
  
  -- Installment schedule (from ContractAggregate.installments)
  installments JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  signed_date DATE,
  start_date DATE,
  end_date DATE,
  submitted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT unique_contract_number_per_tenant UNIQUE (tenant_id, contract_number)
);

CREATE INDEX IF NOT EXISTS idx_re_contracts_tenant ON re_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_contracts_product ON re_contracts(product_id);
CREATE INDEX IF NOT EXISTS idx_re_contracts_customer ON re_contracts(customer_id);
CREATE INDEX IF NOT EXISTS idx_re_contracts_booking ON re_contracts(booking_id);
CREATE INDEX IF NOT EXISTS idx_re_contracts_state ON re_contracts(state);
CREATE INDEX IF NOT EXISTS idx_re_contracts_number ON re_contracts(contract_number);
CREATE INDEX IF NOT EXISTS idx_re_contracts_deleted ON re_contracts(deleted_at);

COMMENT ON TABLE re_contracts IS 'Sales contracts with FSM and installment schedule - ContractAggregate';
COMMENT ON COLUMN re_contracts.state IS 'Contract state machine: DRAFT → PENDING_APPROVAL → ACTIVE / TERMINATED';
COMMENT ON COLUMN re_contracts.installments IS 'Array of installment objects: {installmentNumber, dueDate, percentage, amount, milestoneLabel}';

-- ============================================================================
-- Transactions Table (Finance Context)
-- ============================================================================
CREATE TABLE IF NOT EXISTS re_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  contract_id UUID REFERENCES re_contracts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  
  -- Transaction details
  transaction_type TEXT NOT NULL, -- deposit, installment, penalty, refund
  amount NUMERIC(15, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  
  -- Installment tracking
  installment_number INTEGER,
  
  -- Payment details
  payment_method TEXT, -- cash, bank_transfer, credit_card, cheque
  reference_number TEXT,
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, completed, failed, refunded
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_re_transactions_tenant ON re_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_transactions_contract ON re_transactions(contract_id);
CREATE INDEX IF NOT EXISTS idx_re_transactions_customer ON re_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_re_transactions_type ON re_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_re_transactions_status ON re_transactions(status);
CREATE INDEX IF NOT EXISTS idx_re_transactions_date ON re_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_re_transactions_deleted ON re_transactions(deleted_at);

COMMENT ON TABLE re_transactions IS 'Financial transactions (deposits, installments, etc.)';
COMMENT ON COLUMN re_transactions.transaction_type IS 'Type: deposit, installment, penalty, refund';

-- ============================================================================
-- Commissions Table (CRM Context - CommissionCalculator)
-- ============================================================================
CREATE TABLE IF NOT EXISTS re_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL, -- Sales agent user ID
  contract_id UUID NOT NULL REFERENCES re_contracts(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES re_bookings(id) ON DELETE SET NULL,
  
  -- Commission details
  commission_amount NUMERIC(15, 2) NOT NULL,
  commission_percentage NUMERIC(5, 2),
  base_amount NUMERIC(15, 2) NOT NULL, -- Amount commission is calculated from
  
  -- Status
  status TEXT DEFAULT 'pending', -- pending, approved, paid, cancelled
  
  -- Timestamps
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_re_commissions_tenant ON re_commissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_commissions_agent ON re_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_re_commissions_contract ON re_commissions(contract_id);
CREATE INDEX IF NOT EXISTS idx_re_commissions_status ON re_commissions(status);
CREATE INDEX IF NOT EXISTS idx_re_commissions_deleted ON re_commissions(deleted_at);

COMMENT ON TABLE re_commissions IS 'Sales agent commissions - CommissionCalculator';
COMMENT ON COLUMN re_commissions.agent_id IS 'Sales agent user ID who earned commission';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'SECTION 3: ROW LEVEL SECURITY (RLS)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Enable RLS on all tables
ALTER TABLE real_estate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_commissions ENABLE ROW LEVEL SECURITY;

-- Simple tenant isolation policies (authenticated users see only their tenant data)
-- Note: These are simplified policies. Production should use more granular role-based policies.

-- Projects
CREATE POLICY "Authenticated users can view projects from their tenant"
  ON real_estate_projects FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Products
CREATE POLICY "Authenticated users can view products from their tenant"
  ON real_estate_products FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Customers
CREATE POLICY "Authenticated users can view customers from their tenant"
  ON re_customers FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Leads
CREATE POLICY "Authenticated users can view leads from their tenant"
  ON re_leads FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Reservations
CREATE POLICY "Authenticated users can view reservations from their tenant"
  ON re_reservations FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Bookings
CREATE POLICY "Authenticated users can view bookings from their tenant"
  ON re_bookings FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Contracts
CREATE POLICY "Authenticated users can view contracts from their tenant"
  ON re_contracts FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Transactions
CREATE POLICY "Authenticated users can view transactions from their tenant"
  ON re_transactions FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

-- Commissions
CREATE POLICY "Authenticated users can view commissions from their tenant"
  ON re_commissions FOR SELECT
  TO authenticated
  USING (tenant_id IN (SELECT tenant_id FROM tenants WHERE id = (auth.jwt() -> 'tenant_id')::text::uuid));

RAISE NOTICE '  ✓ Created RLS policies for all Real Estate tables';

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo 'VERIFICATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

DO $$
DECLARE
  v_table_count INT;
  v_enum_count INT;
  v_policy_count INT;
BEGIN
  -- Count tables
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_name IN (
    'real_estate_projects', 'real_estate_products', 're_customers', 're_leads',
    're_reservations', 're_bookings', 're_contracts', 're_transactions', 're_commissions'
  );
  RAISE NOTICE '✅ Real Estate tables created: %', v_table_count;
  
  -- Count enums
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_type
  WHERE typname IN (
    'product_type', 'lead_state', 'booking_state', 'contract_state', 'reservation_status'
  );
  RAISE NOTICE '✅ Real Estate enums created: %', v_enum_count;
  
  -- Count policies
  SELECT COUNT(*) INTO v_policy_count
  FROM pg_policies
  WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%';
  RAISE NOTICE '✅ RLS policies created: %', v_policy_count;
  
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ REAL ESTATE CORE SCHEMA DEPLOYED SUCCESSFULLY';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Tables: % | Enums: % | RLS Policies: %', v_table_count, v_enum_count, v_policy_count;
  RAISE NOTICE '';
END $$;
