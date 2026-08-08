-- Migration: Create Capability Risk Registry Table
-- Date: 2026-08-08
-- Status: Authoritative / Frozen Schema

CREATE TABLE IF NOT EXISTS capability_risk_registry (
    capability_id VARCHAR(50) PRIMARY KEY,
    capability_name VARCHAR(255) NOT NULL,
    domain VARCHAR(100) NOT NULL,
    scale_factor INTEGER NOT NULL,
    clinical_criticality INTEGER NOT NULL,
    blast_radius INTEGER NOT NULL,
    risk_score INTEGER NOT NULL,
    calculated_tier VARCHAR(10) NOT NULL,
    override_rule VARCHAR(255) NOT NULL,
    final_tier VARCHAR(10) NOT NULL,
    rollout_policy VARCHAR(100) NOT NULL,
    safety_profile VARCHAR(100) NOT NULL,
    governance_status VARCHAR(50) NOT NULL,
    notes TEXT,
    source_document VARCHAR(255) NOT NULL,
    source_version VARCHAR(50) NOT NULL,
    generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    generated_from_hash VARCHAR(64) NOT NULL,
    matrix_signature TEXT NOT NULL,
    approved_by JSONB NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE NOT NULL,
    generator_version VARCHAR(50) NOT NULL
);

-- Comments to document columns
COMMENT ON TABLE capability_risk_registry IS 'Authoritative read-only derived registry for healthcare capability risk classification.';
COMMENT ON COLUMN capability_risk_registry.matrix_signature IS 'Cryptographic signature of the frozen matrix hash to verify provenance and authenticity.';

-- Trigger to enforce immutability (blocks UPDATE and DELETE for all roles)
CREATE OR REPLACE FUNCTION block_registry_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Capability Risk Registry is immutable. Modification of capability risk classification via direct SQL UPDATE, DELETE, or TRUNCATE is strictly prohibited by Platform Constitution Law 8 and Law 11.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_block_registry_mutation
BEFORE UPDATE OR DELETE ON capability_risk_registry
FOR EACH ROW
EXECUTE FUNCTION block_registry_mutation();

CREATE TRIGGER check_block_registry_truncate
BEFORE TRUNCATE ON capability_risk_registry
FOR EACH STATEMENT
EXECUTE FUNCTION block_registry_mutation();

-- Enable Row Level Security (RLS)
ALTER TABLE capability_risk_registry ENABLE ROW LEVEL SECURITY;

-- Select policy: Allow read access to everyone
CREATE POLICY "Allow read access to capability_risk_registry for all users"
ON capability_risk_registry
FOR SELECT
USING (true);
