-- ============================================================================
-- Bella Healthcare Platform — Add Status Column to public.hc_prescriptions
-- Migration: 20260807050000_add_status_to_hc_prescriptions.sql
-- ============================================================================

ALTER TABLE public.hc_prescriptions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending_review';
