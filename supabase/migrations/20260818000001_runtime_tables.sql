-- Common Integration Runtime — Database Schema v1.0
-- Date: 2026-08-18
-- Architecture: Runtime Architecture v1.1 (FROZEN)
--
-- CRITICAL: RLS + database constraints = defense-in-depth
-- NOT relying solely on application code

-- =============================================================================
-- 1. TENANT REGISTRY
-- =============================================================================

CREATE TABLE IF NOT EXISTS runtime_tenant_registry (
  -- Primary key
  tenant_id TEXT PRIMARY KEY,
  
  -- Tenant metadata
  tenant_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Metadata (JSONB for extensibility)
  metadata JSONB,
  
  -- Constraints
  CONSTRAINT tenant_id_not_empty CHECK (length(trim(tenant_id)) > 0),
  CONSTRAINT tenant_name_length CHECK (tenant_name IS NULL OR length(trim(tenant_name)) > 0)
);

-- Indexes
CREATE INDEX idx_runtime_tenant_active ON runtime_tenant_registry(is_active) WHERE is_active = true;
CREATE INDEX idx_runtime_tenant_created ON runtime_tenant_registry(created_at);

-- RLS (Row Level Security)
ALTER TABLE runtime_tenant_registry ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (users can only see their own tenant)
-- NOTE: In production, replace auth.uid() with your tenant resolution logic
CREATE POLICY tenant_isolation_policy_registry ON runtime_tenant_registry
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Updated timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_runtime_tenant_updated_at
  BEFORE UPDATE ON runtime_tenant_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE runtime_tenant_registry IS 'Tenant registry for Common Integration Runtime. Validates tenant existence and isolation.';
COMMENT ON COLUMN runtime_tenant_registry.tenant_id IS 'Unique tenant identifier (must match across all tables)';
COMMENT ON COLUMN runtime_tenant_registry.is_active IS 'Tenant active status. Inactive tenants cannot publish intents.';

-- =============================================================================
-- 2. IDEMPOTENCY REGISTRY
-- =============================================================================

CREATE TABLE IF NOT EXISTS runtime_idempotency_registry (
  -- Primary key (composite: tenant + idempotency key)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant context (CRITICAL: part of uniqueness constraint)
  tenant_id TEXT NOT NULL,
  
  -- Idempotency key (HASH(v1:tenantId:correlationId:intentType))
  idempotency_key TEXT NOT NULL,
  
  -- Intent metadata
  correlation_id TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  
  -- Reference to outbox record
  outbox_id UUID NOT NULL,
  
  -- Timestamps
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Constraints
  CONSTRAINT idempotency_tenant_key_unique UNIQUE(tenant_id, idempotency_key),
  CONSTRAINT idempotency_tenant_fk FOREIGN KEY(tenant_id) REFERENCES runtime_tenant_registry(tenant_id),
  CONSTRAINT idempotency_key_not_empty CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT correlation_id_not_empty CHECK (length(trim(correlation_id)) > 0),
  CONSTRAINT intent_type_not_empty CHECK (length(trim(intent_type)) > 0)
);

-- Indexes
CREATE INDEX idx_runtime_idempotency_tenant_key ON runtime_idempotency_registry(tenant_id, idempotency_key);
CREATE INDEX idx_runtime_idempotency_correlation ON runtime_idempotency_registry(correlation_id);
CREATE INDEX idx_runtime_idempotency_expires ON runtime_idempotency_registry(expires_at);
CREATE INDEX idx_runtime_idempotency_processed ON runtime_idempotency_registry(processed_at);

-- RLS (Row Level Security)
ALTER TABLE runtime_idempotency_registry ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy (users can only see their own tenant's records)
CREATE POLICY tenant_isolation_policy_idempotency ON runtime_idempotency_registry
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Comments
COMMENT ON TABLE runtime_idempotency_registry IS 'Idempotency registry. Prevents duplicate intent processing within TTL window.';
COMMENT ON COLUMN runtime_idempotency_registry.idempotency_key IS 'SHA-256 hash: v1:tenantId:correlationId:intentType';
COMMENT ON COLUMN runtime_idempotency_registry.expires_at IS 'Expiry timestamp (TTL). After expiry, intentional replay allowed.';
COMMENT ON CONSTRAINT idempotency_tenant_key_unique ON runtime_idempotency_registry IS 'CRITICAL: Tenant-scoped uniqueness. Prevents cross-tenant replay.';

-- =============================================================================
-- 3. OUTBOX
-- =============================================================================

CREATE TABLE IF NOT EXISTS runtime_outbox (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant context
  tenant_id TEXT NOT NULL,
  
  -- Intent data (JSONB for flexibility)
  intent_type TEXT NOT NULL,
  intent_payload JSONB NOT NULL,
  
  -- Correlation context
  correlation_id TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'PENDING',
  
  -- Retry tracking
  delivery_attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  
  -- Error tracking
  last_error TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT outbox_tenant_fk FOREIGN KEY(tenant_id) REFERENCES runtime_tenant_registry(tenant_id),
  CONSTRAINT outbox_status_valid CHECK (status IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'QUARANTINED')),
  CONSTRAINT intent_type_not_empty CHECK (length(trim(intent_type)) > 0),
  CONSTRAINT correlation_id_not_empty CHECK (length(trim(correlation_id)) > 0),
  CONSTRAINT delivery_attempts_positive CHECK (delivery_attempts >= 0)
);

-- Indexes
CREATE INDEX idx_runtime_outbox_status ON runtime_outbox(status) WHERE status IN ('PENDING', 'FAILED');
CREATE INDEX idx_runtime_outbox_tenant_status ON runtime_outbox(tenant_id, status);
CREATE INDEX idx_runtime_outbox_next_retry ON runtime_outbox(next_retry_at) WHERE status = 'FAILED' AND next_retry_at IS NOT NULL;
CREATE INDEX idx_runtime_outbox_correlation ON runtime_outbox(correlation_id);
CREATE INDEX idx_runtime_outbox_created ON runtime_outbox(created_at);

-- RLS (Row Level Security)
ALTER TABLE runtime_outbox ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_policy_outbox ON runtime_outbox
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Comments
COMMENT ON TABLE runtime_outbox IS 'Transactional outbox. Ensures at-least-once delivery to Finance OS.';
COMMENT ON COLUMN runtime_outbox.intent_payload IS 'Full Financial Intent as JSONB. Must NOT contain prohibited fields.';
COMMENT ON COLUMN runtime_outbox.status IS 'PENDING: awaiting worker | PROCESSING: being delivered | PUBLISHED: successfully delivered | FAILED: retry exhausted | QUARANTINED: poison message';
COMMENT ON COLUMN runtime_outbox.next_retry_at IS 'Scheduled retry timestamp (exponential backoff with jitter)';

-- =============================================================================
-- 4. AUDIT LOG
-- =============================================================================

CREATE TABLE IF NOT EXISTS runtime_audit_log (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant context
  tenant_id TEXT NOT NULL,
  
  -- Intent identification
  intent_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  
  -- Financial data
  amount NUMERIC(15, 2) NOT NULL,
  currency TEXT NOT NULL,
  
  -- Correlation context
  correlation_id TEXT NOT NULL,
  
  -- Source tracking
  source TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL,
  
  -- Delivery tracking
  delivery_attempts INTEGER,
  failure_reason TEXT,
  quarantined_at TIMESTAMPTZ,
  
  -- Timestamp (IMMUTABLE)
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT audit_tenant_fk FOREIGN KEY(tenant_id) REFERENCES runtime_tenant_registry(tenant_id),
  CONSTRAINT audit_status_valid CHECK (status IN ('SUCCESS', 'RETRYING', 'INVALID', 'DUPLICATE', 'QUARANTINED')),
  CONSTRAINT audit_amount_positive CHECK (amount >= 0),
  CONSTRAINT audit_currency_iso CHECK (length(currency) = 3 AND currency = upper(currency))
);

-- Indexes
CREATE INDEX idx_runtime_audit_tenant ON runtime_audit_log(tenant_id);
CREATE INDEX idx_runtime_audit_correlation ON runtime_audit_log(correlation_id);
CREATE INDEX idx_runtime_audit_timestamp ON runtime_audit_log(timestamp DESC);
CREATE INDEX idx_runtime_audit_status ON runtime_audit_log(status);
CREATE INDEX idx_runtime_audit_entity ON runtime_audit_log(entity_type, entity_id);

-- RLS (Row Level Security)
ALTER TABLE runtime_audit_log ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_policy_audit ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- CRITICAL: Audit log is APPEND-ONLY (no UPDATE, no DELETE)
CREATE POLICY audit_append_only_policy ON runtime_audit_log
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- Prevent UPDATE and DELETE (enforce append-only at database level)
CREATE POLICY audit_no_update ON runtime_audit_log
  FOR UPDATE
  USING (false);

CREATE POLICY audit_no_delete ON runtime_audit_log
  FOR DELETE
  USING (false);

-- Comments
COMMENT ON TABLE runtime_audit_log IS 'APPEND-ONLY audit trail. UPDATE/DELETE prohibited at database level.';
COMMENT ON COLUMN runtime_audit_log.timestamp IS 'Immutable timestamp. Audit records CANNOT be modified after creation.';

-- =============================================================================
-- 5. QUARANTINE
-- =============================================================================

CREATE TABLE IF NOT EXISTS runtime_quarantine (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant context
  tenant_id TEXT NOT NULL,
  
  -- Intent data (full payload preserved)
  intent_type TEXT NOT NULL,
  intent_payload JSONB NOT NULL,
  
  -- Correlation context
  correlation_id TEXT NOT NULL,
  
  -- Failure tracking
  failure_reason TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  last_error TEXT NOT NULL,
  
  -- Timestamps
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Review tracking
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  resolution TEXT,
  
  -- Reference to original outbox
  outbox_id UUID,
  
  -- Constraints
  CONSTRAINT quarantine_tenant_fk FOREIGN KEY(tenant_id) REFERENCES runtime_tenant_registry(tenant_id),
  CONSTRAINT quarantine_resolution_valid CHECK (resolution IS NULL OR resolution IN ('REPLAYED', 'DISCARDED', 'FIXED')),
  CONSTRAINT quarantine_attempts_positive CHECK (attempts > 0)
);

-- Indexes
CREATE INDEX idx_runtime_quarantine_tenant ON runtime_quarantine(tenant_id);
CREATE INDEX idx_runtime_quarantine_reviewed ON runtime_quarantine(reviewed) WHERE reviewed = false;
CREATE INDEX idx_runtime_quarantine_correlation ON runtime_quarantine(correlation_id);
CREATE INDEX idx_runtime_quarantine_quarantined ON runtime_quarantine(quarantined_at DESC);

-- RLS (Row Level Security)
ALTER TABLE runtime_quarantine ENABLE ROW LEVEL SECURITY;

-- Tenant isolation policy
CREATE POLICY tenant_isolation_policy_quarantine ON runtime_quarantine
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Comments
COMMENT ON TABLE runtime_quarantine IS 'Poison message quarantine. Preserves full payload and error context for investigation.';
COMMENT ON COLUMN runtime_quarantine.intent_payload IS 'Full Financial Intent (preserved for replay after fix)';
COMMENT ON COLUMN runtime_quarantine.resolution IS 'REPLAYED: reprocessed successfully | DISCARDED: invalid intent | FIXED: corrected and replayed';

-- =============================================================================
-- VERIFICATION QUERIES (for testing)
-- =============================================================================

-- Test 1: Tenant isolation (cross-tenant access should FAIL)
-- SET app.current_tenant_id = 'tenant-a';
-- SELECT * FROM runtime_outbox WHERE tenant_id = 'tenant-b';  -- Should return empty

-- Test 2: Duplicate idempotency key (should FAIL)
-- INSERT INTO runtime_idempotency_registry (tenant_id, idempotency_key, correlation_id, intent_type, outbox_id, expires_at)
-- VALUES ('tenant-a', 'key-123', 'corr-123', 'REVENUE_RECOGNIZED', gen_random_uuid(), now() + interval '1 day');
-- INSERT INTO runtime_idempotency_registry (tenant_id, idempotency_key, correlation_id, intent_type, outbox_id, expires_at)
-- VALUES ('tenant-a', 'key-123', 'corr-123', 'REVENUE_RECOGNIZED', gen_random_uuid(), now() + interval '1 day');
-- -- Second insert should FAIL (unique constraint)

-- Test 3: Audit log UPDATE (should FAIL)
-- INSERT INTO runtime_audit_log (tenant_id, intent_type, entity_id, entity_type, amount, currency, correlation_id, source, status)
-- VALUES ('tenant-a', 'REVENUE_RECOGNIZED', 'enc-123', 'Encounter', 1000.00, 'USD', 'corr-123', 'Hospital', 'SUCCESS');
-- UPDATE runtime_audit_log SET amount = 2000.00;  -- Should FAIL (append-only)

-- Test 4: Audit log DELETE (should FAIL)
-- DELETE FROM runtime_audit_log;  -- Should FAIL (append-only)

-- =============================================================================
-- END OF MIGRATION
-- =============================================================================

-- Verification
SELECT 'Runtime database schema v1.0 migration complete' AS status;
