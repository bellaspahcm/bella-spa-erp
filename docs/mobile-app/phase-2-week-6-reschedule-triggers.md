# Bella ERP Mobile App — Phase 2 Tuần 6: Reschedule & Database Triggers Automation
## Phiên bản v2.0 — Áp dụng đánh giá kiến trúc

**Ngày tạo:** 2026-06-21 | **Cập nhật:** 2026-06-21 (v2.0)
**Tiền điều kiện:** Phase 2 (Tuần 5) DoD hoàn thành

---

## Changelog v1.0 → v2.0

Dựa trên đánh giá kiến trúc, các vấn đề sau đây đã được xác định và xử lý trong bản v2.0:

| # | Vấn đề | Mức độ | Trạng thái |
|---|---|---|---|
| 1 | **Bug bảo mật:** Tenant isolation trong RPC reschedule — `v_tenant_id` bị ghi đè 2 lần, không kiểm tra cross-tenant | 🔴 Bắt buộc | ✅ Đã fix |
| 2 | **Bug runtime:** `clientActionId` dùng `Math.random()` thay vì UUID chuẩn — RPC yêu cầu type `UUID` | 🔴 Bắt buộc | ✅ Đã fix |
| 3 | **Bug timezone:** `date.toISOString().split('T')[0]` gây lệch ngày ở UTC+7 | 🔴 Bắt buộc | ✅ Đã fix |
| 4 | **Bug race condition:** Reschedule không có row lock — 2 Admin có thể race | 🔴 Bắt buộc | ✅ Đã fix |
| 5 | **Thiếu Audit Trail:** Không ghi lại ai dời, từ ngày nào, sang ngày nào | 🔴 Bắt buộc | ✅ Đã thêm |
| 6 | **Trigger gánh quá nhiều:** inventory + accounting + review trong cùng transaction | 🟡 Nên làm | ✅ Đã tách |
| 7 | **Xác nhận inventory atomic:** UPDATE phải là 1 lệnh, không SELECT rồi UPDATE | 🟡 Nên làm | ✅ Đã xác nhận |
| 8 | **Thiếu test:** Cross-tenant, timezone edge, double reschedule race, state conflict | 🟡 Nên làm | ✅ Đã bổ sung |
| 9 | **DoD chưa đủ:** Chưa verify trigger idempotency và unique constraint | 🟡 Nên làm | ✅ Đã bổ sung |

---

## Tổng Quan & Mục Tiêu

Tuần 6 tập trung giải quyết lỗ hổng bất đồng bộ nghiệp vụ giữa Mobile và Web, đồng thời cung cấp tính năng dời lịch hẹn ngay trên mobile:

1. **Database Trigger Automation (Chốt ca tự động — Kiến trúc 2 lớp):**
   - **Critical path** (trong transaction session complete): Chỉ gồm trừ kho `inventory_items` — atomic, rollback an toàn.
   - **Deferred side-effects** (sau transaction, fire-and-forget): Kích hoạt `accounting_outbox` và `session_reviews` thông qua function riêng được gọi từ `AFTER` trigger — lỗi side-effect **không** rollback session complete.

2. **Dời lịch hẹn (Reschedule) từ Mobile — Đã hardened:**
   - RPC với tenant isolation đúng, row-level locking chống race condition, audit trail.
   - Mobile: UUID đúng chuẩn, format ngày theo local timezone UTC+7.

---

## 1. Supabase Backend — Automation Triggers (Kiến Trúc 2 Lớp)

### Vấn đề với v1.0 (trigger monolith)

```
session completed → inventory → accounting_outbox → session_reviews
                   (cùng 1 transaction)
```

Nếu `accounting_outbox` insert fail do constraint → **toàn bộ rollback** → KTV thấy "Hoàn thành thất bại" dù lỗi thực chất là accounting.

### Kiến trúc v2.0 (tách critical path & deferred)

```
BEFORE UPDATE trigger (critical path):
  session status → 'completed'
  └── inventory consume (atomic UPDATE, không SELECT trước)
  └── inventory_logs ghi nhận
  └── [RETURN NEW — transaction commit]

AFTER UPDATE trigger (deferred side-effects):
  └── fn_enqueue_session_accounting()   → accounting_outbox
  └── fn_ensure_session_review()        → session_reviews
  (lỗi ở đây chỉ log, không rollback session đã complete)
```

---

### [NEW] `20260719000000_session_completion_triggers.sql`

```sql
-- supabase/migrations/20260719000000_session_completion_triggers.sql
-- =================================================================
-- PHẦN 1: CRITICAL PATH — Trừ kho atomic trong BEFORE trigger
-- =================================================================

CREATE OR REPLACE FUNCTION public.fn_on_session_completed_inventory()
RETURNS TRIGGER AS $$
DECLARE
    v_package_id UUID;
    v_auto_consume BOOLEAN := FALSE;
    r_material RECORD;
BEGIN
    -- Chỉ kích hoạt khi status đổi thành 'completed'
    IF NOT (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed')) THEN
        RETURN NEW;
    END IF;

    -- Lấy package_id từ booking
    SELECT b.package_id INTO v_package_id
    FROM public.bookings b
    WHERE b.id = NEW.booking_id AND b.tenant_id = NEW.tenant_id;

    -- Kiểm tra cấu hình auto consume
    SELECT COALESCE((tenants.salary_config->>'auto_consume_inventory')::BOOLEAN, FALSE)
    INTO v_auto_consume
    FROM public.tenants
    WHERE tenants.id = NEW.tenant_id;

    IF NOT (v_auto_consume AND v_package_id IS NOT NULL) THEN
        RETURN NEW;
    END IF;

    -- Trừ kho: ATOMIC UPDATE (không SELECT trước, tránh race condition)
    -- stock_level = stock_level - qty đảm bảo atomic trên PostgreSQL
    FOR r_material IN
        SELECT pm.item_id, pm.quantity_per_session, ii.price_per_unit, ii.name AS item_name
        FROM public.package_materials pm
        JOIN public.inventory_items ii ON pm.item_id = ii.id AND ii.tenant_id = NEW.tenant_id
        WHERE pm.package_id = v_package_id AND pm.tenant_id = NEW.tenant_id
    LOOP
        -- Atomic: 1 lệnh UPDATE duy nhất, PostgreSQL row lock tự động
        UPDATE public.inventory_items
        SET
            stock_level = stock_level - r_material.quantity_per_session,
            updated_at = NOW()
        WHERE id = r_material.item_id AND tenant_id = NEW.tenant_id;

        -- Ghi log xuất kho
        INSERT INTO public.inventory_logs (
            tenant_id, item_id, change_amount, reason,
            session_log_id, created_by,
            business_event_type, accounting_review_status,
            accounting_metadata
        ) VALUES (
            NEW.tenant_id,
            r_material.item_id,
            -r_material.quantity_per_session,
            'Tự động tiêu hao buổi #' || NEW.session_number || ' / Booking ' || NEW.booking_id,
            NEW.id,
            NEW.completed_by_ktv_id,
            'session_completed_material_deduction',
            'pending',
            jsonb_build_object(
                'booking_id', NEW.booking_id,
                'session_number', NEW.session_number,
                'quantity_deducted', r_material.quantity_per_session,
                'item_name', r_material.item_name
            )
        );
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- BEFORE trigger: critical path (rollback nếu inventory fail — có thể chấp nhận)
DROP TRIGGER IF EXISTS trig_session_completed_inventory ON public.session_logs;
CREATE TRIGGER trig_session_completed_inventory
    BEFORE UPDATE OF status ON public.session_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_on_session_completed_inventory();


-- =================================================================
-- PHẦN 2: DEFERRED SIDE-EFFECTS — Accounting & Review sau transaction
-- =================================================================

CREATE OR REPLACE FUNCTION public.fn_on_session_completed_deferred()
RETURNS TRIGGER AS $$
DECLARE
    v_package_id UUID;
    v_booking_number TEXT;
    v_package_name TEXT;
    v_full_price NUMERIC;
    v_discount_percent NUMERIC;
    v_total_sessions INTEGER;
    v_commission NUMERIC;
    v_discounted_price NUMERIC;
    v_earned_revenue NUMERIC;
    v_total_material_cost NUMERIC := 0;
BEGIN
    IF NOT (NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed')) THEN
        RETURN NEW;
    END IF;

    -- Đọc thông tin booking để tính revenue
    SELECT
        b.package_id,
        b.booking_number,
        b.package_name,
        COALESCE(b.full_price, 0),
        COALESCE(b.discount_percent, 0),
        COALESCE(b.total_sessions, 1),
        COALESCE(b.ktv_commission, 0)
    INTO
        v_package_id, v_booking_number, v_package_name,
        v_full_price, v_discount_percent, v_total_sessions, v_commission
    FROM public.bookings b
    WHERE b.id = NEW.booking_id AND b.tenant_id = NEW.tenant_id;

    -- Tính earned revenue cho buổi này
    v_discounted_price := v_full_price * (1 - v_discount_percent / 100.0);
    v_earned_revenue := v_discounted_price / GREATEST(v_total_sessions, 1);

    -- Tính tổng chi phí vật tư đã tiêu hao (lấy từ inventory_logs vừa insert trong BEFORE trigger)
    SELECT COALESCE(SUM(ABS(il.change_amount) * ii.price_per_unit), 0)
    INTO v_total_material_cost
    FROM public.inventory_logs il
    JOIN public.inventory_items ii ON il.item_id = ii.id
    WHERE il.session_log_id = NEW.id
      AND il.business_event_type = 'session_completed_material_deduction';

    -- Enqueue INVENTORY_CONSUMED nếu có chi phí vật tư
    IF v_total_material_cost > 0 THEN
        INSERT INTO public.accounting_outbox (
            tenant_id, event_type, reference_type, reference_id, payload, status
        ) VALUES (
            NEW.tenant_id,
            'INVENTORY_CONSUMED',
            'SESSION_LOG',
            NEW.id,
            jsonb_build_object(
                'amount', v_total_material_cost,
                'description', 'Vật tư tiêu hao ca trị liệu, buổi ID: ' || NEW.id,
                'branchId', NEW.tenant_id
            ),
            'pending'
        ) ON CONFLICT DO NOTHING;  -- idempotency: không fail nếu đã tồn tại
    END IF;

    -- Enqueue SESSION_DONE cho kế toán doanh thu
    -- NOTE: Logic tính hoa hồng ở đây là đơn giản hoá.
    -- Worker kế toán (accounting_outbox processor) nên re-compute từ salary_config
    -- để linh hoạt với business rule thay đổi theo thời gian.
    INSERT INTO public.accounting_outbox (
        tenant_id, event_type, reference_type, reference_id, payload, status
    ) VALUES (
        NEW.tenant_id,
        'SESSION_DONE',
        'SESSION_LOG',
        NEW.id,
        jsonb_build_object(
            'earnedRevenueAmount', v_earned_revenue,
            'deferredRevenueAmount', 0,
            'receivableAmount', v_earned_revenue,
            'bookingId', NEW.booking_id,
            'commissionAmount', v_commission,
            'ktvId', NEW.completed_by_ktv_id,
            'branchId', NEW.tenant_id,
            'description',
                'Hoàn thành buổi ' || NEW.session_number || '/' || v_total_sessions ||
                ' - ' || COALESCE(v_package_name, 'Gói dịch vụ')
        ),
        'pending'
    ) ON CONFLICT DO NOTHING;

    -- Tạo placeholder review (idempotent với ON CONFLICT DO NOTHING)
    INSERT INTO public.session_reviews (
        session_log_id, reviewer_id, ktv_id, rating, note, status, tenant_id
    ) VALUES (
        NEW.id,
        (SELECT customer_id FROM public.bookings WHERE id = NEW.booking_id),
        NEW.completed_by_ktv_id,
        5,
        'Chờ khách hàng đánh giá',
        'pending_review',
        NEW.tenant_id
    ) ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Deferred side-effects fail → chỉ log lỗi, KHÔNG rollback session complete
    -- Session đã được commit bởi BEFORE trigger. Đây là intentional.
    RAISE WARNING '[fn_on_session_completed_deferred] Side-effect error for session_log %: %',
        NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AFTER trigger: deferred (lỗi không rollback session complete)
DROP TRIGGER IF EXISTS trig_session_completed_deferred ON public.session_logs;
CREATE TRIGGER trig_session_completed_deferred
    AFTER UPDATE OF status ON public.session_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_on_session_completed_deferred();
```

> **Lý do tách 2 trigger:**
> - `BEFORE` trigger (`trig_session_completed_inventory`): Nằm trong transaction → rollback nếu kho trừ fail. Đây là hành vi chấp nhận được — nếu không trừ được kho, session không nên complete.
> - `AFTER` trigger (`trig_session_completed_deferred`): Sau khi transaction commit → lỗi accounting/review **không** rollback session. Accounting worker sẽ xử lý retry sau.

---

## 2. Supabase Backend — Reschedule RPC (Đã Hardened)

### [NEW] `20260719000001_mobile_reschedule_rpc.sql`

Bản v2.0 sửa 4 vấn đề: tenant isolation, race condition (row lock), audit trail, và validation bổ sung.

```sql
-- supabase/migrations/20260719000001_mobile_reschedule_rpc.sql

CREATE OR REPLACE FUNCTION public.rpc_mobile_reschedule_session(
    p_session_id UUID,
    p_assigned_date DATE,
    p_assigned_time TIME,
    p_client_action_id UUID
)
RETURNS JSONB AS $$
DECLARE
    v_already_processed BOOLEAN;
    v_user_tenant_id UUID;
    v_user_role TEXT;
    v_session_tenant_id UUID;
    v_booking_id UUID;
    v_old_assigned_date DATE;
    v_old_assigned_time TIME;
    v_assigned_ktv_id UUID;
    v_session_status TEXT;
BEGIN
    -- 1. Idempotency check
    SELECT EXISTS(
        SELECT 1 FROM public.mobile_processed_actions
        WHERE client_action_id = p_client_action_id
    ) INTO v_already_processed;

    IF v_already_processed THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Yêu cầu dời lịch đã được thực hiện trước đó');
    END IF;

    -- 2. Đọc thông tin người dùng hiện tại
    SELECT tenant_id, role
    INTO v_user_tenant_id, v_user_role
    FROM public.users
    WHERE id = auth.uid();

    IF v_user_tenant_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Không xác định được chi nhánh người dùng', 'code', 'AUTH_ERROR');
    END IF;

    -- 3. Lock row session để chống race condition (SELECT FOR UPDATE)
    --    Hai request reschedule cùng lúc sẽ serialize tại đây
    SELECT
        booking_id,
        tenant_id,
        assigned_date,
        assigned_time,
        status
    INTO
        v_booking_id,
        v_session_tenant_id,
        v_old_assigned_date,
        v_old_assigned_time,
        v_session_status
    FROM public.session_logs
    WHERE id = p_session_id
    FOR UPDATE;  -- Row-level lock: chống double reschedule

    IF v_booking_id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Không tìm thấy buổi hẹn', 'code', 'NOT_FOUND');
    END IF;

    -- 4. FIX: Kiểm tra tenant isolation — user phải thuộc cùng tenant với session
    IF v_user_tenant_id <> v_session_tenant_id THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Không có quyền truy cập buổi hẹn này',
            'code', 'CROSS_TENANT_VIOLATION'
        );
    END IF;

    -- 5. Chỉ được dời lịch khi status = 'scheduled'
    IF v_session_status <> 'scheduled' THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Không thể dời lịch buổi hẹn đã hoàn thành, đã huỷ hoặc đang diễn ra',
            'code', 'STATE_CONFLICT'
        );
    END IF;

    -- 6. Kiểm tra quyền dời lịch (Admin/super_admin được tất cả, KTV chỉ được ca của mình)
    SELECT assigned_ktv_id INTO v_assigned_ktv_id
    FROM public.bookings
    WHERE id = v_booking_id AND tenant_id = v_session_tenant_id;

    IF v_user_role NOT IN ('admin', 'super_admin', 'hr') AND v_assigned_ktv_id <> auth.uid() THEN
        RETURN jsonb_build_object(
            'ok', false,
            'error', 'Bạn không có quyền dời lịch buổi hẹn của người khác',
            'code', 'UNAUTHORIZED'
        );
    END IF;

    -- 7. Thực thi cập nhật (đã có row lock từ bước 3)
    UPDATE public.session_logs
    SET
        assigned_date = p_assigned_date,
        assigned_time = p_assigned_time,
        updated_at = NOW()
    WHERE id = p_session_id AND tenant_id = v_session_tenant_id;

    -- 8. Audit trail: ghi lại ai dời, từ ngày nào, sang ngày nào
    INSERT INTO public.audit_logs (
        tenant_id,
        table_name,
        record_id,
        action,
        old_data,
        new_data,
        performed_by
    ) VALUES (
        v_session_tenant_id,
        'session_logs',
        p_session_id,
        'RESCHEDULE',
        jsonb_build_object(
            'assigned_date', v_old_assigned_date,
            'assigned_time', v_old_assigned_time
        ),
        jsonb_build_object(
            'assigned_date', p_assigned_date,
            'assigned_time', p_assigned_time
        ),
        auth.uid()
    );

    -- 9. Idempotency record
    INSERT INTO public.mobile_processed_actions (client_action_id, user_id, action_type)
    VALUES (p_client_action_id, auth.uid(), 'RESCHEDULE');

    RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', 'DB_ERROR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.rpc_mobile_reschedule_session(UUID, DATE, TIME, UUID) TO authenticated;
```

---

## 3. Mobile App — Tích Hợp Giao Diện (Đã Fix)

### [NEW] `apps/mobile/src/services/schedule/rescheduleSession.ts`

```typescript
// apps/mobile/src/services/schedule/rescheduleSession.ts
import { getMobileSupabase } from '../../lib/supabase';

interface RescheduleInput {
  sessionId: string;
  assignedDate: string; // 'YYYY-MM-DD' — format theo local timezone
  assignedTime: string; // 'HH:MM:SS'
  clientActionId: string; // UUID v4 chuẩn
}

export async function rescheduleSessionApi(
  input: RescheduleInput
): Promise<{ ok: boolean; error?: string; code?: string }> {
  const supabase = getMobileSupabase();
  const { data, error } = await supabase.rpc('rpc_mobile_reschedule_session', {
    p_session_id: input.sessionId,
    p_assigned_date: input.assignedDate,
    p_assigned_time: input.assignedTime,
    p_client_action_id: input.clientActionId,
  });

  if (error) return { ok: false, error: error.message, code: 'DB_ERROR' };
  return data as { ok: boolean; error?: string; code?: string };
}
```

### [NEW] `apps/mobile/src/lib/dateUtils.ts`

Tiện ích format ngày theo **local timezone** — tránh bug UTC+7 lệch ngày.

```typescript
// apps/mobile/src/lib/dateUtils.ts

/**
 * Format Date object thành 'YYYY-MM-DD' theo local timezone (không dùng toISOString).
 *
 * Lý do: toISOString() trả về UTC. Tại Việt Nam (UTC+7), vào 00:30 ngày 20/07,
 * toISOString() sẽ trả về 2026-07-19T17:30:00Z → split('T')[0] = '2026-07-19' (sai ngày).
 *
 * Hàm này dùng getFullYear/getMonth/getDate — luôn theo local timezone.
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format Date object thành 'HH:MM:SS' theo local timezone.
 */
export function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}
```

### [NEW] `apps/mobile/src/components/RescheduleModal.tsx`

```typescript
// apps/mobile/src/components/RescheduleModal.tsx
import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator
} from 'react-native';
// FIX: Dùng uuid v4 chuẩn thay vì Math.random()
// Cần: npm install react-native-get-random-values uuid @types/uuid
// Và import 'react-native-get-random-values' ở entry point (App.tsx/_layout.tsx)
import { v4 as uuidv4 } from 'uuid';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useOffline } from '../contexts/OfflineContext';
import { rescheduleSessionApi } from '../services/schedule/rescheduleSession';
// FIX: Dùng formatLocalDate/formatLocalTime thay vì toISOString()
import { formatLocalDate, formatLocalTime } from '../lib/dateUtils';

interface RescheduleModalProps {
  visible: boolean;
  sessionId: string;
  currentDate: string;   // 'YYYY-MM-DD'
  currentTime: string | null;  // 'HH:MM:SS' hoặc null
  onClose: () => void;
  onSuccess: (newDate: string, newTime: string) => void;
}

export function RescheduleModal({
  visible, sessionId, currentDate, currentTime, onClose, onSuccess
}: RescheduleModalProps) {
  const { isOnline, enqueueOfflineAction } = useOffline();

  // Parse date đúng cách: 'YYYY-MM-DD' → local midnight (không qua UTC)
  const parseLocalDate = (dateStr: string): Date => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const [date, setDate] = useState<Date>(parseLocalDate(currentDate));
  const [time, setTime] = useState<Date>(() => {
    if (currentTime) {
      const [h, min, s] = currentTime.split(':').map(Number);
      const t = parseLocalDate(currentDate);
      t.setHours(h, min, s || 0, 0);
      return t;
    }
    return new Date();
  });

  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [showTimePicker, setShowTimePicker] = useState(Platform.OS === 'ios');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);

    // FIX: Dùng formatLocalDate — không bị lệch ngày timezone
    const formattedDate = formatLocalDate(date);
    const formattedTime = formatLocalTime(time);

    // FIX: UUID v4 chuẩn — tương thích với kiểu UUID trong PostgreSQL RPC
    const clientActionId = uuidv4();

    if (!isOnline) {
      const queued = await enqueueOfflineAction('RESCHEDULE', {
        sessionId,
        assignedDate: formattedDate,
        assignedTime: formattedTime,
        clientActionId, // Lưu cùng payload để dùng lại khi sync
      });

      setIsSubmitting(false);
      if (queued) {
        onSuccess(formattedDate, formattedTime);
        onClose();
      } else {
        setError('Hàng đợi lưu trữ ngoại tuyến bị đầy.');
      }
      return;
    }

    const res = await rescheduleSessionApi({
      sessionId,
      assignedDate: formattedDate,
      assignedTime: formattedTime,
      clientActionId,
    });

    setIsSubmitting(false);
    if (res.ok) {
      onSuccess(formattedDate, formattedTime);
      onClose();
    } else {
      const errorMessages: Record<string, string> = {
        CROSS_TENANT_VIOLATION: 'Không có quyền truy cập buổi hẹn này.',
        UNAUTHORIZED: 'Bạn không có quyền dời lịch buổi hẹn của người khác.',
        STATE_CONFLICT: 'Buổi hẹn đã hoàn thành hoặc bị huỷ, không thể dời lịch.',
        NOT_FOUND: 'Không tìm thấy buổi hẹn.',
      };
      setError(errorMessages[res.code ?? ''] || res.error || 'Dời lịch thất bại');
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          <Text style={styles.title}>Dời lịch buổi hẹn</Text>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <View style={styles.pickerSection}>
            <Text style={styles.label}>Chọn ngày làm việc mới:</Text>
            {Platform.OS === 'android' && !showDatePicker && (
              <TouchableOpacity
                style={styles.btnPicker}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.btnPickerText}>
                  {date.toLocaleDateString('vi-VN')}
                </Text>
              </TouchableOpacity>
            )}
            {(showDatePicker || Platform.OS === 'ios') && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={(_e, selectedDate) => {
                  if (Platform.OS === 'android') setShowDatePicker(false);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}
          </View>

          <View style={styles.pickerSection}>
            <Text style={styles.label}>Chọn giờ hẹn mới:</Text>
            {Platform.OS === 'android' && !showTimePicker && (
              <TouchableOpacity
                style={styles.btnPicker}
                onPress={() => setShowTimePicker(true)}
              >
                <Text style={styles.btnPickerText}>
                  {time.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            )}
            {(showTimePicker || Platform.OS === 'ios') && (
              <DateTimePicker
                value={time}
                mode="time"
                display="default"
                onChange={(_e, selectedTime) => {
                  if (Platform.OS === 'android') setShowTimePicker(false);
                  if (selectedTime) setTime(selectedTime);
                }}
              />
            )}
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.btnCancel}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.btnCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnOk, isSubmitting && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.btnOkText}>Xác nhận</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '85%',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 20,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#111827',
  },
  pickerSection: { marginVertical: 12 },
  label: { fontSize: 14, color: '#6B7280', marginBottom: 6 },
  btnPicker: {
    padding: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnPickerText: { fontSize: 15, color: '#1F2937' },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  btnCancel: {
    padding: 10,
    width: '45%',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#E5E7EB',
  },
  btnCancelText: { color: '#4B5563', fontWeight: '600' },
  btnOk: {
    padding: 10,
    width: '45%',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  btnDisabled: { backgroundColor: '#9CA3AF' },
  btnOkText: { color: '#FFF', fontWeight: '600' },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
});
```

### Cập nhật `OfflineContext.tsx` — RESCHEDULE action

```typescript
// Thêm loại action mới
export type OfflineActionType = 'CHECKIN' | 'CHECKOUT' | 'SUBMIT_NOTE' | 'RESCHEDULE';

// Case xử lý RESCHEDULE trong executeServerAction
// NOTE: clientActionId được lưu trong payload (bởi RescheduleModal khi offline)
case 'RESCHEDULE': {
  const { sessionId, assignedDate, assignedTime, clientActionId } = action.payload;
  const { data, error } = await supabase.rpc('rpc_mobile_reschedule_session', {
    p_session_id: sessionId,
    p_assigned_date: assignedDate,
    p_assigned_time: assignedTime,
    p_client_action_id: clientActionId ?? action.clientActionId,
  });
  if (error) return { ok: false, error: error.message, code: 'DB_ERROR' };
  return data as { ok: boolean; error?: string; code?: string };
}
```

---

## 4. Cài Đặt Dependencies

```bash
# Trong thư mục apps/mobile
npm install react-native-get-random-values uuid @types/uuid
npm install @react-native-community/datetimepicker
```

**Entry point** (`App.tsx` hoặc `_layout.tsx` — phải import trước tất cả):

```typescript
// Bắt buộc import trước khi dùng uuid
import 'react-native-get-random-values';
```

---

## Thứ Tự Thực Thi (Sequenced)

```
── Supabase Backend ──────────────────────────────────────────────────────
Bước 1   Apply migration 20260719000000_session_completion_triggers.sql
          → 2 triggers tách biệt: critical path (BEFORE) + deferred (AFTER)
          → Verify: BEFORE trigger rollback nếu inventory fail
          → Verify: AFTER trigger lỗi không rollback session complete

Bước 2   Apply migration 20260719000001_mobile_reschedule_rpc.sql
          → RPC hardened: tenant isolation, row lock, audit trail
          → Verify: SELECT ... FOR UPDATE ngăn double reschedule

Bước 3   Kiểm thử trong Supabase Studio
          → Test trigger idempotency: update session 2 lần — accounting/review chỉ 1 bản ghi
          → Test cross-tenant: user tenant A không thể reschedule session tenant B

── Mobile App ────────────────────────────────────────────────────────────
Bước 4   Cài đặt dependencies (uuid, react-native-get-random-values, datetimepicker)
          → Thêm import 'react-native-get-random-values' vào entry point

Bước 5   Tạo apps/mobile/src/lib/dateUtils.ts
          → formatLocalDate() + formatLocalTime()

Bước 6   Cập nhật contexts/OfflineContext.tsx (RESCHEDULE action type + handler)

Bước 7   Tạo apps/mobile/src/services/schedule/rescheduleSession.ts

Bước 8   Tạo apps/mobile/src/components/RescheduleModal.tsx
          → Dùng formatLocalDate/formatLocalTime (không dùng toISOString)
          → Dùng uuidv4() cho clientActionId

Bước 9   Cập nhật app/(app)/session/[id].tsx
          → Nút "Dời lịch" chỉ hiển thị khi status = 'scheduled'
          → Mở RescheduleModal + update local cache sau success
```

---

## Verification Plan (Kịch Bản Kiểm Thử — Bổ Sung)

### 1. Database Automation Trigger

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Hoàn thành buổi hẹn (package có định mức vật tư) | `stock_level` giảm đúng số lượng; `inventory_logs` có 1 bản ghi âm |
| 2 | Kiểm tra `accounting_outbox` sau hoàn thành | 2 event: `SESSION_DONE` + `INVENTORY_CONSUMED` — payload đầy đủ |
| 3 | Kiểm tra `session_reviews` sau hoàn thành | 1 bản ghi `pending_review` — idempotent (`ON CONFLICT DO NOTHING`) |
| 4 | **NEW** Cố tình làm lỗi `accounting_outbox` (ví dụ: sai constraint) | Session vẫn `completed`, log WARNING ở PostgreSQL, session không rollback |
| 5 | **NEW** Update session_logs.status = 'completed' hai lần | Trigger chạy 2 lần nhưng `ON CONFLICT DO NOTHING` → outbox/review chỉ 1 bản ghi |
| 6 | **NEW** 2 KTV hoàn thành cùng lúc (concurrent) | Inventory giảm đúng tổng 2 lần — không bị race condition vì UPDATE atomic |

### 2. Reschedule Verification

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | KTV A dời lịch ca của mình | `{ ok: true }`, lịch đổi, audit_logs có bản ghi |
| 2 | KTV A dời lịch ca của KTV B | `UNAUTHORIZED` |
| 3 | **NEW** User tenant A dời session của tenant B (cross-tenant) | `CROSS_TENANT_VIOLATION` — bug bảo mật đã được fix |
| 4 | Dời buổi đã `completed` hoặc `cancelled` | `STATE_CONFLICT` |
| 5 | Gửi cùng `client_action_id` hai lần | Lần 2 trả về `{ ok: true, message: 'Yêu cầu đã thực hiện trước đó' }` |
| 6 | **NEW** 2 Admin dời lịch cùng buổi, cùng lúc | `FOR UPDATE` serialize — người thứ 2 thực thi sau khi người thứ 1 xong |
| 7 | Offline mode: dời lịch ở Airplane Mode | Badge "Chờ đồng bộ" hiển thị, action lưu AsyncStorage |
| 8 | Kết nối lại mạng | SyncAgent đồng bộ, badge biến mất |
| 9 | **NEW** Kiểm tra ngày gần nửa đêm (23:50 UTC+7) | `formatLocalDate()` trả về đúng ngày Việt Nam — không bị lệch sang hôm trước |
| 10 | **NEW** Kiểm tra `audit_logs` sau reschedule | Có bản ghi `action = 'RESCHEDULE'`, `old_data.assigned_date` đúng ngày cũ |

---

## Danh Sách File Checklist

| File | Trạng thái | Ghi chú |
|---|---|---|
| `supabase/migrations/20260719000000_session_completion_triggers.sql` | **NEW v2** | 2 triggers tách: BEFORE critical + AFTER deferred |
| `supabase/migrations/20260719000001_mobile_reschedule_rpc.sql` | **NEW v2** | Tenant isolation, row lock, audit trail |
| `apps/mobile/package.json` | **MODIFY** | Thêm `uuid`, `react-native-get-random-values`, `datetimepicker` |
| `apps/mobile/src/lib/dateUtils.ts` | **NEW** | `formatLocalDate()` + `formatLocalTime()` |
| `apps/mobile/src/contexts/OfflineContext.tsx` | **MODIFY** | RESCHEDULE action type + handler |
| `apps/mobile/src/services/schedule/rescheduleSession.ts` | **NEW** | API service gửi lệnh dời lịch |
| `apps/mobile/src/components/RescheduleModal.tsx` | **NEW v2** | UUID chuẩn, local timezone date format |
| `apps/mobile/src/app/(app)/session/[id].tsx` | **MODIFY** | Nút dời lịch + mở modal |
| `apps/mobile/src/app/_layout.tsx` | **MODIFY** | Import `react-native-get-random-values` ở entry |

---

## Rủi Ro & Biện Pháp Giảm Thiểu

| Rủi ro | Mức độ | Giải pháp |
|---|---|---|
| Tồn kho âm khi trừ kho | Cao | Cho phép âm (làm trước nhập sau), ghi WARNING log nếu `stock_level < 0` |
| `FOR UPDATE` lock timeout khi nhiều request | Thấp | Timeout mặc định PostgreSQL đủ cho ERP quy mô nhỏ (<100 concurrent users) |
| Accounting deferred fail — outbox bị bỏ sót | Trung bình | `accounting_outbox` processor cần retry logic; monitor WARNING logs |
| `react-native-get-random-values` không được import trước | Cao | Kiểm tra entry point `_layout.tsx` — test `uuidv4()` ở dev mode |
| KTV dời lịch sang giờ trùng ca khác | Trung bình | UI hiển thị danh sách buổi trong ngày; không block ở DB để linh hoạt |

---

## Định Nghĩa Hoàn Thành (DoD) — v2.0

- [ ] **BEFORE trigger** `trig_session_completed_inventory`: Trừ kho atomic (1 UPDATE, không SELECT trước), rollback đúng nếu inventory fail.
- [ ] **AFTER trigger** `trig_session_completed_deferred`: Lỗi accounting/review không rollback session complete — verify bằng cách inject lỗi.
- [ ] **Trigger idempotency**: Update session 2 lần → `accounting_outbox` và `session_reviews` vẫn chỉ 1 bản ghi (`ON CONFLICT DO NOTHING`).
- [ ] **RPC tenant isolation**: User tenant A không thể reschedule session tenant B → `CROSS_TENANT_VIOLATION`.
- [ ] **RPC race condition**: `SELECT FOR UPDATE` serialize 2 concurrent reschedule — kiểm tra bằng 2 concurrent requests.
- [ ] **Audit trail**: Mỗi reschedule tạo bản ghi trong `audit_logs` với `old_data` và `new_data`.
- [ ] **UUID đúng chuẩn**: `uuidv4()` hoạt động trên cả iOS và Android (verify `react-native-get-random-values` đã import đúng chỗ).
- [ ] **Timezone**: `formatLocalDate()` trả về đúng ngày Việt Nam UTC+7 tại thời điểm 23:50 — test edge case.
- [ ] **`mobile_processed_actions`** có UNIQUE constraint trên `client_action_id` — verify bằng `\d mobile_processed_actions`.
- [ ] Dời lịch offline → Sync Agent đồng bộ đúng khi online.
- [ ] CI pass: Mobile typecheck + Web build không lỗi regression.
