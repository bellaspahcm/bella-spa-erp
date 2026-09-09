-- ============================================================================
-- BELLA PRESCHOOL OS: P8.2 WORK QUEUE EXCEPTION NOTICE_ID NULLABLE MIGRATION
-- Migration: 20260909000061_p82_nullable_exception_notice_id.sql
-- Description: Allows Work Queue exceptions projected from non-communication domains
--              (e.g., P8 Staff Shortages) to have NULL notice_id.
-- ============================================================================

ALTER TABLE public.edu_comm_exceptions ALTER COLUMN notice_id DROP NOT NULL;
