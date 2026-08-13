-- Migration: 20260813000009_temporal_engine_tables.sql
-- Description: Phase H9 Temporal & Clinical History Engine Schema

BEGIN;

-- 1. Create hc_temporal_events table (Append-only bitemporal log)
CREATE TABLE IF NOT EXISTS public.hc_temporal_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    encounter_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    aggregate_type TEXT NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    valid_time TIMESTAMPTZ NOT NULL,
    transaction_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sequence_number BIGINT NOT NULL,
    delta_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index for sequence ordering per encounter
CREATE UNIQUE INDEX IF NOT EXISTS uq_hc_temporal_event_seq
    ON public.hc_temporal_events (tenant_id, encounter_id, sequence_number);

-- Bitemporal indexes for ultra-fast point-in-time queries
CREATE INDEX IF NOT EXISTS idx_hc_temporal_events_valid_time
    ON public.hc_temporal_events (tenant_id, encounter_id, valid_time);

CREATE INDEX IF NOT EXISTS idx_hc_temporal_events_tx_time
    ON public.hc_temporal_events (tenant_id, encounter_id, transaction_time);


-- 2. Create hc_temporal_snapshots table (Checkpoint read models)
CREATE TABLE IF NOT EXISTS public.hc_temporal_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    encounter_id UUID NOT NULL,
    patient_id UUID NOT NULL,
    snapshot_version BIGINT NOT NULL,
    as_of_valid_time TIMESTAMPTZ NOT NULL,
    as_of_transaction_time TIMESTAMPTZ NOT NULL,
    reconstructed_state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_hc_temporal_snapshot_version
    ON public.hc_temporal_snapshots (tenant_id, encounter_id, snapshot_version);


-- 3. Write-once Immutable DB Triggers
CREATE OR REPLACE FUNCTION public.fn_prevent_hc_temporal_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Temporal History tables are strictly append-only.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hc_temporal_events_immutable ON public.hc_temporal_events;
CREATE TRIGGER trg_hc_temporal_events_immutable
    BEFORE UPDATE OR DELETE ON public.hc_temporal_events
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_hc_temporal_mutation();

DROP TRIGGER IF EXISTS trg_hc_temporal_snapshots_immutable ON public.hc_temporal_snapshots;
CREATE TRIGGER trg_hc_temporal_snapshots_immutable
    BEFORE UPDATE OR DELETE ON public.hc_temporal_snapshots
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_prevent_hc_temporal_mutation();


-- 4. Point-in-Time State Reconstruction PL/pgSQL Function
CREATE OR REPLACE FUNCTION public.reconstruct_temporal_state_at(
    p_tenant_id UUID,
    p_encounter_id UUID,
    p_target_time TIMESTAMPTZ,
    p_dimension TEXT DEFAULT 'VALID_TIME'
)
RETURNS JSONB AS $$
DECLARE
    v_patient_id UUID;
    v_snapshot_state JSONB := '{}'::jsonb;
    v_last_snapshot_ver BIGINT := 0;
    v_rec RECORD;
    v_meds JSONB := '[]'::jsonb;
    v_allergies JSONB := '[]'::jsonb;
    v_labs JSONB := '[]'::jsonb;
    v_vitals JSONB := '[]'::jsonb;
    v_diagnoses JSONB := '[]'::jsonb;
    v_orders JSONB := '[]'::jsonb;
    v_cds_decisions JSONB := '[]'::jsonb;
    v_count INT := 0;
BEGIN
    -- Check if snapshot checkpoint exists prior to target_time
    IF p_dimension = 'TRANSACTION_TIME' THEN
        SELECT reconstructed_state, snapshot_version, patient_id
        INTO v_snapshot_state, v_last_snapshot_ver, v_patient_id
        FROM public.hc_temporal_snapshots
        WHERE tenant_id = p_tenant_id
          AND encounter_id = p_encounter_id
          AND as_of_transaction_time <= p_target_time
        ORDER BY snapshot_version DESC
        LIMIT 1;
    ELSE
        SELECT reconstructed_state, snapshot_version, patient_id
        INTO v_snapshot_state, v_last_snapshot_ver, v_patient_id
        FROM public.hc_temporal_snapshots
        WHERE tenant_id = p_tenant_id
          AND encounter_id = p_encounter_id
          AND as_of_valid_time <= p_target_time
        ORDER BY snapshot_version DESC
        LIMIT 1;
    END IF;

    -- Extract pre-existing arrays from snapshot if found, handle NULL when no snapshot row exists
    v_last_snapshot_ver := COALESCE(v_last_snapshot_ver, 0);
    IF v_snapshot_state IS NOT NULL AND v_snapshot_state != '{}'::jsonb THEN
        v_meds := COALESCE(v_snapshot_state->'activeMedications', '[]'::jsonb);
        v_allergies := COALESCE(v_snapshot_state->'allergies', '[]'::jsonb);
        v_labs := COALESCE(v_snapshot_state->'labResults', '[]'::jsonb);
        v_vitals := COALESCE(v_snapshot_state->'vitalSigns', '[]'::jsonb);
        v_diagnoses := COALESCE(v_snapshot_state->'diagnoses', '[]'::jsonb);
        v_orders := COALESCE(v_snapshot_state->'orders', '[]'::jsonb);
        v_cds_decisions := COALESCE(v_snapshot_state->'cdsDecisions', '[]'::jsonb);
    END IF;

    -- Replay timeline events after checkpoint up to p_target_time
    FOR v_rec IN
        SELECT *
        FROM public.hc_temporal_events
        WHERE tenant_id = p_tenant_id
          AND encounter_id = p_encounter_id
          AND sequence_number > v_last_snapshot_ver
          AND (
              (p_dimension = 'TRANSACTION_TIME' AND transaction_time <= p_target_time) OR
              (p_dimension = 'VALID_TIME' AND valid_time <= p_target_time)
          )
        ORDER BY sequence_number ASC
    LOOP
        v_patient_id := v_rec.patient_id;
        v_count := v_count + 1;

        -- Categorize payload into clinical buckets
        IF v_rec.aggregate_type = 'Pharmacy' OR v_rec.event_type LIKE '%medication%' THEN
            v_meds := v_meds || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.event_type LIKE '%allergy%' THEN
            v_allergies := v_allergies || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.aggregate_type = 'Laboratory' OR v_rec.event_type LIKE '%lab%' THEN
            v_labs := v_labs || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.event_type LIKE '%vital%' THEN
            v_vitals := v_vitals || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.event_type LIKE '%diagnosis%' THEN
            v_diagnoses := v_diagnoses || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.aggregate_type = 'Order' OR v_rec.event_type LIKE '%order%' THEN
            v_orders := v_orders || jsonb_build_array(v_rec.delta_payload);
        ELSIF v_rec.aggregate_type = 'ClinicalDecision' OR v_rec.event_type LIKE '%cds%' THEN
            v_cds_decisions := v_cds_decisions || jsonb_build_array(v_rec.delta_payload);
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'tenantId', p_tenant_id,
        'encounterId', p_encounter_id,
        'patientId', v_patient_id,
        'asOfValidTime', p_target_time,
        'asOfTransactionTime', NOW(),
        'timeDimension', p_dimension,
        'activeMedications', v_meds,
        'allergies', v_allergies,
        'labResults', v_labs,
        'vitalSigns', v_vitals,
        'diagnoses', v_diagnoses,
        'orders', v_orders,
        'cdsDecisions', v_cds_decisions,
        'eventCountReconstructed', v_count
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMIT;
