-- ============================================================================
-- Bella Healthcare Platform — Phase H4 Surgery Schema Migration
-- Migration: 20260812070000_create_surgery_schema.sql
-- Governance: Clinical Safety Profile Tier 3
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Drop existing table if any to ensure clean schema recreate
DROP TABLE IF EXISTS public.hc_surgical_cases CASCADE;

-- 1. Create hc_surgical_cases table with strict constraints and exclusion rules
CREATE TABLE IF NOT EXISTS public.hc_surgical_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE RESTRICT,
    patient_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
    or_id TEXT NOT NULL,
    surgeon_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE RESTRICT,
    status TEXT NOT NULL CHECK (status IN ('SCHEDULED', 'PREOP_READY', 'ANESTHETIZED', 'PROCEDURE_IN_PROGRESS', 'RECOVERY_PACU', 'POSTOP_COMPLETED', 'planned', 'scheduled', 'ready', 'in_progress', 'completed', 'cancelled', 'aborted')),
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    preop_checklist_completed BOOLEAN NOT NULL DEFAULT FALSE,
    anesthesia_consent_signed BOOLEAN NOT NULL DEFAULT FALSE,
    cssd_token_id TEXT,
    cssd_verified_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT scheduled_time_sanity CHECK (scheduled_start < scheduled_end),

    -- OR schedule overlap exclusion constraint
    CONSTRAINT exclude_or_overlap EXCLUDE USING gist (
        tenant_id WITH =,
        or_id WITH =,
        tstzrange(scheduled_start, scheduled_end) WITH &&
    ) WHERE (status IN ('SCHEDULED', 'PREOP_READY', 'ANESTHETIZED', 'PROCEDURE_IN_PROGRESS', 'RECOVERY_PACU')),

    -- Surgeon schedule overlap exclusion constraint
    CONSTRAINT exclude_surgeon_overlap EXCLUDE USING gist (
        tenant_id WITH =,
        surgeon_id WITH =,
        tstzrange(scheduled_start, scheduled_end) WITH &&
    ) WHERE (status IN ('SCHEDULED', 'PREOP_READY', 'ANESTHETIZED', 'PROCEDURE_IN_PROGRESS', 'RECOVERY_PACU'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_tenant ON public.hc_surgical_cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_encounter ON public.hc_surgical_cases(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_patient ON public.hc_surgical_cases(patient_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_or ON public.hc_surgical_cases(or_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_surgeon ON public.hc_surgical_cases(surgeon_id);
CREATE INDEX IF NOT EXISTS idx_hc_surgical_cases_times ON public.hc_surgical_cases USING gist (tstzrange(scheduled_start, scheduled_end));

-- Enable RLS
ALTER TABLE public.hc_surgical_cases ENABLE ROW LEVEL SECURITY;

-- Tenant Isolation Policy
CREATE POLICY tenant_isolation_surgical_cases ON public.hc_surgical_cases
    FOR ALL TO authenticated USING (tenant_id = public.get_auth_tenant_id()) WITH CHECK (tenant_id = public.get_auth_tenant_id());
