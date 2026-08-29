-- =========================================================================
-- Migration: F4 Prepayment GL Map Effective-Range Guard
-- Purpose:
--   Prevent overlapping PREPAYMENT_CONTROL effective ranges per tenant.
--   Historical reconciliation must be deterministic and tenant-scoped.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_prepayment_control_mapping_range_guard()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.control_type <> 'PREPAYMENT_CONTROL' THEN
        RETURN NEW;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.finance_control_account_mappings existing
        WHERE existing.tenant_id = NEW.tenant_id
          AND existing.control_type = 'PREPAYMENT_CONTROL'
          AND existing.id IS DISTINCT FROM NEW.id
          AND daterange(existing.effective_from, COALESCE(existing.effective_to, DATE '9999-12-31'), '[]') &&
              daterange(NEW.effective_from, COALESCE(NEW.effective_to, DATE '9999-12-31'), '[]')
    ) THEN
        RAISE EXCEPTION 'PREPAYMENT_CONTROL_MAPPING_OVERLAP: tenant % has overlapping PREPAYMENT_CONTROL effective ranges',
            NEW.tenant_id
            USING ERRCODE = 'F5023';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_finance_prepayment_control_mapping_range_guard
    ON public.finance_control_account_mappings;

CREATE TRIGGER trg_finance_prepayment_control_mapping_range_guard
    BEFORE INSERT OR UPDATE OF control_type, effective_from, effective_to
    ON public.finance_control_account_mappings
    FOR EACH ROW
    EXECUTE FUNCTION public.finance_prepayment_control_mapping_range_guard();

COMMENT ON FUNCTION public.finance_prepayment_control_mapping_range_guard() IS
    'Guards F4_PREPAYMENT_GL_MAP:v1 determinism by rejecting overlapping PREPAYMENT_CONTROL effective ranges per tenant.';