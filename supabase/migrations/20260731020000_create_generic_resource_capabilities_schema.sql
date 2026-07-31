-- ============================================================================
-- Bella EIP — Generic Resource Capabilities Schema (Phase 1 Foundation)
-- Architectural Invariant 01: Fully Additive, Zero Impact on Production Tenants
-- Timestamp: 20260731020000
-- ============================================================================

-- 1. Resource Snapshots Table (CQRS-Lite Read Model)
CREATE TABLE IF NOT EXISTS public.resource_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'NEW',
  workflow_state TEXT NOT NULL DEFAULT 'NEW',
  owner_id TEXT,
  owner_name TEXT,
  current_stage TEXT NOT NULL DEFAULT 'INITIAL',
  current_sla_status TEXT NOT NULL DEFAULT 'NORMAL',
  attempt_count INT NOT NULL DEFAULT 0,
  rotation_count INT NOT NULL DEFAULT 0,
  version_binding JSONB NOT NULL DEFAULT '{"workflowVersion": "v1.0", "ruleVersion": "v1.0", "slaVersion": "v1.0"}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_resource_snapshot UNIQUE (tenant_id, resource_type, resource_id)
);

-- Indexes for ultra-fast query performance
CREATE INDEX IF NOT EXISTS idx_resource_snapshots_lookup 
  ON public.resource_snapshots (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_snapshots_owner 
  ON public.resource_snapshots (tenant_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_resource_snapshots_state 
  ON public.resource_snapshots (tenant_id, resource_type, state);

-- 2. Resource Assignments Table
CREATE TABLE IF NOT EXISTS public.resource_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  assigned_to TEXT NOT NULL,
  assigned_to_name TEXT,
  assigned_by TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'PENDING_ACCEPTANCE', -- PENDING_ACCEPTANCE, ACCEPTED, ROTATED, REJECTED
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_resource_assignments_lookup 
  ON public.resource_assignments (tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_resource_assignments_user 
  ON public.resource_assignments (tenant_id, assigned_to);

-- 3. Resource SLA Logs Table
CREATE TABLE IF NOT EXISTS public.resource_sla_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  stage_code TEXT NOT NULL,
  stage_label TEXT,
  deadline_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, COMPLETED, BREACHED, CANCELLED
  breached_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_sla_logs_active 
  ON public.resource_sla_logs (tenant_id, resource_type, resource_id, status);
CREATE INDEX IF NOT EXISTS idx_resource_sla_logs_deadline 
  ON public.resource_sla_logs (deadline_time) WHERE status = 'ACTIVE';

-- 4. Resource Rotations Audit Table
CREATE TABLE IF NOT EXISTS public.resource_rotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  from_owner_id TEXT,
  to_owner_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  attempt_count INT NOT NULL DEFAULT 0,
  rotated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_rotations_lookup 
  ON public.resource_rotations (tenant_id, resource_type, resource_id);

-- 5. Resource Audit Event Logs Table
CREATE TABLE IF NOT EXISTS public.resource_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INT NOT NULL DEFAULT 1,
  actor_id TEXT NOT NULL,
  actor_name TEXT,
  description TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_resource_audit_logs_lookup 
  ON public.resource_audit_logs (tenant_id, resource_type, resource_id, created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.resource_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_sla_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_audit_logs ENABLE ROW LEVEL SECURITY;

-- Permissive RLS Policies for Tenant Access (Authenticated Users & Service Role)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to resource_snapshots') THEN
    CREATE POLICY "Allow authenticated users full access to resource_snapshots" 
      ON public.resource_snapshots FOR ALL TO authenticated USING (true);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to resource_assignments') THEN
    CREATE POLICY "Allow authenticated users full access to resource_assignments" 
      ON public.resource_assignments FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to resource_sla_logs') THEN
    CREATE POLICY "Allow authenticated users full access to resource_sla_logs" 
      ON public.resource_sla_logs FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to resource_rotations') THEN
    CREATE POLICY "Allow authenticated users full access to resource_rotations" 
      ON public.resource_rotations FOR ALL TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow authenticated users full access to resource_audit_logs') THEN
    CREATE POLICY "Allow authenticated users full access to resource_audit_logs" 
      ON public.resource_audit_logs FOR ALL TO authenticated USING (true);
  END IF;
END $$;
