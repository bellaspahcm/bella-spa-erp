-- ============================================================================
-- BELLA PRESCHOOL OS: P6.2 PROJECTION BRIDGES & IDEMPOTENCY SCHEMA
-- Migration: 20260909000057_p62_projection_bridges.sql
-- Description: Idempotency indexes incorporating publication version & projection type,
--              plus active work queue exception escalation idempotency.
-- ============================================================================

-- Add source_version and projection_type columns to edu_comm_notices if not present
ALTER TABLE public.edu_comm_notices
ADD COLUMN IF NOT EXISTS source_version VARCHAR(50) DEFAULT '1',
ADD COLUMN IF NOT EXISTS projection_type VARCHAR(50) DEFAULT 'PARENT_PUBLICATION';

-- Drop old index if exists
DROP INDEX IF EXISTS public.idx_edu_comm_notices_source_idempotent;

-- 1. Unique index for Source Publication Version Idempotency
-- Prevents duplicate notice projections for the exact same publication version & projection type
CREATE UNIQUE INDEX IF NOT EXISTS idx_edu_comm_notices_source_idempotent
ON public.edu_comm_notices (tenant_id, source_domain, source_entity_type, source_entity_id, source_version, projection_type)
WHERE is_archived = false;

-- 2. Unique partial index for Active Work Queue Exception Idempotency
-- Prevents duplicate active (OPEN or IN_PROGRESS) exceptions for the same notice, guardian, and exception_type
CREATE UNIQUE INDEX IF NOT EXISTS idx_edu_comm_exceptions_idempotent
ON public.edu_comm_exceptions (tenant_id, notice_id, guardian_party_id, exception_type)
WHERE status IN ('OPEN', 'IN_PROGRESS');
