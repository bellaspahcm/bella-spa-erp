-- Fix: The `salary_records` table uses `finalized` status, not `paid`.
-- This migration updates all accounting sync and reconciliation RPCs to use `status = 'finalized'`.

DO $$
DECLARE
    v_func TEXT;
BEGIN
    -- 1. get_reconciliation_report
    SELECT pg_get_functiondef('public.get_reconciliation_report(uuid, date, date)'::regprocedure) INTO v_func;
    IF v_func IS NOT NULL THEN
        v_func := replace(v_func, 'status = ''paid''', 'status = ''finalized''');
        EXECUTE v_func;
    END IF;

    -- 2. sync_legacy_to_ledger_atomic
    SELECT pg_get_functiondef('public.sync_legacy_to_ledger_atomic(uuid, uuid)'::regprocedure) INTO v_func;
    IF v_func IS NOT NULL THEN
        -- We want to replace 's.status = ''paid''' and 'status = ''paid''' (in readiness subquery)
        v_func := replace(v_func, 's.status = ''paid''', 's.status = ''finalized''');
        v_func := replace(v_func, 'AND status = ''paid''', 'AND status = ''finalized''');
        EXECUTE v_func;
    END IF;

    -- 3. preview_legacy_ledger_sync
    SELECT pg_get_functiondef('public.preview_legacy_ledger_sync(uuid)'::regprocedure) INTO v_func;
    IF v_func IS NOT NULL THEN
        v_func := replace(v_func, 's.status = ''paid''', 's.status = ''finalized''');
        EXECUTE v_func;
    END IF;

    -- 4. get_accounting_readiness
    SELECT pg_get_functiondef('public.get_accounting_readiness(uuid)'::regprocedure) INTO v_func;
    IF v_func IS NOT NULL THEN
        v_func := replace(v_func, 'AND status = ''paid''', 'AND status = ''finalized''');
        EXECUTE v_func;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
