-- Include both approved and paid legacy expenses when syncing/previewing TT133 ledger rows.
-- Previous functions only included approved expenses, while finance reports treat paid expenses
-- as recognized operating costs too.

DO $$
DECLARE
    v_function_sql TEXT;
BEGIN
    SELECT pg_get_functiondef('public.sync_legacy_to_ledger_atomic(uuid, uuid)'::regprocedure)
    INTO v_function_sql;

    IF v_function_sql NOT LIKE '%e.status = ''approved''%' THEN
        RAISE EXCEPTION 'sync_legacy_to_ledger_atomic no longer contains the expected approved-only expense filter';
    END IF;

    v_function_sql := replace(
        v_function_sql,
        'e.status = ''approved''',
        'e.status IN (''approved'', ''paid'')'
    );
    EXECUTE v_function_sql;

    SELECT pg_get_functiondef('public.preview_legacy_ledger_sync(uuid)'::regprocedure)
    INTO v_function_sql;

    IF v_function_sql NOT LIKE '%e.status = ''approved''%' THEN
        RAISE EXCEPTION 'preview_legacy_ledger_sync no longer contains the expected approved-only expense filter';
    END IF;

    v_function_sql := replace(
        v_function_sql,
        'e.status = ''approved''',
        'e.status IN (''approved'', ''paid'')'
    );
    EXECUTE v_function_sql;
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.preview_legacy_ledger_sync(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_legacy_ledger_sync(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID)
IS 'Atomically syncs legacy finance rows into TT133 ledger entries; includes approved and paid expenses.';

COMMENT ON FUNCTION public.preview_legacy_ledger_sync(UUID)
IS 'Previews pending TT133 legacy ledger sync rows; includes approved and paid expenses.';
