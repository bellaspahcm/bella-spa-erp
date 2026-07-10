-- ============================================================================
-- Discount Provider - Decision Engine Multi-Provider Validation
-- ============================================================================
-- Phase: Task 5 - Multi-Provider Validation
-- Purpose: Centralize discount calculation logic (tier + campaign + eligibility)
-- Date: 2026-07-09
--
-- Tables:
-- 1. discount_rules - Tier-based and static discount rules
-- 2. discount_campaigns - Time-bound promotional campaigns
-- 3. discount_usage - Track customer discount usage (for limits)
--
-- Architecture: Uses same Decision Engine pattern as Booking providers
-- ============================================================================

-- ============================================================================
-- Table: discount_rules (Tier-based & Static Discounts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_rules (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Rule Definition
  rule_name TEXT NOT NULL,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('tier', 'fixed')),
  customer_tier TEXT CHECK (customer_tier IN ('vip', 'loyal', 'new') OR customer_tier IS NULL),
  
  -- Discount Configuration
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value >= 0),
  max_discount_amount NUMERIC(10, 2) CHECK (max_discount_amount IS NULL OR max_discount_amount >= 0),
  min_discount_amount NUMERIC(10, 2) CHECK (min_discount_amount IS NULL OR min_discount_amount >= 0),
  
  -- Applicability
  applies_to TEXT[] NOT NULL DEFAULT ARRAY['services', 'products', 'packages'],
  excluded_service_ids UUID[] DEFAULT ARRAY[]::UUID[],
  excluded_product_ids UUID[] DEFAULT ARRAY[]::UUID[],
  
  -- Priority & Status
  priority INTEGER NOT NULL DEFAULT 10 CHECK (priority >= 1 AND priority <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Flexible Metadata (JSONB for future extensibility)
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT discount_rules_unique_tier UNIQUE (tenant_id, customer_tier, rule_type, is_active)
);

-- Indexes
CREATE INDEX idx_discount_rules_tenant_active ON discount_rules(tenant_id, is_active);
CREATE INDEX idx_discount_rules_tier_active ON discount_rules(customer_tier, is_active) WHERE customer_tier IS NOT NULL;
CREATE INDEX idx_discount_rules_priority ON discount_rules(priority DESC);

-- RLS Policies
ALTER TABLE discount_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY discount_rules_tenant_isolation
  ON discount_rules
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY discount_rules_service_role
  ON discount_rules
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE discount_rules IS 'Tier-based and static discount rules (VIP/Loyal/New)';
COMMENT ON COLUMN discount_rules.rule_type IS 'tier: membership-based, fixed: static rule';
COMMENT ON COLUMN discount_rules.discount_type IS 'percentage: % off, fixed_amount: VND off';
COMMENT ON COLUMN discount_rules.discount_value IS 'Discount value (15 for 15%, or 50000 for 50k VND)';
COMMENT ON COLUMN discount_rules.priority IS '1-100, higher priority rules apply first';
COMMENT ON COLUMN discount_rules.metadata IS 'Flexible JSON for future rule extensions';

-- ============================================================================
-- Table: discount_campaigns (Time-bound Promotions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_campaigns (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Campaign Definition
  campaign_name TEXT NOT NULL,
  campaign_code TEXT, -- Optional promo code (e.g., "SUMMER2026")
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('seasonal', 'bundle', 'referral', 'flash', 'first_time', 'custom')),
  description TEXT,
  
  -- Discount Configuration
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'bundle', 'gift')),
  discount_value NUMERIC(10, 2) CHECK (discount_value IS NULL OR discount_value >= 0),
  
  -- Bundle Configuration (for buy-X-get-Y offers)
  bundle_config JSONB DEFAULT NULL, -- { "buy_quantity": 3, "get_quantity": 1, "service_type": "massage" }
  
  -- Time Constraints
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL CHECK (end_date > start_date),
  time_restrictions JSONB DEFAULT NULL, -- { "days": ["mon", "tue"], "hours": ["09:00", "15:00"] }
  
  -- Eligibility Conditions
  min_purchase_amount NUMERIC(10, 2) CHECK (min_purchase_amount IS NULL OR min_purchase_amount >= 0),
  max_uses_per_customer INTEGER CHECK (max_uses_per_customer IS NULL OR max_uses_per_customer > 0),
  max_total_uses INTEGER CHECK (max_total_uses IS NULL OR max_total_uses > 0),
  current_total_uses INTEGER NOT NULL DEFAULT 0,
  
  -- Applicability
  applies_to_services UUID[] DEFAULT NULL, -- NULL = all services
  applies_to_products UUID[] DEFAULT NULL, -- NULL = all products
  applies_to_branches UUID[] DEFAULT NULL, -- NULL = all branches
  excluded_customer_tiers TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Stacking & Priority
  stacking_allowed BOOLEAN NOT NULL DEFAULT false,
  priority INTEGER NOT NULL DEFAULT 10 CHECK (priority >= 1 AND priority <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Flexible Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT discount_campaigns_unique_code UNIQUE (tenant_id, campaign_code) WHERE campaign_code IS NOT NULL
);

-- Indexes
CREATE INDEX idx_discount_campaigns_tenant_active ON discount_campaigns(tenant_id, is_active);
CREATE INDEX idx_discount_campaigns_dates ON discount_campaigns(start_date, end_date) WHERE is_active = true;
CREATE INDEX idx_discount_campaigns_type ON discount_campaigns(campaign_type, is_active);
CREATE INDEX idx_discount_campaigns_code ON discount_campaigns(campaign_code) WHERE campaign_code IS NOT NULL;

-- RLS Policies
ALTER TABLE discount_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY discount_campaigns_tenant_isolation
  ON discount_campaigns
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY discount_campaigns_service_role
  ON discount_campaigns
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE discount_campaigns IS 'Time-bound promotional campaigns (seasonal, bundles, referrals)';
COMMENT ON COLUMN discount_campaigns.campaign_type IS 'seasonal: time-based, bundle: buy-X-get-Y, referral: invite bonus, flash: short-term, first_time: new customer';
COMMENT ON COLUMN discount_campaigns.discount_type IS 'percentage: % off, fixed_amount: VND off, bundle: buy-X-get-Y, gift: free item';
COMMENT ON COLUMN discount_campaigns.bundle_config IS 'JSON config for bundle offers: { buy_quantity, get_quantity, service_type }';
COMMENT ON COLUMN discount_campaigns.time_restrictions IS 'JSON time constraints: { days: ["mon"], hours: ["09:00", "15:00"] }';
COMMENT ON COLUMN discount_campaigns.max_uses_per_customer IS 'NULL = unlimited uses per customer';
COMMENT ON COLUMN discount_campaigns.max_total_uses IS 'NULL = unlimited total uses';
COMMENT ON COLUMN discount_campaigns.stacking_allowed IS 'Can combine with other discounts?';

-- ============================================================================
-- Table: discount_usage (Track Customer Usage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS discount_usage (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  
  -- Usage Tracking
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  discount_rule_id UUID REFERENCES discount_rules(id) ON DELETE SET NULL,
  discount_campaign_id UUID REFERENCES discount_campaigns(id) ON DELETE SET NULL,
  
  -- Order Reference
  order_id UUID, -- FK to orders table (not enforced to avoid circular dependency)
  booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
  
  -- Discount Applied
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount', 'bundle', 'gift')),
  discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
  original_amount NUMERIC(10, 2) NOT NULL CHECK (original_amount >= 0),
  final_amount NUMERIC(10, 2) NOT NULL CHECK (final_amount >= 0),
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Audit
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CHECK (discount_rule_id IS NOT NULL OR discount_campaign_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_discount_usage_customer ON discount_usage(customer_id, used_at DESC);
CREATE INDEX idx_discount_usage_campaign ON discount_usage(discount_campaign_id, customer_id) WHERE discount_campaign_id IS NOT NULL;
CREATE INDEX idx_discount_usage_rule ON discount_usage(discount_rule_id, customer_id) WHERE discount_rule_id IS NOT NULL;
CREATE INDEX idx_discount_usage_tenant ON discount_usage(tenant_id, used_at DESC);

-- RLS Policies
ALTER TABLE discount_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY discount_usage_tenant_isolation
  ON discount_usage
  FOR ALL
  TO authenticated
  USING (tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid()));

CREATE POLICY discount_usage_service_role
  ON discount_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Comments
COMMENT ON TABLE discount_usage IS 'Track customer discount usage for usage limits and analytics';
COMMENT ON COLUMN discount_usage.discount_amount IS 'Actual discount applied (VND)';
COMMENT ON COLUMN discount_usage.original_amount IS 'Order total before discount';
COMMENT ON COLUMN discount_usage.final_amount IS 'Order total after discount';

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function: Get active campaigns for date range
CREATE OR REPLACE FUNCTION get_active_campaigns(
  p_tenant_id UUID,
  p_check_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  campaign_id UUID,
  campaign_name TEXT,
  campaign_type TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  min_purchase_amount NUMERIC,
  stacking_allowed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    dc.campaign_name,
    dc.campaign_type,
    dc.discount_type,
    dc.discount_value,
    dc.start_date,
    dc.end_date,
    dc.min_purchase_amount,
    dc.stacking_allowed
  FROM discount_campaigns dc
  WHERE dc.tenant_id = p_tenant_id
    AND dc.is_active = true
    AND dc.start_date <= p_check_date
    AND dc.end_date >= p_check_date
    AND (dc.max_total_uses IS NULL OR dc.current_total_uses < dc.max_total_uses)
  ORDER BY dc.priority DESC, dc.discount_value DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_active_campaigns(UUID, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_campaigns(UUID, TIMESTAMPTZ) TO service_role;

-- Function: Check customer campaign usage
CREATE OR REPLACE FUNCTION check_customer_campaign_usage(
  p_customer_id UUID,
  p_campaign_id UUID
)
RETURNS TABLE (
  usage_count INTEGER,
  max_uses INTEGER,
  can_use BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_usage_count INTEGER;
  v_max_uses INTEGER;
BEGIN
  -- Get campaign max uses
  SELECT max_uses_per_customer INTO v_max_uses
  FROM discount_campaigns
  WHERE id = p_campaign_id;
  
  -- Count customer usage
  SELECT COUNT(*)::INTEGER INTO v_usage_count
  FROM discount_usage
  WHERE customer_id = p_customer_id
    AND discount_campaign_id = p_campaign_id;
  
  -- Return result
  RETURN QUERY
  SELECT
    v_usage_count,
    v_max_uses,
    (v_max_uses IS NULL OR v_usage_count < v_max_uses) AS can_use;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_customer_campaign_usage(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_customer_campaign_usage(UUID, UUID) TO service_role;

-- Function: Get customer tier discounts
CREATE OR REPLACE FUNCTION get_customer_tier_discounts(
  p_tenant_id UUID,
  p_customer_tier TEXT
)
RETURNS TABLE (
  rule_id UUID,
  rule_name TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  applies_to TEXT[],
  priority INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id,
    dr.rule_name,
    dr.discount_type,
    dr.discount_value,
    dr.applies_to,
    dr.priority
  FROM discount_rules dr
  WHERE dr.tenant_id = p_tenant_id
    AND dr.is_active = true
    AND dr.customer_tier = p_customer_tier
  ORDER BY dr.priority DESC;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_customer_tier_discounts(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_customer_tier_discounts(UUID, TEXT) TO service_role;

-- Function: Increment campaign usage count
CREATE OR REPLACE FUNCTION increment_campaign_usage(
  p_campaign_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE discount_campaigns
  SET current_total_uses = current_total_uses + 1
  WHERE id = p_campaign_id;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_campaign_usage(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_campaign_usage(UUID) TO service_role;

-- ============================================================================
-- Triggers: Update timestamps
-- ============================================================================

CREATE OR REPLACE FUNCTION update_discount_rules_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_discount_rules_timestamp
  BEFORE UPDATE ON discount_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_discount_rules_timestamp();

CREATE OR REPLACE FUNCTION update_discount_campaigns_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_discount_campaigns_timestamp
  BEFORE UPDATE ON discount_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_discount_campaigns_timestamp();

-- ============================================================================
-- Success Message
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Discount Provider schema created successfully';
  RAISE NOTICE '   - discount_rules table (tier-based discounts)';
  RAISE NOTICE '   - discount_campaigns table (time-bound promotions)';
  RAISE NOTICE '   - discount_usage table (usage tracking)';
  RAISE NOTICE '   - Helper functions: get_active_campaigns, check_customer_campaign_usage, get_customer_tier_discounts';
  RAISE NOTICE '   - Ready for seed data (Task 4)';
END $$;
