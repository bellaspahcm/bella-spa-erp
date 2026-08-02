-- ============================================================================
-- Partner Portal Database Migration - Real Estate Module
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Create ENUM Types
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE re_product_type AS ENUM ('apartment', 'townhouse', 'shophouse', 'villa', 'land_plot', 'office');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_product_status AS ENUM ('available', 'booked', 'deposited', 'contracted', 'paid', 'handed_over', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_reservation_status AS ENUM ('active', 'released', 'expired', 'converted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_commission_status AS ENUM ('pending', 'approved', 'paid', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_document_type AS ENUM ('brochure', 'price_list', 'legal_docs', 'bank_policy', 'faq', 'training', 'contract_template', 'other');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE re_transaction_type AS ENUM ('booking', 'deposit', 'contract', 'payment_milestone', 'adjustment');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- STEP 2: Create Tables
-- ============================================================================

-- Table: real_estate_projects
CREATE TABLE IF NOT EXISTS real_estate_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  developer TEXT,
  location TEXT,
  total_units INTEGER,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- Table: real_estate_products
CREATE TABLE IF NOT EXISTS real_estate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES real_estate_projects(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_type re_product_type NOT NULL DEFAULT 'apartment',
  block TEXT,
  floor TEXT,
  area NUMERIC(10, 2),
  unit_price NUMERIC(15, 2),
  status re_product_status NOT NULL DEFAULT 'available',
  owner_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  UNIQUE(tenant_id, product_code)
);

-- Table: re_reservations
CREATE TABLE IF NOT EXISTS re_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES real_estate_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id),
  status re_reservation_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: re_commission_ledger
CREATE TABLE IF NOT EXISTS re_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES real_estate_products(id) ON DELETE SET NULL,
  transaction_type re_transaction_type NOT NULL,
  base_amount NUMERIC(15, 2) NOT NULL,
  commission_rate NUMERIC(5, 2),
  commission_amount NUMERIC(15, 2) NOT NULL,
  status re_commission_status NOT NULL DEFAULT 'pending',
  earned_date DATE NOT NULL DEFAULT CURRENT_DATE,
  paid_date DATE,
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: re_documents
CREATE TABLE IF NOT EXISTS re_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES real_estate_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type re_document_type NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  version TEXT DEFAULT '1.0',
  is_latest BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Table: re_partner_leads
CREATE TABLE IF NOT EXISTS re_partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  budget TEXT,
  status TEXT NOT NULL DEFAULT 'registered',
  notes TEXT,
  protected_until TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id),
  CONSTRAINT re_leads_tenant_phone_unique UNIQUE(tenant_id, phone)
);

-- ============================================================================
-- STEP 3: Create Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_re_projects_tenant ON real_estate_projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_products_tenant ON real_estate_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_products_project ON real_estate_products(project_id);
CREATE INDEX IF NOT EXISTS idx_re_products_status ON real_estate_products(status);
CREATE INDEX IF NOT EXISTS idx_re_reservations_tenant ON re_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_user ON re_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_product ON re_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_status ON re_reservations(status);
CREATE INDEX IF NOT EXISTS idx_re_commission_tenant ON re_commission_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_commission_user ON re_commission_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_re_commission_status ON re_commission_ledger(status);
CREATE INDEX IF NOT EXISTS idx_re_documents_tenant ON re_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_documents_project ON re_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_tenant ON re_partner_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_user ON re_partner_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_phone ON re_partner_leads(phone);

-- ============================================================================
-- STEP 4: Enable Row Level Security
-- ============================================================================

ALTER TABLE real_estate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_estate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE re_partner_leads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 5: Create RLS Policies
-- ============================================================================

-- Projects: Users can read their tenant's projects
DROP POLICY IF EXISTS "projects_tenant_read" ON real_estate_projects;
CREATE POLICY "projects_tenant_read" ON real_estate_projects
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Products: Users can read their tenant's products
DROP POLICY IF EXISTS "products_tenant_read" ON real_estate_products;
CREATE POLICY "products_tenant_read" ON real_estate_products
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Reservations: Users can CRUD their own reservations
DROP POLICY IF EXISTS "reservations_user_select" ON re_reservations;
CREATE POLICY "reservations_user_select" ON re_reservations
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "reservations_user_insert" ON re_reservations;
CREATE POLICY "reservations_user_insert" ON re_reservations
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "reservations_user_update" ON re_reservations;
CREATE POLICY "reservations_user_update" ON re_reservations
  FOR UPDATE USING (user_id = auth.uid());

-- Commission: Users can read their own commissions
DROP POLICY IF EXISTS "commission_user_read" ON re_commission_ledger;
CREATE POLICY "commission_user_read" ON re_commission_ledger
  FOR SELECT USING (user_id = auth.uid());

-- Documents: Users can read their tenant's documents
DROP POLICY IF EXISTS "documents_tenant_read" ON re_documents;
CREATE POLICY "documents_tenant_read" ON re_documents
  FOR SELECT USING (tenant_id IN (SELECT tenant_id FROM users WHERE id = auth.uid()));

-- Leads: Users can CRUD their own leads
DROP POLICY IF EXISTS "leads_user_select" ON re_partner_leads;
CREATE POLICY "leads_user_select" ON re_partner_leads
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "leads_user_insert" ON re_partner_leads;
CREATE POLICY "leads_user_insert" ON re_partner_leads
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "leads_user_update" ON re_partner_leads;
CREATE POLICY "leads_user_update" ON re_partner_leads
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "leads_user_delete" ON re_partner_leads;
CREATE POLICY "leads_user_delete" ON re_partner_leads
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================================
-- STEP 6: Create Triggers
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_projects_updated_at ON real_estate_projects;
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON real_estate_projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON real_estate_products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON real_estate_products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reservations_updated_at ON re_reservations;
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON re_reservations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_commission_updated_at ON re_commission_ledger;
CREATE TRIGGER update_commission_updated_at BEFORE UPDATE ON re_commission_ledger
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documents_updated_at ON re_documents;
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON re_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_leads_updated_at ON re_partner_leads;
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON re_partner_leads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Create RPC Function for Reservations
-- ============================================================================

-- Drop existing function if exists
DROP FUNCTION IF EXISTS reserve_product(UUID, UUID, UUID, UUID, INTEGER);

CREATE OR REPLACE FUNCTION reserve_product(
  p_tenant_id UUID,
  p_product_id UUID,
  p_user_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 1440
)
RETURNS JSONB AS $$
DECLARE
  v_reservation_id UUID;
  v_expires_at TIMESTAMPTZ;
  v_product_status re_product_status;
BEGIN
  -- Check product availability
  SELECT status INTO v_product_status
  FROM real_estate_products
  WHERE id = p_product_id AND tenant_id = p_tenant_id;
  
  IF v_product_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;
  
  IF v_product_status != 'available' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not available');
  END IF;
  
  -- Calculate expiration
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Create reservation
  INSERT INTO re_reservations (tenant_id, product_id, user_id, customer_id, expires_at)
  VALUES (p_tenant_id, p_product_id, p_user_id, p_customer_id, v_expires_at)
  RETURNING id INTO v_reservation_id;
  
  -- Update product status
  UPDATE real_estate_products
  SET status = 'booked', updated_at = NOW()
  WHERE id = p_product_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
