-- ==============================================================================
-- E0.1A-R1.1 — CREATE IDENTITY MAPPING EVIDENCE TABLE
-- ==============================================================================
-- Purpose: Immutable mapping evidence between Person and Party
-- Phase: R1 Identity Mapping
-- Blast Radius: Platform-wide (Education, HR, Real Estate)
-- ==============================================================================

-- Create identity_migration_mapping table
CREATE TABLE IF NOT EXISTS public.identity_migration_mapping (
  -- Primary mapping
  person_id UUID NOT NULL REFERENCES persons(id),
  party_id UUID NOT NULL,  -- Will reference party_parties(id) after backfill
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  
  -- Migration metadata
  strategy TEXT NOT NULL CHECK (strategy IN (
    'CREATE_NEW_PARTY',
    'REUSE_EXISTING_PARTY',
    'AMBIGUOUS_REVIEW',
    'UNMIGRATABLE'
  )),
  
  -- Evidence
  source TEXT NOT NULL DEFAULT 'persons',
  match_confidence NUMERIC,  -- NULL for CREATE_NEW_PARTY
  match_evidence JSONB,      -- Evidence for REUSE_EXISTING_PARTY
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN (
    'planned',
    'party_created',
    'fk_migrated',
    'verified',
    'sealed'
  )),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  party_created_at TIMESTAMPTZ,  -- When party_parties INSERT happened
  fk_migrated_at TIMESTAMPTZ,    -- When FK cutover happened
  verified_at TIMESTAMPTZ,
  sealed_at TIMESTAMPTZ,
  
  -- Constraints
  PRIMARY KEY (person_id),
  UNIQUE (party_id),
  UNIQUE (person_id, tenant_id)
);

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_identity_mapping_tenant 
  ON identity_migration_mapping(tenant_id);

CREATE INDEX IF NOT EXISTS idx_identity_mapping_status 
  ON identity_migration_mapping(status);

CREATE INDEX IF NOT EXISTS idx_identity_mapping_strategy 
  ON identity_migration_mapping(strategy);

-- Comments (documentation)
COMMENT ON TABLE identity_migration_mapping IS 
  'E0.1A-R1: Immutable mapping evidence for Person → Party identity migration (platform-wide)';

COMMENT ON COLUMN identity_migration_mapping.person_id IS 
  'Source Person UUID from persons table';

COMMENT ON COLUMN identity_migration_mapping.party_id IS 
  'Target Party UUID (will be created in party_parties during R2)';

COMMENT ON COLUMN identity_migration_mapping.strategy IS 
  'Migration strategy: CREATE_NEW_PARTY (848 records) | REUSE_EXISTING_PARTY | AMBIGUOUS_REVIEW | UNMIGRATABLE';

COMMENT ON COLUMN identity_migration_mapping.match_evidence IS 
  'JSONB evidence explaining why this mapping was chosen (for audit/RCA)';

COMMENT ON COLUMN identity_migration_mapping.status IS 
  'Migration phase: planned → party_created → fk_migrated → verified → sealed';

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

-- Verify table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public' 
  AND table_name = 'identity_migration_mapping';

-- Verify constraints
SELECT 
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public' 
  AND table_name = 'identity_migration_mapping'
ORDER BY constraint_type, constraint_name;

-- Verify indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'identity_migration_mapping'
ORDER BY indexname;

-- ==============================================================================
-- END R1.1
-- ==============================================================================
