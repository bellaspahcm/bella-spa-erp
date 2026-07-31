-- ============================================
-- Migration: Create real_estate projects and products tables
-- Date: 2026-07-31 01:00:00
-- Epic: Real Estate Vertical - Schema, RLS, Grants, Seeds
-- ============================================

-- Create real_estate_projects
CREATE TABLE IF NOT EXISTS public.real_estate_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create real_estate_products
CREATE TABLE IF NOT EXISTS public.real_estate_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'apartment' CHECK (product_type IN ('apartment', 'townhouse', 'shophouse', 'villa')),
  floor TEXT,
  block TEXT,
  area NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (area >= 0),
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'deposited', 'contracted', 'paid', 'handed_over', 'cancelled')),
  owner_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT real_estate_products_tenant_project_code_unique UNIQUE (tenant_id, project_id, product_code)
);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_real_estate_projects_updated_at ON public.real_estate_projects;
CREATE TRIGGER update_real_estate_projects_updated_at
  BEFORE UPDATE ON public.real_estate_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_real_estate_products_updated_at ON public.real_estate_products;
CREATE TRIGGER update_real_estate_products_updated_at
  BEFORE UPDATE ON public.real_estate_products
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_real_estate_projects_tenant ON public.real_estate_projects (tenant_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_products_project ON public.real_estate_products (project_id);
CREATE INDEX IF NOT EXISTS idx_real_estate_products_tenant_status ON public.real_estate_products (tenant_id, status);

-- Enable RLS
ALTER TABLE public.real_estate_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.real_estate_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Projects
DROP POLICY IF EXISTS "Projects tenant read" ON public.real_estate_projects;
CREATE POLICY "Projects tenant read"
  ON public.real_estate_projects
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "Projects tenant write" ON public.real_estate_projects;
CREATE POLICY "Projects tenant write"
  ON public.real_estate_projects
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

-- RLS Policies - Products
DROP POLICY IF EXISTS "Products tenant read" ON public.real_estate_products;
CREATE POLICY "Products tenant read"
  ON public.real_estate_products
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR tenant_id = public.get_auth_tenant_id()
  );

DROP POLICY IF EXISTS "Products tenant write" ON public.real_estate_products;
CREATE POLICY "Products tenant write"
  ON public.real_estate_products
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff')
      )
    )
  );

-- Grants
REVOKE ALL ON TABLE public.real_estate_projects FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.real_estate_projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.real_estate_projects TO service_role;

REVOKE ALL ON TABLE public.real_estate_products FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.real_estate_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.real_estate_products TO service_role;
