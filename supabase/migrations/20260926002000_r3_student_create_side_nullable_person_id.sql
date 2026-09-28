-- ============================================================================
-- R3 Student Identity Create-Side Completion
-- ============================================================================
-- Purpose:
-- Allow brand-new canonical Party-backed students to be created without
-- manufacturing legacy persons / identity_migration_mapping rows.
--
-- Contract:
-- - party_id remains the canonical Student identity for new writes.
-- - person_id remains as nullable transitional compatibility for legacy rows.
-- - Existing FK and indexes are preserved for legacy read paths.
-- ============================================================================

ALTER TABLE public.students
ALTER COLUMN person_id DROP NOT NULL;
