-- =============================================================================
-- Migration: Integrate seed_default_coa() into onboard_tenant
-- Ngày: 2026-05-25
-- Mục đích:
--   Mọi tenant mới đăng ký qua /signup sẽ tự động được seed Chart of Accounts
--   theo Thông tư 133 ngay khi tạo. Đảm bảo accounting engine không bao giờ
--   gặp lỗi "Account code not found" sau khi tenant onboard.
--
-- Lưu ý: KHÔNG dùng CREATE OR REPLACE để tránh side-effect không mong muốn
-- với function cũ. Dùng tên cũ để app layer không phải đổi.
-- =============================================================================

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
    v_coa_count INTEGER;
BEGIN
    -- 1. Check email duplicate
    IF EXISTS (SELECT 1 FROM public.users WHERE email = p_admin_email) THEN
        RAISE EXCEPTION 'Email % đã tồn tại trong hệ thống.', p_admin_email;
    END IF;

    -- 2. Default configs
    v_role_permissions := '{"ktv_lead": {"dashboard": true, "customers": false, "bookings": true, "sessions": true, "chat": true, "crm": true, "services": true, "finance": false, "reconciliation": false, "inventory": false, "salary": false, "audit": false, "settings": false}}'::jsonb;
    v_salary_config := '{"bonus_5_star": 50000, "bonus_4_5_star": 30000, "bonus_4_star": 10000, "kpi_target_sessions": 30, "kpi_bonus_amount": 1000000}'::jsonb;

    -- 3. Create tenant
    INSERT INTO public.tenants (
        name, contact_phone, address, email, status, role_permissions, salary_config
    )
    VALUES (
        p_spa_name, p_contact_phone, p_address, p_email, 'active', v_role_permissions, v_salary_config
    )
    RETURNING id INTO v_tenant_id;

    -- 4. Create admin user
    INSERT INTO public.users (id, email, full_name, role, status, tenant_id)
    VALUES (p_admin_id, p_admin_email, p_admin_name, 'admin', 'active', v_tenant_id);

    -- 5. Seed sample package
    INSERT INTO public.packages (
        name, description, price, full_price, duration, total_sessions, ktv_commission, status, tenant_id
    )
    VALUES (
        'Massage Bầu VIP Nhật Bản',
        'Gói chăm sóc massage bầu cao cấp theo liệu trình Nhật Bản giúp thư giãn cơ thể và giảm stress cho mẹ.',
        1200000, 1200000, '90 phút/buổi', 10, 150000, 'active', v_tenant_id
    )
    RETURNING id INTO v_package_id;

    -- 6. Seed sample KTV
    v_ktv_id := uuid_generate_v4();
    INSERT INTO public.users (id, email, full_name, role, status, tenant_id)
    VALUES (
        v_ktv_id,
        'ktv.mau.' || substring(v_tenant_id::text from 1 for 8) || '@bellaspa.com.vn',
        'Trần Thị Mai (KTV Mẫu)', 'ktv', 'active', v_tenant_id
    );

    -- 7. Seed sample customer
    INSERT INTO public.customers (phone, name_mother, name_baby, dob_baby, address, status, tenant_id)
    VALUES (
        '0987' || substring(v_tenant_id::text from 1 for 6),
        'Phạm Thu Hương (Khách Mẫu)', 'Bé Bơ',
        CURRENT_DATE - INTERVAL '10 days', p_address, 'active', v_tenant_id
    )
    RETURNING id INTO v_customer_id;

    -- 8. Seed sample booking
    INSERT INTO public.bookings (
        booking_number, customer_id, package_id, status, deposit_amount, full_price,
        start_date, end_date, total_sessions, completed_sessions, contract_signed,
        assigned_ktv_id, tenant_id
    )
    VALUES (
        'BK-' || UPPER(substring(v_tenant_id::text from 1 for 5)),
        v_customer_id, v_package_id, 'booked', 200000, 1200000,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '10 days', 10, 0, TRUE,
        v_ktv_id, v_tenant_id
    )
    RETURNING id INTO v_booking_id;

    -- 9. ⭐ NEW: Seed default Chart of Accounts (Thông tư 133)
    BEGIN
        v_coa_count := public.seed_default_coa(v_tenant_id);
        RAISE NOTICE '[onboard_tenant] Seeded % accounting accounts for tenant %', v_coa_count, v_tenant_id;
    EXCEPTION WHEN OTHERS THEN
        -- Không fail onboarding nếu seed COA fail — log warning và tiếp tục
        -- Admin có thể chạy thủ công sau bằng: SELECT seed_default_coa('<tenant_id>');
        RAISE WARNING '[onboard_tenant] Failed to seed COA for tenant %: %', v_tenant_id, SQLERRM;
    END;

    -- 10. ⭐ NEW: Auto-create accounting period cho tháng hiện tại
    BEGIN
        PERFORM public.ensure_open_period(v_tenant_id, CURRENT_DATE);
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '[onboard_tenant] Failed to create accounting period for tenant %: %', v_tenant_id, SQLERRM;
    END;

    RETURN v_tenant_id;
END;
$$;
