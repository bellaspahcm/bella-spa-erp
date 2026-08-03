-- ============================================================================
-- REAL ESTATE - CREATE TABLES ONLY (No complex indexes)
-- ============================================================================
-- Run this FIRST to create all tables with all columns
-- ============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE product_type AS ENUM ('apartment', 'townhouse', 'shophouse', 'villa');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lead_state AS ENUM (
    'NEW', 'ASSIGNED', 'CONTACTED', 'QUALIFIED', 
    'VISIT_SCHEDULED', 'NEGOTIATING', 'CONVERTED', 'LOST'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE booking_state AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'CONFIRMED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE contract_state AS ENUM (
    'DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'TERMINATED'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM (
    'pending_deposit', 'deposited', 'converted_to_contract', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES (với đầy đủ columns bao gồm deleted_at, area_m2)
-- ============================================================================

-- Projects
CREATE TABLE IF NOT EXISTS real_estate_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  project_code TEXT NOT NULL,
  project_name TEXT NOT NULL,
  location TEXT,
  total_units INTEGER DEFAULT 0,
  developer TEXT,
  description TEXT,
  status TEXT DEFAULT 'planning',
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

-- Products
CREATE TABLE IF NOT EXISTS real_estate_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES real_estate_projects(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_type product_type NOT NULL,
  unit_code TEXT NOT NULL,
  block TEXT,
  floor TEXT,
  floor_number INTEGER,
  area NUMERIC(10, 2) NOT NULL CHECK (area > 0),
  area_m2 NUMERIC(10, 2) NOT NULL DEFAULT 0,
  direction TEXT,
  base_price NUMERIC(15, 2) NOT NULL CHECK (base_price >= 0),
  floor_price NUMERIC(15, 2) NOT NULL CHECK (floor_price >= 0),
  unit_price NUMERIC(15, 2) NOT NULL,
  status TEXT DEFAULT 'available',
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

-- Customers
CREATE TABLE IF NOT EXISTS re_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  family_members JSONB DEFAULT '[]'::jsonb,
  co_owners JSONB DEFAULT '[]'::jsonb,
  investment_profile JSONB,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT unique_phone_per_tenant UNIQUE (tenant_id, phone)
);

-- Leads
CREATE TABLE IF NOT EXISTS re_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  assigned_to UUID,
  state lead_state NOT NULL DEFAULT 'NEW',
  lost_reason TEXT,
  source TEXT,
  campaign_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Reservations
CREATE TABLE IF NOT EXISTS re_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  deposit_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  status reservation_status NOT NULL DEFAULT 'pending_deposit',
  reserved_at TIMESTAMPTZ DEFAULT NOW(),
  deposited_at TIMESTAMPTZ,
  converted_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Bookings
CREATE TABLE IF NOT EXISTS re_bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  reservation_id UUID REFERENCES re_reservations(id) ON DELETE SET NULL,
  booking_fee NUMERIC(15, 2) NOT NULL DEFAULT 0 CHECK (booking_fee >= 0),
  state booking_state NOT NULL DEFAULT 'DRAFT',
  submitted_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  state_changed_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Contracts
CREATE TABLE IF NOT EXISTS re_contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  booking_id UUID REFERENCES re_bookings(id) ON DELETE SET NULL,
  contract_number TEXT,
  contract_price NUMERIC(15, 2) NOT NULL CHECK (contract_price > 0),
  state contract_state NOT NULL DEFAULT 'DRAFT',
  installments JSONB DEFAULT '[]'::jsonb,
  signed_date DATE,
  start_date DATE,
  end_date DATE,
  submitted_at TIMESTAMPTZ,
  activated_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
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

-- Transactions
CREATE TABLE IF NOT EXISTS re_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  contract_id UUID REFERENCES re_contracts(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES re_customers(id) ON DELETE RESTRICT,
  transaction_type TEXT NOT NULL,
  amount NUMERIC(15, 2) NOT NULL,
  transaction_date DATE NOT NULL,
  installment_number INTEGER,
  payment_method TEXT,
  reference_number TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Commissions
CREATE TABLE IF NOT EXISTS re_commissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  contract_id UUID NOT NULL REFERENCES re_contracts(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES re_bookings(id) ON DELETE SET NULL,
  commission_amount NUMERIC(15, 2) NOT NULL,
  commission_percentage NUMERIC(5, 2),
  base_amount NUMERIC(15, 2) NOT NULL,
  status TEXT DEFAULT 'pending',
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  deleted_at TIMESTAMPTZ
);

-- Basic indexes only (tenant_id)
CREATE INDEX IF NOT EXISTS idx_re_projects_tenant ON real_estate_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_products_tenant ON real_estate_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_customers_tenant ON re_customers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_tenant ON re_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_tenant ON re_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_bookings_tenant ON re_bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_contracts_tenant ON re_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_transactions_tenant ON re_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_commissions_tenant ON re_commissions(tenant_id);

-- Enable RLS
ALTER TABLE real_estate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_commissions ENABLE ROW LEVEL SECURITY;

-- Summary
DO $$
DECLARE
  v_table_count INT;
  v_enum_count INT;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND (table_name LIKE 're_%' OR table_name LIKE 'real_estate_%');
  
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_type
  WHERE typname IN ('product_type', 'lead_state', 'booking_state', 'contract_state', 'reservation_status');
  
  RAISE NOTICE '✅ Tables: % | Enums: % | Ready for performance indexes!', v_table_count, v_enum_count;
END $$;
