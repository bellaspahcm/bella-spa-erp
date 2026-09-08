-- Retail OS Add Batch Fields
-- Date: 2026-09-06
-- Purpose: Add missing initial_stock, unit, supplier_id, notes columns

ALTER TABLE public.retail_product_batches
  ADD COLUMN IF NOT EXISTS initial_stock INTEGER NOT NULL DEFAULT 0 CHECK (initial_stock >= 0),
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS supplier_id TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;
