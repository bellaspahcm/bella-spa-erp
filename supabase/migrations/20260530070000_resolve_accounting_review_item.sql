-- Resolve accounting review items atomically with their SIMPLE source record.
-- This keeps readiness state consistent when accountants approve/reject review items.

CREATE OR REPLACE FUNCTION public.resolve_accounting_review_item(
    p_review_item_id UUID,
    p_status TEXT
)
RETURNS TABLE (
    review_item_id UUID,
    source_table TEXT,
    source_id TEXT,
    review_status TEXT,
    source_review_status TEXT
) AS $$
DECLARE
    v_item public.accounting_review_queue%ROWTYPE;
    v_source_status TEXT;
    v_updated_count INTEGER;
BEGIN
    IF p_status NOT IN ('APPROVED_FOR_POSTING', 'REJECTED') THEN
        RAISE EXCEPTION 'Invalid review resolution status: %', p_status;
    END IF;

    SELECT *
    INTO v_item
    FROM public.accounting_review_queue
    WHERE id = p_review_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Accounting review item not found: %', p_review_item_id;
    END IF;

    IF NOT (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR v_item.tenant_id = public.get_auth_tenant_id()
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only admin/accountant can resolve accounting review items.';
    END IF;

    IF v_item.status NOT IN ('NEEDS_REVIEW', 'POSTING_FAILED') THEN
        RAISE EXCEPTION 'Accounting review item is already resolved: %', v_item.status;
    END IF;

    v_source_status := CASE
        WHEN p_status = 'APPROVED_FOR_POSTING' THEN 'APPROVED'
        ELSE 'NEEDS_REVIEW'
    END;

    IF v_item.source_table = 'revenue' THEN
        UPDATE public.revenue
        SET accounting_review_status = v_source_status,
            accounting_template_id = COALESCE(v_item.suggested_template_id, accounting_template_id),
            business_event_type = COALESCE(v_item.business_event_type, business_event_type)
        WHERE id = v_item.source_id::UUID
          AND tenant_id = v_item.tenant_id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSIF v_item.source_table = 'expenses' THEN
        UPDATE public.expenses
        SET accounting_review_status = v_source_status,
            accounting_template_id = COALESCE(v_item.suggested_template_id, accounting_template_id),
            business_event_type = COALESCE(v_item.business_event_type, business_event_type)
        WHERE id = v_item.source_id::UUID
          AND tenant_id = v_item.tenant_id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSIF v_item.source_table = 'salary_records' THEN
        UPDATE public.salary_records
        SET accounting_review_status = v_source_status,
            accounting_template_id = COALESCE(v_item.suggested_template_id, accounting_template_id),
            business_event_type = COALESCE(v_item.business_event_type, business_event_type)
        WHERE id = v_item.source_id::UUID
          AND tenant_id = v_item.tenant_id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSIF v_item.source_table = 'session_logs' THEN
        UPDATE public.session_logs
        SET accounting_review_status = v_source_status,
            accounting_template_id = COALESCE(v_item.suggested_template_id, accounting_template_id),
            business_event_type = COALESCE(v_item.business_event_type, business_event_type)
        WHERE id = v_item.source_id::UUID
          AND tenant_id = v_item.tenant_id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSIF v_item.source_table = 'inventory_logs' THEN
        UPDATE public.inventory_logs
        SET accounting_review_status = v_source_status,
            accounting_template_id = COALESCE(v_item.suggested_template_id, accounting_template_id),
            business_event_type = COALESCE(v_item.business_event_type, business_event_type)
        WHERE id = v_item.source_id::UUID
          AND tenant_id = v_item.tenant_id;
        GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    ELSE
        v_updated_count := 0;
    END IF;

    IF v_item.source_table IN ('revenue', 'expenses', 'salary_records', 'session_logs', 'inventory_logs')
       AND v_updated_count = 0 THEN
        RAISE EXCEPTION 'Source record not found or tenant mismatch: %.%', v_item.source_table, v_item.source_id;
    END IF;

    UPDATE public.accounting_review_queue
    SET status = p_status,
        resolved_by = auth.uid(),
        resolved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_review_item_id;

    RETURN QUERY
    SELECT v_item.id, v_item.source_table, v_item.source_id, p_status, v_source_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.resolve_accounting_review_item(UUID, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.resolve_accounting_review_item(UUID, TEXT) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
