CREATE OR REPLACE FUNCTION public.get_chat_customers()
RETURNS TABLE (
    id UUID,
    full_name TEXT,
    phone TEXT,
    customer_level TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    last_package_name TEXT,
    total_spent BIGINT,
    unread_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
BEGIN
    SELECT users.tenant_id
    INTO v_tenant_id
    FROM public.users
    WHERE users.id = auth.uid();

    RETURN QUERY
    SELECT
        c.id,
        c.name_mother::TEXT AS full_name,
        c.phone,
        COALESCE(c.gender_baby, 'Thanh vien')::TEXT AS customer_level,
        c.created_at,
        (
            SELECT b.package_name
            FROM public.bookings b
            WHERE b.customer_id = c.id
            ORDER BY b.created_at DESC
            LIMIT 1
        ) AS last_package_name,
        (
            SELECT COALESCE(SUM(r.amount), 0)
            FROM public.revenue r
            WHERE r.booking_id IN (
                SELECT b.id FROM public.bookings b WHERE b.customer_id = c.id
            )
        )::BIGINT AS total_spent,
        (
            SELECT COUNT(*)
            FROM public.chat_messages m
            WHERE m.customer_id = c.id
              AND m.is_read = false
              AND m.sender_type = 'customer'
        )::BIGINT AS unread_count
    FROM public.customers c
    WHERE c.tenant_id = v_tenant_id
    ORDER BY (
        SELECT MAX(m.created_at)
        FROM public.chat_messages m
        WHERE m.customer_id = c.id
    ) DESC NULLS LAST, c.created_at DESC;
END;
$$;
