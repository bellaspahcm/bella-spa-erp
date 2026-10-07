-- ============================================================================
-- English Center concurrent index packaging
-- Source migration: 20260913020000_create_english_center_enrollments.sql
-- Purpose: preserve zero-downtime CREATE INDEX CONCURRENTLY intent while
--          satisfying the E2E migration runner one-file/one-query contract.
-- ============================================================================

CREATE INDEX CONCURRENTLY idx_english_enrollments_class
  ON public.english_center_enrollments(class_id)
  WHERE class_id IS NOT NULL;
