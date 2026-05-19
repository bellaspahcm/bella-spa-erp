-- Migration: Add rejection_reason column to staff_leaves
-- Applied on 2026-05-19

ALTER TABLE public.staff_leaves ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
