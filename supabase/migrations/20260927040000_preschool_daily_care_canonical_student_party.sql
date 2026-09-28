-- ============================================================================
-- Bella Preschool - Daily Care canonical Student Party identity
-- ============================================================================
-- Purpose:
--   Allow Preschool Daily Care records to persist against canonical
--   party_parties.id identities used by the verified Enrollment/Roster flow.
--
-- Scope:
--   - edu_daily_care_records only
--   - keep legacy student_id column/FK for existing records
--   - do not touch parent digest, attendance, enrollment, guardian, pickup, or R3
-- ============================================================================

ALTER TABLE public.edu_daily_care_records
  ADD COLUMN IF NOT EXISTS student_party_id UUID
  REFERENCES public.party_parties(id) ON DELETE CASCADE;

ALTER TABLE public.edu_daily_care_records
  ALTER COLUMN student_id DROP NOT NULL;

-- zero-downtime: allow blocking-index - reviewed owner-deployed canonical student daily care uniqueness boundary
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_care_records_session_student_party
  ON public.edu_daily_care_records(session_id, student_party_id)
  WHERE student_party_id IS NOT NULL;

-- zero-downtime: allow blocking-index - reviewed owner-deployed canonical student daily care read-back index
CREATE INDEX IF NOT EXISTS idx_daily_care_records_tenant_student_party
  ON public.edu_daily_care_records(tenant_id, student_party_id);

COMMENT ON COLUMN public.edu_daily_care_records.student_party_id IS
  'Canonical Preschool Daily Care student identity: public.party_parties.id.';
