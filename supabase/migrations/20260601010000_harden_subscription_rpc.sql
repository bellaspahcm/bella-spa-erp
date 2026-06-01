-- Harden subscription RPCs so tenant subscription mutations fail closed.

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
    v_count INTEGER;
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

    UPDATE public.tenants
    SET sms_allotment_used = COALESCE(sms_allotment_used, 0) + 1,
        updated_at = NOW()
    WHERE id = p_tenant_id
    RETURNING sms_allotment_used INTO v_count;

    IF v_count IS NULL THEN
        RAISE EXCEPTION 'Tenant % not found while incrementing SMS usage.', p_tenant_id;
    END IF;

    RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.renew_tenant_subscription(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_tenant_sms(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.renew_tenant_subscription(TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_tenant_sms(UUID) TO authenticated, service_role;
