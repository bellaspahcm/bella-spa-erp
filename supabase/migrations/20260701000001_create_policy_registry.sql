-- Migration: Create Policy Registry (Multi-Version Support)
-- Version: 2.0 (Enterprise-Grade)
-- Date: July 1, 2026
-- Purpose: Centralized policy management with versioning, governance, and audit trail

-- ============================================================================
-- 1. MAIN POLICY REGISTRY TABLE (MULTI-VERSION SUPPORT)
-- ============================================================================

CREATE TABLE policy_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Policy Identification (Composite Key)
  policy_id TEXT NOT NULL, -- Policy family ID (e.g., "leave-approval")
  version TEXT NOT NULL, -- Semver version (e.g., "1.0.0", "1.1.0", "2.0.0")
  
  -- Basic Info
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT, -- 'leave', 'booking', 'pricing', 'payroll'
  tenant_id UUID REFERENCES tenants(id),
  
  -- Multi-Version Management
  is_active BOOLEAN DEFAULT FALSE, -- Only one version can be active per policy
  parent_version TEXT, -- Previous version for lineage tracking (e.g., "1.0.0")
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id),
  published_at TIMESTAMPTZ,
  published_by UUID REFERENCES profiles(id),
  deprecated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  
  -- Soft Delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES profiles(id),
  
  -- Governance Fields (Enterprise Audit Requirements)
  owner_department TEXT, -- 'HR', 'Finance', 'Operations'
  business_owner TEXT,
  business_owner_email TEXT,
  technical_owner TEXT,
  technical_owner_email TEXT,
  review_date DATE, -- Next scheduled review
  effective_date DATE, -- When policy takes effect
  expire_date DATE, -- When policy expires
  
  -- Configuration (Use sparingly - prefer columns for important fields)
  config JSONB, -- Policy-specific configuration
  metadata JSONB, -- Tags, documentation, etc.
  
  -- Constraints
  CONSTRAINT pk_policy_version UNIQUE (policy_id, version),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'active', 'deprecated', 'archived')),
  CONSTRAINT valid_version CHECK (version ~ '^\d+\.\d+\.\d+$'), -- Semver format: "1.0.0"
  CONSTRAINT valid_email_business CHECK (
    business_owner_email ~ '^[^@]+@[^@]+\.[^@]+$' 
    OR business_owner_email IS NULL
  ),
  CONSTRAINT valid_email_technical CHECK (
    technical_owner_email ~ '^[^@]+@[^@]+\.[^@]+$' 
    OR technical_owner_email IS NULL
  )
);

-- Only one active version per policy (uses GiST exclusion constraint)
CREATE UNIQUE INDEX idx_policy_registry_one_active 
  ON policy_registry (policy_id) 
  WHERE is_active = true AND deleted_at IS NULL;

-- Performance Indexes
CREATE INDEX idx_policy_registry_policy_id 
  ON policy_registry(policy_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_policy_registry_status 
  ON policy_registry(status) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_policy_registry_tenant 
  ON policy_registry(tenant_id) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_policy_registry_category 
  ON policy_registry(category) 
  WHERE deleted_at IS NULL;

CREATE INDEX idx_policy_registry_review_date 
  ON policy_registry(review_date) 
  WHERE deleted_at IS NULL AND review_date IS NOT NULL;

CREATE INDEX idx_policy_registry_expire_date 
  ON policy_registry(expire_date) 
  WHERE deleted_at IS NULL AND expire_date IS NOT NULL;

-- Table Comments
COMMENT ON TABLE policy_registry IS 'Centralized policy management with multi-version support';
COMMENT ON COLUMN policy_registry.policy_id IS 'Policy family ID - same across all versions';
COMMENT ON COLUMN policy_registry.version IS 'Semver version (e.g., "1.0.0", "1.1.0", "2.0.0")';
COMMENT ON COLUMN policy_registry.is_active IS 'Only one version can be active per policy';
COMMENT ON COLUMN policy_registry.parent_version IS 'Previous version for lineage tracking';
