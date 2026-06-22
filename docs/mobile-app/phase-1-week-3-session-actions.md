# Bella ERP Mobile App — Phase 1 Tuần 3: Session Actions & Customer Profile
## Phiên bản v2.0 — Sau review

**Ngày tạo:** 2026-06-21
**Cập nhật:** 2026-06-21 — Áp dụng 7 điểm sau review
**Tiền điều kiện:** Tuần 2 DoD hoàn thành

---

## Tổng Hợp Thay Đổi So Với v1.0

| # | Vấn đề | Mức độ | Thay đổi |
|---|--------|--------|---------|
| 1 | RPC increment `completed_sessions += 1` → double count | 🔴 Bắt buộc | Recalculate từ `session_logs` |
| 2 | IF check không atomic — race condition | 🔴 Bắt buộc | `UPDATE ... WHERE status <> 'completed'` + `GET DIAGNOSTICS` |
| 3 | `saveSessionNote` RLS chưa đủ — lỗ hổng permission | 🔴 Bắt buộc | Chuyển sang RPC + phát hiện lỗ hổng RLS thực tế |
| 4 | `session.customerId` không có trong interface — compile error | 🔴 Bắt buộc | Thêm field vào `SessionDetail` + `fetchSessionDetail` |
| 5 | Sort active booking phía mobile chưa chính xác | 🟡 Nên làm | Thêm TODO rõ ràng, document rule tạm thời |
| 6 | Transaction behavior chưa documented | 🟡 Nên làm | Document trong RPC comment |
| 7 | Backlog `rpc_mobile_session_detail` | 🟡 Nên làm | Thêm vào backlog có deadline |

---

## Phát Hiện Thêm Trong Quá Trình Review RLS

> **Quan trọng:** Trong quá trình kiểm tra codebase để verify điểm #3, phát hiện lỗ hổng RLS thực tế trong
> [`20260520000006_enable_core_rls.sql`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260520000006_enable_core_rls.sql#L49).

```sql
-- RLS policy hiện tại — CÓ VẤN ĐỀ
CREATE POLICY "KTV cập nhật session_logs được phân công"
    ON session_logs
    FOR UPDATE
    USING (
        assigned_ktv_id = auth.uid()   -- ← Cột này KHÔNG TỒN TẠI trên session_logs!
        OR completed_by_ktv_id = auth.uid()
    );
```

**Kết quả thực tế:**
- `session_logs.assigned_ktv_id` không có (cột này nằm trên `bookings`)
- `completed_by_ktv_id` null cho session chưa hoàn thành
- Policy này **không filter được gì** → KTV A có thể UPDATE session của KTV B cùng tenant
- Đây là lý do điểm #3 yêu cầu dùng RPC thay vì direct update — RPC dùng `SECURITY DEFINER` và kiểm tra qua `bookings.assigned_ktv_id`

**Fix cần làm trước khi triển khai:** Thêm migration sửa RLS policy (Bước 4 mới).

---

## Mục Tiêu Tuần 3

Biến mobile app từ "read-only dashboard" thành **công cụ làm việc thật sự** cho KTV, với data integrity đảm bảo:

1. **Session detail** — tap vào card → thấy đầy đủ thông tin buổi hẹn
2. **Hoàn thành buổi** — atomic, idempotent, `completed_sessions` derive từ source
3. **Ghi chú nhanh** — qua RPC (không phải direct update — RLS hiện tại không đủ)
4. **Hồ sơ khách hàng** — thông tin mẹ/bé, gói đang dùng, lịch sử buổi
5. **Permission guards** — route protection, nút action ẩn theo role
6. **Fix RLS policy** — `session_logs` UPDATE policy phải join qua `bookings`

---

## Thứ Tự Thực Thi (23 bước)

```
── Nhóm A: @bella/shared domain types ────────────────────────────────────
Bước 1   Tạo packages/shared/src/types/domain.ts
          → BookingSummary, CustomerMobileInfo, SessionStatus, SessionLogSummary
          → isSessionCompletable()

── Nhóm B: Fix RLS policy (phát hiện trong review) ──────────────────────
Bước 2   Tạo migration: fix "KTV cập nhật session_logs" policy
          → join qua bookings để check assigned_ktv_id
Bước 3   Apply migration + verify trên Supabase Studio
          (KTV A không thể UPDATE session của KTV B)

── Nhóm C: Xoá fallback join từ Tuần 2 ──────────────────────────────────
Bước 4   Kiểm tra rpc_mobile_today_sessions đã apply chưa
          → Nếu có: xoá fetchTodaySessionsFallback()
          → Nếu chưa: ghi TODO deadline

── Nhóm D: RPC migrations ────────────────────────────────────────────────
Bước 5   Viết 20260628_mobile_complete_session_rpc.sql
          v2: atomic UPDATE + GET DIAGNOSTICS + derive count
Bước 6   Viết 20260628_mobile_save_session_note_rpc.sql
          SECURITY DEFINER — kiểm tra qua bookings.assigned_ktv_id
Bước 7   Apply cả 2 migrations + verify trên Studio
Bước 8   Verify idempotency: gọi complete_session 2 lần → lần 2 trả error

── Nhóm E: Services ─────────────────────────────────────────────────────
Bước 9   Tạo services/session/fetchSessionDetail.ts
          v2: thêm customerId vào return type
Bước 10  Tạo services/booking/completeSession.ts (gọi RPC v2)
Bước 11  Tạo services/booking/saveSessionNote.ts (gọi RPC note)
Bước 12  Tạo services/booking/fetchCustomerProfile.ts
          v2: TODO active booking rule + limit queries

── Nhóm F: Hooks ─────────────────────────────────────────────────────────
Bước 13  Tạo useSessionDetail.ts (realtime single row)
Bước 14  Tạo useCustomerProfile.ts

── Nhóm G: PermissionGuard ──────────────────────────────────────────────
Bước 15  Tạo PermissionGuard.tsx

── Nhóm H: UI Components ─────────────────────────────────────────────────
Bước 16  Tạo SessionDetailCard.tsx
Bước 17  Tạo CompleteSessionButton.tsx (optimistic UI → backlog note)
Bước 18  Tạo SessionNoteInput.tsx
Bước 19  Tạo CustomerBookingCard.tsx

── Nhóm I: Screens ───────────────────────────────────────────────────────
Bước 20  Tạo app/(app)/session/[id].tsx
Bước 21  Cập nhật home.tsx + schedule.tsx — tap → navigate
Bước 22  Tạo app/(app)/customer/[id].tsx

── Nhóm J: Verification ──────────────────────────────────────────────────
Bước 23  CI + manual: flow hoàn thành buổi, race condition test
```

---

## Chi Tiết Triển Khai

### Bước 1: `@bella/shared` domain types

```typescript
// packages/shared/src/types/domain.ts

export const SESSION_STATUS = {
  SCHEDULED:   'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED:   'completed',
  CANCELLED:   'cancelled',
  RESCHEDULED: 'rescheduled',
} as const;

export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];

/**
 * Session có thể hoàn thành khi status = scheduled hoặc in_progress.
 * Dùng trong CompleteSessionButton để ẩn nút — không hardcode ở nhiều nơi.
 */
export function isSessionCompletable(status: SessionStatus | string | null): boolean {
  return status === SESSION_STATUS.SCHEDULED || status === SESSION_STATUS.IN_PROGRESS;
}

export interface SessionLogSummary {
  id: string;
  sessionNumber: number;
  status: SessionStatus;
  scheduledDate: string | null;
  assignedTime: string | null;
  completedDate: string | null;
  notes: string | null;
  ktvName: string | null;
  duration: number | null;
}

export interface BookingSummary {
  id: string;
  packageName: string | null;
  totalSessions: number;
  completedSessions: number;
  status: string;
  preferredTime: string | null;
  startDate: string | null;
  fullPrice: number | null;
  assignedKtvName: string | null;
}

export interface CustomerMobileInfo {
  id: string;
  nameMother: string;
  nameBaby: string | null;
  phone: string;
  address: string | null;
  dobBaby: string | null;
  dobExpected: string | null;
  genderBaby: string | null;
  notes: string | null;
  activeBooking: BookingSummary | null;
  recentSessions: SessionLogSummary[];
}
```

---

### Bước 2–3: Fix RLS policy `session_logs`

#### `supabase/migrations/20260628_fix_session_logs_rls.sql`

```sql
-- Fix: RLS policy "KTV cập nhật session_logs" đang dùng
-- assigned_ktv_id = auth.uid() nhưng cột này KHÔNG TỒN TẠI trên session_logs.
-- Cột assigned_ktv_id nằm trên bảng bookings.
-- Kết quả: KTV A có thể UPDATE session của KTV B cùng tenant — lỗ hổng bảo mật.

-- Xoá policy lỗi
DROP POLICY IF EXISTS "KTV cập nhật session_logs được phân công" ON session_logs;
DROP POLICY IF EXISTS "KTV xem session_logs được phân công" ON session_logs;

-- Policy mới — join qua bookings để kiểm tra assigned_ktv_id
CREATE POLICY "KTV xem session_logs được phân công"
    ON session_logs
    FOR SELECT
    TO authenticated
    USING (
        -- KTV thấy session của booking được giao cho mình
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = session_logs.booking_id
            AND b.assigned_ktv_id = auth.uid()
        )
        OR
        -- Hoặc session KTV đã hoàn thành (completed_by_ktv_id tồn tại)
        completed_by_ktv_id = auth.uid()
    );

CREATE POLICY "KTV cập nhật session_logs được phân công"
    ON session_logs
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM bookings b
            WHERE b.id = session_logs.booking_id
            AND b.assigned_ktv_id = auth.uid()
        )
    )
    WITH CHECK (
        -- KTV không thể tự thay đổi tenant_id hay booking_id
        tenant_id = (SELECT tenant_id FROM users WHERE id = auth.uid())
    );

-- Verify: Chạy trong Supabase Studio sau khi apply
-- SELECT * FROM pg_policies WHERE tablename = 'session_logs';
```

> **Lưu ý:** Vì `saveSessionNote` và `completeSession` đều được thực hiện qua **RPC với `SECURITY DEFINER`**, fix này chủ yếu bảo vệ các client trực tiếp gọi PostgREST API (không qua RPC). Nhưng vẫn cần fix để bảo vệ tuyệt đối.

---

### Bước 5: RPC hoàn thành buổi — v2

#### `supabase/migrations/20260628_mobile_complete_session_rpc.sql`

```sql
-- RPC: Mobile hoàn thành buổi dịch vụ
-- Version: 2.0 — Sau review
--
-- Thay đổi so với v1:
--   1. Atomic idempotent: UPDATE ... WHERE status <> 'completed' + GET DIAGNOSTICS
--      (không dùng IF status = 'completed' THEN error — bị race condition)
--   2. completed_sessions: derive từ COUNT(*) session_logs, không increment += 1
--      (tránh double count khi web + mobile cùng complete)
--   3. Transaction: PL/pgSQL function trong Supabase tự wrap 1 transaction
--      Nếu UPDATE session_logs OK nhưng UPDATE bookings fail → cả 2 rollback
--
-- Transaction behavior (document để người sau hiểu):
--   PostgreSQL PL/pgSQL function chạy trong SINGLE TRANSACTION của caller.
--   Nếu function raise EXCEPTION → toàn bộ statements trong function rollback.
--   Supabase JS client gọi RPC qua HTTP POST → mỗi call = 1 transaction tự động.
--   Không cần explicit BEGIN/COMMIT.

CREATE OR REPLACE FUNCTION rpc_mobile_complete_session(
  p_session_id  UUID,
  p_booking_id  UUID,
  p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tenant_id     UUID;
  v_user_id       UUID;
  v_user_role     TEXT;
  v_booking       RECORD;
  v_today         TEXT;
  v_rows_affected INT;
  v_completed_count INT;
BEGIN
  -- 1. Lấy user hiện tại từ JWT
  v_user_id   := auth.uid();
  SELECT role, tenant_id INTO v_user_role, v_tenant_id
  FROM users WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Không xác định được chi nhánh người dùng.');
  END IF;

  v_today := to_char(NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD');

  -- 2. Kiểm tra booking tồn tại, thuộc tenant, chưa cancelled
  SELECT * INTO v_booking
  FROM bookings
  WHERE id = p_booking_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy booking trong chi nhánh.');
  END IF;

  IF v_booking.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'Không thể hoàn thành buổi của booking đã hủy.');
  END IF;

  IF v_booking.assigned_ktv_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Chưa phân công KTV. Phân công KTV trước khi hoàn thành.');
  END IF;

  -- 3. Permission: KTV chỉ hoàn thành lịch được giao cho mình
  IF v_user_role NOT IN ('admin', 'super_admin')
     AND v_booking.assigned_ktv_id != v_user_id THEN
    RETURN jsonb_build_object('error', 'Bạn chỉ có thể hoàn thành buổi được giao cho mình.');
  END IF;

  -- 4. ATOMIC idempotent UPDATE — WHERE status <> 'completed' là check và update trong 1 operation
  --    Tránh race condition: nếu 2 request đến cùng lúc, chỉ 1 UPDATE thành công
  --    Request kia sẽ thấy rows_affected = 0 → trả error
  UPDATE session_logs SET
    status               = 'completed',
    completed_date       = v_today,
    completed_by_ktv_id  = v_booking.assigned_ktv_id,
    notes                = COALESCE(p_note, notes)
  WHERE
    id         = p_session_id
    AND booking_id  = p_booking_id      -- cross-check session thuộc booking
    AND tenant_id   = v_tenant_id       -- tenant isolation
    AND status  <> 'completed';          -- ← ATOMIC IDEMPOTENT CHECK (không phải IF riêng)

  -- 5. Kiểm tra số row bị ảnh hưởng
  GET DIAGNOSTICS v_rows_affected = ROW_COUNT;

  IF v_rows_affected = 0 THEN
    -- Có 2 trường hợp:
    --   a) Session đã completed trước đó (idempotent — bình thường)
    --   b) Session không thuộc booking này (data error)
    RETURN jsonb_build_object(
      'error', 'Buổi dịch vụ đã hoàn thành trước đó hoặc không tồn tại (Idempotent).'
    );
  END IF;

  -- 6. Cập nhật completed_sessions — DERIVE từ source, không increment
  --    Lý do: nếu web + mobile cùng complete → increment += 1 sẽ thành 2
  --    COUNT(*) luôn cho kết quả đúng bất kể concurrent request
  SELECT COUNT(*) INTO v_completed_count
  FROM session_logs
  WHERE booking_id = p_booking_id
    AND status = 'completed';   -- lúc này đã bao gồm row vừa update

  UPDATE bookings SET
    completed_sessions = v_completed_count
  WHERE id = p_booking_id AND tenant_id = v_tenant_id;

  -- NOTE: processSessionCompletion (salary, kho, accounting) vẫn chạy trên web server
  -- Mobile RPC chỉ cập nhật status + count — không duplicate business logic tài chính.
  -- Tracking task: [Phase 2] Trigger salary/kho sau mobile complete
  -- Xem: src/core/services/order/complete-session-action.ts

  RETURN jsonb_build_object('success', true, 'session_id', p_session_id);

  -- Nếu bất kỳ statement nào ở trên raise exception (ví dụ: deadlock, connection lost)
  -- PostgreSQL tự động rollback toàn bộ function (vì chạy trong 1 transaction)
  -- Không cần explicit EXCEPTION block cho rollback thông thường.
  -- Exception block chỉ cần nếu muốn custom error message từ DB errors.

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('error', 'Lỗi hệ thống: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_mobile_complete_session TO authenticated;
```

---

### Bước 6: RPC ghi chú session

#### `supabase/migrations/20260628_mobile_save_session_note_rpc.sql`

```sql
-- RPC: Mobile lưu ghi chú cho session
-- Lý do dùng RPC (không dùng direct update):
--   1. RLS policy "KTV cập nhật session_logs" đang join qua bookings (sau fix migration 20260628_fix_session_logs_rls)
--      Tuy nhiên, để bảo đảm tuyệt đối và audit log, dùng SECURITY DEFINER.
--   2. Permission rule phức tạp: admin override mọi status, KTV chỉ được update scheduled/in_progress
--   3. Direct update với .in('status', [...]) là filter, không phải permission.

CREATE OR REPLACE FUNCTION rpc_mobile_save_session_note(
  p_session_id UUID,
  p_note       TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id   UUID;
  v_user_role TEXT;
  v_tenant_id UUID;
  v_session   RECORD;
  v_booking   RECORD;
  v_rows      INT;
BEGIN
  v_user_id := auth.uid();
  SELECT role, tenant_id INTO v_user_role, v_tenant_id
  FROM users WHERE id = v_user_id;

  IF v_tenant_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Không xác định được chi nhánh.');
  END IF;

  -- Lấy session và check tenant
  SELECT * INTO v_session
  FROM session_logs
  WHERE id = p_session_id AND tenant_id = v_tenant_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Không tìm thấy session.');
  END IF;

  -- KTV: chỉ được ghi chú session chưa hoàn thành VÀ được phân công cho mình
  IF v_user_role NOT IN ('admin', 'super_admin') THEN
    IF v_session.status NOT IN ('scheduled', 'in_progress') THEN
      RETURN jsonb_build_object('error', 'Chỉ có thể ghi chú cho buổi chưa hoàn thành.');
    END IF;

    -- Kiểm tra KTV được phân công qua bookings (không phải session_logs)
    SELECT * INTO v_booking
    FROM bookings
    WHERE id = v_session.booking_id
      AND assigned_ktv_id = v_user_id
      AND tenant_id = v_tenant_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('error', 'Bạn chỉ có thể ghi chú cho buổi được phân công cho mình.');
    END IF;
  END IF;

  -- Update note
  UPDATE session_logs
  SET notes = NULLIF(TRIM(p_note), '')  -- lưu NULL nếu note rỗng
  WHERE id = p_session_id AND tenant_id = v_tenant_id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN jsonb_build_object('error', 'Không thể cập nhật ghi chú.');
  END IF;

  RETURN jsonb_build_object('success', true);

EXCEPTION WHEN others THEN
  RETURN jsonb_build_object('error', 'Lỗi hệ thống: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_mobile_save_session_note TO authenticated;
```

---

### Bước 9: `fetchSessionDetail.ts` — v2 (fix customerId)

```typescript
// apps/mobile/src/services/session/fetchSessionDetail.ts

// v2 FIX: Thêm customerId vào interface — bắt buộc để navigate customer/[id]
export interface SessionDetail {
  id: string;
  sessionNumber: number;
  status: string;
  scheduledDate: string | null;
  assignedTime: string | null;
  completedDate: string | null;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  ktvName: string | null;
  ktvId: string | null;
  // Booking info
  bookingId: string;
  packageName: string | null;
  // Customer info — BẮT BUỘC có customerId để navigate customer profile
  customerId: string;        // ← v1 THIẾU field này → compile error ở SessionDetailScreen
  customerName: string;
  babyName: string | null;
  completedSessions: number;
  totalSessions: number;
}

export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail | null> {
  const supabase = getMobileSupabase();

  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      id,
      session_number,
      status,
      scheduled_date,
      assigned_time,
      completed_date,
      start_time,
      end_time,
      notes,
      booking_id,
      bookings (
        package_name,
        completed_sessions,
        total_sessions,
        assigned_ktv_id,
        customer_id,
        assigned_ktv:users!bookings_assigned_ktv_id_fkey (
          id,
          full_name
        ),
        customers (
          id,
          name_mother,
          name_baby
        )
      )
    `)
    .eq('id', sessionId)
    .single();

  if (error || !data) return null;

  const booking = Array.isArray(data.bookings) ? data.bookings[0] : data.bookings;
  const customer = Array.isArray(booking?.customers) ? booking?.customers[0] : booking?.customers;
  const ktv = Array.isArray(booking?.assigned_ktv) ? booking?.assigned_ktv[0] : booking?.assigned_ktv;

  return {
    id: data.id,
    sessionNumber: data.session_number ?? 0,
    status: data.status ?? '',
    scheduledDate: data.scheduled_date ?? null,
    assignedTime: data.assigned_time ?? null,
    completedDate: data.completed_date ?? null,
    startTime: data.start_time ?? null,
    endTime: data.end_time ?? null,
    notes: data.notes ?? null,
    ktvName: ktv?.full_name ?? null,
    ktvId: ktv?.id ?? null,
    bookingId: data.booking_id ?? '',
    packageName: booking?.package_name ?? null,
    customerId: customer?.id ?? booking?.customer_id ?? '',  // ← v2 FIX
    customerName: customer?.name_mother ?? 'Khách',
    babyName: customer?.name_baby ?? null,
    completedSessions: booking?.completed_sessions ?? 0,
    totalSessions: booking?.total_sessions ?? 0,
  };
}
```

---

### Bước 11: `saveSessionNote.ts` — v2 gọi RPC

```typescript
// apps/mobile/src/services/booking/saveSessionNote.ts
// v2: Gọi RPC thay vì direct update
// Lý do: RLS policy session_logs hiện tại không đủ để phân biệt permission đúng
// RPC rpc_mobile_save_session_note kiểm tra qua bookings.assigned_ktv_id

import { getMobileSupabase } from '../../lib/supabase';

export type SaveNoteResult =
  | { ok: true }
  | { ok: false; error: string };

export async function saveSessionNote(
  sessionId: string,
  note: string,
): Promise<SaveNoteResult> {
  const supabase = getMobileSupabase();

  const { data, error } = await supabase.rpc('rpc_mobile_save_session_note', {
    p_session_id: sessionId,
    p_note: note,
  });

  if (error) return { ok: false, error: error.message };

  const result = data as { success?: boolean; error?: string };
  if (result.error) return { ok: false, error: result.error };

  return { ok: true };
}
```

---

### Bước 12: `fetchCustomerProfile.ts` — v2 với TODO active booking

```typescript
// apps/mobile/src/services/booking/fetchCustomerProfile.ts
// v2 thay đổi:
//   - Thêm TODO rõ ràng cho active booking rule
//   - Thêm .limit() để tránh over-fetch

export async function fetchCustomerProfile(
  customerId: string,
): Promise<CustomerMobileInfo | null> {
  const supabase = getMobileSupabase();

  const [customerRes, bookingsRes] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name_mother, name_baby, phone, address, dob_baby, dob_expected, gender_baby, notes')
      .eq('id', customerId)
      .single(),
    supabase
      .from('bookings')
      .select(`
        id, package_name, total_sessions, completed_sessions,
        status, preferred_time, start_date, full_price,
        assigned_ktv:users!bookings_assigned_ktv_id_fkey ( full_name ),
        session_logs (
          id, session_number, status, scheduled_date,
          assigned_time, completed_date, notes
        )
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(5),  // Chỉ 5 booking gần nhất — đủ cho mobile
  ]);

  if (customerRes.error || !customerRes.data) return null;

  const c = customerRes.data;
  const bookings = bookingsRes.data ?? [];

  // ─── Active Booking Selection ──────────────────────────────────────────────
  //
  // TODO Phase 2: Server quyết định active booking, không sort ở mobile.
  //
  // Vấn đề hiện tại: Nếu khách có booking cũ status=active VÀ booking mới
  // status=booked cùng tồn tại, mobile sort theo priority nhưng không có
  // business rule rõ ràng nào nói cái nào là "primary".
  //
  // Rule tạm thời (Tuần 3): Sort theo priority + created_at mới nhất.
  // Rule Phase 2: Tạo field is_primary_booking trên bookings hoặc
  //               server RPC trả về active booking đã được chọn.
  // ─────────────────────────────────────────────────────────────────────────
  const priority = (s: string) => {
    if (s === 'active' || s === 'in_progress') return 0;
    if (s === 'booked') return 1;
    if (s === 'deposit_pending') return 2;
    return 3;
  };

  const sorted = [...bookings].sort((a, b) =>
    priority(a.status ?? '') - priority(b.status ?? ''),
  );
  const activeBookingRaw = sorted[0] ?? null;

  const ktv = Array.isArray(activeBookingRaw?.assigned_ktv)
    ? activeBookingRaw?.assigned_ktv[0]
    : activeBookingRaw?.assigned_ktv;

  const rawSessions = ((activeBookingRaw?.session_logs ?? []) as Array<Record<string, unknown>>)
    .sort((a, b) => ((a.session_number as number) ?? 0) - ((b.session_number as number) ?? 0))
    .slice(0, 20);  // Tối đa 20 session — đủ cho customer profile

  const recentSessions: SessionLogSummary[] = rawSessions.map((sl) => ({
    id: sl.id as string,
    sessionNumber: sl.session_number as number ?? 0,
    status: sl.status as string ?? '',
    scheduledDate: sl.scheduled_date as string | null ?? null,
    assignedTime: sl.assigned_time as string | null ?? null,
    completedDate: sl.completed_date as string | null ?? null,
    notes: sl.notes as string | null ?? null,
    ktvName: null,  // Không fetch KTV per-session để giảm query weight
    duration: null,
  }));

  return {
    id: c.id,
    nameMother: c.name_mother ?? '',
    nameBaby: c.name_baby ?? null,
    phone: c.phone ?? '',
    address: c.address ?? null,
    dobBaby: c.dob_baby ?? null,
    dobExpected: c.dob_expected ?? null,
    genderBaby: c.gender_baby ?? null,
    notes: c.notes ?? null,
    activeBooking: activeBookingRaw ? {
      id: activeBookingRaw.id,
      packageName: activeBookingRaw.package_name ?? null,
      totalSessions: activeBookingRaw.total_sessions ?? 0,
      completedSessions: activeBookingRaw.completed_sessions ?? 0,
      status: activeBookingRaw.status ?? '',
      preferredTime: activeBookingRaw.preferred_time ?? null,
      startDate: activeBookingRaw.start_date ?? null,
      fullPrice: activeBookingRaw.full_price ?? null,
      assignedKtvName: ktv?.full_name ?? null,
    } : null,
    recentSessions,
  };
}
```

---

### Bước 17: `CompleteSessionButton.tsx` — v2 với backlog note

```typescript
// apps/mobile/src/components/CompleteSessionButton.tsx
// v2: Button tự xử lý business permission (không cần PermissionGuard bọc ngoài)
// Backlog Tuần 4: Optimistic UI (setStatus('completed') ngay, rollback nếu fail)

import { useState } from 'react';
import { Alert, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { isAdminRole, isTechnicianRole, isSessionCompletable } from '@bella/shared';
import { completeSession } from '../services/booking/completeSession';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  sessionId: string;
  bookingId: string;
  sessionStatus: string;
  assignedKtvId: string | null;
  onSuccess: () => void;
}

export function CompleteSessionButton({
  sessionId, bookingId, sessionStatus, assignedKtvId, onSuccess,
}: Props) {
  const [loading, setLoading] = useState(false);
  const auth = useAuth();

  if (auth.status !== 'authenticated') return null;
  const { user } = auth;

  // Điều kiện ẩn nút — business logic, không phải PermissionGuard
  if (!isSessionCompletable(sessionStatus)) return null;
  if (isTechnicianRole(user.role) && assignedKtvId !== user.id) return null;
  // Admin thấy nút cho tất cả session có thể hoàn thành

  // TODO Tuần 4 — Optimistic update:
  // Hiện tại: Tap → RPC (500ms-1s) → refresh → UI cập nhật
  // Tương lai: Tap → setStatus('completed') ngay → RPC → nếu fail: rollback
  // Pattern: const [optimisticStatus, setOptimisticStatus] = useState(sessionStatus)

  async function handlePress() {
    Alert.alert(
      'Xác nhận hoàn thành buổi',
      'Bạn có chắc chắn muốn hoàn thành buổi dịch vụ này?',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Hoàn thành',
          onPress: async () => {
            setLoading(true);
            const result = await completeSession({ sessionId, bookingId });
            setLoading(false);
            if (result.ok) {
              onSuccess();
            } else {
              Alert.alert('Không thể hoàn thành', result.error);
            }
          },
        },
      ],
    );
  }

  return (
    <TouchableOpacity onPress={handlePress} disabled={loading}>
      {loading ? <ActivityIndicator /> : <Text>✓ Hoàn thành buổi</Text>}
    </TouchableOpacity>
  );
}
```

---

### Bước 20: Session Detail Screen — v2 (fix customerId)

```typescript
// apps/mobile/app/(app)/session/[id].tsx
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session, isLoading, error, refresh } = useSessionDetail(id);

  // ...
  return (
    <ScrollView>
      {/* ... */}

      {/* v2 FIX: session.customerId tồn tại trong SessionDetail interface */}
      <PermissionGuard>
        <TouchableOpacity
          onPress={() => router.push(`/customer/${session.customerId}`)}
        >
          <Text>Xem hồ sơ khách hàng →</Text>
        </TouchableOpacity>
      </PermissionGuard>
    </ScrollView>
  );
}
```

---

## Backlog — Đã Ghi Nhận

| Hạng mục | Khi nào | Ghi chú |
|---------|---------|---------|
| `rpc_mobile_session_detail` | Tuần 5 hoặc khi query `fetchSessionDetail` vượt 6 joins | Tạo RPC trả toàn bộ session detail — tránh monster query |
| Optimistic UI cho `CompleteSessionButton` | Tuần 4 | `setOptimisticStatus('completed')` ngay, rollback nếu fail |
| Phase 2: Server quyết định active booking | Phase 2 | Field `is_primary_booking` hoặc RPC |
| Salary/kho trigger sau mobile complete | Phase 2 | Webhook hoặc DB trigger post-complete |

---

## Danh Sách Files

### packages/shared/ — Bổ sung

| File | Thay đổi |
|------|---------|
| `packages/shared/src/types/domain.ts` | MỚI — tất cả domain types |
| `packages/shared/src/index.ts` | Cập nhật re-export |

### supabase/migrations/ — 3 files mới

| File | Ghi chú |
|------|---------|
| `20260628_fix_session_logs_rls.sql` | Fix RLS policy dùng cột không tồn tại |
| `20260628_mobile_complete_session_rpc.sql` | v2: atomic + derive count |
| `20260628_mobile_save_session_note_rpc.sql` | Permission qua bookings |

### apps/mobile/ — Mới và cập nhật

| File | Ghi chú |
|------|---------|
| `src/services/session/fetchSessionDetail.ts` | v2: thêm customerId |
| `src/services/booking/completeSession.ts` | Gọi RPC v2 |
| `src/services/booking/saveSessionNote.ts` | v2: gọi RPC thay vì direct update |
| `src/services/booking/fetchCustomerProfile.ts` | v2: TODO + limits |
| `src/hooks/useSessionDetail.ts` | MỚI |
| `src/hooks/useCustomerProfile.ts` | MỚI |
| `src/components/PermissionGuard.tsx` | MỚI |
| `src/components/SessionDetailCard.tsx` | MỚI |
| `src/components/CompleteSessionButton.tsx` | v2: backlog note |
| `src/components/SessionNoteInput.tsx` | MỚI |
| `src/components/CustomerBookingCard.tsx` | MỚI |
| `app/(app)/session/[id].tsx` | v2: fix customerId navigation |
| `app/(app)/customer/[id].tsx` | MỚI |
| `app/(app)/home.tsx` | Cập nhật — navigate session/[id] |
| `app/(app)/schedule.tsx` | Cập nhật — navigate session/[id] |
| `src/services/dashboard/fetchTodaySessions.ts` | Xoá fallback nếu RPC Tuần 2 apply |

**Tổng: 2 file shared, 3 SQL migrations, 16 file mobile**

---

## Kế Hoạch Kiểm Tra

### RLS verification (trước khi code mobile)

```sql
-- Chạy trong Supabase Studio với user KTV B (không phải KTV A)
-- Sau khi apply migration fix_session_logs_rls:

-- Test 1: KTV A không thể UPDATE session được giao cho KTV B
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" TO '{"sub":"ktv-a-uuid"}';
UPDATE session_logs SET notes = 'hack' WHERE id = 'session-of-ktv-b';
-- Kết quả mong đợi: 0 rows affected (không phải error — RLS filter)

-- Test 2: RPC rpc_mobile_complete_session với KTV A, session của KTV B
SELECT rpc_mobile_complete_session('session-of-ktv-b', 'booking-id');
-- Kết quả mong đợi: {"error": "Bạn chỉ có thể hoàn thành buổi được giao cho mình."}
```

### Race condition verification

```sql
-- Test idempotency: gọi 2 lần cùng session
SELECT rpc_mobile_complete_session('session-id', 'booking-id');  -- lần 1
SELECT rpc_mobile_complete_session('session-id', 'booking-id');  -- lần 2
-- Kết quả mong đợi: lần 2 trả {"error": "Buổi dịch vụ đã hoàn thành..."}
```

### Counter integrity verification

```sql
-- Sau khi complete từ cả web và mobile:
SELECT
  b.id,
  b.completed_sessions AS stored_count,
  COUNT(sl.id) AS derived_count
FROM bookings b
JOIN session_logs sl ON sl.booking_id = b.id AND sl.status = 'completed'
WHERE b.id = 'test-booking-id'
GROUP BY b.id, b.completed_sessions;
-- Kết quả mong đợi: stored_count = derived_count
```

### Thủ công — Simulator

| # | Kiểm tra | Kết quả mong đợi |
|---|---------|-----------------|
| 1 | KTV A hoàn thành lịch của mình | Thành công |
| 2 | KTV A hoàn thành lịch KTV B | Nút không hiện |
| 3 | Tap Complete 2 lần nhanh | Chỉ 1 request (button disabled trong loading) |
| 4 | Web + Mobile complete cùng lúc | `completed_sessions` = COUNT từ DB, không bị double |
| 5 | Ghi chú — KTV B ghi cho session KTV A | RPC trả error permission |
| 6 | `session.customerId` → navigate customer profile | Không crash |
| 7 | Customer profile: active booking | Đúng với quy tắc priority sort tạm thời |
| 8 | CI: web build | Không regression |

---

## Định Nghĩa Hoàn Thành (DoD)

- [ ] `@bella/shared/types/domain` export đủ types + `isSessionCompletable()`.
- [ ] RLS policy `session_logs` UPDATE join qua `bookings.assigned_ktv_id` — verified trên Studio.
- [ ] RPC `rpc_mobile_complete_session` v2: atomic UPDATE, derive count, document transaction.
- [ ] RPC `rpc_mobile_save_session_note`: permission check qua bookings.
- [ ] `SessionDetail` interface có `customerId` — không còn compile error.
- [ ] Race condition test: double complete → lần 2 trả error.
- [ ] Counter integrity: `completed_sessions` = COUNT từ DB sau concurrent complete.
- [ ] KTV chỉ hoàn thành lịch của mình — verified cả mobile UI và RPC.
- [ ] `saveSessionNote` dùng RPC — không còn direct update.
- [ ] Customer profile load đúng (limit 5 bookings, TODO active booking documented).
- [ ] Backlog items được ghi rõ với deadline.
- [ ] CI pass: `shared:typecheck` + `mobile:typecheck` + web `build`.
