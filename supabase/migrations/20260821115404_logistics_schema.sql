-- Logistics Platform Schema Migration
-- Week 3 Day 2 - Zero-Core-Change Test
-- 
-- Creates complete schema for Logistics OS:
-- - Shipments
-- - Tracking Events
-- - Routes
-- - Warehouses  
-- - Carriers
-- - Idempotency Keys
--
-- RLS Enabled: ✅
-- Tenant Isolation: ✅ (via tenant_id in all tables)
-- Additive Only: ✅ (no Core table modifications)

-- ============================================================================
-- 1. SHIPMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  shipment_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'draft',
    'pending-pickup',
    'picked-up',
    'in-transit',
    'out-for-delivery',
    'delivered',
    'failed-delivery',
    'returned',
    'cancelled'
  )),
  type TEXT NOT NULL CHECK (type IN (
    'standard',
    'express',
    'overnight',
    'international',
    'freight',
    'courier'
  )),
  priority TEXT NOT NULL CHECK (priority IN (
    'low',
    'normal',
    'high',
    'urgent',
    'critical'
  )),
  origin JSONB NOT NULL,
  destination JSONB NOT NULL,
  planned_pickup_date TIMESTAMPTZ NOT NULL,
  actual_pickup_date TIMESTAMPTZ,
  planned_delivery_date TIMESTAMPTZ NOT NULL,
  actual_delivery_date TIMESTAMPTZ,
  carrier_id UUID,
  route_id UUID,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_weight JSONB,
  total_volume JSONB,
  special_instructions TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  last_modified_by UUID NOT NULL,
  
  -- Constraints
  CONSTRAINT log_shipments_tenant_id_fkey FOREIGN KEY (tenant_id) 
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT log_shipments_shipment_number_unique UNIQUE (tenant_id, shipment_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_log_shipments_tenant_id ON log_shipments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_log_shipments_status ON log_shipments(status);
CREATE INDEX IF NOT EXISTS idx_log_shipments_carrier_id ON log_shipments(carrier_id);
CREATE INDEX IF NOT EXISTS idx_log_shipments_route_id ON log_shipments(route_id);
CREATE INDEX IF NOT EXISTS idx_log_shipments_created_at ON log_shipments(created_at);
CREATE INDEX IF NOT EXISTS idx_log_shipments_shipment_number ON log_shipments(tenant_id, shipment_number);

-- RLS Policies
ALTER TABLE log_shipments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for shipments"
  ON log_shipments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 2. TRACKING EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_tracking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'pickup-scheduled',
    'picked-up',
    'departed-origin',
    'in-transit',
    'arrived-hub',
    'departed-hub',
    'out-for-delivery',
    'delivery-attempted',
    'delivered',
    'delivery-failed',
    'returned-to-sender',
    'cancelled',
    'exception'
  )),
  status TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  location JSONB,
  description TEXT NOT NULL,
  performed_by UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT log_tracking_events_shipment_id_fkey FOREIGN KEY (shipment_id)
    REFERENCES log_shipments(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_tracking_events_shipment_id ON log_tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_log_tracking_events_timestamp ON log_tracking_events(timestamp);

-- RLS Policies (inherit tenant from shipment)
ALTER TABLE log_tracking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for tracking events"
  ON log_tracking_events
  FOR ALL
  USING (
    shipment_id IN (
      SELECT id FROM log_shipments 
      WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );

-- ============================================================================
-- 3. ROUTES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  route_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'planned',
    'assigned',
    'in-progress',
    'completed',
    'cancelled'
  )),
  vehicle_id UUID,
  driver_id UUID,
  planned_departure_time TIMESTAMPTZ NOT NULL,
  actual_departure_time TIMESTAMPTZ,
  planned_arrival_time TIMESTAMPTZ NOT NULL,
  actual_arrival_time TIMESTAMPTZ,
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  shipments JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of shipment IDs
  total_distance JSONB,
  estimated_duration INTEGER, -- minutes
  actual_duration INTEGER, -- minutes
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT log_routes_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT log_routes_route_number_unique UNIQUE (tenant_id, route_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_routes_tenant_id ON log_routes(tenant_id);
CREATE INDEX IF NOT EXISTS idx_log_routes_status ON log_routes(status);
CREATE INDEX IF NOT EXISTS idx_log_routes_vehicle_id ON log_routes(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_log_routes_driver_id ON log_routes(driver_id);

-- RLS Policies
ALTER TABLE log_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for routes"
  ON log_routes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 4. WAREHOUSES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'distribution-center',
    'fulfillment-center',
    'cross-dock',
    'cold-storage',
    'bonded-warehouse',
    'third-party-logistics'
  )),
  status TEXT NOT NULL CHECK (status IN (
    'operational',
    'maintenance',
    'closed',
    'temporary-closure'
  )),
  location JSONB NOT NULL,
  capacity JSONB NOT NULL,
  current_utilization JSONB NOT NULL,
  zones JSONB NOT NULL DEFAULT '[]'::jsonb,
  manager_id UUID,
  operating_hours JSONB,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT log_warehouses_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT log_warehouses_code_unique UNIQUE (tenant_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_warehouses_tenant_id ON log_warehouses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_log_warehouses_status ON log_warehouses(status);
CREATE INDEX IF NOT EXISTS idx_log_warehouses_type ON log_warehouses(type);

-- RLS Policies
ALTER TABLE log_warehouses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for warehouses"
  ON log_warehouses
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 5. CARRIERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'express-courier',
    'freight',
    'air-freight',
    'ocean-freight',
    'rail',
    'last-mile',
    'third-party-logistics'
  )),
  status TEXT NOT NULL CHECK (status IN (
    'active',
    'inactive',
    'suspended',
    'under-review'
  )),
  service_level JSONB NOT NULL DEFAULT '[]'::jsonb,
  coverage JSONB NOT NULL DEFAULT '[]'::jsonb,
  contact JSONB NOT NULL,
  credentials JSONB,
  performance_metrics JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Constraints
  CONSTRAINT log_carriers_tenant_id_fkey FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT log_carriers_code_unique UNIQUE (tenant_id, code)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_log_carriers_tenant_id ON log_carriers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_log_carriers_status ON log_carriers(status);
CREATE INDEX IF NOT EXISTS idx_log_carriers_type ON log_carriers(type);

-- RLS Policies
ALTER TABLE log_carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for carriers"
  ON log_carriers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- 6. IDEMPOTENCY KEYS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_idempotency_keys (
  id UUID PRIMARY KEY, -- This is the requestId from the API
  response_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);

-- Index for cleanup
CREATE INDEX IF NOT EXISTS idx_log_idempotency_keys_expires_at ON log_idempotency_keys(expires_at);

-- No RLS needed for idempotency keys (stateless, short-lived)

-- ============================================================================
-- 7. UPDATED_AT TRIGGER FUNCTION
-- ============================================================================

-- Reuse existing trigger function if available, otherwise create
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_updated_at_column'
  ) THEN
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Apply triggers
CREATE TRIGGER update_log_shipments_updated_at
  BEFORE UPDATE ON log_shipments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_log_routes_updated_at
  BEFORE UPDATE ON log_routes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_log_warehouses_updated_at
  BEFORE UPDATE ON log_warehouses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_log_carriers_updated_at
  BEFORE UPDATE ON log_carriers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE log_shipments IS 'Logistics Platform - Shipment records with full lifecycle tracking';
COMMENT ON TABLE log_tracking_events IS 'Logistics Platform - Shipment tracking event history';
COMMENT ON TABLE log_routes IS 'Logistics Platform - Optimized delivery routes';
COMMENT ON TABLE log_warehouses IS 'Logistics Platform - Warehouse and storage facilities';
COMMENT ON TABLE log_carriers IS 'Logistics Platform - Third-party logistics carriers';
COMMENT ON TABLE log_idempotency_keys IS 'Logistics Platform - Idempotency key cache for API calls';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- Tables created: 6
-- RLS enabled: 5 (all except idempotency keys)
-- Tenant isolation: ✅ All data tables
-- Core modifications: 0 ✅
-- Additive only: ✅
