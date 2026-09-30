-- =====================================================
-- Bella payroll configuration contract
-- =====================================================
-- Restores the active migration artifact referenced by scripts/run-config-migrations.ts
-- and generated Database types. The schema itself already exists in the archived
-- setup SQL; this file makes the contract deployable without dashboard-only SQL.

CREATE TABLE IF NOT EXISTS public.tenant_payroll_config (
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
  UNIQUE (tenant_id, provider_key)
);

-- zero-downtime: allow blocking-index - index on newly created tenant_payroll_config table
CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_tenant
  ON public.tenant_payroll_config (tenant_id);

-- zero-downtime: allow blocking-index - index on newly created tenant_payroll_config table
CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_enabled
  ON public.tenant_payroll_config (tenant_id, provider_key, enabled);

-- zero-downtime: allow blocking-index - index on newly created tenant_payroll_config table
CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_strategy
  ON public.tenant_payroll_config (tenant_id, provider_key, strategy);

ALTER TABLE public.tenant_payroll_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant payroll config" ON public.tenant_payroll_config;
CREATE POLICY "Users can view own tenant payroll config"
  ON public.tenant_payroll_config
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update own tenant payroll config" ON public.tenant_payroll_config;
CREATE POLICY "Admins can update own tenant payroll config"
  ON public.tenant_payroll_config
  FOR UPDATE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Admins can insert own tenant payroll config" ON public.tenant_payroll_config;
CREATE POLICY "Admins can insert own tenant payroll config"
  ON public.tenant_payroll_config
  FOR INSERT
  WITH CHECK (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

DROP POLICY IF EXISTS "Admins can delete own tenant payroll config" ON public.tenant_payroll_config;
CREATE POLICY "Admins can delete own tenant payroll config"
  ON public.tenant_payroll_config
  FOR DELETE
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.users
      WHERE id = auth.uid()
        AND role IN ('admin', 'owner')
    )
  );

CREATE TABLE IF NOT EXISTS public.tenant_payroll_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID REFERENCES public.tenant_payroll_config(id) ON DELETE SET NULL,
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

-- zero-downtime: allow blocking-index - index on newly created tenant_payroll_config_history table
CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_history_tenant
  ON public.tenant_payroll_config_history (tenant_id);

-- zero-downtime: allow blocking-index - index on newly created tenant_payroll_config_history table
CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_history_provider
  ON public.tenant_payroll_config_history (tenant_id, provider_key);

-- zero-downtime: allow blocking-index - index on newly created tenant_payroll_config_history table
CREATE INDEX IF NOT EXISTS idx_tenant_payroll_config_history_changed_at
  ON public.tenant_payroll_config_history (changed_at DESC);

ALTER TABLE public.tenant_payroll_config_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tenant payroll config history" ON public.tenant_payroll_config_history;
CREATE POLICY "Users can view own tenant payroll config history"
  ON public.tenant_payroll_config_history
  FOR SELECT
  USING (
    tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.update_tenant_payroll_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_tenant_payroll_config_updated_at ON public.tenant_payroll_config;
CREATE TRIGGER trigger_update_tenant_payroll_config_updated_at
  BEFORE UPDATE ON public.tenant_payroll_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_tenant_payroll_config_updated_at();

CREATE OR REPLACE FUNCTION public.log_tenant_payroll_config_change()
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
    INSERT INTO public.tenant_payroll_config_history (
      config_id, tenant_id, provider_key, old_value, new_value,
      changed_by, change_type, reason
    ) VALUES (
      OLD.id, OLD.tenant_id, OLD.provider_key,
      jsonb_build_object('enabled', OLD.enabled, 'strategy', OLD.strategy, 'config', OLD.config),
      '{}'::jsonb, auth.uid(), change_type_val, 'Config deleted'
    );
    RETURN OLD;
  END IF;

  INSERT INTO public.tenant_payroll_config_history (
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_log_tenant_payroll_config_change ON public.tenant_payroll_config;
CREATE TRIGGER trigger_log_tenant_payroll_config_change
  AFTER INSERT OR UPDATE OR DELETE ON public.tenant_payroll_config
  FOR EACH ROW
  EXECUTE FUNCTION public.log_tenant_payroll_config_change();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_payroll_config TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_payroll_config_history TO authenticated, service_role;
