-- ============================================================================
-- Bella EIP — Metadata Configuration Versioning Schema
-- Architectural Invariant 01: Fully Additive, Zero Impact on Production Tenants
-- Timestamp: 20260801000000
-- ============================================================================

-- 1. Metadata Configurations Table
CREATE TABLE IF NOT EXISTS public.metadata_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL DEFAULT 'system',
  correlation_id TEXT,
  CONSTRAINT uq_metadata_config_version UNIQUE (tenant_id, config_key, version)
);

CREATE INDEX IF NOT EXISTS idx_metadata_configs_lookup 
  ON public.metadata_configs (tenant_id, config_key, version DESC);

-- 2. Metadata Config History Table (Immutable snapshot logs)
CREATE TABLE IF NOT EXISTS public.metadata_config_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL,
  tenant_id TEXT NOT NULL,
  config_key TEXT NOT NULL,
  config_values JSONB NOT NULL,
  version INT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by TEXT NOT NULL DEFAULT 'system',
  correlation_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_metadata_config_history_lookup 
  ON public.metadata_config_history (tenant_id, config_key, changed_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.metadata_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.metadata_config_history ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Tenant Access (Authenticated Users & Service Role)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to metadata_configs') THEN
    CREATE POLICY "Allow authenticated users full access to metadata_configs" 
      ON public.metadata_configs FOR ALL TO authenticated USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to metadata_config_history') THEN
    CREATE POLICY "Allow authenticated users full access to metadata_config_history" 
      ON public.metadata_config_history FOR ALL TO authenticated USING (true);
  END IF;
END $$;
