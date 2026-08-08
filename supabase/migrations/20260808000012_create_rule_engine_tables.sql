-- =============================================================================
-- Migration: 20260808000012_create_rule_engine_tables.sql
-- Phase D3: Governed Business Rule Engine (Platform-Level)
-- Constitution: Law 3 (Platform Host), Law 4 (Additive Only), Law 5 (Events)
--
-- Governance Hierarchy (MUST be respected — D3 CANNOT override above layers):
--   Human Governance (ARB approval)
--     → Frozen Safety Policy (Constitution)
--       → Clinical Safety Engine (CDS/CPOE — Phase C)
--         → Platform Rule Engine (D3)  ← this layer
--           → Business Workflow
--
-- Rule Lifecycle (immutable versioning):
--   DRAFT → REVIEW → APPROVED → ACTIVE → SUSPENDED → RETIRED
--   - ACTIVE rules are immutable: create new version instead of UPDATE
--   - ABSOLUTE severity requires approved_by + approved_at (ARB approval)
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────
-- 1. ENUMs
-- ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE platform_rule_status AS ENUM (
    'DRAFT',
    'REVIEW',
    'APPROVED',
    'ACTIVE',
    'SUSPENDED',
    'RETIRED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_severity AS ENUM (
    'LOW',
    'MODERATE',
    'HIGH',
    'ABSOLUTE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_action_type AS ENUM (
    'NOTIFY',
    'WARN',
    'ESCALATE',
    'EXECUTE_WORKFLOW',
    'BLOCK'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_domain AS ENUM (
    'spa.booking',
    'spa.commission',
    'spa.notification',
    'finance.commission',
    'finance.payment',
    'hr.payroll',
    'notification.routing',
    'crm.sla',
    'bella_auto.sales',
    'babycare.booking',
    'platform.system'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform_rule_eval_outcome AS ENUM (
    'TRIGGERED',
    'NOT_TRIGGERED',
    'SKIPPED_SUSPENDED',
    'SKIPPED_EXPIRED',
    'ERROR'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─────────────────────────────────────────────────────────────────
-- 2. platform_business_rules — versioned, immutable once ACTIVE
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_business_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Identity
  rule_key        TEXT NOT NULL,       -- stable identifier across versions, e.g. 'VIP_UPGRADE_BOOKING'
  version         TEXT NOT NULL,       -- semver: '1.0.0', '1.1.0'
  domain          platform_rule_domain NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,

  -- Lifecycle
  status          platform_rule_status NOT NULL DEFAULT 'DRAFT',
  severity        platform_rule_severity NOT NULL DEFAULT 'LOW',

  -- Conditions (JSON DSL)
  conditions      JSONB NOT NULL,      -- { operator: 'AND'|'OR', rules: [{field, op, value}] }

  -- Action
  action_type     platform_rule_action_type NOT NULL DEFAULT 'NOTIFY',
  action_params   JSONB NOT NULL DEFAULT '{}',  -- { message, workflowId, escalation_target, etc. }

  -- Governance
  -- ABSOLUTE severity rules: approved_by + approved_at are REQUIRED (enforced by check constraint)
  approved_by     UUID,
  approved_at     TIMESTAMPTZ,
  effective_from  DATE,
  effective_to    DATE,               -- NULL = indefinite

  -- Audit
  created_by      UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Temporal linkage (D2): each status transition captures a snapshot
  metadata        JSONB NOT NULL DEFAULT '{}',

  -- Version uniqueness: one (tenant, rule_key, version) per system
  CONSTRAINT uq_rule_version UNIQUE (tenant_id, rule_key, version),

  -- Governance: ABSOLUTE severity requires ARB approval proof
  CONSTRAINT chk_absolute_requires_approval CHECK (
    severity <> 'ABSOLUTE' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_pbr_tenant_domain  ON platform_business_rules(tenant_id, domain);
CREATE INDEX IF NOT EXISTS idx_pbr_status         ON platform_business_rules(status);
CREATE INDEX IF NOT EXISTS idx_pbr_rule_key       ON platform_business_rules(tenant_id, rule_key, version);
CREATE INDEX IF NOT EXISTS idx_pbr_active         ON platform_business_rules(tenant_id, domain, status)
  WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_pbr_conditions_gin ON platform_business_rules USING GIN (conditions);

ALTER TABLE platform_business_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pbr_tenant_isolation ON platform_business_rules;
CREATE POLICY pbr_tenant_isolation ON platform_business_rules
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- updated_at trigger
CREATE OR REPLACE FUNCTION platform_rules_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_pbr_updated_at ON platform_business_rules;
CREATE TRIGGER trg_pbr_updated_at
  BEFORE UPDATE ON platform_business_rules
  FOR EACH ROW EXECUTE FUNCTION platform_rules_set_updated_at();

-- ⚠️ IMMUTABILITY: ACTIVE rules cannot be modified — must create new version
CREATE OR REPLACE FUNCTION platform_rules_active_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Allow status transitions (ACTIVE → SUSPENDED, ACTIVE → RETIRED)
  IF OLD.status = 'ACTIVE' AND
     (NEW.conditions IS DISTINCT FROM OLD.conditions OR
      NEW.action_type IS DISTINCT FROM OLD.action_type OR
      NEW.action_params IS DISTINCT FROM OLD.action_params OR
      NEW.severity IS DISTINCT FROM OLD.severity OR
      NEW.domain IS DISTINCT FROM OLD.domain OR
      NEW.name IS DISTINCT FROM OLD.name) THEN
    RAISE EXCEPTION
      'ACTIVE rule "%" (v%) cannot be modified. Create a new version instead. '
      'Governance Law: immutable rule versioning.',
      OLD.rule_key, OLD.version;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_pbr_active_immutability ON platform_business_rules;
CREATE TRIGGER trg_pbr_active_immutability
  BEFORE UPDATE ON platform_business_rules
  FOR EACH ROW EXECUTE FUNCTION platform_rules_active_immutability_guard();

-- ─────────────────────────────────────────────────────────────────
-- 3. platform_rule_evaluation_log — append-only evaluation audit
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS platform_rule_evaluation_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  rule_id         UUID NOT NULL REFERENCES platform_business_rules(id),
  rule_key        TEXT NOT NULL,
  rule_version    TEXT NOT NULL,

  -- Input context
  context_type    TEXT NOT NULL,       -- e.g. 'spa_booking', 'customer_journey'
  context_id      UUID,
  input_data      JSONB NOT NULL DEFAULT '{}',

  -- Result
  outcome         platform_rule_eval_outcome NOT NULL,
  conditions_met  BOOLEAN NOT NULL DEFAULT FALSE,
  action_taken    TEXT,
  action_result   JSONB,
  error_message   TEXT,

  -- Provenance
  evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  evaluated_by    UUID,               -- system actor or user
  correlation_id  UUID,
  metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_prel_tenant_id ON platform_rule_evaluation_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_prel_rule_id   ON platform_rule_evaluation_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_prel_context   ON platform_rule_evaluation_log(context_type, context_id);
CREATE INDEX IF NOT EXISTS idx_prel_eval_at   ON platform_rule_evaluation_log(evaluated_at DESC);

ALTER TABLE platform_rule_evaluation_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prel_tenant_isolation ON platform_rule_evaluation_log;
CREATE POLICY prel_tenant_isolation ON platform_rule_evaluation_log
  USING (tenant_id::TEXT = current_setting('app.current_tenant_id', TRUE));

-- IMMUTABILITY: evaluation log is append-only
CREATE OR REPLACE FUNCTION platform_eval_log_immutability_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'platform_rule_evaluation_log is append-only: % is forbidden', TG_OP;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_prel_immutability ON platform_rule_evaluation_log;
CREATE TRIGGER trg_prel_immutability
  BEFORE UPDATE OR DELETE ON platform_rule_evaluation_log
  FOR EACH ROW EXECUTE FUNCTION platform_eval_log_immutability_guard();

-- ─────────────────────────────────────────────────────────────────
-- 4. Feature Flag seed
-- ─────────────────────────────────────────────────────────────────
INSERT INTO feature_flags (key, name, description, enabled, metadata)
VALUES (
  'platform.rule-engine.enabled',
  'Platform Business Rule Engine',
  'Phase D3: Governed Business Rule Engine. No-Code is NOT No-Governance. Enable after D2 validation.',
  FALSE,
  '{"phase": "D3", "engine": "RuleEngine", "law": 9, "dependency": "platform.temporal-engine.enabled", "governance": "ABSOLUTE_severity_requires_ARB_approval"}'
)
ON CONFLICT (key) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────
-- 5. Comments
-- ─────────────────────────────────────────────────────────────────
COMMENT ON TABLE platform_business_rules IS
  'D3 Rule Engine: Immutable versioned business rules. '
  'Governance hierarchy: D3 CANNOT override Clinical Safety Engine (Phase C) or Safety Policy. '
  'ACTIVE rules are immutable — create new version for changes. '
  'ABSOLUTE severity requires ARB approval (approved_by + approved_at NOT NULL).';

COMMENT ON TABLE platform_rule_evaluation_log IS
  'D3 Rule Engine: Append-only evaluation audit. Records every rule evaluation with input context and outcome.';

COMMENT ON COLUMN platform_business_rules.rule_key IS
  'Stable business identifier across versions (e.g. VIP_UPGRADE_BOOKING). Used to find active version.';

COMMENT ON COLUMN platform_business_rules.conditions IS
  'JSON DSL: { "operator": "AND"|"OR", "rules": [{"field": "string", "op": "EQ"|"GT"|"LT"|"IN", "value": any}] }';
