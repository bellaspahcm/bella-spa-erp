-- ============================================================================
-- Bella EIP Workforce Portal — Foundation Tables (SIMPLIFIED VERSION)
-- Migration: 20260802010001
-- FIXES: Removed complex RLS policies causing IMMUTABLE errors
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. re_sales_kpi_targets — Monthly KPI targets for sales workforce
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_sales_kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  month_year DATE NOT NULL,
  target_leads INTEGER NOT NULL DEFAULT 0 CHECK (target_leads >= 0),
  target_site_visits INTEGER NOT NULL DEFAULT 0 CHECK (target_site_visits >= 0),
  target_bookings INTEGER NOT NULL DEFAULT 0 CHECK (target_bookings >= 0),
  target_deposits INTEGER NOT NULL DEFAULT 0 CHECK (target_deposits >= 0),
  target_contracts INTEGER NOT NULL DEFAULT 0 CHECK (target_contracts >= 0),
  target_revenue NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (target_revenue >= 0),
  actual_leads INTEGER NOT NULL DEFAULT 0 CHECK (actual_leads >= 0),
  actual_site_visits INTEGER NOT NULL DEFAULT 0 CHECK (actual_site_visits >= 0),
  actual_bookings INTEGER NOT NULL DEFAULT 0 CHECK (actual_bookings >= 0),
  actual_deposits INTEGER NOT NULL DEFAULT 0 CHECK (actual_deposits >= 0),
  actual_contracts INTEGER NOT NULL DEFAULT 0 CHECK (actual_contracts >= 0),
  actual_revenue NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (actual_revenue >= 0),
  achievement_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (achievement_rate >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_kpi_target_user_month UNIQUE (tenant_id, user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_re_kpi_targets_user ON public.re_sales_kpi_targets (tenant_id, user_id, month_year DESC);
CREATE INDEX IF NOT EXISTS idx_re_kpi_targets_month ON public.re_sales_kpi_targets (tenant_id, month_year DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. re_project_checkins — GPS check-in at project sites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_project_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  project_id UUID NOT NULL REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  checkin_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkout_time TIMESTAMPTZ,
  checkin_lat NUMERIC(10,8),
  checkin_lng NUMERIC(11,8),
  checkout_lat NUMERIC(10,8),
  checkout_lng NUMERIC(11,8),
  verification_method TEXT CHECK (verification_method IN ('gps', 'qr_code', 'beacon', 'manual')),
  qr_code_scanned TEXT,
  visit_purpose TEXT CHECK (visit_purpose IN ('site_duty', 'customer_tour', 'meeting', 'training', 'other')),
  notes TEXT,
  photo_urls TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_checkins_user ON public.re_project_checkins (tenant_id, user_id, checkin_time DESC);
CREATE INDEX IF NOT EXISTS idx_re_checkins_project ON public.re_project_checkins (tenant_id, project_id, checkin_time DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. re_commission_ledger — Commission tracking for sales agents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('booking', 'deposit', 'contract', 'payment_milestone', 'adjustment')),
  transaction_id UUID,
  product_id UUID REFERENCES public.real_estate_products(id) ON DELETE SET NULL,
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed', 'tiered')),
  base_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),
  commission_rate NUMERIC(5,2) CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount NUMERIC(15,2) NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  earned_date DATE NOT NULL,
  expected_payout_date DATE,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_commission_user ON public.re_commission_ledger (tenant_id, user_id, status, earned_date DESC);
CREATE INDEX IF NOT EXISTS idx_re_commission_status ON public.re_commission_ledger (tenant_id, status, earned_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. re_tasks — Task center for workforce
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  assigned_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('lead_followup', 'site_visit', 'deposit_reminder', 'contract_preparation', 'manual', 'system_generated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date DATE,
  due_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  related_lead_id UUID,
  related_customer_id UUID,
  related_product_id UUID REFERENCES public.real_estate_products(id) ON DELETE SET NULL,
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_time TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_tasks_assigned ON public.re_tasks (tenant_id, assigned_to_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_re_tasks_due ON public.re_tasks (tenant_id, due_date, status) WHERE status != 'completed';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. re_documents — Document library for sales materials
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN ('brochure', 'price_list', 'legal_docs', 'bank_policy', 'faq', 'training', 'contract_template', 'other')),
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT CHECK (file_size_bytes > 0),
  mime_type TEXT,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  allowed_roles TEXT[],
  project_id UUID REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  version TEXT NOT NULL DEFAULT '1.0',
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_id UUID REFERENCES public.re_documents(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_docs_tenant ON public.re_documents (tenant_id, document_type, is_latest);
CREATE INDEX IF NOT EXISTS idx_re_docs_project ON public.re_documents (project_id) WHERE project_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_re_kpi_targets_updated_at ON public.re_sales_kpi_targets;
CREATE TRIGGER trg_re_kpi_targets_updated_at
  BEFORE UPDATE ON public.re_sales_kpi_targets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_re_commission_updated_at ON public.re_commission_ledger;
CREATE TRIGGER trg_re_commission_updated_at
  BEFORE UPDATE ON public.re_commission_ledger
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_re_tasks_updated_at ON public.re_tasks;
CREATE TRIGGER trg_re_tasks_updated_at
  BEFORE UPDATE ON public.re_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_re_documents_updated_at ON public.re_documents;
CREATE TRIGGER trg_re_documents_updated_at
  BEFORE UPDATE ON public.re_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. RLS — SIMPLIFIED (tenant-scoped only, no role checks)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.re_sales_kpi_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_project_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_commission_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_documents ENABLE ROW LEVEL SECURITY;

-- Simple tenant-scoped policies (no complex role checks)
CREATE POLICY re_kpi_tenant_policy ON public.re_sales_kpi_targets
  FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY re_checkins_tenant_policy ON public.re_project_checkins
  FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY re_commission_tenant_policy ON public.re_commission_ledger
  FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY re_tasks_tenant_policy ON public.re_tasks
  FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY re_documents_tenant_policy ON public.re_documents
  FOR ALL TO authenticated
  USING (tenant_id = public.get_auth_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Grants
-- ─────────────────────────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_sales_kpi_targets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_project_checkins TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_commission_ledger TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_tasks TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_documents TO authenticated, service_role;
