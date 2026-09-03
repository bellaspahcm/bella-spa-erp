/**
 * E3 Economics Experiment - R1: Create Freight Invoice
 * Migration: Freight Audit & Payment Tables
 * 
 * Category: C (Configuration Reuse - using platform schema template)
 * 
 * Tables:
 * - log_freight_invoices (invoice header)
 * - log_invoice_line_items (charge details)
 */

-- ============================================================================
-- FREIGHT INVOICES (Header)
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_freight_invoices (
  invoice_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_id UUID NOT NULL,
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date TIMESTAMP NOT NULL,
  due_date TIMESTAMP NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  subtotal_amount DECIMAL(15,2) NOT NULL,
  tax_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(15,2) NOT NULL,
  approved_amount DECIMAL(15,2),
  approved_by UUID,
  approved_at TIMESTAMP,
  paid_amount DECIMAL(15,2),
  paid_at TIMESTAMP,
  payment_reference VARCHAR(255),
  rejection_reason TEXT,
  rejected_by UUID,
  rejected_at TIMESTAMP,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,
  updated_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT log_freight_invoices_status_check 
    CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'paid')),
  CONSTRAINT log_freight_invoices_unique_invoice_number 
    UNIQUE (tenant_id, carrier_id, invoice_number)
);

-- Indexes for query performance
CREATE INDEX idx_freight_invoices_tenant ON log_freight_invoices(tenant_id);
CREATE INDEX idx_freight_invoices_carrier ON log_freight_invoices(tenant_id, carrier_id);
CREATE INDEX idx_freight_invoices_status ON log_freight_invoices(tenant_id, status);
CREATE INDEX idx_freight_invoices_date ON log_freight_invoices(tenant_id, invoice_date DESC);

-- ============================================================================
-- INVOICE LINE ITEMS (Charge Details)
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_invoice_line_items (
  line_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES log_freight_invoices(invoice_id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  shipment_id UUID NOT NULL,
  charge_type VARCHAR(50) NOT NULL,
  description VARCHAR(500) NOT NULL,
  quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  expected_amount DECIMAL(15,2), -- R2: Rate validation
  variance DECIMAL(15,2), -- R2: Variance calculation
  variance_reason VARCHAR(500), -- R2: Discrepancy tracking
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT log_invoice_line_items_charge_type_check 
    CHECK (charge_type IN ('base_rate', 'fuel_surcharge', 'accessorial', 'discount', 'tax', 'other'))
);

-- Indexes for query performance
CREATE INDEX idx_invoice_line_items_invoice ON log_invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_items_tenant ON log_invoice_line_items(tenant_id);
CREATE INDEX idx_invoice_line_items_shipment ON log_invoice_line_items(tenant_id, shipment_id);

-- ============================================================================
-- RLS POLICIES (Tenant Isolation)
-- Category: C (Configuration Reuse - using platform RLS template)
-- ============================================================================

-- Enable RLS
ALTER TABLE log_freight_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE log_invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Freight Invoices: Tenant isolation
CREATE POLICY freight_invoices_tenant_isolation
ON log_freight_invoices
USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Invoice Line Items: Tenant isolation
CREATE POLICY invoice_line_items_tenant_isolation
ON log_invoice_line_items
USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE log_freight_invoices IS 
  'E3 R1: Freight invoice headers for carrier payment reconciliation';

COMMENT ON TABLE log_invoice_line_items IS 
  'E3 R1: Invoice charge line items with shipment references';

COMMENT ON COLUMN log_freight_invoices.status IS 
  'Workflow: draft → pending_approval → approved/rejected → paid';

COMMENT ON COLUMN log_invoice_line_items.charge_type IS 
  'Charge classification: base_rate, fuel_surcharge, accessorial, discount, tax, other';
