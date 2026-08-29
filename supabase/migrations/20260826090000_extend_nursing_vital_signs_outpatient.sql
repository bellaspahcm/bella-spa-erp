-- ============================================================================
-- Bella Healthcare Platform — Extend Nursing Vital Signs Schema for Outpatient
-- Migration: 20260826090000_extend_nursing_vital_signs_outpatient.sql
-- ============================================================================

-- Alter public.hc_nursing_vital_signs to support outpatient (nullable admission)
ALTER TABLE public.hc_nursing_vital_signs 
    ALTER COLUMN inpatient_admission_id DROP NOT NULL;

-- Enforce that at least one treatment context (admission or encounter) is provided
-- First drop existing constraint if it exists (for safety)
ALTER TABLE public.hc_nursing_vital_signs
    DROP CONSTRAINT IF EXISTS chk_vitals_admission_or_encounter;

ALTER TABLE public.hc_nursing_vital_signs 
    ADD CONSTRAINT chk_vitals_admission_or_encounter 
    CHECK (inpatient_admission_id IS NOT NULL OR encounter_id IS NOT NULL);
