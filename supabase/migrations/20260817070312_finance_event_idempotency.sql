-- F5.6 Finance OS — Finance Event Idempotency Store
--
-- Ensures exactly-once processing of finance events from Vertical OS
--
-- Critical Constraints:
-- 1. UNIQUE(idempotency_key) — atomic claim
-- 2. UNIQUE(event_id) — one event → one transaction
-- 3. Index on tenant_id for tenant isolation verification

CREATE TABLE IF NOT EXISTS finance_event_idempotency (
  -- Primary key
  idempotency_key TEXT PRIMARY KEY,
  
  -- Event tracking
  event_id TEXT NOT NULL UNIQUE,
  transaction_id UUID NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('PROCESSING', 'COMPLETED', 'FAILED')),
  
  -- Tenant isolation
  tenant_id UUID NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Index for tenant isolation queries
CREATE INDEX idx_finance_idempotency_tenant ON finance_event_idempotency(tenant_id);

-- Index for event lookup
CREATE INDEX idx_finance_idempotency_event ON finance_event_idempotency(event_id);

-- Updated_at trigger
CREATE TRIGGER set_finance_idempotency_updated_at
  BEFORE UPDATE ON finance_event_idempotency
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Policies
ALTER TABLE finance_event_idempotency ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (Finance OS operations)
CREATE POLICY "Service role full access"
  ON finance_event_idempotency
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comment
COMMENT ON TABLE finance_event_idempotency IS 'Finance OS idempotency store - ensures exactly-once event processing';
COMMENT ON COLUMN finance_event_idempotency.idempotency_key IS 'Client-provided idempotency key (PRIMARY KEY)';
COMMENT ON COLUMN finance_event_idempotency.event_id IS 'Source event ID (UNIQUE constraint)';
COMMENT ON COLUMN finance_event_idempotency.transaction_id IS 'F1-F4 Kernel journal entry ID';
COMMENT ON COLUMN finance_event_idempotency.status IS 'Processing status: PROCESSING, COMPLETED, FAILED';
