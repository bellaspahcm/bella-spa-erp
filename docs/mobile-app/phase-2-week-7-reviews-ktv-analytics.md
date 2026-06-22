# Bella ERP Mobile App — Phase 2 Tuần 7: Review System & KTV Analytics Dashboard
## Phiên bản v2.0 — Áp dụng đánh giá kiến trúc

**Ngày tạo:** 2026-06-21 | **Cập nhật:** 2026-06-21 (v2.0)
**Tiền điều kiện:** Phase 2 (Tuần 6) DoD hoàn thành.

---

## Changelog v1.0 → v2.0

| # | Vấn đề | Mức độ | Trạng thái |
|---|---|---|---|
| 1 | **KPI Revenue mơ hồ:** Không định nghĩa rõ "doanh thu cá nhân" là Revenue/Commission/Recognized Revenue | 🔴 Bắt buộc | ✅ Đã định nghĩa công thức rõ ràng |
| 2 | **Tenant isolation:** Review RPC chỉ filter `ktv_id`, thiếu `tenant_id` double-check | 🔴 Bắt buộc | ✅ Đã thêm `AND sr.tenant_id = v_tenant_id` explicit |
| 3 | **Trigger WHEN condition:** Điều kiện chống spam notification nên ở trigger level, không chỉ trong function | 🔴 Bắt buộc | ✅ Đã chuyển thành `WHEN (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted')` |
| 4 | **Thiếu test cross-tenant:** Review từ tenant A không được xuất hiện ở tenant B | 🔴 Bắt buộc | ✅ Đã thêm vào Verification Plan |
| 5 | **TTL đồng nhất:** Tất cả dùng 15 phút — KPI personal nên ngắn hơn | 🟡 Nên làm | ✅ Tách: KPI=3 phút, Reviews=5 phút, Leaderboard=15 phút, BookingProgress=2 phút |
| 6 | **Cache invalidation thiếu:** Review submit chưa invalidate KPI cache | 🟡 Nên làm | ✅ Realtime subscription → invalidate KPI khi có review mới |
| 7 | **"Gia hạn gói" chưa có workflow:** Chỉ là notification, mất context | 🟡 Nên làm | ✅ Thêm bảng `package_renewal_requests` + migration |
| 8 | **Offline analytics hiển thị trắng:** Không có fallback cache khi offline | 🟡 Nên làm | ✅ Hiển thị cached data + "Cập nhật lần cuối: ..." |
| 9 | **Leaderboard fairness:** KTV 1 review 5.0 đứng đầu hơn KTV 200 reviews 4.9 | 🟡 Nên làm | ✅ Ghi chú threshold minimum + Bayesian note |

---

## Tổng Quan & Mục Tiêu

Tuần 7 hoàn thiện vòng lặp phản hồi dịch vụ (CRM Feedback Loop):

```
Session hoàn thành
  ↓ [Trigger Tuần 6]
Review placeholder (pending_review)
  ↓ [Khách submit qua Portal]
KTV nhận notification cá nhân hóa
  ↓ [Realtime subscription]
KPI cache invalidate → Analytics cập nhật
  ↓
Leaderboard thay đổi
```

**3 mảng chính:**
1. **Review System:** RPC phân quyền đúng tenant isolation, notification trigger hardened
2. **KTV Analytics Dashboard:** KPI theo kỳ với TTL cache riêng, hiển thị offline graceful
3. **Booking Progress + Renewal Request:** Progress bar từ derived COUNT(*), workflow gia hạn có table riêng

---

## 1. Supabase Backend — Review RPCs (Đã Hardened)

### [NEW] `20260726000000_mobile_review_rpcs.sql`

> **Thay đổi v2.0:**
> - RPC 1: Thêm explicit `AND sr.tenant_id = v_tenant_id` — double-check isolation
> - RPC 2: Định nghĩa rõ `commission_earned` (không phải revenue gộp)
> - RPC 3: Không thay đổi (đã dùng COUNT(*) từ v1.0)

```sql
-- supabase/migrations/20260726000000_mobile_review_rpcs.sql

-- ============================================================
-- RPC 1: Lấy danh sách review của KTV hiện tại
-- FIX v2: Double-filter tenant_id + ktv_id (không chỉ ktv_id)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_my_reviews(
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS JSONB AS $$
DECLARE
    v_ktv_id UUID := auth.uid();
    v_tenant_id UUID;
    v_result JSONB;
BEGIN
    -- Đọc tenant của user hiện tại
    SELECT tenant_id INTO v_tenant_id
    FROM public.users
    WHERE id = v_ktv_id;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Không xác định được chi nhánh', 'code', 'AUTH_ERROR');
    END IF;

    SELECT jsonb_build_object(
        'reviews', COALESCE(
            jsonb_agg(row_to_json(r.*) ORDER BY r.created_at DESC),
            '[]'::jsonb
        ),
        'total_count', COUNT(*) OVER()
    )
    INTO v_result
    FROM (
        SELECT
            sr.id,
            sr.rating,
            sr.note,
            sr.status,
            sr.created_at,
            sr.updated_at,
            sl.session_number,
            sl.assigned_date,
            b.booking_number,
            b.package_name,
            c.full_name AS customer_name
        FROM public.session_reviews sr
        JOIN public.session_logs sl ON sr.session_log_id = sl.id
        JOIN public.bookings b ON sl.booking_id = b.id
        JOIN public.customers c ON b.customer_id = c.id
        WHERE sr.ktv_id = v_ktv_id
          AND sr.tenant_id = v_tenant_id   -- FIX: explicit tenant filter
          AND sl.tenant_id = v_tenant_id   -- FIX: join table cũng filter tenant
          AND b.tenant_id = v_tenant_id
        ORDER BY sr.created_at DESC
        LIMIT p_limit OFFSET p_offset
    ) r;

    RETURN COALESCE(v_result, jsonb_build_object('reviews', '[]'::jsonb, 'total_count', 0));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_my_reviews(INTEGER, INTEGER) TO authenticated;


-- ============================================================
-- RPC 2: KPI tổng hợp của KTV
--
-- ĐỊNH NGHĨA REVENUE KPI (v2.0):
-- ─────────────────────────────
-- ERP spa có 3 khái niệm:
--   A. Gross Revenue (doanh thu gộp): Toàn bộ giá trị booking
--   B. Recognized Revenue (doanh thu ghi nhận): full_price / total_sessions × buổi đã hoàn thành
--   C. commission_earned (hoa hồng KTV): Số tiền KTV thực nhận theo % hợp đồng
--
-- KPI "Hoa hồng" = C (commission_earned) — đây là con số có nghĩa nhất với KTV
-- KTV KHÔNG thể thấy A hay B (dữ liệu kinh doanh nhạy cảm)
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_my_kpi(
    p_period TEXT DEFAULT 'month'  -- 'week' | 'month' | 'all'
)
RETURNS JSONB AS $$
DECLARE
    v_ktv_id UUID := auth.uid();
    v_tenant_id UUID;
    v_from_date DATE;
    v_result JSONB;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_ktv_id;

    IF v_tenant_id IS NULL THEN
        RETURN jsonb_build_object('error', 'Không xác định được chi nhánh', 'code', 'AUTH_ERROR');
    END IF;

    v_from_date := CASE p_period
        WHEN 'week'  THEN DATE_TRUNC('week', CURRENT_DATE)::DATE
        WHEN 'month' THEN DATE_TRUNC('month', CURRENT_DATE)::DATE
        ELSE '2000-01-01'::DATE
    END;

    SELECT jsonb_build_object(
        -- Hiệu suất buổi
        'total_sessions',       COALESCE(COUNT(sl.id), 0),
        'total_checkins',       COALESCE(SUM(CASE WHEN sl.checkin_time IS NOT NULL THEN 1 ELSE 0 END), 0),

        -- KPI doanh thu: commission_earned (hoa hồng KTV thực nhận)
        -- = Recognized Revenue của buổi × commission_rate từ bookings.ktv_commission
        -- KHÔNG phải tổng giá trị booking hay revenue gộp
        'commission_earned',    ROUND(
            COALESCE(SUM(
                (b.full_price * (1 - b.discount_percent / 100.0) / GREATEST(b.total_sessions, 1))
                * (b.ktv_commission / 100.0)
            ), 0)::NUMERIC,
        0),

        -- Rating — chỉ tính review đã được approved (không tính pending/rejected)
        'avg_rating',           ROUND(
            AVG(CASE WHEN sr.status = 'approved' THEN sr.rating ELSE NULL END)::NUMERIC,
        1),
        'total_reviews',        COUNT(DISTINCT sr.id),
        'approved_reviews',     COUNT(DISTINCT CASE WHEN sr.status = 'approved' THEN sr.id END),
        'pending_reviews',      COUNT(DISTINCT CASE WHEN sr.status = 'pending_review' THEN sr.id END),

        'period',               p_period,
        'from_date',            v_from_date,
        'currency',             'VND'
    )
    INTO v_result
    FROM public.session_logs sl
    JOIN public.bookings b ON sl.booking_id = b.id AND b.tenant_id = v_tenant_id
    LEFT JOIN public.session_reviews sr
        ON sr.session_log_id = sl.id
       AND sr.ktv_id = v_ktv_id
       AND sr.tenant_id = v_tenant_id
    WHERE sl.completed_by_ktv_id = v_ktv_id
      AND sl.tenant_id = v_tenant_id
      AND sl.status = 'completed'
      AND sl.completed_date >= v_from_date;

    RETURN COALESCE(v_result, jsonb_build_object(
        'total_sessions', 0, 'total_checkins', 0,
        'commission_earned', 0, 'avg_rating', null,
        'total_reviews', 0, 'approved_reviews', 0, 'pending_reviews', 0,
        'period', p_period, 'from_date', v_from_date, 'currency', 'VND'
    ));
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_my_kpi(TEXT) TO authenticated;


-- ============================================================
-- RPC 3: Tiến độ booking (derived COUNT* — không dùng counter)
-- Không thay đổi so với v1.0 — logic đã đúng
-- ============================================================

CREATE OR REPLACE FUNCTION public.rpc_mobile_get_booking_progress(
    p_booking_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_tenant_id UUID;
    v_result JSONB;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = auth.uid();

    SELECT jsonb_build_object(
        'booking_id',          b.id,
        'booking_number',      b.booking_number,
        'package_name',        b.package_name,
        'total_sessions',      b.total_sessions,
        -- Derived: COUNT(*) từ session_logs — không dùng counter để tránh drift
        'completed_sessions',  (
            SELECT COUNT(*) FROM public.session_logs sl
            WHERE sl.booking_id = b.id
              AND sl.status = 'completed'
              AND sl.tenant_id = v_tenant_id
        ),
        'scheduled_sessions',  (
            SELECT COUNT(*) FROM public.session_logs sl
            WHERE sl.booking_id = b.id
              AND sl.status = 'scheduled'
              AND sl.tenant_id = v_tenant_id
        ),
        'next_session', (
            SELECT row_to_json(ns.*) FROM (
                SELECT id, session_number, assigned_date, assigned_time, status
                FROM public.session_logs
                WHERE booking_id = b.id
                  AND status = 'scheduled'
                  AND tenant_id = v_tenant_id
                ORDER BY session_number ASC
                LIMIT 1
            ) ns
        ),
        'booking_status',      b.status,
        'customer_name',       c.full_name
    )
    INTO v_result
    FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.id = p_booking_id
      AND b.tenant_id = v_tenant_id;

    IF v_result IS NULL THEN
        RETURN jsonb_build_object('error', 'Không tìm thấy booking', 'code', 'NOT_FOUND');
    END IF;

    RETURN v_result;
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_get_booking_progress(UUID) TO authenticated;
```

---

## 2. Supabase Backend — Review Notification Trigger (Hardened)

### [NEW] `20260726000001_review_submitted_notification.sql`

> **Thay đổi v2.0:**
> - `WHEN (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted')` nằm ở **trigger level** — giảm invocation, không vào function nếu condition sai
> - `IS DISTINCT FROM` thay cho `<>` — xử lý đúng cả trường hợp `OLD.status IS NULL`

```sql
-- supabase/migrations/20260726000001_review_submitted_notification.sql

CREATE OR REPLACE FUNCTION public.fn_on_review_submitted_notify_ktv()
RETURNS TRIGGER AS $$
DECLARE
    v_ktv_id UUID;
    v_customer_name TEXT;
    v_session_number INTEGER;
BEGIN
    -- NOTE: Điều kiện status transition đã được kiểm tra ở TRIGGER LEVEL (WHEN clause).
    -- Function này chỉ chạy khi OLD.status IS DISTINCT FROM 'submitted'
    -- và NEW.status = 'submitted'. Không cần check lại trong function.

    v_ktv_id := NEW.ktv_id;

    SELECT c.full_name, sl.session_number
    INTO v_customer_name, v_session_number
    FROM public.session_logs sl
    JOIN public.bookings b ON sl.booking_id = b.id
    JOIN public.customers c ON b.customer_id = c.id
    WHERE sl.id = NEW.session_log_id;

    -- In-app notification cá nhân hóa (target_user_id — chỉ KTV này thấy)
    INSERT INTO public.app_notifications (
        tenant_id,
        title,
        body,
        type,
        reference_type,
        reference_id,
        target_user_id
    ) VALUES (
        NEW.tenant_id,
        '⭐ Khách vừa đánh giá bạn!',
        COALESCE(v_customer_name, 'Khách hàng') ||
            ' đã gửi đánh giá ' || NEW.rating || '/5 cho buổi ' ||
            COALESCE(v_session_number::TEXT, '') || '.',
        'review_received',
        'SESSION_REVIEW',
        NEW.id,
        v_ktv_id   -- Chỉ KTV này nhận, không broadcast toàn tenant
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Notification fail không nên rollback review submit
    RAISE WARNING '[fn_on_review_submitted_notify_ktv] Error for review %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_on_review_submitted_notify ON public.session_reviews;

-- FIX v2: WHEN condition ở trigger level — PostgreSQL không invoke function nếu condition sai
-- IS DISTINCT FROM xử lý đúng cả NULL (OLD.status IS NULL khi insert)
CREATE TRIGGER trig_on_review_submitted_notify
    AFTER UPDATE OF status ON public.session_reviews
    FOR EACH ROW
    WHEN (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted')
    EXECUTE FUNCTION fn_on_review_submitted_notify_ktv();
```

---

## 3. Supabase Backend — Package Renewal Requests

> **Thay đổi v2.0:** "Gia hạn gói" cần table riêng — notification-only dễ mất context.

### [NEW] `20260726000002_package_renewal_requests.sql`

```sql
-- supabase/migrations/20260726000002_package_renewal_requests.sql

CREATE TABLE IF NOT EXISTS public.package_renewal_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id),
    requested_by_ktv_id UUID NOT NULL REFERENCES public.users(id),
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
    note TEXT,
    -- converted_booking_id: Khi Admin tạo booking mới từ request này
    converted_booking_id UUID REFERENCES public.bookings(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: KTV chỉ thấy request của mình; Admin thấy toàn bộ tenant
ALTER TABLE public.package_renewal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ktv_see_own_renewal_requests" ON public.package_renewal_requests
    FOR SELECT USING (
        requested_by_ktv_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
              AND u.tenant_id = package_renewal_requests.tenant_id
              AND u.role IN ('admin', 'super_admin', 'hr')
        )
    );

CREATE POLICY "ktv_create_renewal_request" ON public.package_renewal_requests
    FOR INSERT WITH CHECK (
        requested_by_ktv_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

-- RPC: KTV gửi yêu cầu gia hạn gói
CREATE OR REPLACE FUNCTION public.rpc_mobile_request_renewal(
    p_booking_id UUID,
    p_note TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_ktv_id UUID := auth.uid();
    v_tenant_id UUID;
    v_customer_id UUID;
    v_booking_status TEXT;
    v_renewal_id UUID;
BEGIN
    SELECT tenant_id INTO v_tenant_id FROM public.users WHERE id = v_ktv_id;

    -- Validate booking thuộc tenant
    SELECT customer_id, status
    INTO v_customer_id, v_booking_status
    FROM public.bookings
    WHERE id = p_booking_id AND tenant_id = v_tenant_id;

    IF v_customer_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Không tìm thấy booking', 'code', 'NOT_FOUND');
    END IF;

    -- Tránh tạo trùng request pending
    IF EXISTS (
        SELECT 1 FROM public.package_renewal_requests
        WHERE booking_id = p_booking_id
          AND status = 'pending'
          AND tenant_id = v_tenant_id
    ) THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Đã có yêu cầu gia hạn đang chờ xử lý');
    END IF;

    INSERT INTO public.package_renewal_requests (
        tenant_id, booking_id, customer_id, requested_by_ktv_id, note
    ) VALUES (
        v_tenant_id, p_booking_id, v_customer_id, v_ktv_id, p_note
    )
    RETURNING id INTO v_renewal_id;

    -- Tạo in-app notification cho Admin
    INSERT INTO public.app_notifications (
        tenant_id, title, body, type, reference_type, reference_id,
        target_user_id  -- NULL = broadcast đến Admin của tenant
    )
    SELECT
        v_tenant_id,
        '🔄 Khách muốn gia hạn gói',
        'KTV vừa gửi yêu cầu gia hạn gói cho khách hàng. Vui lòng xem xét.',
        'renewal_request',
        'RENEWAL_REQUEST',
        v_renewal_id,
        u.id
    FROM public.users u
    WHERE u.tenant_id = v_tenant_id
      AND u.role IN ('admin', 'super_admin');

    RETURN jsonb_build_object('ok', true, 'renewal_id', v_renewal_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_request_renewal(UUID, TEXT) TO authenticated;
```

---

## 4. Mobile App — Services Layer (TTL Riêng Biệt + Offline)

### [MODIFY] `apps/mobile/src/services/analytics/ktvAnalytics.ts`

> **Thay đổi v2.0:**
> - TTL tách biệt: KPI=3 phút, Reviews=5 phút, BookingProgress=2 phút
> - `fetchMyKpi()` trả về cả `cachedAt` để UI hiển thị "Cập nhật lần cuối"
> - `invalidateKpiCache()` cũng xoá cache reviews (review submit → avg_rating thay đổi)
> - Thêm `fetchMyKpiOffline()` — chỉ đọc cache, không gọi API

```typescript
// apps/mobile/src/services/analytics/ktvAnalytics.ts
import { getMobileSupabase } from '../../lib/supabase';
import { LocalCacheService } from '../../lib/localCache';

export type KpiPeriod = 'week' | 'month' | 'all';

export interface KtvKpi {
  total_sessions: number;
  total_checkins: number;
  // v2.0: commission_earned thay vì "doanh thu" — rõ ràng hơn về nghiệp vụ
  commission_earned: number;     // Hoa hồng KTV thực nhận (VND)
  avg_rating: number | null;     // Chỉ tính review đã approved
  total_reviews: number;
  approved_reviews: number;
  pending_reviews: number;
  period: KpiPeriod;
  from_date: string;
  currency: 'VND';
  // Metadata cho offline display
  _cachedAt?: number;            // timestamp khi cache được set
}

export interface ReviewItem {
  id: string;
  rating: number;
  note: string | null;
  status: 'pending_review' | 'approved' | 'rejected' | 'submitted';
  created_at: string;
  session_number: number;
  assigned_date: string;
  booking_number: string;
  package_name: string;
  customer_name: string;
}

export interface BookingProgress {
  booking_id: string;
  booking_number: string;
  package_name: string;
  total_sessions: number;
  completed_sessions: number;
  scheduled_sessions: number;
  next_session: {
    id: string;
    session_number: number;
    assigned_date: string;
    assigned_time: string | null;
    status: string;
  } | null;
  booking_status: string;
  customer_name: string;
}

// v2.0: TTL riêng biệt theo tần suất thay đổi của dữ liệu
const TTL = {
  KPI: 3 * 60 * 1000,             // 3 phút — KPI cá nhân thay đổi thường xuyên
  REVIEWS: 5 * 60 * 1000,         // 5 phút — review thay đổi khi khách submit
  BOOKING_PROGRESS: 2 * 60 * 1000, // 2 phút — progress thay đổi sau mỗi complete
  LEADERBOARD: 15 * 60 * 1000,    // 15 phút — leaderboard ổn định hơn
} as const;

const CACHE_KEYS = {
  kpi: (period: KpiPeriod) => `ktv_kpi_v2_${period}`,
  reviews: (offset: number) => `ktv_reviews_offset_${offset}`,
  bookingProgress: (bookingId: string) => `booking_progress_${bookingId}`,
};

/**
 * Fetch KPI của KTV hiện tại.
 * Trả về cached data ngay lập tức nếu còn TTL — network call nếu cache miss.
 * Luôn kèm _cachedAt để UI hiển thị "Cập nhật lần cuối".
 */
export async function fetchMyKpi(
  period: KpiPeriod = 'month',
  options: { forceRefresh?: boolean } = {}
): Promise<KtvKpi | { error: string }> {
  const cacheKey = CACHE_KEYS.kpi(period);

  if (!options.forceRefresh) {
    const cached = await LocalCacheService.get<KtvKpi>(cacheKey);
    if (cached) return cached; // Đã có _cachedAt trong cached object
  }

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_my_kpi', { p_period: period });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  const enriched: KtvKpi = { ...data, _cachedAt: Date.now() };
  await LocalCacheService.set(cacheKey, enriched, TTL.KPI);
  return enriched;
}

/**
 * Đọc KPI từ cache mà không gọi API — dùng khi offline.
 * Trả về null nếu không có cache.
 */
export async function fetchMyKpiOffline(period: KpiPeriod = 'month'): Promise<KtvKpi | null> {
  return LocalCacheService.get<KtvKpi>(CACHE_KEYS.kpi(period));
}

export async function fetchMyReviews(
  limit = 20,
  offset = 0
): Promise<{ reviews: ReviewItem[]; total_count: number } | { error: string }> {
  const cacheKey = CACHE_KEYS.reviews(offset);
  const cached = await LocalCacheService.get<{ reviews: ReviewItem[]; total_count: number }>(cacheKey);
  if (cached) return cached;

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_my_reviews', {
    p_limit: limit,
    p_offset: offset,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  await LocalCacheService.set(cacheKey, data, TTL.REVIEWS);
  return data as { reviews: ReviewItem[]; total_count: number };
}

export async function fetchBookingProgress(
  bookingId: string
): Promise<BookingProgress | { error: string }> {
  const cacheKey = CACHE_KEYS.bookingProgress(bookingId);
  const cached = await LocalCacheService.get<BookingProgress>(cacheKey);
  if (cached) return cached;

  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_get_booking_progress', {
    p_booking_id: bookingId,
  });

  if (error) return { error: error.message };
  if (data?.error) return { error: data.error };

  await LocalCacheService.set(cacheKey, data, TTL.BOOKING_PROGRESS);
  return data as BookingProgress;
}

/**
 * Invalidate KPI cache sau sự kiện thay đổi dữ liệu.
 * Gọi sau: (1) complete session, (2) review submit (avg_rating thay đổi)
 */
export async function invalidateKpiCache(): Promise<void> {
  await Promise.all([
    LocalCacheService.invalidate(CACHE_KEYS.kpi('week')),
    LocalCacheService.invalidate(CACHE_KEYS.kpi('month')),
    LocalCacheService.invalidate(CACHE_KEYS.kpi('all')),
    // v2.0: Cũng xoá reviews cache — review mới làm avg_rating thay đổi
    LocalCacheService.invalidate(CACHE_KEYS.reviews(0)),
    LocalCacheService.invalidate(CACHE_KEYS.reviews(20)),
  ]);
}

export async function requestPackageRenewal(
  bookingId: string,
  note?: string
): Promise<{ ok: boolean; error?: string; renewal_id?: string; message?: string }> {
  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_request_renewal', {
    p_booking_id: bookingId,
    p_note: note ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return data;
}
```

---

## 5. Mobile App — Màn Hình Analytics (Offline-Aware)

### [NEW] `apps/mobile/src/app/(app)/analytics.tsx`

> **Thay đổi v2.0:**
> - Hiển thị cached data + "Cập nhật lần cuối: X phút trước" khi offline
> - Không để màn hình trắng khi offline — show stale data với indicator
> - `commission_earned` thay vì "doanh thu" trong KPI card
> - Realtime subscription invalidate cache khi có review mới

```typescript
// apps/mobile/src/app/(app)/analytics.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, RefreshControl,
  TouchableOpacity, StyleSheet, ActivityIndicator
} from 'react-native';
import { KpiCard } from '../../components/analytics/KpiCard';
import { ReviewListItem } from '../../components/analytics/ReviewListItem';
import {
  fetchMyKpi, fetchMyKpiOffline, fetchMyReviews,
  invalidateKpiCache, KpiPeriod
} from '../../services/analytics/ktvAnalytics';
import { useOffline } from '../../contexts/OfflineContext';
import { getMobileSupabase } from '../../lib/supabase';
import type { KtvKpi, ReviewItem } from '../../services/analytics/ktvAnalytics';

const PERIOD_OPTIONS: { label: string; value: KpiPeriod }[] = [
  { label: 'Tuần này', value: 'week' },
  { label: 'Tháng này', value: 'month' },
  { label: 'Tất cả', value: 'all' },
];

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr} giờ trước`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'decimal' }).format(amount) + ' ₫';
}

export default function AnalyticsScreen() {
  const { isOnline } = useOffline();
  const [period, setPeriod] = useState<KpiPeriod>('month');
  const [kpi, setKpi] = useState<KtvKpi | null>(null);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShowingCache, setIsShowingCache] = useState(false);
  const realtimeRef = useRef<ReturnType<typeof getMobileSupabase>['channel'] | null>(null);

  const loadData = useCallback(async (selectedPeriod: KpiPeriod) => {
    setError(null);
    setIsShowingCache(false);

    if (!isOnline) {
      // Offline: hiển thị cache + timestamp (không để trắng)
      const cachedKpi = await fetchMyKpiOffline(selectedPeriod);
      if (cachedKpi) {
        setKpi(cachedKpi);
        setIsShowingCache(true);
      } else {
        setError('Không có dữ liệu cache. Kết nối mạng để tải lần đầu.');
      }
      return;
    }

    const [kpiRes, reviewsRes] = await Promise.all([
      fetchMyKpi(selectedPeriod),
      fetchMyReviews(10, 0),
    ]);

    if ('error' in kpiRes) {
      // Fallback sang cache nếu API lỗi
      const cachedKpi = await fetchMyKpiOffline(selectedPeriod);
      if (cachedKpi) {
        setKpi(cachedKpi);
        setIsShowingCache(true);
        setError('Không thể tải dữ liệu mới. Đang hiển thị dữ liệu cũ.');
      } else {
        setError(kpiRes.error);
      }
    } else {
      setKpi(kpiRes);
    }

    if (!('error' in reviewsRes)) {
      setReviews(reviewsRes.reviews);
    }
  }, [isOnline]);

  useEffect(() => {
    setLoading(true);
    loadData(period).finally(() => setLoading(false));
  }, [period, loadData]);

  // Realtime subscription: khi có review mới → invalidate cache → reload
  useEffect(() => {
    const supabase = getMobileSupabase();
    const channel = supabase
      .channel('my_reviews_realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'session_reviews',
          filter: `status=eq.submitted`,
        },
        async () => {
          // Review mới submit → avg_rating thay đổi → invalidate + reload
          await invalidateKpiCache();
          await loadData(period);
        }
      )
      .subscribe();

    realtimeRef.current = channel;
    return () => { supabase.removeChannel(channel); };
  }, [period, loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(period);
    setRefreshing(false);
  }, [period, loadData]);

  const periodLabel = PERIOD_OPTIONS.find(p => p.value === period)?.label ?? '';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Offline / Cache indicator */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineBannerText}>📶 Ngoại tuyến — Đang hiển thị dữ liệu đã lưu</Text>
        </View>
      )}
      {isShowingCache && kpi?._cachedAt && (
        <View style={styles.cacheBanner}>
          <Text style={styles.cacheBannerText}>
            🕐 Cập nhật lần cuối: {formatRelativeTime(kpi._cachedAt)}
          </Text>
        </View>
      )}

      {/* Period Selector */}
      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((opt) => (
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

      {loading && <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#6366F1" />}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && kpi && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Hiệu suất — {periodLabel}</Text>
          <KpiCard
            label="Buổi hoàn thành"
            value={kpi.total_sessions}
            icon="✅"
            accent="#10B981"
          />
          <KpiCard
            label="Check-in đúng hẹn"
            value={kpi.total_checkins}
            icon="📍"
            accent="#6366F1"
          />
          {/* v2.0: commission_earned — hoa hồng thực nhận (rõ nghiệp vụ) */}
          <KpiCard
            label="Hoa hồng nhận được"
            value={formatCurrency(kpi.commission_earned)}
            icon="💰"
            accent="#F59E0B"
            subtitle="Dựa trên % hoa hồng hợp đồng × buổi hoàn thành"
          />
          <KpiCard
            label="Rating trung bình"
            value={kpi.avg_rating}
            icon="⭐"
            unit="/ 5"
            accent="#EC4899"
            subtitle={`${kpi.approved_reviews} đánh giá đã duyệt`}
          />
          {kpi.pending_reviews > 0 && (
            <KpiCard
              label="Chờ đánh giá"
              value={kpi.pending_reviews}
              icon="⏳"
              accent="#8B5CF6"
              subtitle="Khách chưa gửi đánh giá"
            />
          )}
        </View>
      )}

      {!loading && reviews.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💬 Đánh giá gần đây</Text>
          {reviews.map((review) => (
            <ReviewListItem key={review.id} review={review} />
          ))}
        </View>
      )}

      {!loading && reviews.length === 0 && !error && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>Chưa có đánh giá nào trong kỳ này</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  offlineBanner: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  offlineBannerText: { fontSize: 13, color: '#92400E', textAlign: 'center' },
  cacheBanner: {
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  cacheBannerText: { fontSize: 12, color: '#4338CA', textAlign: 'center' },
  periodRow: { flexDirection: 'row', padding: 16, gap: 8 },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#E5E7EB', alignItems: 'center',
  },
  periodBtnActive: { backgroundColor: '#6366F1' },
  periodBtnText: { fontSize: 13, color: '#4B5563', fontWeight: '500' },
  periodBtnTextActive: { color: '#FFFFFF', fontWeight: '700' },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 10 },
  errorText: { color: '#EF4444', textAlign: 'center', marginTop: 20, fontSize: 13, paddingHorizontal: 16 },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});
```

---

## 6. Cập Nhật Màn Hình Session Detail — Renewal Workflow

### [MODIFY] `apps/mobile/src/app/(app)/session/[id].tsx`

```typescript
// Thêm import
import { SessionProgressBar } from '../../../components/analytics/SessionProgressBar';
import {
  fetchBookingProgress, invalidateKpiCache,
  requestPackageRenewal
} from '../../../services/analytics/ktvAnalytics';
import type { BookingProgress } from '../../../services/analytics/ktvAnalytics';

// Thêm state
const [bookingProgress, setBookingProgress] = useState<BookingProgress | null>(null);
const [isRenewing, setIsRenewing] = useState(false);

// Fetch booking progress khi màn hình load
useEffect(() => {
  if (session?.booking_id) {
    fetchBookingProgress(session.booking_id).then(res => {
      if (!('error' in res)) setBookingProgress(res);
    });
  }
}, [session?.booking_id]);

// Sau khi complete thành công
const handleCompleteSuccess = async () => {
  await invalidateKpiCache();
  if (session?.booking_id) {
    const updated = await fetchBookingProgress(session.booking_id);
    if (!('error' in updated)) setBookingProgress(updated);
  }
};

// Gửi yêu cầu gia hạn — tạo renewal_request record thay vì chỉ notification
const handleRequestRenewal = async () => {
  if (!session?.booking_id || isRenewing) return;
  setIsRenewing(true);
  const res = await requestPackageRenewal(session.booking_id,
    'KTV yêu cầu gia hạn — khách sắp hết buổi');
  setIsRenewing(false);
  if (res.ok) {
    Alert.alert('✅ Đã gửi', res.message || 'Yêu cầu gia hạn đã được gửi đến Admin.');
  } else {
    Alert.alert('❌ Lỗi', res.error || 'Không thể gửi yêu cầu gia hạn.');
  }
};

// Render (trong phần booking info)
{bookingProgress && (
  <View style={{ marginHorizontal: 16, marginVertical: 12 }}>
    <SessionProgressBar
      completed={bookingProgress.completed_sessions}
      total={bookingProgress.total_sessions}
      packageName={bookingProgress.package_name}
    />
    {bookingProgress.completed_sessions >= bookingProgress.total_sessions - 2 &&
     bookingProgress.completed_sessions < bookingProgress.total_sessions && (
      <TouchableOpacity
        style={[styles.renewBtn, isRenewing && styles.renewBtnDisabled]}
        onPress={handleRequestRenewal}
        disabled={isRenewing}
      >
        {isRenewing
          ? <ActivityIndicator size="small" color="#6366F1" />
          : <Text style={styles.renewBtnText}>🔄 Yêu cầu gia hạn gói</Text>
        }
      </TouchableOpacity>
    )}
  </View>
)}
```

---

## 7. Ghi Chú Kiến Trúc — Leaderboard Fairness

> **TODO tương lai (không block Tuần 7):** Leaderboard dùng `blended_rating` hiện tại chưa có minimum review threshold. KTV 1 review 5.0 có thể đứng trên KTV 200 reviews 4.9. Cần xem xét một trong hai:
>
> **Cách A — Minimum threshold:** Chỉ xếp hạng KTV có `approved_reviews >= 10`. KTV dưới ngưỡng hiển thị "Chưa đủ đánh giá".
>
> **Cách B — Bayesian Average:** `score = (C × m + Σrating) / (C + n)` trong đó `C` là prior (ví dụ: 4.5), `m` là số review minimum (ví dụ: 10), `n` là số review thực tế. Công thức này tự nhiên "kéo" KTV ít review về phía prior.
>
> **Khuyến nghị:** Implement Cách B trong hàm SQL `get_ktv_leaderboard_blended_rating` ở Tuần 8.

---

## Thứ Tự Thực Thi

```
── Supabase Backend ──────────────────────────────────────────────────────
Bước 1   Apply migration 20260726000000_mobile_review_rpcs.sql
          → 3 RPCs với tenant isolation đúng + revenue definition rõ ràng
Bước 2   Apply migration 20260726000001_review_submitted_notification.sql
          → Trigger hardened với WHEN condition ở trigger level
Bước 3   Apply migration 20260726000002_package_renewal_requests.sql
          → Table package_renewal_requests + RPC rpc_mobile_request_renewal

── Mobile App ────────────────────────────────────────────────────────────
Bước 4   Tạo/cập nhật ktvAnalytics.ts (TTL riêng, fetchMyKpiOffline, invalidate reviews)
Bước 5   Components: KpiCard, SessionProgressBar, ReviewListItem (giữ từ v1.0)
Bước 6   Màn hình analytics.tsx (offline banner, cache timestamp, realtime sub)
Bước 7   Cập nhật session/[id].tsx (handleRequestRenewal với table thay vì notification-only)
```

---

## Verification Plan — Bổ Sung v2.0

### Backend RPCs

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Gọi `rpc_mobile_get_my_kpi('month')` với JWT của KTV | Trả về `commission_earned` đúng theo công thức `recognized_revenue × commission_rate` |
| 2 | **NEW** Review từ tenant A — gọi RPC với JWT tenant B user | Không trả về review của tenant A — `total_count = 0` |
| 3 | **NEW** KTV chưa có review nào | RPC không crash, trả về `{ avg_rating: null, total_reviews: 0 }` |
| 4 | **NEW** KTV với 1000+ session | RPC phản hồi < 2 giây (có index `completed_by_ktv_id, status, completed_date`) |
| 5 | `rpc_mobile_get_booking_progress` | `completed_sessions` = COUNT(*) — không dùng counter |

### Trigger Notification

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Khách submit review | Chỉ KTV được đánh giá nhận notification (`target_user_id` đúng) |
| 2 | **NEW** Gọi UPDATE review.status = 'submitted' 3 lần liên tiếp | Chỉ 1 notification được tạo — WHEN condition ở trigger level ngăn invocation thừa |
| 3 | Review của KTV A submit | KTV B không thấy notification |

### Offline Analytics

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Load analytics khi online, sau đó tắt wifi | Màn hiển thị cache + banner "Ngoại tuyến" + "Cập nhật lần cuối: X phút" |
| 2 | Lần đầu mở analytics khi offline (không có cache) | Hiển thị message "Kết nối mạng để tải lần đầu" — không crash |
| 3 | Pull-to-refresh khi online | TTL reset, dữ liệu mới nhất load |

### Renewal Request

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | KTV bấm "Gia hạn gói" | `package_renewal_requests` có bản ghi mới `status = pending` |
| 2 | Bấm lần 2 khi đã có request pending | Không tạo bản ghi mới — trả về "Đã có yêu cầu đang chờ" |
| 3 | Admin xem web | Thấy renewal request trong danh sách admin |

---

## Danh Sách File Checklist

| File | Trạng thái | Ghi chú |
|---|---|---|
| `supabase/migrations/20260726000000_mobile_review_rpcs.sql` | **NEW v2** | Tenant isolation + commission KPI definition |
| `supabase/migrations/20260726000001_review_submitted_notification.sql` | **NEW v2** | WHEN condition ở trigger level |
| `supabase/migrations/20260726000002_package_renewal_requests.sql` | **NEW** | Table + RPC renewal workflow |
| `apps/mobile/src/services/analytics/ktvAnalytics.ts` | **MODIFY v2** | TTL riêng, offline cache, invalidate reviews |
| `apps/mobile/src/components/analytics/KpiCard.tsx` | **NEW** | (không thay đổi từ v1.0) |
| `apps/mobile/src/components/analytics/SessionProgressBar.tsx` | **NEW** | (không thay đổi từ v1.0) |
| `apps/mobile/src/components/analytics/ReviewListItem.tsx` | **NEW** | (không thay đổi từ v1.0) |
| `apps/mobile/src/app/(app)/analytics.tsx` | **MODIFY v2** | Offline-aware, realtime sub, cache timestamp |
| `apps/mobile/src/app/(app)/session/[id].tsx` | **MODIFY v2** | Renewal với table, không chỉ notification |

---

## Định Nghĩa Hoàn Thành (DoD) — v2.0

- [ ] **Revenue KPI rõ ràng:** `commission_earned` được tính đúng công thức `recognized_revenue × commission_rate`. Có comment giải thích trong code và migration.
- [ ] **Tenant isolation:** `rpc_mobile_get_my_reviews` filter cả `sr.tenant_id` và `ktv_id` — test cross-tenant không lộ dữ liệu.
- [ ] **Trigger WHEN condition:** `trig_on_review_submitted_notify` có `WHEN (NEW.status = 'submitted' AND OLD.status IS DISTINCT FROM 'submitted')` ở trigger level — verify bằng `\d+ session_reviews`.
- [ ] **Offline graceful:** Màn analytics hiển thị cached data + banner + "Cập nhật lần cuối" — không trắng khi offline.
- [ ] **TTL đúng:** KPI=3 phút, Reviews=5 phút, BookingProgress=2 phút — verify bằng cache timestamp.
- [ ] **Renewal workflow:** Nút "Gia hạn gói" tạo bản ghi trong `package_renewal_requests` — không chỉ gửi notification.
- [ ] **Realtime invalidation:** Submit review → KPI cache invalidate → rating cập nhật khi mở lại analytics.
- [ ] **KTV 0 review:** Analytics không crash, `avg_rating = null` hiển thị là "—".
- [ ] **Leaderboard note:** Ghi rõ TODO về minimum threshold / Bayesian ranking cho Tuần 8.
- [ ] CI pass: Mobile typecheck + Web build không lỗi regression.
