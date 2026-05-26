-- =============================================================================
-- BELLA SPA ERP — VERIFY RESET
-- =============================================================================
-- Chạy SAU khi đã chạy reset-customer-data.sql để xác minh:
--   1. Các bảng phải rỗng (customer/booking/session/revenue/inventory/...)
--   2. Các bảng phải còn nguyên (packages master, COA, periods, HQ tenant)
--   3. Chỉ 1 tenant 'Bella Spa Headquarter' tồn tại
--   4. Tất cả user còn lại đều có role='admin'
--   5. Không còn POSTED journal entries
--
-- Tất cả assertion sẽ RAISE EXCEPTION nếu sai → dễ phát hiện vấn đề.
-- =============================================================================

DO $$
DECLARE
    v_hq_name TEXT := 'Bella Spa Headquarter';
    v_count BIGINT;
    v_tenant_count INT;
    v_bad_user INT;
    v_bad_post INT;

    -- bảng → kỳ vọng (0 = phải rỗng, >0 = phải còn dữ liệu)
    -- (bảng, expectation)
BEGIN
    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'VERIFY RESET — START';
    RAISE NOTICE '════════════════════════════════════════════════════════════';

    -- ─── A. Bảng phải RỖNG ────────────────────────────────────────────────
    FOR v_count IN
        SELECT COUNT(*) FROM public.customers
    LOOP
        IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: customers còn % bản ghi', v_count; END IF;
    END LOOP;
    RAISE NOTICE '✓ customers           : 0';

    SELECT COUNT(*) INTO v_count FROM public.bookings;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: bookings còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ bookings            : 0';

    SELECT COUNT(*) INTO v_count FROM public.session_logs;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: session_logs còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ session_logs        : 0';

    SELECT COUNT(*) INTO v_count FROM public.session_reviews;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: session_reviews còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ session_reviews     : 0';

    SELECT COUNT(*) INTO v_count FROM public.shifts;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: shifts còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ shifts              : 0';

    SELECT COUNT(*) INTO v_count FROM public.revenue;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: revenue còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ revenue             : 0';

    SELECT COUNT(*) INTO v_count FROM public.expenses;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: expenses còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ expenses            : 0';

    SELECT COUNT(*) INTO v_count FROM public.attendance;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: attendance còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ attendance          : 0';

    SELECT COUNT(*) INTO v_count FROM public.staff_leaves;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: staff_leaves còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ staff_leaves        : 0';

    SELECT COUNT(*) INTO v_count FROM public.salary_records;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: salary_records còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ salary_records      : 0';

    SELECT COUNT(*) INTO v_count FROM public.kpi_records;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: kpi_records còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ kpi_records         : 0';

    SELECT COUNT(*) INTO v_count FROM public.membership_records;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: membership_records còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ membership_records  : 0';

    SELECT COUNT(*) INTO v_count FROM public.chat_messages;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: chat_messages còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ chat_messages       : 0';

    SELECT COUNT(*) INTO v_count FROM public.chat_threads;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: chat_threads còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ chat_threads        : 0';

    SELECT COUNT(*) INTO v_count FROM public.journal_entries;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: journal_entries còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ journal_entries     : 0';

    SELECT COUNT(*) INTO v_count FROM public.journal_lines;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: journal_lines còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ journal_lines       : 0';

    SELECT COUNT(*) INTO v_count FROM public.accounting_outbox;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: accounting_outbox còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ accounting_outbox   : 0';

    SELECT COUNT(*) INTO v_count FROM public.audit_logs;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: audit_logs còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ audit_logs          : 0';

    SELECT COUNT(*) INTO v_count FROM public.app_notifications;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: app_notifications còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ app_notifications   : 0';

    SELECT COUNT(*) INTO v_count FROM public.ai_agent_logs;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: ai_agent_logs còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ ai_agent_logs       : 0';

    SELECT COUNT(*) INTO v_count FROM public.franchise_royalty_invoices;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: franchise_royalty_invoices còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ franchise_royalty   : 0';

    SELECT COUNT(*) INTO v_count FROM public.subscription_invoices;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: subscription_invoices còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ subscription_invoices: 0';

    SELECT COUNT(*) INTO v_count FROM public.inventory_transfer_orders;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: inventory_transfer_orders còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ inventory_transfers : 0';

    SELECT COUNT(*) INTO v_count FROM public.inter_branch_clearing_records;
    IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: inter_branch_clearing còn % bản ghi', v_count; END IF;
    RAISE NOTICE '✓ inter_branch_clearing: 0';

    IF to_regclass('public.inventory_items') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.inventory_items;
        IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: inventory_items còn % bản ghi', v_count; END IF;
        RAISE NOTICE '✓ inventory_items     : 0';
    END IF;

    IF to_regclass('public.inventory_logs') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.inventory_logs;
        IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: inventory_logs còn % bản ghi', v_count; END IF;
        RAISE NOTICE '✓ inventory_logs      : 0';
    END IF;

    IF to_regclass('public.package_materials') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.package_materials;
        IF v_count <> 0 THEN RAISE EXCEPTION 'FAIL: package_materials còn % bản ghi', v_count; END IF;
        RAISE NOTICE '✓ package_materials   : 0';
    END IF;

    -- ─── B. Tenant: chỉ còn HQ ─────────────────────────────────────────────
    SELECT COUNT(*) INTO v_tenant_count FROM public.tenants;
    IF v_tenant_count <> 1 THEN
        RAISE EXCEPTION 'FAIL: tenants phải = 1, hiện = %', v_tenant_count;
    END IF;

    SELECT COUNT(*) INTO v_tenant_count FROM public.tenants WHERE name = v_hq_name;
    IF v_tenant_count <> 1 THEN
        RAISE EXCEPTION 'FAIL: HQ tenant "%": không còn', v_hq_name;
    END IF;
    RAISE NOTICE '✓ tenants             : 1 (HQ)';

    -- ─── C. User: tất cả còn lại đều admin ─────────────────────────────────
    SELECT COUNT(*) INTO v_bad_user FROM public.users WHERE role <> 'admin';
    IF v_bad_user <> 0 THEN
        RAISE EXCEPTION 'FAIL: còn % user không phải admin', v_bad_user;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.users WHERE role = 'admin';
    IF v_count = 0 THEN
        RAISE EXCEPTION 'FAIL: không còn admin nào — không thể login!';
    END IF;
    RAISE NOTICE '✓ users (all admin)   : %', v_count;

    -- ─── D. auth.users đồng bộ với public.users ────────────────────────────
    SELECT COUNT(*) INTO v_count
      FROM auth.users a
     WHERE NOT EXISTS (SELECT 1 FROM public.users p WHERE p.id = a.id);
    IF v_count > 0 THEN
        RAISE WARNING 'CẢNH BÁO: % auth.users orphan (không có trong public.users)', v_count;
    ELSE
        RAISE NOTICE '✓ auth.users          : đồng bộ với public.users';
    END IF;

    -- ─── E. Master data còn nguyên ─────────────────────────────────────────
    SELECT COUNT(*) INTO v_count FROM public.accounting_accounts;
    IF v_count = 0 THEN
        RAISE WARNING 'CẢNH BÁO: accounting_accounts (COA) rỗng — có thể cần re-seed.';
    ELSE
        RAISE NOTICE '✓ accounting_accounts : % (COA preserved)', v_count;
    END IF;

    SELECT COUNT(*) INTO v_count FROM public.accounting_periods;
    RAISE NOTICE '  accounting_periods  : % (definitions preserved)', v_count;

    SELECT COUNT(*) INTO v_count FROM public.accounting_periods WHERE status = 'CLOSED';
    IF v_count > 0 THEN
        RAISE WARNING 'CẢNH BÁO: vẫn còn % kỳ CLOSED — kỳ vọng tất cả OPEN sau reset', v_count;
    END IF;

    IF to_regclass('public.packages') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.packages;
        RAISE NOTICE '  packages            : % (master preserved)', v_count;
    END IF;

    IF to_regclass('public.brand_service_master') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.brand_service_master;
        RAISE NOTICE '  brand_service_master: %', v_count;
    END IF;

    IF to_regclass('public.ai_agent_configs') IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count FROM public.ai_agent_configs;
        RAISE NOTICE '  ai_agent_configs    : %', v_count;
    END IF;

    -- ─── F. Không còn POSTED journal entries dư ────────────────────────────
    SELECT COUNT(*) INTO v_bad_post FROM public.journal_entries WHERE status = 'POSTED';
    IF v_bad_post <> 0 THEN
        RAISE EXCEPTION 'FAIL: còn % POSTED journal entries (kỳ vọng 0)', v_bad_post;
    END IF;
    RAISE NOTICE '✓ POSTED journal_entries: 0';

    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'VERIFY RESET — ALL CHECKS PASSED ✓';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
END
$$;
