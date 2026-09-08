-- =====================================================================================
-- Migration: Add Bella Spa Table Constraints and Triggers
-- =====================================================================================
-- Purpose: Apply FK constraints, audit triggers, and RLS policies to Bella Spa tables.
--          This is Part 2 of 2-part migration split.
--
-- Historical Context:
--   Base tables created in 20260509 (Part 1) with zero dependencies.
--   This migration adds integrity constraints and audit infrastructure after
--   required platform functions are available:
--   - update_updated_at_column() created in 20260511
--   - log_audit_event() created in 20260516
--
-- Split Rationale:
--   Original migration (20260510) created forward references to objects not yet existing.
--   Split resolves dependency cycle:
--   - 20260509: Base tables (no dependencies)
--   - 20260511: Core schema + update_updated_at_column()
--   - 20260516: Audit infrastructure + log_audit_event()
--   - 20260517: Constraints + triggers (THIS MIGRATION)
--
-- Operations:
--   1. Add FK constraints (tenants, users, session_logs, self-references)
--   2. Add CHECK constraints (module_key, service_kind, duration)
--   3. Create audit triggers (log_audit_event)
--   4. Create update triggers (update_updated_at_column)
--   5. Enable RLS + create policies
--
-- Dependencies:
--   REQUIRES: tenants, users, session_logs (20260511)
--   REQUIRES: update_updated_at_column() (20260511)
--   REQUIRES: log_audit_event() (20260516)
--   REQUIRES: packages, inventory_items, inventory_logs base structures (20260509)
--
-- Date: 2026-09-05
-- Type: Schema restoration - Part 2 (Constraints + Triggers)
-- Related: 20260509000000_create_spa_base_tables.sql (Part 1)
-- =====================================================================================

-- =====================================================================================
-- PART 1: FOREIGN KEY CONSTRAINTS
-- =====================================================================================

-- packages: FK to tenants
ALTER TABLE public.packages
  ADD CONSTRAINT packages_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
  ON DELETE CASCADE;

-- packages: FK to self (template inheritance)
ALTER TABLE public.packages
  ADD CONSTRAINT packages_template_id_fkey
  FOREIGN KEY (template_id) REFERENCES public.packages(id)
  ON DELETE SET NULL;

-- inventory_items: FK to tenants
ALTER TABLE public.inventory_items
  ADD CONSTRAINT inventory_items_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
  ON DELETE CASCADE;

-- inventory_logs: FK to tenants
ALTER TABLE public.inventory_logs
  ADD CONSTRAINT inventory_logs_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
  ON DELETE CASCADE;

-- inventory_logs: FK to inventory_items
ALTER TABLE public.inventory_logs
  ADD CONSTRAINT inventory_logs_item_id_fkey
  FOREIGN KEY (item_id) REFERENCES public.inventory_items(id)
  ON DELETE RESTRICT;

-- inventory_logs: FK to session_logs (optional link for consumption tracking)
ALTER TABLE public.inventory_logs
  ADD CONSTRAINT inventory_logs_session_log_id_fkey
  FOREIGN KEY (session_log_id) REFERENCES public.session_logs(id)
  ON DELETE SET NULL;

-- inventory_logs: FK to users (who created the log entry)
ALTER TABLE public.inventory_logs
  ADD CONSTRAINT inventory_logs_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES public.users(id)
  ON DELETE SET NULL;

-- =====================================================================================
-- PART 2: CHECK CONSTRAINTS
-- =====================================================================================

-- packages: module_key validation
ALTER TABLE public.packages
  ADD CONSTRAINT packages_module_key_check
  CHECK (module_key IN ('babycare', 'beauty_spa', 'industrial_cleaning', 'student_training'));

-- packages: service_kind validation
ALTER TABLE public.packages
  ADD CONSTRAINT packages_service_kind_check
  CHECK (service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation'));

-- packages: duration validation (1 minute to 24 hours)
ALTER TABLE public.packages
  ADD CONSTRAINT packages_default_duration_minutes_check
  CHECK (default_duration_minutes BETWEEN 1 AND 1440);

-- =====================================================================================
-- PART 3: FK-DEPENDENT INDEXES
-- =====================================================================================

-- packages: Index on tenant_id + module + kind (now that FK exists)
CREATE INDEX IF NOT EXISTS idx_packages_tenant_module_kind
  ON public.packages (tenant_id, module_key, service_kind, status);

-- packages: Index on template_id (now that FK exists)
CREATE INDEX IF NOT EXISTS idx_packages_template_id
  ON public.packages(template_id)
  WHERE template_id IS NOT NULL;

-- inventory_logs: Index on session_log_id (now that FK exists)
CREATE INDEX IF NOT EXISTS idx_inventory_logs_session
  ON public.inventory_logs(session_log_id)
  WHERE session_log_id IS NOT NULL;

-- =====================================================================================
-- PART 4: AUDIT TRIGGERS
-- =====================================================================================

-- packages: Audit trigger
-- Depends on: log_audit_event() created in 20260516
CREATE TRIGGER audit_packages_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_event();

COMMENT ON TRIGGER audit_packages_changes ON public.packages IS
  'Audit trail for all package changes (INSERT/UPDATE/DELETE). Required for compliance.';

-- inventory_items: Audit trigger
CREATE TRIGGER audit_inventory_items_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_event();

COMMENT ON TRIGGER audit_inventory_items_changes ON public.inventory_items IS
  'Audit trail for all inventory item changes. Required for compliance and security.';

-- inventory_logs: Audit trigger (implicit - already logs movements)
-- Note: inventory_logs IS ITSELF an audit table, so typically does not need
-- its own audit trigger unless double-audit required by policy

-- =====================================================================================
-- PART 5: UPDATE TRIGGERS
-- =====================================================================================

-- inventory_items: Auto-update updated_at timestamp
-- Depends on: update_updated_at_column() created in 20260511
CREATE TRIGGER inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER inventory_items_updated_at ON public.inventory_items IS
  'Automatic updated_at timestamp management. Sets updated_at = NOW() on every UPDATE.';

-- packages: Auto-update updated_at timestamp
CREATE TRIGGER packages_updated_at
  BEFORE UPDATE ON public.packages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TRIGGER packages_updated_at ON public.packages IS
  'Automatic updated_at timestamp management for packages table.';

-- =====================================================================================
-- PART 6: ROW LEVEL SECURITY (RLS)
-- =====================================================================================

-- Enable RLS on all tables
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_logs ENABLE ROW LEVEL SECURITY;

-- packages: Read policy (tenant isolation + HQ template sharing)
CREATE POLICY "Tenant read packages" ON public.packages
  FOR SELECT TO authenticated
  USING (
    -- Service role bypasses RLS
    (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
    OR
    -- No tenant set (initial setup)
    (public.get_auth_tenant_id() IS NULL)
    OR
    -- Tenant's own packages
    (tenant_id = public.get_auth_tenant_id())
    OR
    -- HQ templates are visible across tenants
    (is_hq_template = true)
  );

-- packages: Manage policy (admin only)
CREATE POLICY "Tenant admin manage packages" ON public.packages
  FOR ALL TO authenticated
  USING (
    -- Service role bypasses RLS
    (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
    OR
    -- No tenant set (initial setup)
    (public.get_auth_tenant_id() IS NULL)
    OR
    -- Tenant admin can manage their packages
    (public.is_admin() AND tenant_id = public.get_auth_tenant_id())
  );

-- inventory_items: Tenant isolation policy
CREATE POLICY "Tenant isolation for inventory items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (
    -- Service role bypasses RLS
    (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
    OR
    -- No tenant set (initial setup)
    (public.get_auth_tenant_id() IS NULL)
    OR
    -- Tenant isolation
    (tenant_id = public.get_auth_tenant_id())
  );

-- inventory_logs: Tenant isolation policy
CREATE POLICY "Tenant isolation for inventory logs" ON public.inventory_logs
  FOR ALL TO authenticated
  USING (
    -- Service role bypasses RLS
    (current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role')
    OR
    -- No tenant set (initial setup)
    (public.get_auth_tenant_id() IS NULL)
    OR
    -- Tenant isolation
    (tenant_id = public.get_auth_tenant_id())
  );

-- =====================================================================================
-- PART 7: ADDITIONAL COMMENTS
-- =====================================================================================

COMMENT ON COLUMN public.packages.product_usage IS
  'JSONB mapping of product_id -> quantity consumed per session. Used for inventory forecasting. Example: {"product-uuid-1": 2.5, "product-uuid-2": 1.0}';

COMMENT ON COLUMN public.packages.template_id IS
  'Self-reference to parent package for HQ->Branch template distribution. NULL for original templates.';

COMMENT ON COLUMN public.packages.is_hq_template IS
  'Flag for templates created by HQ for distribution to branches. Visible across tenants when true.';

COMMENT ON COLUMN public.inventory_logs.change_amount IS
  'Stock change amount. Positive = stock in (purchases), Negative = stock out (consumption).';

COMMENT ON COLUMN public.inventory_logs.session_log_id IS
  'Links to service session when consumption occurs during treatment. NULL for purchases and manual adjustments.';

COMMENT ON COLUMN public.inventory_logs.accounting_metadata IS
  'JSONB metadata for accounting integration. Populated by accounting backfill jobs.';

-- =====================================================================================
-- Migration Complete - Part 2
-- =====================================================================================
-- Foreign key constraints, audit triggers, update triggers, RLS policies, and CHECK
-- constraints applied to Bella Spa core tables.
--
-- These tables are now fully integrated with platform infrastructure:
-- - Tenant isolation enforced via FK + RLS
-- - Audit trail active via log_audit_event()
-- - Timestamp management via update_updated_at_column()
-- - Referential integrity enforced
--
-- Downstream migrations (20260522+) can safely reference these tables with full
-- constraint enforcement.
-- =====================================================================================
