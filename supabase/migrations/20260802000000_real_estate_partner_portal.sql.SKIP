-- =====================================================
-- Real Estate Partner Portal - Database Schema
-- Module: Partner Portal (BPP - Business Partner Portal)
-- Created: 2026-08-02
-- Purpose: Support partner/broker management for real estate sales
-- =====================================================

-- =====================================================
-- ENUM TYPES
-- =====================================================

-- Product types for real estate units
CREATE TYPE public.re_product_type AS ENUM (
  'apartment',
  'townhouse',
  'shophouse',
  'villa',
  'land_plot',
  'office'
);

-- Product status lifecycle
CREATE TYPE public.re_product_status AS ENUM (
  'available',
  'booked',
  'deposited',
  'contracted',
  'paid',
  'handed_over',
  'cancelled'
);

-- Reservation status
CREATE TYPE public.re_reservation_status AS ENUM (
  'active',
  'released',
  'expired',
  'converted'
);

-- Commission status
CREATE TYPE public.re_commission_status AS ENUM (
  'pending',
  'approved',
  'paid',
  'cancelled'
);

-- Document types
CREATE TYPE public.re_document_type AS ENUM (
  'brochure',
  'price_list',
  'legal_docs',
  'bank_policy',
  'faq',
  'training',
  'contract_template',
  'other'
);

-- Commission transaction types
CREATE TYPE public.re_transaction_type AS ENUM (
  'booking',
  'deposit',
  'contract',
  'payment_milestone',
  'adjustment'
);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Projects (Dự án BĐS)
CREATE TABLE IF NOT EXISTS public.real_estate_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Project info
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  location TEXT,
  developer TEXT,
  total_units INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  
  CONSTRAINT re_projects_tenant_code_unique UNIQUE (tenant_id, code)
);

CREATE INDEX idx_re_projects_tenant ON public.real_estate_projects(tenant_id);
CREATE INDEX idx_re_projects_code ON public.real_estate_projects(code);

-- Products (Căn hộ/Unit inventory)
CREATE TABLE IF NOT EXISTS public.real_estate_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  
  -- Product identification
  product_code TEXT NOT NULL,
  product_type public.re_product_type NOT NULL DEFAULT 'apartment',
  
  -- Location within project
  block TEXT,
  floor TEXT,
  
  -- Specifications
  area NUMERIC(10,2) NOT NULL,
  unit_price NUMERIC(15,2) NOT NULL,
  
  -- Status
  status public.re_product_status NOT NULL DEFAULT 'available',
  
  -- Owner info (after sale)
  owner_name TEXT,
  owner_contact TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  
  CONSTRAINT re_products_tenant_code_unique UNIQUE (tenant_id, product_code)
);

CREATE INDEX idx_re_products_tenant ON public.real_estate_products(tenant_id);
CREATE INDEX idx_re_products_project ON public.real_estate_products(project_id);
CREATE INDEX idx_re_products_code ON public.real_estate_products(product_code);
CREATE INDEX idx_re_products_status ON public.real_estate_products(status);
CREATE INDEX idx_re_products_type ON public.real_estate_products(product_type);

-- Reservations (Giữ chỗ tạm thời)
CREATE TABLE IF NOT EXISTS public.re_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.real_estate_products(id) ON DELETE CASCADE,
  
  -- Partner/Broker info
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Customer info (optional - may not have customer record yet)
  customer_id UUID REFERENCES public.customers(id),
  
  -- Reservation details
  status public.re_reservation_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Additional data (customer name, phone, deposit proof URLs, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_re_reservations_tenant ON public.re_reservations(tenant_id);
CREATE INDEX idx_re_reservations_product ON public.re_reservations(product_id);
CREATE INDEX idx_re_reservations_user ON public.re_reservations(user_id);
CREATE INDEX idx_re_reservations_status ON public.re_reservations(status);
CREATE INDEX idx_re_reservations_expires ON public.re_reservations(expires_at);

-- Commission Ledger (Sổ hoa hồng đối tác)
CREATE TABLE IF NOT EXISTS public.re_commission_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Partner/Broker
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Transaction references
  product_id UUID REFERENCES public.real_estate_products(id),
  reservation_id UUID REFERENCES public.re_reservations(id),
  
  -- Transaction type & amounts
  transaction_type public.re_transaction_type NOT NULL,
  base_amount NUMERIC(15,2) NOT NULL, -- Giá trị giao dịch gốc
  commission_rate NUMERIC(5,2), -- % commission
  commission_amount NUMERIC(15,2) NOT NULL, -- Số tiền hoa hồng
  
  -- Status & dates
  status public.re_commission_status NOT NULL DEFAULT 'pending',
  earned_date DATE NOT NULL,
  approved_date DATE,
  paid_date DATE,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_re_commission_tenant ON public.re_commission_ledger(tenant_id);
CREATE INDEX idx_re_commission_user ON public.re_commission_ledger(user_id);
CREATE INDEX idx_re_commission_product ON public.re_commission_ledger(product_id);
CREATE INDEX idx_re_commission_status ON public.re_commission_ledger(status);
CREATE INDEX idx_re_commission_earned ON public.re_commission_ledger(earned_date);

-- Documents (Tài liệu Sales Kit)
CREATE TABLE IF NOT EXISTS public.re_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  
  -- Document info
  title TEXT NOT NULL,
  description TEXT,
  document_type public.re_document_type NOT NULL,
  
  -- File storage
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT,
  
  -- Versioning
  version TEXT DEFAULT '1.0',
  is_latest BOOLEAN DEFAULT true,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id)
);

CREATE INDEX idx_re_documents_tenant ON public.re_documents(tenant_id);
CREATE INDEX idx_re_documents_project ON public.re_documents(project_id);
CREATE INDEX idx_re_documents_type ON public.re_documents(document_type);
CREATE INDEX idx_re_documents_latest ON public.re_documents(is_latest) WHERE is_latest = true;

-- Partner Leads (Khách hàng tự khai báo)
CREATE TABLE IF NOT EXISTS public.re_partner_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Partner/Broker who registered this lead
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Lead info
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  budget TEXT,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'registered', -- registered, interested, booking, deposited, contracted, lost
  
  -- Protection period (30 days default)
  protected_until TIMESTAMPTZ NOT NULL,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id),
  updated_by UUID REFERENCES public.users(id),
  
  -- Prevent duplicate phone across partners
  CONSTRAINT re_leads_tenant_phone_unique UNIQUE (tenant_id, phone)
);

CREATE INDEX idx_re_leads_tenant ON public.re_partner_leads(tenant_id);
CREATE INDEX idx_re_leads_user ON public.re_partner_leads(user_id);
CREATE INDEX idx_re_leads_phone ON public.re_partner_leads(phone);
CREATE INDEX idx_re_leads_status ON public.re_partner_leads(status);
CREATE INDEX idx_re_leads_protected ON public.re_partner_leads(protected_until);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.real_estate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_partner_leads ENABLE ROW LEVEL SECURITY;

-- Projects: Admin & partners can read
CREATE POLICY "Projects: View for authenticated users"
  ON public.real_estate_projects FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Projects: Manage for admins"
  ON public.real_estate_projects FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Products: Admin & partners can read
CREATE POLICY "Products: View for authenticated users"
  ON public.real_estate_products FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Products: Manage for admins"
  ON public.real_estate_products FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Reservations: Users see only their own
CREATE POLICY "Reservations: View own"
  ON public.re_reservations FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Reservations: Create own"
  ON public.re_reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Reservations: Update own"
  ON public.re_reservations FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Commission: Users see only their own
CREATE POLICY "Commission: View own"
  ON public.re_commission_ledger FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Commission: Manage for admins"
  ON public.re_commission_ledger FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Documents: All authenticated users can read
CREATE POLICY "Documents: View for authenticated users"
  ON public.re_documents FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Documents: Manage for admins"
  ON public.re_documents FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- Leads: Users see only their own
CREATE POLICY "Leads: View own"
  ON public.re_partner_leads FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

CREATE POLICY "Leads: Create own"
  ON public.re_partner_leads FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND tenant_id IN (
      SELECT tenant_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Leads: Update own"
  ON public.re_partner_leads FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR tenant_id IN (
      SELECT tenant_id FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'manager')
    )
  );

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_re_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_re_projects_updated_at
  BEFORE UPDATE ON public.real_estate_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_re_updated_at();

CREATE TRIGGER update_re_products_updated_at
  BEFORE UPDATE ON public.real_estate_products
  FOR EACH ROW EXECUTE FUNCTION public.update_re_updated_at();

CREATE TRIGGER update_re_reservations_updated_at
  BEFORE UPDATE ON public.re_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_re_updated_at();

CREATE TRIGGER update_re_commission_updated_at
  BEFORE UPDATE ON public.re_commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_re_updated_at();

CREATE TRIGGER update_re_documents_updated_at
  BEFORE UPDATE ON public.re_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_re_updated_at();

CREATE TRIGGER update_re_leads_updated_at
  BEFORE UPDATE ON public.re_partner_leads
  FOR EACH ROW EXECUTE FUNCTION public.update_re_updated_at();

-- =====================================================
-- RESERVATION ENGINE RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.reserve_product(
  p_tenant_id UUID,
  p_product_id UUID,
  p_user_id UUID,
  p_customer_id UUID DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 1440
)
RETURNS JSON AS $$
DECLARE
  v_product_status public.re_product_status;
  v_reservation_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Check product availability
  SELECT status INTO v_product_status
  FROM public.real_estate_products
  WHERE id = p_product_id AND tenant_id = p_tenant_id;
  
  IF v_product_status IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Product not found'
    );
  END IF;
  
  IF v_product_status <> 'available' THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Product is not available for reservation'
    );
  END IF;
  
  -- Calculate expiry
  v_expires_at := now() + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Create reservation
  INSERT INTO public.re_reservations (
    tenant_id,
    product_id,
    user_id,
    customer_id,
    status,
    expires_at,
    created_by
  ) VALUES (
    p_tenant_id,
    p_product_id,
    p_user_id,
    p_customer_id,
    'active',
    v_expires_at,
    p_user_id
  ) RETURNING id INTO v_reservation_id;
  
  -- Update product status
  UPDATE public.real_estate_products
  SET status = 'booked', updated_at = now()
  WHERE id = p_product_id AND tenant_id = p_tenant_id;
  
  RETURN json_build_object(
    'success', true,
    'reservation_id', v_reservation_id,
    'expires_at', v_expires_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.reserve_product TO authenticated;

-- =====================================================
-- SEED DATA (for development/testing)
-- =====================================================

-- Note: Seed data should be added via separate migration or manual insert
-- This migration only creates schema structure

COMMENT ON TABLE public.real_estate_projects IS 'Real Estate projects managed by the system';
COMMENT ON TABLE public.real_estate_products IS 'Individual units/products within projects (apartments, villas, etc.)';
COMMENT ON TABLE public.re_reservations IS 'Temporary hold/booking reservations created by partners';
COMMENT ON TABLE public.re_commission_ledger IS 'Commission tracking for partner sales';
COMMENT ON TABLE public.re_documents IS 'Sales kit documents available to partners';
COMMENT ON TABLE public.re_partner_leads IS 'Customer leads registered by partners with 30-day protection';
