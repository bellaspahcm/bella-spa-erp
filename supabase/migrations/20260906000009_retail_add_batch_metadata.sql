-- Migration: Add metadata column to retail_product_batches
-- Purpose: R4 Batch/Lot Tracking requires metadata JSONB field for extensibility
-- Date: 2026-09-06

ALTER TABLE public.retail_product_batches
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.retail_product_batches.metadata IS 'Extensible metadata for batch-specific attributes (certifications, origin, quality metrics)';
