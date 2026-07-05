-- Gate 3 Monitoring Snapshots Table
-- Stores health check snapshots collected every 5 minutes for 72 hours

CREATE TABLE IF NOT EXISTS gate3_monitoring_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Health status
  status TEXT NOT NULL, -- 'healthy', 'degraded', 'unhealthy'
  
  -- Queue metrics
  queue_depth INTEGER NOT NULL DEFAULT 0,
  queue_failed INTEGER NOT NULL DEFAULT 0,
  dlq_size INTEGER NOT NULL DEFAULT 0,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  
  -- Circuit breaker
  circuit_breaker_state TEXT NOT NULL DEFAULT 'unknown', -- 'CLOSED', 'OPEN', 'HALF_OPEN', 'unknown'
  
  -- Raw health data (for debugging)
  raw_health_data JSONB,
  
  -- Indexes
  CONSTRAINT gate3_monitoring_snapshots_timestamp_key UNIQUE (timestamp)
);

-- Index for time-series queries
CREATE INDEX IF NOT EXISTS idx_gate3_snapshots_timestamp 
  ON gate3_monitoring_snapshots(timestamp DESC);

-- Index for circuit breaker alerts
CREATE INDEX IF NOT EXISTS idx_gate3_snapshots_circuit_state 
  ON gate3_monitoring_snapshots(circuit_breaker_state);

-- Comments
COMMENT ON TABLE gate3_monitoring_snapshots IS 'Gate 3: 72-hour operational stability monitoring snapshots';
COMMENT ON COLUMN gate3_monitoring_snapshots.timestamp IS 'Snapshot collection time';
COMMENT ON COLUMN gate3_monitoring_snapshots.status IS 'Overall health status from /api/decision-engine/health';
COMMENT ON COLUMN gate3_monitoring_snapshots.queue_depth IS 'Number of pending audit logs in queue';
COMMENT ON COLUMN gate3_monitoring_snapshots.dlq_size IS 'Number of items in dead letter queue';
COMMENT ON COLUMN gate3_monitoring_snapshots.circuit_breaker_state IS 'Circuit breaker state (CLOSED = healthy)';

-- Row-level security (optional - allow read for admins only)
ALTER TABLE gate3_monitoring_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can view Gate 3 monitoring snapshots"
  ON gate3_monitoring_snapshots
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Allow Supabase service role to insert (from cron job)
CREATE POLICY "Service role can insert Gate 3 snapshots"
  ON gate3_monitoring_snapshots
  FOR INSERT
  WITH CHECK (true); -- Service role bypasses RLS anyway
