-- ==========================================
-- MISSING MIGRATION: Create packages table
-- Timestamp: 20260514900000 (before M8: 20260515010000)
-- Purpose: Reconstruct manual schema creation
-- Evidence: Forensic analysis P0_M8_PACKAGES_FORENSIC.md
-- ==========================================
--
-- This DDL reconstructs the MINIMAL packages table schema
-- that MUST have existed before migration #8 based on:
--
-- DIRECT EVIDENCE (M8):
--   id, name - SELECT id WHERE name
--
-- STRONG INFERENCE (M9-M17):
--   tenant_id - M9 JOIN, no ADD COLUMN found
--   full_price - M11 explicitly calls "cột cũ" (old column)
--   description, total_sessions, status - M17 INSERT, M11 doesn't add
--
-- EXCLUDED:
--   created_at/updated_at - no migration references (inference only)
--   11 E2E columns - no migration history (schema drift)

CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  full_price BIGINT NOT NULL,
  description TEXT,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'active'
);

-- Index for tenant isolation
-- zero-downtime: allow blocking-index - index on newly created packages table
CREATE INDEX IF NOT EXISTS idx_packages_tenant_id ON public.packages(tenant_id);

-- RLS (M11 will grant broader permissions)
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
