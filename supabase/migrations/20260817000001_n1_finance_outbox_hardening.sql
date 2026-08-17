-- ============================================================================
-- N1 Failure Isolation: Finance Outbox Hardening
-- ============================================================================
-- Purpose: Enable async, durable Hospital → Finance event delivery
-- Scope: N1 only (do NOT modify F1-F4 Kernel)
-- Baseline: H1.1 PARTIAL PASS (G1-G7 ✅, N2 ✅, N3 ✅, N1 🟡)
-- ============================================================================

-- ============================================================================
-- PART 1: Extend finance_outbox_events schema
-- ============================================================================

-- Add retry logic columns
ALTER TABLE finance_outbox_events 
  ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Add lease/claim columns for worker concurrency control
ALTER TABLE finance_outbox_events
  ADD COLUMN IF NOT EXISTS claimed_by TEXT,
  ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ;

-- Add processed timestamp
ALTER TABLE finance_outbox_events
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- Update status constraint to include PROCESSING and PROCESSED
ALTER TABLE finance_outbox_events 
  DROP CONSTRAINT IF EXISTS finance_outbox_events_status_check;

ALTER TABLE finance_outbox_events
  ADD CONSTRAINT finance_outbox_events_status_check
  CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED', 'DISPATCHED'));

-- Change payload from TEXT to JSONB for structured event envelope
ALTER TABLE finance_outbox_events
  ALTER COLUMN payload TYPE JSONB USING payload::JSONB;

-- ============================================================================
-- PART 2: Indexes for worker performance
-- ============================================================================

-- Index for worker polling PENDING/FAILED events
DROP INDEX IF EXISTS idx_finance_outbox_pending;
CREATE INDEX idx_finance_outbox_pending 
  ON finance_outbox_events(status, tenant_id, next_retry_at) 
  WHERE status IN ('PENDING', 'FAILED');

-- Index for stale lease cleanup
CREATE INDEX IF NOT EXISTS idx_finance_outbox_stale_leases
  ON finance_outbox_events(status, lease_expires_at)
  WHERE status = 'PROCESSING';

-- Index for observability (processed events)
CREATE INDEX IF NOT EXISTS idx_finance_outbox_processed
  ON finance_outbox_events(tenant_id, processed_at)
  WHERE status = 'PROCESSED';

-- ============================================================================
-- PART 3: Worker Functions
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Function: claim_finance_outbox_batch
-- Purpose: Atomically claim a batch of PENDING/FAILED events for processing
-- Concurrency: Uses FOR UPDATE SKIP LOCKED to prevent duplicate processing
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_finance_outbox_batch(
  p_worker_id TEXT,
  p_lease_duration_seconds INT DEFAULT 60,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  event_type VARCHAR,
  payload JSONB,
  retry_count INT,
  event_id UUID
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH claimed AS (
    SELECT e.id
    FROM finance_outbox_events e
    WHERE (
      -- PENDING events ready to process
      (e.status = 'PENDING' AND e.next_retry_at <= NOW())
      OR 
      -- FAILED events eligible for retry
      (e.status = 'FAILED' AND e.retry_count < e.max_retries AND e.next_retry_at <= NOW())
    )
    -- Respect existing leases (not yet expired)
    AND (e.lease_expires_at IS NULL OR e.lease_expires_at < NOW())
    ORDER BY e.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED -- Critical: prevent concurrent workers from claiming same event
  )
  UPDATE finance_outbox_events e
  SET 
    status = 'PROCESSING',
    claimed_by = p_worker_id,
    claimed_at = NOW(),
    lease_expires_at = NOW() + (p_lease_duration_seconds || ' seconds')::INTERVAL,
    retry_count = e.retry_count + 1
  FROM claimed
  WHERE e.id = claimed.id
  RETURNING 
    e.id,
    e.tenant_id,
    e.event_type,
    e.payload,
    e.retry_count,
    e.event_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Function: mark_finance_outbox_processed
-- Purpose: Mark event as successfully processed
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_finance_outbox_processed(
  p_outbox_id UUID
)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE finance_outbox_events
  SET 
    status = 'PROCESSED',
    processed_at = NOW(),
    claimed_by = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL,
    last_error = NULL
  WHERE id = p_outbox_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Function: mark_finance_outbox_failed
-- Purpose: Mark event as failed, calculate next retry with exponential backoff
-- Strategy: 10s → 20s → 40s → 80s → 160s (max 5 retries by default)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION mark_finance_outbox_failed(
  p_outbox_id UUID,
  p_error TEXT
)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_retry_count INT;
  v_max_retries INT;
  v_next_status TEXT;
  v_backoff_seconds INT;
BEGIN
  -- Get current retry state
  SELECT retry_count, max_retries 
  INTO v_retry_count, v_max_retries
  FROM finance_outbox_events
  WHERE id = p_outbox_id;
  
  -- Determine next status
  IF v_retry_count >= v_max_retries THEN
    v_next_status := 'FAILED'; -- Permanent failure (DLQ)
  ELSE
    v_next_status := 'PENDING'; -- Retry eligible
  END IF;
  
  -- Calculate exponential backoff: 10 * 2^retry_count (capped at 1 hour)
  v_backoff_seconds := LEAST(10 * POWER(2, v_retry_count), 3600);
  
  -- Update event
  UPDATE finance_outbox_events
  SET 
    status = v_next_status,
    next_retry_at = NOW() + (v_backoff_seconds || ' seconds')::INTERVAL,
    last_error = p_error,
    claimed_by = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL
  WHERE id = p_outbox_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- Function: cleanup_stale_finance_outbox_leases
-- Purpose: Reset PROCESSING events with expired leases back to PENDING
-- Use case: Worker crash/restart recovery
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION cleanup_stale_finance_outbox_leases()
RETURNS INT 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_cleaned_count INT;
BEGIN
  UPDATE finance_outbox_events
  SET 
    status = 'PENDING',
    claimed_by = NULL,
    claimed_at = NULL,
    lease_expires_at = NULL
  WHERE status = 'PROCESSING' 
    AND lease_expires_at < NOW();
  
  GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
  
  RETURN v_cleaned_count;
END;
$$;

-- ============================================================================
-- PART 4: Observability View
-- ============================================================================

-- Finance Outbox Health Metrics (per tenant)
CREATE OR REPLACE VIEW finance_outbox_health_metrics AS
SELECT 
  tenant_id,
  COUNT(*) FILTER (WHERE status = 'PENDING') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'PROCESSING') AS processing_count,
  COUNT(*) FILTER (WHERE status = 'FAILED') AS failed_count,
  COUNT(*) FILTER (WHERE status = 'PROCESSED') AS processed_count,
  AVG(EXTRACT(EPOCH FROM (processed_at - created_at))) FILTER (WHERE status = 'PROCESSED') AS avg_processing_latency_seconds,
  MAX(created_at) FILTER (WHERE status = 'PENDING') AS oldest_pending_at
FROM finance_outbox_events
GROUP BY tenant_id;

-- ============================================================================
-- PART 5: Comments for audit trail
-- ============================================================================

COMMENT ON TABLE finance_outbox_events IS 'N1 Failure Isolation: Durable outbox for Hospital → Finance integration events';
COMMENT ON COLUMN finance_outbox_events.status IS 'PENDING → PROCESSING → PROCESSED/FAILED';
COMMENT ON COLUMN finance_outbox_events.claimed_by IS 'Worker ID holding lease';
COMMENT ON COLUMN finance_outbox_events.lease_expires_at IS 'Lease expiry for stale claim cleanup';
COMMENT ON COLUMN finance_outbox_events.next_retry_at IS 'Exponential backoff timestamp';
COMMENT ON FUNCTION claim_finance_outbox_batch IS 'N1: Atomically claim batch with lease (FOR UPDATE SKIP LOCKED)';
COMMENT ON FUNCTION mark_finance_outbox_processed IS 'N1: Mark event successfully delivered to Finance OS';
COMMENT ON FUNCTION mark_finance_outbox_failed IS 'N1: Mark event failed, calculate exponential backoff';
COMMENT ON FUNCTION cleanup_stale_finance_outbox_leases IS 'N1: Worker crash recovery - reset stale leases';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Next: Implement async worker + modify HospitalFinanceAdapter to use outbox
-- ============================================================================
