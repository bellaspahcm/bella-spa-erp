-- E6 R6 Bug Fix (B8): Add missing vendors table
-- Bug: logistics_warehouse_vendors table not defined in schema
-- Discovery: 2026-08-22 06:06:43
-- Classification: Schema Definition Error (Bella Implementation Bug)

-- ============================================================================
-- VENDORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS logistics_warehouse_vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  vendor_code TEXT NOT NULL,
  vendor_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  
  CONSTRAINT logistics_warehouse_vendors_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT logistics_warehouse_vendors_unique_code
    UNIQUE (tenant_id, vendor_code)
);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE logistics_warehouse_vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY logistics_warehouse_vendors_tenant_isolation ON logistics_warehouse_vendors
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS logistics_warehouse_vendors_tenant_idx 
  ON logistics_warehouse_vendors(tenant_id);

CREATE INDEX IF NOT EXISTS logistics_warehouse_vendors_code_idx 
  ON logistics_warehouse_vendors(vendor_code);

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

CREATE TRIGGER logistics_warehouse_vendors_updated_at 
  BEFORE UPDATE ON logistics_warehouse_vendors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ADD FK CONSTRAINT TO RECEIPTS (OPTIONAL - commented out for now)
-- ============================================================================

-- Option: Add FK constraint to enforce referential integrity
-- This was not in original schema, may be intentional (allow flexible vendor_id)
-- Uncomment if vendor FK should be enforced:

-- ALTER TABLE logistics_warehouse_receipts
--   ADD CONSTRAINT logistics_warehouse_receipts_vendor_fk
--   FOREIGN KEY (vendor_id) REFERENCES logistics_warehouse_vendors(id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE logistics_warehouse_vendors IS 'E6: Vendor master data for warehouse receipts';
