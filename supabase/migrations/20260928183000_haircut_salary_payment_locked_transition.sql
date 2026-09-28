-- Allow the salary payment transition on finalized locked salary records.
--
-- Locked salary_records remain immutable for salary components and period data.
-- The only additional permitted non-metadata update is the payment close-out
-- performed by Finance after the finalized salary expense is approved:
--   status: finalized/approved -> paid
--   paid_date: NULL -> non-NULL
--   paid_method: NULL -> non-empty

CREATE OR REPLACE FUNCTION public.prevent_locked_record_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.is_locked = true AND NEW.is_locked = true THEN
        IF TG_TABLE_NAME = 'salary_records'
           AND OLD.status IN ('finalized', 'approved')
           AND NEW.status = 'paid'
           AND OLD.paid_date IS NULL
           AND NEW.paid_date IS NOT NULL
           AND OLD.paid_method IS NULL
           AND NULLIF(BTRIM(COALESCE(NEW.paid_method, '')), '') IS NOT NULL
           AND (
               row_to_json(OLD)::jsonb
                 - 'status'
                 - 'paid_date'
                 - 'paid_method'
                 - 'business_event_type'
                 - 'accounting_metadata'
                 - 'accounting_review_status'
                 - 'updated_at'
           ) IS NOT DISTINCT FROM (
               row_to_json(NEW)::jsonb
                 - 'status'
                 - 'paid_date'
                 - 'paid_method'
                 - 'business_event_type'
                 - 'accounting_metadata'
                 - 'accounting_review_status'
                 - 'updated_at'
           ) THEN
            RETURN NEW;
        END IF;

        -- Only block if the record is locked AND non-metadata fields changed.
        -- Accounting metadata (business_event_type, accounting_metadata,
        -- accounting_review_status, updated_at) may be backfilled freely.
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
  'Salary records additionally allow the bounded finalized/approved -> paid payment transition '
  'for status, paid_date, and paid_method only.';
