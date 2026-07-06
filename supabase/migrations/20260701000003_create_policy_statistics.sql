-- Migration: Create Policy Statistics Table (Atomic Updates)
-- Version: 2.0 (Enterprise-Grade)
-- Date: July 1, 2026
-- Purpose: Decision statistics with atomic updates (no race conditions)

-- ============================================================================
-- 3. POLICY STATISTICS TABLE (ATOMIC UPDATES - NO RACE CONDITIONS)
-- ============================================================================

CREATE TABLE policy_statistics (
  -- Policy Reference (Composite Primary Key)
  policy_id TEXT NOT NULL,
  version TEXT NOT NULL,
  
  -- Decision Counters
  total_decisions INTEGER DEFAULT 0,
  total_approvals INTEGER DEFAULT 0,
  total_rejections INTEGER DEFAULT 0,
  
  -- Confidence Tracking (for average calculation)
  confidence_sum NUMERIC(12,2) DEFAULT 0, -- Sum of all confidence values
  confidence_count INTEGER DEFAULT 0, -- Count for average calculation
  
  -- Performance Metrics
  avg_latency_ms NUMERIC(10,2), -- Average decision latency
  p95_latency_ms NUMERIC(10,2), -- 95th percentile latency
  p99_latency_ms NUMERIC(10,2), -- 99th percentile latency
  
  -- Timestamps
  last_decision_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  PRIMARY KEY (policy_id, version),
  FOREIGN KEY (policy_id, version) REFERENCES policy_registry(policy_id, version) ON DELETE CASCADE,
  
  -- Validation
  CONSTRAINT valid_counts CHECK (
    total_decisions >= 0 
    AND total_approvals >= 0 
    AND total_rejections >= 0
    AND total_decisions = total_approvals + total_rejections
  ),
  CONSTRAINT valid_confidence CHECK (
    confidence_sum >= 0 
    AND confidence_count >= 0
  )
);

-- Performance Index
CREATE INDEX idx_policy_statistics_last_decision 
  ON policy_statistics(last_decision_at DESC);

CREATE INDEX idx_policy_statistics_total_decisions 
  ON policy_statistics(total_decisions DESC);

-- Table Comments
COMMENT ON TABLE policy_statistics IS 'Decision statistics with atomic updates to prevent race conditions';
COMMENT ON COLUMN policy_statistics.confidence_sum IS 'Sum of all confidence values for average calculation';
COMMENT ON COLUMN policy_statistics.confidence_count IS 'Count of decisions with confidence values';


-- ============================================================================
-- 4. ATOMIC STATISTICS INCREMENT FUNCTION (PREVENTS RACE CONDITIONS)
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_policy_statistics(
  p_policy_id TEXT,
  p_version TEXT,
  p_outcome TEXT, -- 'approve' or 'reject'
  p_confidence NUMERIC DEFAULT NULL,
  p_latency_ms NUMERIC DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Upsert statistics atomically (no race condition)
  INSERT INTO policy_statistics (
    policy_id,
    version,
    total_decisions,
    total_approvals,
    total_rejections,
    confidence_sum,
    confidence_count,
    last_decision_at,
    updated_at
  ) VALUES (
    p_policy_id,
    p_version,
    1,
    CASE WHEN p_outcome = 'approve' THEN 1 ELSE 0 END,
    CASE WHEN p_outcome = 'reject' THEN 1 ELSE 0 END,
    COALESCE(p_confidence, 0),
    CASE WHEN p_confidence IS NOT NULL THEN 1 ELSE 0 END,
    NOW(),
    NOW()
  )
  ON CONFLICT (policy_id, version) DO UPDATE SET
    total_decisions = policy_statistics.total_decisions + 1,
    total_approvals = policy_statistics.total_approvals + CASE WHEN p_outcome = 'approve' THEN 1 ELSE 0 END,
    total_rejections = policy_statistics.total_rejections + CASE WHEN p_outcome = 'reject' THEN 1 ELSE 0 END,
    confidence_sum = policy_statistics.confidence_sum + COALESCE(p_confidence, 0),
    confidence_count = policy_statistics.confidence_count + CASE WHEN p_confidence IS NOT NULL THEN 1 ELSE 0 END,
    last_decision_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION increment_policy_statistics IS 'Atomically increment policy statistics without race conditions (single atomic operation)';


-- ============================================================================
-- 5. HELPER FUNCTION: GET STATISTICS WITH CALCULATED FIELDS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_policy_statistics(
  p_policy_id TEXT,
  p_version TEXT DEFAULT NULL -- NULL = get active version
) RETURNS TABLE (
  policy_id TEXT,
  version TEXT,
  total_decisions INTEGER,
  total_approvals INTEGER,
  total_rejections INTEGER,
  approval_rate NUMERIC,
  rejection_rate NUMERIC,
  avg_confidence NUMERIC,
  last_decision_at TIMESTAMPTZ
) AS $$
BEGIN
  -- If version not specified, get active version
  IF p_version IS NULL THEN
    SELECT pr.version INTO p_version
    FROM policy_registry pr
    WHERE pr.policy_id = p_policy_id 
      AND pr.is_active = true 
      AND pr.deleted_at IS NULL;
    
    IF p_version IS NULL THEN
      RAISE EXCEPTION 'No active version found for policy: %', p_policy_id;
    END IF;
  END IF;
  
  -- Return statistics with calculated fields
  RETURN QUERY
  SELECT 
    ps.policy_id,
    ps.version,
    ps.total_decisions,
    ps.total_approvals,
    ps.total_rejections,
    CASE 
      WHEN ps.total_decisions > 0 
      THEN ROUND((ps.total_approvals::NUMERIC / ps.total_decisions) * 100, 2)
      ELSE 0
    END AS approval_rate,
    CASE 
      WHEN ps.total_decisions > 0 
      THEN ROUND((ps.total_rejections::NUMERIC / ps.total_decisions) * 100, 2)
      ELSE 0
    END AS rejection_rate,
    CASE 
      WHEN ps.confidence_count > 0 
      THEN ROUND(ps.confidence_sum / ps.confidence_count, 2)
      ELSE NULL
    END AS avg_confidence,
    ps.last_decision_at
  FROM policy_statistics ps
  WHERE ps.policy_id = p_policy_id AND ps.version = p_version;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_policy_statistics IS 'Get policy statistics with calculated approval rate and average confidence';
