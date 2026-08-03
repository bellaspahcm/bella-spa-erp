-- =====================================================
-- BELLA PAYROLL CONFIGURATION SYSTEM
-- =====================================================
-- Purpose: Store per-tenant payroll configuration
-- Allows each spa to have different commission rates, KPI rules, etc.
-- without changing code
--
-- Architecture:
-- - tenant_payroll_config: Main config table (provider_key → config JSON)
-- - tenant_payroll_config_history: Audit log of config changes
--
-- Design Principles:
-- 1. Configuration-driven: Change config, not code
-- 2. Provider-based: Each provider (Commission, KPI, Attendance...) has own config
-- 3. Strategy pattern: Config specifies which strategy to use
-- 4. Versioned: Track all changes for audit/rollback
-- =====================================================

-- =====================================================
-- TABLE: tenant_payroll_config
-- =====================================================
-- Stores configuration for each payroll provider per tenant
--
-- Example configs:
-- 1. Commission (Fixed):
--    provider_key: 'commission'
--    strategy: 'fixed'
--    config: {"rate": 120000, "minSessions": 0}
--
-- 2. Commission (Tier):
--    provider_key: 'commission'
--    strategy: 'tier'
--    config: {
--      "tiers": [
--        {"min": 0, "max": 10, "rate": 100000},
--        {"min": 11, "max": 20, "rate": 120000},
--        {"min": 21, "max": 999, "rate": 150000}
--      ]
--    }
--
-- 3. KPI (Threshold):
--    provider_key: 'kpi'
--    strategy: 'threshold'
--    config: {"target": 30, "bonus": 1000000}
--
-- 4. KPI (Disabled):
--    provider_key: 'kpi'
--    enabled: false
--    config: {}
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_payroll_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant reference
  tenant_id UUID NOT NULL,
  
  -- Provider identification
  provider_key TEXT NOT NULL,
  -- Examples: 'commission', 'kpi', 'attendance', 'rating', 'bonus', 
  --           'deduction', 'insurance', 'tax', 'advance'
  
  -- Enable/disable toggle
  enabled BOOLEAN NOT NULL DEFAULT true,
  
  -- Strategy selection
  strategy TEXT,
  -- Examples for 'commission': 'fixed', 'tier', 'percentage', 'revenue', 'service'
  -- Examples for 'kpi': 'threshold', 'linear', 'tier'
  -- Examples for 'attendance': 'late_deduction', 'absent_deduction'
  
  -- Configuration parameters (JSON)
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure depends on provider_key + strategy
  -- Validated by application code (JSON Schema)
  
  -- Versioning
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Notes for admin
  notes TEXT,
  
  -- Ensure one config per tenant per provider
  UNIQUE(tenant_id, provider_key)
);

-- Indexes for fast lookup
CREATE INDEX idx_tenant_payroll_config_tenant 
  ON tenant_payroll_config(tenant_id);

CREATE INDEX idx_tenant_payroll_config_enabled 
  ON tenant_payroll_config(tenant_id, provider_key, enabled);

CREATE INDEX idx_tenant_payroll_config_strategy 
  ON tenant_payroll_config(tenant_id, provider_key, strategy);

-- RLS Policies
ALTER TABLE tenant_payroll_config ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see configs from their tenant
CREATE POLICY "Users can view own tenant payroll config"
  ON tenant_payroll_config
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins can update configs
CREATE POLICY "Admins can update own tenant payroll config"
  ON tenant_payroll_config
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Policy: Only admins can insert configs
CREATE POLICY "Admins can insert own tenant payroll config"
  ON tenant_payroll_config
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Policy: Only admins can delete configs
CREATE POLICY "Admins can delete own tenant payroll config"
  ON tenant_payroll_config
  FOR DELETE
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- Comments
COMMENT ON TABLE tenant_payroll_config IS 
  'Per-tenant payroll configuration for providers (commission, KPI, attendance, etc.)';

COMMENT ON COLUMN tenant_payroll_config.provider_key IS 
  'Provider identifier: commission, kpi, attendance, rating, bonus, etc.';

COMMENT ON COLUMN tenant_payroll_config.strategy IS 
  'Strategy name: fixed, tier, percentage, threshold, linear, etc.';

COMMENT ON COLUMN tenant_payroll_config.config IS 
  'JSON configuration parameters, structure depends on provider_key + strategy';

-- =====================================================
-- TABLE: tenant_payroll_config_history
-- =====================================================
-- Audit log of all config changes
-- Enables:
-- - Audit trail (who changed what when)
-- - Rollback capability
-- - Change analysis
-- =====================================================

CREATE TABLE IF NOT EXISTS tenant_payroll_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to config (nullable because config might be deleted)
  config_id UUID REFERENCES tenant_payroll_config(id) ON DELETE SET NULL,
  
  -- Tenant & provider for filtering
  tenant_id UUID NOT NULL,
  provider_key TEXT NOT NULL,
  
  -- Old and new values
  old_value JSONB,
  new_value JSONB NOT NULL,
  
  -- Change metadata
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  change_type TEXT NOT NULL DEFAULT 'update',
  -- Values: 'create', 'update', 'delete', 'enable', 'disable'
  
  -- Reason for change
  reason TEXT,
  
  -- IP address for security audit
  ip_address INET,
  user_agent TEXT
);

-- Indexes
CREATE INDEX idx_tenant_payroll_config_history_tenant 
  ON tenant_payroll_config_history(tenant_id);

CREATE INDEX idx_tenant_payroll_config_history_provider 
  ON tenant_payroll_config_history(tenant_id, provider_key);

CREATE INDEX idx_tenant_payroll_config_history_changed_at 
  ON tenant_payroll_config_history(changed_at DESC);

-- RLS Policies
ALTER TABLE tenant_payroll_config_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view history from their tenant
CREATE POLICY "Users can view own tenant payroll config history"
  ON tenant_payroll_config_history
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM user_tenant_roles
      WHERE user_id = auth.uid()
    )
  );

-- Comments
COMMENT ON TABLE tenant_payroll_config_history IS 
  'Audit log of all payroll configuration changes for compliance and rollback';

-- =====================================================
-- FUNCTION: Auto-update updated_at timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_tenant_payroll_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_tenant_payroll_config_updated_at
  BEFORE UPDATE ON tenant_payroll_config
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_payroll_config_updated_at();

-- =====================================================
-- FUNCTION: Auto-log config changes to history
-- =====================================================

CREATE OR REPLACE FUNCTION log_tenant_payroll_config_change()
RETURNS TRIGGER AS $$
DECLARE
  change_type_val TEXT;
BEGIN
  -- Determine change type
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

  -- Insert to history
  IF TG_OP = 'DELETE' THEN
    INSERT INTO tenant_payroll_config_history (
      config_id,
      tenant_id,
      provider_key,
      old_value,
      new_value,
      changed_by,
      change_type,
      reason
    ) VALUES (
      OLD.id,
      OLD.tenant_id,
      OLD.provider_key,
      jsonb_build_object(
        'enabled', OLD.enabled,
        'strategy', OLD.strategy,
        'config', OLD.config
      ),
      '{}'::jsonb,
      auth.uid(),
      change_type_val,
      'Config deleted'
    );
    RETURN OLD;
  ELSE
    INSERT INTO tenant_payroll_config_history (
      config_id,
      tenant_id,
      provider_key,
      old_value,
      new_value,
      changed_by,
      change_type,
      reason
    ) VALUES (
      NEW.id,
      NEW.tenant_id,
      NEW.provider_key,
      CASE 
        WHEN TG_OP = 'INSERT' THEN NULL
        ELSE jsonb_build_object(
          'enabled', OLD.enabled,
          'strategy', OLD.strategy,
          'config', OLD.config
        )
      END,
      jsonb_build_object(
        'enabled', NEW.enabled,
        'strategy', NEW.strategy,
        'config', NEW.config
      ),
      auth.uid(),
      change_type_val,
      NEW.notes
    );
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_tenant_payroll_config_change
  AFTER INSERT OR UPDATE OR DELETE ON tenant_payroll_config
  FOR EACH ROW
  EXECUTE FUNCTION log_tenant_payroll_config_change();

-- =====================================================
-- DEFAULT CONFIGS
-- =====================================================
-- Insert default configs for existing tenants
-- These are baseline configs that can be customized per tenant
-- =====================================================

-- Note: This will be executed manually or via separate migration
-- after tenant_id values are known
-- For now, we just create the schema

-- Example insert (commented out, use as template):
/*
INSERT INTO tenant_payroll_config (tenant_id, provider_key, enabled, strategy, config, notes)
VALUES
  (
    '<tenant-uuid>',
    'commission',
    true,
    'fixed',
    '{"rate": 120000, "minSessions": 0}'::jsonb,
    'Default commission: 120k per session'
  ),
  (
    '<tenant-uuid>',
    'kpi',
    true,
    'threshold',
    '{"target": 30, "bonus": 1000000}'::jsonb,
    'Default KPI: 30 sessions → 1M bonus'
  ),
  (
    '<tenant-uuid>',
    'attendance',
    true,
    'late_deduction',
    '{"latePenalty": 50000, "absentPenalty": 200000, "lateGracePeriod": 15}'::jsonb,
    'Default attendance: 50k late, 200k absent, 15min grace'
  );
*/

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View: Active payroll configs per tenant
CREATE OR REPLACE VIEW active_payroll_configs AS
SELECT 
  c.tenant_id,
  c.provider_key,
  c.strategy,
  c.config,
  c.version,
  c.updated_at,
  u.email as updated_by_email
FROM tenant_payroll_config c
LEFT JOIN auth.users u ON c.updated_by = u.id
WHERE c.enabled = true
ORDER BY c.tenant_id, c.provider_key;

COMMENT ON VIEW active_payroll_configs IS 
  'List of all enabled payroll configurations per tenant';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Build PayrollConfigService in TypeScript
-- 2. Refactor providers to read from this config
-- 3. Build UI for admin to manage configs
-- =====================================================
