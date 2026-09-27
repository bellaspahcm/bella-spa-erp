-- Bella Preschool - Parent Daily Digest canonical Student Party identity
--
-- Scope:
-- - Cut operational Parent Digest identity from legacy students.student_id to
--   canonical public.party_parties.id.
-- - Preserve legacy student_id for compatibility; do not backfill or drop.
-- - Do not touch attendance, daily care source records, guardian authorization,
--   pickup/handover events, R3, or parent communication delivery tables.

ALTER TABLE public.edu_daily_parent_digests
  ADD COLUMN IF NOT EXISTS student_party_id UUID
  REFERENCES public.party_parties(id) ON DELETE CASCADE;

ALTER TABLE public.edu_daily_parent_digests
  ALTER COLUMN student_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_parent_digests_session_student_party
  ON public.edu_daily_parent_digests(session_id, student_party_id)
  WHERE student_party_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daily_parent_digests_tenant_student_party
  ON public.edu_daily_parent_digests(tenant_id, student_party_id);

COMMENT ON COLUMN public.edu_daily_parent_digests.student_party_id IS
  'Canonical Preschool Parent Daily Digest student identity: public.party_parties.id.';
