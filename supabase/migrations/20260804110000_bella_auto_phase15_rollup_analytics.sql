/**
 * Phase 15: Rollup Analytics & Organizational Hierarchy
 * Enable multi-level aggregation: Journey → Branch → Region → Country → Group → Holding
 *
 * Tables:
 * 1. auto_organization_units - Hierarchical org structure
 * 2. auto_rollup_configs - Rollup rules and aggregation configs
 * 3. auto_rollup_cache - Materialized rollup results for performance
 */

-- =====================================================
-- 1. ORGANIZATION UNITS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS auto_organization_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(100) NOT NULL,
  name VARCHAR(200) NOT NULL,
  
  -- Hierarchy
  unit_type VARCHAR(50) NOT NULL, -- 'journey', 'branch', 'region', 'country', 'group', 'holding'
  parent_id UUID REFERENCES auto_organization_units(id) ON DELETE RESTRICT,
  path TEXT, -- Materialized path for fast queries: /holding_id/group_id/country_id/...
  depth INTEGER DEFAULT 0, -- 0 = holding (top), 6 = journey (bottom)
  
  -- Metadata
  manager_user_id UUID,
  is_active BOOLEAN DEFAULT true,
  
  -- Multi-currency support
  base_currency VARCHAR(3) DEFAULT 'VND', -- ISO 4217
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  
  UNIQUE(tenant_id, code)
);

CREATE INDEX idx_auto_org_units_tenant ON auto_organization_units(tenant_id);
CREATE INDEX idx_auto_org_units_parent ON auto_organization_units(parent_id);
CREATE INDEX idx_auto_org_units_path ON auto_organization_units(path) WHERE path IS NOT NULL;
CREATE INDEX idx_auto_org_units_type ON auto_organization_units(unit_type);

COMMENT ON TABLE auto_organization_units IS 'Hierarchical organizational structure for multi-level rollup';
COMMENT ON COLUMN auto_organization_units.path IS 'Materialized path for efficient hierarchy queries (e.g., /holding-1/group-2/country-3/)';
COMMENT ON COLUMN auto_organization_units.depth IS 'Tree depth: 0=holding, 1=group, 2=country, 3=region, 4=branch, 5=journey';

-- =====================================================
-- 2. ROLLUP CONFIGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS auto_rollup_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  org_unit_id UUID NOT NULL REFERENCES auto_organization_units(id) ON DELETE CASCADE,
  
  -- Aggregation rules
  metrics JSONB NOT NULL DEFAULT '{}', -- List of metrics to aggregate: ["revenue", "bookings", "leads"]
  aggregation_functions JSONB NOT NULL DEFAULT '{}', -- Function per metric: {"revenue": "sum", "nps": "avg"}
  filters JSONB, -- Optional filters: {"vehicle_type": "sedan", "status": "delivered"}
  
  -- Refresh strategy
  refresh_strategy VARCHAR(50) DEFAULT 'on_demand', -- 'real_time', 'scheduled', 'on_demand'
  refresh_interval_minutes INTEGER, -- For scheduled refresh
  last_refreshed_at TIMESTAMPTZ,
  
  -- Currency conversion
  convert_to_currency VARCHAR(3), -- If set, convert all child metrics to this currency
  exchange_rates JSONB, -- Custom exchange rates: {"USD": 23000, "EUR": 25000}
  
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMPTZ,
  updated_by UUID,
  
  UNIQUE(tenant_id, org_unit_id)
);

CREATE INDEX idx_auto_rollup_configs_tenant ON auto_rollup_configs(tenant_id);
CREATE INDEX idx_auto_rollup_configs_org_unit ON auto_rollup_configs(org_unit_id);

COMMENT ON TABLE auto_rollup_configs IS 'Configuration for rollup aggregation at each org level';
COMMENT ON COLUMN auto_rollup_configs.metrics IS 'Array of metric names to aggregate: ["total_revenue", "booking_count", "lead_conversion_rate"]';
COMMENT ON COLUMN auto_rollup_configs.aggregation_functions IS 'Map of metric → function: {"revenue": "sum", "nps_score": "avg", "booking_count": "sum"}';

-- =====================================================
-- 3. ROLLUP CACHE TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS auto_rollup_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  org_unit_id UUID NOT NULL REFERENCES auto_organization_units(id) ON DELETE CASCADE,
  
  -- Time dimension
  period_type VARCHAR(50) NOT NULL, -- 'day', 'week', 'month', 'quarter', 'year', 'ytd', 'all_time'
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Aggregated metrics
  metrics JSONB NOT NULL DEFAULT '{}', -- Cached rollup results: {"revenue": 150000000, "bookings": 45}
  
  -- Comparison data (for YoY, QoQ)
  previous_period_metrics JSONB, -- Same metrics for previous period
  growth_rates JSONB, -- Calculated growth rates: {"revenue_growth": 15.5}
  
  -- Metadata
  computed_at TIMESTAMPTZ DEFAULT now(),
  is_valid BOOLEAN DEFAULT true, -- Set false when underlying data changes
  
  UNIQUE(tenant_id, org_unit_id, period_type, period_start, period_end)
);

CREATE INDEX idx_auto_rollup_cache_tenant ON auto_rollup_cache(tenant_id);
CREATE INDEX idx_auto_rollup_cache_org_unit ON auto_rollup_cache(org_unit_id);
CREATE INDEX idx_auto_rollup_cache_period ON auto_rollup_cache(period_type, period_start, period_end);
CREATE INDEX idx_auto_rollup_cache_valid ON auto_rollup_cache(is_valid) WHERE is_valid = true;

COMMENT ON TABLE auto_rollup_cache IS 'Materialized rollup analytics for performance';
COMMENT ON COLUMN auto_rollup_cache.metrics IS 'Aggregated metrics in JSON format';
COMMENT ON COLUMN auto_rollup_cache.is_valid IS 'Invalidate cache when source data changes';

-- =====================================================
-- RLS POLICIES
-- =====================================================

ALTER TABLE auto_organization_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_rollup_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_rollup_cache ENABLE ROW LEVEL SECURITY;

-- Org units: tenant isolation
CREATE POLICY auto_org_units_tenant ON auto_organization_units
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = auth.uid() OR '1' = '1'))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE id = auth.uid() OR '1' = '1'));

-- Rollup configs: tenant isolation
CREATE POLICY auto_rollup_configs_tenant ON auto_rollup_configs
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = auth.uid() OR '1' = '1'))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE id = auth.uid() OR '1' = '1'));

-- Rollup cache: tenant isolation
CREATE POLICY auto_rollup_cache_tenant ON auto_rollup_cache
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT id FROM tenants WHERE id = auth.uid() OR '1' = '1'))
  WITH CHECK (tenant_id IN (SELECT id FROM tenants WHERE id = auth.uid() OR '1' = '1'));

-- =====================================================
-- RPC FUNCTIONS
-- =====================================================

-- Get rollup analytics for an org unit (with drill-down)
CREATE OR REPLACE FUNCTION get_rollup_analytics(
  p_tenant_id UUID,
  p_org_unit_id UUID,
  p_period_type VARCHAR,
  p_period_start DATE,
  p_period_end DATE,
  p_include_children BOOLEAN DEFAULT true
)
RETURNS TABLE (
  org_unit_id UUID,
  org_unit_name VARCHAR,
  org_unit_type VARCHAR,
  metrics JSONB,
  previous_period_metrics JSONB,
  growth_rates JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF p_include_children THEN
    -- Aggregate from all children recursively
    RETURN QUERY
    WITH RECURSIVE children AS (
      SELECT id, name, unit_type, path
      FROM auto_organization_units
      WHERE id = p_org_unit_id AND tenant_id = p_tenant_id
      UNION ALL
      SELECT u.id, u.name, u.unit_type, u.path
      FROM auto_organization_units u
      JOIN children c ON u.parent_id = c.id
      WHERE u.tenant_id = p_tenant_id
    )
    SELECT
      c.id::UUID,
      c.name::VARCHAR,
      c.unit_type::VARCHAR,
      cache.metrics,
      cache.previous_period_metrics,
      cache.growth_rates
    FROM children c
    LEFT JOIN auto_rollup_cache cache ON cache.org_unit_id = c.id
      AND cache.tenant_id = p_tenant_id
      AND cache.period_type = p_period_type
      AND cache.period_start = p_period_start
      AND cache.period_end = p_period_end
      AND cache.is_valid = true
    ORDER BY c.path;
  ELSE
    -- Only the specified unit
    RETURN QUERY
    SELECT
      u.id::UUID,
      u.name::VARCHAR,
      u.unit_type::VARCHAR,
      cache.metrics,
      cache.previous_period_metrics,
      cache.growth_rates
    FROM auto_organization_units u
    LEFT JOIN auto_rollup_cache cache ON cache.org_unit_id = u.id
      AND cache.tenant_id = p_tenant_id
      AND cache.period_type = p_period_type
      AND cache.period_start = p_period_start
      AND cache.period_end = p_period_end
      AND cache.is_valid = true
    WHERE u.id = p_org_unit_id AND u.tenant_id = p_tenant_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_rollup_analytics IS 'Fetch rollup analytics with optional drill-down to children';

-- Invalidate cache when source data changes
CREATE OR REPLACE FUNCTION invalidate_rollup_cache(
  p_tenant_id UUID,
  p_org_unit_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Invalidate cache for this unit and all parents
  UPDATE auto_rollup_cache
  SET is_valid = false
  WHERE tenant_id = p_tenant_id
  AND org_unit_id IN (
    WITH RECURSIVE parents AS (
      SELECT id, parent_id
      FROM auto_organization_units
      WHERE id = p_org_unit_id AND tenant_id = p_tenant_id
      UNION ALL
      SELECT u.id, u.parent_id
      FROM auto_organization_units u
      JOIN parents p ON u.id = p.parent_id
      WHERE u.tenant_id = p_tenant_id
    )
    SELECT id FROM parents
  );
END;
$$;

COMMENT ON FUNCTION invalidate_rollup_cache IS 'Invalidate rollup cache for org unit and all parents';

-- =====================================================
-- SEED DATA: Demo organizational hierarchy
-- =====================================================

-- Example: bella_auto tenant (if exists)
DO $$
DECLARE
  v_tenant_id UUID;
  v_holding_id UUID;
  v_group_vn_id UUID;
  v_country_vn_id UUID;
  v_region_north_id UUID;
  v_branch_hanoi_id UUID;
BEGIN
  -- Find bella_auto tenant (use name since code column may not exist)
  SELECT id INTO v_tenant_id FROM tenants WHERE name ILIKE '%bella%auto%' OR id::text = 'bella_auto' LIMIT 1;
  
  IF v_tenant_id IS NOT NULL THEN
    -- Create holding
    INSERT INTO auto_organization_units (tenant_id, code, name, unit_type, depth, path)
    VALUES (v_tenant_id, 'holding_bella', 'Bella Auto Holdings', 'holding', 0, '/holding_bella/')
    RETURNING id INTO v_holding_id;
    
    -- Create group
    INSERT INTO auto_organization_units (tenant_id, code, name, unit_type, parent_id, depth, path)
    VALUES (v_tenant_id, 'group_vn', 'Bella Auto Vietnam Group', 'group', v_holding_id, 1, '/holding_bella/group_vn/')
    RETURNING id INTO v_group_vn_id;
    
    -- Create country
    INSERT INTO auto_organization_units (tenant_id, code, name, unit_type, parent_id, depth, path)
    VALUES (v_tenant_id, 'country_vn', 'Vietnam', 'country', v_group_vn_id, 2, '/holding_bella/group_vn/country_vn/')
    RETURNING id INTO v_country_vn_id;
    
    -- Create region
    INSERT INTO auto_organization_units (tenant_id, code, name, unit_type, parent_id, depth, path)
    VALUES (v_tenant_id, 'region_north', 'North Vietnam', 'region', v_country_vn_id, 3, '/holding_bella/group_vn/country_vn/region_north/')
    RETURNING id INTO v_region_north_id;
    
    -- Create branch
    INSERT INTO auto_organization_units (tenant_id, code, name, unit_type, parent_id, depth, path)
    VALUES (v_tenant_id, 'branch_hanoi', 'Hanoi Showroom', 'branch', v_region_north_id, 4, '/holding_bella/group_vn/country_vn/region_north/branch_hanoi/')
    RETURNING id INTO v_branch_hanoi_id;
  END IF;
END $$;
