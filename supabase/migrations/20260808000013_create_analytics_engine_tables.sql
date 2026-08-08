-- =============================================================================
-- Migration: 20260808000013_create_analytics_engine_tables.sql
-- Phase D4: Multi-Level Rollup Analytics Engine (Platform-Level)
-- Constitution: Law 3 (Platform Host), Law 4 (Additive Only), Law 5 (Events)
--
-- Architecture: Hierarchical Analytics with explicit enterprise boundary
--
-- Rollup Levels:
--   L0 (Raw):       entity events → realtime metric events table
--   L1 (Daily):     per-tenant daily aggregates
--   L2 (Monthly):   per-tenant monthly rollups
--   L3 (Enterprise): explicit cross-tenant aggregation (opt-in per metric definition)
--
-- Enterprise Boundary (NOT a simple SELECT SUM(revenue) FROM all_tenants):
--   Each metric definition specifies aggregationPolicy, tenantScope,
--   visibilityPolicy, and retentionPolicy explicitly.
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. platform_metric_events — L0 raw events (partitioned by month)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_metric_events (
  id              UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Metric identification
  metric_key      TEXT NOT NULL,   -- e.g. 'spa.booking.revenue', 'hospital.bed.occupancy'
  metric_domain   TEXT NOT NULL,   -- e.g. 'beauty_spa', 'healthcare', 'bella_auto'

  -- Values
  value           NUMERIC NOT NULL,
  unit            TEXT,            -- e.g. 'VND', 'count', 'minutes', 'percent'

  -- Dimensional attributes for aggregation
  dimensions      JSONB NOT NULL DEFAULT '{}',  -- { branch_id, service_type, doctor_id, ... }

  -- Source context (D1/D2/D3 linkage)
  source_type     TEXT,            -- 'booking', 'order', 'rule_evaluation', 'transaction'
  source_id       UUID,
  source_event_type TEXT,

  -- Time
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_date     DATE NOT NULL GENERATED ALWAYS AS (occurred_at::DATE) STORED,
  period_month    TEXT NOT NULL GENERATED ALWAYS AS (TO_CHAR(occurred_at, 'YYYY-MM')) STORED,

  metadata        JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (id, occurred_at)  -- for partitioning
) PARTITION BY RANGE (occurred_at);

-- Create initial partitions (2026 months)
CREATE TABLE IF NOT EXISTS platform_metric_events_2026_08 PARTITION OF platform_metric_events
  FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE IF NOT EXISTS platform_metric_events_2026_09 PARTITION OF platform_metric_events
  FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS platform_metric_events_2026_10 PARTITION OF platform_metric_events
  FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS platform_metric_events_2026_11 PARTITION OF platform_metric_events
  FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS platform_metric_events_2026_12 PARTITION OF platform_metric_events
  FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS platform_metric_events_2027_01 PARTITION OF platform_metric_events
  FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE INDEX IF NOT EXISTS idx_pme_tenant_metric   ON platform_metric_events(tenant_id, metric_key, period_date);
CREATE INDEX IF NOT EXISTS idx_pme_occurred_at     ON platform_metric_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pme_dimensions_gin  ON platform_metric_events USING GIN (dimensions);

ALTER TABLE platform_metric_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pme_tenant_isolation ON platform_metric_events;
CREATE POLICY pme_tenant_isolation ON platform_metric_events
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ─────────────────────────────────────────────────────────────────
-- 2. platform_daily_rollups — L1 per-tenant per-day aggregates
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_daily_rollups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key      TEXT NOT NULL,
  metric_domain   TEXT NOT NULL,
  period_date     DATE NOT NULL,

  -- Aggregated values
  total_value     NUMERIC NOT NULL DEFAULT 0,
  count_events    INTEGER NOT NULL DEFAULT 0,
  min_value       NUMERIC,
  max_value       NUMERIC,
  avg_value       NUMERIC,

  -- Dimensional breakdown (top-level summary)
  dimension_summary JSONB NOT NULL DEFAULT '{}',

  rolled_up_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count     INTEGER NOT NULL DEFAULT 0,
  metadata        JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT uq_daily_rollup UNIQUE (tenant_id, metric_key, period_date)
);

CREATE INDEX IF NOT EXISTS idx_pdr_tenant_metric ON platform_daily_rollups(tenant_id, metric_key, period_date DESC);
CREATE INDEX IF NOT EXISTS idx_pdr_domain        ON platform_daily_rollups(metric_domain, period_date DESC);

ALTER TABLE platform_daily_rollups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pdr_tenant_isolation ON platform_daily_rollups;
CREATE POLICY pdr_tenant_isolation ON platform_daily_rollups
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ─────────────────────────────────────────────────────────────────
-- 3. platform_monthly_rollups — L2 per-tenant per-month aggregates
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_monthly_rollups (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  metric_key      TEXT NOT NULL,
  metric_domain   TEXT NOT NULL,
  period_month    TEXT NOT NULL,   -- 'YYYY-MM'

  total_value     NUMERIC NOT NULL DEFAULT 0,
  count_events    INTEGER NOT NULL DEFAULT 0,
  min_value       NUMERIC,
  max_value       NUMERIC,
  avg_value       NUMERIC,
  dimension_summary JSONB NOT NULL DEFAULT '{}',

  rolled_up_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_daily_count INTEGER NOT NULL DEFAULT 0,  -- number of daily rollups aggregated
  metadata        JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT uq_monthly_rollup UNIQUE (tenant_id, metric_key, period_month)
);

CREATE INDEX IF NOT EXISTS idx_pmr_tenant_metric ON platform_monthly_rollups(tenant_id, metric_key, period_month DESC);

ALTER TABLE platform_monthly_rollups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pmr_tenant_isolation ON platform_monthly_rollups;
CREATE POLICY pmr_tenant_isolation ON platform_monthly_rollups
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ─────────────────────────────────────────────────────────────────
-- 4. platform_enterprise_metric_definitions — defines what gets aggregated at L3
--    This is the EXPLICIT enterprise aggregation boundary.
--    A metric is ONLY included in L3 if it has an entry here.
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_enterprise_metric_definitions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key          TEXT NOT NULL UNIQUE,
  metric_name         TEXT NOT NULL,
  description         TEXT,
  metric_domain       TEXT NOT NULL,
  unit                TEXT,

  -- Aggregation policy: how tenant values are combined at L3
  aggregation_policy  TEXT NOT NULL DEFAULT 'SUM'
    CHECK (aggregation_policy IN ('SUM', 'AVG', 'COUNT', 'MAX', 'MIN')),

  -- Which tenants are included in L3 (NULL = all tenants)
  -- JSON array of tenant UUIDs: ["uuid1", "uuid2"] or null for all
  tenant_scope        JSONB,

  -- Visibility: who can query L3 data
  -- 'platform_admin' | 'enterprise_admin' | 'tenant_admin'
  visibility_policy   TEXT NOT NULL DEFAULT 'platform_admin',

  -- Retention (days)
  retention_l0_days   INTEGER NOT NULL DEFAULT 30,
  retention_l1_days   INTEGER NOT NULL DEFAULT 365,
  retention_l2_days   INTEGER NOT NULL DEFAULT 2555,   -- ~7 years
  retention_l3_days   INTEGER NOT NULL DEFAULT 2555,   -- ~7 years

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}'
);

-- Seed with core platform metrics
INSERT INTO platform_enterprise_metric_definitions
  (metric_key, metric_name, metric_domain, unit, aggregation_policy, visibility_policy)
VALUES
  ('spa.booking.revenue',         'Spa Booking Revenue',     'beauty_spa',  'VND',   'SUM',   'enterprise_admin'),
  ('spa.booking.count',           'Spa Booking Count',       'beauty_spa',  'count', 'SUM',   'enterprise_admin'),
  ('spa.customer.count',          'Spa Active Customers',    'beauty_spa',  'count', 'SUM',   'enterprise_admin'),
  ('healthcare.bed.occupancy',    'Hospital Bed Occupancy',  'healthcare',  'percent','AVG',  'enterprise_admin'),
  ('healthcare.order.count',      'Clinical Orders',         'healthcare',  'count', 'SUM',   'enterprise_admin'),
  ('auto.sales.revenue',          'Auto Sales Revenue',      'bella_auto',  'VND',   'SUM',   'enterprise_admin'),
  ('platform.rule.triggered',     'Rules Triggered',         'platform',    'count', 'SUM',   'platform_admin'),
  ('platform.transaction.count',  'Transactions Created',    'platform',    'count', 'SUM',   'platform_admin')
ON CONFLICT (metric_key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 5. platform_enterprise_rollups — L3 cross-tenant aggregates
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_enterprise_rollups (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_key          TEXT NOT NULL REFERENCES platform_enterprise_metric_definitions(metric_key),
  period_month        TEXT NOT NULL,
  aggregation_policy  TEXT NOT NULL,
  tenant_count        INTEGER NOT NULL,            -- how many tenants included
  included_tenants    JSONB NOT NULL DEFAULT '[]', -- array of tenant IDs included
  total_value         NUMERIC NOT NULL DEFAULT 0,
  avg_value           NUMERIC,
  max_value           NUMERIC,
  min_value           NUMERIC,
  rolled_up_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata            JSONB NOT NULL DEFAULT '{}',

  CONSTRAINT uq_enterprise_rollup UNIQUE (metric_key, period_month)
);

CREATE INDEX IF NOT EXISTS idx_per_metric_month ON platform_enterprise_rollups(metric_key, period_month DESC);

-- ─────────────────────────────────────────────────────────────────
-- 6. Feature Flag seed
-- ─────────────────────────────────────────────────────────────────
INSERT INTO feature_flags (key, name, description, enabled, metadata)
VALUES (
  'platform.analytics-engine.enabled',
  'Platform Analytics Engine',
  'Phase D4: Multi-Level Rollup Analytics Engine. Enable after D3 validation.',
  FALSE,
  '{"phase": "D4", "engine": "AnalyticsEngine", "law": 9, "dependency": "platform.rule-engine.enabled", "levels": ["L0_raw", "L1_daily", "L2_monthly", "L3_enterprise"]}'
)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 7. Comments
-- ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE platform_metric_events IS
  'D4 Analytics: L0 raw metric events, partitioned by month. Source of truth for all rollups.';
COMMENT ON TABLE platform_daily_rollups IS
  'D4 Analytics: L1 per-tenant daily aggregates. Computed nightly from L0.';
COMMENT ON TABLE platform_monthly_rollups IS
  'D4 Analytics: L2 per-tenant monthly aggregates. Computed from L1.';
COMMENT ON TABLE platform_enterprise_metric_definitions IS
  'D4 Analytics: Enterprise aggregation boundary. Only metrics defined here appear in L3. '
  'Defines aggregation_policy, tenant_scope, visibility_policy, retention per metric.';
COMMENT ON TABLE platform_enterprise_rollups IS
  'D4 Analytics: L3 cross-tenant enterprise aggregates. Only from metrics in enterprise_metric_definitions.';
