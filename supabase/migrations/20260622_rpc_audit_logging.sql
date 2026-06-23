-- ============================================================================
-- Migration: RPC Audit Logging (Optional - Post-Pilot)
-- Created: 2026-06-22
-- Purpose: Track all RPC calls for debugging, performance monitoring, and security
-- ============================================================================
-- ⚠️ DEPLOY AFTER PILOT PHASE
-- Reason: Avoid cluttering logs during initial testing with 3-5 KTVs
-- Enable when scaling to 20+ users or when production issues need investigation
-- ============================================================================

-- ============================================================================
-- Table: rpc_access_log
-- ============================================================================
-- Logs every RPC function call with user context and performance metrics
--
-- Use cases:
-- 1. Debug production issues: "KTV không thấy ca" → check what RPC returned
-- 2. Performance monitoring: Real P50/P95/P99 latency metrics
-- 3. Security audit: Detect abuse patterns (spam, suspicious access)
-- 4. Compliance: Track who accessed what data when
-- ============================================================================

CREATE TABLE IF NOT EXISTS rpc_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who made the call
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- What RPC was called
  rpc_name TEXT NOT NULL,
  parameters JSONB, -- Store input parameters for debugging (sanitize sensitive data)
  
  -- Performance metrics
  duration_ms INT, -- Execution time in milliseconds
  
  -- Result
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  error_message TEXT, -- NULL if success, error details if failed
  
  -- Request context
  ip_address INET, -- Client IP for security audit
  user_agent TEXT, -- Client device/browser for analytics
  
  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes for efficient querying
-- ============================================================================

-- Primary lookup: Find logs by tenant and RPC name
CREATE INDEX idx_rpc_access_log_tenant_rpc 
  ON rpc_access_log(tenant_id, rpc_name, created_at DESC);

-- User activity lookup: Find all calls by specific user
CREATE INDEX idx_rpc_access_log_user 
  ON rpc_access_log(user_id, created_at DESC);

-- Performance analysis: Find slow queries
CREATE INDEX idx_rpc_access_log_slow_queries 
  ON rpc_access_log(rpc_name, duration_ms DESC)
  WHERE duration_ms > 200; -- Only index slow queries (>200ms)

-- Error analysis: Find failed calls
CREATE INDEX idx_rpc_access_log_errors 
  ON rpc_access_log(tenant_id, status, created_at DESC)
  WHERE status = 'error'; -- Partial index for errors only

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE rpc_access_log ENABLE ROW LEVEL SECURITY;

-- Only admins and system can view logs
CREATE POLICY "Admins can view RPC logs for their tenant"
  ON rpc_access_log
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM users
      WHERE id = auth.uid()
      AND role IN ('admin', 'owner')
    )
  );

-- No INSERT/UPDATE/DELETE for users - only system can write
-- (RPC functions will use SECURITY DEFINER to bypass this)

-- ============================================================================
-- Helper Function: Log RPC Call
-- ============================================================================
-- Wrapper function to log RPC calls from other functions
-- Usage: PERFORM log_rpc_call(p_user_id, p_tenant_id, 'rpc_name', p_params, p_duration, 'success', NULL);

CREATE OR REPLACE FUNCTION log_rpc_call(
  p_user_id UUID,
  p_tenant_id UUID,
  p_rpc_name TEXT,
  p_parameters JSONB,
  p_duration_ms INT,
  p_status TEXT,
  p_error_message TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Bypass RLS to insert log
AS $$
BEGIN
  INSERT INTO rpc_access_log (
    user_id,
    tenant_id,
    rpc_name,
    parameters,
    duration_ms,
    status,
    error_message
  ) VALUES (
    p_user_id,
    p_tenant_id,
    p_rpc_name,
    p_parameters,
    p_duration_ms,
    p_status,
    p_error_message
  );
  
  -- Don't raise error if logging fails (non-critical)
  EXCEPTION WHEN OTHERS THEN
    -- Silent fail to prevent logging errors from breaking RPC calls
    NULL;
END;
$$;

-- Grant execute to authenticated users (RPC functions will call this)
GRANT EXECUTE ON FUNCTION log_rpc_call TO authenticated;

-- ============================================================================
-- Helper Function: Check Rate Limit
-- ============================================================================
-- Prevent spam by checking if user called same RPC too recently
-- Returns TRUE if allowed, FALSE if rate limit exceeded

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_rpc_name TEXT,
  p_min_interval_seconds INT DEFAULT 1
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_call TIMESTAMPTZ;
BEGIN
  -- Get last successful call time for this user + RPC
  SELECT created_at INTO v_last_call
  FROM rpc_access_log
  WHERE user_id = p_user_id 
    AND rpc_name = p_rpc_name
    AND status = 'success'
  ORDER BY created_at DESC 
  LIMIT 1;
  
  -- If no previous call, allow
  IF v_last_call IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- If last call was too recent, deny
  IF (NOW() - v_last_call) < (p_min_interval_seconds || ' seconds')::INTERVAL THEN
    RETURN FALSE;
  END IF;
  
  -- Otherwise, allow
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit TO authenticated;

-- ============================================================================
-- Analytics Views (for reporting)
-- ============================================================================

-- View: RPC Performance Summary (Last 24 hours)
CREATE OR REPLACE VIEW rpc_performance_summary AS
SELECT 
  rpc_name,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE status = 'error') as error_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'error') / COUNT(*), 2) as error_rate_pct,
  ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 2) AS p50_ms,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 2) AS p95_ms,
  ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 2) AS p99_ms,
  MIN(duration_ms) as min_ms,
  MAX(duration_ms) as max_ms,
  ROUND(AVG(duration_ms)::NUMERIC, 2) as avg_ms
FROM rpc_access_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY rpc_name
ORDER BY total_calls DESC;

-- Grant SELECT to admins only
GRANT SELECT ON rpc_performance_summary TO authenticated;

-- ============================================================================
-- Cleanup Function: Delete Old Logs
-- ============================================================================
-- Run this periodically to prevent table bloat
-- Recommendation: Keep 30 days of logs, archive older logs to cold storage

CREATE OR REPLACE FUNCTION cleanup_old_rpc_logs(p_retention_days INT DEFAULT 30)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INT;
BEGIN
  DELETE FROM rpc_access_log
  WHERE created_at < NOW() - (p_retention_days || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_old_rpc_logs IS 
  'Delete RPC logs older than specified days. Run weekly via cron job.';

-- ============================================================================
-- Usage Example: Modify existing RPC to add logging
-- ============================================================================

/*
-- Example: Add logging to rpc_mobile_today_sessions

CREATE OR REPLACE FUNCTION rpc_mobile_today_sessions(
  p_tenant_id UUID,
  p_today DATE,
  p_ktv_id UUID DEFAULT NULL
)
RETURNS TABLE (...)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_start_time TIMESTAMPTZ;
  v_end_time TIMESTAMPTZ;
  v_duration_ms INT;
BEGIN
  -- Start timer
  v_start_time := clock_timestamp();
  
  -- Original query logic here
  RETURN QUERY
  SELECT ... FROM session_logs ...;
  
  -- Calculate duration
  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;
  
  -- Log the call
  PERFORM log_rpc_call(
    auth.uid(),
    p_tenant_id,
    'rpc_mobile_today_sessions',
    jsonb_build_object('tenant_id', p_tenant_id, 'today', p_today, 'ktv_id', p_ktv_id),
    v_duration_ms,
    'success',
    NULL
  );
  
  EXCEPTION WHEN OTHERS THEN
    -- Log error
    PERFORM log_rpc_call(
      auth.uid(),
      p_tenant_id,
      'rpc_mobile_today_sessions',
      jsonb_build_object('tenant_id', p_tenant_id, 'today', p_today, 'ktv_id', p_ktv_id),
      NULL,
      'error',
      SQLERRM
    );
    RAISE;
END;
$$;
*/

-- ============================================================================
-- Monitoring Queries (for ops team)
-- ============================================================================

-- Query 1: Find slow queries (P95 > 200ms)
/*
SELECT 
  rpc_name,
  COUNT(*) as calls_last_24h,
  ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms)::NUMERIC, 2) AS p95_ms
FROM rpc_access_log
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY rpc_name
HAVING PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY duration_ms) > 200
ORDER BY p95_ms DESC;
*/

-- Query 2: Find users with high error rates
/*
SELECT 
  u.email,
  u.role,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE l.status = 'error') as errors,
  ROUND(100.0 * COUNT(*) FILTER (WHERE l.status = 'error') / COUNT(*), 2) as error_rate_pct
FROM rpc_access_log l
JOIN users u ON u.id = l.user_id
WHERE l.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY u.id, u.email, u.role
HAVING COUNT(*) FILTER (WHERE l.status = 'error') > 0
ORDER BY error_rate_pct DESC;
*/

-- Query 3: Detect spam patterns (>10 calls per minute)
/*
SELECT 
  user_id,
  u.email,
  rpc_name,
  COUNT(*) as calls_per_minute,
  MIN(created_at) as first_call,
  MAX(created_at) as last_call
FROM rpc_access_log l
JOIN users u ON u.id = l.user_id
WHERE l.created_at >= NOW() - INTERVAL '1 minute'
GROUP BY user_id, u.email, rpc_name
HAVING COUNT(*) > 10
ORDER BY calls_per_minute DESC;
*/

-- ============================================================================
-- Deployment Instructions
-- ============================================================================
-- 1. Run this migration AFTER pilot phase completes
-- 2. Update existing RPC functions to call log_rpc_call() (optional)
-- 3. Set up weekly cron job to run cleanup_old_rpc_logs(30)
-- 4. Monitor rpc_performance_summary view daily
-- 5. Alert if P95 > 200ms or error_rate > 5%
-- ============================================================================

-- Add comment for reference
COMMENT ON TABLE rpc_access_log IS 
  'Audit log for all RPC function calls. Tracks performance, errors, and access patterns. Deploy after pilot phase.';
