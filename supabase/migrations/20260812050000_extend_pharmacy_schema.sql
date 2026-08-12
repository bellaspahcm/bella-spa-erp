-- ============================================================================
-- Bella Healthcare Platform — Extend Pharmacy Schema
-- Migration: 20260812050000_extend_pharmacy_schema.sql
-- ============================================================================

-- 1. Alter public.hc_prescriptions to link to public.hc_clinical_orders
ALTER TABLE public.hc_prescriptions 
    ADD COLUMN IF NOT EXISTS clinical_order_id UUID UNIQUE REFERENCES public.hc_clinical_orders(id) ON DELETE RESTRICT;

-- For existing systems, this column would need to be backfilled. Since it is empty in this environment:
ALTER TABLE public.hc_prescriptions 
    ALTER COLUMN clinical_order_id SET NOT NULL;

-- Create performance index for prescription -> order joins
CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_clinical_order 
    ON public.hc_prescriptions(clinical_order_id);

-- 2. Alter public.hc_medication_administration_records to support outpatient and check constraints
ALTER TABLE public.hc_medication_administration_records 
    ALTER COLUMN inpatient_admission_id DROP NOT NULL;

ALTER TABLE public.hc_medication_administration_records 
    ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.hc_encounters(id) ON DELETE RESTRICT;

-- Enforce that at least one treatment context is provided
ALTER TABLE public.hc_medication_administration_records 
    ADD CONSTRAINT chk_mar_admission_or_encounter 
    CHECK (inpatient_admission_id IS NOT NULL OR encounter_id IS NOT NULL);

-- Create performance index for MAR -> encounter queries
CREATE INDEX IF NOT EXISTS idx_hc_mar_encounter 
    ON public.hc_medication_administration_records(encounter_id);

-- 3. Trigger for cross-table encounter consistency (Admission Encounter == MAR Encounter)
CREATE OR REPLACE FUNCTION public.verify_mar_encounter_consistency()
RETURNS TRIGGER AS $$
DECLARE
    admission_encounter_id UUID;
BEGIN
    IF NEW.inpatient_admission_id IS NOT NULL AND NEW.encounter_id IS NOT NULL THEN
        SELECT encounter_id INTO admission_encounter_id
        FROM public.hc_inpatient_admissions
        WHERE id = NEW.inpatient_admission_id;
        
        IF FOUND AND admission_encounter_id <> NEW.encounter_id THEN
            RAISE EXCEPTION 'MAR encounter_id (%) does not match referenced inpatient admission encounter_id (%)',
                NEW.encounter_id, admission_encounter_id
                USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verify_mar_encounter_consistency ON public.hc_medication_administration_records;
CREATE TRIGGER trg_verify_mar_encounter_consistency
    BEFORE INSERT OR UPDATE ON public.hc_medication_administration_records
    FOR EACH ROW EXECUTE FUNCTION public.verify_mar_encounter_consistency();
