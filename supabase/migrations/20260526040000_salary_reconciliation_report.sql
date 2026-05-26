-- =============================================================================
-- Migration: 20260526040000 — Salary Reconciliation Report (AI vs Legacy)
-- Ngày: 2026-05-26
-- Mục đích:
--   So sánh tổng lương do AI tính (calculate_ktv_salary_sheet) với tổng lương
--   đã được kế toán chốt thủ công (salary_records) để phát hiện lệch số.
--
--   Pattern: giống get_reconciliation_report (Phase 29.5) nhưng áp dụng
--   cho dữ liệu lương, so sánh 2 nguồn tính toán độc lập.
--
-- Trạng thái phân loại:
--   MATCH       — |diff| < 5 000đ HOẶC |diff%| < 1%
--   MINOR_DIFF  — 1% ≤ |diff%| < 5%
--   MAJOR_DIFF  — |diff%| ≥ 5%
--   NO_LEGACY   — KTV chưa có salary_record được chốt tháng này
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_salary_reconciliation(
    p_month_year DATE
)
RETURNS TABLE (
    ktv_id              UUID,
    ktv_name            TEXT,
    legacy_total        NUMERIC,    -- tổng lương từ salary_records (kế toán chốt)
    ai_total            NUMERIC,    -- tổng lương từ calculate_ktv_salary_sheet (AI tính)
    diff_amount         NUMERIC,    -- ai_total - legacy_total
    diff_percent        NUMERIC,    -- |diff| / legacy_total * 100, NULL nếu NO_LEGACY
    status              TEXT,       -- MATCH / MINOR_DIFF / MAJOR_DIFF / NO_LEGACY
    legacy_status       TEXT,       -- trạng thái chốt trong salary_records
    has_legacy_record   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
#variable_conflict use_column
DECLARE
    v_tenant_id UUID;
BEGIN
    -- Bảo mật: chỉ admin / accountant
    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE users.id = auth.uid()
          AND users.role IN ('admin', 'accountant', 'super_admin')
    ) THEN
        RAISE EXCEPTION 'Quyền hạn không hợp lệ. Chỉ Admin / Kế toán được xem báo cáo đối soát lương.';
    END IF;

    v_tenant_id := public.get_my_tenant_id();

    RETURN QUERY
    WITH

    -- ① Legacy: lương đã chốt trong salary_records
    legacy AS (
        SELECT
            r.ktv_id,
            (
                COALESCE(r.base_salary,               0) +
                COALESCE(r.kpi_bonus,                 0) +
                COALESCE(r.service_percentage_bonus,  0) +
                COALESCE(r.rating_bonus,              0) -
                COALESCE(r.violations_deduction,      0)
            )::NUMERIC                      AS total_legacy,
            r.status                        AS rec_status
        FROM public.salary_records r
        WHERE r.tenant_id = v_tenant_id
          AND date_trunc('month', r.month_year) = date_trunc('month', p_month_year)
    ),

    -- ② AI: chạy lại RPC tính lương
    ai_calc AS (
        SELECT
            s.ktv_id,
            s.ktv_name,
            s.total_salary::NUMERIC AS total_ai
        FROM public.calculate_ktv_salary_sheet(p_month_year) s
    )

    SELECT
        ac.ktv_id,
        ac.ktv_name,
        COALESCE(lg.total_legacy, 0)                                AS legacy_total,
        ac.total_ai                                                 AS ai_total,
        (ac.total_ai - COALESCE(lg.total_legacy, 0))                AS diff_amount,
        CASE
            WHEN lg.total_legacy IS NULL OR lg.total_legacy = 0 THEN NULL
            ELSE ROUND(
                ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100,
                2
            )
        END                                                         AS diff_percent,
        CASE
            WHEN lg.total_legacy IS NULL                            THEN 'NO_LEGACY'
            WHEN ABS(ac.total_ai - lg.total_legacy) < 5000
              OR (lg.total_legacy > 0
                  AND ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100 < 1)
                                                                    THEN 'MATCH'
            WHEN lg.total_legacy > 0
              AND ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100 < 5
                                                                    THEN 'MINOR_DIFF'
            ELSE                                                         'MAJOR_DIFF'
        END                                                         AS status,
        COALESCE(lg.rec_status, 'none')                             AS legacy_status,
        (lg.ktv_id IS NOT NULL)                                     AS has_legacy_record
    FROM ai_calc ac
    LEFT JOIN legacy lg ON lg.ktv_id = ac.ktv_id
    ORDER BY
        CASE
            WHEN lg.total_legacy IS NULL OR lg.total_legacy = 0 THEN NULL
            ELSE ABS(ac.total_ai - lg.total_legacy) / lg.total_legacy * 100
        END DESC NULLS FIRST,
        ac.ktv_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_salary_reconciliation(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_salary_reconciliation(DATE) TO service_role;
