-- Migration: allow metadata-only updates on locked records
-- The previous trigger prevent_locked_record_update blocked ALL updates when
-- is_locked = true, including backfill of accounting metadata fields.
-- This fix makes the trigger smarter: it only blocks changes to financial/
-- business fields; metadata columns (business_event_type, accounting_metadata,
-- accounting_review_status) may still be updated even when locked.
--
-- Security guarantee unchanged: no amount, status, ktv_id, month_year, or
-- salary component changes are allowed on locked records.

CREATE OR REPLACE FUNCTION public.prevent_locked_record_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    -- Only block if the record is locked AND non-metadata fields changed.
    -- Accounting metadata (business_event_type, accounting_metadata,
    -- accounting_review_status, updated_at) may be backfilled freely.
    IF OLD.is_locked = true AND NEW.is_locked = true THEN
        IF (
            row_to_json(OLD)::jsonb
              - 'business_event_type'
              - 'accounting_metadata'
              - 'accounting_review_status'
              - 'updated_at'
        ) IS DISTINCT FROM (
            row_to_json(NEW)::jsonb
              - 'business_event_type'
              - 'accounting_metadata'
              - 'accounting_review_status'
              - 'updated_at'
        ) THEN
            RAISE EXCEPTION 'Cannot edit a locked record. Contact Admin to unlock.';
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

COMMENT ON FUNCTION public.prevent_locked_record_update IS
  'Blocks financial-field edits on locked records (is_locked=true). '
  'Metadata fields (business_event_type, accounting_metadata, accounting_review_status) '
  'are exempt and may be updated by the accounting backfill process. '
  'Fixed in 20260710154000 to not block metadata-only updates.';
