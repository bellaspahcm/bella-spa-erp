-- =============================================================================
-- Migration: 20260808000011_create_temporal_engine_tables.sql
-- Phase D2: Temporal Intelligence Engine (Platform-Level)
-- Constitution: Law 3 (Platform Host), Law 4 (Additive Only), Law 5 (Events)
--
-- Architecture: Event-Driven Capture (NOT trigger-based on clinical tables)
--
-- Answers: "What did the system know at time T?"
-- Does NOT provide: "Restore DB to time T" (that goes through D1 RollbackEngine)
--
-- Capture flow:
--   Domain Mutation → Domain Event → TemporalEngine.captureSnapshot() → platform_temporal_snapshots
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. platform_temporal_snapshots — append-only, immutable history
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_temporal_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Entity identification
  entity_type      TEXT NOT NULL,   -- e.g. 'hc_clinical_order', 'hc_bed_allocation', 'platform_business_rule'
  entity_id        UUID NOT NULL,

  -- Snapshot content
  snapshot_data    JSONB NOT NULL,  -- full entity state at this point in time
  snapshot_version INTEGER NOT NULL DEFAULT 1, -- monotonically increasing per entity

  -- Change metadata
  change_type      TEXT NOT NULL CHECK (change_type IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE')),
  change_summary   TEXT,            -- human-readable description of what changed
  changed_fields   JSONB,           -- list of field names that changed (for UPDATE)

  -- Provenance
  captured_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  captured_by      UUID,            -- user or system actor
  source_event_id  UUID,            -- Domain Event that triggered this capture
  source_event_type TEXT,           -- e.g. 'hos.order.created.v1'
  correlation_id   UUID,
  causation_id     UUID,

  -- For D1 linkage: rollback transactions that affected this entity
  transaction_id   UUID REFERENCES platform_business_transactions(id),

  metadata         JSONB NOT NULL DEFAULT '{}'
);

-- ─────────────────────────────────────────────────────────────────
-- 2. Indexes — optimized for point-in-time queries
-- ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_pts_entity
  ON platform_temporal_snapshots(entity_type, entity_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_pts_tenant_entity
  ON platform_temporal_snapshots(tenant_id, entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_pts_captured_at
  ON platform_temporal_snapshots(captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_pts_correlation
  ON platform_temporal_snapshots(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- GIN index for JSONB snapshot_data queries (e.g. "find all snapshots where status='PENDING'")
CREATE INDEX IF NOT EXISTS idx_pts_snapshot_data_gin
  ON platform_temporal_snapshots USING GIN (snapshot_data);

-- ─────────────────────────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE platform_temporal_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temporal_tenant_isolation ON platform_temporal_snapshots;
CREATE POLICY temporal_tenant_isolation ON platform_temporal_snapshots
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ─────────────────────────────────────────────────────────────────
-- 4. IMMUTABILITY — No UPDATE or DELETE (append-only by design)
--    "What did the system know at T?" requires an immutable record.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION platform_temporal_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION
    'platform_temporal_snapshots is append-only (immutable audit). % is forbidden. To record a new state, INSERT a new snapshot.',
    TG_OP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_temporal_immutability ON platform_temporal_snapshots;
CREATE TRIGGER trg_temporal_immutability
  BEFORE UPDATE OR DELETE ON platform_temporal_snapshots
  FOR EACH ROW EXECUTE FUNCTION platform_temporal_immutability_guard();

-- ─────────────────────────────────────────────────────────────────
-- 5. Auto-increment snapshot_version per (tenant_id, entity_type, entity_id)
--    Ensures monotonic versioning without application-side races
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION platform_temporal_set_version()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  next_ver INTEGER;
BEGIN
  SELECT COALESCE(MAX(snapshot_version), 0) + 1
    INTO next_ver
    FROM platform_temporal_snapshots
   WHERE tenant_id   = NEW.tenant_id
     AND entity_type = NEW.entity_type
     AND entity_id   = NEW.entity_id;

  NEW.snapshot_version := next_ver;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_temporal_set_version ON platform_temporal_snapshots;
CREATE TRIGGER trg_temporal_set_version
  BEFORE INSERT ON platform_temporal_snapshots
  FOR EACH ROW EXECUTE FUNCTION platform_temporal_set_version();

-- ─────────────────────────────────────────────────────────────────
-- 6. Feature Flag seed
-- ─────────────────────────────────────────────────────────────────
INSERT INTO feature_flags (key, name, description, enabled, metadata)
VALUES (
  'platform.temporal-engine.enabled',
  'Platform Temporal Engine',
  'Phase D2: Temporal Intelligence Engine — immutable point-in-time snapshots. Enable after D1 validation.',
  FALSE,
  '{"phase": "D2", "engine": "TemporalEngine", "law": 9, "dependency": "platform.rollback-engine.enabled"}'
)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 7. Comments
-- ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE platform_temporal_snapshots IS
  'D2 Temporal Engine: Append-only immutable history of entity states. Answers "What did system know at T?" '
  'Capture is event-driven (NOT trigger-based on domain tables). '
  'Does NOT support DB restore — use D1 RollbackEngine with explicit compensating actions for that.';

COMMENT ON COLUMN platform_temporal_snapshots.snapshot_version IS
  'Monotonically increasing version per (tenant, entity_type, entity_id). Set automatically by DB trigger.';

COMMENT ON COLUMN platform_temporal_snapshots.change_type IS
  'INSERT=new entity created, UPDATE=fields changed, DELETE=hard deleted, SOFT_DELETE=logically deleted.';
