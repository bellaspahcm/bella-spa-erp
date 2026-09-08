-- ============================================================================
-- Bella Preschool — Primary Guardian Invariant
-- Enforces: Each student can have at most ONE primary guardian
-- 
-- WHY: Application-level enforcement (unset others → insert new) has race condition.
--      DB constraint ensures invariant regardless of concurrent requests.
-- 
-- IMPACT: Any attempt to insert/update multiple is_primary_contact=true for
--         same student_id will be rejected by DB.
-- ============================================================================

-- Add partial unique index: only one row per student_id where is_primary_contact = true
CREATE UNIQUE INDEX IF NOT EXISTS preschool_student_guardians_one_primary_per_student
ON public.preschool_student_guardians (student_id)
WHERE is_primary_contact = true;

COMMENT ON INDEX public.preschool_student_guardians_one_primary_per_student 
IS 'Enforces business invariant: each student can have at most ONE primary guardian';

-- Verify constraint works
DO $$
BEGIN
  -- Test: Try to create duplicate primary guardians (should fail after constraint added)
  -- This is documentation only, actual test in verification script
  RAISE NOTICE 'Primary guardian constraint added successfully';
  RAISE NOTICE 'Invariant: Only ONE is_primary_contact=true per student_id';
END $$;
