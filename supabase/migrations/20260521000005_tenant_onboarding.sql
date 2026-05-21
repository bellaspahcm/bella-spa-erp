-- Migration: Create onboard_tenant function for self-service SaaS signup and onboarding seed
CREATE OR REPLACE FUNCTION public.onboard_tenant(
    p_spa_name TEXT,
    p_contact_phone TEXT,
    p_address TEXT,
    p_email TEXT,
    p_admin_id UUID,
    p_admin_email TEXT,
    p_admin_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_tenant_id UUID;
    v_package_id UUID;
    v_ktv_id UUID;
    v_customer_id UUID;
    v_booking_id UUID;
    v_role_permissions JSONB;
    v_salary_config JSONB;
BEGIN
    -- 1. Check if email already exists in users table
    IF EXISTS (SELECT 1 FROM public.users WHERE email = p_admin_email) THEN
        RAISE EXCEPTION 'Email % đã tồn tại trong hệ thống.', p_admin_email;
    END IF;

    -- 2. Define default permissions and salary config
    v_role_permissions := '{"ktv_lead": {"dashboard": true, "customers": false, "bookings": true, "sessions": true, "chat": true, "crm": true, "services": true, "finance": false, "reconciliation": false, "inventory": false, "salary": false, "audit": false, "settings": false}}'::jsonb;
    v_salary_config := '{"bonus_5_star": 50000, "bonus_4_5_star": 30000, "bonus_4_star": 10000, "kpi_target_sessions": 30, "kpi_bonus_amount": 1000000}'::jsonb;

    -- 3. Insert new tenant
    INSERT INTO public.tenants (
        name,
        contact_phone,
        address,
        email,
        status,
        role_permissions,
        salary_config
    )
    VALUES (
        p_spa_name,
        p_contact_phone,
        p_address,
        p_email,
        'active',
        v_role_permissions,
        v_salary_config
    )
    RETURNING id INTO v_tenant_id;

    -- 4. Insert new user (Admin)
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        status,
        tenant_id
    )
    VALUES (
        p_admin_id,
        p_admin_email,
        p_admin_name,
        'admin',
        'active',
        v_tenant_id
    );

    -- 5. Seed Package
    INSERT INTO public.packages (
        name,
        description,
        price,
        full_price,
        duration,
        total_sessions,
        ktv_commission,
        status,
        tenant_id
    )
    VALUES (
        'Massage Bầu VIP Nhật Bản',
        'Gói chăm sóc massage bầu cao cấp theo liệu trình Nhật Bản giúp thư giãn cơ thể và giảm stress cho mẹ.',
        1200000,
        1200000,
        '90 phút/buổi',
        10,
        150000,
        'active',
        v_tenant_id
    )
    RETURNING id INTO v_package_id;

    -- 6. Seed KTV (Technician)
    v_ktv_id := uuid_generate_v4();
    INSERT INTO public.users (
        id,
        email,
        full_name,
        role,
        status,
        tenant_id
    )
    VALUES (
        v_ktv_id,
        'ktv.mau.' || substring(v_tenant_id::text from 1 for 8) || '@bellaspa.com.vn',
        'Trần Thị Mai (KTV Mẫu)',
        'ktv',
        'active',
        v_tenant_id
    );

    -- 7. Seed Customer
    INSERT INTO public.customers (
        phone,
        name_mother,
        name_baby,
        dob_baby,
        address,
        status,
        tenant_id
    )
    VALUES (
        '0987' || substring(v_tenant_id::text from 1 for 6),
        'Phạm Thu Hương (Khách Mẫu)',
        'Bé Bơ',
        CURRENT_DATE - INTERVAL '10 days',
        p_address,
        'active',
        v_tenant_id
    )
    RETURNING id INTO v_customer_id;

    -- 8. Seed Booking
    INSERT INTO public.bookings (
        booking_number,
        customer_id,
        package_id,
        status,
        deposit_amount,
        full_price,
        start_date,
        end_date,
        total_sessions,
        completed_sessions,
        contract_signed,
        assigned_ktv_id,
        tenant_id
    )
    VALUES (
        'BK-' || UPPER(substring(v_tenant_id::text from 1 for 5)),
        v_customer_id,
        v_package_id,
        'booked',
        200000,
        1200000,
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '10 days',
        10,
        0,
        TRUE,
        v_ktv_id,
        v_tenant_id
    )
    RETURNING id INTO v_booking_id;

    RETURN v_tenant_id;
END;
$$;
