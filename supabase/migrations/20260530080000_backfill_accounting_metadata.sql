-- Backfill SIMPLE source rows into accounting metadata/readiness fields.
-- Runs in bounded batches and creates review queue items for incomplete rows.

CREATE OR REPLACE FUNCTION public.accounting_missing_required_fields(
    p_business_event_type TEXT,
    p_payload JSONB
)
RETURNS TEXT[] AS $$
DECLARE
    v_required TEXT[];
    v_field TEXT;
    v_missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
    v_required := CASE p_business_event_type
        WHEN 'CUSTOMER_DEPOSIT' THEN ARRAY['amount','payment_method','booking_id']
        WHEN 'CUSTOMER_REMAINING_PAYMENT' THEN ARRAY['amount','payment_method','booking_id']
        WHEN 'CUSTOMER_FULL_PAYMENT' THEN ARRAY['amount','payment_method','booking_id']
        WHEN 'SESSION_REVENUE_RECOGNIZED' THEN ARRAY['session_log_id','booking_id','earned_revenue']
        WHEN 'REFUND_TO_CUSTOMER' THEN ARRAY['amount','payment_method','reason']
        WHEN 'EXPENSE_RENT' THEN ARRAY['amount','payment_method','expense_date']
        WHEN 'EXPENSE_UTILITIES' THEN ARRAY['amount','payment_method','expense_date']
        WHEN 'EXPENSE_MARKETING' THEN ARRAY['amount','payment_method','expense_date']
        WHEN 'EXPENSE_MATERIALS' THEN ARRAY['amount','payment_method','expense_date']
        WHEN 'EXPENSE_SALARY' THEN ARRAY['amount','payment_method','expense_date']
        WHEN 'EXPENSE_OTHER' THEN ARRAY['amount','payment_method','expense_date','description']
        WHEN 'INVENTORY_PURCHASE' THEN ARRAY['amount','payment_method','item_id']
        WHEN 'INVENTORY_CONSUMED' THEN ARRAY['amount','item_id','session_log_id']
        WHEN 'SALARY_ACCRUAL' THEN ARRAY['amount','ktv_id','month_year']
        WHEN 'SALARY_PAYMENT' THEN ARRAY['amount','payment_method','ktv_id','month_year']
        WHEN 'KTV_COMMISSION_ACCRUAL' THEN ARRAY['commission_amount','ktv_id','session_log_id']
        WHEN 'INTER_BRANCH_CLEARING' THEN ARRAY['amount','debtor_tenant_id','creditor_tenant_id']
        WHEN 'FRANCHISE_ROYALTY' THEN ARRAY['amount','invoice_number','tenant_id']
        ELSE ARRAY[]::TEXT[]
    END;

    FOREACH v_field IN ARRAY v_required LOOP
        IF NOT (p_payload ? v_field)
           OR p_payload -> v_field IS NULL
           OR p_payload ->> v_field IS NULL
           OR btrim(p_payload ->> v_field) = '' THEN
            v_missing := array_append(v_missing, v_field);
        END IF;
    END LOOP;

    RETURN v_missing;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION public.backfill_accounting_metadata(
    p_tenant_id UUID DEFAULT NULL,
    p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
    source_table TEXT,
    scanned_records INTEGER,
    classified_records INTEGER,
    review_created INTEGER
) AS $$
#variable_conflict use_column
DECLARE
    v_tenant_id UUID;
    v_limit INTEGER;
BEGIN
    v_tenant_id := COALESCE(p_tenant_id, public.get_auth_tenant_id());
    v_limit := LEAST(GREATEST(COALESCE(p_limit, 500), 1), 2000);

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant for accounting metadata backfill.';
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR (
            (public.is_admin() OR public.is_accountant())
            AND (
                public.is_hq_super_admin()
                OR v_tenant_id = public.get_auth_tenant_id()
            )
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only admin/accountant can backfill accounting metadata.';
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS pg_temp.accounting_backfill_stage (
        source_table TEXT NOT NULL,
        source_id TEXT NOT NULL,
        tenant_id UUID NOT NULL,
        business_event_type TEXT,
        payload JSONB NOT NULL,
        missing_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
        needs_review BOOLEAN NOT NULL DEFAULT false
    ) ON COMMIT DROP;

    TRUNCATE pg_temp.accounting_backfill_stage;

    INSERT INTO pg_temp.accounting_backfill_stage (
        source_table, source_id, tenant_id, business_event_type, payload
    )
    SELECT
        'revenue',
        r.id::TEXT,
        r.tenant_id,
        CASE lower(COALESCE(r.revenue_type, ''))
            WHEN 'deposit' THEN 'CUSTOMER_DEPOSIT'
            WHEN 'remaining_payment' THEN 'CUSTOMER_REMAINING_PAYMENT'
            WHEN 'package_payment' THEN 'CUSTOMER_FULL_PAYMENT'
            WHEN 'package_sale' THEN 'CUSTOMER_FULL_PAYMENT'
            WHEN 'session_completed' THEN 'SESSION_REVENUE_RECOGNIZED'
            WHEN 'refund' THEN 'REFUND_TO_CUSTOMER'
            ELSE NULL
        END,
        jsonb_strip_nulls(jsonb_build_object(
            'amount', r.amount,
            'payment_method', r.payment_method,
            'booking_id', r.booking_id,
            'received_date', r.received_date,
            'revenue_type', r.revenue_type,
            'reason', r.notes
        ))
    FROM public.revenue r
    WHERE r.tenant_id = v_tenant_id
      AND (r.business_event_type IS NULL OR r.accounting_review_status = 'UNREVIEWED')
    ORDER BY r.received_date DESC, r.id
    LIMIT v_limit;

    INSERT INTO pg_temp.accounting_backfill_stage (
        source_table, source_id, tenant_id, business_event_type, payload
    )
    SELECT
        'expenses',
        e.id::TEXT,
        e.tenant_id,
        CASE lower(COALESCE(e.category, ''))
            WHEN 'rent' THEN 'EXPENSE_RENT'
            WHEN 'utilities' THEN 'EXPENSE_UTILITIES'
            WHEN 'marketing' THEN 'EXPENSE_MARKETING'
            WHEN 'materials' THEN 'EXPENSE_MATERIALS'
            WHEN 'salary' THEN 'EXPENSE_SALARY'
            WHEN 'other' THEN 'EXPENSE_OTHER'
            ELSE 'EXPENSE_OTHER'
        END,
        jsonb_strip_nulls(jsonb_build_object(
            'amount', e.amount,
            'payment_method', COALESCE(e.accounting_metadata ->> 'payment_method', NULL),
            'expense_date', e.expense_date,
            'category', e.category,
            'description', e.description
        ))
    FROM public.expenses e
    WHERE e.tenant_id = v_tenant_id
      AND (e.business_event_type IS NULL OR e.accounting_review_status = 'UNREVIEWED')
    ORDER BY e.expense_date DESC, e.id
    LIMIT v_limit;

    INSERT INTO pg_temp.accounting_backfill_stage (
        source_table, source_id, tenant_id, business_event_type, payload
    )
    SELECT
        'salary_records',
        s.id::TEXT,
        s.tenant_id,
        CASE WHEN lower(COALESCE(s.status, '')) = 'paid' THEN 'SALARY_PAYMENT' ELSE 'SALARY_ACCRUAL' END,
        jsonb_strip_nulls(jsonb_build_object(
            'amount', s.total_salary,
            'payment_method', s.paid_method,
            'ktv_id', s.ktv_id,
            'month_year', s.month_year,
            'status', s.status
        ))
    FROM public.salary_records s
    WHERE s.tenant_id = v_tenant_id
      AND (s.business_event_type IS NULL OR s.accounting_review_status = 'UNREVIEWED')
    ORDER BY s.month_year DESC, s.id
    LIMIT v_limit;

    INSERT INTO pg_temp.accounting_backfill_stage (
        source_table, source_id, tenant_id, business_event_type, payload
    )
    SELECT
        'session_logs',
        sl.id::TEXT,
        sl.tenant_id,
        CASE WHEN lower(COALESCE(sl.status, '')) = 'completed' THEN 'SESSION_REVENUE_RECOGNIZED' ELSE NULL END,
        jsonb_strip_nulls(jsonb_build_object(
            'session_log_id', sl.id,
            'booking_id', sl.booking_id,
            'earned_revenue', NULL,
            'completed_by_ktv_id', sl.completed_by_ktv_id,
            'completed_date', sl.completed_date,
            'status', sl.status
        ))
    FROM public.session_logs sl
    WHERE sl.tenant_id = v_tenant_id
      AND lower(COALESCE(sl.status, '')) = 'completed'
      AND (sl.business_event_type IS NULL OR sl.accounting_review_status = 'UNREVIEWED')
    ORDER BY sl.completed_date DESC NULLS LAST, sl.id
    LIMIT v_limit;

    INSERT INTO pg_temp.accounting_backfill_stage (
        source_table, source_id, tenant_id, business_event_type, payload
    )
    SELECT
        'inventory_logs',
        il.id::TEXT,
        il.tenant_id,
        CASE
            WHEN lower(COALESCE(il.reason, '')) IN ('consume', 'consumed', 'session_consumed', 'used') THEN 'INVENTORY_CONSUMED'
            WHEN lower(COALESCE(il.reason, '')) IN ('purchase', 'import', 'stock_in', 'restock') THEN 'INVENTORY_PURCHASE'
            ELSE NULL
        END,
        jsonb_strip_nulls(jsonb_build_object(
            'amount', NULL,
            'payment_method', NULL,
            'item_id', il.item_id,
            'session_log_id', il.session_log_id,
            'change_amount', il.change_amount,
            'reason', il.reason
        ))
    FROM public.inventory_logs il
    WHERE il.tenant_id = v_tenant_id
      AND (il.business_event_type IS NULL OR il.accounting_review_status = 'UNREVIEWED')
    ORDER BY il.created_at DESC NULLS LAST, il.id
    LIMIT v_limit;

    UPDATE pg_temp.accounting_backfill_stage
    SET missing_fields = CASE
            WHEN business_event_type IS NULL THEN ARRAY[]::TEXT[]
            ELSE public.accounting_missing_required_fields(business_event_type, payload)
        END,
        needs_review = business_event_type IS NULL
            OR array_length(public.accounting_missing_required_fields(business_event_type, payload), 1) IS NOT NULL
    WHERE true;

    UPDATE public.revenue r
    SET business_event_type = s.business_event_type,
        accounting_metadata = COALESCE(r.accounting_metadata, '{}'::JSONB) || s.payload || jsonb_build_object('backfilled_at', NOW()),
        accounting_review_status = CASE WHEN s.needs_review THEN 'NEEDS_REVIEW' ELSE 'AUTO_POSTED' END
    FROM pg_temp.accounting_backfill_stage s
    WHERE s.source_table = 'revenue'
      AND r.id = s.source_id::UUID
      AND r.tenant_id = s.tenant_id;

    UPDATE public.expenses e
    SET business_event_type = s.business_event_type,
        accounting_metadata = COALESCE(e.accounting_metadata, '{}'::JSONB) || s.payload || jsonb_build_object('backfilled_at', NOW()),
        accounting_review_status = CASE WHEN s.needs_review THEN 'NEEDS_REVIEW' ELSE 'AUTO_POSTED' END
    FROM pg_temp.accounting_backfill_stage s
    WHERE s.source_table = 'expenses'
      AND e.id = s.source_id::UUID
      AND e.tenant_id = s.tenant_id;

    UPDATE public.salary_records sr
    SET business_event_type = s.business_event_type,
        accounting_metadata = COALESCE(sr.accounting_metadata, '{}'::JSONB) || s.payload || jsonb_build_object('backfilled_at', NOW()),
        accounting_review_status = CASE WHEN s.needs_review THEN 'NEEDS_REVIEW' ELSE 'AUTO_POSTED' END
    FROM pg_temp.accounting_backfill_stage s
    WHERE s.source_table = 'salary_records'
      AND sr.id = s.source_id::UUID
      AND sr.tenant_id = s.tenant_id;

    UPDATE public.session_logs sl
    SET business_event_type = s.business_event_type,
        accounting_metadata = COALESCE(sl.accounting_metadata, '{}'::JSONB) || s.payload || jsonb_build_object('backfilled_at', NOW()),
        accounting_review_status = CASE WHEN s.needs_review THEN 'NEEDS_REVIEW' ELSE 'AUTO_POSTED' END
    FROM pg_temp.accounting_backfill_stage s
    WHERE s.source_table = 'session_logs'
      AND sl.id = s.source_id::UUID
      AND sl.tenant_id = s.tenant_id;

    UPDATE public.inventory_logs il
    SET business_event_type = s.business_event_type,
        accounting_metadata = COALESCE(il.accounting_metadata, '{}'::JSONB) || s.payload || jsonb_build_object('backfilled_at', NOW()),
        accounting_review_status = CASE WHEN s.needs_review THEN 'NEEDS_REVIEW' ELSE 'AUTO_POSTED' END
    FROM pg_temp.accounting_backfill_stage s
    WHERE s.source_table = 'inventory_logs'
      AND il.id = s.source_id::UUID
      AND il.tenant_id = s.tenant_id;

    INSERT INTO public.accounting_review_queue (
        tenant_id,
        business_event_type,
        source_table,
        source_id,
        status,
        severity,
        reason_code,
        message,
        missing_fields,
        payload
    )
    SELECT
        tenant_id,
        business_event_type,
        source_table,
        source_id,
        'NEEDS_REVIEW',
        CASE WHEN business_event_type IS NULL THEN 'high' ELSE 'medium' END,
        CASE WHEN business_event_type IS NULL THEN 'UNCLASSIFIED_EVENT' ELSE 'MISSING_REQUIRED_FIELDS' END,
        CASE
            WHEN business_event_type IS NULL THEN 'Không phân loại được nghiệp vụ kế toán từ dữ liệu lịch sử.'
            ELSE 'Dữ liệu lịch sử thiếu thông tin bắt buộc để tự động hạch toán.'
        END,
        missing_fields,
        payload
    FROM pg_temp.accounting_backfill_stage
    WHERE needs_review
    ON CONFLICT DO NOTHING;

    RETURN QUERY
    SELECT
        s.source_table,
        COUNT(*)::INTEGER AS scanned_records,
        COUNT(*) FILTER (WHERE s.business_event_type IS NOT NULL)::INTEGER AS classified_records,
        COUNT(*) FILTER (WHERE s.needs_review)::INTEGER AS review_created
    FROM pg_temp.accounting_backfill_stage s
    GROUP BY s.source_table
    ORDER BY s.source_table;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.accounting_missing_required_fields(TEXT, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.accounting_missing_required_fields(TEXT, JSONB) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.backfill_accounting_metadata(UUID, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION public.backfill_accounting_metadata(UUID, INTEGER) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
