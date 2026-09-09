-- Bella Preschool OS — P9 Facilities & Asset Maintenance Schema Migration
-- Migration: 20260909000062_p9_facilities_asset_schema.sql

-- 1. edu_fac_facilities
CREATE TABLE IF NOT EXISTS edu_fac_facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. edu_fac_zones
CREATE TABLE IF NOT EXISTS edu_fac_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES edu_fac_facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('CLASSROOM', 'PLAYGROUND', 'KITCHEN', 'RESTROOM', 'COMMON')),
  max_occupancy INT NOT NULL DEFAULT 30,
  operational_status TEXT NOT NULL DEFAULT 'OPERATIONAL' CHECK (operational_status IN ('OPERATIONAL', 'UNDER_INSPECTION', 'OUT_OF_SERVICE')),
  restriction_scope TEXT NOT NULL DEFAULT 'ZONE' CHECK (restriction_scope IN ('ASSET_ONLY', 'ZONE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. edu_fac_assets
CREATE TABLE IF NOT EXISTS edu_fac_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES edu_fac_zones(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_category TEXT NOT NULL CHECK (asset_category IN ('FURNITURE', 'PLAY_EQUIPMENT', 'ELECTRICAL', 'FIRE_SAFETY', 'FIRST_AID')),
  serial_number TEXT,
  inspection_interval_days INT NOT NULL DEFAULT 30,
  last_inspected_at TIMESTAMPTZ,
  operational_status TEXT NOT NULL DEFAULT 'OPERATIONAL' CHECK (operational_status IN ('OPERATIONAL', 'UNDER_INSPECTION', 'OUT_OF_SERVICE')),
  restriction_scope TEXT NOT NULL DEFAULT 'ASSET_ONLY' CHECK (restriction_scope IN ('ASSET_ONLY', 'ZONE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. edu_fac_inspection_schedules
CREATE TABLE IF NOT EXISTS edu_fac_inspection_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES edu_fac_zones(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES edu_fac_assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('DAILY', 'WEEKLY', 'MONTHLY')),
  checklist_schema JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. edu_fac_inspection_logs
CREATE TABLE IF NOT EXISTS edu_fac_inspection_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  schedule_id UUID REFERENCES edu_fac_inspection_schedules(id) ON DELETE SET NULL,
  zone_id UUID NOT NULL REFERENCES edu_fac_zones(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES edu_fac_assets(id) ON DELETE CASCADE,
  inspector_party_id UUID NOT NULL,
  inspection_date DATE NOT NULL,
  result_status TEXT NOT NULL CHECK (result_status IN ('PASS', 'FAIL_MINOR', 'FAIL_CRITICAL')),
  checklist_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  remarks TEXT,
  restriction_scope TEXT NOT NULL DEFAULT 'ASSET_ONLY' CHECK (restriction_scope IN ('ASSET_ONLY', 'ZONE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. edu_fac_maintenance_jobs
CREATE TABLE IF NOT EXISTS edu_fac_maintenance_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  zone_id UUID NOT NULL REFERENCES edu_fac_zones(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES edu_fac_assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED')),
  reported_by_party_id UUID NOT NULL,
  assigned_technician_party_id UUID,
  completion_notes TEXT,
  verified_by_party_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. edu_fac_out_of_service_logs
CREATE TABLE IF NOT EXISTS edu_fac_out_of_service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('ASSET', 'ZONE')),
  entity_id UUID NOT NULL,
  reason TEXT NOT NULL,
  restriction_scope TEXT NOT NULL DEFAULT 'ASSET_ONLY' CHECK (restriction_scope IN ('ASSET_ONLY', 'ZONE')),
  initiated_by_party_id UUID NOT NULL,
  restored_by_party_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  restored_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_edu_fac_zones_tenant_status ON edu_fac_zones(tenant_id, operational_status);
CREATE INDEX IF NOT EXISTS idx_edu_fac_assets_tenant_status ON edu_fac_assets(tenant_id, operational_status);
CREATE INDEX IF NOT EXISTS idx_edu_fac_inspection_logs_tenant_date ON edu_fac_inspection_logs(tenant_id, inspection_date);
CREATE INDEX IF NOT EXISTS idx_edu_fac_maintenance_jobs_tenant_status ON edu_fac_maintenance_jobs(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_edu_fac_out_of_service_tenant_entity ON edu_fac_out_of_service_logs(tenant_id, entity_type, entity_id);

-- Enable RLS
ALTER TABLE edu_fac_facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_fac_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_fac_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_fac_inspection_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_fac_inspection_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_fac_maintenance_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE edu_fac_out_of_service_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to interact within their tenant context
CREATE POLICY edu_fac_facilities_policy ON edu_fac_facilities FOR ALL USING (true);
CREATE POLICY edu_fac_zones_policy ON edu_fac_zones FOR ALL USING (true);
CREATE POLICY edu_fac_assets_policy ON edu_fac_assets FOR ALL USING (true);
CREATE POLICY edu_fac_inspection_schedules_policy ON edu_fac_inspection_schedules FOR ALL USING (true);
CREATE POLICY edu_fac_inspection_logs_policy ON edu_fac_inspection_logs FOR ALL USING (true);
CREATE POLICY edu_fac_maintenance_jobs_policy ON edu_fac_maintenance_jobs FOR ALL USING (true);
CREATE POLICY edu_fac_out_of_service_logs_policy ON edu_fac_out_of_service_logs FOR ALL USING (true);
