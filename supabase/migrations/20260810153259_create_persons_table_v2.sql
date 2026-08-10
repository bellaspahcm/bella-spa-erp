-- ============================================================================
-- Person Platform Capability - Database Migration
-- ============================================================================
-- Migration: 20260810153259_create_persons_table_v2
-- Description: Create persons table for Platform identity primitive
-- 
-- Constitution Compliance:
-- - Law 4: Additive only (no ALTER TABLE DROP, no breaking constraints)
-- - Law 11: No `any` types (strict typing via JSONB schemas)
--
-- Architecture:
-- Person = identity primitive (Platform Host)
-- Patient/Student/Customer reference Person (vertical roles)
-- ============================================================================

-- Create persons table
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

-- ============================================================================
-- Indexes
-- ============================================================================

-- Tenant isolation index (most queries filter by tenant)
CREATE INDEX IF NOT EXISTS idx_persons_tenant_id ON public.persons(tenant_id);

-- Name search indexes
CREATE INDEX IF NOT EXISTS idx_persons_first_name ON public.persons(first_name);
CREATE INDEX IF NOT EXISTS idx_persons_last_name ON public.persons(last_name);
CREATE INDEX IF NOT EXISTS idx_persons_full_name ON public.persons(first_name, last_name);

-- Date of birth index (for age-based queries)
CREATE INDEX IF NOT EXISTS idx_persons_date_of_birth ON public.persons(date_of_birth);

-- Status index (filter active/inactive persons)
CREATE INDEX IF NOT EXISTS idx_persons_status ON public.persons(status);

-- JSONB GIN indexes for array searches
CREATE INDEX IF NOT EXISTS idx_persons_identifiers ON public.persons USING GIN (identifiers);
CREATE INDEX IF NOT EXISTS idx_persons_contacts ON public.persons USING GIN (contacts);
CREATE INDEX IF NOT EXISTS idx_persons_addresses ON public.persons USING GIN (addresses);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_persons_tenant_status ON public.persons(tenant_id, status);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE public.persons ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access persons in their tenant
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

-- Policy: Service role can access all persons (for migrations, admin operations)
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

-- ============================================================================
-- Triggers
-- ============================================================================

-- Trigger: Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_persons_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_persons_updated_at ON public.persons;

CREATE TRIGGER trigger_persons_updated_at
  BEFORE UPDATE ON public.persons
  FOR EACH ROW
  EXECUTE FUNCTION update_persons_updated_at();

-- ============================================================================
-- Comments (Documentation)
-- ============================================================================

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
-- Sample Data (Development/Testing)
-- ============================================================================

-- Note: Sample data should only be inserted in development environment
-- Production tenants will create persons through application API

-- End of migration
