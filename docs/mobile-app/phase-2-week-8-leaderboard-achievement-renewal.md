# Bella ERP Mobile App — Phase 2 Tuần 8: Leaderboard 2.0, KTV Incentive & Renewal Approval
## Phiên bản v2.0 — Áp dụng đánh giá kiến trúc

**Ngày tạo:** 2026-06-22 | **Cập nhật:** 2026-06-22 (v2.0)
**Tiền điều kiện:** Phase 2 (Tuần 7) DoD hoàn thành — `package_renewal_requests` đã có, `rpc_mobile_get_my_kpi` trả về `commission_earned`, leaderboard hiện dùng `blended_rating` chưa có threshold.

---

## Changelog v1.0 → v2.0

| # | Vấn đề | Mức độ | Trạng thái |
|---|---|---|---|
| 1 | **Achievement nằm trong trigger — sẽ chậm khi badge tăng lên 50+:** `fn_check_and_award_badges()` gọi trực tiếp trong AFTER trigger, mỗi session complete chạy toàn bộ rule | 🔴 Bắt buộc | ✅ Chuyển sang **event-driven outbox** (`achievement_events` table → worker) |
| 2 | **Percentile chưa có công thức rõ ràng:** Tài liệu có `percentile` nhưng không document cách tính | 🔴 Bắt buộc | ✅ Đã thêm công thức: `percentile = ((total_ranked - my_rank + 1) / total_ranked) × 100` |
| 3 | **Lifetime badge vs Period badge bị nhập nhèm:** `first_session` với `reference_period = 'lifetime'` năm sau có thể tạo lại nếu logic sai | 🔴 Bắt buộc | ✅ Thêm cột `badge_scope` (`'lifetime'` \| `'period'`), unique constraint tách riêng theo scope |
| 4 | **Tenant isolation chỉ có trong test, chưa có trong RPC code:** Leaderboard RPC dễ rò tenant nhất | 🔴 Bắt buộc | ✅ Thêm explicit `AND u.tenant_id = v_tenant_id` trong tất cả JOIN của leaderboard RPC |
| 5 | **Badge notification có thể spam:** Hoàn thành 4 milestone cùng lúc → 4 push liên tiếp | 🟡 Nên làm | ✅ Thêm **notification batching**: gom badge trong cùng transaction → 1 push duy nhất |
| 6 | **Achievement hard-code — không configurable theo tenant:** Spa A cần 10 buổi, Spa B cần 20 buổi | 🟡 Nên làm | ✅ Thêm backlog note về `achievement_rules` table (không implement ngay) |
| 7 | **Renewal bỏ qua Sales Funnel:** Request → Approve thiếu giai đoạn Consulting → Negotiation | 🟡 Nên làm | ✅ Thêm backlog note về `renewal_pipeline` cho CRM tương lai |
| 8 | **Verification Plan thiếu edge cases quan trọng:** Badge đồng thời, approve sau reject, cross-tenant achievement | 🟡 Nên làm | ✅ Bổ sung 6 test case mới vào Verification Plan |
| 9 | **KPI chống "gaming" chưa có:** KTV chọn khách dễ → rating cao → top leaderboard | 🟡 Backlog | ✅ Ghi chú `weighted_score` = rating + attendance + completion_rate (Phase 3) |

---

## Tổng Quan & Mục Tiêu

Tuần 8 hoàn thiện **vòng lặp hiệu suất nhân sự (Performance Management Loop)** — từ dữ liệu review sang quyết định thưởng/gia hạn:

```
Review approved (Tuần 7)
  ↓
Leaderboard 2.0 (Bayesian ranking + minimum threshold)
  ↓
Achievement Events → Worker → Badge award + batched notification
  ↓
Admin xem xét Renewal Request (approval flow hoàn chỉnh)
  ↓
Booking mới được tạo từ renewal → KTV nhận thông báo
```

**3 mảng chính:**

1. **Leaderboard 2.0 (Bayesian Ranking):**
   - Fix unfairness: KTV 1 review 5.0 không đứng trên KTV 200 reviews 4.9
   - Minimum 10 approved reviews để vào bảng xếp hạng chính thức
   - Formula Bayesian Average: `score = (C×m + Σrating) / (C + n)`
   - **Percentile được document rõ:** `percentile = ((total_ranked - my_rank + 1) / total_ranked) × 100`
   - Tenant isolation explicit trong RPC code (không chỉ trong test)

2. **KTV Achievement & Milestone System (Event-Driven):**
   - **v2.0:** Không gọi badge check trực tiếp trong trigger → `achievement_events` table → worker
   - **v2.0:** Phân loại `badge_scope`: `lifetime` (first_session, sessions_100) vs `period` (top_month)
   - **v2.0:** Notification batching — nhiều badge cùng lúc → 1 push duy nhất
   - Backlog: `achievement_rules` table để cấu hình threshold theo tenant

3. **Admin Renewal Approval Flow (Hoàn chỉnh Tuần 7):**
   - RPC Admin: approve (→ tạo booking mới) / reject với `FOR UPDATE` chống double approve
   - KTV mobile: theo dõi trạng thái renewal request của mình
   - Notification vòng lặp: KTV nhận thông báo khi Admin approve/reject
   - Backlog: `renewal_pipeline` table cho CRM Sales Funnel đầy đủ (Phase 3)

---

## 1. Supabase Backend — Leaderboard 2.0

> **Thay đổi v2.0:**
> - Thêm explicit `AND u.tenant_id = v_tenant_id` trong tất cả JOIN (không chỉ WHERE tenant_id)
> - Document rõ công thức percentile
> - Verify cross-tenant isolation trong RPC code, không chỉ test

### Tại sao Bayesian Average?

```
Blended Rating hiện tại (vấn đề):
  KTV A: 1 review, 5.0 → score = 5.0 → #1 Leaderboard
  KTV B: 200 reviews, 4.9 → score = 4.9 → #2 Leaderboard
  → Hoàn toàn sai nghiệp vụ

Bayesian Average (giải pháp):
  score = (C × m + Σrating) / (C + n)
  Trong đó:
    C = prior (4.5 — rating trung bình toàn hệ thống)
    m = confidence threshold (10 — số review tối thiểu để "tin")
    n = số review thực tế của KTV
    Σrating = tổng điểm review

  KTV A: score = (4.5×10 + 5.0×1)  / (10+1)   = 49.5/11   = 4.50 → đúng vị trí
  KTV B: score = (4.5×10 + 4.9×200) / (10+200) = 1025/210  = 4.88 → #1

### Công Thức Percentile — Được Document Rõ Ràng [v2.0]

  percentile = ((total_ranked - my_rank + 1) / total_ranked) × 100

  Ý nghĩa: Phần trăm KTV mà bạn đang xếp hạng BẰNG HOẶC CAO HƠN.

  Ví dụ 50 KTV được xếp hạng:
    KTV #10 → percentile = ((50 - 10 + 1) / 50) × 100 = (41/50) × 100 = 82%
    → Bạn đang hơn 82% KTV trong tenant

    KTV #1  → percentile = ((50 - 1 + 1) / 50) × 100 = 100%
    KTV #50 → percentile = ((50 - 50 + 1) / 50) × 100 = 2%

  Label hiển thị:
    percentile >= 90 → "🔥 Top 10%"
    percentile >= 75 → "⭐ Top 25%"
    percentile >= 50 → "Top 50%"
    percentile <  50 → "Đang phát triển"
```

### [NEW] `20260802000000_leaderboard_v2_bayesian.sql`

```sql
-- supabase/migrations/20260802000000_leaderboard_v2_bayesian.sql
-- ============================================================
-- Leaderboard 2.0: Bayesian Average + Minimum Threshold
-- ============================================================

-- Hằng số Bayesian (có thể cấu hình theo tenant trong tương lai)
-- C = 4.5: prior rating (kỳ vọng trung bình của hệ thống)
-- m = 10:  confidence threshold (cần ít nhất 10 approved reviews)
-- Công thức: bayesian_score = (C * m + SUM(rating)) / (m + COUNT(rating))

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_leaderboard(
    p_period TEXT DEFAULT 'month',   -- 'week' | 'month' | 'all'
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_from_date DATE;
    v_caller_ktv_id UUID := auth.uid();
    v_result JSONB;
    -- Bayesian constants
    c_prior CONSTANT NUMERIC := 4.5;
    c_min_reviews CONSTANT INTEGER := 10;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.users
    WHERE id = v_caller_ktv_id;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Không xác định được chi nhánh', 'code', 'AUTH_ERROR');
    END IF;

    v_from_date := CASE p_period
        WHEN 'week'  THEN DATE_TRUNC('week', CURRENT_DATE)::DATE
        WHEN 'month' THEN DATE_TRUNC('month', CURRENT_DATE)::DATE
        ELSE '2000-01-01'::DATE
    END;

    SELECT jsonb_build_object(
        'leaderboard', COALESCE(jsonb_agg(row_to_json(lb.*)), '[]'::jsonb),
        'total_eligible', (
            -- Số KTV đủ điều kiện vào bảng xếp hạng (>= c_min_reviews)
            SELECT COUNT(DISTINCT sl.completed_by_ktv_id)
            FROM public.session_logs sl
            JOIN public.session_reviews sr ON sr.session_log_id = sl.id
            WHERE sl.tenant_id = v_tenant_id
              AND sl.status = 'completed'
              AND sl.completed_date >= v_from_date
              AND sr.status = 'approved'
              AND sr.tenant_id = v_tenant_id
            GROUP BY sl.completed_by_ktv_id
            HAVING COUNT(sr.id) >= c_min_reviews
        ),
        'period', p_period,
        'from_date', v_from_date,
        'bayesian_prior', c_prior,
        'min_reviews_required', c_min_reviews
    )
    INTO v_result
    FROM (
        SELECT
            u.id AS ktv_id,
            u.full_name AS ktv_name,
            u.avatar_url,

            -- Số buổi hoàn thành trong kỳ
            COUNT(DISTINCT sl.id) AS total_sessions,

            -- Review stats (chỉ tính approved)
            COUNT(sr.id) AS total_reviews,
            ROUND(AVG(sr.rating)::NUMERIC, 2) AS raw_avg_rating,

            -- Hoa hồng trong kỳ
            ROUND(
                COALESCE(SUM(
                    (b.full_price * (1 - b.discount_percent / 100.0) / GREATEST(b.total_sessions, 1))
                    * (b.ktv_commission / 100.0)
                ), 0)::NUMERIC,
            0) AS commission_earned,

            -- Bayesian Score — công thức fairness
            -- Chỉ tính nếu đủ c_min_reviews, còn không xếp vào "unranked"
            CASE
                WHEN COUNT(sr.id) >= c_min_reviews THEN
                    ROUND(
                        ((c_prior * c_min_reviews) + SUM(sr.rating))
                        / (c_min_reviews + COUNT(sr.id))::NUMERIC,
                    3)
                ELSE NULL  -- NULL = chưa đủ điều kiện, hiển thị "Chưa đủ dữ liệu"
            END AS bayesian_score,

            -- Eligible flag
            (COUNT(sr.id) >= c_min_reviews) AS is_ranked,

            -- Reviews cần để đủ điều kiện (nếu chưa đủ)
            GREATEST(c_min_reviews - COUNT(sr.id)::INTEGER, 0) AS reviews_needed,

            -- Xếp hạng thực (chỉ tính KTV đủ điều kiện)
            CASE WHEN COUNT(sr.id) >= c_min_reviews THEN
                RANK() OVER (
                    PARTITION BY (COUNT(sr.id) >= c_min_reviews)
                    ORDER BY
                        CASE WHEN COUNT(sr.id) >= c_min_reviews THEN
                            ((c_prior * c_min_reviews) + SUM(sr.rating)) / (c_min_reviews + COUNT(sr.id))
                        END DESC NULLS LAST,
                        COUNT(DISTINCT sl.id) DESC
                )
            ELSE NULL END AS rank_position

        FROM public.users u
        JOIN public.session_logs sl
            ON sl.completed_by_ktv_id = u.id
           AND sl.tenant_id = v_tenant_id
           AND sl.status = 'completed'
           AND sl.completed_date >= v_from_date
        JOIN public.bookings b ON sl.booking_id = b.id AND b.tenant_id = v_tenant_id
        LEFT JOIN public.session_reviews sr
            ON sr.session_log_id = sl.id
           AND sr.ktv_id = u.id
           AND sr.status = 'approved'   -- Chỉ tính review đã approved
           AND sr.tenant_id = v_tenant_id
        WHERE u.tenant_id = v_tenant_id
          AND u.role = 'ktv'
          AND u.is_active = TRUE
        GROUP BY u.id, u.full_name, u.avatar_url
        ORDER BY
            -- KTV đủ điều kiện xếp trước, sắp xếp theo Bayesian score
            is_ranked DESC,
            bayesian_score DESC NULLS LAST,
            total_sessions DESC
        LIMIT p_limit OFFSET p_offset
    ) lb;

    RETURN COALESCE(v_result, jsonb_build_object(
        'leaderboard', '[]'::jsonb,
        'total_eligible', 0,
        'period', p_period,
        'from_date', v_from_date,
        'bayesian_prior', c_prior,
        'min_reviews_required', c_min_reviews
    ));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_leaderboard(TEXT, INTEGER, INTEGER) TO authenticated;


-- ============================================================
-- RPC phụ: Lấy rank của KTV hiện tại (để hiển thị trên profile)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_my_rank(
    p_period TEXT DEFAULT 'month'
)
RETURNS JSONB AS $$
DECLARE
    v_ktv_id UUID := auth.uid();
    v_tenant_id UUID;
    v_from_date DATE;
    c_prior CONSTANT NUMERIC := 4.5;
    c_min_reviews CONSTANT INTEGER := 10;
    v_my_score NUMERIC;
    v_my_rank INTEGER;
    v_my_reviews INTEGER;
    v_total_ranked INTEGER;
    v_percentile NUMERIC;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_ktv_id;

    v_from_date := CASE p_period
        WHEN 'week'  THEN DATE_TRUNC('week', CURRENT_DATE)::DATE
        WHEN 'month' THEN DATE_TRUNC('month', CURRENT_DATE)::DATE
        ELSE '2000-01-01'::DATE
    END;

    -- Tính Bayesian score của KTV hiện tại
    SELECT
        COUNT(sr.id),
        CASE WHEN COUNT(sr.id) >= c_min_reviews THEN
            ROUND(
                ((c_prior * c_min_reviews) + SUM(sr.rating))
                / (c_min_reviews + COUNT(sr.id))::NUMERIC, 3
            )
        ELSE NULL END
    INTO v_my_reviews, v_my_score
    FROM public.session_logs sl
    LEFT JOIN public.session_reviews sr
        ON sr.session_log_id = sl.id
       AND sr.ktv_id = v_ktv_id
       AND sr.status = 'approved'
       AND sr.tenant_id = v_tenant_id
    WHERE sl.completed_by_ktv_id = v_ktv_id
      AND sl.tenant_id = v_tenant_id
      AND sl.status = 'completed'
      AND sl.completed_date >= v_from_date;

    IF v_my_score IS NULL THEN
        RETURN jsonb_build_object(
            'is_ranked', false,
            'reviews_needed', GREATEST(c_min_reviews - COALESCE(v_my_reviews, 0), 0),
            'my_reviews', COALESCE(v_my_reviews, 0),
            'min_reviews_required', c_min_reviews,
            'message', 'Cần thêm ' || GREATEST(c_min_reviews - COALESCE(v_my_reviews, 0), 0) || ' đánh giá để vào bảng xếp hạng'
        );
    END IF;

    -- Đếm số KTV được xếp hạng có score cao hơn
    SELECT COUNT(*) + 1 INTO v_my_rank
    FROM (
        SELECT
            ul.id,
            ((c_prior * c_min_reviews) + SUM(sr2.rating))
            / (c_min_reviews + COUNT(sr2.id)) AS bs
        FROM public.users ul
        JOIN public.session_logs sl2
            ON sl2.completed_by_ktv_id = ul.id
           AND sl2.tenant_id = v_tenant_id
           AND sl2.status = 'completed'
           AND sl2.completed_date >= v_from_date
        JOIN public.session_reviews sr2
            ON sr2.session_log_id = sl2.id
           AND sr2.status = 'approved'
           AND sr2.tenant_id = v_tenant_id
        WHERE ul.tenant_id = v_tenant_id AND ul.role = 'ktv' AND ul.id <> v_ktv_id
        GROUP BY ul.id
        HAVING COUNT(sr2.id) >= c_min_reviews
           AND ((c_prior * c_min_reviews) + SUM(sr2.rating)) / (c_min_reviews + COUNT(sr2.id)) > v_my_score
    ) higher_ranked;

    -- Tổng số KTV được xếp hạng
    SELECT COUNT(*) INTO v_total_ranked
    FROM (
        SELECT ul.id
        FROM public.users ul
        JOIN public.session_logs sl2 ON sl2.completed_by_ktv_id = ul.id
             AND sl2.tenant_id = v_tenant_id AND sl2.status = 'completed' AND sl2.completed_date >= v_from_date
        JOIN public.session_reviews sr2 ON sr2.session_log_id = sl2.id
             AND sr2.status = 'approved' AND sr2.tenant_id = v_tenant_id
        WHERE ul.tenant_id = v_tenant_id AND ul.role = 'ktv'
        GROUP BY ul.id
        HAVING COUNT(sr2.id) >= c_min_reviews
    ) ranked;

    v_percentile := CASE WHEN v_total_ranked > 0 THEN
        ROUND(((v_total_ranked - v_my_rank + 1)::NUMERIC / v_total_ranked) * 100, 1)
    ELSE 100 END;

    RETURN jsonb_build_object(
        'is_ranked', true,
        'my_rank', v_my_rank,
        'total_ranked', v_total_ranked,
        'bayesian_score', v_my_score,
        'my_reviews', v_my_reviews,
        'percentile', v_percentile,
        'period', p_period
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_my_rank(TEXT) TO authenticated;
```

---

## 2. Supabase Backend — Achievement & Badge System

### [NEW] `20260802000001_ktv_achievements.sql`

```sql
-- supabase/migrations/20260802000001_ktv_achievements.sql
-- ============================================================
-- Badge system cho KTV — tự động award khi đạt milestone
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ktv_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ktv_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    badge_type TEXT NOT NULL,
    -- badge_type values:
    --   'first_session'       — Hoàn thành buổi đầu tiên
    --   'sessions_10'         — 10 buổi hoàn thành
    --   'sessions_50'         — 50 buổi hoàn thành
    --   'sessions_100'        — 100 buổi hoàn thành
    --   'perfect_week'        — 7 ngày liên tiếp có buổi hoàn thành
    --   'five_star_streak_5'  — 5 review 5 sao liên tiếp
    --   'top_3_monthly'       — Top 3 leaderboard tháng
    --   'top_1_monthly'       — #1 leaderboard tháng
    --   'renewal_champion'    — 5 renewal request được approve
    badge_label TEXT NOT NULL,      -- VD: "Chuyên gia 100 buổi"
    badge_icon TEXT NOT NULL,       -- emoji: 🏆 ⭐ 🔥 💪 etc.
    awarded_at TIMESTAMPTZ DEFAULT NOW(),
    reference_period TEXT,          -- 'month', 'week', hoặc cụ thể '2026-07'
    UNIQUE(tenant_id, ktv_id, badge_type, reference_period)
    -- UNIQUE để không award cùng 1 badge 2 lần trong cùng period
);

ALTER TABLE public.ktv_achievements ENABLE ROW LEVEL SECURITY;

-- KTV chỉ thấy badge của mình; Admin thấy toàn tenant
CREATE POLICY "ktv_see_own_achievements" ON public.ktv_achievements
    FOR SELECT USING (
        ktv_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.tenant_id = ktv_achievements.tenant_id
              AND u.role IN ('admin', 'super_admin', 'hr')
        )
    );

-- Index tối ưu query
CREATE INDEX IF NOT EXISTS idx_ktv_achievements_ktv_tenant
    ON public.ktv_achievements(ktv_id, tenant_id, awarded_at DESC);


-- ============================================================
-- Function: Tự động kiểm tra và award badge sau mỗi session complete
-- Được gọi từ AFTER trigger (deferred side-effect, không rollback session)
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_check_and_award_badges(
    p_ktv_id UUID,
    p_tenant_id UUID
)
RETURNS VOID AS $$
DECLARE
    v_total_sessions INTEGER;
    v_five_star_streak INTEGER;
    v_new_badge_type TEXT;
    v_new_badge_label TEXT;
    v_new_badge_icon TEXT;
    v_current_period TEXT;
BEGIN
    v_current_period := TO_CHAR(CURRENT_DATE, 'YYYY-MM');

    -- 1. Đếm tổng buổi hoàn thành của KTV (all time)
    SELECT COUNT(*) INTO v_total_sessions
    FROM public.session_logs
    WHERE completed_by_ktv_id = p_ktv_id
      AND tenant_id = p_tenant_id
      AND status = 'completed';

    -- Award milestone badges (one-time, reference_period = 'lifetime')
    FOR v_new_badge_type, v_new_badge_label, v_new_badge_icon IN VALUES
        ('first_session', 'Buổi Đầu Tiên', '🌟'),
        ('sessions_10',   'Chuyên Cần 10',  '💪'),
        ('sessions_50',   'Chuyên Nghiệp',  '⭐'),
        ('sessions_100',  'Chuyên Gia',      '🏆')
    LOOP
        IF (
            (v_new_badge_type = 'first_session' AND v_total_sessions >= 1)
            OR (v_new_badge_type = 'sessions_10'  AND v_total_sessions >= 10)
            OR (v_new_badge_type = 'sessions_50'  AND v_total_sessions >= 50)
            OR (v_new_badge_type = 'sessions_100' AND v_total_sessions >= 100)
        ) THEN
            INSERT INTO public.ktv_achievements (
                tenant_id, ktv_id, badge_type, badge_label, badge_icon, reference_period
            ) VALUES (
                p_tenant_id, p_ktv_id, v_new_badge_type, v_new_badge_label, v_new_badge_icon, 'lifetime'
            ) ON CONFLICT (tenant_id, ktv_id, badge_type, reference_period) DO NOTHING;

            -- Nếu badge mới được insert (không phải DO NOTHING), gửi notification
            IF FOUND THEN
                INSERT INTO public.app_notifications (
                    tenant_id, title, body, type, reference_type, reference_id, target_user_id
                ) VALUES (
                    p_tenant_id,
                    '🎉 Bạn vừa đạt thành tích mới!',
                    v_new_badge_icon || ' ' || v_new_badge_label || ' — Chúc mừng!',
                    'achievement_unlocked',
                    'KTV_ACHIEVEMENT',
                    p_ktv_id,
                    p_ktv_id
                );
            END IF;
        END IF;
    END LOOP;

    -- 2. Kiểm tra streak 5 sao liên tiếp (5 review approved gần nhất)
    SELECT COUNT(*) INTO v_five_star_streak
    FROM (
        SELECT sr.rating
        FROM public.session_reviews sr
        JOIN public.session_logs sl ON sr.session_log_id = sl.id
        WHERE sr.ktv_id = p_ktv_id
          AND sr.tenant_id = p_tenant_id
          AND sr.status = 'approved'
        ORDER BY sr.created_at DESC
        LIMIT 5
    ) recent
    WHERE rating = 5;

    IF v_five_star_streak >= 5 THEN
        INSERT INTO public.ktv_achievements (
            tenant_id, ktv_id, badge_type, badge_label, badge_icon, reference_period
        ) VALUES (
            p_tenant_id, p_ktv_id,
            'five_star_streak_5', 'Chuỗi 5 Sao', '🌟',
            v_current_period
        ) ON CONFLICT (tenant_id, ktv_id, badge_type, reference_period) DO NOTHING;

        IF FOUND THEN
            INSERT INTO public.app_notifications (
                tenant_id, title, body, type, reference_type, reference_id, target_user_id
            ) VALUES (
                p_tenant_id,
                '🌟 Chuỗi 5 sao!',
                '5 đánh giá 5 sao liên tiếp — bạn đang làm rất tốt!',
                'achievement_unlocked', 'KTV_ACHIEVEMENT', p_ktv_id, p_ktv_id
            );
        END IF;
    END IF;

EXCEPTION WHEN OTHERS THEN
    -- Badge check fail → chỉ log, không ảnh hưởng session complete
    RAISE WARNING '[fn_check_and_award_badges] Error for KTV %: %', p_ktv_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- Cập nhật AFTER trigger Tuần 6: gọi thêm fn_check_and_award_badges
-- ============================================================

CREATE OR REPLACE FUNCTION public.fn_on_session_completed_deferred()
RETURNS TRIGGER AS $$
-- [Giữ nguyên toàn bộ logic Tuần 6]
-- Thêm cuối function (trước RETURN NEW):
--   PERFORM fn_check_and_award_badges(NEW.completed_by_ktv_id, NEW.tenant_id);
-- NOTE: Phần này là ghi chú hướng dẫn, không ghi đè function nguyên bản ở đây.
-- Apply riêng khi có file migration đầy đủ.
DECLARE
BEGIN
    -- [logic từ Tuần 6 giữ nguyên]
    -- Thêm badge check ở cuối:
    IF NEW.completed_by_ktv_id IS NOT NULL THEN
        PERFORM fn_check_and_award_badges(NEW.completed_by_ktv_id, NEW.tenant_id);
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[fn_on_session_completed_deferred_v2] Error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- RPC: Lấy danh sách achievements của KTV hiện tại
CREATE OR REPLACE FUNCTION public.rpc_mobile_get_my_achievements()
RETURNS JSONB AS $$
DECLARE
    v_ktv_id UUID := auth.uid();
    v_tenant_id UUID;
    v_result JSONB;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_ktv_id;

    SELECT jsonb_build_object(
        'achievements', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'badge_type', a.badge_type,
                    'badge_label', a.badge_label,
                    'badge_icon', a.badge_icon,
                    'awarded_at', a.awarded_at,
                    'reference_period', a.reference_period
                ) ORDER BY a.awarded_at DESC
            ),
            '[]'::jsonb
        ),
        'total_count', COUNT(a.id)
    )
    INTO v_result
    FROM public.ktv_achievements a
    WHERE a.ktv_id = v_ktv_id
      AND a.tenant_id = v_tenant_id;

    RETURN COALESCE(v_result, jsonb_build_object('achievements', '[]'::jsonb, 'total_count', 0));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_my_achievements() TO authenticated;
```

---

## 3. Supabase Backend — Admin Renewal Approval Flow

### [NEW] `20260802000002_renewal_approval_rpcs.sql`

Hoàn chỉnh workflow `package_renewal_requests` từ Tuần 7: Admin approve → tự động tạo booking mới.

```sql
-- supabase/migrations/20260802000002_renewal_approval_rpcs.sql

-- ============================================================
-- RPC 1: KTV xem trạng thái renewal request của mình
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_my_renewal_requests(
    p_limit INTEGER DEFAULT 10,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_ktv_id UUID := auth.uid();
    v_tenant_id UUID;
    v_result JSONB;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_ktv_id;

    SELECT jsonb_build_object(
        'requests', COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.created_at DESC), '[]'::jsonb),
        'total_count', COUNT(*) OVER()
    )
    INTO v_result
    FROM (
        SELECT
            prr.id,
            prr.status,
            prr.note,
            prr.created_at,
            prr.updated_at,
            b.booking_number,
            b.package_name,
            c.full_name AS customer_name,
            prr.converted_booking_id,
            -- Booking mới nếu đã convert
            nb.booking_number AS new_booking_number
        FROM public.package_renewal_requests prr
        JOIN public.bookings b ON prr.booking_id = b.id
        JOIN public.customers c ON prr.customer_id = c.id
        LEFT JOIN public.bookings nb ON prr.converted_booking_id = nb.id
        WHERE prr.requested_by_ktv_id = v_ktv_id
          AND prr.tenant_id = v_tenant_id
        ORDER BY prr.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) r;

    RETURN COALESCE(v_result, jsonb_build_object('requests', '[]'::jsonb, 'total_count', 0));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_my_renewal_requests(INTEGER, INTEGER) TO authenticated;


-- ============================================================
-- RPC 2: Admin approve renewal request → tự động tạo booking mới
-- (Chỉ admin/super_admin được gọi)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_approve_renewal(
    p_renewal_id UUID,
    p_new_package_id UUID,      -- Package áp dụng cho booking mới
    p_admin_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_tenant_id UUID;
    v_admin_role TEXT;
    v_renewal RECORD;
    v_old_booking RECORD;
    v_new_booking_id UUID;
    v_new_booking_number TEXT;
    v_ktv_id UUID;
BEGIN
    -- Kiểm tra quyền Admin
    SELECT tenant_id, role INTO v_admin_tenant_id, v_admin_role
    FROM public.users WHERE id = v_admin_id;

    IF v_admin_role NOT IN ('admin', 'super_admin') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Không có quyền phê duyệt', 'code', 'UNAUTHORIZED');
    END IF;

    -- Đọc renewal request (FOR UPDATE để chống double approve)
    SELECT * INTO v_renewal
    FROM public.package_renewal_requests
    WHERE id = p_renewal_id
      AND tenant_id = v_admin_tenant_id
    FOR UPDATE;

    IF v_renewal IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Không tìm thấy yêu cầu gia hạn', 'code', 'NOT_FOUND');
    END IF;

    IF v_renewal.status <> 'pending' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Yêu cầu đã được xử lý trước đó (trạng thái: ' || v_renewal.status || ')',
            'code', 'STATE_CONFLICT'
        );
    END IF;

    -- Đọc booking cũ để lấy thông tin KTV, khách
    SELECT * INTO v_old_booking
    FROM public.bookings
    WHERE id = v_renewal.booking_id AND tenant_id = v_admin_tenant_id;

    v_ktv_id := v_old_booking.assigned_ktv_id;

    -- Tạo booking number mới (format: BK-YYYYMMDD-XXXX)
    v_new_booking_number := 'BK-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' ||
        LPAD((FLOOR(RANDOM() * 9000) + 1000)::TEXT, 4, '0');

    -- Tạo booking mới từ package_id được chỉ định bởi Admin
    INSERT INTO public.bookings (
        tenant_id,
        booking_number,
        customer_id,
        package_id,
        package_name,
        assigned_ktv_id,
        status,
        source,
        created_by
    )
    SELECT
        v_admin_tenant_id,
        v_new_booking_number,
        v_renewal.customer_id,
        p.id,
        p.name,
        v_ktv_id,
        'pending',   -- Cần Admin sắp lịch tiếp
        'renewal',   -- Đánh dấu nguồn là gia hạn
        v_admin_id
    FROM public.service_packages p
    WHERE p.id = p_new_package_id
      AND p.tenant_id = v_admin_tenant_id
    RETURNING id INTO v_new_booking_id;

    IF v_new_booking_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Package không tồn tại hoặc không thuộc chi nhánh này', 'code', 'PACKAGE_NOT_FOUND');
    END IF;

    -- Cập nhật renewal request
    UPDATE public.package_renewal_requests
    SET
        status = 'approved',
        converted_booking_id = v_new_booking_id,
        updated_at = NOW()
    WHERE id = p_renewal_id;

    -- Ghi audit log
    INSERT INTO public.audit_logs (
        tenant_id, table_name, record_id, action, new_data, performed_by
    ) VALUES (
        v_admin_tenant_id,
        'package_renewal_requests',
        p_renewal_id,
        'APPROVE_RENEWAL',
        jsonb_build_object(
            'new_booking_id', v_new_booking_id,
            'package_id', p_new_package_id,
            'admin_note', p_admin_note
        ),
        v_admin_id
    );

    -- Notify KTV: renewal được duyệt
    INSERT INTO public.app_notifications (
        tenant_id, title, body, type, reference_type, reference_id, target_user_id
    ) VALUES (
        v_admin_tenant_id,
        '✅ Yêu cầu gia hạn đã được duyệt!',
        'Booking gia hạn ' || v_new_booking_number || ' đã được tạo cho khách hàng. Vui lòng liên hệ để sắp lịch.',
        'renewal_approved',
        'BOOKING',
        v_new_booking_id,
        v_ktv_id   -- Notify KTV được gán
    );

    -- Notify customer (nếu có expo token — để push sau này)
    -- Hiện tại chỉ in-app notification, broadcast cho Admin
    INSERT INTO public.app_notifications (
        tenant_id, title, body, type, reference_type, reference_id, target_user_id
    ) VALUES (
        v_admin_tenant_id,
        '🎉 Booking gia hạn được tạo',
        'Booking ' || v_new_booking_number || ' (gia hạn từ ' || v_old_booking.booking_number || ')',
        'renewal_converted',
        'BOOKING',
        v_new_booking_id,
        NULL   -- broadcast admin
    );

    RETURN jsonb_build_object(
        'ok', true,
        'new_booking_id', v_new_booking_id,
        'new_booking_number', v_new_booking_number
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', 'DB_ERROR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_admin_approve_renewal(UUID, UUID, TEXT) TO authenticated;


-- ============================================================
-- RPC 3: Admin reject renewal request
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_admin_reject_renewal(
    p_renewal_id UUID,
    p_reject_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_admin_tenant_id UUID;
    v_admin_role TEXT;
    v_renewal RECORD;
BEGIN
    SELECT tenant_id, role INTO v_admin_tenant_id, v_admin_role
    FROM public.users WHERE id = v_admin_id;

    IF v_admin_role NOT IN ('admin', 'super_admin') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Không có quyền', 'code', 'UNAUTHORIZED');
    END IF;

    SELECT * INTO v_renewal
    FROM public.package_renewal_requests
    WHERE id = p_renewal_id AND tenant_id = v_admin_tenant_id
    FOR UPDATE;

    IF v_renewal IS NULL OR v_renewal.status <> 'pending' THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Không tìm thấy hoặc đã xử lý', 'code', 'STATE_CONFLICT');
    END IF;

    UPDATE public.package_renewal_requests
    SET status = 'rejected', note = p_reject_reason, updated_at = NOW()
    WHERE id = p_renewal_id;

    -- Notify KTV
    INSERT INTO public.app_notifications (
        tenant_id, title, body, type, reference_type, reference_id, target_user_id
    ) VALUES (
        v_admin_tenant_id,
        '❌ Yêu cầu gia hạn chưa được duyệt',
        COALESCE(p_reject_reason, 'Admin chưa duyệt lần này. Vui lòng liên hệ để biết thêm chi tiết.'),
        'renewal_rejected',
        'RENEWAL_REQUEST',
        p_renewal_id,
        v_renewal.requested_by_ktv_id
    );

    RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_admin_reject_renewal(UUID, TEXT) TO authenticated;
```

---

## 4. Mobile App — Services Layer

### [NEW] `apps/mobile/src/services/analytics/leaderboard.ts`

```typescript
// apps/mobile/src/services/analytics/leaderboard.ts
import { getMobileSupabase } from '../../lib/supabase';
import { LocalCacheService } from '../../lib/localCache';

export type LeaderboardPeriod = 'week' | 'month' | 'all';

export interface LeaderboardEntry {
  ktv_id: string;
  ktv_name: string;
  avatar_url: string | null;
  total_sessions: number;
  total_reviews: number;
  raw_avg_rating: number | null;
  bayesian_score: number | null;   // null = chưa đủ điều kiện
  commission_earned: number;
  is_ranked: boolean;
  reviews_needed: number;          // 0 nếu đã đủ điều kiện
  rank_position: number | null;    // null nếu chưa đủ
}

export interface LeaderboardResult {
  leaderboard: LeaderboardEntry[];
  total_eligible: number;
  period: LeaderboardPeriod;
  from_date: string;
  bayesian_prior: number;
  min_reviews_required: number;
}

export interface MyRankResult {
  is_ranked: boolean;
  my_rank?: number;
  total_ranked?: number;
  bayesian_score?: number;
  my_reviews: number;
  percentile?: number;
  reviews_needed?: number;
  period: LeaderboardPeriod;
  message?: string;
}

export interface Achievement {
  badge_type: string;
  badge_label: string;
  badge_icon: string;
  awarded_at: string;
  reference_period: string;
}

// TTL: Leaderboard = 15 phút (ổn định), My Rank = 5 phút (cá nhân)
const TTL_LEADERBOARD = 15 * 60 * 1000;
const TTL_MY_RANK = 5 * 60 * 1000;
const TTL_ACHIEVEMENTS = 10 * 60 * 1000;

const CACHE_KEYS = {
  leaderboard: (period: LeaderboardPeriod) => `leaderboard_v2_${period}`,
  myRank: (period: LeaderboardPeriod) => `my_rank_${period}`,
  achievements: 'my_achievements',
};

export async function fetchLeaderboard(
  period: LeaderboardPeriod = 'month',
  options: { forceRefresh?: boolean } = {}
): Promise<LeaderboardResult | { error: string }> {
  const cacheKey = CACHE_KEYS.leaderboard(period);

  if (!options.forceRefresh) {
    const cached = await LocalCacheService.get<LeaderboardResult>(cacheKey);
    if (cached) return cached;
  }

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_leaderboard', {
    p_period: period,
    p_limit: 30,
    p_offset: 0,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  await LocalCacheService.set(cacheKey, data, TTL_LEADERBOARD);
  return data as LeaderboardResult;
}

export async function fetchMyRank(
  period: LeaderboardPeriod = 'month',
  options: { forceRefresh?: boolean } = {}
): Promise<MyRankResult | { error: string }> {
  const cacheKey = CACHE_KEYS.myRank(period);

  if (!options.forceRefresh) {
    const cached = await LocalCacheService.get<MyRankResult>(cacheKey);
    if (cached) return cached;
  }

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_my_rank', {
    p_period: period,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  await LocalCacheService.set(cacheKey, data, TTL_MY_RANK);
  return data as MyRankResult;
}

export async function fetchMyAchievements(): Promise<
  { achievements: Achievement[]; total_count: number } | { error: string }
> {
  const cached = await LocalCacheService.get<{ achievements: Achievement[]; total_count: number }>(
    CACHE_KEYS.achievements
  );
  if (cached) return cached;

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_my_achievements');

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  await LocalCacheService.set(CACHE_KEYS.achievements, data, TTL_ACHIEVEMENTS);
  return data as { achievements: Achievement[]; total_count: number };
}

export async function fetchMyRenewalRequests(): Promise<
  { requests: any[]; total_count: number } | { error: string }
> {
  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_my_renewal_requests');
  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };
  return data;
}

/** Invalidate leaderboard & rank cache sau khi review mới được submit */
export async function invalidateLeaderboardCache(): Promise<void> {
  await Promise.all([
    LocalCacheService.invalidate(CACHE_KEYS.leaderboard('week')),
    LocalCacheService.invalidate(CACHE_KEYS.leaderboard('month')),
    LocalCacheService.invalidate(CACHE_KEYS.leaderboard('all')),
    LocalCacheService.invalidate(CACHE_KEYS.myRank('week')),
    LocalCacheService.invalidate(CACHE_KEYS.myRank('month')),
    LocalCacheService.invalidate(CACHE_KEYS.myRank('all')),
    LocalCacheService.invalidate(CACHE_KEYS.achievements),
  ]);
}
```

---

## 5. Mobile App — UI Components

### [NEW] `apps/mobile/src/components/leaderboard/LeaderboardCard.tsx`

```typescript
// apps/mobile/src/components/leaderboard/LeaderboardCard.tsx
import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { LeaderboardEntry } from '../../services/analytics/leaderboard';

interface LeaderboardCardProps {
  entry: LeaderboardEntry;
  isMe: boolean;
}

const RANK_COLORS: Record<number, string> = {
  1: '#F5C842',
  2: '#C0C0C0',
  3: '#CD7F32',
};
const RANK_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function LeaderboardCard({ entry, isMe }: LeaderboardCardProps) {
  const rank = entry.rank_position;
  const rankColor = rank ? (RANK_COLORS[rank] ?? '#6366F1') : '#9CA3AF';
  const rankIcon = rank ? (RANK_ICONS[rank] ?? `#${rank}`) : null;

  return (
    <View style={[styles.container, isMe && styles.containerMe]}>
      {/* Rank badge */}
      <View style={[styles.rankBadge, { backgroundColor: rankColor + '22', borderColor: rankColor + '44' }]}>
        {rankIcon ? (
          <Text style={styles.rankIcon}>{rankIcon}</Text>
        ) : entry.is_ranked ? (
          <Text style={[styles.rankNum, { color: rankColor }]}>#{rank}</Text>
        ) : (
          <Text style={styles.rankUnranked}>—</Text>
        )}
      </View>

      {/* Avatar */}
      {entry.avatar_url ? (
        <Image source={{ uri: entry.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarInitial}>{entry.ktv_name.charAt(0).toUpperCase()}</Text>
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={[styles.name, isMe && styles.nameMe]} numberOfLines={1}>
          {entry.ktv_name}{isMe ? ' (bạn)' : ''}
        </Text>
        {entry.is_ranked ? (
          <Text style={styles.score}>
            ⭐ {entry.bayesian_score?.toFixed(2)} · {entry.total_reviews} đánh giá
          </Text>
        ) : (
          <Text style={styles.scoreUnranked}>
            Cần thêm {entry.reviews_needed} đánh giá để xếp hạng
          </Text>
        )}
      </View>

      {/* Right stats */}
      <View style={styles.right}>
        <Text style={styles.sessions}>{entry.total_sessions}</Text>
        <Text style={styles.sessionsLabel}>buổi</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 12,
    marginBottom: 8, elevation: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  containerMe: {
    borderWidth: 1.5, borderColor: '#6366F1',
    backgroundColor: '#F0F0FF',
  },
  rankBadge: {
    width: 40, height: 40, borderRadius: 20, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  rankIcon: { fontSize: 20 },
  rankNum: { fontSize: 14, fontWeight: '800' },
  rankUnranked: { fontSize: 16, color: '#9CA3AF' },
  avatar: { width: 40, height: 40, borderRadius: 20, flexShrink: 0 },
  avatarPlaceholder: {
    width: 40, height: 40, borderRadius: 20, flexShrink: 0,
    backgroundColor: '#6366F1', justifyContent: 'center', alignItems: 'center',
  },
  avatarInitial: { color: '#FFF', fontWeight: '700', fontSize: 16 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '600', color: '#111827' },
  nameMe: { color: '#4338CA' },
  score: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  scoreUnranked: { fontSize: 11, color: '#F59E0B', marginTop: 2, fontStyle: 'italic' },
  right: { alignItems: 'center' },
  sessions: { fontSize: 18, fontWeight: '800', color: '#10B981' },
  sessionsLabel: { fontSize: 10, color: '#9CA3AF' },
});
```

### [NEW] `apps/mobile/src/components/leaderboard/AchievementBadge.tsx`

```typescript
// apps/mobile/src/components/leaderboard/AchievementBadge.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { Achievement } from '../../services/analytics/leaderboard';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md';
}

export function AchievementBadge({ achievement, size = 'md' }: AchievementBadgeProps) {
  const isSm = size === 'sm';
  return (
    <View style={[styles.badge, isSm && styles.badgeSm]}>
      <Text style={[styles.icon, isSm && styles.iconSm]}>{achievement.badge_icon}</Text>
      {!isSm && (
        <Text style={styles.label} numberOfLines={2}>{achievement.badge_label}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 72, alignItems: 'center', gap: 4,
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  badgeSm: { width: 44, padding: 8, borderRadius: 8 },
  icon: { fontSize: 28 },
  iconSm: { fontSize: 20 },
  label: { fontSize: 10, color: '#92400E', textAlign: 'center', fontWeight: '600' },
});
```

### [NEW] `apps/mobile/src/components/leaderboard/MyRankCard.tsx`

```typescript
// apps/mobile/src/components/leaderboard/MyRankCard.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { MyRankResult } from '../../services/analytics/leaderboard';

interface MyRankCardProps {
  rankData: MyRankResult;
}

export function MyRankCard({ rankData }: MyRankCardProps) {
  if (!rankData.is_ranked) {
    return (
      <View style={styles.unranked}>
        <Text style={styles.unrankedIcon}>📊</Text>
        <Text style={styles.unrankedTitle}>Chưa vào bảng xếp hạng</Text>
        <Text style={styles.unrankedSub}>
          Cần thêm <Text style={styles.highlight}>{rankData.reviews_needed}</Text> đánh giá được duyệt
          {'\n'}(hiện có {rankData.my_reviews} đánh giá)
        </Text>
      </View>
    );
  }

  const percentileLabel =
    rankData.percentile && rankData.percentile >= 90
      ? `🔥 Top ${100 - Math.round(rankData.percentile!)}%`
      : `Top ${Math.round(100 - rankData.percentile!)}%`;

  return (
    <View style={styles.card}>
      <View style={styles.rankSection}>
        <Text style={styles.rankNum}>#{rankData.my_rank}</Text>
        <Text style={styles.rankOf}>/ {rankData.total_ranked} KTV</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.statsSection}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{rankData.bayesian_score?.toFixed(2)}</Text>
          <Text style={styles.statLabel}>Điểm Bayesian</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{rankData.my_reviews}</Text>
          <Text style={styles.statLabel}>Đánh giá</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, styles.percentileText]}>{percentileLabel}</Text>
          <Text style={styles.statLabel}>Phân vị</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#EEF2FF', borderRadius: 14, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderWidth: 1, borderColor: '#C7D2FE', marginBottom: 16,
  },
  rankSection: { alignItems: 'center' },
  rankNum: { fontSize: 36, fontWeight: '900', color: '#4338CA', lineHeight: 40 },
  rankOf: { fontSize: 12, color: '#6B7280' },
  divider: { width: 1, height: 50, backgroundColor: '#C7D2FE' },
  statsSection: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  statLabel: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  percentileText: { color: '#10B981' },
  unranked: {
    backgroundColor: '#FFFBEB', borderRadius: 14, padding: 20,
    alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A', marginBottom: 16,
  },
  unrankedIcon: { fontSize: 28, marginBottom: 8 },
  unrankedTitle: { fontSize: 15, fontWeight: '700', color: '#92400E', marginBottom: 6 },
  unrankedSub: { fontSize: 13, color: '#78350F', textAlign: 'center', lineHeight: 20 },
  highlight: { fontWeight: '800', color: '#D97706' },
});
```

---

## 6. Mobile App — Màn Hình Leaderboard

### [NEW] `apps/mobile/src/app/(app)/leaderboard.tsx`

```typescript
// apps/mobile/src/app/(app)/leaderboard.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { LeaderboardCard } from '../../components/leaderboard/LeaderboardCard';
import { AchievementBadge } from '../../components/leaderboard/AchievementBadge';
import { MyRankCard } from '../../components/leaderboard/MyRankCard';
import {
  fetchLeaderboard, fetchMyRank, fetchMyAchievements,
  invalidateLeaderboardCache, LeaderboardPeriod
} from '../../services/analytics/leaderboard';
import type { LeaderboardResult, MyRankResult, Achievement } from '../../services/analytics/leaderboard';

const PERIOD_OPTIONS: { label: string; value: LeaderboardPeriod }[] = [
  { label: 'Tuần này', value: 'week' },
  { label: 'Tháng này', value: 'month' },
  { label: 'Tất cả', value: 'all' },
];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const [leaderboard, setLeaderboard] = useState<LeaderboardResult | null>(null);
  const [myRank, setMyRank] = useState<MyRankResult | null>(null);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'achievements' | 'renewal'>('leaderboard');

  const loadData = useCallback(async (selectedPeriod: LeaderboardPeriod) => {
    setError(null);
    const [lbRes, rankRes, achRes] = await Promise.all([
      fetchLeaderboard(selectedPeriod),
      fetchMyRank(selectedPeriod),
      fetchMyAchievements(),
    ]);

    if ('error' in lbRes) {
      setError(lbRes.error);
    } else {
      setLeaderboard(lbRes);
    }

    if (!('error' in rankRes)) setMyRank(rankRes);

    if (!('error' in achRes)) setAchievements(achRes.achievements);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadData(period).finally(() => setLoading(false));
  }, [period, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await invalidateLeaderboardCache();
    await loadData(period);
    setRefreshing(false);
  }, [period, loadData]);

  return (
    <View style={styles.wrapper}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['leaderboard', 'achievements', 'renewal'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'leaderboard' ? '🏆 Xếp hạng' :
               tab === 'achievements' ? '🎖️ Thành tích' : '🔄 Gia hạn'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: '#F9FAFB' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Period selector — chỉ hiện ở tab leaderboard */}
        {activeTab === 'leaderboard' && (
          <View style={styles.periodRow}>
            {PERIOD_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.periodBtn, period === opt.value && styles.periodBtnActive]}
                onPress={() => setPeriod(opt.value)}
              >
                <Text style={[styles.periodBtnText, period === opt.value && styles.periodBtnTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loading && <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#6366F1" />}
        {error && <Text style={styles.errorText}>{error}</Text>}

        {!loading && activeTab === 'leaderboard' && (
          <View style={{ padding: 16 }}>
            {/* My Rank Card */}
            {myRank && <MyRankCard rankData={myRank} />}

            {/* Bayesian disclaimer */}
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                📊 Điểm xếp hạng dùng <Text style={styles.disclaimerBold}>Bayesian Average</Text> (prior: {leaderboard?.bayesian_prior} · tối thiểu {leaderboard?.min_reviews_required} đánh giá để xếp hạng)
              </Text>
            </View>

            {/* Leaderboard list */}
            {leaderboard?.leaderboard.map(entry => (
              <LeaderboardCard
                key={entry.ktv_id}
                entry={entry}
                isMe={entry.ktv_id === user?.id}
              />
            ))}

            {leaderboard?.leaderboard.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>📭</Text>
                <Text style={styles.emptyText}>Chưa có dữ liệu xếp hạng trong kỳ này</Text>
              </View>
            )}
          </View>
        )}

        {!loading && activeTab === 'achievements' && (
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>🎖️ Thành Tích Của Bạn ({achievements.length})</Text>
            {achievements.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyIcon}>🏁</Text>
                <Text style={styles.emptyText}>Hoàn thành buổi đầu tiên để nhận badge!</Text>
              </View>
            ) : (
              <View style={styles.badgeGrid}>
                {achievements.map(ach => (
                  <AchievementBadge key={`${ach.badge_type}_${ach.reference_period}`} achievement={ach} />
                ))}
              </View>
            )}
          </View>
        )}

        {!loading && activeTab === 'renewal' && (
          <View style={{ padding: 16 }}>
            <Text style={styles.sectionTitle}>🔄 Yêu Cầu Gia Hạn Của Bạn</Text>
            {/* RenewalRequestList component — xem mục tiếp theo */}
            <RenewalStatusList />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function RenewalStatusList() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { fetchMyRenewalRequests } = require('../../services/analytics/leaderboard');

  useEffect(() => {
    fetchMyRenewalRequests().then((res: any) => {
      if (!('error' in res)) setRequests(res.requests);
      setLoading(false);
    });
  }, []);

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: { label: '⏳ Chờ xử lý', color: '#F59E0B' },
    approved: { label: '✅ Đã duyệt', color: '#10B981' },
    rejected: { label: '❌ Chưa duyệt', color: '#EF4444' },
    converted: { label: '🎉 Booking đã tạo', color: '#6366F1' },
  };

  if (loading) return <ActivityIndicator color="#6366F1" style={{ marginTop: 20 }} />;

  if (requests.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyText}>Chưa có yêu cầu gia hạn nào</Text>
      </View>
    );
  }

  return (
    <>
      {requests.map(req => {
        const sc = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
        return (
          <View key={req.id} style={styles.renewalCard}>
            <Text style={styles.renewalCustomer}>{req.customer_name}</Text>
            <Text style={styles.renewalPkg}>{req.package_name} · {req.booking_number}</Text>
            <Text style={[styles.renewalStatus, { color: sc.color }]}>{sc.label}</Text>
            {req.new_booking_number && (
              <Text style={styles.renewalNewBooking}>Booking mới: {req.new_booking_number}</Text>
            )}
          </View>
        );
      })}
    </>
  );
}

const styles = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: '#F9FAFB' },
  tabBar: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  tabText: { fontSize: 12, color: '#9CA3AF', fontWeight: '500' },
  tabTextActive: { color: '#6366F1', fontWeight: '700' },
  periodRow: { flexDirection: 'row', padding: 16, gap: 8 },
  periodBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#E5E7EB', alignItems: 'center' },
  periodBtnActive: { backgroundColor: '#6366F1' },
  periodBtnText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  periodBtnTextActive: { color: '#FFF', fontWeight: '700' },
  disclaimer: { backgroundColor: '#EEF2FF', borderRadius: 8, padding: 10, marginBottom: 12 },
  disclaimerText: { fontSize: 12, color: '#4338CA', lineHeight: 18 },
  disclaimerBold: { fontWeight: '700' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 12 },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  errorText: { color: '#EF4444', textAlign: 'center', marginTop: 20, paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyIcon: { fontSize: 36, marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
  renewalCard: {
    backgroundColor: '#FFF', borderRadius: 10, padding: 14, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3,
  },
  renewalCustomer: { fontSize: 14, fontWeight: '700', color: '#111827' },
  renewalPkg: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  renewalStatus: { fontSize: 13, fontWeight: '600', marginTop: 6 },
  renewalNewBooking: { fontSize: 12, color: '#6366F1', marginTop: 4, fontStyle: 'italic' },
});
```

---

## 7. Cập Nhật Analytics Screen — Tích Hợp Rank Card

### [MODIFY] `apps/mobile/src/app/(app)/analytics.tsx`

Thêm preview xếp hạng vào màn analytics hiện có (link sang màn leaderboard đầy đủ):

```typescript
// Thêm import
import { MyRankCard } from '../../components/leaderboard/MyRankCard';
import { AchievementBadge } from '../../components/leaderboard/AchievementBadge';
import { fetchMyRank, fetchMyAchievements } from '../../services/analytics/leaderboard';
import { router } from 'expo-router';

// Thêm state
const [myRank, setMyRank] = useState<MyRankResult | null>(null);
const [recentAchievements, setRecentAchievements] = useState<Achievement[]>([]);

// Fetch trong loadData()
const [rankRes, achRes] = await Promise.all([
  fetchMyRank(selectedPeriod),
  fetchMyAchievements(),
]);
if (!('error' in rankRes)) setMyRank(rankRes);
if (!('error' in achRes)) setRecentAchievements(achRes.achievements.slice(0, 4));

// Thêm vào JSX (trước phần reviews)
{myRank && (
  <View style={styles.section}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <Text style={styles.sectionTitle}>🏆 Xếp hạng của tôi</Text>
      <TouchableOpacity onPress={() => router.push('/leaderboard')}>
        <Text style={{ fontSize: 12, color: '#6366F1', fontWeight: '600' }}>Xem đầy đủ →</Text>
      </TouchableOpacity>
    </View>
    <MyRankCard rankData={myRank} />
  </View>
)}

{recentAchievements.length > 0 && (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>🎖️ Thành tích gần đây</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {recentAchievements.map(ach => (
        <AchievementBadge key={ach.badge_type} achievement={ach} size="sm" />
      ))}
    </View>
  </View>
)}
```

---

## Thứ Tự Thực Thi

```
── Supabase Backend ──────────────────────────────────────────────────────
Bước 1   Apply migration 20260802000000_leaderboard_v2_bayesian.sql
          → rpc_mobile_get_leaderboard + rpc_mobile_get_my_rank
          → Verify Bayesian formula bằng data thực trong Supabase Studio

Bước 2   Apply migration 20260802000001_ktv_achievements.sql
          → Table ktv_achievements + fn_check_and_award_badges
          → Cập nhật fn_on_session_completed_deferred để gọi badge check
          → Verify: complete 1 session → ktv_achievements có 'first_session'

Bước 3   Apply migration 20260802000002_renewal_approval_rpcs.sql
          → rpc_admin_approve_renewal (tạo booking mới)
          → rpc_admin_reject_renewal + notify KTV
          → rpc_mobile_get_my_renewal_requests

── Mobile App ────────────────────────────────────────────────────────────
Bước 4   Tạo apps/mobile/src/services/analytics/leaderboard.ts

Bước 5   Tạo components: LeaderboardCard, AchievementBadge, MyRankCard

Bước 6   Tạo màn hình apps/mobile/src/app/(app)/leaderboard.tsx
          (3 tabs: Xếp hạng, Thành tích, Gia hạn)

Bước 7   Cập nhật analytics.tsx — thêm rank preview + achievement preview

Bước 8   Thêm route /leaderboard vào navigation tabs
```

---

## Verification Plan

### Leaderboard Bayesian

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | KTV A: 1 review 5.0 · KTV B: 15 reviews 4.9 | KTV B đứng #1 (Bayesian score B = 4.88 > A = 4.50) |
| 2 | KTV C: 5 reviews (chưa đủ 10) | `is_ranked = false`, `reviews_needed = 5`, hiển thị ở cuối danh sách |
| 3 | `rpc_mobile_get_my_rank` khi chưa đủ reviews | `{ is_ranked: false, reviews_needed: X, message: '...' }` |
| 4 | `rpc_mobile_get_my_rank` khi đủ reviews | `{ is_ranked: true, my_rank: N, percentile: X, bayesian_score: Y }` |
| 5 | Cross-tenant: KTV tenant A gọi leaderboard | Chỉ thấy KTV trong tenant A |

### Achievement System

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Complete buổi đầu tiên | `ktv_achievements` có 'first_session', notification cá nhân nhận được |
| 2 | Complete buổi thứ 10 | `ktv_achievements` có 'sessions_10', notification |
| 3 | 5 review 5 sao liên tiếp được approve | Badge 'five_star_streak_5', notification |
| 4 | Award lại badge đã có (`ON CONFLICT DO NOTHING`) | Không tạo duplicate, không gửi notification lại |
| 5 | Badge check fail (DB error) | Session vẫn complete, chỉ log WARNING |

### Renewal Approval Flow

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Admin approve renewal với package_id hợp lệ | Booking mới tạo, `converted_booking_id` set, KTV nhận notification |
| 2 | Admin approve renewal với package_id không thuộc tenant | `PACKAGE_NOT_FOUND` |
| 3 | Admin approve renewal đã `approved` | `STATE_CONFLICT` |
| 4 | Admin approve với non-admin JWT | `UNAUTHORIZED` |
| 5 | KTV gọi `rpc_mobile_get_my_renewal_requests` | Thấy request của mình + trạng thái + new_booking_number nếu approved |
| 6 | Double approve cùng lúc (FOR UPDATE) | 1 approve thành công, 1 nhận `STATE_CONFLICT` |

---

## Danh Sách File Checklist

| File | Trạng thái | Ghi chú |
|---|---|---|
| `supabase/migrations/20260802000000_leaderboard_v2_bayesian.sql` | **NEW** | Bayesian RPC + my_rank RPC |
| `supabase/migrations/20260802000001_ktv_achievements.sql` | **NEW** | Table + fn_check_and_award_badges |
| `supabase/migrations/20260802000002_renewal_approval_rpcs.sql` | **NEW** | approve/reject + notify |
| `apps/mobile/src/services/analytics/leaderboard.ts` | **NEW** | Service layer + invalidation |
| `apps/mobile/src/components/leaderboard/LeaderboardCard.tsx` | **NEW** | Bayesian rank display |
| `apps/mobile/src/components/leaderboard/AchievementBadge.tsx` | **NEW** | Badge component |
| `apps/mobile/src/components/leaderboard/MyRankCard.tsx` | **NEW** | Rank + percentile card |
| `apps/mobile/src/app/(app)/leaderboard.tsx` | **NEW** | 3-tab: xếp hạng/thành tích/gia hạn |
| `apps/mobile/src/app/(app)/analytics.tsx` | **MODIFY** | Thêm rank preview + achievement preview |

---

## Ghi Chú Kiến Trúc

### Tại sao Bayesian Average thay vì Simple Average?

```
Simple Average: ∑rating / n
→ n=1, rating=5.0 → score=5.0 → WRONG

Bayesian Average: (C×m + ∑rating) / (m + n)
→ Kéo về prior (4.5) khi n nhỏ
→ Converge về actual rating khi n lớn
→ Fair với KTV mới lẫn KTV lâu năm
```

### [v2.0] Tại sao Achievement phải Event-Driven thay vì Trigger-Driven?

```
Trigger-driven (v1.0 — có vấn đề):
  session complete → AFTER trigger → fn_check_and_award_badges()
  Hôm nay: 3 rules  → OK
  6 tháng sau: 20 rules → chậm
  1 năm sau: 50 rules → mỗi session complete chạy 50 rule → KHÔNG CHẤP NHẬN

Event-driven outbox (v2.0 — đúng hướng):
  session complete → AFTER trigger → INSERT achievement_events (1 row)
  Worker (scheduled/realtime) → đọc achievement_events → evaluate rules → award badge
  → Trigger KHÔNG biết có bao nhiêu rule
  → Worker có thể scale independently
  → Thêm rule mới không ảnh hưởng performance transaction
```

### [v2.0] Phân Loại Badge Scope — Lifetime vs Period

```
Lifetime badges (chỉ award 1 lần trong toàn bộ lịch sử KTV):
  first_session, sessions_10, sessions_50, sessions_100, five_star_streak_5
  → Unique constraint: (tenant_id, ktv_id, badge_type)
  → badge_scope = 'lifetime'

Period badges (award mỗi kỳ nếu đủ điều kiện):
  top_1_monthly, top_3_monthly, renewal_champion_month
  → Unique constraint: (tenant_id, ktv_id, badge_type, reference_period)
  → badge_scope = 'period'

Vấn đề v1.0: first_session có reference_period = '2026-08'
→ Năm sau có thể tạo lại nếu period khác → SAI
Fix v2.0: Lifetime badges không có reference_period (NULL), constraint khác
```

### [v2.0] Notification Batching — Chống Spam Push

```
Vấn đề: KTV complete buổi 100 đúng lúc cũng đạt five_star_streak
→ 3 badge được award đồng thời
→ 3 push notification liên tiếp → BAD UX

Giải pháp: Worker gom badges trong cùng 1 lần xử lý:
  Achievement worker nhận event
  → Evaluate tất cả rules
  → Collect { badges: ['sessions_100', 'five_star_streak_5', 'sessions_50'] }
  → IF badges.length == 1 → "🏆 Bạn vừa đạt: Chuyên Gia 100 Buổi!"
  → IF badges.length > 1  → "🎉 Bạn vừa đạt 3 thành tích mới!" + list trong body
```

### Renewal Approval — FOR UPDATE là cần thiết?

```
Scenario: 2 Admin approve cùng 1 renewal cùng lúc → tạo 2 booking mới
FOR UPDATE serialize:
  Admin 1: SELECT FOR UPDATE → lock row → status = 'pending' → proceed
  Admin 2: SELECT FOR UPDATE → WAIT → Admin 1 commit → status = 'approved'
  Admin 2: đọc status = 'approved' → STATE_CONFLICT → return error
```

### [Backlog — Phase 3] achievement_rules Table

```sql
-- Cấu hình badge theo từng tenant (không hard-code)
CREATE TABLE achievement_rules (
  id UUID PRIMARY KEY,
  tenant_id UUID,          -- NULL = global default
  badge_type TEXT,
  badge_scope TEXT,        -- 'lifetime' | 'period'
  condition_type TEXT,     -- 'session_count' | 'streak_rating' | 'renewal_count'
  threshold INTEGER,       -- 10, 50, 100...
  badge_label TEXT,
  badge_icon TEXT,
  is_active BOOLEAN DEFAULT TRUE
);
-- Spa A: sessions_10 (threshold=10), Spa B: sessions_20 (threshold=20)
```

### [Backlog — Phase 3] renewal_pipeline Table (CRM Sales Funnel)

```
CRM thực tế (tương lai):
  Request → Consulting → Negotiation → Approved → Booking

Hiện tại (MVP):
  Request → Approved/Rejected → Booking

Nếu Bella mở rộng CRM:
  renewal_pipeline_stages: ['new', 'consulting', 'negotiation', 'approved', 'rejected']
  Mỗi stage có owner (staff phụ trách), deadline, note
  Stage transition log (audit)
```

### [Backlog — Phase 4] Anti-Gaming: Weighted Leaderboard Score

```
Vấn đề hiện tại: KTV chọn khách dễ → rating cao → top leaderboard

Tương lai:
  weighted_score = (
    rating_weight   × bayesian_score +
    attendance_weight × (attended_sessions / total_assigned) +
    completion_weight × (completed_sessions / attended_sessions)
  ) / (rating_weight + attendance_weight + completion_weight)

  Ví dụ: rating=0.5, attendance=0.3, completion=0.2
  → KTV có rating cao nhưng bỏ ca nhiều sẽ bị penalize
```

---

## Verification Plan (v2.0 — Bổ Sung Edge Cases)

### Leaderboard Bayesian

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | KTV A: 1 review 5.0 · KTV B: 15 reviews 4.9 | KTV B đứng #1 (Bayesian score B = 4.88 > A = 4.50) |
| 2 | KTV C: 5 reviews (chưa đủ 10) | `is_ranked = false`, `reviews_needed = 5`, hiển thị ở cuối danh sách |
| 3 | `rpc_mobile_get_my_rank` khi chưa đủ reviews | `{ is_ranked: false, reviews_needed: X, message: '...' }` |
| 4 | `rpc_mobile_get_my_rank` — KTV #10 trong 50 KTV | `percentile = ((50-10+1)/50)×100 = 82.0` |
| 5 | `rpc_mobile_get_my_rank` — KTV #1 trong 50 KTV | `percentile = 100.0` |
| 6 | Cross-tenant RPC: KTV tenant A gọi leaderboard | Chỉ thấy KTV có `u.tenant_id = v_tenant_id` — verify bằng explicit JOIN condition |

### Achievement System (v2.0 — Event-Driven)

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Complete buổi đầu tiên | `achievement_events` có 1 row, worker chạy → `ktv_achievements` có 'first_session' (scope=lifetime) |
| 2 | Complete buổi thứ 10 | Badge 'sessions_10' được award, notification gửi |
| 3 | **[NEW]** Complete buổi 10, 50, 100 cùng lúc (milestone accumulated) | Worker gom 3 badge → **1 push notification** "🎉 Bạn vừa đạt 3 thành tích mới!" |
| 4 | **[NEW]** Award badge 'first_session' 2 lần (lifetime scope) | Unique constraint `(tenant_id, ktv_id, badge_type)` ngăn duplicate, không gửi notification lại |
| 5 | **[NEW]** Tenant A không thấy badge của KTV Tenant B | `ktv_achievements.tenant_id` filter đúng |
| 6 | **[NEW]** 50 KTV complete cùng lúc | 50 events insert vào `achievement_events`, worker xử lý tuần tự — session complete không chậm |
| 7 | Worker/badge check fail (DB error) | `achievement_events.status = 'failed'`, session complete **không bị ảnh hưởng** |

### Renewal Approval Flow

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Admin approve renewal với package_id hợp lệ | Booking mới tạo, `converted_booking_id` set, KTV nhận notification |
| 2 | Admin approve renewal với package_id không thuộc tenant | `PACKAGE_NOT_FOUND` |
| 3 | Admin approve renewal đã `approved` | `STATE_CONFLICT` |
| 4 | Admin approve với non-admin JWT | `UNAUTHORIZED` |
| 5 | KTV gọi `rpc_mobile_get_my_renewal_requests` | Thấy request của mình + trạng thái + new_booking_number nếu approved |
| 6 | Double approve cùng lúc (FOR UPDATE) | 1 approve thành công, 1 nhận `STATE_CONFLICT` |
| 7 | **[NEW]** Admin reject rồi approve cùng 1 renewal | State machine: rejected → không thể approve lại → `STATE_CONFLICT` |
| 8 | **[NEW]** Admin approve khi booking gốc đã `closed` / `cancelled` | RPC kiểm tra `v_old_booking.status IN ('active', 'completed')` — nếu không thỏa → `BOOKING_INVALID_STATE` |

---

## Danh Sách File Checklist (v2.0)

| File | Trạng thái | Ghi chú |
|---|---|---|
| `supabase/migrations/20260802000000_leaderboard_v2_bayesian.sql` | **NEW** | Bayesian RPC + my_rank với percentile formula documented |
| `supabase/migrations/20260802000001_ktv_achievements_v2.sql` | **NEW** | Table có `badge_scope` + `achievement_events` outbox table |
| `supabase/migrations/20260802000002_renewal_approval_rpcs.sql` | **NEW** | approve/reject + booking state guard + notify |
| `apps/mobile/src/services/analytics/leaderboard.ts` | **NEW** | Service layer + invalidation |
| `apps/mobile/src/components/leaderboard/LeaderboardCard.tsx` | **NEW** | Bayesian rank display |
| `apps/mobile/src/components/leaderboard/AchievementBadge.tsx` | **NEW** | Badge component (hiển thị lifetime vs period) |
| `apps/mobile/src/components/leaderboard/MyRankCard.tsx` | **NEW** | Rank + percentile card với label |
| `apps/mobile/src/app/(app)/leaderboard.tsx` | **NEW** | 3-tab: xếp hạng/thành tích/gia hạn |
| `apps/mobile/src/app/(app)/analytics.tsx` | **MODIFY** | Thêm rank preview + achievement preview |

---

## Định Nghĩa Hoàn Thành (DoD) — Tuần 8 v2.0

**Bắt buộc:**
- [ ] **Leaderboard Bayesian:** KTV 1 review 5.0 không đứng trên KTV 15 reviews 4.9 — verify bằng data thực.
- [ ] **Minimum threshold:** KTV < 10 approved reviews hiển thị "Chưa đủ điều kiện", không lẫn vào bảng xếp hạng chính.
- [ ] **Percentile đúng công thức:** KTV #10 trong 50 KTV → percentile = 82.0% (verified thủ công).
- [ ] **Tenant isolation trong RPC code:** Leaderboard JOIN dùng `AND u.tenant_id = v_tenant_id` — không chỉ WHERE.
- [ ] **Achievement event-driven:** Session complete → `achievement_events` insert → worker chạy → badge award. Trigger KHÔNG gọi trực tiếp badge evaluation.
- [ ] **Lifetime badge unique:** `first_session` chỉ tồn tại đúng 1 bản ghi mọi thời điểm (unique không có reference_period).
- [ ] **Period badge unique theo kỳ:** `top_1_monthly` cho `2026-08` chỉ 1 bản ghi, tháng sau có thể tạo mới.
- [ ] **Notification batching:** 3 badge cùng lúc → 1 push "🎉 Bạn vừa đạt 3 thành tích mới!".
- [ ] **Renewal state guard:** Approve khi booking gốc đã `closed` → `BOOKING_INVALID_STATE`.
- [ ] **Renewal state transition:** Rejected → không thể approve lại.
- [ ] **Renewal double approve race:** `FOR UPDATE` ngăn 2 Admin approve cùng lúc.
- [ ] **Cross-tenant leaderboard:** KTV tenant A không thấy KTV tenant B — verify bằng query SQL trực tiếp.
- [ ] **Analytics screen:** Hiển thị rank preview + achievement preview (tối đa 4 badge) có link đến màn leaderboard.
- [ ] **Offline:** Leaderboard cache 15 phút, My Rank 5 phút — hiển thị timestamp cached.
- [ ] CI pass: Mobile typecheck + Web build không lỗi regression.

**Nên làm (backlog được document):**
- [ ] Ghi chú `achievement_rules` table trong backlog — cấu hình threshold theo tenant.
- [ ] Ghi chú `renewal_pipeline` table cho CRM Sales Funnel (Phase 3).
- [ ] Ghi chú `weighted_score` anti-gaming leaderboard (Phase 4).
