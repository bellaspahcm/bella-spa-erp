/**
 * E3 Economics Experiment - R5: Create Discrepancy Record
 * Migration: Discrepancy Table
 * 
 * Category: C (Configuration Reuse - using platform schema template)
 * 
 * Purpose: Track invoice discrepancies for review and resolution
 */

-- ============================================================================
-- DISCREPANCIES (Invoice Variance Records)
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_discrepancies (
  discrepancy_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  line_item_id UUID NOT NULL,
  expected_amount DECIMAL(15,2) NOT NULL,
  actual_amount DECIMAL(15,2) NOT NULL,
  variance DECIMAL(15,2) NOT NULL,
  variance_percentage DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'open', -- 'open', 'under_review', 'resolved', 'escalated'
  assigned_to UUID, -- Reviewer user_id
  assigned_at TIMESTAMP,
  resolution_notes TEXT,
  resolved_by UUID,
  resolved_at TIMESTAMP,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,
  updated_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT log_discrepancies_status_check 
    CHECK (status IN ('open', 'under_review', 'resolved', 'escalated')),
  
  -- Foreign key references
  CONSTRAINT log_discrepancies_invoice_fk 
    FOREIGN KEY (invoice_id) REFERENCES log_freight_invoices(invoice_id) ON DELETE CASCADE,
  CONSTRAINT log_discrepancies_line_item_fk 
    FOREIGN KEY (line_item_id) REFERENCES log_invoice_line_items(line_item_id) ON DELETE CASCADE
);

-- Indexes for discrepancy queries
CREATE INDEX idx_discrepancies_tenant ON log_discrepancies(tenant_id);
CREATE INDEX idx_discrepancies_invoice ON log_discrepancies(tenant_id, invoice_id);
CREATE INDEX idx_discrepancies_status ON log_discrepancies(tenant_id, status);
CREATE INDEX idx_discrepancies_assigned ON log_discrepancies(tenant_id, assigned_to, status);

-- ============================================================================
-- RLS POLICY (Tenant Isolation)
-- Category: C (Configuration Reuse - using platform RLS template)
-- ============================================================================

-- Enable RLS
ALTER TABLE log_discrepancies ENABLE ROW LEVEL SECURITY;

-- Discrepancies: Tenant isolation
CREATE POLICY discrepancies_tenant_isolation
ON log_discrepancies
USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE log_discrepancies IS 
  'E3 R5: Invoice discrepancy records for variance review and resolution';

COMMENT ON COLUMN log_discrepancies.status IS 
  'Discrepancy lifecycle: open, under_review, resolved, escalated';

COMMENT ON COLUMN log_discrepancies.assigned_to IS 
  'User ID of assigned reviewer';
