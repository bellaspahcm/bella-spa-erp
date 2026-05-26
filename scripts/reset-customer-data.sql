-- =============================================================================
-- BELLA SPA ERP — FULL CUSTOMER & OPERATIONAL DATA RESET
-- =============================================================================
-- Mục đích:
--   Đưa hệ thống về trạng thái "phần mềm mới hoàn toàn" — xoá sạch dữ liệu
--   khách hàng, vận hành, tài chính phát sinh và các chi nhánh phụ. CHỈ GIỮ:
--     • 1 tenant duy nhất:  'Bella Spa Headquarter'
--     • Người dùng role = 'admin'
--     • Master data: packages, brand_service_master, accounting_accounts (COA),
--       accounting_periods (definitions), tenant settings (zalo, bank, salary).
--
-- XOÁ:
--   • customers / bookings / session_logs / session_reviews / shifts
--   • revenue / membership_records / chat_threads / chat_messages
--   • attendance / staff_leaves / expenses
--   • inventory_items / inventory_logs / package_materials
--   • salary_records / kpi_records
--   • journal_entries / journal_lines / accounting_outbox (movements)
--   • franchise_royalty_invoices / subscription_invoices
--   • inventory_transfer_orders / inter_branch_clearing_records
--   • audit_logs / app_notifications / ai_agent_logs
--   • users WHERE role <> 'admin'  (cả public.users và auth.users)
--   • tenants WHERE name <> 'Bella Spa Headquarter'
--
-- An toàn:
--   • Toàn bộ chạy trong 1 transaction (BEGIN/COMMIT). Sai ở bước nào -> ROLLBACK tự động.
--   • SET session_replication_role = 'replica' để bỏ qua audit & accounting
--     triggers (vô hiệu hoá block "Cannot modify a POSTED journal entry").
--   • DRY-RUN: đặt v_dry_run := TRUE để chỉ COUNT, không xoá thực sự.
--
-- Cách chạy:
--   1. Backup Supabase (Database -> Backups -> Take snapshot) HOẶC pg_dump.
--   2. Mở Supabase SQL Editor.
--   3. Copy-paste TOÀN BỘ file này, bấm RUN.
--   4. Đọc NOTICE output để xem số bản ghi đã xoá.
--   5. Chạy scripts/verify-reset.sql để xác minh.
--
-- Quyền:
--   • Phải chạy bằng connection có quyền service_role / postgres owner.
--   • Bỏ qua RLS vì service_role bypass mặc định.
-- =============================================================================

DO $$
DECLARE
    -- ─────────────────────────────────────────────────────────────────────
    -- THAM SỐ — điều chỉnh trước khi chạy
    -- ─────────────────────────────────────────────────────────────────────
    v_hq_name       TEXT    := 'Bella Spa Headquarter'; -- tên tenant trụ sở GIỮ LẠI
    v_dry_run       BOOLEAN := FALSE;                    -- TRUE = chỉ đếm, không xoá

    -- ─────────────────────────────────────────────────────────────────────
    -- Biến runtime
    -- ─────────────────────────────────────────────────────────────────────
    v_hq_id         UUID;
    v_admin_count   INT;
    v_kept_admin_ids UUID[];
    v_deleted       BIGINT;
    v_total_deleted BIGINT := 0;
BEGIN
    -- ─────────────────────────────────────────────────────────────────────
    -- 0. Xác minh điều kiện tiền đề
    -- ─────────────────────────────────────────────────────────────────────
    SELECT id INTO v_hq_id FROM public.tenants WHERE name = v_hq_name LIMIT 1;
    IF v_hq_id IS NULL THEN
        RAISE EXCEPTION 'HQ tenant "%": không tìm thấy. Tạo tenant với tên đúng trước khi reset.', v_hq_name;
    END IF;

    SELECT COUNT(*) INTO v_admin_count FROM public.users WHERE role = 'admin';
    IF v_admin_count = 0 THEN
        RAISE EXCEPTION 'Không có user role=admin nào — reset sẽ xoá hết user và không còn ai đăng nhập được. Tạo admin trước.';
    END IF;

    SELECT array_agg(id) INTO v_kept_admin_ids FROM public.users WHERE role = 'admin';

    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'BELLA SPA ERP — RESET START';
    RAISE NOTICE '────────────────────────────────────────────────────────────';
    RAISE NOTICE 'HQ tenant id        : %', v_hq_id;
    RAISE NOTICE 'HQ tenant name      : %', v_hq_name;
    RAISE NOTICE 'Admin users to keep : % (ids: %)', v_admin_count, v_kept_admin_ids;
    RAISE NOTICE 'Dry-run mode        : %', v_dry_run;
    RAISE NOTICE '════════════════════════════════════════════════════════════';

    IF v_dry_run THEN
        RAISE NOTICE 'DRY-RUN — không xoá. Số dòng sẽ bị xoá:';
        RAISE NOTICE '  customers          : %', (SELECT COUNT(*) FROM public.customers);
        RAISE NOTICE '  bookings           : %', (SELECT COUNT(*) FROM public.bookings);
        RAISE NOTICE '  session_logs       : %', (SELECT COUNT(*) FROM public.session_logs);
        RAISE NOTICE '  session_reviews    : %', (SELECT COUNT(*) FROM public.session_reviews);
        RAISE NOTICE '  revenue            : %', (SELECT COUNT(*) FROM public.revenue);
        RAISE NOTICE '  expenses           : %', (SELECT COUNT(*) FROM public.expenses);
        RAISE NOTICE '  attendance         : %', (SELECT COUNT(*) FROM public.attendance);
        RAISE NOTICE '  shifts             : %', (SELECT COUNT(*) FROM public.shifts);
        RAISE NOTICE '  salary_records     : %', (SELECT COUNT(*) FROM public.salary_records);
        RAISE NOTICE '  kpi_records        : %', (SELECT COUNT(*) FROM public.kpi_records);
        RAISE NOTICE '  membership_records : %', (SELECT COUNT(*) FROM public.membership_records);
        RAISE NOTICE '  chat_messages      : %', (SELECT COUNT(*) FROM public.chat_messages);
        RAISE NOTICE '  chat_threads       : %', (SELECT COUNT(*) FROM public.chat_threads);
        RAISE NOTICE '  staff_leaves       : %', (SELECT COUNT(*) FROM public.staff_leaves);
        RAISE NOTICE '  journal_entries    : %', (SELECT COUNT(*) FROM public.journal_entries);
        RAISE NOTICE '  journal_lines      : %', (SELECT COUNT(*) FROM public.journal_lines);
        RAISE NOTICE '  accounting_outbox  : %', (SELECT COUNT(*) FROM public.accounting_outbox);
        RAISE NOTICE '  audit_logs         : %', (SELECT COUNT(*) FROM public.audit_logs);
        RAISE NOTICE '  app_notifications  : %', (SELECT COUNT(*) FROM public.app_notifications);
        RAISE NOTICE '  ai_agent_logs      : %', (SELECT COUNT(*) FROM public.ai_agent_logs);
        RAISE NOTICE '  users (non-admin)  : %', (SELECT COUNT(*) FROM public.users WHERE role <> 'admin');
        RAISE NOTICE '  tenants (non-HQ)   : %', (SELECT COUNT(*) FROM public.tenants WHERE id <> v_hq_id);
        RETURN;
    END IF;

    -- ─────────────────────────────────────────────────────────────────────
    -- 1. Tắt mọi trigger để xoá nhanh + bỏ qua trigger
    --    "Cannot modify a POSTED journal entry" + audit trigger lan dây.
    -- ─────────────────────────────────────────────────────────────────────
    SET LOCAL session_replication_role = 'replica';
    RAISE NOTICE '[1/9] Triggers disabled (session_replication_role=replica)';

    -- ─────────────────────────────────────────────────────────────────────
    -- 2. Reassign admin users về HQ tenant TRƯỚC khi xoá non-HQ tenants
    --    (tránh FK violation từ public.users.tenant_id sau khi xoá tenants).
    -- ─────────────────────────────────────────────────────────────────────
    UPDATE public.users
       SET tenant_id = v_hq_id
     WHERE role = 'admin'
       AND (tenant_id IS NULL OR tenant_id <> v_hq_id);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[2/9] Reassigned % admin user(s) to HQ tenant', v_deleted;

    -- ─────────────────────────────────────────────────────────────────────
    -- 3. WIPE: dữ liệu khách hàng + dẫn xuất (FK con → cha)
    -- ─────────────────────────────────────────────────────────────────────
    TRUNCATE TABLE
        public.session_reviews,
        public.chat_messages,
        public.chat_threads,
        public.membership_records,
        public.session_logs,
        public.shifts,
        public.revenue,
        public.kpi_records,
        public.salary_records,
        public.bookings,
        public.customers
    RESTART IDENTITY CASCADE;
    RAISE NOTICE '[3/9] Customer-side tables wiped';

    -- ─────────────────────────────────────────────────────────────────────
    -- 4. WIPE: vận hành (attendance + leaves + expenses + inventory)
    -- ─────────────────────────────────────────────────────────────────────
    -- Inventory & package materials (giữ packages master)
    TRUNCATE TABLE
        public.attendance,
        public.staff_leaves,
        public.expenses
    RESTART IDENTITY CASCADE;
    -- inventory_items có thể chưa tồn tại trong một số môi trường
    DO $inv$
    BEGIN
        IF to_regclass('public.package_materials') IS NOT NULL THEN
            EXECUTE 'TRUNCATE TABLE public.package_materials RESTART IDENTITY CASCADE';
        END IF;
        IF to_regclass('public.inventory_logs') IS NOT NULL THEN
            EXECUTE 'TRUNCATE TABLE public.inventory_logs RESTART IDENTITY CASCADE';
        END IF;
        IF to_regclass('public.inventory_items') IS NOT NULL THEN
            EXECUTE 'TRUNCATE TABLE public.inventory_items RESTART IDENTITY CASCADE';
        END IF;
    END
    $inv$;
    RAISE NOTICE '[4/9] Operational tables wiped (attendance, staff_leaves, expenses, inventory)';

    -- ─────────────────────────────────────────────────────────────────────
    -- 5. WIPE: tài chính phát sinh (giữ COA + period definitions)
    -- ─────────────────────────────────────────────────────────────────────
    TRUNCATE TABLE
        public.journal_lines,
        public.journal_entries,
        public.accounting_outbox,
        public.franchise_royalty_invoices,
        public.subscription_invoices,
        public.inventory_transfer_orders,
        public.inter_branch_clearing_records
    RESTART IDENTITY CASCADE;
    RAISE NOTICE '[5/9] Financial movement tables wiped (COA & periods preserved)';

    -- Mở lại mọi kỳ kế toán đã CLOSED (vì sổ giờ rỗng → khoá kỳ vô nghĩa)
    UPDATE public.accounting_periods SET status = 'OPEN' WHERE status = 'CLOSED';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '       Reopened % previously-CLOSED accounting period(s)', v_deleted;

    -- ─────────────────────────────────────────────────────────────────────
    -- 6. WIPE: audit/notification/AI logs
    -- ─────────────────────────────────────────────────────────────────────
    TRUNCATE TABLE
        public.audit_logs,
        public.app_notifications,
        public.ai_agent_logs
    RESTART IDENTITY CASCADE;
    RAISE NOTICE '[6/9] Audit / notification / AI logs wiped';

    -- ─────────────────────────────────────────────────────────────────────
    -- 7. WIPE: users không phải admin (cả public.users và auth.users)
    --    auth.users → cascade xoá auth.sessions, auth.identities, refresh_tokens
    -- ─────────────────────────────────────────────────────────────────────
    DELETE FROM public.users WHERE role <> 'admin';
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[7/9] Deleted % non-admin public.users', v_deleted;
    v_total_deleted := v_total_deleted + v_deleted;

    DELETE FROM auth.users WHERE id <> ALL(v_kept_admin_ids);
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '       Deleted % non-admin auth.users (sessions/identities cascade)', v_deleted;

    -- ─────────────────────────────────────────────────────────────────────
    -- 8. WIPE: master data của các tenant non-HQ
    --    packages & brand_service_master không CASCADE từ tenants → phải xoá tay.
    --    Sau bước này, DELETE FROM tenants sẽ trigger CASCADE cho mọi bảng còn lại
    --    (accounting_accounts, accounting_periods, ai_agent_configs, ...).
    -- ─────────────────────────────────────────────────────────────────────
    DO $cleanup$
    BEGIN
        IF to_regclass('public.packages') IS NOT NULL THEN
            EXECUTE format('DELETE FROM public.packages WHERE tenant_id IS NOT NULL AND tenant_id <> %L', v_hq_id);
        END IF;
        IF to_regclass('public.brand_service_master') IS NOT NULL THEN
            EXECUTE format('DELETE FROM public.brand_service_master WHERE tenant_id IS NOT NULL AND tenant_id <> %L', v_hq_id);
        END IF;
    END
    $cleanup$;
    RAISE NOTICE '[8/9] Cleaned master data (packages/brand_service_master) of non-HQ tenants';

    -- ─────────────────────────────────────────────────────────────────────
    -- 9. DELETE non-HQ tenants → CASCADE xoá mọi bảng tenant-scoped còn lại
    -- ─────────────────────────────────────────────────────────────────────
    DELETE FROM public.tenants WHERE id <> v_hq_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
    RAISE NOTICE '[9/9] Deleted % non-HQ tenant(s) (CASCADE handled accounting/AI/notifications)', v_deleted;

    -- ─────────────────────────────────────────────────────────────────────
    -- Done
    -- ─────────────────────────────────────────────────────────────────────
    SET LOCAL session_replication_role = 'origin';

    RAISE NOTICE '════════════════════════════════════════════════════════════';
    RAISE NOTICE 'RESET COMPLETE — kept tenant: % (id=%)', v_hq_name, v_hq_id;
    RAISE NOTICE 'Run scripts/verify-reset.sql to confirm.';
    RAISE NOTICE '════════════════════════════════════════════════════════════';
END
$$;
