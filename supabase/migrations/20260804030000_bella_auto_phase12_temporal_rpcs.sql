-- ============================================================================
-- Bella Auto Phase 12: Temporal Query RPCs
-- Created: 2026-08-04
-- Purpose: Query vehicle inventory and journey state at historical points in time
-- Dependencies: 20260803320000_bella_auto_phase12_temporal_history.sql
-- ============================================================================

-- 1. Get vehicle inventory AS OF a specific timestamp
CREATE OR REPLACE FUNCTION public.get_temporal_vehicle_inventory(
  p_tenant_id UUID,
  p_as_of_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  vin TEXT,
  variant_id UUID,
  color_exterior TEXT,
  color_interior TEXT,
  model_year INTEGER,
  list_price NUMERIC(18,0),
  cost_price NUMERIC(18,0),
  status TEXT,
  location_note TEXT,
  allocated_to_contract_id UUID,
  allocated_at TIMESTAMP WITH TIME ZONE,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivered_to_customer_id UUID
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- If querying current time, use main table (faster)
  IF p_as_of_time >= NOW() - INTERVAL '1 hour' THEN
    RETURN QUERY
    SELECT 
      v.id,
      v.vin,
      v.variant_id,
      v.color_exterior,
      v.color_interior,
      v.model_year,
      v.list_price,
      v.cost_price,
      v.status::TEXT,
      v.location_note,
      v.allocated_to_contract_id,
      v.allocated_at,
      v.delivered_at,
      v.delivered_to_customer_id
    FROM auto_vehicles v
    WHERE v.tenant_id = p_tenant_id;
  ELSE
    -- Query historical data
    RETURN QUERY
    SELECT 
      h.id,
      h.vin,
      h.variant_id,
      h.color_exterior,
      h.color_interior,
      h.model_year,
      h.list_price,
      h.cost_price,
      h.status::TEXT,
      h.location_note,
      h.allocated_to_contract_id,
      h.allocated_at,
      h.delivered_at,
      h.delivered_to_customer_id
    FROM auto_vehicles_history h
    WHERE h.tenant_id = p_tenant_id
      AND h.valid_from <= p_as_of_time
      AND (h.valid_to IS NULL OR h.valid_to > p_as_of_time);
  END IF;
END;
$$;

-- 2. Get customer journey state AS OF a specific timestamp
CREATE OR REPLACE FUNCTION public.get_temporal_journey_state(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_as_of_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  customer_id UUID,
  current_stage_id UUID,
  entered_stage_at TIMESTAMP WITH TIME ZONE,
  sla_deadline TIMESTAMP WITH TIME ZONE,
  sla_status TEXT,
  metadata JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  -- If querying current time, use main table
  IF p_as_of_time >= NOW() - INTERVAL '1 hour' THEN
    RETURN QUERY
    SELECT 
      j.id,
      j.customer_id,
      j.current_stage_id,
      j.entered_stage_at,
      j.sla_deadline,
      j.sla_status,
      j.metadata
    FROM auto_customer_journeys j
    WHERE j.tenant_id = p_tenant_id
      AND j.customer_id = p_customer_id;
  ELSE
    -- Query historical data
    RETURN QUERY
    SELECT 
      h.id,
      h.customer_id,
      h.current_stage_id,
      h.entered_stage_at,
      h.sla_deadline,
      h.sla_status,
      h.metadata
    FROM auto_customer_journeys_history h
    WHERE h.tenant_id = p_tenant_id
      AND h.customer_id = p_customer_id
      AND h.valid_from <= p_as_of_time
      AND (h.valid_to IS NULL OR h.valid_to > p_as_of_time);
  END IF;
END;
$$;

-- 3. Get journey event history for a journey
CREATE OR REPLACE FUNCTION public.get_journey_event_history(
  p_tenant_id UUID,
  p_journey_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '90 days',
  p_end_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  journey_id UUID,
  from_stage_id UUID,
  to_stage_id UUID,
  changed_by_user_id UUID,
  duration_hours NUMERIC(10,2),
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id,
    e.journey_id,
    e.from_stage_id,
    e.to_stage_id,
    e.changed_by_user_id,
    e.duration_hours,
    e.reason,
    e.metadata,
    e.created_at
  FROM auto_journey_events e
  WHERE e.tenant_id = p_tenant_id
    AND e.journey_id = p_journey_id
    AND e.created_at >= p_start_time
    AND e.created_at <= p_end_time
  ORDER BY e.created_at DESC;
END;
$$;

-- 4. Get vehicle status history for a specific VIN
CREATE OR REPLACE FUNCTION public.get_vehicle_status_history(
  p_tenant_id UUID,
  p_vehicle_id UUID,
  p_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '90 days',
  p_end_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_to TIMESTAMP WITH TIME ZONE,
  status TEXT,
  location_note TEXT,
  changed_by UUID,
  change_reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.valid_from,
    h.valid_to,
    h.status::TEXT,
    h.location_note,
    h.changed_by,
    h.change_reason
  FROM auto_vehicles_history h
  WHERE h.tenant_id = p_tenant_id
    AND h.id = p_vehicle_id
    AND h.valid_from >= p_start_time
    AND h.valid_from <= p_end_time
  ORDER BY h.valid_from DESC;
END;
$$;

-- 5. Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_temporal_vehicle_inventory(UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_temporal_journey_state(UUID, UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_journey_event_history(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_status_history(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Performance validation queries (run after deployment)
-- SELECT COUNT(*) FROM get_temporal_vehicle_inventory('tenant_id', NOW() - INTERVAL '1 year');
-- SELECT * FROM get_vehicle_status_history('tenant_id', 'vehicle_id', NOW() - INTERVAL '30 days', NOW());
