-- ============================================================================
-- MANUAL MIGRATION: Create Persons Table
-- ============================================================================
-- Run this script directly in Supabase Studio SQL Editor
-- This bypasses migration version conflicts
-- ============================================================================

-- Step 1: Create persons table (idempotent)
CREATE TABLE IF NOT EXISTS public.persons (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Core identity fields
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other', 'prefer-not-to-say')),
  nationality TEXT, -- ISO 3166-1 alpha-2 country code
  
  -- Identifiers (JSONB array)
  identifiers JSONB DEFAULT '[]'::JSONB,
  
  -- Contacts (JSONB array)
  contacts JSONB DEFAULT '[]'::JSONB,
  
  -- Addresses (JSONB array)
  addresses JSONB DEFAULT '[]'::JSONB,
  
  -- Optional fields
  photo_url TEXT,
  preferred_language TEXT DEFAULT 'vi', -- ISO 639-1 code
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deceased', 'merged')),
  
  -- Metadata (tenant-specific extensions)
  metadata JSONB,
  
  -- Audit fields
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT persons_tenant_fk FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE,
  CONSTRAINT persons_date_of_birth_check CHECK (date_of_birth <= CURRENT_DATE)
);

-- Step 2: Create indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_persons_tenant_id ON public.persons(tenant_id);
CREATE INDEX IF NOT EXISTS idx_persons_first_name ON public.persons(first_name);
CREATE INDEX IF NOT EXISTS idx_persons_last_name ON public.persons(last_name);
CREATE INDEX IF NOT EXISTS idx_persons_full_name ON public.persons(first_name, last_name);
CREATE INDEX IF NOT EXISTS idx_persons_date_of_birth ON public.persons(date_of_birth);
CREATE INDEX IF NOT EXISTS idx_persons_status ON public.persons(status);
CREATE INDEX IF NOT EXISTS idx_persons_identifiers ON public.persons USING GIN (identifiers);
CREATE INDEX IF NOT EXISTS idx_persons_contacts ON public.persons USING GIN (contacts);
CREATE INDEX IF NOT EXISTS idx_persons_addresses ON public.persons USING GIN (addresses);
CREATE INDEX IF NOT EXISTS idx_persons_tenant_status ON public.persons(tenant_id, status);

-- Step 3: Enable RLS
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'persons' 
    AND policyname = 'persons_tenant_isolation'
  ) THEN
    CREATE POLICY persons_tenant_isolation ON public.persons
      FOR ALL
      USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'persons' 
    AND policyname = 'persons_service_role'
  ) THEN
    CREATE POLICY persons_service_role ON public.persons
      FOR ALL
      TO service_role
      USING (true);
  END IF;
END $$;

-- Step 5: Create trigger function (idempotent)
CREATE OR REPLACE FUNCTION update_persons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger (idempotent)
DROP TRIGGER IF EXISTS trigger_persons_updated_at ON public.persons;
CREATE TRIGGER trigger_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW
  EXECUTE FUNCTION update_persons_updated_at();

-- Step 7: Add table comments
COMMENT ON TABLE public.persons IS 'Platform identity primitive - represents "who someone is" independent of roles';
COMMENT ON COLUMN public.persons.id IS 'Unique person identifier (UUID)';
COMMENT ON COLUMN public.persons.tenant_id IS 'Tenant this person belongs to';
COMMENT ON COLUMN public.persons.first_name IS 'Legal first name';
COMMENT ON COLUMN public.persons.last_name IS 'Legal last name';
COMMENT ON COLUMN public.persons.middle_name IS 'Middle name (optional)';
COMMENT ON COLUMN public.persons.date_of_birth IS 'Date of birth (ISO 8601 date)';
COMMENT ON COLUMN public.persons.gender IS 'Gender (male, female, other, prefer-not-to-say)';
COMMENT ON COLUMN public.persons.nationality IS 'Nationality (ISO 3166-1 alpha-2 country code)';
COMMENT ON COLUMN public.persons.identifiers IS 'Government/institutional identifiers (JSONB array)';
COMMENT ON COLUMN public.persons.contacts IS 'Contact information (JSONB array: phone, email, mobile)';
COMMENT ON COLUMN public.persons.addresses IS 'Physical addresses (JSONB array)';
COMMENT ON COLUMN public.persons.photo_url IS 'Profile photo URL';
COMMENT ON COLUMN public.persons.preferred_language IS 'Preferred language (ISO 639-1 code)';
COMMENT ON COLUMN public.persons.status IS 'Record status (active, inactive, deceased, merged)';
COMMENT ON COLUMN public.persons.metadata IS 'Tenant-specific extension fields (JSONB)';

-- ============================================================================
-- Verification Query
-- ============================================================================
-- Run this after script completes to verify table was created successfully

SELECT 
  'persons' AS table_name,
  COUNT(*) AS column_count,
  (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'persons') AS index_count,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'persons') AS policy_count,
  (SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'public.persons'::regclass) AS trigger_count
FROM information_schema.columns 
WHERE table_name = 'persons' AND table_schema = 'public';

-- Expected output:
-- table_name | column_count | index_count | policy_count | trigger_count
-- persons    | 17           | 10          | 2            | 1

-- ============================================================================
-- SUCCESS! 
-- Person table created. Next steps:
-- 1. Verify table exists: \d persons
-- 2. Update CAP-001 status to DEPLOYED
-- 3. Run Education Smoke Test #2
-- ============================================================================
