-- ============================================================================
-- QUICK START: Metrics Dashboard Setup (All-in-One)
-- ============================================================================
-- This script does EVERYTHING:
-- 1. Creates decision_engine_metrics table
-- 2. Creates RPC function
-- 3. Inserts 28 sample metrics
-- 4. Runs verification queries
--
-- HOW TO USE:
-- 1. Copy this ENTIRE file
-- 2. Paste into Supabase SQL Editor
-- 3. Click "Run"
-- 4. Open dashboard: http://localhost:3000/dashboard/admin/booking-engine
-- ============================================================================

-- ============================================================================
-- STEP 1: Get Tenant ID (Auto-detect)
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Get the first tenant (or use specific tenant if you know the ID)
  SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at DESC LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found! Please create a tenant first.';
  END IF;
  
  -- Store in session variable for use in later queries
  PERFORM set_config('app.test_tenant_id', v_tenant_id::TEXT, false);
  
  RAISE NOTICE '✅ Using Tenant ID: %', v_tenant_id;
END $$;

-- ============================================================================
-- STEP 2: Create Table (if not exists)
-- ============================================================================

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
    'cancellation',
    'payroll_kpi_bonus',
    'payroll_deduction',
    'payroll_commission',
    'discount_eligibility',
    'discount_calculation',
    'commission_calculation',
    'commission_tier',
    'inventory_reorder',
    'inventory_allocation',
    'inventory_expiry'
  )),
  
  -- Operation Result
  operation TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  outcome TEXT,
  
  -- Performance
  execution_time_ms NUMERIC(10, 2) NOT NULL,
  
  -- Context
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  ktv_id UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Additional Data
  metadata JSONB,
  
  -- Override Flags
  was_capacity_skipped BOOLEAN DEFAULT false,
  was_conflict_skipped BOOLEAN DEFAULT false,
  was_assignment_skipped BOOLEAN DEFAULT false,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decision_metrics_tenant_time ON decision_engine_metrics(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_metrics_provider ON decision_engine_metrics(provider_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_metrics_success ON decision_engine_metrics(success, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decision_metrics_booking ON decision_engine_metrics(booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_decision_metrics_created_at ON decision_engine_metrics(created_at DESC);

-- RLS
ALTER TABLE decision_engine_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant isolation for decision_engine_metrics" ON decision_engine_metrics;
CREATE POLICY "Tenant isolation for decision_engine_metrics" ON decision_engine_metrics
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

DROP POLICY IF EXISTS "Service role full access to decision_engine_metrics" ON decision_engine_metrics;
CREATE POLICY "Service role full access to decision_engine_metrics" ON decision_engine_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

RAISE NOTICE '✅ Table created: decision_engine_metrics';

-- ============================================================================
-- STEP 3: Create RPC Function
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
  -- Assignment Stats
  SELECT jsonb_build_object(
    'total_assignments', COUNT(*),
    'successful_assignments', COUNT(*) FILTER (WHERE success = true),
    'success_rate_percent', ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0), 1),
    'avg_confidence', ROUND(AVG((metadata->>'confidence')::NUMERIC) FILTER (WHERE metadata->>'confidence' IS NOT NULL), 2),
    'auto_assigned', COUNT(*) FILTER (WHERE was_assignment_skipped = false),
    'manual_assigned', COUNT(*) FILTER (WHERE was_assignment_skipped = true),
    'auto_assignment_rate_percent', ROUND(100.0 * COUNT(*) FILTER (WHERE was_assignment_skipped = false) / NULLIF(COUNT(*), 0), 1),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms), 1),
    'p95_execution_time_ms', ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 1),
    'p99_execution_time_ms', ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms), 1)
  ) INTO v_assignment_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id AND provider_type = 'auto_assignment' AND created_at BETWEEN p_start_date AND p_end_date;

  -- Conflict Stats
  SELECT jsonb_build_object(
    'total_checks', COUNT(*),
    'conflicts_detected', COUNT(*) FILTER (WHERE success = false OR (metadata->>'conflicts_count')::INT > 0),
    'conflict_rate_percent', ROUND(100.0 * COUNT(*) FILTER (WHERE success = false OR (metadata->>'conflicts_count')::INT > 0) / NULLIF(COUNT(*), 0), 1),
    'blocking_conflicts', COUNT(*) FILTER (WHERE metadata->>'severity' = 'blocking'),
    'warning_conflicts', COUNT(*) FILTER (WHERE metadata->>'severity' = 'warning'),
    'blocking_rate_percent', ROUND(100.0 * COUNT(*) FILTER (WHERE metadata->>'severity' = 'blocking') / NULLIF(COUNT(*), 0), 1),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms), 1),
    'top_conflict_types', (
      SELECT jsonb_agg(conflict_type_obj ORDER BY conflict_count DESC)
      FROM (
        SELECT jsonb_build_object('type', conflict_type, 'count', COUNT(*), 'percentage', ROUND(100.0 * COUNT(*) / NULLIF(SUM(COUNT(*)) OVER (), 0), 1)) AS conflict_type_obj, COUNT(*) AS conflict_count
        FROM decision_engine_metrics, jsonb_array_elements(metadata->'conflicts') AS conflict
        CROSS JOIN LATERAL jsonb_extract_path_text(conflict, 'type') AS conflict_type
        WHERE tenant_id = p_tenant_id AND provider_type = 'conflict_detection' AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY conflict_type LIMIT 5
      ) top_conflicts
    )
  ) INTO v_conflict_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id AND provider_type = 'conflict_detection' AND created_at BETWEEN p_start_date AND p_end_date;

  -- Capacity Stats
  SELECT jsonb_build_object(
    'total_checks', COUNT(*),
    'capacity_available', COUNT(*) FILTER (WHERE outcome = 'available'),
    'capacity_full', COUNT(*) FILTER (WHERE outcome = 'full'),
    'capacity_full_rate_percent', ROUND(100.0 * COUNT(*) FILTER (WHERE outcome = 'full') / NULLIF(COUNT(*), 0), 1),
    'avg_utilization_percent', ROUND(AVG((metadata->>'utilization_percent')::NUMERIC) FILTER (WHERE metadata->>'utilization_percent' IS NOT NULL), 1),
    'avg_buffer_used_percent', ROUND(AVG((metadata->>'buffer_used_percent')::NUMERIC) FILTER (WHERE metadata->>'buffer_used_percent' IS NOT NULL), 1),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms), 1)
  ) INTO v_capacity_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id AND provider_type = 'capacity_management' AND created_at BETWEEN p_start_date AND p_end_date;

  -- Performance Stats
  SELECT jsonb_build_object(
    'total_operations', COUNT(*),
    'avg_execution_time_ms', ROUND(AVG(execution_time_ms), 1),
    'median_execution_time_ms', ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY execution_time_ms), 1),
    'p95_execution_time_ms', ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms), 1),
    'p99_execution_time_ms', ROUND(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY execution_time_ms), 1),
    'max_execution_time_ms', ROUND(MAX(execution_time_ms), 1),
    'by_provider', (
      SELECT jsonb_object_agg(provider_type, jsonb_build_object('count', provider_count, 'avg_ms', ROUND(avg_ms, 1), 'p95_ms', ROUND(p95_ms, 1)))
      FROM (
        SELECT provider_type, COUNT(*) AS provider_count, AVG(execution_time_ms) AS avg_ms, PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY execution_time_ms) AS p95_ms
        FROM decision_engine_metrics
        WHERE tenant_id = p_tenant_id AND created_at BETWEEN p_start_date AND p_end_date
        GROUP BY provider_type
      ) provider_perf
    )
  ) INTO v_performance_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id AND created_at BETWEEN p_start_date AND p_end_date;

  -- Override Stats
  SELECT jsonb_build_object(
    'total_operations', COUNT(*),
    'capacity_skipped', COUNT(*) FILTER (WHERE was_capacity_skipped = true),
    'conflict_skipped', COUNT(*) FILTER (WHERE was_conflict_skipped = true),
    'assignment_skipped', COUNT(*) FILTER (WHERE was_assignment_skipped = true),
    'any_skip_used', COUNT(*) FILTER (WHERE was_capacity_skipped = true OR was_conflict_skipped = true OR was_assignment_skipped = true),
    'override_rate_percent', ROUND(100.0 * COUNT(*) FILTER (WHERE was_capacity_skipped = true OR was_conflict_skipped = true OR was_assignment_skipped = true) / NULLIF(COUNT(*), 0), 1)
  ) INTO v_override_stats
  FROM decision_engine_metrics
  WHERE tenant_id = p_tenant_id AND created_at BETWEEN p_start_date AND p_end_date;

  v_result := jsonb_build_object(
    'assignment', COALESCE(v_assignment_stats, '{}'::JSONB),
    'conflict', COALESCE(v_conflict_stats, '{}'::JSONB),
    'capacity', COALESCE(v_capacity_stats, '{}'::JSONB),
    'performance', COALESCE(v_performance_stats, '{}'::JSONB),
    'override', COALESCE(v_override_stats, '{}'::JSONB),
    'date_range', jsonb_build_object('start', p_start_date, 'end', p_end_date)
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_booking_engine_metrics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

RAISE NOTICE '✅ RPC function created: get_booking_engine_metrics';

-- ============================================================================
-- STEP 4: Insert Sample Metrics (28 records)
-- ============================================================================

-- Clean up any existing test data
DELETE FROM decision_engine_metrics WHERE tenant_id = current_setting('app.test_tenant_id')::UUID;

-- Insert Capacity Management metrics (9 records)
INSERT INTO decision_engine_metrics (tenant_id, provider_type, operation, success, outcome, execution_time_ms, metadata, was_capacity_skipped, was_conflict_skipped, was_assignment_skipped) VALUES
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', true, 'available', 0.4, '{"utilization_percent": 45, "buffer_used_percent": 5}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', true, 'available', 0.3, '{"utilization_percent": 50, "buffer_used_percent": 8}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', true, 'available', 0.5, '{"utilization_percent": 60, "buffer_used_percent": 12}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', true, 'available', 0.6, '{"utilization_percent": 70, "buffer_used_percent": 15}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', true, 'available', 0.4, '{"utilization_percent": 75, "buffer_used_percent": 18}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', true, 'available', 0.7, '{"utilization_percent": 85, "buffer_used_percent": 25}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', false, 'full', 0.5, '{"utilization_percent": 100, "buffer_used_percent": 90}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', false, 'full', 0.6, '{"utilization_percent": 95, "buffer_used_percent": 85}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'capacity_management', 'checkCapacity', true, 'available', 0.2, '{"utilization_percent": 100, "buffer_used_percent": 100}', true, false, false);

RAISE NOTICE '✅ Inserted 9 Capacity Management metrics';

-- Insert Conflict Detection metrics (10 records)
INSERT INTO decision_engine_metrics (tenant_id, provider_type, operation, success, outcome, execution_time_ms, metadata, was_capacity_skipped, was_conflict_skipped, was_assignment_skipped) VALUES
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.6, '{"conflicts_count": 0, "severity": "none"}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.7, '{"conflicts_count": 0, "severity": "none"}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.5, '{"conflicts_count": 0, "severity": "none"}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.8, '{"conflicts_count": 0, "severity": "none"}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', true, 'conflict_warning', 0.9, '{"conflicts_count": 1, "severity": "warning", "blocking_conflicts": 0, "warning_conflicts": 1, "conflicts": [{"type": "customer_close_bookings", "severity": "warning"}]}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', true, 'conflict_warning', 0.7, '{"conflicts_count": 1, "severity": "warning", "blocking_conflicts": 0, "warning_conflicts": 1, "conflicts": [{"type": "room_turnover_time", "severity": "warning"}]}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', false, 'conflict_blocking', 0.8, '{"conflicts_count": 1, "severity": "blocking", "blocking_conflicts": 1, "warning_conflicts": 0, "conflicts": [{"type": "customer_double_booking", "severity": "blocking"}]}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', false, 'conflict_blocking', 1.0, '{"conflicts_count": 1, "severity": "blocking", "blocking_conflicts": 1, "warning_conflicts": 0, "conflicts": [{"type": "room_unavailable", "severity": "blocking"}]}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', false, 'conflict_blocking', 1.2, '{"conflicts_count": 2, "severity": "blocking", "blocking_conflicts": 2, "warning_conflicts": 0, "conflicts": [{"type": "customer_double_booking", "severity": "blocking"}, {"type": "equipment_unavailable", "severity": "blocking"}]}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'conflict_detection', 'detectConflicts', true, 'no_conflicts', 0.1, '{"conflicts_count": 0, "severity": "none"}', false, true, false);

RAISE NOTICE '✅ Inserted 10 Conflict Detection metrics';

-- Insert Auto Assignment metrics (9 records)
INSERT INTO decision_engine_metrics (tenant_id, provider_type, operation, success, outcome, execution_time_ms, metadata, was_capacity_skipped, was_conflict_skipped, was_assignment_skipped) VALUES
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'assigned', 1.8, '{"confidence": 0.92, "assigned_ktv_id": "ktv-001", "alternatives_count": 5}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'assigned', 2.1, '{"confidence": 0.85, "assigned_ktv_id": "ktv-002", "alternatives_count": 6}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'assigned', 1.5, '{"confidence": 0.88, "assigned_ktv_id": "ktv-003", "alternatives_count": 4}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'assigned', 2.3, '{"confidence": 0.75, "assigned_ktv_id": "ktv-004", "alternatives_count": 8}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'assigned', 1.9, '{"confidence": 0.78, "assigned_ktv_id": "ktv-005", "alternatives_count": 7}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'assigned', 1.2, '{"confidence": 0.95, "assigned_ktv_id": "ktv-preferred", "alternatives_count": 3}', false, false, false),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'manual', 0.2, '{"confidence": null, "assigned_ktv_id": null, "alternatives_count": 0}', false, false, true),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', true, 'manual', 0.3, '{"confidence": null, "assigned_ktv_id": null, "alternatives_count": 0}', false, false, true),
  (current_setting('app.test_tenant_id')::UUID, 'auto_assignment', 'assignKtv', false, 'no_assignment', 1.5, '{"confidence": 0, "assigned_ktv_id": null, "alternatives_count": 0}', false, false, false);

RAISE NOTICE '✅ Inserted 9 Auto Assignment metrics';
RAISE NOTICE '✅ Total inserted: 28 metrics';

-- ============================================================================
-- STEP 5: Verification Queries
-- ============================================================================

RAISE NOTICE '';
RAISE NOTICE '📊 VERIFICATION RESULTS:';
RAISE NOTICE '═══════════════════════════════════════════════';

-- Count by provider
DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '1️⃣  Metrics by Provider Type:';
  FOR rec IN 
    SELECT 
      provider_type,
      COUNT(*) AS total,
      ROUND(AVG(execution_time_ms), 1) AS avg_time,
      COUNT(*) FILTER (WHERE success = true) AS successful
    FROM decision_engine_metrics
    WHERE tenant_id = current_setting('app.test_tenant_id')::UUID
    GROUP BY provider_type
    ORDER BY provider_type
  LOOP
    RAISE NOTICE '   • % : % ops, %.1ms avg, % successful', 
      rec.provider_type, rec.total, rec.avg_time, rec.successful;
  END LOOP;
END $$;

-- Assignment stats
DO $$
DECLARE
  v_total INT;
  v_auto INT;
  v_manual INT;
  v_confidence NUMERIC;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'assigned'),
    COUNT(*) FILTER (WHERE outcome = 'manual'),
    ROUND(AVG((metadata->>'confidence')::NUMERIC), 2)
  INTO v_total, v_auto, v_manual, v_confidence
  FROM decision_engine_metrics
  WHERE tenant_id = current_setting('app.test_tenant_id')::UUID
    AND provider_type = 'auto_assignment';
    
  RAISE NOTICE '';
  RAISE NOTICE '2️⃣  Assignment Stats:';
  RAISE NOTICE '   • Total: %, Auto: %, Manual: %, Avg Confidence: %', 
    v_total, v_auto, v_manual, v_confidence;
END $$;

-- Conflict stats
DO $$
DECLARE
  v_total INT;
  v_clean INT;
  v_blocking INT;
  v_rate NUMERIC;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'no_conflicts'),
    COUNT(*) FILTER (WHERE outcome LIKE '%blocking%'),
    ROUND(100.0 * COUNT(*) FILTER (WHERE outcome LIKE '%blocking%') / NULLIF(COUNT(*), 0), 1)
  INTO v_total, v_clean, v_blocking, v_rate
  FROM decision_engine_metrics
  WHERE tenant_id = current_setting('app.test_tenant_id')::UUID
    AND provider_type = 'conflict_detection';
    
  RAISE NOTICE '';
  RAISE NOTICE '3️⃣  Conflict Stats:';
  RAISE NOTICE '   • Total: %, No Conflicts: %, Blocking: %, Rate: %%', 
    v_total, v_clean, v_blocking, v_rate;
END $$;

-- Capacity stats
DO $$
DECLARE
  v_total INT;
  v_available INT;
  v_full INT;
  v_rate NUMERIC;
BEGIN
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'available'),
    COUNT(*) FILTER (WHERE outcome = 'full'),
    ROUND(100.0 * COUNT(*) FILTER (WHERE outcome = 'full') / NULLIF(COUNT(*), 0), 1)
  INTO v_total, v_available, v_full, v_rate
  FROM decision_engine_metrics
  WHERE tenant_id = current_setting('app.test_tenant_id')::UUID
    AND provider_type = 'capacity_management';
    
  RAISE NOTICE '';
  RAISE NOTICE '4️⃣  Capacity Stats:';
  RAISE NOTICE '   • Total: %, Available: %, Full: %, Full Rate: %%', 
    v_total, v_available, v_full, v_rate;
END $$;

-- Override stats
DO $$
DECLARE
  v_capacity INT;
  v_conflict INT;
  v_assignment INT;
  v_total INT;
BEGIN
  SELECT 
    COUNT(*) FILTER (WHERE was_capacity_skipped = true),
    COUNT(*) FILTER (WHERE was_conflict_skipped = true),
    COUNT(*) FILTER (WHERE was_assignment_skipped = true),
    COUNT(*)
  INTO v_capacity, v_conflict, v_assignment, v_total
  FROM decision_engine_metrics
  WHERE tenant_id = current_setting('app.test_tenant_id')::UUID;
    
  RAISE NOTICE '';
  RAISE NOTICE '5️⃣  Manager Overrides:';
  RAISE NOTICE '   • Capacity: %, Conflict: %, Assignment: % (Total ops: %)', 
    v_capacity, v_conflict, v_assignment, v_total;
END $$;

RAISE NOTICE '';
RAISE NOTICE '═══════════════════════════════════════════════';
RAISE NOTICE '✅ ALL DONE! Open dashboard to see metrics:';
RAISE NOTICE '   👉 http://localhost:3000/dashboard/admin/booking-engine';
RAISE NOTICE '';
RAISE NOTICE '📝 Expected Dashboard Values:';
RAISE NOTICE '   • Assignment Success: ~88.9%';
RAISE NOTICE '   • Auto-Assignment Rate: ~66.7%';
RAISE NOTICE '   • Conflict Rate: ~40.0%';
RAISE NOTICE '   • Capacity Full: ~22.2%';
RAISE NOTICE '   • Avg Performance: ~0.9ms';
RAISE NOTICE '═══════════════════════════════════════════════';
