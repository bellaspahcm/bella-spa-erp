-- Fix get_chat_customers to use name_mother instead of full_name

CREATE OR REPLACE FUNCTION public.get_chat_customers(p_tenant_id UUID)
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
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name_mother::TEXT as full_name,
        c.phone,
        COALESCE(c.gender_baby, 'Thành viên')::TEXT as customer_level,
        c.created_at,
        (SELECT b.package_name FROM public.bookings b WHERE b.customer_id = c.id ORDER BY b.created_at DESC LIMIT 1) as last_package_name,
        (SELECT COALESCE(SUM(r.amount), 0) FROM public.revenue r WHERE r.booking_id IN (SELECT b.id FROM public.bookings b WHERE b.customer_id = c.id))::BIGINT as total_spent,
        (SELECT COUNT(*) FROM public.chat_messages m WHERE m.customer_id = c.id AND m.is_read = false AND m.sender_type = 'customer')::BIGINT as unread_count
    FROM public.customers c
    WHERE c.tenant_id = p_tenant_id
    ORDER BY (SELECT MAX(m.created_at) FROM public.chat_messages m WHERE m.customer_id = c.id) DESC NULLS LAST, c.created_at DESC;
END;
$$;
