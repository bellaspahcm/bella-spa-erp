-- Drop old functions first
DROP FUNCTION IF EXISTS public.get_temporal_vehicle_inventory(UUID, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.get_temporal_journey_state(UUID, UUID, TIMESTAMP WITH TIME ZONE);
DROP FUNCTION IF EXISTS public.get_vehicle_status_history(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE);

-- Recreate with correct schema
CREATE OR REPLACE FUNCTION public.get_temporal_vehicle_inventory(
  p_tenant_id UUID,
  p_as_of_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  id UUID,
  vin TEXT,
  variant_id UUID,
  color_exterior TEXT,
  model_year INTEGER,
  status TEXT,
  location_note TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF p_as_of_time >= NOW() - INTERVAL '1 hour' THEN
    RETURN QUERY
    SELECT v.id, v.vin, v.variant_id, v.color_exterior, v.model_year, v.status::TEXT, v.location_note
    FROM auto_vehicles v
    WHERE v.tenant_id = p_tenant_id
    LIMIT 1000;
  ELSE
    RETURN QUERY
    SELECT h.id, h.vin, h.variant_id, h.color_exterior, h.model_year, h.status::TEXT, h.location_note
    FROM auto_vehicles_history h
    WHERE h.tenant_id = p_tenant_id
      AND h.valid_from <= p_as_of_time
      AND (h.valid_to = 'infinity' OR h.valid_to > p_as_of_time)
    LIMIT 1000;
  END IF;
END;
$$;

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
  location_note TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT h.valid_from, h.valid_to, h.status::TEXT, h.location_note
  FROM auto_vehicles_history h
  WHERE h.tenant_id = p_tenant_id
    AND h.id = p_vehicle_id
    AND h.valid_from >= p_start_time
    AND h.valid_from <= p_end_time
  ORDER BY h.valid_from DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_temporal_vehicle_inventory(UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_vehicle_status_history(UUID, UUID, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO authenticated;
