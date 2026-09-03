/**
 * E3 Economics Experiment - R3: Accessorial Validation
 * Migration: Accessorial Rate Table
 * 
 * Category: C (Configuration Reuse - using platform schema template)
 * 
 * Purpose: Store accessorial charge rate schedules for validation
 */

-- ============================================================================
-- ACCESSORIAL RATES (Accessorial Pricing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_accessorial_rates (
  rate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_id UUID NOT NULL,
  charge_type VARCHAR(50) NOT NULL, -- 'fuel_surcharge', 'detention', 'layover', etc.
  rate_basis VARCHAR(30) NOT NULL, -- 'flat', 'per_hour', 'per_day', 'percentage_of_freight'
  rate_amount DECIMAL(15,2) NOT NULL,
  minimum_charge DECIMAL(15,2),
  maximum_charge DECIMAL(15,2),
  requires_event BOOLEAN NOT NULL DEFAULT false, -- e.g., detention requires delay event
  event_threshold DECIMAL(10,2), -- e.g., detention after 2 hours
  effective_date DATE NOT NULL,
  expiration_date DATE,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,
  updated_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT log_accessorial_rates_charge_type_check 
    CHECK (charge_type IN (
      'fuel_surcharge', 'detention', 'layover', 'redelivery', 'storage',
      'liftgate', 'inside_delivery', 'residential_delivery', 'appointment', 'other'
    )),
  CONSTRAINT log_accessorial_rates_rate_basis_check 
    CHECK (rate_basis IN ('flat', 'per_hour', 'per_day', 'percentage_of_freight'))
);

-- Indexes for accessorial rate lookup
CREATE INDEX idx_accessorial_rates_tenant ON log_accessorial_rates(tenant_id);
CREATE INDEX idx_accessorial_rates_carrier ON log_accessorial_rates(tenant_id, carrier_id);
CREATE INDEX idx_accessorial_rates_lookup ON log_accessorial_rates(
  tenant_id, 
  carrier_id, 
  charge_type,
  is_active,
  effective_date
);

-- ============================================================================
-- RLS POLICY (Tenant Isolation)
-- Category: C (Configuration Reuse - using platform RLS template)
-- ============================================================================

-- Enable RLS
ALTER TABLE log_accessorial_rates ENABLE ROW LEVEL SECURITY;

-- Accessorial Rates: Tenant isolation
CREATE POLICY accessorial_rates_tenant_isolation
ON log_accessorial_rates
USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE log_accessorial_rates IS 
  'E3 R3: Accessorial charge rate schedules for legitimacy validation';

COMMENT ON COLUMN log_accessorial_rates.requires_event IS 
  'Whether charge requires corresponding shipment event (e.g., detention requires delay)';

COMMENT ON COLUMN log_accessorial_rates.event_threshold IS 
  'Threshold for event-based charges (e.g., detention after 2 hours)';
