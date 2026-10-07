-- ============================================================================
-- English Center concurrent index packaging
-- Source migration: 20260913010000_create_english_center_program_course_class.sql
-- Purpose: preserve zero-downtime CREATE INDEX CONCURRENTLY intent while
--          satisfying the E2E migration runner one-file/one-query contract.
-- ============================================================================

CREATE INDEX CONCURRENTLY idx_classes_teacher ON public.english_center_classes(teacher_id) WHERE teacher_id IS NOT NULL;
