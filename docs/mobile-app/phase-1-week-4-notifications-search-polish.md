# Bella ERP Mobile App — Phase 1 Tuần 4: Notifications, Search & Polish
## Phiên bản v2.0 — Sau review

**Ngày tạo:** 2026-06-21
**Cập nhật:** 2026-06-21 — Áp dụng 8 điểm sau review
**Tiền điều kiện:** Tuần 3 DoD hoàn thành

---

## Tổng Hợp Thay Đổi So Với v1.0

| # | Vấn đề | Mức độ | Thay đổi |
|---|--------|--------|---------|
| 1 | `app_notifications` không có `target_user_id` → KTV thấy notification của nhau | 🔴 Bắt buộc | Thêm migration `target_user_id UUID NULL` + cập nhật RLS |
| 2 | Nhiều component subscribe realtime riêng → duplicate channels | 🔴 Bắt buộc | `NotificationContext` là nơi duy nhất subscribe — component chỉ `useContext()` |
| 3 | DoD gọi "push notification hoàn chỉnh" sai — chỉ là registration | 🔴 Bắt buộc | Đổi wording trong DoD + toàn bộ tài liệu |
| 4 | `device_tokens` UNIQUE constraint chưa rõ trong migration | 🔴 Bắt buộc | Confirm + document `UNIQUE(user_id, expo_push_token)` |
| 5 | Search không cache → nhiều request khi gõ dần | 🟡 Nên làm | Map-based cache 30s, key = normalized query |
| 6 | `markRead` optimistic không rollback khi DB fail | 🟡 Nên làm | Lưu `previous` state, rollback nếu error |
| 7 | `setupPushNotifications()` có thể block/crash auth flow | 🟡 Nên làm | Tách hoàn toàn, fire-and-forget, không `await` |
| 8 | Migration `target_user_id` cần làm ngay | 🟡 Nên làm | Giống điểm 1 — migration ngay Bước 2 |

---

## Phát Hiện Từ Codebase Trước Khi Lên Kế Hoạch

### 1. `fn_sync_booking_progress` — trigger chưa được đăng ký

Hàm [`fn_sync_booking_progress`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260518000002_optimize_booking_triggers.sql)
đã định nghĩa từ tháng 5 nhưng **không tìm thấy `CREATE TRIGGER` statement** trong 183 migrations.

**Bước 1 bắt buộc:** Verify trên Studio trước khi code bất cứ thứ gì.

### 2. `app_notifications` — không có `target_user_id` → phải sửa ngay

Table [`app_notifications`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260521000003_create_app_notifications.sql)
hiện tại: tenant-level, **không có `user_id`** → mọi người trong tenant đều thấy cùng notification.

**Vấn đề nghiêm trọng với ERP:**
```
KTV A được phân công khách mới
  ↓
Notification: "Bạn được phân công khách hàng Nguyễn Thị Hương"
  ↓
KTV B, KTV C, Admin đều thấy → sai hoàn toàn
```

**Giải pháp:** Thêm `target_user_id UUID NULL` ngay trong Tuần 4:
- `NULL` = broadcast đến toàn tenant (vẫn giữ backward compat)
- `NOT NULL` = chỉ user đó thấy

### 3. Không có push token storage — cần tạo mới

Không có `device_tokens` hay `expo_push_token` trong schema hiện tại.

### 4. Tên cột: `assigned_date` (không phải `scheduled_date`)

Xác nhận từ [`initial_schema.sql:79`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260511000000_initial_schema.sql#L79) — cột trong `session_logs` là `assigned_date DATE`.

---

## Mục Tiêu Tuần 4

**Tuần 4 = Hoàn thiện Phase 1 MVP**, đủ để deploy lên TestFlight/Play Store Internal:

1. **Optimistic UI** — hoàn thành buổi không lag
2. **In-app notification** — targeted (user-specific) + broadcast, single subscription
3. **Push token registration** — đăng ký Expo token (delivery pipeline = Phase 2)
4. **Weekly schedule view** — KTV xem lịch theo tuần
5. **Customer search** — tìm theo tên/SĐT với cache
6. **Trigger audit** — xác nhận `fn_sync_booking_progress`
7. **App polish** — EmptyState, Error boundaries đồng nhất

**Không trong Tuần 4:**
- Push delivery pipeline (Edge Function → Expo API) — Phase 2
- Offline sync — Phase 2
- Reschedule từ mobile — Phase 2

---

## Thứ Tự Thực Thi (26 bước)

```
── Nhóm A: Trigger audit ─────────────────────────────────────────────────
Bước 1   Verify fn_sync_booking_progress trigger có active không

── Nhóm B: Migrations ────────────────────────────────────────────────────
Bước 2   20260705_add_target_user_to_notifications.sql
          → target_user_id UUID NULL + cập nhật RLS (NULL = broadcast, NOT NULL = targeted)
Bước 3   20260705_device_tokens.sql
          → UNIQUE(user_id, expo_push_token) — upsert safe
Bước 4   20260705_mobile_search_rpc.sql
          → rpc_mobile_search_customers(p_query TEXT)
Bước 5   Apply tất cả migrations + verify

── Nhóm C: Services ─────────────────────────────────────────────────────
Bước 6   services/notification/fetchNotifications.ts — filter target_user_id
Bước 7   services/notification/markNotificationRead.ts
Bước 8   services/notification/registerPushToken.ts
Bước 9   services/search/searchCustomers.ts (gọi RPC)
Bước 10  services/schedule/fetchWeeklySchedule.ts

── Nhóm D: Context (single subscription) ────────────────────────────────
Bước 11  Tạo contexts/NotificationContext.tsx
          → DUY NHẤT nơi subscribe realtime
          → Expose: notifications, unreadCount, markRead (với rollback), markAllRead

── Nhóm E: Hooks ─────────────────────────────────────────────────────────
Bước 12  Tạo useOptimisticSession.ts
Bước 13  Tạo useCustomerSearch.ts (debounce 300ms + cache 30s)
Bước 14  Tạo useWeeklySchedule.ts
          → KHÔNG tạo useNotifications riêng — chỉ dùng useNotificationContext()

── Nhóm F: Push notification (isolated) ────────────────────────────────
Bước 15  Tạo lib/pushNotifications.ts
Bước 16  Tích hợp vào AuthContext — fire-and-forget, không await, không throw

── Nhóm G: Components ────────────────────────────────────────────────────
Bước 17  EmptyState.tsx — preset components
Bước 18  NotificationBell.tsx — đọc từ Context (không subscribe riêng)
Bước 19  NotificationItem.tsx
Bước 20  WeekCalendarStrip.tsx + DaySessionList.tsx
Bước 21  SearchBar.tsx + CustomerSearchResult.tsx
Bước 22  Cập nhật CompleteSessionButton — dùng useOptimisticSession

── Nhóm H: Screens ───────────────────────────────────────────────────────
Bước 23  Tạo app/(app)/notifications.tsx
Bước 24  Cập nhật schedule.tsx — WeekCalendarStrip
Bước 25  Tạo/cập nhật search.tsx
Bước 26  Cập nhật home.tsx — NotificationBell header

── Nhóm I: Verification ──────────────────────────────────────────────────
Bước 27  CI + manual testing theo checklist
```

---

## Chi Tiết Triển Khai

### Bước 1: Trigger audit

```sql
-- Chạy trong Supabase Studio
SELECT tgname, tgrelid::regclass, tgenabled
FROM pg_trigger
WHERE tgname ILIKE '%booking%' OR tgname ILIKE '%session%' OR tgname ILIKE '%progress%';
```

**Nếu không có row nào cho `session_logs`:**

```sql
-- supabase/migrations/20260705_register_booking_progress_trigger.sql
DROP TRIGGER IF EXISTS trig_sync_booking_progress ON public.session_logs;

CREATE TRIGGER trig_sync_booking_progress
    AFTER INSERT OR UPDATE OR DELETE
    ON public.session_logs
    FOR EACH ROW
    EXECUTE FUNCTION fn_sync_booking_progress();
-- fn_sync_booking_progress đã định nghĩa trong 20260518000002
-- Sau khi trigger active, Week 3 RPC manual UPDATE bookings là redundant (không sai, idempotent)
```

---

### Bước 2: Migration `target_user_id` — thêm ngay, không để Phase 2

```sql
-- supabase/migrations/20260705_add_target_user_to_notifications.sql
-- Thêm target_user_id để notification có thể targeted per-user
--
-- Thiết kế:
--   target_user_id = NULL   → broadcast toàn tenant (backward compat với dữ liệu hiện tại)
--   target_user_id = user   → chỉ user đó thấy

ALTER TABLE public.app_notifications
ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- Index để filter nhanh
CREATE INDEX IF NOT EXISTS idx_app_notifications_target_user
    ON public.app_notifications(target_user_id)
    WHERE target_user_id IS NOT NULL;

-- Cập nhật RLS: User thấy notification khi:
--   1. Cùng tenant VÀ target_user_id IS NULL (broadcast)
--   2. Cùng tenant VÀ target_user_id = user đó
DROP POLICY IF EXISTS "Users can view notifications for their tenant" ON public.app_notifications;

CREATE POLICY "User xem notification của mình hoặc broadcast"
    ON public.app_notifications FOR SELECT
    TO authenticated
    USING (
        tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
        AND (
            target_user_id IS NULL          -- broadcast
            OR target_user_id = auth.uid()  -- targeted cho user cụ thể
        )
    );

-- INSERT/UPDATE/DELETE giữ nguyên (system dùng service_role để insert)
COMMENT ON COLUMN public.app_notifications.target_user_id IS
    'NULL = broadcast đến toàn tenant. NOT NULL = chỉ user này thấy. '
    'Ví dụ: phân công KTV → target_user_id = ktv_id. '
    'Phase 2: push delivery đọc target_user_id để lấy device token.';
```

---

### Bước 3: `device_tokens` — UNIQUE constraint rõ ràng

```sql
-- supabase/migrations/20260705_device_tokens.sql

CREATE TABLE IF NOT EXISTS public.device_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    expo_push_token TEXT NOT NULL,
    platform        TEXT CHECK (platform IN ('ios', 'android')) NOT NULL,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- UNIQUE per (user, token): tránh duplicate row khi login/logout nhiều lần
    -- Upsert theo constraint này → luôn update last_seen_at, không tạo row mới
    CONSTRAINT uq_device_tokens_user_token UNIQUE (user_id, expo_push_token)
);

CREATE INDEX idx_device_tokens_user_id   ON public.device_tokens(user_id);
CREATE INDEX idx_device_tokens_tenant_id ON public.device_tokens(tenant_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- User chỉ quản lý token của chính mình
CREATE POLICY "User quản lý device token của mình"
    ON public.device_tokens FOR ALL TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        AND tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid())
    );

-- Service role đọc để gửi push (Phase 2)
GRANT SELECT ON public.device_tokens TO service_role;
GRANT ALL    ON public.device_tokens TO authenticated;

COMMENT ON TABLE public.device_tokens IS
    'Expo push tokens per device. '
    'Upsert theo UNIQUE(user_id, expo_push_token) — login/logout nhiều lần không tạo duplicate. '
    'Phase 2: Edge Function đọc bảng này để gửi push đến target_user_id từ app_notifications.';
```

---

### Bước 11: `NotificationContext.tsx` — Single subscription

```typescript
// apps/mobile/src/contexts/NotificationContext.tsx
// QUAN TRỌNG: Đây là nơi DUY NHẤT subscribe realtime cho notifications.
// Không để component con (Bell, Screen) tự tạo subscription riêng.
// Mọi component chỉ gọi useNotificationContext() để đọc state.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { getMobileSupabase } from '../lib/supabase';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, string>;
  isRead: boolean;
  targetUserId: string | null;  // v2: targeted or broadcast
  createdAt: string;
}

interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  isLoading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  // channelRef để tránh memory leak khi mount/unmount nhiều lần
  const channelRef = useRef<ReturnType<ReturnType<typeof getMobileSupabase>['channel']> | null>(null);

  const load = useCallback(async () => {
    const supabase = getMobileSupabase();
    const { data } = await supabase
      .from('app_notifications')
      .select('id, type, title, message, data, is_read, target_user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(30);
    // RLS tự filter: user chỉ thấy notification của tenant + (broadcast OR targeted cho mình)

    const mapped: AppNotification[] = (data ?? []).map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: (n.data ?? {}) as Record<string, string>,
      isRead: n.is_read,
      targetUserId: n.target_user_id ?? null,
      createdAt: n.created_at,
    }));

    setNotifications(mapped);
    setUnreadCount(mapped.filter((n) => !n.isRead).length);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // SINGLE SUBSCRIPTION — chỉ tạo 1 channel duy nhất cho toàn app
  useEffect(() => {
    const supabase = getMobileSupabase();

    // Cleanup channel cũ nếu có (tránh duplicate khi re-mount)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    channelRef.current = supabase
      .channel('global-notifications-v1')  // tên cố định → không tạo channel trùng
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'app_notifications' },
        () => { void load(); },
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [load]);

  // markRead với optimistic update + rollback khi DB fail
  const markRead = useCallback(async (notificationId: string) => {
    // Lưu state trước để rollback
    const previousNotifications = notifications;
    const previousCount = unreadCount;

    // Optimistic update ngay lập tức
    setNotifications((prev) =>
      prev.map((n) => n.id === notificationId ? { ...n, isRead: true } : n),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    // Gọi DB
    const supabase = getMobileSupabase();
    const { error } = await supabase
      .from('app_notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      // Rollback — giống pattern CompleteSessionButton
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
      console.error('[Notification] markRead rollback:', error.message);
    }
  }, [notifications, unreadCount]);

  const markAllRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousCount = unreadCount;

    // Optimistic
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    const supabase = getMobileSupabase();
    const { error } = await supabase
      .from('app_notifications')
      .update({ is_read: true })
      .eq('is_read', false);

    if (error) {
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    }
  }, [notifications, unreadCount]);

  return (
    <NotificationContext.Provider
      value={{ notifications, unreadCount, isLoading, markRead, markAllRead, refresh: load }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

/**
 * Hook để đọc notification state.
 * KHÔNG tạo subscription riêng — chỉ đọc từ Context.
 * Provider phải bao ngoài trong _layout.tsx.
 */
export function useNotificationContext(): NotificationContextValue {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotificationContext phải được dùng trong NotificationProvider');
  }
  return ctx;
}
```

**Lý do thiết kế:**
- `Home` dùng `useNotificationContext()` → đọc `unreadCount`
- `NotificationBell` dùng `useNotificationContext()` → đọc `unreadCount`
- `NotificationsScreen` dùng `useNotificationContext()` → đọc `notifications`
- **Chỉ 1 channel realtime** — không phải 3

---

### Bước 12: `useOptimisticSession.ts`

```typescript
// apps/mobile/src/hooks/useOptimisticSession.ts
import { useState, useCallback } from 'react';
import { SESSION_STATUS } from '@bella/shared';
import { completeSession } from '../services/booking/completeSession';

interface OptimisticState {
  status: string;
  completedDate: string | null;
}

export function useOptimisticSession(
  initialStatus: string,
  initialCompletedDate: string | null,
  onSuccess?: () => void,
) {
  const [optimistic, setOptimistic] = useState<OptimisticState>({
    status: initialStatus,
    completedDate: initialCompletedDate,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const complete = useCallback(async (sessionId: string, bookingId: string) => {
    const previous = optimistic;

    // Optimistic: đổi status ngay, không chờ RPC
    setOptimistic({
      status: SESSION_STATUS.COMPLETED,
      completedDate: new Date().toISOString().split('T')[0],
    });
    setIsSubmitting(true);
    setError(null);

    const result = await completeSession({ sessionId, bookingId });
    setIsSubmitting(false);

    if (!result.ok) {
      // Rollback
      setOptimistic(previous);
      setError(result.error);
      return false;
    }

    onSuccess?.();
    return true;
  }, [optimistic, onSuccess]);

  return {
    optimisticStatus: optimistic.status,
    optimisticCompletedDate: optimistic.completedDate,
    isSubmitting,
    error,
    complete,
  };
}
```

---

### Bước 13: `useCustomerSearch.ts` — debounce + cache

```typescript
// apps/mobile/src/hooks/useCustomerSearch.ts
// v2: Thêm Map-based cache 30s để tránh duplicate request khi gõ dần

import { useCallback, useEffect, useRef, useState } from 'react';
import { getMobileSupabase } from '../lib/supabase';

export interface CustomerSearchResult {
  id: string;
  nameMother: string;
  nameBaby: string | null;
  phone: string;
  activeBooking: {
    packageName: string | null;
    status: string;
    completedSessions: number;
    totalSessions: number;
  } | null;
}

// Module-level cache — tồn tại suốt session app (không phải per-render)
// Key = normalized query, Value = { results, expiresAt }
const searchCache = new Map<string, { results: CustomerSearchResult[]; expiresAt: number }>();
const CACHE_TTL_MS = 30_000;  // 30 giây

export function useCustomerSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CustomerSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    const normalized = q.trim().toLowerCase();
    if (normalized.length < 2) {
      setResults([]);
      return;
    }

    // Kiểm tra cache trước
    const cached = searchCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      setResults(cached.results);
      return;  // cache hit — không gọi API
    }

    setIsSearching(true);
    const supabase = getMobileSupabase();

    const { data } = await supabase.rpc('rpc_mobile_search_customers', {
      p_query: normalized,
      p_limit: 20,
    });

    const raw = (data as Array<Record<string, unknown>>) ?? [];
    const mapped: CustomerSearchResult[] = raw.map((r) => ({
      id: r.id as string,
      nameMother: r.name_mother as string ?? '',
      nameBaby: r.name_baby as string | null ?? null,
      phone: r.phone as string ?? '',
      activeBooking: r.active_booking ? (() => {
        const b = r.active_booking as Record<string, unknown>;
        return {
          packageName: b.package_name as string | null ?? null,
          status: b.status as string ?? '',
          completedSessions: b.completed_sessions as number ?? 0,
          totalSessions: b.total_sessions as number ?? 0,
        };
      })() : null,
    }));

    // Lưu vào cache
    searchCache.set(normalized, {
      results: mapped,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    setResults(mapped);
    setIsSearching(false);
  }, []);

  const handleQueryChange = useCallback((q: string) => {
    setQuery(q);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => { void search(q); }, 300);
  }, [search]);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  // Xoá cache khi cần (ví dụ sau khi thêm khách mới)
  const invalidateCache = useCallback(() => {
    searchCache.clear();
  }, []);

  return { query, results, isSearching, handleQueryChange, clear, invalidateCache };
}
```

---

### Bước 15–16: Push notification — isolated, không block auth

```typescript
// apps/mobile/src/lib/pushNotifications.ts

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from '../services/notification/registerPushToken';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
  }),
});

/**
 * Setup push notification — ISOLATED từ auth flow.
 * - Chỉ chạy trên device thật
 * - Không throw exception ra ngoài — mọi lỗi được handle nội bộ
 * - Return: token hoặc null (không phải error)
 *
 * QUAN TRỌNG: Gọi hàm này với fire-and-forget trong AuthContext.
 * Không await. Không let exception block auth.
 */
export async function setupPushNotifications(): Promise<string | null> {
  try {
    // Simulator không nhận push
    if (!Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bella ERP',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    const result = await registerPushToken(token);
    if (!result.ok) {
      console.warn('[Push] Token save failed:', result.error);
      // Không throw — token fail không ảnh hưởng app
    }

    return token;

  } catch (err) {
    // Catch tất cả — push setup không được crash app
    console.error('[Push] Setup error (non-fatal):', err);
    return null;
  }
}

export function getNavigationTarget(data: Record<string, string> | undefined): string | null {
  if (!data?.type) return null;
  switch (data.type) {
    case 'new_session':     return data.sessionId ? `/session/${data.sessionId}` : '/schedule';
    case 'booking_assigned': return data.customerId ? `/customer/${data.customerId}` : '/home';
    default:                return '/notifications';
  }
}
```

```typescript
// apps/mobile/src/contexts/AuthContext.tsx — cập nhật

// Sau khi authenticated, setup push — hoàn toàn tách biệt khỏi auth logic
useEffect(() => {
  if (auth.status !== 'authenticated') return;

  // FIRE-AND-FORGET: không await, không let exception propagate
  // Push setup fail ≠ auth fail. Hai concern hoàn toàn độc lập.
  void setupPushNotifications();  // void để TypeScript không warn unused promise
  // Không cần `.catch()` vì setupPushNotifications() đã handle tất cả errors nội bộ

}, [auth.status]);
// auth.user.id KHÔNG có trong deps — chỉ trigger khi status đổi từ unauthenticated → authenticated
```

---

### Bước 10: `fetchWeeklySchedule.ts`

```typescript
// apps/mobile/src/services/schedule/fetchWeeklySchedule.ts
// v2: TODO ghi rõ giới hạn của query rộng khi admin dùng

export interface DaySchedule {
  date: string;   // 'YYYY-MM-DD'
  sessions: WeeklySessionItem[];
}

export interface WeeklySessionItem {
  id: string;
  sessionNumber: number;
  assignedTime: string | null;  // field đúng là assigned_time (không phải scheduled_time)
  status: string;
  customerName: string;
  babyName: string | null;
  bookingId: string;
  packageName: string | null;
}

export async function fetchWeeklySchedule(
  weekStartDate: string,
  weekEndDate: string,
): Promise<DaySchedule[]> {
  const supabase = getMobileSupabase();

  // TODO Phase 2: Nếu admin xem lịch toàn spa → có thể 20+ sessions/ngày × 7 = 140+ rows.
  // Giải pháp Phase 2: pagination, virtualized list, hoặc rpc_mobile_weekly_schedule với limit.
  // Phase 1: KTV chỉ thấy lịch của mình (RLS filter) → max ~3-5 sessions/ngày → OK.

  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      id,
      session_number,
      assigned_date,
      assigned_time,
      status,
      bookings!inner (
        id,
        package_name,
        customers (
          name_mother,
          name_baby
        )
      )
    `)
    .gte('assigned_date', weekStartDate)
    .lte('assigned_date', weekEndDate)
    .not('assigned_date', 'is', null)
    .order('assigned_date', { ascending: true })
    .order('assigned_time', { ascending: true });
    // RLS: KTV chỉ thấy session của booking được phân công cho mình (sau fix Tuần 3)

  if (error || !data) return buildEmptyWeek(weekStartDate);

  const grouped: Record<string, WeeklySessionItem[]> = {};

  for (const sl of data) {
    const date = sl.assigned_date as string;
    const booking = Array.isArray(sl.bookings) ? sl.bookings[0] : sl.bookings;
    const customer = Array.isArray(booking?.customers) ? booking?.customers[0] : booking?.customers;

    if (!grouped[date]) grouped[date] = [];
    grouped[date].push({
      id: sl.id,
      sessionNumber: sl.session_number ?? 0,
      assignedTime: sl.assigned_time as string | null ?? null,
      status: sl.status ?? '',
      customerName: customer?.name_mother ?? 'Khách',
      babyName: customer?.name_baby ?? null,
      bookingId: booking?.id ?? '',
      packageName: booking?.package_name ?? null,
    });
  }

  return buildWeekFromGroups(weekStartDate, grouped);
}

function buildWeekFromGroups(
  startDate: string,
  grouped: Record<string, WeeklySessionItem[]>,
): DaySchedule[] {
  const result: DaySchedule[] = [];
  const start = new Date(startDate);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    result.push({ date: dateStr, sessions: grouped[dateStr] ?? [] });
  }
  return result;
}

function buildEmptyWeek(startDate: string): DaySchedule[] {
  return buildWeekFromGroups(startDate, {});
}

export function getWeekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const fmt = (dt: Date) => dt.toISOString().split('T')[0];
  return { start: fmt(monday), end: fmt(sunday) };
}
```

---

### Bước 18: `NotificationBell.tsx` — đọc từ Context, không subscribe riêng

```typescript
// apps/mobile/src/components/NotificationBell.tsx
// KHÔNG subscribe realtime — chỉ đọc từ NotificationContext

import { TouchableOpacity, View, Text } from 'react-native';
import { useNotificationContext } from '../contexts/NotificationContext';

interface Props {
  onPress: () => void;
}

export function NotificationBell({ onPress }: Props) {
  // Đọc từ Context — không tạo subscription mới
  const { unreadCount } = useNotificationContext();

  return (
    <TouchableOpacity onPress={onPress} style={{ position: 'relative' }}>
      <Text style={{ fontSize: 22 }}>🔔</Text>
      {unreadCount > 0 && (
        <View style={{
          position: 'absolute',
          top: -4, right: -4,
          backgroundColor: '#EF4444',
          borderRadius: 10,
          minWidth: 18, height: 18,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: 'white', fontSize: 11, fontWeight: '700' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
```

---

### Kiến trúc Notification Flow (v2)

```
NotificationProvider (trong _layout.tsx)
  │
  ├── 1 realtime channel: 'global-notifications-v1'
  ├── state: notifications[], unreadCount
  │
  ├── NotificationBell.tsx
  │     └── useNotificationContext() → unreadCount  (chỉ đọc)
  │
  ├── NotificationsScreen
  │     └── useNotificationContext() → notifications[], markRead()  (chỉ đọc + action)
  │
  └── HomeScreen (badge trong header)
        └── useNotificationContext() → unreadCount  (chỉ đọc)

Không có component nào tự subscribe realtime.
Không có hook useNotifications() tạo channel riêng.
```

---

### Notification RLS — Targeted vs Broadcast

```sql
-- Sau migration, cách tạo notification targeted:
INSERT INTO app_notifications (tenant_id, type, title, message, target_user_id)
VALUES (
  'tenant-uuid',
  'booking_assigned',
  'Lịch mới được phân công',
  'Bạn được phân công khách hàng Nguyễn Thị Hương',
  'ktv-a-uuid'  -- chỉ KTV A thấy
);

-- Broadcast toàn tenant:
INSERT INTO app_notifications (tenant_id, type, title, message, target_user_id)
VALUES (
  'tenant-uuid',
  'system_alert',
  'Thông báo hệ thống',
  'Bảo trì hệ thống lúc 23:00 tối nay',
  NULL  -- tất cả mọi người trong tenant thấy
);
```

---

## Danh Sách Files

### supabase/migrations/ — 4 files (1 có điều kiện)

| File | Điều kiện |
|------|----------|
| `20260705_register_booking_progress_trigger.sql` | Chỉ tạo nếu trigger chưa active (Bước 1) |
| `20260705_add_target_user_to_notifications.sql` | Luôn tạo — thêm `target_user_id` |
| `20260705_device_tokens.sql` | Luôn tạo |
| `20260705_mobile_search_rpc.sql` | Luôn tạo |

### apps/mobile/ — 22 files

| File | Ghi chú |
|------|---------|
| `src/contexts/NotificationContext.tsx` | MỚI — single subscription, optimistic markRead với rollback |
| `src/contexts/AuthContext.tsx` | Cập nhật — push fire-and-forget |
| `src/services/notification/fetchNotifications.ts` | MỚI |
| `src/services/notification/markNotificationRead.ts` | MỚI (fallback nếu dùng ngoài Context) |
| `src/services/notification/registerPushToken.ts` | MỚI |
| `src/services/search/searchCustomers.ts` | MỚI |
| `src/services/schedule/fetchWeeklySchedule.ts` | MỚI |
| `src/hooks/useOptimisticSession.ts` | MỚI |
| `src/hooks/useCustomerSearch.ts` | MỚI — debounce + cache 30s |
| `src/hooks/useWeeklySchedule.ts` | MỚI |
| `src/lib/pushNotifications.ts` | MỚI — isolated, no throw |
| `src/components/EmptyState.tsx` | MỚI |
| `src/components/NotificationBell.tsx` | MỚI — chỉ đọc Context |
| `src/components/NotificationItem.tsx` | MỚI |
| `src/components/WeekCalendarStrip.tsx` | MỚI |
| `src/components/DaySessionList.tsx` | MỚI |
| `src/components/SearchBar.tsx` | MỚI |
| `src/components/CustomerSearchResult.tsx` | MỚI |
| `src/components/CompleteSessionButton.tsx` | Cập nhật — dùng useOptimisticSession |
| `app/(app)/notifications.tsx` | MỚI |
| `app/(app)/schedule.tsx` | Cập nhật — WeekCalendarStrip |
| `app/(app)/search.tsx` | MỚI |
| `app/(app)/home.tsx` | Cập nhật — NotificationBell |
| `app/_layout.tsx` | Cập nhật — NotificationProvider bọc ngoài |

**Tổng: 4 SQL migrations, 24 file mobile**

---

## Rủi Ro Tuần 4 (đã cập nhật)

| Rủi ro | Mức độ | Biện pháp |
|--------|--------|-----------|
| Trigger chưa active → data inconsistency | 🔴 Nghiêm trọng | Bước 1 TRƯỚC mọi việc |
| `target_user_id` migration fail trên production DB có nhiều notification cũ | 🟡 Trung bình | `ADD COLUMN IF NOT EXISTS` + NULL default → backward compat |
| Push permission từ chối → silent fail | 🟡 Chấp nhận | Return null, không throw |
| Search cache stale sau thêm khách mới | 🟡 Thấp | `invalidateCache()` sau khi thêm/sửa customer |
| Optimistic markRead rollback không xử lý concurrent | 🟡 Thấp | Phase 1 chấp nhận — UI đủ tốt cho 5–15 người |
| `NotificationProvider` unmount/remount → channel bị tạo lại | 🟡 Thấp | `channelRef` cleanup trong return |
| Weekly calendar: admin xem toàn spa → query phình | 🟡 Ghi nhận | TODO Phase 2 trong code |

---

## Kế Hoạch Kiểm Tra

### Notification targeted verification

```sql
-- Test: KTV A KHÔNG thấy notification targeted cho KTV B
-- (Chạy với user = KTV A)
INSERT INTO app_notifications (tenant_id, type, title, message, target_user_id)
VALUES ('tenant-id', 'test', 'Test', 'Chỉ KTV B thấy', 'ktv-b-uuid');

SELECT * FROM app_notifications WHERE type = 'test';
-- Kết quả mong đợi: 0 rows (KTV A không thấy)
```

### Single subscription verification

```typescript
// Trong development: log khi channel được tạo
console.log('[Notification] Channel created'); // chỉ xuất hiện 1 lần khi app start
// Không xuất hiện mỗi khi navigate giữa screens
```

### Thủ công — Device thật + Simulator

| # | Kiểm tra | Kết quả mong đợi |
|---|---------|-----------------|
| 1 | Tap Complete → status đổi ngay | Không lag, optimistic |
| 2 | Tap Complete offline → rollback | Alert lỗi + status về scheduled |
| 3 | KTV A nhận notification targeted | Thấy notification |
| 4 | KTV B không thấy notification của KTV A | 0 notifications |
| 5 | Broadcast notification | Mọi người trong tenant thấy |
| 6 | Mark read → badge giảm ngay | Optimistic |
| 7 | Mark read → DB fail → badge rollback | Về số cũ |
| 8 | Navigate Home→Notifications→Home | Channel không tăng (vẫn 1) |
| 9 | Web insert notification → mobile badge tăng | Realtime <2s |
| 10 | Search "hương" → cache | Lần 2 không gọi API (30s) |
| 11 | Calendar tuần trước/sau | Sessions đúng ngày |
| 12 | Push permission trên device thật | Permission popup |
| 13 | `device_tokens` upsert — login 2 lần | Chỉ 1 row (không duplicate) |
| 14 | `setupPushNotifications()` throw error | App không crash, login vẫn OK |
| 15 | Web build | Không regression |

---

## Định Nghĩa Hoàn Thành (DoD)

### Bắt buộc trước khi code

- [ ] Trigger `trig_sync_booking_progress` verified active hoặc migration đã tạo.
- [ ] Migration `target_user_id` apply thành công — verify RLS trên Studio.

### Features

- [ ] Notification targeted: KTV A không thấy notification của KTV B.
- [ ] Broadcast notification: mọi người trong tenant thấy.
- [ ] **Chỉ 1 channel realtime** — verify bằng log khi navigate.
- [ ] Badge `unreadCount` đúng + realtime update.
- [ ] `markRead` optimistic + rollback khi DB fail.
- [ ] `CompleteSessionButton` optimistic + rollback.
- [ ] **Push token registration** thành công trên device thật (token lưu vào `device_tokens`).
- [ ] `UNIQUE(user_id, expo_push_token)` — login/logout 3 lần → chỉ 1 row.
- [ ] `setupPushNotifications()` fail không block login flow.
- [ ] Weekly calendar: 7 ngày, count sessions/ngày, tap filter.
- [ ] Search: debounce 300ms, min 2 ký tự, cache 30s.
- [ ] `EmptyState` dùng nhất quán trên tất cả màn hình.
- [ ] CI pass: `shared:typecheck` + `mobile:typecheck` + web `build`.

> **⚠️ Wording quan trọng:** DoD này xác nhận **Push Token Registration** hoàn thành.
> **Push Notification Delivery** (Edge Function → Expo Push API) là Phase 2.
> Người đọc DoD không được nhầm lẫn hai điều này.

---

## Phase 1 Done — Tổng Kết 4 Tuần

| Tuần | Scope | Files |
|------|-------|-------|
| 1 | Auth + session restore + monorepo | ~15 files |
| 2 | Dashboard KPI + session list + service layer | ~20 files |
| 3 | Session detail + complete session + customer profile | 16 files |
| 4 | Notifications + push token + calendar + search + optimistic | 24 files |

**Sau Phase 1, KTV có thể:**
- Xem lịch hôm nay + lịch theo tuần
- Hoàn thành buổi từ điện thoại (optimistic, cảm giác nhanh)
- Xem hồ sơ khách hàng + lịch sử buổi
- Nhận thông báo targeted (chỉ thấy notification của mình)
- Tìm kiếm khách hàng nhanh

---

## Backlog Phase 2 — Tổng Hợp Từ Phase 1

| Hạng mục | Phát sinh |
|---------|-----------|
| Push delivery pipeline (Edge Function → Expo Push API) | Tuần 4 |
| `app_notifications.target_user_id` filter per-user trong web | Tuần 4 |
| Offline resilience + action queue | Tuần 1 |
| Reschedule từ mobile | Tuần 3 |
| Salary/kho trigger sau mobile complete | Tuần 3 |
| `rpc_mobile_session_detail` khi query phình | Tuần 3 |
| Server quyết định active booking (`is_primary_booking`) | Tuần 3 |
| Weekly calendar pagination / virtualized list (Admin) | Tuần 4 |
| Customer profile — Rating & review history | Tuần 4 |
| `searchCache.invalidateCache()` sau khi thêm customer mới | Tuần 4 |
