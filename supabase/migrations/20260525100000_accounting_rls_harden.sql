-- =============================================================================
-- Migration: Accounting Core — RLS Hardening
-- Ngày: 2026-05-25
-- Mục đích:
--   1. Drop các RLS policies cũ trên 4 bảng accounting tạo ở 20260524000000.
--      Lý do: pattern cũ dùng "(SELECT tenant_id FROM users WHERE id = auth.uid())"
--      không cho HQ super admin xem chéo tenant, và lặp subquery 3-4 lần trong mỗi policy
--      gây chậm.
--   2. Tạo lại policies dùng helper functions chuẩn của hệ thống:
--      - is_hq_super_admin()  — HQ admin bypass tenant filter
--      - get_auth_tenant_id() — Trả về tenant_id của user hiện tại (KHÔNG còn trả NULL cho HQ)
--      - is_admin()           — Kiểm tra role admin
-- =============================================================================


-- =============================================================================
-- 1. ACCOUNTING_ACCOUNTS — Chart of Accounts
-- =============================================================================
DROP POLICY IF EXISTS "Enable read for tenant users" ON public.accounting_accounts;
DROP POLICY IF EXISTS "Enable all for tenant admins" ON public.accounting_accounts;
DROP POLICY IF EXISTS "Tenant read accounting_accounts" ON public.accounting_accounts;
DROP POLICY IF EXISTS "Admin manage accounting_accounts" ON public.accounting_accounts;

-- Tất cả user trong tenant đều được xem COA (KTV cần biết account để hiển thị)
CREATE POLICY "Tenant read accounting_accounts"
    ON public.accounting_accounts
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- Chỉ admin được sửa/thêm COA
CREATE POLICY "Admin manage accounting_accounts"
    ON public.accounting_accounts
    FOR ALL TO authenticated
    USING (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    )
    WITH CHECK (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );


-- =============================================================================
-- 2. ACCOUNTING_PERIODS — Kỳ kế toán
-- =============================================================================
DROP POLICY IF EXISTS "Enable read for tenant users" ON public.accounting_periods;
DROP POLICY IF EXISTS "Enable all for tenant admins" ON public.accounting_periods;
DROP POLICY IF EXISTS "Tenant read accounting_periods" ON public.accounting_periods;
DROP POLICY IF EXISTS "Admin manage accounting_periods" ON public.accounting_periods;

CREATE POLICY "Tenant read accounting_periods"
    ON public.accounting_periods
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

CREATE POLICY "Admin manage accounting_periods"
    ON public.accounting_periods
    FOR ALL TO authenticated
    USING (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    )
    WITH CHECK (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );


-- =============================================================================
-- 3. JOURNAL_ENTRIES — Header bút toán
-- Lưu ý: service-role client (accounting engine) bypass RLS, các policy dưới đây
-- chỉ áp dụng khi user dùng cookie session.
-- =============================================================================
DROP POLICY IF EXISTS "Enable read for tenant users" ON public.journal_entries;
DROP POLICY IF EXISTS "Enable insert for tenant users" ON public.journal_entries;
DROP POLICY IF EXISTS "Enable update for tenant admins" ON public.journal_entries;
DROP POLICY IF EXISTS "Tenant read journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Admin insert journal_entries" ON public.journal_entries;
DROP POLICY IF EXISTS "Admin update journal_entries" ON public.journal_entries;

-- Mọi user trong tenant đều xem được journal (cần cho report/audit)
CREATE POLICY "Tenant read journal_entries"
    ON public.journal_entries
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR tenant_id = public.get_auth_tenant_id()
    );

-- Chỉ admin được insert journal thủ công (manual entry)
-- Engine post journal qua service-role nên bypass policy này
CREATE POLICY "Admin insert journal_entries"
    ON public.journal_entries
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

-- Chỉ admin update (DRAFT → POSTED, hoặc POSTED → CANCELED)
CREATE POLICY "Admin update journal_entries"
    ON public.journal_entries
    FOR UPDATE TO authenticated
    USING (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    )
    WITH CHECK (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

-- Cấm DELETE journal_entries (chuẩn kế toán: chỉ được CANCEL/REVERSE, không xoá)
-- Không tạo DELETE policy → mặc định bị chặn


-- =============================================================================
-- 4. JOURNAL_LINES — Chi tiết bút toán
-- =============================================================================
DROP POLICY IF EXISTS "Enable read for tenant users" ON public.journal_lines;
DROP POLICY IF EXISTS "Enable insert for tenant users" ON public.journal_lines;
DROP POLICY IF EXISTS "Enable update for tenant admins" ON public.journal_lines;
DROP POLICY IF EXISTS "Enable delete for tenant admins" ON public.journal_lines;
DROP POLICY IF EXISTS "Tenant read journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Admin insert journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Admin update journal_lines" ON public.journal_lines;
DROP POLICY IF EXISTS "Admin delete journal_lines on draft" ON public.journal_lines;

-- Lines kế thừa tenant từ entries → kiểm tra qua JOIN
CREATE POLICY "Tenant read journal_lines"
    ON public.journal_lines
    FOR SELECT TO authenticated
    USING (
        public.is_hq_super_admin()
        OR EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_lines.entry_id
              AND je.tenant_id = public.get_auth_tenant_id()
        )
    );

CREATE POLICY "Admin insert journal_lines"
    ON public.journal_lines
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR EXISTS (
                SELECT 1 FROM public.journal_entries je
                WHERE je.id = journal_lines.entry_id
                  AND je.tenant_id = public.get_auth_tenant_id()
            )
        )
    );

CREATE POLICY "Admin update journal_lines"
    ON public.journal_lines
    FOR UPDATE TO authenticated
    USING (
        public.is_admin()
        AND (
            public.is_hq_super_admin()
            OR EXISTS (
                SELECT 1 FROM public.journal_entries je
                WHERE je.id = journal_lines.entry_id
                  AND je.tenant_id = public.get_auth_tenant_id()
            )
        )
    );

-- DELETE chỉ được phép trên DRAFT entries (rollback khi engine throw)
-- Trigger trg_check_journal_line_modify đã chặn delete trên POSTED
CREATE POLICY "Admin delete journal_lines on draft"
    ON public.journal_lines
    FOR DELETE TO authenticated
    USING (
        public.is_admin()
        AND EXISTS (
            SELECT 1 FROM public.journal_entries je
            WHERE je.id = journal_lines.entry_id
              AND je.status = 'DRAFT'
              AND (
                  public.is_hq_super_admin()
                  OR je.tenant_id = public.get_auth_tenant_id()
              )
        )
    );


-- =============================================================================
-- 5. PERFORMANCE INDEXES
-- =============================================================================

-- Tenant lookup trên accounting_accounts (rất hay gọi qua getAccountByCode)
CREATE INDEX IF NOT EXISTS idx_accounting_accounts_tenant_code
    ON public.accounting_accounts (tenant_id, account_code) WHERE is_active = true;

-- Period lookup theo ngày (trigger set_journal_entry_period gọi)
CREATE INDEX IF NOT EXISTS idx_accounting_periods_tenant_date
    ON public.accounting_periods (tenant_id, start_date, end_date) WHERE status = 'OPEN';

-- Journal entries theo tenant + ngày (cho report)
CREATE INDEX IF NOT EXISTS idx_journal_entries_tenant_date
    ON public.journal_entries (tenant_id, entry_date DESC);

-- Journal entries theo reference (idempotency check ở Phase 27)
CREATE INDEX IF NOT EXISTS idx_journal_entries_reference
    ON public.journal_entries (tenant_id, reference_type, reference_id)
    WHERE reference_id IS NOT NULL;

-- Journal lines theo entry (cho fetch detail)
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines (entry_id);

-- Journal lines theo account (cho ledger view + trial balance)
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines (account_id);
