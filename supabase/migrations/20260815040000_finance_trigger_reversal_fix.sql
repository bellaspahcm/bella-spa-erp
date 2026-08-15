-- Migration: finance_trigger_reversal_fix
-- Description: Updates the finance_tx_period_guard function to allow updating the status of an existing 
--   transaction to 'REVERSED' even if its accounting period is closed. The new reversal transaction itself 
--   will still have its period status validated since its status is 'POSTED' (and it must belong to an OPEN period).

CREATE OR REPLACE FUNCTION public.finance_tx_period_guard()
RETURNS TRIGGER AS $$
DECLARE
    v_period_status VARCHAR;
BEGIN
    -- Only enforce period status for new postings (status = 'POSTED').
    -- When a transaction's status is changed to 'REVERSED' or 'VOIDED', we allow it even if the period is closed.
    IF NEW.status = 'POSTED' THEN
        SELECT status INTO v_period_status
        FROM public.finance_accounting_periods
        WHERE id = NEW.accounting_period_id;

        IF v_period_status IS NULL THEN
            RAISE EXCEPTION 'PERIOD_NOT_FOUND' USING ERRCODE = 'P0001';
        END IF;

        IF v_period_status <> 'OPEN' THEN
            RAISE EXCEPTION 'PERIOD_NOT_OPEN: Cannot post transaction to a % period', v_period_status USING ERRCODE = 'P0002';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
