-- =====================================================================================
-- Bella Auto Phase 7: Trade-In Center (Định Giá & Thu Mua Xe Cũ)
-- Migration: 20260803270000
-- 
-- Tables:
-- 1. auto_trade_in_appraisals - Trade-in appraisal records with technical checklist
-- 2. auto_trade_in_photos - Multi-angle photo storage
-- 3. auto_market_valuations - Market price data for valuation engine
-- 
-- Features:
-- - Technical condition checklist (engine, exterior, interior, etc.)
-- - Multi-angle photo capture & storage
-- - Market price analysis & valuation engine
-- - Approval workflow (pending → approved → accepted/rejected)
-- - Integration with new vehicle sales (trade-in as partial payment)
-- 
-- Zero Regression: All tables prefixed with 'auto_', no core table modifications
-- =====================================================================================

-- =====================================================================================
-- TABLE: auto_trade_in_appraisals
-- Purpose: Store trade-in vehicle appraisal records
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_trade_in_appraisals (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Appraisal Number (unique identifier)
  appraisal_number TEXT NOT NULL,
  appraisal_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Customer & Vehicle Information
  customer_id UUID, -- References customers(id)
  vehicle_id UUID, -- References auto_vehicles(id) if existing vehicle
  
  -- Vehicle Details (for external trade-ins not in system)
  vin TEXT,
  license_plate TEXT,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  variant TEXT,
  color TEXT,
  
  -- Mileage & Registration
  mileage INTEGER NOT NULL,
  registration_date DATE,
  first_registration_date DATE,
  number_of_owners INTEGER,
  
  -- Technical Condition Checklist (JSONB for flexibility)
  engine_condition JSONB DEFAULT '{
    "status": "unknown",
    "notes": "",
    "items": {
      "starts_easily": null,
      "idle_smooth": null,
      "no_smoke": null,
      "no_leaks": null,
      "oil_level_good": null,
      "coolant_level_good": null,
      "battery_good": null,
      "alternator_working": null
    }
  }'::jsonb,
  
  transmission_condition JSONB DEFAULT '{
    "status": "unknown",
    "notes": "",
    "type": "",
    "items": {
      "shifts_smoothly": null,
      "no_slipping": null,
      "no_noise": null,
      "fluid_level_good": null,
      "clutch_good": null
    }
  }'::jsonb,
  
  exterior_condition JSONB DEFAULT '{
    "status": "unknown",
    "notes": "",
    "items": {
      "paint_condition": "",
      "scratches": "",
      "dents": "",
      "rust": "",
      "windshield_cracks": null,
      "headlights_working": null,
      "taillights_working": null,
      "mirrors_intact": null
    }
  }'::jsonb,
  
  interior_condition JSONB DEFAULT '{
    "status": "unknown",
    "notes": "",
    "items": {
      "seats_condition": "",
      "dashboard_condition": "",
      "carpet_condition": "",
      "ac_working": null,
      "audio_working": null,
      "windows_working": null,
      "locks_working": null,
      "odor": ""
    }
  }'::jsonb,
  
  tires_brakes_condition JSONB DEFAULT '{
    "status": "unknown",
    "notes": "",
    "items": {
      "front_left_tread": "",
      "front_right_tread": "",
      "rear_left_tread": "",
      "rear_right_tread": "",
      "spare_tire": null,
      "brakes_front": "",
      "brakes_rear": "",
      "brake_fluid": ""
    }
  }'::jsonb,
  
  documents_condition JSONB DEFAULT '{
    "status": "unknown",
    "notes": "",
    "items": {
      "registration_original": null,
      "service_records": null,
      "warranty_documents": null,
      "owners_manual": null,
      "spare_keys": null
    }
  }'::jsonb,
  
  -- Overall Assessment
  overall_condition TEXT CHECK (overall_condition IN ('excellent', 'good', 'fair', 'poor', 'very_poor')),
  overall_notes TEXT,
  
  -- Valuation
  estimated_market_value NUMERIC(12, 2), -- From valuation engine
  offered_trade_in_value NUMERIC(12, 2), -- Initial offer
  final_trade_in_value NUMERIC(12, 2), -- Negotiated final value
  
  -- Market Data (for reference)
  market_low NUMERIC(12, 2),
  market_average NUMERIC(12, 2),
  market_high NUMERIC(12, 2),
  
  -- Appraiser Information
  appraised_by UUID, -- Employee who conducted appraisal
  appraiser_name TEXT,
  approved_by UUID, -- Manager who approved the offer
  approver_name TEXT,
  
  -- Status Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Initial creation
    'pending_approval',-- Submitted for manager approval
    'approved',        -- Manager approved the valuation
    'offer_sent',      -- Offer sent to customer
    'accepted',        -- Customer accepted the offer
    'rejected',        -- Customer rejected the offer
    'expired',         -- Offer expired (not accepted within time limit)
    'completed',       -- Trade-in completed (linked to sale)
    'cancelled'        -- Appraisal cancelled
  )),
  
  -- Timestamps for workflow
  submitted_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  offer_sent_at TIMESTAMPTZ,
  customer_response_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Offer expiration date
  
  -- Integration with Sales
  linked_sale_id UUID, -- References auto_sales(id) if used as partial payment
  used_as_down_payment BOOLEAN DEFAULT false,
  
  -- Additional Notes
  customer_expectations TEXT,
  internal_notes TEXT,
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_auto_trade_in_appraisals_tenant ON auto_trade_in_appraisals(tenant_id);
CREATE INDEX idx_auto_trade_in_appraisals_customer ON auto_trade_in_appraisals(customer_id);
CREATE INDEX idx_auto_trade_in_appraisals_vehicle ON auto_trade_in_appraisals(vehicle_id);
CREATE INDEX idx_auto_trade_in_appraisals_status ON auto_trade_in_appraisals(tenant_id, status);
CREATE INDEX idx_auto_trade_in_appraisals_appraisal_date ON auto_trade_in_appraisals(tenant_id, appraisal_date);
CREATE UNIQUE INDEX idx_auto_trade_in_appraisals_number ON auto_trade_in_appraisals(tenant_id, appraisal_number);

-- RLS Policies
ALTER TABLE auto_trade_in_appraisals ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_trade_in_appraisals_tenant_isolation ON auto_trade_in_appraisals
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Trigger for updated_at
CREATE TRIGGER trg_auto_trade_in_appraisals_updated_at
  BEFORE UPDATE ON auto_trade_in_appraisals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- TABLE: auto_trade_in_photos
-- Purpose: Store multi-angle photos for trade-in appraisals
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_trade_in_photos (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Link to Appraisal
  appraisal_id UUID NOT NULL REFERENCES auto_trade_in_appraisals(id) ON DELETE CASCADE,
  
  -- Photo Details
  photo_category TEXT NOT NULL CHECK (photo_category IN (
    'front',
    'rear',
    'left_side',
    'right_side',
    'front_left_angle',
    'front_right_angle',
    'rear_left_angle',
    'rear_right_angle',
    'interior_dashboard',
    'interior_front_seats',
    'interior_rear_seats',
    'interior_trunk',
    'engine_bay',
    'odometer',
    'vin_plate',
    'damage_specific',
    'documents',
    'other'
  )),
  
  photo_url TEXT NOT NULL, -- Storage URL (Supabase Storage or S3)
  photo_thumbnail_url TEXT,
  
  -- Photo Metadata
  file_name TEXT,
  file_size_bytes INTEGER,
  mime_type TEXT,
  width_px INTEGER,
  height_px INTEGER,
  
  -- Description & Notes
  description TEXT,
  notes TEXT,
  
  -- Damage/Highlight Markers
  damage_markers JSONB, -- Array of {x, y, label, severity} for UI overlay
  
  -- Order & Display
  display_order INTEGER DEFAULT 0,
  is_primary BOOLEAN DEFAULT false,
  
  -- Metadata
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_auto_trade_in_photos_tenant ON auto_trade_in_photos(tenant_id);
CREATE INDEX idx_auto_trade_in_photos_appraisal ON auto_trade_in_photos(appraisal_id);
CREATE INDEX idx_auto_trade_in_photos_category ON auto_trade_in_photos(appraisal_id, photo_category);

-- RLS Policies
ALTER TABLE auto_trade_in_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_trade_in_photos_tenant_isolation ON auto_trade_in_photos
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================================================
-- TABLE: auto_market_valuations
-- Purpose: Store market price data for valuation engine
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_market_valuations (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Vehicle Identification
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  variant TEXT,
  
  -- Mileage Bracket (for price ranges based on mileage)
  mileage_bracket_start INTEGER,
  mileage_bracket_end INTEGER,
  
  -- Market Prices (in local currency)
  price_excellent NUMERIC(12, 2), -- Excellent condition price
  price_good NUMERIC(12, 2),      -- Good condition price
  price_fair NUMERIC(12, 2),      -- Fair condition price
  price_poor NUMERIC(12, 2),      -- Poor condition price
  
  -- Data Source
  data_source TEXT, -- e.g., 'manual_entry', 'market_api', 'dealer_network'
  source_url TEXT,
  
  -- Validity Period
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expires_at DATE,
  is_active BOOLEAN DEFAULT true,
  
  -- Regional Adjustments
  region TEXT,
  regional_adjustment_percentage NUMERIC(5, 2) DEFAULT 0,
  
  -- Additional Factors
  popularity_score INTEGER, -- 1-10 scale
  depreciation_rate NUMERIC(5, 2), -- Annual depreciation %
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_auto_market_valuations_tenant ON auto_market_valuations(tenant_id);
CREATE INDEX idx_auto_market_valuations_vehicle ON auto_market_valuations(tenant_id, make, model, year);
CREATE INDEX idx_auto_market_valuations_active ON auto_market_valuations(tenant_id, is_active, effective_date);

-- RLS Policies
ALTER TABLE auto_market_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_market_valuations_tenant_isolation ON auto_market_valuations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Trigger for updated_at
CREATE TRIGGER trg_auto_market_valuations_updated_at
  BEFORE UPDATE ON auto_market_valuations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- RPC FUNCTIONS
-- =====================================================================================

-- Generate unique appraisal number: TI{YYYYMMDD}-{sequence}
CREATE OR REPLACE FUNCTION generate_trade_in_appraisal_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date_prefix TEXT;
  v_sequence INTEGER;
  v_appraisal_number TEXT;
BEGIN
  -- Format: TI{YYYYMMDD}-{sequence}
  v_date_prefix := 'TI' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Get next sequence for today
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(appraisal_number FROM '\d+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM auto_trade_in_appraisals
  WHERE tenant_id = p_tenant_id
    AND appraisal_number LIKE v_date_prefix || '%';
  
  -- Format: TI20260803-0001
  v_appraisal_number := v_date_prefix || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_appraisal_number;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION generate_trade_in_appraisal_number TO authenticated;

-- =====================================================================================
-- COMMENTS
-- =====================================================================================

COMMENT ON TABLE auto_trade_in_appraisals IS 'Phase 7: Trade-in vehicle appraisal records with technical checklist';
COMMENT ON TABLE auto_trade_in_photos IS 'Phase 7: Multi-angle photos for trade-in appraisals';
COMMENT ON TABLE auto_market_valuations IS 'Phase 7: Market price data for valuation engine';

COMMENT ON COLUMN auto_trade_in_appraisals.engine_condition IS 'JSONB checklist for engine condition assessment';
COMMENT ON COLUMN auto_trade_in_appraisals.transmission_condition IS 'JSONB checklist for transmission condition assessment';
COMMENT ON COLUMN auto_trade_in_appraisals.exterior_condition IS 'JSONB checklist for exterior condition assessment';
COMMENT ON COLUMN auto_trade_in_appraisals.interior_condition IS 'JSONB checklist for interior condition assessment';
COMMENT ON COLUMN auto_trade_in_appraisals.tires_brakes_condition IS 'JSONB checklist for tires and brakes assessment';
COMMENT ON COLUMN auto_trade_in_appraisals.documents_condition IS 'JSONB checklist for required documents';

COMMENT ON COLUMN auto_trade_in_photos.damage_markers IS 'JSONB array of damage markers for UI overlay: [{x, y, label, severity}]';

-- =====================================================================================
-- END OF MIGRATION
-- =====================================================================================
