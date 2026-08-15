-- Migration: finance_db_constraint_audit
-- Description: Adds triggers and functions to enforce Financial Invariants at the database boundary.
--   Enforces:
--     1. Double-Entry Balance (Invariant F-I-1) at COMMIT time via DEFERRABLE triggers.
--     2. Transaction and Line Immutability (Invariant F-I-2) for POSTED, REVERSED, and VOIDED states.
--     3. Valid status state transitions on finance_transactions.
--     4. Deletion block on POSTED, REVERSED, and VOIDED transactions.
--     5. Accounting Period validity (must be OPEN for POSTED/REVERSED) on insert/update.

-- =========================================================================
-- 1. DOUBLE-ENTRY BALANCE & EMPTY TRANSACTION GUARD (DEFERRED CONSTRAINT TRIGGER)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_enforce_transaction_invariants()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR;
    v_tenant_id UUID;
    v_total_debit NUMERIC;
    v_total_credit NUMERIC;
    v_tx_id UUID;
BEGIN
    -- Resolve transaction ID and tenant depending on which table fired the trigger
    IF TG_TABLE_NAME = 'finance_transactions' THEN
        v_tx_id := NEW.id;
        v_status := NEW.status;
        v_tenant_id := NEW.tenant_id;
    ELSE
        IF TG_OP = 'DELETE' THEN
            v_tx_id := OLD.transaction_id;
            v_tenant_id := OLD.tenant_id;
        ELSE
            v_tx_id := NEW.transaction_id;
            v_tenant_id := NEW.tenant_id;
        END IF;
        
        -- Resolve status from transactions table
        SELECT status INTO v_status FROM public.finance_transactions WHERE id = v_tx_id;
    END IF;

    -- Only check balance and presence of lines if the transaction is POSTED or REVERSED
    IF v_status IN ('POSTED', 'REVERSED') THEN
        -- Calculate totals of functional debit and credit
        SELECT COALESCE(SUM(debit_functional_amount), 0), COALESCE(SUM(credit_functional_amount), 0)
        INTO v_total_debit, v_total_credit
        FROM public.finance_transaction_lines
        WHERE transaction_id = v_tx_id;

        -- Enforce double-entry balance invariant
        IF v_total_debit <> v_total_credit THEN
            RAISE EXCEPTION 'DOUBLE_ENTRY_IMBALANCE: Transaction % is imbalanced (debit: %, credit: %)', v_tx_id, v_total_debit, v_total_credit USING ERRCODE = 'D0001';
        END IF;

        -- Enforce that a posted transaction has at least one line
        IF NOT EXISTS (SELECT 1 FROM public.finance_transaction_lines WHERE transaction_id = v_tx_id) THEN
            RAISE EXCEPTION 'TRANSACTION_EMPTY: Posted transaction % must have at least one line', v_tx_id USING ERRCODE = 'T0003';
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Trigger on finance_transaction_lines (deferred to commit time)
DROP TRIGGER IF EXISTS finance_lines_invariant_trigger ON public.finance_transaction_lines;
CREATE CONSTRAINT TRIGGER finance_lines_invariant_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.finance_transaction_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.finance_enforce_transaction_invariants();

-- Trigger on finance_transactions (deferred to commit time)
DROP TRIGGER IF EXISTS finance_tx_invariant_trigger ON public.finance_transactions;
CREATE CONSTRAINT TRIGGER finance_tx_invariant_trigger
AFTER INSERT OR UPDATE ON public.finance_transactions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION public.finance_enforce_transaction_invariants();

-- =========================================================================
-- 2. TRANSACTION IMMUTABILITY & TRANSITION GUARDS (BEFORE UPDATE/DELETE)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_tx_immutability_guard()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Validate status transition
    IF OLD.status <> NEW.status THEN
        IF OLD.status = 'POSTED' AND NEW.status = 'REVERSED' THEN
            -- Allowed transition for reversal
        ELSIF OLD.status = 'DRAFT' AND NEW.status IN ('POSTED', 'VOIDED') THEN
            -- Allowed transitions from draft
        ELSE
            RAISE EXCEPTION 'INVALID_STATUS_TRANSITION: Cannot change status from % to %', OLD.status, NEW.status USING ERRCODE = 'T0004';
        END IF;
    END IF;

    -- 2. Enforce financial fields immutability for non-DRAFT transactions
    IF OLD.status IN ('POSTED', 'REVERSED', 'VOIDED') THEN
        IF OLD.tenant_id <> NEW.tenant_id OR
           OLD.accounting_period_id <> NEW.accounting_period_id OR
           OLD.posted_at IS DISTINCT FROM NEW.posted_at OR
           OLD.transaction_currency <> NEW.transaction_currency OR
           OLD.functional_currency <> NEW.functional_currency OR
           OLD.exchange_rate_rate <> NEW.exchange_rate_rate OR
           OLD.exchange_rate_source <> NEW.exchange_rate_source OR
           OLD.exchange_rate_target <> NEW.exchange_rate_target OR
           OLD.exchange_rate_effective <> NEW.exchange_rate_effective OR
           OLD.idempotency_key <> NEW.idempotency_key OR
           OLD.request_hash IS DISTINCT FROM NEW.request_hash OR
           OLD.source_type <> NEW.source_type OR
           OLD.source_id <> NEW.source_id OR
           OLD.reversal_of IS DISTINCT FROM NEW.reversal_of
        THEN
            RAISE EXCEPTION 'TRANSACTION_IMMUTABLE: Financial header fields of a % transaction cannot be modified', OLD.status USING ERRCODE = 'T0002';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_tx_immutability_trigger ON public.finance_transactions;
CREATE TRIGGER finance_tx_immutability_trigger
BEFORE UPDATE ON public.finance_transactions
FOR EACH ROW
EXECUTE FUNCTION public.finance_tx_immutability_guard();

-- Deletion block for non-DRAFT transactions
CREATE OR REPLACE FUNCTION public.finance_tx_delete_guard()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IN ('POSTED', 'REVERSED', 'VOIDED') THEN
        RAISE EXCEPTION 'TRANSACTION_IMMUTABLE: A % transaction cannot be deleted', OLD.status USING ERRCODE = 'T0002';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_tx_delete_trigger ON public.finance_transactions;
CREATE TRIGGER finance_tx_delete_trigger
BEFORE DELETE ON public.finance_transactions
FOR EACH ROW
EXECUTE FUNCTION public.finance_tx_delete_guard();

-- =========================================================================
-- 3. LINE-LEVEL IMMUTABILITY GUARD (BEFORE INSERT/UPDATE/DELETE)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_lines_immutability_guard()
RETURNS TRIGGER AS $$
DECLARE
    v_status VARCHAR;
    v_is_current_tx BOOLEAN;
    v_parent_tx_id UUID;
BEGIN
    -- Determine parent transaction ID
    IF TG_OP = 'DELETE' THEN
        v_parent_tx_id := OLD.transaction_id;
    ELSE
        v_parent_tx_id := NEW.transaction_id;
    END IF;

    -- Resolve parent status and check if created in the current DB transaction
    SELECT status, (xmin::text = txid_current()::text)
    INTO v_status, v_is_current_tx
    FROM public.finance_transactions
    WHERE id = v_parent_tx_id;

    -- If parent transaction does not exist (FK check will handle it)
    IF v_status IS NULL THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- If parent is DRAFT, lines can be modified freely
    IF v_status = 'DRAFT' THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- For POSTED, REVERSED, or VOIDED:
    -- Allow modifications ONLY if the parent transaction was created in the same DB transaction.
    -- This allows line inserts/updates during creation, but locks them post-commit.
    IF NOT v_is_current_tx THEN
        RAISE EXCEPTION 'TRANSACTION_IMMUTABLE: Cannot % lines of a % transaction', TG_OP, v_status USING ERRCODE = 'T0002';
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS finance_lines_immutability_trigger ON public.finance_transaction_lines;
CREATE TRIGGER finance_lines_immutability_trigger
BEFORE INSERT OR UPDATE OR DELETE ON public.finance_transaction_lines
FOR EACH ROW
EXECUTE FUNCTION public.finance_lines_immutability_guard();

-- =========================================================================
-- 4. ACCOUNTING PERIOD STATUS GUARD (BEFORE INSERT/UPDATE ON TRANSACTIONS)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.finance_tx_period_guard()
RETURNS TRIGGER AS $$
DECLARE
    v_period_status VARCHAR;
BEGIN
    IF NEW.status IN ('POSTED', 'REVERSED') THEN
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

DROP TRIGGER IF EXISTS finance_tx_period_trigger ON public.finance_transactions;
CREATE TRIGGER finance_tx_period_trigger
BEFORE INSERT OR UPDATE ON public.finance_transactions
FOR EACH ROW
EXECUTE FUNCTION public.finance_tx_period_guard();
