-- Migration: 20260824065000_f2_cash_projection_effective_date_fix
-- Component: F2.5 patch for F5.6 readiness
-- Scope: Cash movement insert compatibility only. Does not enable F5.6 reconciliation domains.
-- Authority: F2_CASH:v1.2 temporal contract. effective_date = finance_transactions.posted_at.

CREATE OR REPLACE FUNCTION public.finance_cash_movement_effective_date_guard()
RETURNS TRIGGER
SET search_path = public
AS $$
DECLARE
    v_f1_posted_at TIMESTAMPTZ;
BEGIN
    IF NEW.effective_date IS NOT NULL THEN
        RETURN NEW;
    END IF;

    SELECT posted_at INTO v_f1_posted_at
    FROM public.finance_transactions
    WHERE id = NEW.f1_transaction_id
      AND tenant_id = NEW.tenant_id
      AND status = 'POSTED';

    IF v_f1_posted_at IS NULL THEN
        RAISE EXCEPTION 'F2_EFFECTIVE_DATE_SOURCE_MISSING: posted F1 transaction required for cash movement effective_date'
            USING ERRCODE = 'F2011';
    END IF;

    NEW.effective_date := v_f1_posted_at;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_finance_cash_movement_effective_date_guard
    ON public.finance_cash_movements;

CREATE TRIGGER trg_finance_cash_movement_effective_date_guard
    BEFORE INSERT ON public.finance_cash_movements
    FOR EACH ROW
    EXECUTE FUNCTION public.finance_cash_movement_effective_date_guard();

COMMENT ON FUNCTION public.finance_cash_movement_effective_date_guard() IS
    'F2.5 compatibility patch: when trusted cash projection inserts a movement without effective_date, set it from finance_transactions.posted_at per F2_CASH:v1.2. Does not enable F5.6 reconciliation domains.';
