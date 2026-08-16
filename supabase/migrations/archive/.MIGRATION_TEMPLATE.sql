-- ============================================================================
-- Migration Template - Copy this for new migrations
-- ============================================================================
-- Migration: YYYYMMDDHHMMSS_descriptive_name
-- Description: Brief description of what this migration does
-- 
-- Constitution Compliance Checklist:
-- [ ] Law 4: Additive only (no ALTER TABLE DROP, no breaking constraints)
-- [ ] Law 11: No `any` types (strict JSONB schemas, typed columns)
-- [ ] Law 1: References aggregate roots correctly (Person, Encounter, etc.)
-- [ ] Law 9: Zero regression (doesn't affect other tenants/modules)
-- 
-- Testing Checklist:
-- [ ] Run migration locally: supabase db reset
-- [ ] Verify schema: \d table_name in psql
-- [ ] Run affected tests: npm test [test-file]
-- [ ] Check PostgREST schema cache refreshed (see below)
-- ============================================================================

-- ============================================================================
-- YOUR MIGRATION CONTENT HERE
-- ============================================================================

-- Example: Create table
CREATE TABLE IF NOT EXISTS public.example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT example_table_tenant_fk FOREIGN KEY (tenant_id)
    REFERENCES public.tenants(id) ON DELETE CASCADE
);

-- Example: Create indexes
CREATE INDEX IF NOT EXISTS idx_example_table_tenant_id ON public.example_table(tenant_id);

-- Example: Enable RLS
ALTER TABLE public.example_table ENABLE ROW LEVEL SECURITY;

-- Example: Create RLS policy (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'example_table' 
    AND policyname = 'example_table_tenant_isolation'
  ) THEN
    CREATE POLICY example_table_tenant_isolation ON public.example_table
      FOR ALL
      USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

-- ============================================================================
-- CRITICAL: Notify PostgREST to refresh schema cache
-- ============================================================================
-- Without this, PostgREST may not see new columns/tables immediately
-- This prevents "column does not exist" errors after migration
-- ============================================================================

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verification Query (run after migration to confirm success)
-- ============================================================================

SELECT 
  'example_table' AS table_name,
  COUNT(*) AS column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'example_table') AS index_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'example_table') AS policy_count
FROM information_schema.columns 
WHERE table_name = 'example_table' AND table_schema = 'public';

-- Expected output:
-- table_name     | column_count | index_count | policy_count
-- example_table  | 4            | 1           | 1

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
