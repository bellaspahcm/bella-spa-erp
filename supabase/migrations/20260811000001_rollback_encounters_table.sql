-- ============================================================================
-- Healthcare Platform — Encounter Engine Rollback
-- Migration: 20260811000001_rollback_encounters_table.sql
-- Purpose: Rollback 20260811000000_create_encounters_table.sql
-- ============================================================================

-- WARNING: This will drop the hc_encounters table and all data
-- Only run this if migration 20260811000000 needs to be reversed

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_hc_encounters_updated_at ON public.hc_encounters;
DROP FUNCTION IF EXISTS update_hc_encounters_updated_at();

-- Drop RLS policies
DROP POLICY IF EXISTS tenant_isolation_policy ON public.hc_encounters;
DROP POLICY IF EXISTS service_role_bypass ON public.hc_encounters;

-- Drop indexes (CASCADE will handle this, but explicit for documentation)
DROP INDEX IF EXISTS idx_hc_encounters_tenant;
DROP INDEX IF EXISTS idx_hc_encounters_patient;
DROP INDEX IF EXISTS idx_hc_encounters_status;
DROP INDEX IF EXISTS idx_hc_encounters_period_start;
DROP INDEX IF EXISTS idx_hc_encounters_period_end;
DROP INDEX IF EXISTS idx_hc_encounters_provider;
DROP INDEX IF EXISTS idx_hc_encounters_department;
DROP INDEX IF EXISTS idx_hc_encounters_location;
DROP INDEX IF EXISTS idx_hc_encounters_parent;
DROP INDEX IF EXISTS idx_hc_encounters_tenant_patient_active;

-- Drop table
DROP TABLE IF EXISTS public.hc_encounters CASCADE;

-- Verification
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'hc_encounters'; -- Should return 0
