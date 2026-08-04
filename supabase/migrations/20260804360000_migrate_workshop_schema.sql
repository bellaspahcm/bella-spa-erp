-- ============================================================================
-- Bella Auto: Migrate Workshop Tables Schema
-- Purpose: Update existing tables to new simplified schema (non-destructive)
-- Date: 2026-08-04
-- ============================================================================

-- ============================================================================
-- Migrate auto_service_appointments
-- Strategy: Add new columns, keep old ones for compatibility
-- ============================================================================

-- Add scheduled_date (combined from appointment_date + appointment_time)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'scheduled_date'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN scheduled_date TIMESTAMPTZ;
    
    -- Populate scheduled_date from existing appointment_date + appointment_time
    UPDATE auto_service_appointments
    SET scheduled_date = (appointment_date::TEXT || ' ' || appointment_time::TEXT)::TIMESTAMPTZ
    WHERE appointment_date IS NOT NULL;
    
    -- Make it NOT NULL after populating
    ALTER TABLE auto_service_appointments 
    ALTER COLUMN scheduled_date SET NOT NULL;
  END IF;
END $$;

-- Add customer_name and customer_phone (for denormalized queries)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN customer_name TEXT;
    
    -- Populate from customers table (shared with all modules)
    UPDATE auto_service_appointments apt
    SET customer_name = c.name_mother
    FROM customers c
    WHERE apt.customer_id = c.id;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN customer_phone TEXT;
    
    -- Populate from customers table
    UPDATE auto_service_appointments apt
    SET customer_phone = c.phone
    FROM customers c
    WHERE apt.customer_id = c.id;
  END IF;
END $$;

-- Add vehicle_info (denormalized vehicle display string)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'vehicle_info'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN vehicle_info TEXT;
    
    -- Populate from complex JOIN: vehicles → variants → models → brands, plus optional owners for license plate
    UPDATE auto_service_appointments apt
    SET vehicle_info = 
      COALESCE(var.year::TEXT, '') || ' ' ||
      COALESCE(b.name, '') || ' ' ||
      COALESCE(m.name, '') || ' ' ||
      COALESCE(var.name, '') || 
      CASE 
        WHEN vo.license_plate IS NOT NULL THEN ' - ' || vo.license_plate
        ELSE ''
      END
    FROM auto_vehicles v
    LEFT JOIN auto_variants var ON v.variant_id = var.id
    LEFT JOIN auto_models m ON var.model_id = m.id
    LEFT JOIN auto_brands b ON m.brand_id = b.id
    LEFT JOIN auto_vehicle_owners vo ON v.id = vo.vehicle_id AND vo.is_active = true
    WHERE apt.vehicle_id = v.id;
    
    -- Set default for rows without vehicle
    UPDATE auto_service_appointments
    SET vehicle_info = 'Unknown Vehicle'
    WHERE vehicle_info IS NULL;
    
    ALTER TABLE auto_service_appointments 
    ALTER COLUMN vehicle_info SET NOT NULL;
  END IF;
END $$;

-- Add description column if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'description'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN description TEXT;
    
    -- Populate from requested_services or reported_issues
    UPDATE auto_service_appointments
    SET description = COALESCE(requested_services, reported_issues);
  END IF;
END $$;

-- Add estimated_duration_hours if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'estimated_duration_hours'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN estimated_duration_hours NUMERIC(4, 2) DEFAULT 2.0;
    
    -- Convert estimated_duration_minutes to hours
    UPDATE auto_service_appointments
    SET estimated_duration_hours = (estimated_duration_minutes / 60.0)::NUMERIC(4, 2)
    WHERE estimated_duration_minutes IS NOT NULL;
  END IF;
END $$;

-- Add assigned_technician_id if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'assigned_technician_id'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN assigned_technician_id UUID;
  END IF;
END $$;

-- Add notes if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_service_appointments' AND column_name = 'notes'
  ) THEN
    ALTER TABLE auto_service_appointments 
    ADD COLUMN notes TEXT;
    
    -- Combine internal_notes and customer_notes
    UPDATE auto_service_appointments
    SET notes = CONCAT_WS(E'\n---\n', internal_notes, customer_notes)
    WHERE internal_notes IS NOT NULL OR customer_notes IS NOT NULL;
  END IF;
END $$;

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_auto_service_appointments_scheduled ON auto_service_appointments(scheduled_date);

-- ============================================================================
-- Migrate auto_repair_orders
-- Strategy: Add customer_name, customer_phone, vehicle_info for denormalization
-- ============================================================================

-- Add customer_name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_repair_orders' AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE auto_repair_orders 
    ADD COLUMN customer_name TEXT;
    
    UPDATE auto_repair_orders ro
    SET customer_name = c.name_mother
    FROM customers c
    WHERE ro.customer_id = c.id;
    
    UPDATE auto_repair_orders
    SET customer_name = 'Unknown Customer'
    WHERE customer_name IS NULL;
    
    ALTER TABLE auto_repair_orders 
    ALTER COLUMN customer_name SET NOT NULL;
  END IF;
END $$;

-- Add customer_phone
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_repair_orders' AND column_name = 'customer_phone'
  ) THEN
    ALTER TABLE auto_repair_orders 
    ADD COLUMN customer_phone TEXT;
    
    UPDATE auto_repair_orders ro
    SET customer_phone = c.phone
    FROM customers c
    WHERE ro.customer_id = c.id;
  END IF;
END $$;

-- Add vehicle_info
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'auto_repair_orders' AND column_name = 'vehicle_info'
  ) THEN
    ALTER TABLE auto_repair_orders 
    ADD COLUMN vehicle_info TEXT;
    
    UPDATE auto_repair_orders ro
    SET vehicle_info = 
      COALESCE(var.year::TEXT, '') || ' ' ||
      COALESCE(b.name, '') || ' ' ||
      COALESCE(m.name, '') || ' ' ||
      COALESCE(var.name, '') || 
      CASE 
        WHEN vo.license_plate IS NOT NULL THEN ' - ' || vo.license_plate
        ELSE ''
      END
    FROM auto_vehicles v
    LEFT JOIN auto_variants var ON v.variant_id = var.id
    LEFT JOIN auto_models m ON var.model_id = m.id
    LEFT JOIN auto_brands b ON m.brand_id = b.id
    LEFT JOIN auto_vehicle_owners vo ON v.id = vo.vehicle_id AND vo.is_active = true
    WHERE ro.vehicle_id = v.id;
    
    UPDATE auto_repair_orders
    SET vehicle_info = 'Unknown Vehicle'
    WHERE vehicle_info IS NULL;
    
    ALTER TABLE auto_repair_orders 
    ALTER COLUMN vehicle_info SET NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON COLUMN auto_service_appointments.scheduled_date IS 'Combined appointment_date + appointment_time for simpler queries';
COMMENT ON COLUMN auto_service_appointments.customer_name IS 'Denormalized customer name for fast display without joins';
COMMENT ON COLUMN auto_service_appointments.vehicle_info IS 'Denormalized vehicle display string (year make model - plate)';
COMMENT ON COLUMN auto_repair_orders.customer_name IS 'Denormalized customer name';
COMMENT ON COLUMN auto_repair_orders.vehicle_info IS 'Denormalized vehicle display string';
