-- Deployment Provenance Schema
-- 
-- Immutable audit trail of all migration deployments
-- Records evidence of governance enforcement

CREATE SCHEMA IF NOT EXISTS deployment;

-- Provenance table (append-only, no updates/deletes)
CREATE TABLE IF NOT EXISTS deployment.provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Migration identity
  migration_version TEXT NOT NULL,
  migration_name TEXT NOT NULL,
  file_checksum TEXT NOT NULL, -- SHA-256
  git_commit_sha TEXT NOT NULL,
  
  -- Execution metadata
  executor TEXT NOT NULL CHECK (executor = 'deployment_engine'),
  executed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  execution_duration_ms INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('SUCCESS', 'FAILED', 'ROLLED_BACK')),
  
  -- Evidence (JSON)
  preflight_evidence JSONB NOT NULL,
  execution_evidence JSONB NOT NULL,
  verification_evidence JSONB NOT NULL,
  
  -- Provenance metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_provenance_migration_version 
  ON deployment.provenance(migration_version);

CREATE INDEX IF NOT EXISTS idx_provenance_executed_at 
  ON deployment.provenance(executed_at DESC);

CREATE INDEX IF NOT EXISTS idx_provenance_result 
  ON deployment.provenance(result);

-- Enable RLS (provenance is read-only for most users)
ALTER TABLE deployment.provenance ENABLE ROW LEVEL SECURITY;

-- Policy: Deployment engine can INSERT
CREATE POLICY provenance_insert_policy ON deployment.provenance
  FOR INSERT
  WITH CHECK (executor = 'deployment_engine');

-- Policy: All authenticated users can read
CREATE POLICY provenance_read_policy ON deployment.provenance
  FOR SELECT
  USING (true);

-- Prevent updates and deletes (immutable)
CREATE POLICY provenance_no_update ON deployment.provenance
  FOR UPDATE
  USING (false);

CREATE POLICY provenance_no_delete ON deployment.provenance
  FOR DELETE
  USING (false);

-- Provenance query views
CREATE OR REPLACE VIEW deployment.recent_deployments AS
SELECT 
  migration_version,
  migration_name,
  executor,
  executed_at,
  execution_duration_ms,
  result
FROM deployment.provenance
ORDER BY executed_at DESC
LIMIT 50;

CREATE OR REPLACE VIEW deployment.failed_deployments AS
SELECT 
  migration_version,
  migration_name,
  executed_at,
  execution_duration_ms,
  verification_evidence->>'pass' as verification_passed,
  preflight_evidence
FROM deployment.provenance
WHERE result IN ('FAILED', 'ROLLED_BACK')
ORDER BY executed_at DESC;

-- Provenance integrity check
CREATE OR REPLACE FUNCTION deployment.verify_provenance_integrity()
RETURNS TABLE (
  migration_version TEXT,
  integrity_status TEXT,
  issue TEXT
) AS $$
BEGIN
  -- Check 1: All migrations in schema_migrations have provenance
  RETURN QUERY
  SELECT 
    sm.version as migration_version,
    'MISSING_PROVENANCE' as integrity_status,
    'Migration in schema_migrations but no provenance record' as issue
  FROM supabase_migrations.schema_migrations sm
  LEFT JOIN deployment.provenance p ON p.migration_version = sm.version
  WHERE p.id IS NULL
    AND sm.version > '20260823010000'; -- E7 baseline exempt
  
  -- Check 2: Checksum matches file
  -- (This would require file system access)
  
  -- Check 3: All provenance records have SUCCESS result
  RETURN QUERY
  SELECT 
    migration_version,
    'FAILED_DEPLOYMENT' as integrity_status,
    'Deployment failed or rolled back' as issue
  FROM deployment.provenance
  WHERE result != 'SUCCESS';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON TABLE deployment.provenance IS 
  'Immutable audit trail of migration deployments. ' ||
  'Records complete evidence of governance enforcement.';

COMMENT ON FUNCTION deployment.verify_provenance_integrity() IS
  'Checks integrity of deployment provenance records';
