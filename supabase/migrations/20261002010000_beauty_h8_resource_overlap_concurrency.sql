-- Beauty OS H8 resource allocation concurrency invariant.
-- Protects active same-resource overlapping allocations at the DB commit boundary.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'beauty_resource_allocations_no_active_overlap'
      AND conrelid = 'public.beauty_resource_allocations'::regclass
  ) THEN
    ALTER TABLE public.beauty_resource_allocations
      ADD CONSTRAINT beauty_resource_allocations_no_active_overlap
      EXCLUDE USING gist (
        tenant_id WITH =,
        resource_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status = 'ACTIVE');
  END IF;
END
$$;
