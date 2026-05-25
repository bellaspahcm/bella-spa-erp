-- =============================================================================
-- Migration: Seed Default Chart of Accounts (Thông tư 133/2016/TT-BTC)
-- Ngày: 2026-05-25
-- Mục đích:
--   Tạo function seed_default_coa(p_tenant_id UUID) để insert 20+ tài khoản
--   cốt lõi cho doanh nghiệp vừa và nhỏ (Thông tư 133) đặc thù SPA.
--
-- Cách dùng:
--   SELECT public.seed_default_coa('<tenant-uuid>');
--
--   Idempotent — gọi lần 2 sẽ skip các account đã tồn tại (ON CONFLICT DO NOTHING).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.seed_default_coa(p_tenant_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_inserted INTEGER := 0;
    v_count_before INTEGER;
    v_count_after INTEGER;
BEGIN
    -- Validate tenant exists
    IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Tenant % does not exist.', p_tenant_id;
    END IF;

    SELECT COUNT(*) INTO v_count_before
    FROM public.accounting_accounts WHERE tenant_id = p_tenant_id;

    -- =========================================================================
    -- LOẠI 1: TÀI SẢN (ASSET)
    -- =========================================================================
    INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active) VALUES
        (p_tenant_id, '111',  'Tiền mặt',                                    'ASSET',     true),
        (p_tenant_id, '112',  'Tiền gửi ngân hàng',                          'ASSET',     true),
        (p_tenant_id, '131',  'Phải thu của khách hàng',                     'ASSET',     true),
        (p_tenant_id, '138',  'Phải thu khác',                               'ASSET',     true),
        (p_tenant_id, '152',  'Nguyên liệu, vật liệu (dầu massage, kem)',    'ASSET',     true),
        (p_tenant_id, '153',  'Công cụ, dụng cụ (khăn, máy móc)',            'ASSET',     true),
        (p_tenant_id, '211',  'Tài sản cố định hữu hình (giường, thiết bị)', 'ASSET',     true),
        (p_tenant_id, '214',  'Hao mòn tài sản cố định',                     'ASSET',     true),
        (p_tenant_id, '242',  'Chi phí trả trước (thuê mặt bằng dài hạn)',   'ASSET',     true)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- =========================================================================
    -- LOẠI 3: NỢ PHẢI TRẢ (LIABILITY)
    -- =========================================================================
    INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active) VALUES
        (p_tenant_id, '331',  'Phải trả người bán (nhà cung cấp)',           'LIABILITY', true),
        (p_tenant_id, '333',  'Thuế và các khoản phải nộp nhà nước',         'LIABILITY', true),
        (p_tenant_id, '3331', 'Thuế GTGT phải nộp',                          'LIABILITY', true),
        (p_tenant_id, '3334', 'Thuế thu nhập doanh nghiệp',                  'LIABILITY', true),
        (p_tenant_id, '334',  'Phải trả người lao động (lương + hoa hồng)',  'LIABILITY', true),
        (p_tenant_id, '335',  'Chi phí phải trả',                            'LIABILITY', true),
        (p_tenant_id, '338',  'Phải trả, phải nộp khác',                     'LIABILITY', true),
        (p_tenant_id, '3387', 'Doanh thu chưa thực hiện (gói chưa dùng)',    'LIABILITY', true)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- =========================================================================
    -- LOẠI 4: VỐN CHỦ SỞ HỮU (EQUITY)
    -- =========================================================================
    INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active) VALUES
        (p_tenant_id, '411',  'Vốn đầu tư của chủ sở hữu',                   'EQUITY',    true),
        (p_tenant_id, '421',  'Lợi nhuận sau thuế chưa phân phối',           'EQUITY',    true)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- =========================================================================
    -- LOẠI 5: DOANH THU (REVENUE)
    -- =========================================================================
    INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active) VALUES
        (p_tenant_id, '511',  'Doanh thu bán hàng và cung cấp dịch vụ',      'REVENUE',   true),
        (p_tenant_id, '5111', 'Doanh thu gói dịch vụ (đã chia theo buổi)',   'REVENUE',   true),
        (p_tenant_id, '5112', 'Doanh thu lẻ (ngoài gói)',                    'REVENUE',   true),
        (p_tenant_id, '515',  'Doanh thu tài chính (lãi tiền gửi)',          'REVENUE',   true),
        (p_tenant_id, '521',  'Các khoản giảm trừ doanh thu (refund, voucher)','REVENUE', true),
        (p_tenant_id, '711',  'Thu nhập khác',                               'REVENUE',   true)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- =========================================================================
    -- LOẠI 6: CHI PHÍ (EXPENSE)
    -- =========================================================================
    INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active) VALUES
        (p_tenant_id, '632',  'Giá vốn hàng bán (vật tư tiêu hao)',          'EXPENSE',   true),
        (p_tenant_id, '635',  'Chi phí tài chính',                           'EXPENSE',   true),
        (p_tenant_id, '642',  'Chi phí quản lý kinh doanh',                  'EXPENSE',   true),
        (p_tenant_id, '6421', 'Hoa hồng KTV',                                'EXPENSE',   true),
        (p_tenant_id, '6422', 'Thưởng KPI nhân viên',                        'EXPENSE',   true),
        (p_tenant_id, '6423', 'Chi phí thuê mặt bằng',                       'EXPENSE',   true),
        (p_tenant_id, '6424', 'Chi phí điện nước, internet',                 'EXPENSE',   true),
        (p_tenant_id, '6425', 'Chi phí marketing & Zalo OA',                 'EXPENSE',   true),
        (p_tenant_id, '6426', 'Chi phí khấu hao TSCĐ',                       'EXPENSE',   true),
        (p_tenant_id, '6427', 'Chi phí khác bằng tiền',                      'EXPENSE',   true),
        (p_tenant_id, '811',  'Chi phí khác',                                'EXPENSE',   true),
        (p_tenant_id, '821',  'Chi phí thuế thu nhập doanh nghiệp',          'EXPENSE',   true)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- =========================================================================
    -- LOẠI 9: XÁC ĐỊNH KẾT QUẢ KINH DOANH
    -- =========================================================================
    INSERT INTO public.accounting_accounts (tenant_id, account_code, account_name, account_type, is_active) VALUES
        (p_tenant_id, '911',  'Xác định kết quả kinh doanh',                 'EQUITY',    true)
    ON CONFLICT (tenant_id, account_code) DO NOTHING;

    -- =========================================================================
    -- Set parent_id cho các account con (5111 → 511, 6421 → 642, 3331 → 333)
    -- =========================================================================
    UPDATE public.accounting_accounts c
    SET parent_id = p.id
    FROM public.accounting_accounts p
    WHERE c.tenant_id = p_tenant_id
      AND p.tenant_id = p_tenant_id
      AND c.account_code IN ('5111', '5112')
      AND p.account_code = '511';

    UPDATE public.accounting_accounts c
    SET parent_id = p.id
    FROM public.accounting_accounts p
    WHERE c.tenant_id = p_tenant_id
      AND p.tenant_id = p_tenant_id
      AND c.account_code IN ('3331', '3334')
      AND p.account_code = '333';

    UPDATE public.accounting_accounts c
    SET parent_id = p.id
    FROM public.accounting_accounts p
    WHERE c.tenant_id = p_tenant_id
      AND p.tenant_id = p_tenant_id
      AND c.account_code = '3387'
      AND p.account_code = '338';

    UPDATE public.accounting_accounts c
    SET parent_id = p.id
    FROM public.accounting_accounts p
    WHERE c.tenant_id = p_tenant_id
      AND p.tenant_id = p_tenant_id
      AND c.account_code IN ('6421', '6422', '6423', '6424', '6425', '6426', '6427')
      AND p.account_code = '642';

    SELECT COUNT(*) INTO v_count_after
    FROM public.accounting_accounts WHERE tenant_id = p_tenant_id;

    v_inserted := v_count_after - v_count_before;

    RAISE NOTICE 'Seeded % new accounts for tenant %. Total: %', v_inserted, p_tenant_id, v_count_after;
    RETURN v_inserted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- =============================================================================
-- BACKFILL: Seed COA cho mọi tenant hiện hữu chưa có Chart of Accounts
-- =============================================================================
DO $$
DECLARE
    t RECORD;
    n INTEGER;
BEGIN
    FOR t IN
        SELECT id, name FROM public.tenants
        WHERE NOT EXISTS (
            SELECT 1 FROM public.accounting_accounts
            WHERE tenant_id = tenants.id
        )
    LOOP
        n := public.seed_default_coa(t.id);
        RAISE NOTICE 'Backfilled tenant "%": % accounts seeded', t.name, n;
    END LOOP;
END;
$$;
