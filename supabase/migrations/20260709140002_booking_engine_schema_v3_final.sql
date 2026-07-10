-- ============================================================================
-- Booking Engine - Database Schema (V3 - FINAL)
-- Created: 2026-07-09
-- Purpose: Support 6 core providers (Assignment, Capacity, Conflict, Waitlist, Pricing, Cancellation)
-- Fixes:
--   - Removed employees/branches FK (tables don't exist)
--   - Fixed RLS policies (customers table has no user_id column)
--   - Changed assigned_ktv_id to reference users table (not employees)
-- ============================================================================

-- ============================================================================
-- TABLE 1: waitlist
-- Purpose: Quản lý hàng đợi khi fully booked
-- Used by: Waitlist Provider, Capacity Provider
-- ============================================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Customer & Request Info
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  package_id UUID NOT NULL REFERENCES packages(id) ON DELETE RESTRICT,
  preferred_date DATE NOT NULL,
  preferred_time_slot TEXT CHECK (preferred_time_slot IN ('morning', 'afternoon', 'evening')),
  preferred_ktv_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Fixed: reference users table
  notes TEXT,
  
  -- Priority & Status
  priority_score INT NOT NULL DEFAULT 0, -- 0-100 (VIP=100, Loyal=50, New=0)
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'notified', 'converted', 'expired', 'cancelled')),
  
  -- Lifecycle
  expires_at TIMESTAMP NOT NULL, -- Auto-expire sau 7 ngày
  notified_at TIMESTAMP, -- Lần cuối notify customer
  converted_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  cancelled_at TIMESTAMP,
  cancelled_reason TEXT,
  
  -- Constraints
  CONSTRAINT valid_priority CHECK (priority_score >= 0 AND priority_score <= 100),
  CONSTRAINT expires_after_created CHECK (expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX idx_waitlist_tenant_status ON waitlist(tenant_id, status) WHERE status = 'active';
CREATE INDEX idx_waitlist_date_slot ON waitlist(preferred_date, preferred_time_slot) WHERE status = 'active';
CREATE INDEX idx_waitlist_priority ON waitlist(priority_score DESC) WHERE status = 'active';
CREATE INDEX idx_waitlist_customer ON waitlist(customer_id, status);
CREATE INDEX idx_waitlist_expiry ON waitlist(expires_at) WHERE status = 'active';

-- RLS Policies
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for waitlist" ON waitlist
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Note: Removed "Users can view own waitlist" policy (customers table has no user_id column)
-- Will be added later when auth integration is implemented

-- ============================================================================
-- TABLE 2: pricing_rules
-- Purpose: Dynamic pricing multipliers
-- Used by: Pricing Provider
-- ============================================================================

CREATE TABLE IF NOT EXISTS pricing_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule Info
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('peak_hour', 'weekend', 'demand', 'advance', 'seasonal', 'customer_tier', 'bundle')),
  description TEXT,
  
  -- Condition (JSONB for flexibility)
  condition JSONB NOT NULL, -- e.g., {"hour_range": [10, 14], "days": ["Mon", "Fri"]}
  
  -- Multiplier
  multiplier NUMERIC(3,2) NOT NULL, -- 1.15 = +15%, 0.85 = -15%
  
  -- Priority & Status
  priority INT NOT NULL DEFAULT 0, -- Thứ tự áp dụng (higher first)
  enabled BOOLEAN DEFAULT true,
  
  -- Validity Period
  valid_from DATE,
  valid_to DATE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_multiplier CHECK (multiplier > 0 AND multiplier <= 3.0),
  CONSTRAINT valid_dates CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

-- Indexes
CREATE INDEX idx_pricing_rules_tenant_enabled ON pricing_rules(tenant_id, enabled) WHERE enabled = true;
CREATE INDEX idx_pricing_rules_type ON pricing_rules(rule_type, enabled) WHERE enabled = true;
CREATE INDEX idx_pricing_rules_priority ON pricing_rules(priority DESC) WHERE enabled = true;
CREATE INDEX idx_pricing_rules_validity ON pricing_rules(valid_from, valid_to) WHERE enabled = true;

-- RLS Policies
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for pricing_rules" ON pricing_rules
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- TABLE 3: capacity_snapshots
-- Purpose: Historical capacity tracking (for analytics)
-- Used by: Capacity Provider, BI/Reports
-- ============================================================================

CREATE TABLE IF NOT EXISTS capacity_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Time Dimension
  snapshot_date DATE NOT NULL,
  snapshot_hour INT NOT NULL CHECK (snapshot_hour >= 0 AND snapshot_hour <= 23),
  time_slot TEXT CHECK (time_slot IN ('morning', 'afternoon', 'evening')),
  
  -- Capacity Metrics
  total_capacity INT NOT NULL,
  booked_capacity INT NOT NULL,
  available_capacity INT NOT NULL,
  buffer_reserved INT NOT NULL DEFAULT 0,
  utilization_rate NUMERIC(5,2), -- Percentage (0-100)
  
  -- Branch (multi-location support) - nullable for now
  branch_id UUID,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_capacity CHECK (booked_capacity <= total_capacity),
  CONSTRAINT valid_utilization CHECK (utilization_rate >= 0 AND utilization_rate <= 100)
);

-- Indexes for analytics
CREATE INDEX idx_capacity_snapshots_date ON capacity_snapshots(tenant_id, snapshot_date DESC);
CREATE INDEX idx_capacity_snapshots_hour ON capacity_snapshots(snapshot_date, snapshot_hour);
CREATE INDEX idx_capacity_snapshots_utilization ON capacity_snapshots(utilization_rate DESC);
CREATE INDEX idx_capacity_snapshots_branch ON capacity_snapshots(branch_id, snapshot_date) WHERE branch_id IS NOT NULL;

-- Unique constraint (one snapshot per hour per tenant/branch)
CREATE UNIQUE INDEX idx_capacity_snapshots_unique 
  ON capacity_snapshots(tenant_id, snapshot_date, snapshot_hour, COALESCE(branch_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- RLS Policies
ALTER TABLE capacity_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for capacity_snapshots" ON capacity_snapshots
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- TABLE 4: booking_events
-- Purpose: Audit trail cho booking lifecycle
-- Used by: All Providers (observability), Audit/Compliance
-- ============================================================================

CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Booking Reference
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  
  -- Event Info
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'assigned',
    'confirmed',
    'rescheduled',
    'cancelled',
    'completed',
    'no_show',
    'refund_processed',
    'waitlist_added',
    'waitlist_converted',
    'price_calculated',
    'conflict_detected',
    'conflict_resolved'
  )),
  event_description TEXT,
  
  -- Event Data (JSONB for flexibility)
  event_data JSONB,
  
  -- Actor
  created_by UUID REFERENCES auth.users(id),
  created_by_role TEXT, -- 'customer', 'staff', 'admin', 'system'
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- IP & User Agent (audit purposes)
  ip_address INET,
  user_agent TEXT
);

-- Indexes for querying
CREATE INDEX idx_booking_events_booking ON booking_events(booking_id, created_at DESC);
CREATE INDEX idx_booking_events_type ON booking_events(tenant_id, event_type, created_at DESC);
CREATE INDEX idx_booking_events_created_at ON booking_events(created_at DESC);
CREATE INDEX idx_booking_events_user ON booking_events(created_by, created_at DESC) WHERE created_by IS NOT NULL;

-- RLS Policies
ALTER TABLE booking_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation for booking_events" ON booking_events
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Note: Removed customer-specific policy (will be added when auth integration ready)

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function 1: Auto-expire waitlist entries
CREATE OR REPLACE FUNCTION expire_old_waitlist_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE waitlist
  SET 
    status = 'expired',
    updated_at = NOW()
  WHERE 
    status = 'active'
    AND expires_at < NOW();
END;
$$;

-- Function 2: Calculate waitlist priority score
CREATE OR REPLACE FUNCTION calculate_waitlist_priority(
  p_customer_id UUID,
  p_tenant_id UUID
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_customer_tier TEXT;
  v_score INT := 0;
BEGIN
  -- Get customer tier (if column exists)
  -- Default to 0 if tier column doesn't exist yet
  BEGIN
    SELECT 
      CASE 
        WHEN status = 'vip' THEN 'vip'
        WHEN status = 'active' THEN 'active'
        ELSE 'new'
      END 
    INTO v_customer_tier
    FROM customers
    WHERE id = p_customer_id AND tenant_id = p_tenant_id;
  EXCEPTION WHEN OTHERS THEN
    v_customer_tier := 'new';
  END;
  
  -- Score based on tier
  v_score := CASE v_customer_tier
    WHEN 'vip' THEN 100
    WHEN 'loyal' THEN 50
    WHEN 'active' THEN 25
    ELSE 0
  END;
  
  RETURN v_score;
END;
$$;

-- Function 3: Get available capacity for time slot
CREATE OR REPLACE FUNCTION get_available_capacity(
  p_tenant_id UUID,
  p_date DATE,
  p_time_slot TEXT
)
RETURNS TABLE (
  total_capacity INT,
  booked_capacity INT,
  available_capacity INT,
  buffer_reserved INT,
  utilization_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total INT;
  v_booked INT;
  v_buffer INT;
  v_available INT;
  v_utilization NUMERIC;
BEGIN
  -- Count total KTVs from users table (role = 'ktv')
  SELECT COUNT(*) INTO v_total
  FROM users
  WHERE 
    tenant_id = p_tenant_id
    AND role = 'ktv'
    AND status = 'active';
  
  -- Fallback to default if no KTVs found
  IF v_total = 0 THEN
    v_total := 10;
  END IF;
  
  -- Count booked (existing bookings for this slot)
  SELECT COUNT(DISTINCT assigned_ktv_id) INTO v_booked
  FROM bookings
  WHERE 
    tenant_id = p_tenant_id
    AND start_date = p_date
    AND status IN ('booked', 'in_progress')
    AND assigned_ktv_id IS NOT NULL;
  
  -- Calculate buffer (10% of total)
  v_buffer := CEIL(v_total * 0.1);
  
  -- Calculate available
  v_available := GREATEST(0, v_total - v_booked - v_buffer);
  
  -- Calculate utilization
  v_utilization := CASE WHEN v_total > 0 
    THEN ROUND((v_booked::NUMERIC / v_total) * 100, 2)
    ELSE 0
  END;
  
  RETURN QUERY SELECT v_total, v_booked, v_available, v_buffer, v_utilization;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE waitlist IS 'Hàng đợi khách hàng khi fully booked, tự động convert khi có slot';
COMMENT ON TABLE pricing_rules IS 'Quy tắc dynamic pricing (peak hour, demand-based, customer tier)';
COMMENT ON TABLE capacity_snapshots IS 'Historical capacity tracking cho analytics & forecasting';
COMMENT ON TABLE booking_events IS 'Audit trail đầy đủ cho booking lifecycle (compliance-ready)';

COMMENT ON COLUMN waitlist.priority_score IS 'VIP=100, Loyal=50, New=0. Higher = ưu tiên cao hơn';
COMMENT ON COLUMN waitlist.expires_at IS 'Auto-expire sau 7 ngày. Cleanup job sẽ chuyển sang expired';
COMMENT ON COLUMN pricing_rules.multiplier IS '1.15 = +15%, 0.85 = -15%. Range: 0.1 to 3.0';
COMMENT ON COLUMN pricing_rules.condition IS 'JSON condition. Examples: {"hour_range": [10,14]}, {"days": ["Sat","Sun"]}, {"tier": "vip"}';
COMMENT ON COLUMN capacity_snapshots.utilization_rate IS 'Booked / Total * 100. Used for demand-based pricing';
COMMENT ON COLUMN booking_events.event_data IS 'Flexible JSON for event-specific data (assignment, pricing, conflicts)';
