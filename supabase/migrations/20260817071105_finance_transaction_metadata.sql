-- F5.6 Finance OS — Finance Transaction Metadata (N3 Historical Integrity)
--
-- Immutable provenance for financial transactions
-- Ensures historical reconstruction of WHY a transaction was posted
--
-- Critical Requirements:
-- 1. Immutable semantic context (C.2)
-- 2. Immutable intent context (C.2)
-- 3. Immutable policy version (A.4)
-- 4. Immutable COA version (C.3)
-- 5. Linkage to source event + journal entry

CREATE TABLE IF NOT EXISTS finance_transaction_metadata (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Linkage
  journal_entry_id UUID NOT NULL UNIQUE REFERENCES journal_entries(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- N3 Historical Integrity — Immutable Context
  canonical_semantic TEXT NOT NULL,
  semantic_category TEXT NOT NULL,
  
  accounting_intents JSONB NOT NULL, -- Array of {intent_type, debit_amount, credit_amount, description}
  
  policy_version TEXT NOT NULL,
  policy_regime TEXT NOT NULL,
  
  coa_version TEXT NOT NULL DEFAULT 'v1.0',
  
  posting_context JSONB NOT NULL, -- Full business context from source event
  
  -- Account mappings (for audit)
  account_mappings JSONB NOT NULL, -- Array of {intent_type, account_code, account_name}
  
  -- Source tracking
  source_system TEXT NOT NULL,
  source_version TEXT NOT NULL,
  
  -- Timestamps (immutable)
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_event_per_tenant UNIQUE (tenant_id, event_id)
);

-- Indexes
CREATE INDEX idx_finance_metadata_tenant ON finance_transaction_metadata(tenant_id);
CREATE INDEX idx_finance_metadata_event ON finance_transaction_metadata(event_id);
CREATE INDEX idx_finance_metadata_journal ON finance_transaction_metadata(journal_entry_id);
CREATE INDEX idx_finance_metadata_semantic ON finance_transaction_metadata(canonical_semantic);
CREATE INDEX idx_finance_metadata_date ON finance_transaction_metadata(transaction_date);

-- RLS Policies
ALTER TABLE finance_transaction_metadata ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access"
  ON finance_transaction_metadata
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE finance_transaction_metadata IS 'N3 Historical Integrity - Immutable provenance for financial transactions';
COMMENT ON COLUMN finance_transaction_metadata.journal_entry_id IS 'FK to journal_entries (1:1 relationship)';
COMMENT ON COLUMN finance_transaction_metadata.event_id IS 'Source event ID (string, not UUID)';
COMMENT ON COLUMN finance_transaction_metadata.canonical_semantic IS 'Resolved semantic (C.2) - e.g., PATIENT_SERVICE_REVENUE';
COMMENT ON COLUMN finance_transaction_metadata.accounting_intents IS 'Generated intents (C.2) - JSONB array';
COMMENT ON COLUMN finance_transaction_metadata.policy_version IS 'Policy version at transaction time (A.4)';
COMMENT ON COLUMN finance_transaction_metadata.coa_version IS 'COA version at transaction time (C.3)';
COMMENT ON COLUMN finance_transaction_metadata.posting_context IS 'Full business context from source event (for audit/reconstruction)';
COMMENT ON COLUMN finance_transaction_metadata.account_mappings IS 'Intent → Account mappings resolved at transaction time';
