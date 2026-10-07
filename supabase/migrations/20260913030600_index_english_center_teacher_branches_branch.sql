-- ============================================================================
-- English Center concurrent index packaging
-- Source migration: 20260913030000_create_english_center_teachers.sql
-- Purpose: preserve zero-downtime CREATE INDEX CONCURRENTLY intent while
--          satisfying the E2E migration runner one-file/one-query contract.
-- ============================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teacher_branches_branch ON public.english_center_teacher_branches(branch_id);
