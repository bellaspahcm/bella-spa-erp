-- =====================================================
-- Phase 6: Workshop & Service Center
-- Migration: Bella Auto - Service Appointments, Repair Orders, Warranty
-- =====================================================

-- =====================================================
-- 1. Service Packages (Predefined maintenance packages)
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_service_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Package Info
  code VARCHAR(50) NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  service_type VARCHAR(50) NOT NULL, -- 'routine_maintenance', 'major_service', 'minor_service', 'inspection', 'repair'
  
  -- Pricing
  base_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  estimated_duration_minutes INT NOT NULL DEFAULT 60,
  
  -- Package Details
  included_services JSONB DEFAULT '[]', -- Array of service items
  required_parts JSONB DEFAULT '[]', -- Array of parts typically needed
  
  -- Applicability
  applicable_brands JSONB DEFAULT '[]', -- Empty = all brands
  applicable_models JSONB DEFAULT '[]', -- Empty = all models
  mileage_interval INT, -- Service interval by mileage (km)
  time_interval_months INT, -- Service interval by time
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  
  UNIQUE(tenant_id, code)
);

-- Indexes
CREATE INDEX idx_auto_service_packages_tenant ON auto_service_packages(tenant_id);
CREATE INDEX idx_auto_service_packages_type ON auto_service_packages(service_type);
CREATE INDEX idx_auto_service_packages_active ON auto_service_packages(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE auto_service_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_service_packages_tenant_isolation ON auto_service_packages
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 2. Service Appointments (Booking & Scheduling)
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_service_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Appointment Reference
  appointment_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Customer & Vehicle
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES auto_vehicles(id) ON DELETE RESTRICT,
  
  -- Appointment Details
  appointment_date DATE NOT NULL,
  appointment_time TIME NOT NULL,
  estimated_duration_minutes INT DEFAULT 60,
  
  -- Service Type
  service_package_id UUID REFERENCES auto_service_packages(id) ON DELETE SET NULL,
  service_type VARCHAR(50) NOT NULL,
  requested_services TEXT NOT NULL, -- Customer description
  
  -- Vehicle Condition
  current_mileage INT,
  reported_issues TEXT,
  
  -- Assignment
  service_advisor_id UUID, -- Service consultant assigned
  assigned_bay VARCHAR(50), -- Workshop bay/station
  assigned_technicians JSONB DEFAULT '[]', -- Array of technician IDs
  
  -- Status & Lifecycle
  status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'
  confirmed_at TIMESTAMPTZ,
  checked_in_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  vehicle_delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Pricing
  estimated_cost NUMERIC(15,2),
  final_cost NUMERIC(15,2),
  
  -- Customer Communication
  reminder_sent BOOLEAN DEFAULT false,
  reminder_sent_at TIMESTAMPTZ,
  
  -- Notes
  internal_notes TEXT,
  customer_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_auto_service_appointments_tenant ON auto_service_appointments(tenant_id);
CREATE INDEX idx_auto_service_appointments_customer ON auto_service_appointments(customer_id);
CREATE INDEX idx_auto_service_appointments_vehicle ON auto_service_appointments(vehicle_id);
CREATE INDEX idx_auto_service_appointments_date ON auto_service_appointments(appointment_date, appointment_time);
CREATE INDEX idx_auto_service_appointments_status ON auto_service_appointments(status);
CREATE INDEX idx_auto_service_appointments_advisor ON auto_service_appointments(service_advisor_id);

-- RLS
ALTER TABLE auto_service_appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_service_appointments_tenant_isolation ON auto_service_appointments
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 3. Repair Orders / Job Cards
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_repair_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Order Reference
  order_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Link to Appointment
  appointment_id UUID REFERENCES auto_service_appointments(id) ON DELETE SET NULL,
  
  -- Customer & Vehicle
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  vehicle_id UUID NOT NULL REFERENCES auto_vehicles(id) ON DELETE RESTRICT,
  
  -- Order Details
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  order_type VARCHAR(50) NOT NULL, -- 'maintenance', 'repair', 'warranty', 'recall'
  
  -- Vehicle State
  mileage_in INT,
  fuel_level VARCHAR(20), -- '1/4', '1/2', '3/4', 'full'
  vehicle_condition_notes TEXT,
  
  -- Work Description
  work_description TEXT NOT NULL,
  customer_complaints JSONB DEFAULT '[]', -- Array of complaint objects
  diagnosis_notes TEXT,
  
  -- Assignment
  service_advisor_id UUID,
  primary_technician_id UUID,
  additional_technicians JSONB DEFAULT '[]',
  bay_number VARCHAR(50),
  
  -- Status & Timeline
  status VARCHAR(50) DEFAULT 'open', -- 'open', 'diagnosed', 'approved', 'in_progress', 'quality_check', 'completed', 'invoiced', 'delivered', 'cancelled'
  opened_at TIMESTAMPTZ DEFAULT now(),
  diagnosed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  work_started_at TIMESTAMPTZ,
  work_completed_at TIMESTAMPTZ,
  quality_checked_at TIMESTAMPTZ,
  invoiced_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Approval
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID,
  approval_notes TEXT,
  
  -- Costing
  estimated_labor_cost NUMERIC(15,2) DEFAULT 0,
  estimated_parts_cost NUMERIC(15,2) DEFAULT 0,
  estimated_total NUMERIC(15,2) DEFAULT 0,
  
  actual_labor_cost NUMERIC(15,2) DEFAULT 0,
  actual_parts_cost NUMERIC(15,2) DEFAULT 0,
  actual_total NUMERIC(15,2) DEFAULT 0,
  
  -- Labor Hours
  estimated_hours NUMERIC(5,2) DEFAULT 0,
  actual_hours NUMERIC(5,2) DEFAULT 0,
  
  -- Warranty Info
  is_warranty_work BOOLEAN DEFAULT false,
  warranty_claim_id UUID,
  
  -- Quality Control
  quality_check_passed BOOLEAN,
  quality_check_notes TEXT,
  quality_checked_by UUID,
  
  -- Customer Communication
  customer_informed BOOLEAN DEFAULT false,
  customer_approved BOOLEAN DEFAULT false,
  customer_approval_date TIMESTAMPTZ,
  
  -- Notes
  internal_notes TEXT,
  technician_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_auto_repair_orders_tenant ON auto_repair_orders(tenant_id);
CREATE INDEX idx_auto_repair_orders_customer ON auto_repair_orders(customer_id);
CREATE INDEX idx_auto_repair_orders_vehicle ON auto_repair_orders(vehicle_id);
CREATE INDEX idx_auto_repair_orders_appointment ON auto_repair_orders(appointment_id);
CREATE INDEX idx_auto_repair_orders_status ON auto_repair_orders(status);
CREATE INDEX idx_auto_repair_orders_technician ON auto_repair_orders(primary_technician_id);
CREATE INDEX idx_auto_repair_orders_date ON auto_repair_orders(order_date);

-- RLS
ALTER TABLE auto_repair_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_repair_orders_tenant_isolation ON auto_repair_orders
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 4. Repair Order Line Items (Services & Parts)
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_repair_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Order Reference
  repair_order_id UUID NOT NULL REFERENCES auto_repair_orders(id) ON DELETE CASCADE,
  
  -- Item Details
  item_type VARCHAR(20) NOT NULL, -- 'service', 'part', 'labor'
  item_code VARCHAR(100),
  item_name VARCHAR(200) NOT NULL,
  description TEXT,
  
  -- Quantity & Pricing
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(15,2) NOT NULL DEFAULT 0,
  discount_percentage NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  subtotal NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(15,2) DEFAULT 0,
  total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  
  -- Labor Specific
  labor_hours NUMERIC(5,2),
  hourly_rate NUMERIC(15,2),
  
  -- Part Specific
  part_number VARCHAR(100),
  inventory_item_id UUID, -- Link to inventory if tracked
  
  -- Warranty
  is_warranty_covered BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'completed', 'invoiced'
  
  -- Technician
  performed_by UUID,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auto_repair_order_items_tenant ON auto_repair_order_items(tenant_id);
CREATE INDEX idx_auto_repair_order_items_order ON auto_repair_order_items(repair_order_id);
CREATE INDEX idx_auto_repair_order_items_type ON auto_repair_order_items(item_type);

-- RLS
ALTER TABLE auto_repair_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_repair_order_items_tenant_isolation ON auto_repair_order_items
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 5. Service History (Immutable Record)
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_service_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Vehicle Reference (CRITICAL - never delete)
  vehicle_id UUID NOT NULL REFERENCES auto_vehicles(id) ON DELETE RESTRICT,
  vin VARCHAR(17) NOT NULL, -- Denormalized for safety
  
  -- Service Reference
  repair_order_id UUID REFERENCES auto_repair_orders(id) ON DELETE SET NULL,
  appointment_id UUID REFERENCES auto_service_appointments(id) ON DELETE SET NULL,
  
  -- Service Details
  service_date DATE NOT NULL,
  service_type VARCHAR(50) NOT NULL,
  service_description TEXT NOT NULL,
  
  -- Mileage
  mileage INT NOT NULL,
  
  -- Work Performed
  services_performed JSONB NOT NULL DEFAULT '[]', -- Array of service items
  parts_replaced JSONB DEFAULT '[]', -- Array of parts with details
  
  -- Labor
  labor_hours NUMERIC(5,2),
  technician_ids JSONB DEFAULT '[]',
  
  -- Cost (Historical record)
  labor_cost NUMERIC(15,2),
  parts_cost NUMERIC(15,2),
  total_cost NUMERIC(15,2),
  
  -- Warranty Info
  is_warranty_service BOOLEAN DEFAULT false,
  warranty_expiry_date DATE,
  warranty_mileage_limit INT,
  
  -- Service Provider
  service_advisor_id UUID,
  workshop_location VARCHAR(200),
  
  -- Quality & Completion
  quality_rating INT CHECK (quality_rating >= 1 AND quality_rating <= 5),
  customer_feedback TEXT,
  
  -- Next Service Recommendation
  next_service_due_date DATE,
  next_service_due_mileage INT,
  
  -- Immutability Enforcement
  is_locked BOOLEAN DEFAULT true, -- Locked by default
  locked_at TIMESTAMPTZ DEFAULT now(),
  locked_by UUID,
  
  -- Audit Trail
  recorded_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  recorded_by UUID NOT NULL,
  
  -- NO UPDATE OR DELETE - Audit only
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX idx_auto_service_history_tenant ON auto_service_history(tenant_id);
CREATE INDEX idx_auto_service_history_vehicle ON auto_service_history(vehicle_id);
CREATE INDEX idx_auto_service_history_vin ON auto_service_history(vin);
CREATE INDEX idx_auto_service_history_date ON auto_service_history(service_date DESC);
CREATE INDEX idx_auto_service_history_mileage ON auto_service_history(mileage);

-- RLS
ALTER TABLE auto_service_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_service_history_tenant_isolation ON auto_service_history
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Prevent updates and deletes on service history
CREATE POLICY auto_service_history_no_update ON auto_service_history
  FOR UPDATE USING (false);

CREATE POLICY auto_service_history_no_delete ON auto_service_history
  FOR DELETE USING (false);

-- =====================================================
-- 6. Warranty Claims
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_warranty_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Claim Reference
  claim_number VARCHAR(50) UNIQUE NOT NULL,
  
  -- Vehicle & Customer
  vehicle_id UUID NOT NULL REFERENCES auto_vehicles(id) ON DELETE RESTRICT,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  
  -- Claim Details
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claim_type VARCHAR(50) NOT NULL, -- 'manufacturer_warranty', 'extended_warranty', 'goodwill', 'recall'
  
  -- Issue Description
  issue_description TEXT NOT NULL,
  failure_date DATE,
  failure_mileage INT,
  
  -- Warranty Validation
  warranty_type VARCHAR(50), -- 'powertrain', 'bumper_to_bumper', 'corrosion', 'emission'
  warranty_start_date DATE,
  warranty_end_date DATE,
  warranty_mileage_limit INT,
  is_within_warranty BOOLEAN,
  
  -- Coverage
  is_covered BOOLEAN,
  coverage_percentage NUMERIC(5,2) DEFAULT 100.00,
  denial_reason TEXT,
  
  -- Repair Order Link
  repair_order_id UUID REFERENCES auto_repair_orders(id) ON DELETE SET NULL,
  
  -- Parts Covered
  parts_covered JSONB DEFAULT '[]',
  labor_covered BOOLEAN DEFAULT true,
  
  -- Claim Amount
  parts_claimed NUMERIC(15,2) DEFAULT 0,
  labor_claimed NUMERIC(15,2) DEFAULT 0,
  total_claimed NUMERIC(15,2) DEFAULT 0,
  
  parts_approved NUMERIC(15,2) DEFAULT 0,
  labor_approved NUMERIC(15,2) DEFAULT 0,
  total_approved NUMERIC(15,2) DEFAULT 0,
  
  customer_responsibility NUMERIC(15,2) DEFAULT 0,
  
  -- Status & Approval
  status VARCHAR(50) DEFAULT 'submitted', -- 'submitted', 'under_review', 'approved', 'partially_approved', 'denied', 'paid', 'closed'
  
  submitted_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  
  -- Approvers
  reviewed_by UUID,
  approved_by UUID,
  
  -- Documentation
  supporting_documents JSONB DEFAULT '[]', -- URLs to photos, reports
  manufacturer_case_number VARCHAR(100),
  
  -- Notes
  internal_notes TEXT,
  reviewer_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_auto_warranty_claims_tenant ON auto_warranty_claims(tenant_id);
CREATE INDEX idx_auto_warranty_claims_vehicle ON auto_warranty_claims(vehicle_id);
CREATE INDEX idx_auto_warranty_claims_customer ON auto_warranty_claims(customer_id);
CREATE INDEX idx_auto_warranty_claims_status ON auto_warranty_claims(status);
CREATE INDEX idx_auto_warranty_claims_date ON auto_warranty_claims(claim_date);
CREATE INDEX idx_auto_warranty_claims_repair_order ON auto_warranty_claims(repair_order_id);

-- RLS
ALTER TABLE auto_warranty_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_warranty_claims_tenant_isolation ON auto_warranty_claims
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 7. Technician Time Logs
-- =====================================================

CREATE TABLE IF NOT EXISTS auto_technician_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Repair Order Reference
  repair_order_id UUID NOT NULL REFERENCES auto_repair_orders(id) ON DELETE CASCADE,
  
  -- Technician
  technician_id UUID NOT NULL,
  technician_name VARCHAR(200),
  
  -- Time Tracking
  clock_in_time TIMESTAMPTZ NOT NULL,
  clock_out_time TIMESTAMPTZ,
  total_hours NUMERIC(5,2),
  
  -- Work Details
  work_description TEXT,
  line_item_id UUID REFERENCES auto_repair_order_items(id) ON DELETE SET NULL,
  
  -- Status
  is_billable BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_auto_technician_time_logs_tenant ON auto_technician_time_logs(tenant_id);
CREATE INDEX idx_auto_technician_time_logs_order ON auto_technician_time_logs(repair_order_id);
CREATE INDEX idx_auto_technician_time_logs_tech ON auto_technician_time_logs(technician_id);
CREATE INDEX idx_auto_technician_time_logs_date ON auto_technician_time_logs(clock_in_time);

-- RLS
ALTER TABLE auto_technician_time_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_technician_time_logs_tenant_isolation ON auto_technician_time_logs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- 8. Trigger Functions & Automation
-- =====================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_auto_service_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_service_packages_updated
  BEFORE UPDATE ON auto_service_packages
  FOR EACH ROW EXECUTE FUNCTION update_auto_service_timestamp();

CREATE TRIGGER auto_service_appointments_updated
  BEFORE UPDATE ON auto_service_appointments
  FOR EACH ROW EXECUTE FUNCTION update_auto_service_timestamp();

CREATE TRIGGER auto_repair_orders_updated
  BEFORE UPDATE ON auto_repair_orders
  FOR EACH ROW EXECUTE FUNCTION update_auto_service_timestamp();

CREATE TRIGGER auto_repair_order_items_updated
  BEFORE UPDATE ON auto_repair_order_items
  FOR EACH ROW EXECUTE FUNCTION update_auto_service_timestamp();

CREATE TRIGGER auto_warranty_claims_updated
  BEFORE UPDATE ON auto_warranty_claims
  FOR EACH ROW EXECUTE FUNCTION update_auto_service_timestamp();

CREATE TRIGGER auto_technician_time_logs_updated
  BEFORE UPDATE ON auto_technician_time_logs
  FOR EACH ROW EXECUTE FUNCTION update_auto_service_timestamp();

-- Auto-calculate repair order item totals
CREATE OR REPLACE FUNCTION calculate_repair_order_item_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate subtotal
  NEW.subtotal = NEW.quantity * NEW.unit_price;
  
  -- Apply discount
  IF NEW.discount_percentage > 0 THEN
    NEW.discount_amount = NEW.subtotal * (NEW.discount_percentage / 100);
  END IF;
  
  -- Calculate total after discount
  NEW.total_amount = NEW.subtotal - NEW.discount_amount + COALESCE(NEW.tax_amount, 0);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_repair_order_items_calculate_total
  BEFORE INSERT OR UPDATE OF quantity, unit_price, discount_percentage, discount_amount, tax_amount
  ON auto_repair_order_items
  FOR EACH ROW EXECUTE FUNCTION calculate_repair_order_item_total();

-- Auto-calculate technician hours
CREATE OR REPLACE FUNCTION calculate_technician_hours()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clock_out_time IS NOT NULL THEN
    NEW.total_hours = EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600.0;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_technician_time_logs_calculate_hours
  BEFORE INSERT OR UPDATE OF clock_in_time, clock_out_time
  ON auto_technician_time_logs
  FOR EACH ROW EXECUTE FUNCTION calculate_technician_hours();

-- =====================================================
-- 9. Generate Unique Numbers
-- =====================================================

CREATE OR REPLACE FUNCTION generate_appointment_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_date VARCHAR := TO_CHAR(NOW(), 'YYYYMMDD');
  v_sequence INT;
  v_number VARCHAR;
BEGIN
  -- Get next sequence for today
  SELECT COUNT(*) + 1 INTO v_sequence
  FROM auto_service_appointments
  WHERE tenant_id = p_tenant_id
    AND appointment_date = CURRENT_DATE;
  
  v_number := 'APT' || v_date || '-' || LPAD(v_sequence::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_repair_order_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_date VARCHAR := TO_CHAR(NOW(), 'YYYYMMDD');
  v_sequence INT;
  v_number VARCHAR;
BEGIN
  -- Get next sequence for today
  SELECT COUNT(*) + 1 INTO v_sequence
  FROM auto_repair_orders
  WHERE tenant_id = p_tenant_id
    AND order_date = CURRENT_DATE;
  
  v_number := 'RO' || v_date || '-' || LPAD(v_sequence::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_warranty_claim_number(p_tenant_id UUID)
RETURNS VARCHAR AS $$
DECLARE
  v_date VARCHAR := TO_CHAR(NOW(), 'YYYYMMDD');
  v_sequence INT;
  v_number VARCHAR;
BEGIN
  -- Get next sequence for today
  SELECT COUNT(*) + 1 INTO v_sequence
  FROM auto_warranty_claims
  WHERE tenant_id = p_tenant_id
    AND claim_date = CURRENT_DATE;
  
  v_number := 'WC' || v_date || '-' || LPAD(v_sequence::TEXT, 4, '0');
  RETURN v_number;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Comments
-- =====================================================

COMMENT ON TABLE auto_service_packages IS 'Predefined service packages (oil change, major service, etc.)';
COMMENT ON TABLE auto_service_appointments IS 'Customer appointments for service/repair bookings';
COMMENT ON TABLE auto_repair_orders IS 'Work orders / job cards for repairs and maintenance';
COMMENT ON TABLE auto_repair_order_items IS 'Line items for services, parts, and labor in repair orders';
COMMENT ON TABLE auto_service_history IS 'IMMUTABLE service history linked to VIN - cannot be modified or deleted';
COMMENT ON TABLE auto_warranty_claims IS 'Warranty claim processing and approval workflow';
COMMENT ON TABLE auto_technician_time_logs IS 'Time tracking for technician labor hours';
