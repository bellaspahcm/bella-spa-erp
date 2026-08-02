-- =====================================================
-- Partner Portal - Missing Components Only
-- Created: 2026-08-02
-- Purpose: Create ONLY missing tables, RLS, triggers, functions
-- Context: ENUMs and base tables already exist
-- =====================================================

-- =====================================================
-- MISSING TABLES
-- =====================================================

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

CREATE INDEX IF NOT EXISTS idx_re_reservations_tenant ON public.re_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_product ON public.re_reservations(product_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_user ON public.re_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_re_reservations_status ON public.re_reservations(status);
CREATE INDEX IF NOT EXISTS idx_re_reservations_expires ON public.re_reservations(expires_at);

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

CREATE INDEX IF NOT EXISTS idx_re_leads_tenant ON public.re_partner_leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_user ON public.re_partner_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_re_leads_phone ON public.re_partner_leads(phone);
CREATE INDEX IF NOT EXISTS idx_re_leads_status ON public.re_partner_leads(status);
CREATE INDEX IF NOT EXISTS idx_re_leads_protected ON public.re_partner_leads(protected_until);

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

-- Drop existing policies if any (to avoid conflicts)
DROP POLICY IF EXISTS "Projects: View for authenticated users" ON public.real_estate_projects;
DROP POLICY IF EXISTS "Projects: Manage for admins" ON public.real_estate_projects;
DROP POLICY IF EXISTS "Products: View for authenticated users" ON public.real_estate_products;
DROP POLICY IF EXISTS "Products: Manage for admins" ON public.real_estate_products;
DROP POLICY IF EXISTS "Reservations: View own" ON public.re_reservations;
DROP POLICY IF EXISTS "Reservations: Create own" ON public.re_reservations;
DROP POLICY IF EXISTS "Reservations: Update own" ON public.re_reservations;
DROP POLICY IF EXISTS "Commission: View own" ON public.re_commission_ledger;
DROP POLICY IF EXISTS "Commission: Manage for admins" ON public.re_commission_ledger;
DROP POLICY IF EXISTS "Documents: View for authenticated users" ON public.re_documents;
DROP POLICY IF EXISTS "Documents: Manage for admins" ON public.re_documents;
DROP POLICY IF EXISTS "Leads: View own" ON public.re_partner_leads;
DROP POLICY IF EXISTS "Leads: Create own" ON public.re_partner_leads;
DROP POLICY IF EXISTS "Leads: Update own" ON public.re_partner_leads;

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

-- Drop existing triggers if any
DROP TRIGGER IF EXISTS update_re_projects_updated_at ON public.real_estate_projects;
DROP TRIGGER IF EXISTS update_re_products_updated_at ON public.real_estate_products;
DROP TRIGGER IF EXISTS update_re_reservations_updated_at ON public.re_reservations;
DROP TRIGGER IF EXISTS update_re_commission_updated_at ON public.re_commission_ledger;
DROP TRIGGER IF EXISTS update_re_documents_updated_at ON public.re_documents;
DROP TRIGGER IF EXISTS update_re_leads_updated_at ON public.re_partner_leads;

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

-- Success message
SELECT 'Partner Portal migration completed successfully' AS status;

-- Table comments
COMMENT ON TABLE public.re_reservations IS 'Temporary hold/booking reservations created by partners';
COMMENT ON TABLE public.re_partner_leads IS 'Customer leads registered by partners with 30-day protection';
