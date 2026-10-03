-- Product Identity schema foundation.
-- Restored from PRODUCT_IDENTITY_CHECKPOINT_2026_09_19.md so local migration
-- history matches the E2E migration ledger without mutating production data.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS product_key TEXT;
