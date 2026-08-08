-- ============================================================================
-- Bella Healthcare Platform — Phase B2, B3, B4 Critical Care & Diagnostics Schema
-- Migration: 20260808000005_create_icu_ed_bloodbank_tables.sql
-- Governance: Clinical Safety Profile Tier 3
-- ============================================================================

-- Enable the btree_gist extension (should already exist, but kept for idempotency)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. ICU Beds
CREATE TABLE IF NOT EXISTS public.hc_icu_beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    bed_id UUID NOT NULL REFERENCES public.hc_beds(id) ON DELETE CASCADE,
    monitoring_level TEXT NOT NULL CHECK (monitoring_level IN ('standard', 'advanced', 'critical')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_icu_bed UNIQUE (tenant_id, bed_id)
);

CREATE INDEX IF NOT EXISTS idx_hc_icu_beds_tenant ON public.hc_icu_beds(tenant_id);

-- 2. ICU Observations (Raw vital/lab telemetry)
CREATE TABLE IF NOT EXISTS public.hc_icu_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    observed_at TIMESTAMPTZ NOT NULL,
    vitals JSONB NOT NULL, -- MAP of heart_rate, mean_arterial_pressure, temperature, respiratory_rate, spo2
    labs JSONB NOT NULL,   -- MAP of pao2, platelet_count, bilirubin, creatinine
    clinical JSONB NOT NULL, -- MAP of glasgow_coma_scale, urine_output, vasopressor_doses
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_icu_obs_tenant ON public.hc_icu_observations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_icu_obs_encounter ON public.hc_icu_observations(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_icu_obs_time ON public.hc_icu_observations(observed_at DESC);

-- 3. Clinical Calculations (Unified score provenance ledger)
CREATE TABLE IF NOT EXISTS public.hc_clinical_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    algorithm_id TEXT NOT NULL CHECK (algorithm_id IN ('SOFA', 'APACHE_II', 'NEDOCS', 'ESI')),
    algorithm_version TEXT NOT NULL,
    calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    calculation_status TEXT NOT NULL DEFAULT 'COMPLETED' CHECK (calculation_status IN ('PENDING', 'COMPLETED', 'FAILED', 'SUPERSEDED')),
    input_snapshot JSONB NOT NULL,
    source_observation_references JSONB NOT NULL, -- polymorphic references array: [{"entity_type": "...", "entity_id": "..."}]
    output JSONB NOT NULL, -- computed scores/outputs
    engine_version TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_clinical_calc_tenant ON public.hc_clinical_calculations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_clinical_calc_encounter ON public.hc_clinical_calculations(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_clinical_calc_lookup ON public.hc_clinical_calculations(tenant_id, encounter_id, algorithm_id);

-- 4. Ventilator Safety Policies
CREATE TABLE IF NOT EXISTS public.hc_ventilator_safety_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    settings_rules JSONB NOT NULL, -- policy configurations
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_vent_policies_tenant ON public.hc_ventilator_safety_policies(tenant_id);

-- 5. Ventilator Records
CREATE TABLE IF NOT EXISTS public.hc_ventilator_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    policy_id UUID NOT NULL REFERENCES public.hc_ventilator_safety_policies(id) ON DELETE RESTRICT,
    mode TEXT NOT NULL CHECK (mode IN ('AC', 'SIMV', 'CPAP', 'PSV', 'PRVC')),
    settings JSONB NOT NULL, -- fio2, peep, tidal_volume, respiratory_rate, pressure_support, ie_ratio, inspiratory_pressure
    monitored_params JSONB NOT NULL, -- pip, plat_pressure, minute_volume
    started_at TIMESTAMPTZ NOT NULL,
    stopped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_vent_records_tenant ON public.hc_ventilator_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_vent_records_encounter ON public.hc_ventilator_records(encounter_id);

-- 6. Emergency Visits
CREATE TABLE IF NOT EXISTS public.hc_emergency_visits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE UNIQUE,
    chief_complaint TEXT NOT NULL,
    assigned_bed_id UUID REFERENCES public.hc_beds(id) ON DELETE SET NULL,
    nedocs_score INTEGER,
    nedocs_calculated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_em_visits_tenant ON public.hc_emergency_visits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_em_visits_encounter ON public.hc_emergency_visits(encounter_id);

-- 7. Triage Assessments (Audit logs of emergency triage)
CREATE TABLE IF NOT EXISTS public.hc_triage_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    emergency_visit_id UUID NOT NULL REFERENCES public.hc_emergency_visits(id) ON DELETE CASCADE,
    acuity_level INTEGER NOT NULL CHECK (acuity_level BETWEEN 1 AND 5), -- ESI Triage Level
    assessment_type TEXT NOT NULL CHECK (assessment_type IN ('initial', 'reassessment', 'retriage')),
    acuity_criteria JSONB NOT NULL, -- Details of triage decisions
    assessed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    assessed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_triage_ass_tenant ON public.hc_triage_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_triage_ass_visit ON public.hc_triage_assessments(emergency_visit_id);

-- 8. Blood Units (Inventory & Lifecycle state machine)
CREATE TABLE IF NOT EXISTS public.hc_blood_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    unit_number TEXT NOT NULL,
    blood_type TEXT NOT NULL CHECK (blood_type IN ('A', 'B', 'AB', 'O')),
    rh_factor TEXT NOT NULL CHECK (rh_factor IN ('POSITIVE', 'NEGATIVE')),
    component_type TEXT NOT NULL CHECK (component_type IN ('RBC')), -- RBC only for B4
    status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (status IN ('RECEIVED', 'QUARANTINED', 'AVAILABLE', 'RESERVED', 'ISSUED', 'TRANSFUSING', 'TRANSFUSED', 'EXPIRED', 'DISCARDED', 'RETURNED', 'REJECTED')),
    expiry_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_blood_unit_number_tenant UNIQUE (tenant_id, unit_number)
);

CREATE INDEX IF NOT EXISTS idx_hc_blood_units_tenant ON public.hc_blood_units(tenant_id);

-- 9. Blood Crossmatch Records (Crossmatch lifecycle)
CREATE TABLE IF NOT EXISTS public.hc_blood_crossmatch_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    blood_unit_id UUID NOT NULL REFERENCES public.hc_blood_units(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'SAMPLE_VERIFIED', 'TESTED', 'COMPATIBLE', 'INCOMPATIBLE', 'APPROVED', 'EXPIRED', 'CANCELLED')),
    crossmatched_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    crossmatched_at TIMESTAMPTZ,
    approved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_crossmatch_tenant ON public.hc_blood_crossmatch_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_crossmatch_encounter ON public.hc_blood_crossmatch_records(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_crossmatch_unit ON public.hc_blood_crossmatch_records(blood_unit_id);

-- 10. Transfusion Verifications (Immutable double-verification sign-off)
CREATE TABLE IF NOT EXISTS public.hc_transfusion_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    blood_unit_id UUID NOT NULL REFERENCES public.hc_blood_units(id) ON DELETE CASCADE,
    crossmatch_id UUID NOT NULL REFERENCES public.hc_blood_crossmatch_records(id) ON DELETE CASCADE,
    verification_data JSONB NOT NULL, -- patient_id, unit_number, blood_type, rh_factor, component, crossmatch_result
    verified_by_clinician_a UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    verified_by_clinician_b UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    verified_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_trans_ver_tenant ON public.hc_transfusion_verifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_trans_ver_encounter ON public.hc_transfusion_verifications(encounter_id);

-- Trigger to make transfusion verifications immutable
CREATE OR REPLACE FUNCTION public.block_transfusion_verification_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'hc_transfusion_verifications is write-once, read-only. Mutation is blocked.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_block_transfusion_verification_mutation
BEFORE UPDATE OR DELETE ON public.hc_transfusion_verifications
FOR EACH ROW EXECUTE FUNCTION public.block_transfusion_verification_mutation();

-- 11. Transfusion Records (Active Transfusion state tracking)
CREATE TABLE IF NOT EXISTS public.hc_transfusion_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    blood_unit_id UUID NOT NULL REFERENCES public.hc_blood_units(id) ON DELETE CASCADE,
    verification_id UUID NOT NULL REFERENCES public.hc_transfusion_verifications(id) ON DELETE RESTRICT UNIQUE,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'aborted')),
    reaction_occurred BOOLEAN DEFAULT false NOT NULL,
    reaction_details TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_trans_rec_tenant ON public.hc_transfusion_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_trans_rec_encounter ON public.hc_transfusion_records(encounter_id);

-- ============================================================================
-- Row-Level Security (RLS) Configuration
-- ============================================================================
ALTER TABLE public.hc_icu_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_icu_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_clinical_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_ventilator_safety_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_ventilator_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_emergency_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_triage_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_blood_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_blood_crossmatch_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_transfusion_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_transfusion_records ENABLE ROW LEVEL SECURITY;

-- 1. ICU Beds Policy
CREATE POLICY tenant_isolation_icu_beds ON public.hc_icu_beds
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 2. ICU Observations Policy
CREATE POLICY tenant_isolation_icu_obs ON public.hc_icu_observations
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 3. Clinical Calculations Policy
CREATE POLICY tenant_isolation_calculations ON public.hc_clinical_calculations
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 4. Ventilator Safety Policies Policy
CREATE POLICY tenant_isolation_vent_policies ON public.hc_ventilator_safety_policies
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 5. Ventilator Records Policy
CREATE POLICY tenant_isolation_vent_records ON public.hc_ventilator_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 6. Emergency Visits Policy
CREATE POLICY tenant_isolation_em_visits ON public.hc_emergency_visits
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 7. Triage Assessments Policy
CREATE POLICY tenant_isolation_triage_ass ON public.hc_triage_assessments
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 8. Blood Units Policy
CREATE POLICY tenant_isolation_blood_units ON public.hc_blood_units
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 9. Blood Crossmatch Records Policy
CREATE POLICY tenant_isolation_crossmatch ON public.hc_blood_crossmatch_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 10. Transfusion Verifications Policy
CREATE POLICY tenant_isolation_trans_ver ON public.hc_transfusion_verifications
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 11. Transfusion Records Policy
CREATE POLICY tenant_isolation_trans_rec ON public.hc_transfusion_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());
