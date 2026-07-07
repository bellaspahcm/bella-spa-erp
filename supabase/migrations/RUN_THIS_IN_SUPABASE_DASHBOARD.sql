-- =====================================================
-- BELLA PAYROLL CONFIGURATION SYSTEM - COMPLETE SETUP
-- =====================================================
-- Run this ONCE in Supabase Dashboard SQL Editor
-- URL: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new
--
-- This script contains:
-- 1. exec_sql helper function (for npm run config:migrate)
-- 2. tenant_payroll_config table schema
-- 3. tenant_payroll_config_history table
-- 4. Triggers and RLS policies
-- 5. Default configs for all tenants
-- =====================================================

-- =====================================================
-- PART 1: Create exec_sql helper (for migration scripts)
-- =====================================================

CREATE OR REPLACE FUNCTION public.exec_sql(sql_query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql_query;
END;
$$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

COMMENT ON FUNCTION public.exec_sql IS 'Execute raw SQL - ONLY for service_role via migration scripts. DO NOT expose to client.';

-- =====================================================
-- PART 2: Create tenant_payroll_config table
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_payroll_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider_key TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  strategy TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  UNIQUE(tenant_id, provider_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_tenant 
  ON tenant_payroll_config(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_enabled 
  ON tenant_payroll_config(tenant_id, provider_key, enabled);

CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_strategy 
  ON tenant_payroll_config(tenant_id, provider_key, strategy);

ALTER TABLE tenant_payroll_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant payroll config" ON tenant_payroll_config;
CREATE POLICY "Users can view own tenant payroll config"
  ON tenant_payroll_config
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update own tenant payroll config" ON tenant_payroll_config;
CREATE POLICY "Admins can update own tenant payroll config"
  ON tenant_payroll_config
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Admins can insert own tenant payroll config" ON tenant_payroll_config;
CREATE POLICY "Admins can insert own tenant payroll config"
  ON tenant_payroll_config
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Admins can delete own tenant payroll config" ON tenant_payroll_config;
CREATE POLICY "Admins can delete own tenant payroll config"
  ON tenant_payroll_config
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'owner')
    )
  );

-- =====================================================
-- PART 3: Create tenant_payroll_config_history table
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_payroll_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES tenant_payroll_config(id) ON DELETE SET NULL,
  tenant_id UUID NOT NULL,
  provider_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL DEFAULT 'update',
  reason TEXT,
  ip_address INET,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_history_tenant 
  ON tenant_payroll_config_history(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_history_provider 
  ON tenant_payroll_config_history(tenant_id, provider_key);

CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_history_changed_at 
  ON tenant_payroll_config_history(changed_at DESC);

ALTER TABLE tenant_payroll_config_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant payroll config history" ON tenant_payroll_config_history;
CREATE POLICY "Users can view own tenant payroll config history"
  ON tenant_payroll_config_history
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

-- =====================================================
-- PART 4: Create triggers
-- =====================================================

CREATE OR REPLACE FUNCTION update_tenant_payroll_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tenant_payroll_config_updated_at ON tenant_payroll_config;
CREATE TRIGGER trigger_update_tenant_payroll_config_updated_at
  BEFORE UPDATE ON tenant_payroll_config
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_payroll_config_updated_at();

CREATE OR REPLACE FUNCTION log_tenant_payroll_config_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type_val TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    change_type_val := 'create';
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.enabled = true AND NEW.enabled = false THEN
      change_type_val := 'disable';
    ELSIF OLD.enabled = false AND NEW.enabled = true THEN
      change_type_val := 'enable';
    ELSE
      change_type_val := 'update';
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    change_type_val := 'delete';
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO tenant_payroll_config_history (
      config_id, tenant_id, provider_key, old_value, new_value,
      changed_by, change_type, reason
    ) VALUES (
      OLD.id, OLD.tenant_id, OLD.provider_key,
      jsonb_build_object('enabled', OLD.enabled, 'strategy', OLD.strategy, 'config', OLD.config),
      '{}'::jsonb, auth.uid(), change_type_val, 'Config deleted'
    );
    RETURN OLD;
  ELSE
    INSERT INTO tenant_payroll_config_history (
      config_id, tenant_id, provider_key, old_value, new_value,
      changed_by, change_type, reason
    ) VALUES (
      NEW.id, NEW.tenant_id, NEW.provider_key,
      CASE WHEN TG_OP = 'INSERT' THEN NULL
        ELSE jsonb_build_object('enabled', OLD.enabled, 'strategy', OLD.strategy, 'config', OLD.config)
      END,
      jsonb_build_object('enabled', NEW.enabled, 'strategy', NEW.strategy, 'config', NEW.config),
      auth.uid(), change_type_val, NEW.notes
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_tenant_payroll_config_change ON tenant_payroll_config;
CREATE TRIGGER trigger_log_tenant_payroll_config_change
  AFTER INSERT OR UPDATE OR DELETE ON tenant_payroll_config
  FOR EACH ROW
  EXECUTE FUNCTION log_tenant_payroll_config_change();

-- =====================================================
-- PART 5: Insert default configs for all tenants
-- =====================================================

-- Commission: 120k per session (enabled by default)
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT 
  id as tenant_id,
  'commission' as provider_key,
  true as enabled,
  'fixed' as strategy,
  '{"rate": 120000, "minSessions": 0}'::jsonb as config,
  'Default commission: 120k per session' as notes
FROM tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- KPI: 30 sessions → 1M bonus (disabled by default, need opt-in)
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT 
  id as tenant_id,
  'kpi' as provider_key,
  false as enabled,
  'threshold' as strategy,
  '{"target": 30, "bonus": 1000000}'::jsonb as config,
  'KPI bonus: 30 sessions → 1M VND (disabled by default)' as notes
FROM tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Attendance: Late (50k) / Absent (200k) penalties (enabled by default)
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT 
  id as tenant_id,
  'attendance' as provider_key,
  true as enabled,
  'late_deduction' as strategy,
  '{"latePenalty": 50000, "absentPenalty": 200000, "lateGracePeriod": 15}'::jsonb as config,
  'Attendance deductions: 50k late, 200k absent, 15min grace' as notes
FROM tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Rating: >= 4.5 stars → 50k bonus (disabled by default)
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT 
  id as tenant_id,
  'rating' as provider_key,
  false as enabled,
  'threshold' as strategy,
  '{"minRating": 4.5, "bonus": 50000}'::jsonb as config,
  'Rating bonus: >= 4.5 stars → 50k VND (disabled by default)' as notes
FROM tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Bonus: Manual bonuses (disabled, use when needed)
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
SELECT 
  id as tenant_id,
  'bonus' as provider_key,
  false as enabled,
  'manual' as strategy,
  '{}'::jsonb as config,
  'Manual bonus entries (enable when needed)' as notes
FROM tenants
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERY
-- =====================================================
-- Run this after to verify setup

SELECT 
  (SELECT COUNT(*) FROM tenants) as tenant_count,
  (SELECT COUNT(*) FROM tenant_payroll_config) as config_count,
  (SELECT COUNT(DISTINCT provider_key) FROM tenant_payroll_config) as provider_count,
  (SELECT string_agg(DISTINCT provider_key, ', ' ORDER BY provider_key) FROM tenant_payroll_config) as providers;

-- Expected result: config_count = tenant_count * 5 (5 providers)

