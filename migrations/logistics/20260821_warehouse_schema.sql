-- E6 Warehouse Management Schema
-- Experiment: E6 Repeatability Validation
-- Created: 2026-08-21
-- Purpose: Test platform leverage on second logistics vertical

-- ============================================================================
-- WAREHOUSE MANAGEMENT CORE TABLES
-- ============================================================================

-- SKUs (Stock Keeping Units) - Product catalog
CREATE TABLE IF NOT EXISTS logistics_warehouse_skus (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sku_code TEXT NOT NULL,
  description TEXT,
  unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  uom TEXT NOT NULL DEFAULT 'EA', -- Unit of Measure: EA, CS, PLT
  status TEXT NOT NULL DEFAULT 'active', -- active, discontinued
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT logistics_warehouse_skus_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Bins (Storage Locations) - Physical warehouse locations
CREATE TABLE IF NOT EXISTS logistics_warehouse_bins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  bin_code TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  zone_id TEXT,
  aisle_id TEXT,
  max_capacity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  status TEXT NOT NULL DEFAULT 'active', -- active, damaged, reserved, inactive
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT logistics_warehouse_bins_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Receipts - Incoming inventory
CREATE TABLE IF NOT EXISTS logistics_warehouse_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  po_number TEXT NOT NULL,
  vendor_id UUID,
  received_date DATE NOT NULL,
  receiver_notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending_putaway', 
    -- pending_putaway, putaway_in_progress, completed, on_hold
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  held_at TIMESTAMPTZ,
  held_by UUID,
  hold_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT logistics_warehouse_receipts_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- Receipt Line Items
CREATE TABLE IF NOT EXISTS logistics_warehouse_receipt_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  receipt_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  expected_quantity DECIMAL(12,2) NOT NULL,
  actual_quantity DECIMAL(12,2) NOT NULL,
  discrepancy DECIMAL(12,2) GENERATED ALWAYS AS (actual_quantity - expected_quantity) STORED,
  discrepancy_percentage DECIMAL(5,2), -- Calculated
  discrepancy_status TEXT, -- exact_match, acceptable_over, significant_over, acceptable_short, significant_short
  target_bin_id UUID,
  line_status TEXT NOT NULL DEFAULT 'pending', -- pending, on_hold, completed
  uom TEXT NOT NULL DEFAULT 'EA',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT logistics_warehouse_receipt_line_items_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT logistics_warehouse_receipt_line_items_receipt_fk 
    FOREIGN KEY (receipt_id) REFERENCES logistics_warehouse_receipts(id),
  CONSTRAINT logistics_warehouse_receipt_line_items_sku_fk 
    FOREIGN KEY (sku_id) REFERENCES logistics_warehouse_skus(id),
  CONSTRAINT logistics_warehouse_receipt_line_items_bin_fk 
    FOREIGN KEY (target_bin_id) REFERENCES logistics_warehouse_bins(id)
);

-- Inventory On-Hand
CREATE TABLE IF NOT EXISTS logistics_warehouse_inventory_on_hand (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  bin_id UUID NOT NULL,
  quantity DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT logistics_warehouse_inventory_on_hand_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT logistics_warehouse_inventory_on_hand_sku_fk 
    FOREIGN KEY (sku_id) REFERENCES logistics_warehouse_skus(id),
  CONSTRAINT logistics_warehouse_inventory_on_hand_bin_fk 
    FOREIGN KEY (bin_id) REFERENCES logistics_warehouse_bins(id),
  CONSTRAINT logistics_warehouse_inventory_on_hand_unique 
    UNIQUE (tenant_id, sku_id, bin_id)
);

-- Movements - Inventory transactions
CREATE TABLE IF NOT EXISTS logistics_warehouse_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  sku_id UUID NOT NULL,
  from_bin_id UUID,
  to_bin_id UUID,
  quantity DECIMAL(12,2) NOT NULL,
  movement_type TEXT NOT NULL, -- cycle_count_adjustment, inter_bin_transfer, putaway, pick
  reason TEXT,
  batch_id UUID, -- For bulk operations
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT logistics_warehouse_movements_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT logistics_warehouse_movements_sku_fk 
    FOREIGN KEY (sku_id) REFERENCES logistics_warehouse_skus(id),
  CONSTRAINT logistics_warehouse_movements_from_bin_fk 
    FOREIGN KEY (from_bin_id) REFERENCES logistics_warehouse_bins(id),
  CONSTRAINT logistics_warehouse_movements_to_bin_fk 
    FOREIGN KEY (to_bin_id) REFERENCES logistics_warehouse_bins(id)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE logistics_warehouse_skus ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_warehouse_bins ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_warehouse_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_warehouse_receipt_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_warehouse_inventory_on_hand ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics_warehouse_movements ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Tenant Isolation
CREATE POLICY logistics_warehouse_skus_tenant_isolation ON logistics_warehouse_skus
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY logistics_warehouse_bins_tenant_isolation ON logistics_warehouse_bins
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY logistics_warehouse_receipts_tenant_isolation ON logistics_warehouse_receipts
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY logistics_warehouse_receipt_line_items_tenant_isolation ON logistics_warehouse_receipt_line_items
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY logistics_warehouse_inventory_on_hand_tenant_isolation ON logistics_warehouse_inventory_on_hand
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY logistics_warehouse_movements_tenant_isolation ON logistics_warehouse_movements
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS logistics_warehouse_skus_tenant_idx 
  ON logistics_warehouse_skus(tenant_id);

CREATE INDEX IF NOT EXISTS logistics_warehouse_bins_tenant_idx 
  ON logistics_warehouse_bins(tenant_id);

CREATE INDEX IF NOT EXISTS logistics_warehouse_receipts_tenant_idx 
  ON logistics_warehouse_receipts(tenant_id);

CREATE INDEX IF NOT EXISTS logistics_warehouse_receipts_status_idx 
  ON logistics_warehouse_receipts(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS logistics_warehouse_receipt_line_items_receipt_idx 
  ON logistics_warehouse_receipt_line_items(receipt_id);

CREATE INDEX IF NOT EXISTS logistics_warehouse_inventory_on_hand_sku_bin_idx 
  ON logistics_warehouse_inventory_on_hand(sku_id, bin_id);

CREATE INDEX IF NOT EXISTS logistics_warehouse_movements_tenant_idx 
  ON logistics_warehouse_movements(tenant_id);

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Update timestamp trigger function (reuse platform pattern)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply update triggers
CREATE TRIGGER logistics_warehouse_skus_updated_at 
  BEFORE UPDATE ON logistics_warehouse_skus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER logistics_warehouse_bins_updated_at 
  BEFORE UPDATE ON logistics_warehouse_bins
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER logistics_warehouse_receipts_updated_at 
  BEFORE UPDATE ON logistics_warehouse_receipts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER logistics_warehouse_receipt_line_items_updated_at 
  BEFORE UPDATE ON logistics_warehouse_receipt_line_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER logistics_warehouse_inventory_on_hand_updated_at 
  BEFORE UPDATE ON logistics_warehouse_inventory_on_hand
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE logistics_warehouse_skus IS 'E6: Stock Keeping Units - product catalog';
COMMENT ON TABLE logistics_warehouse_bins IS 'E6: Physical storage locations with capacity limits';
COMMENT ON TABLE logistics_warehouse_receipts IS 'E6: Incoming inventory receipts from vendors';
COMMENT ON TABLE logistics_warehouse_receipt_line_items IS 'E6: Line items for each receipt with discrepancy tracking';
COMMENT ON TABLE logistics_warehouse_inventory_on_hand IS 'E6: Current inventory quantities by SKU and location';
COMMENT ON TABLE logistics_warehouse_movements IS 'E6: Inventory movement transactions';
