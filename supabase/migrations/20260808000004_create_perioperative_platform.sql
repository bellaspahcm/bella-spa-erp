-- ============================================================================
-- Bella Healthcare Platform — Phase B1 Perioperative Care Platform Schema
-- Migration: 20260808000004_create_perioperative_platform.sql
-- Governance: Clinical Safety Profile Tier 3
-- ============================================================================

-- Enable the btree_gist extension for tenant-aware exclusion constraints
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 1. CLINICAL SAFETY PROFILES (Immutable Governance Evidence)
CREATE TABLE IF NOT EXISTS public.hc_clinical_safety_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    profile_version TEXT NOT NULL,
    approved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    approved_scope TEXT NOT NULL,
    document_sha256 CHAR(64) NOT NULL,
    architecture_version TEXT NOT NULL,
    deployment_status TEXT NOT NULL DEFAULT 'draft' CHECK (deployment_status IN ('draft', 'active', 'deprecated')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_clinical_safety_profiles_tenant ON public.hc_clinical_safety_profiles(tenant_id);

CREATE OR REPLACE FUNCTION public.block_clinical_safety_profile_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'hc_clinical_safety_profiles table is read-only. Mutation is blocked.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_block_safety_profile_mutation
BEFORE UPDATE OR DELETE ON public.hc_clinical_safety_profiles
FOR EACH ROW EXECUTE FUNCTION public.block_clinical_safety_profile_mutation();


-- 2. PERSISTENT IDEMPOTENCY KEYS
CREATE TABLE IF NOT EXISTS public.hc_idempotency_keys (
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    PRIMARY KEY (tenant_id, request_id, operation)
);

CREATE INDEX IF NOT EXISTS idx_hc_idempotency_keys_lookup ON public.hc_idempotency_keys(tenant_id, request_id);

-- 3. OPERATING ROOMS
CREATE TABLE IF NOT EXISTS public.hc_operating_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'inactive')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_room_number_tenant UNIQUE (tenant_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_hc_operating_rooms_tenant ON public.hc_operating_rooms(tenant_id);

-- 4. OPERATING ROOM SCHEDULES (with EXCLUDE overlap protection)
CREATE TABLE IF NOT EXISTS public.hc_or_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    operating_room_id UUID NOT NULL REFERENCES public.hc_operating_rooms(id) ON DELETE CASCADE,
    scheduled_time_range TSTZRANGE NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT exclude_or_schedule_overlap EXCLUDE USING gist (
        tenant_id WITH =,
        operating_room_id WITH =,
        scheduled_time_range WITH &&
    ) WHERE (status IN ('scheduled', 'confirmed', 'in_progress'))
);

CREATE INDEX IF NOT EXISTS idx_hc_or_schedules_tenant ON public.hc_or_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_or_schedules_room ON public.hc_or_schedules(operating_room_id);
CREATE INDEX IF NOT EXISTS idx_hc_or_schedules_time ON public.hc_or_schedules USING gist (scheduled_time_range);

-- 5. SURGICAL CASES
CREATE TABLE IF NOT EXISTS public.hc_surgical_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    case_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled', 'aborted')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_case_number_tenant UNIQUE (tenant_id, case_number)
);

CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_tenant ON public.hc_surgical_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_encounter ON public.hc_surgical_cases(encounter_id);

-- 6. SURGICAL TEAMS (Normalized Participants)
CREATE TABLE IF NOT EXISTS public.hc_surgical_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('surgeon', 'assistant_surgeon', 'anesthesiologist', 'circulating_nurse', 'scrub_nurse')),
    assigned_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    left_at TIMESTAMPTZ,
    CONSTRAINT unique_team_member UNIQUE (surgical_case_id, user_id, role)
);

CREATE INDEX IF NOT EXISTS idx_hc_surgical_teams_tenant ON public.hc_surgical_teams(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_teams_case ON public.hc_surgical_teams(surgical_case_id);

-- 7. SURGICAL SAFETY CHECKLISTS (WHO Sign-In, Time-Out, Sign-Out)
CREATE TABLE IF NOT EXISTS public.hc_surgical_safety_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE UNIQUE,
    signin_completed BOOLEAN NOT NULL DEFAULT false,
    signin_completed_at TIMESTAMPTZ,
    signin_completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    timeout_completed BOOLEAN NOT NULL DEFAULT false,
    timeout_completed_at TIMESTAMPTZ,
    timeout_completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    signout_completed BOOLEAN NOT NULL DEFAULT false,
    signout_completed_at TIMESTAMPTZ,
    signout_completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_surgical_safety_checklists_tenant ON public.hc_surgical_safety_checklists(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_safety_checklists_case ON public.hc_surgical_safety_checklists(surgical_case_id);

-- 8. ANESTHESIA RECORDS
CREATE TABLE IF NOT EXISTS public.hc_anesthesia_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE UNIQUE,
    asa_classification INTEGER CHECK (asa_classification BETWEEN 1 AND 6),
    status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created', 'pre_op_complete', 'intra_op', 'post_op', 'completed')),
    pre_op_assessment TEXT,
    post_op_assessment TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_records_tenant ON public.hc_anesthesia_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_records_case ON public.hc_anesthesia_records(surgical_case_id);

-- 9. ANESTHESIA OBSERVATIONS (Time-series vital signs)
CREATE TABLE IF NOT EXISTS public.hc_anesthesia_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    anesthesia_record_id UUID NOT NULL REFERENCES public.hc_anesthesia_records(id) ON DELETE CASCADE,
    observation_time TIMESTAMPTZ NOT NULL,
    type TEXT NOT NULL,
    value NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_obs_tenant ON public.hc_anesthesia_observations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_obs_record ON public.hc_anesthesia_observations(anesthesia_record_id);
CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_obs_time ON public.hc_anesthesia_observations(observation_time DESC);

-- 10. ANESTHESIA MEDICATIONS
CREATE TABLE IF NOT EXISTS public.hc_anesthesia_medications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    anesthesia_record_id UUID NOT NULL REFERENCES public.hc_anesthesia_records(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    administered_at TIMESTAMPTZ NOT NULL,
    dose NUMERIC NOT NULL,
    unit TEXT NOT NULL,
    waste NUMERIC NOT NULL DEFAULT 0,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_meds_tenant ON public.hc_anesthesia_medications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_anesthesia_meds_record ON public.hc_anesthesia_medications(anesthesia_record_id);

-- 11. PACU ADMISSIONS (with Discharge Policy Snapshotting)
CREATE TABLE IF NOT EXISTS public.hc_pacu_admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE UNIQUE,
    admitted_at TIMESTAMPTZ NOT NULL,
    discharged_at TIMESTAMPTZ,
    discharge_policy_version TEXT NOT NULL,
    aldrete_score INTEGER CHECK (aldrete_score BETWEEN 0 AND 10),
    pain_score INTEGER CHECK (pain_score BETWEEN 0 AND 10),
    status TEXT NOT NULL DEFAULT 'admitted' CHECK (status IN ('admitted', 'ready_for_discharge', 'discharged')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_pacu_admissions_tenant ON public.hc_pacu_admissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_pacu_admissions_case ON public.hc_pacu_admissions(surgical_case_id);

-- 12. SPECIMENS
CREATE TABLE IF NOT EXISTS public.hc_specimens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    specimen_code TEXT NOT NULL,
    tissue_source TEXT NOT NULL,
    collection_time TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'collected' CHECK (status IN ('collected', 'sent_to_lab', 'received_lab', 'processed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_specimen_code_tenant UNIQUE (tenant_id, specimen_code)
);

CREATE INDEX IF NOT EXISTS idx_hc_specimens_tenant ON public.hc_specimens(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_specimens_case ON public.hc_specimens(surgical_case_id);

-- 13. IMPLANTS (Traceable)
CREATE TABLE IF NOT EXISTS public.hc_implants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    implant_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
    serial_number TEXT NOT NULL,
    implanted_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_implants_tenant ON public.hc_implants(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_implants_case ON public.hc_implants(surgical_case_id);

-- 14. EQUIPMENT
CREATE TABLE IF NOT EXISTS public.hc_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    serial_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'in_use', 'sterile_hold', 'maintenance')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_equip_serial_tenant UNIQUE (tenant_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_hc_equipment_tenant ON public.hc_equipment(tenant_id);

-- 15. CSSD CYCLES
CREATE TABLE IF NOT EXISTS public.hc_cssd_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cycle_number TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    indicator_result TEXT CHECK (indicator_result IN ('pass', 'fail', 'pending')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_cycle_number_tenant UNIQUE (tenant_id, cycle_number)
);

CREATE INDEX IF NOT EXISTS idx_hc_cssd_cycles_tenant ON public.hc_cssd_cycles(tenant_id);

-- 16. CSSD CYCLE ITEMS
CREATE TABLE IF NOT EXISTS public.hc_cssd_cycle_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cssd_cycle_id UUID NOT NULL REFERENCES public.hc_cssd_cycles(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.hc_equipment(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('processing', 'sterilized', 'failed')),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_cssd_cycle_items_tenant ON public.hc_cssd_cycle_items(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_cssd_cycle_items_cycle ON public.hc_cssd_cycle_items(cssd_cycle_id);

-- 17. OR EQUIPMENT USAGE
CREATE TABLE IF NOT EXISTS public.hc_or_equipment_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    surgical_case_id UUID NOT NULL REFERENCES public.hc_surgical_cases(id) ON DELETE CASCADE,
    equipment_id UUID NOT NULL REFERENCES public.hc_equipment(id) ON DELETE CASCADE,
    cssd_cycle_id UUID NOT NULL REFERENCES public.hc_cssd_cycles(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ NOT NULL,
    returned_at TIMESTAMPTZ,
    CONSTRAINT unique_case_equipment_cycle UNIQUE (surgical_case_id, equipment_id, cssd_cycle_id)
);

CREATE INDEX IF NOT EXISTS idx_hc_or_equip_usage_tenant ON public.hc_or_equipment_usage(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_or_equip_usage_case ON public.hc_or_equipment_usage(surgical_case_id);

-- ============================================================================
-- Row-Level Security (RLS) Configuration
-- ============================================================================

ALTER TABLE public.hc_clinical_safety_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_operating_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_or_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_surgical_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_surgical_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_surgical_safety_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_anesthesia_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_anesthesia_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_anesthesia_medications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_pacu_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_specimens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_implants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_cssd_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_cssd_cycle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_or_equipment_usage ENABLE ROW LEVEL SECURITY;

-- Deny all SELECT, INSERT, UPDATE, DELETE permissions for public/anon roles
-- Exclude from policies (since policies apply to authenticated context by default)
-- Policies below are TO authenticated roles only.

-- 1. Safety Profiles
CREATE POLICY tenant_isolation_profiles ON public.hc_clinical_safety_profiles
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 2. Idempotency Keys
CREATE POLICY tenant_isolation_idempotency ON public.hc_idempotency_keys
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 3. Operating Rooms
CREATE POLICY tenant_isolation_rooms ON public.hc_operating_rooms
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 4. OR Schedules
CREATE POLICY tenant_isolation_schedules ON public.hc_or_schedules
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 5. Surgical Cases
CREATE POLICY tenant_isolation_cases ON public.hc_surgical_cases
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 6. Surgical Teams
CREATE POLICY tenant_isolation_teams ON public.hc_surgical_teams
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 7. Safety Checklists
CREATE POLICY tenant_isolation_checklists ON public.hc_surgical_safety_checklists
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 8. Anesthesia Records
CREATE POLICY tenant_isolation_anesthesia ON public.hc_anesthesia_records
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 9. Anesthesia Observations
CREATE POLICY tenant_isolation_observations ON public.hc_anesthesia_observations
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 10. Anesthesia Medications
CREATE POLICY tenant_isolation_medications ON public.hc_anesthesia_medications
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 11. PACU Admissions
CREATE POLICY tenant_isolation_pacu ON public.hc_pacu_admissions
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 12. Specimens
CREATE POLICY tenant_isolation_specimens ON public.hc_specimens
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 13. Implants
CREATE POLICY tenant_isolation_implants ON public.hc_implants
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 14. Equipment
CREATE POLICY tenant_isolation_equipment ON public.hc_equipment
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 15. CSSD Cycles
CREATE POLICY tenant_isolation_cssd ON public.hc_cssd_cycles
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 16. CSSD Cycle Items
CREATE POLICY tenant_isolation_cssd_items ON public.hc_cssd_cycle_items
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());

-- 17. OR Equipment Usage
CREATE POLICY tenant_isolation_or_equip ON public.hc_or_equipment_usage
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());
