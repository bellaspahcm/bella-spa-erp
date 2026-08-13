-- ============================================================================
-- Bella Healthcare Platform — Phase H8: Clinical Decision Support (CDS) Schema
-- Migration: 20260813000000_create_h8_cds_schema.sql
-- Governance: H8-01 through H8-10 Architecture Laws
-- ============================================================================

-- 1. CLINICAL CONTEXT SNAPSHOTS (Read Model)
CREATE TABLE IF NOT EXISTS public.hc_clinical_context_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    allergies JSONB DEFAULT '[]'::jsonb NOT NULL,
    active_medications JSONB DEFAULT '[]'::jsonb NOT NULL,
    lab_results JSONB DEFAULT '[]'::jsonb NOT NULL,
    vital_signs JSONB DEFAULT '[]'::jsonb NOT NULL,
    diagnoses JSONB DEFAULT '[]'::jsonb NOT NULL,
    active_orders JSONB DEFAULT '[]'::jsonb NOT NULL,
    last_processed_event_at TIMESTAMPTZ,
    last_event_id UUID,
    last_event_sequence BIGINT,
    projection_version INT DEFAULT 1 NOT NULL,
    projection_status TEXT DEFAULT 'UNAVAILABLE' CHECK (projection_status IN ('FRESH', 'STALE', 'UNAVAILABLE', 'ERROR')) NOT NULL,
    projection_error TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_tenant_encounter UNIQUE (tenant_id, encounter_id)
);

CREATE INDEX IF NOT EXISTS idx_hc_cds_snapshots_tenant_encounter 
ON public.hc_clinical_context_snapshots(tenant_id, encounter_id);

CREATE INDEX IF NOT EXISTS idx_hc_cds_snapshots_patient 
ON public.hc_clinical_context_snapshots(tenant_id, patient_id);

-- 2. DEDUPLICATION LOG (Processed Events)
CREATE TABLE IF NOT EXISTS public.hc_cds_processed_events (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    event_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT DEFAULT 'processed' CHECK (status IN ('processed', 'skipped_out_of_order')) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    projection_version INT NOT NULL,
    CONSTRAINT pk_hc_cds_processed_events PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_hc_cds_processed_events_lookup 
ON public.hc_cds_processed_events(tenant_id, event_id);

-- 3. VERSIONED CLINICAL RULES
CREATE TABLE IF NOT EXISTS public.hc_cds_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    rule_code TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    description TEXT,
    conditions JSONB NOT NULL,
    outcome TEXT NOT NULL CHECK (outcome IN ('ALLOW', 'WARNING', 'BLOCK')),
    enforcement TEXT NOT NULL CHECK (enforcement IN ('OVERRIDABLE', 'ABSOLUTE_BLOCK')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    rule_checksum TEXT NOT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_tenant_rule_code_version UNIQUE (tenant_id, rule_code, rule_version)
);

CREATE INDEX IF NOT EXISTS idx_hc_cds_rules_lookup 
ON public.hc_cds_rules(tenant_id, rule_code, rule_version);

-- 4. IMMUTABLE CLINICAL DECISIONS LOG
CREATE TABLE IF NOT EXISTS public.hc_clinical_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id TEXT NOT NULL,
    rule_id UUID NOT NULL REFERENCES public.hc_cds_rules(id) ON DELETE CASCADE,
    rule_version TEXT NOT NULL,
    rule_checksum TEXT NOT NULL,
    context_snapshot_version INT NOT NULL,
    input_snapshot JSONB NOT NULL,
    action_context JSONB NOT NULL,
    result TEXT NOT NULL CHECK (result IN ('ALLOW', 'WARNING', 'BLOCK')),
    enforcement TEXT NOT NULL CHECK (enforcement IN ('OVERRIDABLE', 'ABSOLUTE_BLOCK')),
    severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    reasoning TEXT,
    evaluator_version TEXT NOT NULL,
    evaluation_fingerprint TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT uq_tenant_evaluation_fingerprint UNIQUE (tenant_id, evaluation_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_hc_clinical_decisions_lookup 
ON public.hc_clinical_decisions(tenant_id, evaluation_fingerprint);

-- 5. IMMUTABLE DECISION OVERRIDES
CREATE TABLE IF NOT EXISTS public.hc_decision_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    original_decision_id UUID NOT NULL REFERENCES public.hc_clinical_decisions(id) ON DELETE CASCADE UNIQUE,
    clinician_id TEXT NOT NULL,
    clinician_role TEXT NOT NULL,
    reason TEXT NOT NULL,
    rule_version TEXT NOT NULL,
    decision_result TEXT NOT NULL,
    authorization_context JSONB,
    policy_version TEXT NOT NULL,
    override_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_decision_overrides_lookup 
ON public.hc_decision_overrides(tenant_id, original_decision_id);

-- 6. RLS MANAGEMENT
ALTER TABLE public.hc_clinical_context_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_cds_processed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_cds_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_clinical_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_decision_overrides ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_clinical_context_snapshots' AND policyname = 'tenant_isolation_hc_clinical_context_snapshots') THEN
    CREATE POLICY tenant_isolation_hc_clinical_context_snapshots ON public.hc_clinical_context_snapshots
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_cds_processed_events' AND policyname = 'tenant_isolation_hc_cds_processed_events') THEN
    CREATE POLICY tenant_isolation_hc_cds_processed_events ON public.hc_cds_processed_events
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_cds_rules' AND policyname = 'tenant_isolation_hc_cds_rules') THEN
    CREATE POLICY tenant_isolation_hc_cds_rules ON public.hc_cds_rules
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_clinical_decisions' AND policyname = 'tenant_isolation_hc_clinical_decisions') THEN
    CREATE POLICY tenant_isolation_hc_clinical_decisions ON public.hc_clinical_decisions
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_decision_overrides' AND policyname = 'tenant_isolation_hc_decision_overrides') THEN
    CREATE POLICY tenant_isolation_hc_decision_overrides ON public.hc_decision_overrides
        FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

-- 7. MUTATION TRIGGER (IMMUTABILITY)
CREATE OR REPLACE FUNCTION public.block_immutable_table_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Mutation not allowed: this table is immutable.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_block_mutation_decisions
BEFORE UPDATE OR DELETE ON public.hc_clinical_decisions
FOR EACH ROW EXECUTE FUNCTION public.block_immutable_table_mutation();

CREATE TRIGGER tr_block_mutation_overrides
BEFORE UPDATE OR DELETE ON public.hc_decision_overrides
FOR EACH ROW EXECUTE FUNCTION public.block_immutable_table_mutation();

-- 8. OVERRIDE VALIDATION TRIGGER
CREATE OR REPLACE FUNCTION public.validate_decision_override_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_result TEXT;
  v_enforcement TEXT;
  v_severity TEXT;
BEGIN
  SELECT result, enforcement, severity INTO v_result, v_enforcement, v_severity
  FROM public.hc_clinical_decisions
  WHERE id = NEW.original_decision_id AND tenant_id = NEW.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Referenced clinical decision % not found.', NEW.original_decision_id;
  END IF;

  IF v_result != 'BLOCK' THEN
    RAISE EXCEPTION 'Only decisions with result BLOCK can be overridden.';
  END IF;

  IF v_enforcement = 'ABSOLUTE_BLOCK' THEN
    RAISE EXCEPTION 'Overrides are strictly prohibited for ABSOLUTE_BLOCK enforcement.';
  END IF;

  -- Enforce Severity-to-Role Policy
  IF v_severity = 'LOW' THEN
    IF NOT NEW.clinician_role IN ('doctor', 'pharmacist', 'chief_of_department', 'clinical_director', 'medical_director', 'chief_executive') THEN
      RAISE EXCEPTION 'Role % is not authorized to override LOW severity clinical blocks.', NEW.clinician_role;
    END IF;
  ELSIF v_severity = 'HIGH' THEN
    IF NOT NEW.clinician_role IN ('chief_of_department', 'clinical_director', 'medical_director', 'chief_executive') THEN
      RAISE EXCEPTION 'Role % is not authorized to override HIGH severity clinical blocks.', NEW.clinician_role;
    END IF;
  ELSIF v_severity = 'CRITICAL' THEN
    IF NOT NEW.clinician_role IN ('medical_director', 'chief_executive') THEN
      RAISE EXCEPTION 'Role % is not authorized to override CRITICAL severity clinical blocks.', NEW.clinician_role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_validate_decision_override
BEFORE INSERT ON public.hc_decision_overrides
FOR EACH ROW EXECUTE FUNCTION public.validate_decision_override_insert();

-- 9. ATOMIC CONTEXT PROJECTION FUNCTION
CREATE OR REPLACE FUNCTION public.project_clinical_context_event(
  p_tenant_id UUID,
  p_event_id UUID,
  p_event_type TEXT,
  p_event_timestamp TIMESTAMPTZ,
  p_event_sequence BIGINT,
  p_encounter_id UUID,
  p_patient_id TEXT,
  p_snapshot_update JSONB
) RETURNS VOID AS $$
DECLARE
  v_claimed_id UUID;
  v_last_sequence BIGINT;
  v_current_version INT;
BEGIN
  -- 1. Atomic Event Claim (deduplication)
  INSERT INTO public.hc_cds_processed_events (tenant_id, event_id, event_type, status, processed_at, projection_version)
  VALUES (p_tenant_id, p_event_id, p_event_type, 'processed', now(), 0)
  ON CONFLICT (tenant_id, event_id) DO NOTHING
  RETURNING event_id INTO v_claimed_id;

  IF v_claimed_id IS NULL THEN
    RETURN; -- Silent NO-OP for duplicate delivery
  END IF;

  -- 2. Concurrency serialization using 2-integer Advisory Lock keyed on (tenant_id, encounter_id)
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_id::text), hashtext(p_encounter_id::text));

  -- 3. Prevent out-of-order events using sequence number
  SELECT last_event_sequence, projection_version INTO v_last_sequence, v_current_version 
  FROM public.hc_clinical_context_snapshots WHERE tenant_id = p_tenant_id AND encounter_id = p_encounter_id;
  
  IF v_last_sequence IS NOT NULL AND p_event_sequence <= v_last_sequence THEN
    -- Record skipped out-of-order event for audit log completeness
    UPDATE public.hc_cds_processed_events 
    SET status = 'skipped_out_of_order', projection_version = v_current_version
    WHERE tenant_id = p_tenant_id AND event_id = p_event_id;
    RETURN;
  END IF;

  -- 4. Update snapshot
  INSERT INTO public.hc_clinical_context_snapshots (
    tenant_id, encounter_id, patient_id, last_processed_event_at, last_event_id, last_event_sequence, projection_version, projection_status,
    allergies, active_medications, lab_results, vital_signs, diagnoses, active_orders
  ) VALUES (
    p_tenant_id, p_encounter_id, p_patient_id, p_event_timestamp, p_event_id, p_event_sequence, 1, 'FRESH',
    COALESCE(p_snapshot_update->'allergies', '[]'::jsonb),
    COALESCE(p_snapshot_update->'active_medications', '[]'::jsonb),
    COALESCE(p_snapshot_update->'lab_results', '[]'::jsonb),
    COALESCE(p_snapshot_update->'vital_signs', '[]'::jsonb),
    COALESCE(p_snapshot_update->'diagnoses', '[]'::jsonb),
    COALESCE(p_snapshot_update->'active_orders', '[]'::jsonb)
  ) ON CONFLICT (tenant_id, encounter_id) DO UPDATE SET
    last_processed_event_at = p_event_timestamp,
    last_event_id = p_event_id,
    last_event_sequence = p_event_sequence,
    projection_version = public.hc_clinical_context_snapshots.projection_version + 1,
    projection_status = 'FRESH',
    allergies = COALESCE(p_snapshot_update->'allergies', public.hc_clinical_context_snapshots.allergies),
    active_medications = COALESCE(p_snapshot_update->'active_medications', public.hc_clinical_context_snapshots.active_medications),
    lab_results = COALESCE(p_snapshot_update->'lab_results', public.hc_clinical_context_snapshots.lab_results),
    vital_signs = COALESCE(p_snapshot_update->'vital_signs', public.hc_clinical_context_snapshots.vital_signs),
    diagnoses = COALESCE(p_snapshot_update->'diagnoses', public.hc_clinical_context_snapshots.diagnoses),
    active_orders = COALESCE(p_snapshot_update->'active_orders', public.hc_clinical_context_snapshots.active_orders)
  RETURNING projection_version INTO v_current_version;

  -- 5. Record successful processed event with the new snapshot version
  UPDATE public.hc_cds_processed_events 
  SET projection_version = v_current_version
  WHERE tenant_id = p_tenant_id AND event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;
