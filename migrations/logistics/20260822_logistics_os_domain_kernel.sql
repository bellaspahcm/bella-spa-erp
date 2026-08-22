-- ============================================================================
-- Logistics OS Domain Kernel Schema
-- E7.1.3: Persistence Model
-- Created: 2026-08-22
-- Purpose: Independent OS layer (not Warehouse-specific)
-- ============================================================================

-- Design Principles:
-- 1. Separate `logistics` schema (not `logistics_warehouse_*`)
-- 2. Zero Warehouse dependencies (no receipt_id, bin_id, vendor_id FK)
-- 3. Zero Finance dependencies (no GL accounts, journal entries)
-- 4. Products reference OS (Warehouse → Logistics), not reverse
-- 5. RLS enforces tenant isolation (P0 Gate)
-- 6. Domain invariants enforced at DB level where possible

-- ============================================================================
-- SCHEMA
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS logistics;

COMMENT ON SCHEMA logistics IS 'Logistics OS - Core domain kernel (E7.1)';

-- ============================================================================
-- TABLE 1: ITEMS (SKU Master Data)
-- ============================================================================

CREATE TABLE logistics.items (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  sku_code TEXT NOT NULL,
  
  -- Description
  name TEXT NOT NULL,
  description TEXT,
  
  -- Classification
  type TEXT NOT NULL DEFAULT 'GOODS',
    CHECK (type IN ('GOODS', 'SERVICE', 'KIT', 'BUNDLE', 'VIRTUAL')),
  category TEXT,
  
  -- Measurement
  base_uom TEXT NOT NULL DEFAULT 'EA',
    CHECK (base_uom IN ('EA', 'CS', 'PLT', 'KG', 'G', 'LB', 'OZ', 'L', 'ML', 'GAL', 'QT', 'M', 'CM', 'MM', 'FT', 'IN', 'SQM', 'SQFT', 'HR', 'DAY', 'WK')),
  weight_kg DECIMAL(12, 4),
    CHECK (weight_kg IS NULL OR weight_kg >= 0),
  dimensions_json JSONB, -- { length, width, height, unit }
  
  -- Costing (hints for Finance OS, not authoritative)
  standard_cost DECIMAL(12, 2),
    CHECK (standard_cost IS NULL OR standard_cost >= 0),
  currency TEXT DEFAULT 'VND',
    CHECK (currency ~ '^[A-Z]{3}$'), -- ISO 4217
  
  -- Traceability requirements
  lot_tracked BOOLEAN NOT NULL DEFAULT false,
  serial_tracked BOOLEAN NOT NULL DEFAULT false,
  expiry_tracked BOOLEAN NOT NULL DEFAULT false,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'DISCONTINUED', 'PENDING')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_by UUID,
  
  -- Constraints
  CONSTRAINT items_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT items_sku_unique 
    UNIQUE (tenant_id, sku_code),
  CONSTRAINT items_serial_requires_lot
    CHECK (NOT serial_tracked OR lot_tracked) -- Serial tracking requires lot tracking
);

COMMENT ON TABLE logistics.items IS 'E7.1: Item/SKU master data (cross-product primitive)';
COMMENT ON COLUMN logistics.items.sku_code IS 'Business identifier, unique per tenant';
COMMENT ON COLUMN logistics.items.standard_cost IS 'Cost hint for Finance OS (not authoritative)';
COMMENT ON COLUMN logistics.items.lot_tracked IS 'Requires lot/batch tracking';
COMMENT ON COLUMN logistics.items.serial_tracked IS 'Requires serial number tracking';
COMMENT ON COLUMN logistics.items.expiry_tracked IS 'Requires expiry date tracking';

-- ============================================================================
-- TABLE 2: LOCATIONS (Generic Location Abstraction)
-- ============================================================================

CREATE TABLE logistics.locations (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  location_code TEXT NOT NULL,
  
  -- Description
  location_name TEXT NOT NULL,
  location_type TEXT NOT NULL,
    CHECK (location_type IN ('WAREHOUSE', 'STORE', 'FULFILLMENT', '3PL', 'TRANSIT', 'SUPPLIER', 'CUSTOMER', 'STAGING', 'QUARANTINE', 'DAMAGE', 'VIRTUAL')),
  
  -- Hierarchy (optional, generic)
  parent_location_id UUID,
  
  -- Address (optional)
  address_json JSONB, -- { street, city, state, postal_code, country }
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',
    CHECK (status IN ('ACTIVE', 'INACTIVE', 'CLOSED')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT locations_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT locations_parent_fk
    FOREIGN KEY (parent_location_id) REFERENCES logistics.locations(id),
  CONSTRAINT locations_code_unique 
    UNIQUE (tenant_id, location_code)
);

COMMENT ON TABLE logistics.locations IS 'E7.1: Generic location (not bin-specific, Products extend)';
COMMENT ON COLUMN logistics.locations.location_type IS 'Location function (WAREHOUSE, STORE, 3PL, etc.)';
COMMENT ON COLUMN logistics.locations.parent_location_id IS 'Optional hierarchy (generic, not warehouse-specific)';

-- ============================================================================
-- TABLE 3: INVENTORY (Balance by Item/Location)
-- ============================================================================

CREATE TABLE logistics.inventory (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  
  -- Item reference
  item_id UUID NOT NULL REFERENCES logistics.items(id),
  
  -- Location reference (generic)
  location_id UUID NOT NULL REFERENCES logistics.locations(id),
  location_type TEXT NOT NULL,
    CHECK (location_type IN ('WAREHOUSE', 'STORE', 'FULFILLMENT', '3PL', 'TRANSIT', 'SUPPLIER', 'CUSTOMER', 'STAGING', 'QUARANTINE', 'DAMAGE', 'VIRTUAL')),
  
  -- Quantity
  quantity_on_hand DECIMAL(12, 4) NOT NULL DEFAULT 0,
    CHECK (quantity_on_hand >= 0),
  quantity_reserved DECIMAL(12, 4) NOT NULL DEFAULT 0,
    CHECK (quantity_reserved >= 0),
  quantity_available DECIMAL(12, 4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  
  -- Traceability
  lot_number TEXT,
  serial_number TEXT,
  expiry_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
    CHECK (status IN ('AVAILABLE', 'RESERVED', 'ALLOCATED', 'QUARANTINE', 'DAMAGED', 'EXPIRED', 'TRANSIT', 'BLOCKED')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT inventory_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT inventory_item_fk 
    FOREIGN KEY (item_id) REFERENCES logistics.items(id),
  CONSTRAINT inventory_location_fk 
    FOREIGN KEY (location_id) REFERENCES logistics.locations(id),
  CONSTRAINT inventory_unique 
    UNIQUE (tenant_id, item_id, location_id, lot_number, serial_number),
  CONSTRAINT inventory_reserved_lte_on_hand
    CHECK (quantity_reserved <= quantity_on_hand)
);

COMMENT ON TABLE logistics.inventory IS 'E7.1: Current inventory balance (on-hand, reserved, available)';
COMMENT ON COLUMN logistics.inventory.quantity_on_hand IS 'Physical quantity present';
COMMENT ON COLUMN logistics.inventory.quantity_reserved IS 'Soft allocated (order placed, not picked)';
COMMENT ON COLUMN logistics.inventory.quantity_available IS 'Computed: on_hand - reserved';
COMMENT ON COLUMN logistics.inventory.lot_number IS 'Lot/batch number (if item.lot_tracked = true)';
COMMENT ON COLUMN logistics.inventory.serial_number IS 'Serial number (if item.serial_tracked = true)';

-- ============================================================================
-- TABLE 4: INVENTORY MOVEMENTS (Transaction Log)
-- ============================================================================

CREATE TABLE logistics.inventory_movements (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  
  -- Temporal
  movement_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  
  -- Classification
  movement_type TEXT NOT NULL,
    CHECK (movement_type IN ('RECEIPT', 'RETURN_RECEIPT', 'TRANSFER_IN', 'PRODUCTION_OUTPUT', 'ISSUE', 'SHIPMENT', 'TRANSFER_OUT', 'PRODUCTION_CONSUMPTION', 'ADJUSTMENT_INCREASE', 'ADJUSTMENT_DECREASE', 'DAMAGE', 'OBSOLESCENCE', 'THEFT', 'RELOCATION', 'STATUS_CHANGE', 'CYCLE_COUNT')),
  direction TEXT NOT NULL,
    CHECK (direction IN ('INBOUND', 'OUTBOUND', 'NEUTRAL')),
  
  -- Item reference
  item_id UUID NOT NULL REFERENCES logistics.items(id),
  
  -- Locations (generic, not bin-specific)
  from_location_id UUID,
  from_location_type TEXT,
    CHECK (from_location_type IS NULL OR from_location_type IN ('WAREHOUSE', 'STORE', 'FULFILLMENT', '3PL', 'TRANSIT', 'SUPPLIER', 'CUSTOMER', 'STAGING', 'QUARANTINE', 'DAMAGE', 'VIRTUAL')),
  to_location_id UUID,
  to_location_type TEXT,
    CHECK (to_location_type IS NULL OR to_location_type IN ('WAREHOUSE', 'STORE', 'FULFILLMENT', '3PL', 'TRANSIT', 'SUPPLIER', 'CUSTOMER', 'STAGING', 'QUARANTINE', 'DAMAGE', 'VIRTUAL')),
  
  -- Quantity
  quantity DECIMAL(12, 4) NOT NULL,
    CHECK (quantity > 0), -- Always positive
  unit_of_measure TEXT NOT NULL,
  
  -- Traceability
  lot_number TEXT,
  serial_number TEXT,
  expiry_date DATE,
  
  -- Costing (hints for Finance OS)
  unit_cost DECIMAL(12, 2),
    CHECK (unit_cost IS NULL OR unit_cost >= 0),
  total_cost DECIMAL(12, 2),
    CHECK (total_cost IS NULL OR total_cost >= 0),
  currency TEXT,
    CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  
  -- Source document (generic reference, no FK to Products)
  source_document_type TEXT, -- e.g., 'RECEIPT', 'ORDER', 'TRANSFER'
  source_document_id UUID,   -- Product-specific ID (no FK)
  source_document_number TEXT,
  source_line_item_id UUID,
  
  -- Reason & notes
  reason TEXT,
  notes TEXT,
  
  -- Batch processing
  batch_id UUID,
  
  -- Approval
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'COMPLETED',
    CHECK (status IN ('PENDING', 'COMPLETED', 'CANCELLED', 'FAILED')),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Constraints
  CONSTRAINT movements_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT movements_item_fk 
    FOREIGN KEY (item_id) REFERENCES logistics.items(id),
  CONSTRAINT movements_from_location_fk
    FOREIGN KEY (from_location_id) REFERENCES logistics.locations(id),
  CONSTRAINT movements_to_location_fk
    FOREIGN KEY (to_location_id) REFERENCES logistics.locations(id),
  CONSTRAINT movements_number_unique 
    UNIQUE (tenant_id, movement_number),
  CONSTRAINT movements_direction_valid
    CHECK (
      (direction = 'INBOUND' AND to_location_id IS NOT NULL) OR
      (direction = 'OUTBOUND' AND from_location_id IS NOT NULL) OR
      (direction = 'NEUTRAL' AND from_location_id IS NOT NULL AND to_location_id IS NOT NULL)
    )
);

COMMENT ON TABLE logistics.inventory_movements IS 'E7.1: Immutable transaction log (audit trail)';
COMMENT ON COLUMN logistics.inventory_movements.movement_number IS 'Human-readable movement identifier';
COMMENT ON COLUMN logistics.inventory_movements.direction IS 'INBOUND (increases), OUTBOUND (decreases), NEUTRAL (relocate)';
COMMENT ON COLUMN logistics.inventory_movements.quantity IS 'Always positive (direction indicates increase/decrease)';
COMMENT ON COLUMN logistics.inventory_movements.unit_cost IS 'Cost hint for Finance OS (not authoritative)';
COMMENT ON COLUMN logistics.inventory_movements.source_document_id IS 'Product-specific document reference (no FK constraint)';

-- Immutability: movements cannot be updated (no updated_at column)

-- ============================================================================
-- TABLE 5: TRACEABILITY (Lot/Serial Tracking)
-- ============================================================================

CREATE TABLE logistics.traceability (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  
  -- Item reference
  item_id UUID NOT NULL REFERENCES logistics.items(id),
  
  -- Identifiers
  lot_number TEXT,
  serial_number TEXT,
  
  -- Lifecycle
  manufactured_date DATE,
  expiry_date DATE,
  received_date DATE NOT NULL,
  
  -- Origin
  supplier_id UUID, -- Generic reference (no FK to Warehouse vendor)
  supplier_name TEXT,
  supplier_lot_number TEXT,
  
  -- Chain of custody (JSONB array)
  custody_events JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{ timestamp, location_id, location_type, action, user_id, notes }, ...]
  
  -- Compliance
  compliance_status TEXT NOT NULL DEFAULT 'COMPLIANT',
    CHECK (compliance_status IN ('COMPLIANT', 'NON_COMPLIANT', 'UNDER_REVIEW')),
  recall_status TEXT NOT NULL DEFAULT 'NONE',
    CHECK (recall_status IN ('NONE', 'RECALLED', 'DESTROYED')),
  recall_reason TEXT,
  recall_date DATE,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT traceability_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT traceability_item_fk 
    FOREIGN KEY (item_id) REFERENCES logistics.items(id),
  CONSTRAINT traceability_unique 
    UNIQUE (tenant_id, item_id, lot_number, serial_number),
  CONSTRAINT traceability_lot_or_serial_required
    CHECK (lot_number IS NOT NULL OR serial_number IS NOT NULL),
  CONSTRAINT traceability_expiry_after_manufacture
    CHECK (expiry_date IS NULL OR manufactured_date IS NULL OR expiry_date >= manufactured_date)
);

COMMENT ON TABLE logistics.traceability IS 'E7.1: Lot/serial tracking, chain of custody, recalls';
COMMENT ON COLUMN logistics.traceability.custody_events IS 'Immutable chain of custody events (JSONB array)';
COMMENT ON COLUMN logistics.traceability.recall_status IS 'NONE, RECALLED, DESTROYED';
COMMENT ON COLUMN logistics.traceability.supplier_id IS 'Generic supplier reference (no FK to Product tables)';

-- ============================================================================
-- TABLE 6: UOM (Unit of Measure) - Future Enhancement
-- ============================================================================

CREATE TABLE logistics.uom (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  
  -- Definition
  uom_code TEXT NOT NULL,
  uom_name TEXT NOT NULL,
  category TEXT NOT NULL,
    CHECK (category IN ('QUANTITY', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'TIME')),
  
  -- Conversion (optional, for future)
  base_uom_code TEXT, -- Reference to base UOM for conversions
  conversion_factor DECIMAL(12, 6),
  
  -- Display
  decimals INTEGER DEFAULT 2,
    CHECK (decimals >= 0 AND decimals <= 6),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE',
    CHECK (status IN ('ACTIVE', 'INACTIVE')),
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT uom_tenant_fk 
    FOREIGN KEY (tenant_id) REFERENCES public.tenants(id),
  CONSTRAINT uom_code_unique 
    UNIQUE (tenant_id, uom_code)
);

COMMENT ON TABLE logistics.uom IS 'E7.1: Unit of measure definitions (basic, conversions future)';
COMMENT ON COLUMN logistics.uom.conversion_factor IS 'Factor to convert to base UOM (future enhancement)';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE logistics.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.traceability ENABLE ROW LEVEL SECURITY;
ALTER TABLE logistics.uom ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Tenant Isolation (P0 Gate)
CREATE POLICY items_tenant_isolation ON logistics.items
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY locations_tenant_isolation ON logistics.locations
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY inventory_tenant_isolation ON logistics.inventory
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY movements_tenant_isolation ON logistics.inventory_movements
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY traceability_tenant_isolation ON logistics.traceability
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY uom_tenant_isolation ON logistics.uom
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Items
CREATE INDEX items_tenant_idx ON logistics.items(tenant_id);
CREATE INDEX items_sku_idx ON logistics.items(tenant_id, sku_code);
CREATE INDEX items_status_idx ON logistics.items(status) WHERE status = 'ACTIVE';
CREATE INDEX items_category_idx ON logistics.items(tenant_id, category) WHERE category IS NOT NULL;

-- Locations
CREATE INDEX locations_tenant_idx ON logistics.locations(tenant_id);
CREATE INDEX locations_code_idx ON logistics.locations(tenant_id, location_code);
CREATE INDEX locations_type_idx ON logistics.locations(tenant_id, location_type);
CREATE INDEX locations_parent_idx ON logistics.locations(parent_location_id) WHERE parent_location_id IS NOT NULL;

-- Inventory
CREATE INDEX inventory_tenant_idx ON logistics.inventory(tenant_id);
CREATE INDEX inventory_item_idx ON logistics.inventory(tenant_id, item_id);
CREATE INDEX inventory_location_idx ON logistics.inventory(tenant_id, location_id);
CREATE INDEX inventory_item_location_idx ON logistics.inventory(tenant_id, item_id, location_id);
CREATE INDEX inventory_lot_idx ON logistics.inventory(tenant_id, lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX inventory_serial_idx ON logistics.inventory(tenant_id, serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX inventory_available_idx ON logistics.inventory(tenant_id, item_id) WHERE quantity_available > 0;
CREATE INDEX inventory_expiry_idx ON logistics.inventory(expiry_date) WHERE expiry_date IS NOT NULL;

-- Movements
CREATE INDEX movements_tenant_idx ON logistics.inventory_movements(tenant_id);
CREATE INDEX movements_item_idx ON logistics.inventory_movements(tenant_id, item_id);
CREATE INDEX movements_date_idx ON logistics.inventory_movements(tenant_id, movement_date DESC);
CREATE INDEX movements_type_idx ON logistics.inventory_movements(tenant_id, movement_type);
CREATE INDEX movements_from_location_idx ON logistics.inventory_movements(tenant_id, from_location_id) WHERE from_location_id IS NOT NULL;
CREATE INDEX movements_to_location_idx ON logistics.inventory_movements(tenant_id, to_location_id) WHERE to_location_id IS NOT NULL;
CREATE INDEX movements_lot_idx ON logistics.inventory_movements(tenant_id, lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX movements_serial_idx ON logistics.inventory_movements(tenant_id, serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX movements_source_doc_idx ON logistics.inventory_movements(tenant_id, source_document_type, source_document_id) WHERE source_document_id IS NOT NULL;
CREATE INDEX movements_batch_idx ON logistics.inventory_movements(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX movements_status_idx ON logistics.inventory_movements(status) WHERE status != 'COMPLETED';

-- Traceability
CREATE INDEX traceability_tenant_idx ON logistics.traceability(tenant_id);
CREATE INDEX traceability_item_idx ON logistics.traceability(tenant_id, item_id);
CREATE INDEX traceability_lot_idx ON logistics.traceability(tenant_id, lot_number) WHERE lot_number IS NOT NULL;
CREATE INDEX traceability_serial_idx ON logistics.traceability(tenant_id, serial_number) WHERE serial_number IS NOT NULL;
CREATE INDEX traceability_expiry_idx ON logistics.traceability(expiry_date) WHERE expiry_date IS NOT NULL;
CREATE INDEX traceability_recall_idx ON logistics.traceability(tenant_id, recall_status) WHERE recall_status != 'NONE';

-- UOM
CREATE INDEX uom_tenant_idx ON logistics.uom(tenant_id);
CREATE INDEX uom_code_idx ON logistics.uom(tenant_id, uom_code);

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Reuse Platform's update_updated_at_column() function

-- Apply update triggers (not for movements - immutable)
CREATE TRIGGER items_updated_at 
  BEFORE UPDATE ON logistics.items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER locations_updated_at 
  BEFORE UPDATE ON logistics.locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER inventory_updated_at 
  BEFORE UPDATE ON logistics.inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER traceability_updated_at 
  BEFORE UPDATE ON logistics.traceability
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER uom_updated_at 
  BEFORE UPDATE ON logistics.uom
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Note: inventory_movements has NO update trigger (immutable)

-- ============================================================================
-- END OF LOGISTICS OS DOMAIN KERNEL SCHEMA
-- ============================================================================

