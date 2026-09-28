-- Allow the finance payment workflow to mark a finalized, locked salary record as paid.
--
-- Runtime evidence:
--   Finance UI -> confirmTransaction(expenseId, 'expense') -> salary_records update
--   reached the locked-record trigger and failed with:
--   "Cannot edit a locked record. Contact Admin to unlock."
--
-- The exception is intentionally narrow:
--   salary_records.status: finalized -> paid
--   paid_date / paid_method may be set
--   accounting metadata may be set
--   is_locked remains true
--   financial amounts, tenant, KTV, and month identity remain protected.

CREATE OR REPLACE FUNCTION public.prevent_locked_record_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
    IF OLD.is_locked = true AND NEW.is_locked = true THEN
        IF TG_TABLE_SCHEMA = 'public'
           AND TG_TABLE_NAME = 'salary_records'
           AND OLD.status = 'finalized'
           AND NEW.status = 'paid'
           AND OLD.paid_date IS NULL
           AND NEW.paid_date IS NOT NULL
           AND OLD.paid_method IS NULL
           AND NEW.paid_method IS NOT NULL
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
           )
        THEN
            RETURN NEW;
        END IF;

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
  'Metadata fields remain exempt. '
  'Salary records may transition finalized -> paid while staying locked, '
  'setting only paid_date, paid_method, and accounting metadata. '
  'Fixed in 20260928183000 for the Haircut salary payment workflow.';
