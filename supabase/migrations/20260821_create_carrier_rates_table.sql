/**
 * E3 Economics Experiment - R2: Rate Validation
 * Migration: Carrier Rate Table
 * 
 * Category: C (Configuration Reuse - using platform schema template)
 * 
 * Purpose: Store contracted carrier rates for invoice validation
 */

-- ============================================================================
-- CARRIER RATES (Contracted Pricing)
-- ============================================================================

CREATE TABLE IF NOT EXISTS log_carrier_rates (
  rate_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  carrier_id UUID NOT NULL,
  origin_location VARCHAR(100) NOT NULL, -- City, state, or zip
  destination_location VARCHAR(100) NOT NULL,
  service_level VARCHAR(50) NOT NULL, -- 'standard', 'express', 'overnight'
  weight_min DECIMAL(10,2) NOT NULL DEFAULT 0, -- Minimum weight for this rate (lbs/kg)
  weight_max DECIMAL(10,2) NOT NULL, -- Maximum weight for this rate
  base_rate DECIMAL(15,2) NOT NULL, -- Base transportation charge
  fuel_surcharge_rate DECIMAL(5,2), -- Fuel surcharge percentage
  effective_date DATE NOT NULL,
  expiration_date DATE, -- NULL = no expiration
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID,
  updated_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT log_carrier_rates_weight_range_check 
    CHECK (weight_max > weight_min),
  CONSTRAINT log_carrier_rates_service_level_check 
    CHECK (service_level IN ('standard', 'express', 'overnight', 'same_day'))
);

-- Indexes for rate lookup performance (multi-dimensional matching)
CREATE INDEX idx_carrier_rates_tenant ON log_carrier_rates(tenant_id);
CREATE INDEX idx_carrier_rates_carrier ON log_carrier_rates(tenant_id, carrier_id);
CREATE INDEX idx_carrier_rates_lookup ON log_carrier_rates(
  tenant_id, 
  carrier_id, 
  origin_location, 
  destination_location, 
  service_level,
  weight_min,
  weight_max
);
CREATE INDEX idx_carrier_rates_active ON log_carrier_rates(tenant_id, is_active, effective_date);

-- ============================================================================
-- RLS POLICY (Tenant Isolation)
-- Category: C (Configuration Reuse - using platform RLS template)
-- ============================================================================

-- Enable RLS
ALTER TABLE log_carrier_rates ENABLE ROW LEVEL SECURITY;

-- Carrier Rates: Tenant isolation
CREATE POLICY carrier_rates_tenant_isolation
ON log_carrier_rates
USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE log_carrier_rates IS 
  'E3 R2: Contracted carrier rates for invoice validation and variance detection';

COMMENT ON COLUMN log_carrier_rates.service_level IS 
  'Service classification: standard, express, overnight, same_day';

COMMENT ON COLUMN log_carrier_rates.weight_min IS 
  'Minimum weight for this rate tier (inclusive)';

COMMENT ON COLUMN log_carrier_rates.weight_max IS 
  'Maximum weight for this rate tier (inclusive)';
