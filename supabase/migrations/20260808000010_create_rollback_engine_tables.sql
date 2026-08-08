-- =============================================================================
-- Migration: 20260808000010_create_rollback_engine_tables.sql
-- Phase D1: Compensating Transaction Engine (Platform-Level)
-- Constitution: Law 3 (Platform Host), Law 4 (Additive Only), Law 5 (Events)
--
-- Architecture: Saga / Compensating Transaction Pattern
-- NOT a "restore snapshot" — compensating actions per business domain.
--
-- State Machine:
--   STARTED → EXECUTING → COMMITTED
--   STARTED → EXECUTING → FAILED → ROLLING_BACK → ROLLED_BACK
--   ROLLING_BACK → ROLLBACK_FAILED → MANUAL_RECOVERY_REQUIRED
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. ENUMs
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE platform_transaction_status AS ENUM (
    'STARTED',
    'EXECUTING',
    'COMMITTED',
    'FAILED',
    'ROLLING_BACK',
    'ROLLED_BACK',
    'ROLLBACK_FAILED',
    'MANUAL_RECOVERY_REQUIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_transaction_step_status AS ENUM (
    'EXECUTED',
    'ROLLED_BACK',
    'ROLLBACK_FAILED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_transaction_domain AS ENUM (
    'healthcare',
    'beauty_spa',
    'bella_auto',
    'babycare',
    'finance',
    'notification',
    'inventory',
    'platform'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. platform_business_transactions — the Saga root
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_business_transactions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  domain                  platform_transaction_domain NOT NULL,
  transaction_type        TEXT NOT NULL,          -- e.g. 'vehicle_delivery', 'clinical_order_create'
  entity_type             TEXT NOT NULL,          -- e.g. 'hc_clinical_order', 'auto_vehicle'
  entity_id               UUID NOT NULL,
  status                  platform_transaction_status NOT NULL DEFAULT 'STARTED',

  -- Compensation metadata
  rollback_reason         TEXT,
  rollback_started_at     TIMESTAMPTZ,
  rolled_back_at          TIMESTAMPTZ,
  rolled_back_by          UUID,
  rollback_failed_at      TIMESTAMPTZ,
  rollback_failure_reason TEXT,
  manual_recovery_note    TEXT,

  -- Audit
  created_by              UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata                JSONB NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pbt_tenant_id       ON platform_business_transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pbt_entity          ON platform_business_transactions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_pbt_status          ON platform_business_transactions(status);
CREATE INDEX IF NOT EXISTS idx_pbt_created_at      ON platform_business_transactions(created_at DESC);

-- RLS
ALTER TABLE platform_business_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pbt_tenant_isolation ON platform_business_transactions;
CREATE POLICY pbt_tenant_isolation ON platform_business_transactions
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- updated_at trigger
CREATE OR REPLACE FUNCTION platform_transactions_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pbt_updated_at ON platform_business_transactions;
CREATE TRIGGER trg_pbt_updated_at
  BEFORE UPDATE ON platform_business_transactions
  FOR EACH ROW EXECUTE FUNCTION platform_transactions_set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 3. platform_transaction_steps — append-only compensation registry
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_transaction_steps (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id          UUID NOT NULL REFERENCES platform_business_transactions(id),
  sequence                INTEGER NOT NULL,      -- execution order

  -- Forward action
  action                  TEXT NOT NULL,         -- e.g. 'update_vehicle_status'
  entity_type             TEXT NOT NULL,
  entity_id               UUID NOT NULL,
  snapshot_before         JSONB,                 -- state before forward action
  snapshot_after          JSONB,                 -- state after forward action

  -- Compensating action
  compensating_action     TEXT NOT NULL,         -- e.g. 'revert_vehicle_status'
  compensating_params     JSONB NOT NULL DEFAULT '{}',

  -- Status
  status                  platform_transaction_step_status NOT NULL DEFAULT 'EXECUTED',
  executed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rolled_back_at          TIMESTAMPTZ,
  rollback_failed_at      TIMESTAMPTZ,
  error_message           TEXT,
  metadata                JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pts_transaction_id ON platform_transaction_steps(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pts_sequence       ON platform_transaction_steps(transaction_id, sequence DESC);

-- RLS
ALTER TABLE platform_transaction_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pts_tenant_isolation ON platform_transaction_steps;
CREATE POLICY pts_tenant_isolation ON platform_transaction_steps
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- ⚠️ IMMUTABILITY: Block UPDATE/DELETE on executed steps (can only mark as rolled_back)
CREATE OR REPLACE FUNCTION platform_steps_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'platform_transaction_steps is append-only: DELETE is forbidden';
  END IF;
  -- Only allow status transitions; no other field changes
  IF OLD.action       IS DISTINCT FROM NEW.action       OR
     OLD.entity_type  IS DISTINCT FROM NEW.entity_type  OR
     OLD.entity_id    IS DISTINCT FROM NEW.entity_id    OR
     OLD.sequence     IS DISTINCT FROM NEW.sequence     OR
     OLD.snapshot_before IS DISTINCT FROM NEW.snapshot_before OR
     OLD.compensating_action IS DISTINCT FROM NEW.compensating_action THEN
    RAISE EXCEPTION 'platform_transaction_steps: only status transitions are permitted';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pts_immutability ON platform_transaction_steps;
CREATE TRIGGER trg_pts_immutability
  BEFORE UPDATE OR DELETE ON platform_transaction_steps
  FOR EACH ROW EXECUTE FUNCTION platform_steps_immutability_guard();

-- ─────────────────────────────────────────────────────────────────
-- 4. platform_rollback_audit_log — append-only, never update/delete
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_rollback_audit_log (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  transaction_id          UUID NOT NULL REFERENCES platform_business_transactions(id),
  event_type              TEXT NOT NULL,         -- mirrors event catalog
  event_version           TEXT NOT NULL DEFAULT 'v1',
  steps_total             INTEGER NOT NULL DEFAULT 0,
  steps_succeeded         INTEGER NOT NULL DEFAULT 0,
  steps_failed            INTEGER NOT NULL DEFAULT 0,
  affected_entities       JSONB NOT NULL DEFAULT '[]',
  rollback_reason         TEXT,
  triggered_by            UUID,
  outcome                 TEXT NOT NULL,         -- 'COMMITTED' | 'ROLLED_BACK' | 'ROLLBACK_FAILED' | 'MANUAL_RECOVERY_REQUIRED'
  error_details           TEXT,
  occurred_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  correlation_id          UUID,
  metadata                JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_pral_tenant_id      ON platform_rollback_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pral_transaction_id ON platform_rollback_audit_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pral_occurred_at    ON platform_rollback_audit_log(occurred_at DESC);

-- RLS
ALTER TABLE platform_rollback_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pral_tenant_isolation ON platform_rollback_audit_log;
CREATE POLICY pral_tenant_isolation ON platform_rollback_audit_log
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- IMMUTABILITY: No UPDATE or DELETE
CREATE OR REPLACE FUNCTION platform_audit_log_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'platform_rollback_audit_log is immutable: % is forbidden', TG_OP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_pral_immutability ON platform_rollback_audit_log;
CREATE TRIGGER trg_pral_immutability
  BEFORE UPDATE OR DELETE ON platform_rollback_audit_log
  FOR EACH ROW EXECUTE FUNCTION platform_audit_log_immutability_guard();

-- ─────────────────────────────────────────────────────────────────
-- 5. Feature Flag seed for D1
-- ─────────────────────────────────────────────────────────────────
INSERT INTO feature_flags (key, enabled, description, metadata)
VALUES (
  'platform.rollback-engine.enabled',
  FALSE,
  'Phase D1: Platform Compensating Transaction Engine. Enable per-tenant after validation.',
  '{"phase": "D1", "engine": "RollbackEngine", "law": 9}'::JSONB
)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 6. Comments
-- ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE platform_business_transactions IS
  'D1 Rollback Engine: Saga root record tracking 7-state compensating transaction lifecycle. Never use as simple undo — each step has explicit compensating_action.';
COMMENT ON TABLE platform_transaction_steps IS
  'D1 Rollback Engine: Append-only log of forward + compensating action pairs. Execution order via sequence column. Immutable after insert (only status transitions allowed).';
COMMENT ON TABLE platform_rollback_audit_log IS
  'D1 Rollback Engine: Immutable audit trail for all transaction outcomes including ROLLBACK_FAILED and MANUAL_RECOVERY_REQUIRED states.';
