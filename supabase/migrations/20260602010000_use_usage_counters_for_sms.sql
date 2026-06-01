-- Move SMS metering from tenants.sms_allotment_used into tenant_usage_counters.
-- The legacy tenant column is kept in sync for older displays, but runtime quota
-- enforcement should read the usage counter for the current monthly period.

CREATE OR REPLACE FUNCTION public.get_tenant_sms_usage(
    p_tenant_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_start DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_period_end DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    v_usage NUMERIC;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant_id for SMS usage lookup.';
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR public.is_hq_super_admin()
        OR p_tenant_id = public.get_auth_tenant_id()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: cannot view SMS usage for another tenant.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant % not found while reading SMS usage.', p_tenant_id;
    END IF;

    SELECT used_value
    INTO v_usage
    FROM public.tenant_usage_counters
    WHERE tenant_id = p_tenant_id
      AND feature_key = 'sms'
      AND period_start = v_period_start;

    RETURN COALESCE(v_usage, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.renew_tenant_subscription(
    p_invoice_number TEXT,
    p_payment_method TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_tenant_id UUID;
    v_tier VARCHAR;
    v_duration_months INTEGER;
    v_status VARCHAR;
    v_period_start DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_period_end DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
BEGIN
    SELECT tenant_id, tier, duration_months, status
    INTO v_tenant_id, v_tier, v_duration_months, v_status
    FROM public.subscription_invoices
    WHERE invoice_number = p_invoice_number
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn %', p_invoice_number;
    END IF;

    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Subscription invoice % has no tenant_id.', p_invoice_number;
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR public.is_hq_super_admin()
        OR v_tenant_id = public.get_auth_tenant_id()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: invoice does not belong to current tenant.';
    END IF;

    IF v_duration_months IS NULL OR v_duration_months <= 0 THEN
        RAISE EXCEPTION 'Invalid subscription duration for invoice %.', p_invoice_number;
    END IF;

    IF v_status = 'cancelled' THEN
        RAISE EXCEPTION 'Cannot renew cancelled subscription invoice %.', p_invoice_number;
    END IF;

    IF v_status = 'paid' THEN
        RETURN TRUE;
    END IF;

    UPDATE public.subscription_invoices
    SET status = 'paid',
        paid_at = NOW(),
        payment_method = p_payment_method
    WHERE invoice_number = p_invoice_number
      AND status <> 'paid';

    UPDATE public.tenants
    SET subscription_tier = v_tier,
        subscription_expires_at = CASE
            WHEN subscription_expires_at > NOW()
                THEN subscription_expires_at + (v_duration_months || ' month')::interval
            ELSE NOW() + (v_duration_months || ' month')::interval
        END,
        sms_allotment_used = 0,
        updated_at = NOW()
    WHERE id = v_tenant_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant % not found while renewing subscription invoice %.', v_tenant_id, p_invoice_number;
    END IF;

    INSERT INTO public.tenant_usage_counters (
        tenant_id,
        feature_key,
        period_start,
        period_end,
        used_value,
        metadata,
        last_increment_at,
        updated_at
    )
    VALUES (
        v_tenant_id,
        'sms',
        v_period_start,
        v_period_end,
        0,
        jsonb_build_object('source', 'renew_tenant_subscription', 'invoice_number', p_invoice_number),
        NULL,
        NOW()
    )
    ON CONFLICT (tenant_id, feature_key, period_start)
    DO UPDATE SET
        used_value = 0,
        period_end = EXCLUDED.period_end,
        metadata = public.tenant_usage_counters.metadata || jsonb_build_object(
            'source', 'renew_tenant_subscription',
            'invoice_number', p_invoice_number,
            'reset_at', NOW()
        ),
        last_increment_at = NULL,
        updated_at = NOW();

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_tenant_sms(
    p_tenant_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_period_start DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_period_end DATE := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    v_count NUMERIC;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant_id for SMS counter increment.';
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR public.is_hq_super_admin()
        OR p_tenant_id = public.get_auth_tenant_id()
    ) THEN
        RAISE EXCEPTION 'Unauthorized: cannot increment SMS usage for another tenant.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant % not found while incrementing SMS usage.', p_tenant_id;
    END IF;

    INSERT INTO public.tenant_usage_counters (
        tenant_id,
        feature_key,
        period_start,
        period_end,
        used_value,
        metadata,
        last_increment_at,
        updated_at
    )
    VALUES (
        p_tenant_id,
        'sms',
        v_period_start,
        v_period_end,
        1,
        jsonb_build_object('source', 'increment_tenant_sms'),
        NOW(),
        NOW()
    )
    ON CONFLICT (tenant_id, feature_key, period_start)
    DO UPDATE SET
        used_value = public.tenant_usage_counters.used_value + 1,
        period_end = EXCLUDED.period_end,
        metadata = public.tenant_usage_counters.metadata || jsonb_build_object('source', 'increment_tenant_sms'),
        last_increment_at = NOW(),
        updated_at = NOW()
    RETURNING used_value INTO v_count;

    UPDATE public.tenants
    SET sms_allotment_used = v_count::INTEGER,
        updated_at = NOW()
    WHERE id = p_tenant_id;

    RETURN v_count::INTEGER;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_sms_usage(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.renew_tenant_subscription(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_tenant_sms(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_tenant_sms_usage(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.renew_tenant_subscription(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_tenant_sms(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.get_tenant_sms_usage(UUID) IS
  'Returns current monthly SMS usage from tenant_usage_counters for the requested tenant.';
COMMENT ON FUNCTION public.renew_tenant_subscription(TEXT, TEXT) IS
  'Renews paid subscription invoices and resets the current monthly SMS usage counter.';
COMMENT ON FUNCTION public.increment_tenant_sms(UUID) IS
  'Atomically increments current monthly SMS usage in tenant_usage_counters and syncs the legacy tenants.sms_allotment_used column.';
