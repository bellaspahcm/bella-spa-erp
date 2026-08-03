-- =====================================================================================
-- Phase 12: Temporal History ("As of" Queries)
-- Purpose: Time-travel debugging and compliance
-- Impact: 8.5/10 → 10/10 Temporal Data
-- =====================================================================================

-- =====================================================================================
-- PART 1: TEMPORAL TABLES FOR CRITICAL ENTITIES
-- =====================================================================================

-- 1. Vehicles temporal history
CREATE TABLE auto_vehicles_history (
  -- All columns from auto_vehicles
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  variant_id UUID NOT NULL,
  vin TEXT NOT NULL,
  chassis_number TEXT,
  engine_number TEXT,
  color_exterior TEXT NOT NULL,
  color_interior TEXT,
  model_year INTEGER NOT NULL,
  list_price NUMERIC(18,0),
  cost_price NUMERIC(18,0),
  status TEXT NOT NULL,
  location_note TEXT,
  allocated_to_contract_id UUID,
  allocated_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivered_to_customer_id UUID,
  
  -- Temporal columns
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL DEFAULT 'infinity',
  
  -- Audit
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  
  PRIMARY KEY (id, valid_from)
);

CREATE INDEX idx_auto_vehicles_history_temporal 
  ON auto_vehicles_history(id, valid_from, valid_to);
CREATE INDEX idx_auto_vehicles_history_valid_at 
  ON auto_vehicles_history USING GIST (tstzrange(valid_from, valid_to));

-- Temporal trigger for auto_vehicles
CREATE OR REPLACE FUNCTION temporal_snapshot_auto_vehicles()
RETURNS TRIGGER AS $$
BEGIN
  -- Close previous version
  UPDATE auto_vehicles_history
  SET valid_to = NOW()
  WHERE id = OLD.id AND valid_to = 'infinity';
  
  -- Insert new version
  INSERT INTO auto_vehicles_history (
    id, tenant_id, variant_id, vin, chassis_number, engine_number,
    color_exterior, color_interior, model_year,
    list_price, cost_price, status, location_note,
    allocated_to_contract_id, allocated_at, delivered_at, delivered_to_customer_id,
    valid_from, changed_by
  )
  VALUES (
    OLD.id, OLD.tenant_id, OLD.variant_id, OLD.vin, OLD.chassis_number, OLD.engine_number,
    OLD.color_exterior, OLD.color_interior, OLD.model_year,
    OLD.list_price, OLD.cost_price, OLD.status, OLD.location_note,
    OLD.allocated_to_contract_id, OLD.allocated_at, OLD.delivered_at, OLD.delivered_to_customer_id,
    NOW(), NULLIF(current_setting('app.current_user_id', true), '')::UUID
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_vehicles_temporal_trigger
BEFORE UPDATE ON auto_vehicles
FOR EACH ROW
EXECUTE FUNCTION temporal_snapshot_auto_vehicles();

-- 2. Bookings temporal history
CREATE TABLE auto_bookings_history (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  customer_id UUID,
  variant_id UUID,
  vehicle_id UUID,
  status TEXT NOT NULL,
  total_price NUMERIC(15,2),
  deposit_amount NUMERIC(15,2),
  
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL DEFAULT 'infinity',
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  
  PRIMARY KEY (id, valid_from)
);

CREATE INDEX idx_auto_bookings_history_temporal 
  ON auto_bookings_history(id, valid_from, valid_to);

CREATE OR REPLACE FUNCTION temporal_snapshot_auto_bookings()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auto_bookings_history
  SET valid_to = NOW()
  WHERE id = OLD.id AND valid_to = 'infinity';
  
  INSERT INTO auto_bookings_history (
    id, tenant_id, customer_id, variant_id, vehicle_id,
    status, total_price, deposit_amount,
    valid_from, changed_by
  )
  VALUES (
    OLD.id, OLD.tenant_id, OLD.customer_id, OLD.variant_id, OLD.vehicle_id,
    OLD.status, OLD.total_price, OLD.deposit_amount,
    NOW(), NULLIF(current_setting('app.current_user_id', true), '')::UUID
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_bookings_temporal_trigger
BEFORE UPDATE ON auto_bookings
FOR EACH ROW
EXECUTE FUNCTION temporal_snapshot_auto_bookings();

-- 3. Customer Journeys temporal history
CREATE TABLE auto_customer_journeys_history (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  customer_id UUID,
  current_stage_id UUID,
  entered_stage_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,
  sla_status TEXT,
  
  valid_from TIMESTAMPTZ NOT NULL,
  valid_to TIMESTAMPTZ NOT NULL DEFAULT 'infinity',
  changed_by UUID REFERENCES users(id),
  change_reason TEXT,
  
  PRIMARY KEY (id, valid_from)
);

CREATE INDEX idx_auto_journeys_history_temporal 
  ON auto_customer_journeys_history(id, valid_from, valid_to);

CREATE OR REPLACE FUNCTION temporal_snapshot_auto_customer_journeys()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE auto_customer_journeys_history
  SET valid_to = NOW()
  WHERE id = OLD.id AND valid_to = 'infinity';
  
  INSERT INTO auto_customer_journeys_history (
    id, tenant_id, customer_id, current_stage_id,
    entered_stage_at, sla_deadline, sla_status,
    valid_from, changed_by
  )
  VALUES (
    OLD.id, OLD.tenant_id, OLD.customer_id, OLD.current_stage_id,
    OLD.entered_stage_at, OLD.sla_deadline, OLD.sla_status,
    NOW(), NULLIF(current_setting('app.current_user_id', true), '')::UUID
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_customer_journeys_temporal_trigger
BEFORE UPDATE ON auto_customer_journeys
FOR EACH ROW
EXECUTE FUNCTION temporal_snapshot_auto_customer_journeys();

-- =====================================================================================
-- PART 2: RPC FUNCTIONS FOR "AS OF" QUERIES
-- =====================================================================================

-- Get vehicle as of date
CREATE OR REPLACE FUNCTION get_vehicle_as_of(
  p_entity_id UUID,
  p_as_of_date TIMESTAMPTZ,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  variant_id UUID,
  vin TEXT,
  chassis_number TEXT,
  engine_number TEXT,
  color_exterior TEXT,
  color_interior TEXT,
  model_year INTEGER,
  list_price NUMERIC,
  cost_price NUMERIC,
  status TEXT,
  location_note TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT id, tenant_id, variant_id, vin, chassis_number, engine_number,
         color_exterior, color_interior, model_year, list_price, cost_price,
         status, location_note
  FROM auto_vehicles_history
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
    AND valid_from <= p_as_of_date
    AND valid_to > p_as_of_date
  
  UNION ALL
  
  SELECT id, tenant_id, variant_id, vin, chassis_number, engine_number,
         color_exterior, color_interior, model_year, list_price, cost_price,
         status::TEXT, location_note
  FROM auto_vehicles
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM auto_vehicles_history h
      WHERE h.id = p_entity_id
        AND h.valid_from <= p_as_of_date
        AND h.valid_to > p_as_of_date
    )
  LIMIT 1;
$$;

-- Get booking as of date
CREATE OR REPLACE FUNCTION get_booking_as_of(
  p_entity_id UUID,
  p_as_of_date TIMESTAMPTZ,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  variant_id UUID,
  vehicle_id UUID,
  status TEXT,
  total_price NUMERIC,
  deposit_amount NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT id, tenant_id, customer_id, variant_id, vehicle_id, status, total_price, deposit_amount
  FROM auto_bookings_history
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
    AND valid_from <= p_as_of_date
    AND valid_to > p_as_of_date
  
  UNION ALL
  
  SELECT id, tenant_id, customer_id, variant_id, vehicle_id, status, total_price, deposit_amount
  FROM auto_bookings
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM auto_bookings_history h
      WHERE h.id = p_entity_id
        AND h.valid_from <= p_as_of_date
        AND h.valid_to > p_as_of_date
    )
  LIMIT 1;
$$;

-- Get journey as of date
CREATE OR REPLACE FUNCTION get_journey_as_of(
  p_entity_id UUID,
  p_as_of_date TIMESTAMPTZ,
  p_tenant_id UUID
)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  customer_id UUID,
  current_stage_id UUID,
  sla_status TEXT
)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT id, tenant_id, customer_id, current_stage_id, sla_status
  FROM auto_customer_journeys_history
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
    AND valid_from <= p_as_of_date
    AND valid_to > p_as_of_date
  
  UNION ALL
  
  SELECT id, tenant_id, customer_id, current_stage_id, sla_status
  FROM auto_customer_journeys
  WHERE id = p_entity_id
    AND tenant_id = p_tenant_id
    AND NOT EXISTS (
      SELECT 1 FROM auto_customer_journeys_history h
      WHERE h.id = p_entity_id
        AND h.valid_from <= p_as_of_date
        AND h.valid_to > p_as_of_date
    )
  LIMIT 1;
$$;

-- GRANT permissions
GRANT EXECUTE ON FUNCTION get_vehicle_as_of(UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_booking_as_of(UUID, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_journey_as_of(UUID, TIMESTAMPTZ, UUID) TO authenticated;

-- =====================================================================================
-- COMMENTS
-- =====================================================================================

COMMENT ON TABLE auto_vehicles_history IS 'Temporal history for vehicles - time-travel queries';
COMMENT ON TABLE auto_bookings_history IS 'Temporal history for bookings - time-travel queries';
COMMENT ON TABLE auto_customer_journeys_history IS 'Temporal history for journeys - time-travel queries';

COMMENT ON COLUMN auto_vehicles_history.valid_from IS 'Start of validity period';
COMMENT ON COLUMN auto_vehicles_history.valid_to IS 'End of validity period (infinity for current)';
COMMENT ON COLUMN auto_vehicles_history.changed_by IS 'User who made the change';
COMMENT ON COLUMN auto_vehicles_history.change_reason IS 'Reason for the change (optional)';
