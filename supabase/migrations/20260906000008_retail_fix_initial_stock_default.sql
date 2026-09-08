-- Fix initial_stock constraint
-- Remove NOT NULL constraint from initial_stock since it was added with DEFAULT

ALTER TABLE public.retail_product_batches
  ALTER COLUMN initial_stock DROP NOT NULL;
