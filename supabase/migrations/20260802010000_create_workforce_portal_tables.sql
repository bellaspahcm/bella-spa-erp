-- ============================================================================
-- Bella EIP Workforce Portal — Foundation Tables
-- Migration: 20260802010000
-- Architectural Invariant 01: Fully Additive, Zero Impact on Production Tenants
--
-- Tables created:
--   re_sales_kpi_targets      — Monthly sales KPI targets (Lead, Booking, Contract)
--   re_project_checkins       — GPS check-in records at project sites
--   re_commission_ledger      — Commission tracking (temp, approved, paid)
--   re_tasks                  — Task center for workforce
--   re_documents              — Document library for sales materials
--
-- Design notes:
--   - These tables are Real Estate vertical specific, prefix with re_
--   - Commission ledger is separate from existing salary_records (spa/babycare)
--   - KPI targets for sales agents differ from KTV spa performance (kpi_records)
--   - All tables have full RLS and tenant isolation
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. re_sales_kpi_targets — Monthly KPI targets for sales workforce
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_sales_kpi_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Target ownership
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  
  -- Time period
  month_year DATE NOT NULL,  -- First day of month (e.g., '2026-08-01')
  
  -- KPI targets
  target_leads INTEGER NOT NULL DEFAULT 0 CHECK (target_leads >= 0),
  target_site_visits INTEGER NOT NULL DEFAULT 0 CHECK (target_site_visits >= 0),
  target_bookings INTEGER NOT NULL DEFAULT 0 CHECK (target_bookings >= 0),
  target_deposits INTEGER NOT NULL DEFAULT 0 CHECK (target_deposits >= 0),
  target_contracts INTEGER NOT NULL DEFAULT 0 CHECK (target_contracts >= 0),
  target_revenue NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (target_revenue >= 0),
  
  -- Actuals (denormalized for fast dashboard queries)
  actual_leads INTEGER NOT NULL DEFAULT 0 CHECK (actual_leads >= 0),
  actual_site_visits INTEGER NOT NULL DEFAULT 0 CHECK (actual_site_visits >= 0),
  actual_bookings INTEGER NOT NULL DEFAULT 0 CHECK (actual_bookings >= 0),
  actual_deposits INTEGER NOT NULL DEFAULT 0 CHECK (actual_deposits >= 0),
  actual_contracts INTEGER NOT NULL DEFAULT 0 CHECK (actual_contracts >= 0),
  actual_revenue NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (actual_revenue >= 0),
  
  -- Achievement rates (computed, stored for leaderboard)
  achievement_rate NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (achievement_rate >= 0),
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT uq_kpi_target_user_month UNIQUE (tenant_id, user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_re_kpi_targets_user   ON public.re_sales_kpi_targets (tenant_id, user_id, month_year DESC);
CREATE INDEX IF NOT EXISTS idx_re_kpi_targets_month  ON public.re_sales_kpi_targets (tenant_id, month_year DESC);
CREATE INDEX IF NOT EXISTS idx_re_kpi_targets_person ON public.re_sales_kpi_targets (person_id) WHERE person_id IS NOT NULL;

COMMENT ON TABLE public.re_sales_kpi_targets IS
  'Workforce Portal: Monthly KPI targets and actuals for real estate sales agents. '
  'Actuals are denormalized for fast dashboard rendering. Source of truth is still in transactional tables.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. re_project_checkins — GPS check-in at project sites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_project_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Who checked in
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  
  -- Where (project site)
  project_id UUID NOT NULL REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  
  -- Check-in details
  checkin_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checkout_time TIMESTAMPTZ,
  
  -- GPS coordinates
  checkin_lat NUMERIC(10,8),
  checkin_lng NUMERIC(11,8),
  checkout_lat NUMERIC(10,8),
  checkout_lng NUMERIC(11,8),
  
  -- Verification method
  verification_method TEXT CHECK (verification_method IN ('gps', 'qr_code', 'beacon', 'manual')),
  qr_code_scanned TEXT,  -- QR code value if used
  
  -- Purpose of visit
  visit_purpose TEXT CHECK (visit_purpose IN ('site_duty', 'customer_tour', 'meeting', 'training', 'other')),
  notes TEXT,
  
  -- Photo evidence
  photo_urls TEXT[],
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_checkins_user    ON public.re_project_checkins (tenant_id, user_id, checkin_time DESC);
CREATE INDEX IF NOT EXISTS idx_re_checkins_project ON public.re_project_checkins (tenant_id, project_id, checkin_time DESC);
CREATE INDEX IF NOT EXISTS idx_re_checkins_date    ON public.re_project_checkins (tenant_id, DATE(checkin_time));
CREATE INDEX IF NOT EXISTS idx_re_checkins_person  ON public.re_project_checkins (person_id) WHERE person_id IS NOT NULL;

COMMENT ON TABLE public.re_project_checkins IS
  'Workforce Portal: GPS/QR check-in records for sales agents at project sites. '
  'Tracks site duty attendance, customer tours, and field activities with location verification.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. re_commission_ledger — Commission tracking for sales agents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_commission_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Commission recipient
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  
  -- Source transaction
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('booking', 'deposit', 'contract', 'payment_milestone', 'adjustment')),
  transaction_id UUID,  -- FK to booking/deposit/contract (flexible)
  product_id UUID REFERENCES public.real_estate_products(id) ON DELETE SET NULL,
  
  -- Commission calculation
  commission_type TEXT NOT NULL CHECK (commission_type IN ('percentage', 'fixed', 'tiered')),
  base_amount NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (base_amount >= 0),  -- Transaction value
  commission_rate NUMERIC(5,2) CHECK (commission_rate >= 0 AND commission_rate <= 100),
  commission_amount NUMERIC(15,2) NOT NULL CHECK (commission_amount >= 0),
  
  -- Commission status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'cancelled')),
  
  -- Approval workflow
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,  -- Bank transfer ref or journal entry ID
  
  -- Time tracking
  earned_date DATE NOT NULL,  -- When commission was earned (transaction date)
  expected_payout_date DATE,  -- When agent expects to receive it
  
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_commission_user   ON public.re_commission_ledger (tenant_id, user_id, status, earned_date DESC);
CREATE INDEX IF NOT EXISTS idx_re_commission_status ON public.re_commission_ledger (tenant_id, status, earned_date DESC);
CREATE INDEX IF NOT EXISTS idx_re_commission_person ON public.re_commission_ledger (person_id) WHERE person_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_commission_tx     ON public.re_commission_ledger (transaction_type, transaction_id);

COMMENT ON TABLE public.re_commission_ledger IS
  'Workforce Portal: Commission tracking for real estate sales agents. '
  'Lifecycle: pending (temp calculation) → approved (manager review) → paid (finance disbursed). '
  'Separate from spa commission system to avoid cross-module complexity.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. re_tasks — Task center for workforce
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Task assignment
  assigned_to_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to_person_id UUID REFERENCES public.people_directory(id) ON DELETE SET NULL,
  created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Task details
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT NOT NULL CHECK (task_type IN ('lead_followup', 'site_visit', 'deposit_reminder', 'contract_preparation', 'manual', 'system_generated')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  
  -- Due date and completion
  due_date DATE,
  due_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  completed_at TIMESTAMPTZ,
  
  -- Related entities
  related_lead_id UUID,
  related_customer_id UUID,
  related_product_id UUID REFERENCES public.real_estate_products(id) ON DELETE SET NULL,
  
  -- Reminder settings
  reminder_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  reminder_time TIMESTAMPTZ,
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_tasks_assigned ON public.re_tasks (tenant_id, assigned_to_user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_re_tasks_due     ON public.re_tasks (tenant_id, due_date, status) WHERE status != 'completed';
CREATE INDEX IF NOT EXISTS idx_re_tasks_person  ON public.re_tasks (assigned_to_person_id) WHERE assigned_to_person_id IS NOT NULL;

COMMENT ON TABLE public.re_tasks IS
  'Workforce Portal: Task center for sales agents. '
  'Includes manual tasks and system-generated tasks (e.g., "Follow up lead in 15 minutes"). '
  'Supports reminders and mobile notifications.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. re_documents — Document library for sales materials
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.re_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Document details
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL CHECK (document_type IN ('brochure', 'price_list', 'legal_docs', 'bank_policy', 'faq', 'training', 'contract_template', 'other')),
  
  -- File storage
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size_bytes BIGINT CHECK (file_size_bytes > 0),
  mime_type TEXT,
  
  -- Access control
  is_public BOOLEAN NOT NULL DEFAULT FALSE,  -- Public to all agents or restricted
  allowed_roles TEXT[],  -- e.g., ['sale', 'team_lead', 'admin']
  
  -- Project association
  project_id UUID REFERENCES public.real_estate_projects(id) ON DELETE CASCADE,
  
  -- Versioning
  version TEXT NOT NULL DEFAULT '1.0',
  is_latest BOOLEAN NOT NULL DEFAULT TRUE,
  supersedes_id UUID REFERENCES public.re_documents(id) ON DELETE SET NULL,
  
  -- Audit
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_re_docs_tenant   ON public.re_documents (tenant_id, document_type, is_latest);
CREATE INDEX IF NOT EXISTS idx_re_docs_project  ON public.re_documents (project_id) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_re_docs_public   ON public.re_documents (tenant_id, is_public, is_latest);

COMMENT ON TABLE public.re_documents IS
  'Workforce Portal: Document library for sales materials. '
  'Stores brochures, price lists, legal docs, bank policies, FAQs, and training materials. '
  'Supports versioning and role-based access control.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. updated_at triggers
-- ─────────────────────────────────────────────────────────────────────────────

-- Reuse existing update_updated_at_column function

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
-- 7. RLS — Row Level Security (Tenant Isolation)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.re_sales_kpi_targets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_project_checkins   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_commission_ledger  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.re_documents          ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant-scoped access only
-- CRITICAL: These policies ensure beauty_spa and babycare tenants NEVER see real estate data

DO $$ BEGIN

  -- re_sales_kpi_targets: Users can read own KPI, admins can read all in tenant
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_sales_kpi_targets' AND policyname = 're_kpi_own_read') THEN
    CREATE POLICY re_kpi_own_read ON public.re_sales_kpi_targets
      FOR SELECT TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (tenant_id = public.get_auth_tenant_id() AND user_id = auth.uid())
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'Admin', 'team_lead', 'branch_manager'))
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_sales_kpi_targets' AND policyname = 're_kpi_admin_write') THEN
    CREATE POLICY re_kpi_admin_write ON public.re_sales_kpi_targets
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'Admin', 'team_lead', 'branch_manager'))
        )
      );
  END IF;

  -- re_project_checkins: Users can read own check-ins, managers can read all
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_project_checkins' AND policyname = 're_checkin_own_read') THEN
    CREATE POLICY re_checkin_own_read ON public.re_project_checkins
      FOR SELECT TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (tenant_id = public.get_auth_tenant_id() AND user_id = auth.uid())
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'Admin', 'team_lead', 'branch_manager'))
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_project_checkins' AND policyname = 're_checkin_own_write') THEN
    CREATE POLICY re_checkin_own_write ON public.re_project_checkins
      FOR INSERT TO authenticated
      WITH CHECK (
        tenant_id = public.get_auth_tenant_id()
        AND user_id = auth.uid()
      );
  END IF;

  -- re_commission_ledger: Users can read own commission, admins can manage all
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_commission_ledger' AND policyname = 're_commission_own_read') THEN
    CREATE POLICY re_commission_own_read ON public.re_commission_ledger
      FOR SELECT TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (tenant_id = public.get_auth_tenant_id() AND user_id = auth.uid())
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'Admin', 'team_lead', 'branch_manager'))
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_commission_ledger' AND policyname = 're_commission_admin_write') THEN
    CREATE POLICY re_commission_admin_write ON public.re_commission_ledger
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'Admin', 'team_lead', 'branch_manager'))
        )
      );
  END IF;

  -- re_tasks: Users can read/write own tasks, managers can assign/view all
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_tasks' AND policyname = 're_tasks_own_access') THEN
    CREATE POLICY re_tasks_own_access ON public.re_tasks
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (tenant_id = public.get_auth_tenant_id() AND assigned_to_user_id = auth.uid())
        OR (tenant_id = public.get_auth_tenant_id() AND created_by_user_id = auth.uid())
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'Admin', 'team_lead', 'branch_manager'))
        )
      );
  END IF;

  -- re_documents: Public docs readable by all, restricted by role
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_documents' AND policyname = 're_docs_read') THEN
    CREATE POLICY re_docs_read ON public.re_documents
      FOR SELECT TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND (
            is_public = TRUE
            OR EXISTS (
              SELECT 1 FROM public.users u
              WHERE u.id = auth.uid()
                AND (allowed_roles IS NULL OR u.role = ANY(allowed_roles))
            )
          )
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 're_documents' AND policyname = 're_docs_admin_write') THEN
    CREATE POLICY re_docs_admin_write ON public.re_documents
      FOR ALL TO authenticated
      USING (
        public.is_hq_super_admin()
        OR (
          tenant_id = public.get_auth_tenant_id()
          AND EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('admin', 'Admin', 'branch_manager'))
        )
      );
  END IF;

END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Grants — Explicit permissions
-- ─────────────────────────────────────────────────────────────────────────────

-- Revoke anon access (workforce portal requires authentication)
REVOKE ALL ON TABLE public.re_sales_kpi_targets  FROM anon;
REVOKE ALL ON TABLE public.re_project_checkins   FROM anon;
REVOKE ALL ON TABLE public.re_commission_ledger  FROM anon;
REVOKE ALL ON TABLE public.re_tasks              FROM anon;
REVOKE ALL ON TABLE public.re_documents          FROM anon;

-- Grant authenticated and service_role full access (RLS handles filtering)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_sales_kpi_targets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_project_checkins  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_commission_ledger TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_tasks             TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.re_documents         TO authenticated, service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. ARCHITECTURAL INVARIANT 01 VERIFICATION
-- ─────────────────────────────────────────────────────────────────────────────

-- This migration is FULLY ADDITIVE:
-- ✅ Creates NEW tables only (re_sales_kpi_targets, re_project_checkins, re_commission_ledger, re_tasks, re_documents)
-- ✅ Does NOT alter any existing tables (beauty_spa, babycare, users, attendance, kpi_records)
-- ✅ Does NOT modify any existing RLS policies for production tenants
-- ✅ Does NOT add triggers or constraints to existing tables
-- ✅ All new tables use tenant_id isolation with strict RLS
-- ✅ beauty_spa and babycare tenants will NEVER see these tables (tenant_id filter)

-- Zero Regression Guarantee:
-- - Production tenants (beauty_spa, babycare) continue operating unchanged
-- - New tables only activate when real_estate tenant is created and users explicitly access /workforce route
-- - No menu items, no routes, no providers are added to existing tenants
-- - Capability-gated: Workforce Portal only renders if manifest.enabledCapabilities includes 'workforce_portal'

COMMENT ON TABLE public.re_sales_kpi_targets IS
  'Workforce Portal Table — Real Estate vertical only. '
  'Architectural Invariant 01: Zero impact on beauty_spa/babycare tenants. '
  'Capability-gated: Only visible when workforce_portal capability is enabled.';

COMMENT ON TABLE public.re_project_checkins IS
  'Workforce Portal Table — Real Estate vertical only. '
  'Architectural Invariant 01: Zero impact on beauty_spa/babycare tenants.';

COMMENT ON TABLE public.re_commission_ledger IS
  'Workforce Portal Table — Real Estate vertical only. '
  'Separate from spa commission_records table to avoid cross-module complexity. '
  'Architectural Invariant 01: Zero impact on beauty_spa/babycare tenants.';

COMMENT ON TABLE public.re_tasks IS
  'Workforce Portal Table — Real Estate vertical only. '
  'Architectural Invariant 01: Zero impact on beauty_spa/babycare tenants.';

COMMENT ON TABLE public.re_documents IS
  'Workforce Portal Table — Real Estate vertical only. '
  'Architectural Invariant 01: Zero impact on beauty_spa/babycare tenants.';

