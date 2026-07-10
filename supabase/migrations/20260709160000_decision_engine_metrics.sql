-- ============================================================================
-- Decision Engine Metrics Table
-- ============================================================================
-- Tracks provider execution metrics for observability dashboard
-- Lightweight: Only essential metrics, no full event logs

CREATE TABLE IF NOT EXISTS decision_engine_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Provider Info
  provider_type TEXT NOT NULL CHECK (provider_type IN (
    'capacity_management',
    'auto_assignment',
    'conflict_detection',
    'waitlist',
    'pricing',
    'cancellation'
  )),
  
  -- Operation Result
  operation TEXT NOT NULL, -- e.g., 'checkCapacity', 'assignKtv', 'detectConflicts'
  success BOOLEAN NOT NULL,
  outcome TEXT, -- e.g., 'available', 'full', 'assigned', 'conflict_blocked'
  
  -- Performance
  execution_time_ms NUMERIC(10, 2) NOT NULL,
  
  -- Context (for filtering)
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ktv_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Additional Data (JSONB for flexibility)
  metadata JSONB, -- e.g., { "conflicts": 2, "alternatives": 3, "confidence": 0.85 }
  
  -- Override Flags
  was_capacity_skipped BOOLEAN DEFAULT false,
  was_conflict_skipped BOOLEAN DEFAULT false,
  was_assignment_skipped BOOLEAN DEFAULT false,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_decision_metrics_tenant_time ON decision_engine_metrics(tenant_id, created_at DESC);
CREATE INDEX idx_decision_metrics_provider ON decision_engine_metrics(provider_type, created_at DESC);
CREATE INDEX idx_decision_metrics_success ON decision_engine_metrics(success, created_at DESC);
CREATE INDEX idx_decision_metrics_booking ON decision_engine_metrics(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX idx_decision_metrics_created_at ON decision_engine_metrics(created_at DESC);

-- RLS Policies
ALTER TABLE decision_engine_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for decision_engine_metrics" ON decision_engine_metrics
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY "Service role full access to decision_engine_metrics" ON decision_engine_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- RPC: Get Booking Engine Dashboard Metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_booking_engine_metrics(
  p_tenant_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
  v_assignment_stats JSONB;
  v_conflict_stats JSONB;
  v_capacity_stats JSONB;
  v_performance_stats JSONB;
  v_override_stats JSONB;
BEGIN
  -- ========================================
  -- 1. Assignment Stats
  -- ========================================
  SELECT jsonb_build_object(
    'total_assignments', COUNT(*),
    'successful_assignments', COUNT(*) FILTER (WHERE success = true),
    'success_rate_percent', ROUND(
      (100.0 * COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0))::NUMERIC,
      1
    ),
    'avg_confidence', ROUND(
      AVG((metadata->>'confidence')::NUMERIC) FILTER (WHERE metadata->>'confidence' IS NOT NULL),
      2
    ),
    'auto_assigned', COUNT(*) FILTER (WHERE was_assignment_skipped = false),
    'manual_assigned', COUNT(*) FILTER (WHERE was_assignment_skipped = true),
    'auto_assignment_rate_percent', ROUND(
      (100.0 * COUNT(*) FILTER (WHERE was_assignment_skipped = false) / NULLIF(COUNT(*), 0))::NUMERIC,
      1
    ),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms)::NUMERIC, 1),
    'p95_execution_time_ms', ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms))::NUMERIC, 1),
    'p99_execution_time_ms', ROUND((PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms))::NUMERIC, 1)
  ) INTO v_assignment_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id
    AND provider_type = 'auto_assignment'
    AND created_at BETWEEN p_start_date AND p_end_date;

  -- ========================================
  -- 2. Conflict Stats
  -- ========================================
  SELECT jsonb_build_object(
    'total_checks', COUNT(*),
    'conflicts_detected', COUNT(*) FILTER (WHERE success = false OR (metadata->>'conflicts_count')::INT > 0),
    'conflict_rate_percent', ROUND(
      (100.0 * COUNT(*) FILTER (WHERE success = false OR (metadata->>'conflicts_count')::INT > 0) / NULLIF(COUNT(*), 0))::NUMERIC,
      1
    ),
    'blocking_conflicts', COUNT(*) FILTER (WHERE metadata->>'severity' = 'blocking'),
    'warning_conflicts', COUNT(*) FILTER (WHERE metadata->>'severity' = 'warning'),
    'blocking_rate_percent', ROUND(
      (100.0 * COUNT(*) FILTER (WHERE metadata->>'severity' = 'blocking') / NULLIF(COUNT(*), 0))::NUMERIC,
      1
    ),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms)::NUMERIC, 1),
    'top_conflict_types', (
      SELECT jsonb_agg(conflict_type_obj ORDER BY conflict_count DESC)
      FROM (
        SELECT 
          jsonb_build_object(
            'type', conflict_type,
            'count', COUNT(*),
            'percentage', ROUND((100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0))::NUMERIC, 1)
          ) AS conflict_type_obj,
          COUNT(*) AS conflict_count
        FROM decision_engine_metrics,
        jsonb_array_elements(metadata->'conflicts') AS conflict
        CROSS JOIN LATERAL jsonb_extract_path_text(conflict, 'type') AS conflict_type
        WHERE tenant_id = p_tenant_id
          AND provider_type = 'conflict_detection'
          AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY conflict_type
        LIMIT 5
      ) top_conflicts
    )
  ) INTO v_conflict_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id
    AND provider_type = 'conflict_detection'
    AND created_at BETWEEN p_start_date AND p_end_date;

  -- ========================================
  -- 3. Capacity Stats
  -- ========================================
  SELECT jsonb_build_object(
    'total_checks', COUNT(*),
    'capacity_available', COUNT(*) FILTER (WHERE outcome = 'available'),
    'capacity_full', COUNT(*) FILTER (WHERE outcome = 'full'),
    'capacity_full_rate_percent', ROUND(
      (100.0 * COUNT(*) FILTER (WHERE outcome = 'full') / NULLIF(COUNT(*), 0))::NUMERIC,
      1
    ),
    'avg_utilization_percent', ROUND(
      AVG((metadata->>'utilization_percent')::NUMERIC) FILTER (WHERE metadata->>'utilization_percent' IS NOT NULL),
      1
    ),
    'avg_buffer_used_percent', ROUND(
      AVG((metadata->>'buffer_used_percent')::NUMERIC) FILTER (WHERE metadata->>'buffer_used_percent' IS NOT NULL),
      1
    ),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms)::NUMERIC, 1)
  ) INTO v_capacity_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id
    AND provider_type = 'capacity_management'
    AND created_at BETWEEN p_start_date AND p_end_date;

  -- ========================================
  -- 4. Performance Stats
  -- ========================================
  SELECT jsonb_build_object(
    'total_operations', COUNT(*),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms)::NUMERIC, 1),
    'median_execution_time_ms', ROUND((PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms))::NUMERIC, 1),
    'p95_execution_time_ms', ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms))::NUMERIC, 1),
    'p99_execution_time_ms', ROUND((PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms))::NUMERIC, 1),
    'max_execution_time_ms', ROUND(MAX(execution_time_ms)::NUMERIC, 1),
    'by_provider', (
      SELECT jsonb_object_agg(
        provider_type,
        jsonb_build_object(
          'count', provider_count,
          'avg_ms', ROUND(avg_ms::NUMERIC, 1),
          'p95_ms', ROUND(p95_ms::NUMERIC, 1)
        )
      )
      FROM (
        SELECT
          provider_type,
          COUNT(*) AS provider_count,
          AVG(execution_time_ms) AS avg_ms,
          PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) AS p95_ms
        FROM decision_engine_metrics
        WHERE tenant_id = p_tenant_id
          AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY provider_type
      ) provider_perf
    )
  ) INTO v_performance_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id
    AND created_at BETWEEN p_start_date AND p_end_date;

  -- ========================================
  -- 5. Override Stats
  -- ========================================
  SELECT jsonb_build_object(
    'total_operations', COUNT(*),
    'capacity_skipped', COUNT(*) FILTER (WHERE was_capacity_skipped = true),
    'conflict_skipped', COUNT(*) FILTER (WHERE was_conflict_skipped = true),
    'assignment_skipped', COUNT(*) FILTER (WHERE was_assignment_skipped = true),
    'any_skip_used', COUNT(*) FILTER (
      WHERE was_capacity_skipped = true 
         OR was_conflict_skipped = true 
         OR was_assignment_skipped = true
    ),
    'override_rate_percent', ROUND(
      100.0 * COUNT(*) FILTER (
        WHERE was_capacity_skipped = true 
           OR was_conflict_skipped = true 
           OR was_assignment_skipped = true
      ) / NULLIF(COUNT(*), 0),
      1
    )
  ) INTO v_override_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id
    AND created_at BETWEEN p_start_date AND p_end_date;

  -- ========================================
  -- Combine all stats
  -- ========================================
  v_result := jsonb_build_object(
    'assignment', COALESCE(v_assignment_stats, '{}'::JSONB),
    'conflict', COALESCE(v_conflict_stats, '{}'::JSONB),
    'capacity', COALESCE(v_capacity_stats, '{}'::JSONB),
    'performance', COALESCE(v_performance_stats, '{}'::JSONB),
    'override', COALESCE(v_override_stats, '{}'::JSONB),
    'date_range', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_booking_engine_metrics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE decision_engine_metrics IS 'Lightweight metrics tracking for Decision Engine providers. Used for observability dashboard.';
COMMENT ON FUNCTION get_booking_engine_metrics IS 'Aggregates Decision Engine metrics for dashboard. Returns assignment, conflict, capacity, performance, and override stats.';
