-- ============================================================================
-- Bella Healthcare Platform — Add 'inpatient' to hc_encounters encounter_class
-- Migration: 20260808000001_add_inpatient_encounter_class.sql
--
-- PURPOSE: Enable data isolation between outpatient (Medical module) and
--          inpatient (Hospital module) encounters via encounter_class field.
--
-- COMPLIANCE:
--   - Law 4: Additive-only — no column drops, no NOT NULL on existing rows
--   - Law 9: Zero regression — all existing encounter rows retain their class
--
-- New valid encounter_class values after this migration:
--   Ambulatory (Medical):  walk_in, scheduled, emergency, telemedicine, follow_up, homecare
--   Inpatient (Hospital):  inpatient
-- ============================================================================

-- Step 1: Drop the old CHECK constraint
ALTER TABLE public.hc_encounters
  DROP CONSTRAINT IF EXISTS hc_encounters_encounter_class_check;

-- Step 2: Add new CHECK constraint including 'inpatient'
ALTER TABLE public.hc_encounters
  ADD CONSTRAINT hc_encounters_encounter_class_check
  CHECK (encounter_class IN (
    'walk_in',
    'scheduled',
    'emergency',
    'telemedicine',
    'follow_up',
    'homecare',
    'inpatient'   -- New: Hospital Product Pack (nội trú)
  ));

-- Step 3: Add performance index for care-setting filtering
CREATE INDEX IF NOT EXISTS idx_hc_encounters_class_tenant
  ON public.hc_encounters(tenant_id, encounter_class);

-- Step 4: Add a helper comment on the column for DBA clarity
COMMENT ON COLUMN public.hc_encounters.encounter_class IS
  'Care setting classifier. Ambulatory classes: walk_in, scheduled, emergency, telemedicine, follow_up, homecare. Inpatient class: inpatient (Hospital Product Pack only).';
