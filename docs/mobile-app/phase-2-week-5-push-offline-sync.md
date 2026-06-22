# Bella ERP Mobile App — Phase 2 Tuần 5: Push Notification Delivery & Offline Sync
## Phiên bản v2.0 — Cập nhật 10 điểm sau review kỹ thuật

**Ngày tạo:** 2026-06-21
**Cập nhật:** 2026-06-21 — Sửa lỗi bảo mật webhook, race condition queue, closure bug SyncAgent, và thiết lập cơ chế chống lặp (idempotency).
**Tiền điều kiện:** Phase 1 (Tuần 4) DoD hoàn thành

---

## Tổng Hợp Thay Đổi Từ Review Kỹ Thuật

| # | Điểm sửa đổi | Chi tiết | Phân loại |
|---|---|---|---|
| 1 | **Chống lặp hành động (Idempotency)** | Thêm bảng `mobile_processed_actions` và truyền `client_action_id` vào các RPC để chống ghi đè khi mất mạng và gửi trùng. | 🔴 Bắt buộc |
| 2 | **Xác thực Edge Function an toàn** | Thay `includes()` bằng so sánh tuyệt đối `authHeader === Bearer ${expected}`. | 🔴 Bắt buộc |
| 3 | **Webhook bảo mật** | Dùng `PUSH_WEBHOOK_SECRET` chuyên biệt thay vì `service_role_key` trong trigger database để tránh lộ quyền root. | 🔴 Bắt buộc |
| 4 | **Giải quyết xung đột dữ liệu** | Khi đồng bộ offline thất bại do xung đột (DB báo lỗi), truy vấn server-truth để cập nhật local state thay vì rollback mù về `scheduled`. | 🔴 Bắt buộc |
| 5 | **Sửa lỗi closure SyncAgent** | Dùng `useRef` làm single worker lock (`isSyncingRef`) và tham chiếu hàng đợi mới nhất (`syncQueueRef`), tránh chạy vòng lặp trên stale state. | 🔴 Bắt buộc |
| 6 | **Chính sách TTL hiển thị rõ ràng** | Cấu hình tường minh: KPI (5 phút), Today Sessions (2 phút), Weekly Schedule (15 phút). | 🟡 Nên làm |
| 7 | **Giới hạn kích thước hàng đợi** | Đặt `MAX_QUEUE_SIZE = 500` và hiển thị cảnh báo từ chối hành động tiếp theo để bảo vệ dung lượng AsyncStorage. | 🟡 Nên làm |
| 8 | **Push delivery retry backlog** | Tạo bảng `notification_delivery_logs` trong backlog để ghi nhận trạng thái gửi từ Expo API phục vụ Phase 3. | 🟡 Nên làm |
| 9 | **Dọn dẹp khi Đăng xuất (Logout)** | Xoá sạch hàng đợi offline và toàn bộ cache khi KTV logout. Đưa vào DoD bắt buộc. | 🟡 Nên làm |
| 10| **Tránh race condition state** | Dùng reducer hoặc update function `setQueue(prev => ...)` để đảm bảo ghi nhận queue tuần tự khi tap nhanh. | 🟡 Nên làm |

---

## 1. Supabase Backend — Idempotency & Webhooks Security

### Bảng processed actions & Webhook Trigger bảo mật

Chúng ta sẽ tạo bảng lưu trữ các `client_action_id` đã thực thi để ngăn chặn chạy lại (replay attack / double execution). Ngoài ra, ta khai báo một biến config riêng là `app.settings.push_webhook_secret` để làm secret xác thực.

### [NEW] [20260712000000_mobile_idempotency_and_webhook.sql](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260712000000_mobile_idempotency_and_webhook.sql)

```sql
-- supabase/migrations/20260712000000_mobile_idempotency_and_webhook.sql
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Bảng lưu trữ hành động đã được xử lý từ mobile (Idempotency)
CREATE TABLE IF NOT EXISTS public.mobile_processed_actions (
    client_action_id UUID PRIMARY KEY,
    user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action_type      TEXT NOT NULL,
    processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mobile_processed_actions_user 
    ON public.mobile_processed_actions(user_id);

ALTER TABLE public.mobile_processed_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User xem action history cá nhân" ON public.mobile_processed_actions
    FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. Đăng ký Webhook secret cấu hình (Chạy trong console/Studio)
-- ALTER DATABASE postgres SET app.settings.push_webhook_secret = 'YOUR_PUSH_WEBHOOK_SECRET_VALUE';

-- 3. Tạo function trigger gửi webhook an toàn (không dùng service_role_key)
CREATE OR REPLACE FUNCTION public.fn_trigger_push_notifications()
RETURNS TRIGGER AS $$
DECLARE
  project_id TEXT;
  edge_url TEXT;
  webhook_secret TEXT;
BEGIN
  -- Lấy project ID tự động
  SELECT COALESCE(
    (SELECT value FROM pg_settings WHERE name = 'request.headers' LIMIT 1),
    'your-project-id'
  ) INTO project_id;

  edge_url := 'https://' || project_id || '.functions.supabase.co/push-notifications';
  
  -- Đọc custom webhook secret
  webhook_secret := COALESCE(
    current_setting('app.settings.push_webhook_secret', true),
    'DEFAULT_PUSH_WEBHOOK_SECRET_DO_NOT_USE_IN_PROD'
  );

  PERFORM net.http_post(
    url := edge_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := json_build_object(
      'record', row_to_json(NEW),
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA
    )::text,
    timeout_ms := 5000
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger bắt sự kiện INSERT app_notifications
DROP TRIGGER IF EXISTS trig_push_notifications ON public.app_notifications;
CREATE TRIGGER trig_push_notifications
    AFTER INSERT ON public.app_notifications
    FOR EACH ROW
    EXECUTE FUNCTION fn_trigger_push_notifications();
```

---

## 2. Supabase Edge Function — Xác Thực Chặt Chẽ

### [NEW] [supabase/functions/push-notifications/index.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/functions/push-notifications/index.ts)

Sử dụng so sánh chính xác để chặn các chuỗi con chứa key, xử lý việc xoá token không còn hiệu lực.

```typescript
// supabase/functions/push-notifications/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.21.0";

const EXPO_PUSH_API = "https://exp.host/--/api/v2/push/send";

serve(async (req) => {
  try {
    // 1. Xác thực bằng x-webhook-secret (so sánh tuyệt đối)
    const clientSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("PUSH_WEBHOOK_SECRET");
    
    if (!clientSecret || clientSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const payload = await req.json();
    const { record, type, table } = payload;

    if (table !== 'app_notifications' || type !== 'INSERT') {
      return new Response(JSON.stringify({ skipped: true }), { 
        status: 200, 
        headers: { "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const systemServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, systemServiceKey);

    const { id, title, message, tenant_id, target_user_id, data } = record;

    // 2. Query Expo Push Tokens
    let tokens: string[] = [];
    if (target_user_id) {
      const { data: dt, error } = await supabase
        .from('device_tokens')
        .select('expo_push_token')
        .eq('user_id', target_user_id);
      
      if (error) throw error;
      if (dt) tokens = dt.map(t => t.expo_push_token);
    } else {
      const { data: dt, error } = await supabase
        .from('device_tokens')
        .select('expo_push_token')
        .eq('tenant_id', tenant_id);
      
      if (error) throw error;
      if (dt) tokens = dt.map(t => t.expo_push_token);
    }

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, reason: "No tokens registered" }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Dispatch Expo Push Notification
    const expoMessages = tokens.map(token => ({
      to: token,
      sound: "default",
      title: title,
      body: message,
      data: { ...data, notificationId: id }
    }));

    const res = await fetch(EXPO_PUSH_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(expoMessages)
    });

    const expoResult = await res.json();
    
    // 4. Dọn dẹp device_token không hợp lệ (Expo cleanup)
    const tickets = expoResult.data || [];
    const tokensToDelete: string[] = [];

    for (let i = 0; i < tickets.length; i++) {
      const ticket = tickets[i];
      if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
        tokensToDelete.push(tokens[i]);
      }
    }

    if (tokensToDelete.length > 0) {
      await supabase
        .from('device_tokens')
        .delete()
        .in('expo_push_token', tokensToDelete);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      sent: expoMessages.length, 
      cleaned: tokensToDelete.length 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("[PushFunction] Crash:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
});
```

---

## 3. Server-Side Idempotent RPCs

Bảo vệ máy chủ khỏi nguy cơ ghi nhận trùng lặp dữ liệu do cơ chế tự động gửi lại (retry) khi mất mạng chập chờn. Các hàm này ghi nhận `client_action_id` vào `mobile_processed_actions` trước khi làm nghiệp vụ.

### [NEW] [20260712000001_idempotent_session_rpcs.sql](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260712000001_idempotent_session_rpcs.sql)

```sql
-- supabase/migrations/20260712000001_idempotent_session_rpcs.sql

-- 1. Idempotent Check-in RPC
CREATE OR REPLACE FUNCTION public.rpc_mobile_checkin_session(
    p_session_id UUID,
    p_client_action_id UUID,
    p_lat NUMERIC,
    p_lon NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_already_processed BOOLEAN;
BEGIN
    -- Kiểm tra xem client_action_id đã chạy thành công chưa
    SELECT EXISTS(
        SELECT 1 FROM public.mobile_processed_actions 
        WHERE client_action_id = p_client_action_id
    ) INTO v_already_processed;

    IF v_already_processed THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Đã xử lý trước đó');
    END IF;

    -- Kiểm tra điều kiện nghiệp vụ: Trạng thái buổi hẹn
    IF NOT EXISTS(SELECT 1 FROM public.session_logs WHERE id = p_session_id AND status = 'scheduled') THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Trạng thái buổi hẹn không hợp lệ (không phải scheduled)', 'code', 'STATE_CONFLICT');
    END IF;

    -- Thực hiện nghiệp vụ check-in
    UPDATE public.session_logs
    SET 
        status = 'in_progress',
        checkin_lat = p_lat,
        checkin_lon = p_lon,
        actual_checkin_time = NOW()
    WHERE id = p_session_id;

    -- Lưu vết action
    INSERT INTO public.mobile_processed_actions (client_action_id, user_id, action_type)
    VALUES (p_client_action_id, auth.uid(), 'CHECKIN');

    RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', 'DB_ERROR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Idempotent Checkout/Complete Session RPC
CREATE OR REPLACE FUNCTION public.rpc_mobile_complete_session(
    p_session_id UUID,
    p_booking_id UUID,
    p_client_action_id UUID,
    p_notes TEXT,
    p_checkout_note TEXT,
    p_lat NUMERIC,
    p_lon NUMERIC
)
RETURNS JSONB AS $$
DECLARE
    v_already_processed BOOLEAN;
    v_completed_count INTEGER;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM public.mobile_processed_actions 
        WHERE client_action_id = p_client_action_id
    ) INTO v_already_processed;

    IF v_already_processed THEN
        RETURN jsonb_build_object('ok', true, 'message', 'Đã xử lý trước đó');
    END IF;

    IF NOT EXISTS(SELECT 1 FROM public.session_logs WHERE id = p_session_id AND status IN ('scheduled', 'in_progress')) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Buổi hẹn đã hoàn thành hoặc bị huỷ trước đó trên máy chủ', 'code', 'STATE_CONFLICT');
    END IF;

    -- Update session
    UPDATE public.session_logs
    SET 
        status = 'completed',
        notes = p_notes,
        checkout_notes = p_checkout_note,
        checkout_lat = p_lat,
        checkout_lon = p_lon,
        actual_checkout_time = NOW(),
        completed_by_ktv_id = auth.uid()
    WHERE id = p_session_id;

    -- Tự động đếm và cập nhật số buổi hoàn thành thực tế vào bookings (source of truth)
    SELECT COUNT(*) FROM public.session_logs
    WHERE booking_id = p_booking_id AND status = 'completed'
    INTO v_completed_count;

    UPDATE public.bookings
    SET completed_sessions = v_completed_count
    WHERE id = p_booking_id;

    -- Lưu vết action
    INSERT INTO public.mobile_processed_actions (client_action_id, user_id, action_type)
    VALUES (p_client_action_id, auth.uid(), 'CHECKOUT');

    RETURN jsonb_build_object('ok', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', SQLERRM, 'code', 'DB_ERROR');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 4. Next.js Web App — Lọc Targeted Notification

### [MODIFY] [src/core/services/notification/notification-actions.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/core/services/notification/notification-actions.ts)

Cập nhật web app Next.js bảo mật, chỉ kéo các targeted notification đúng chủ tài khoản hoặc system broadcast:

```diff
  const { data, error } = await supabase
    .from('app_notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_read', false)
+   .or(`target_user_id.is.null,target_user_id.eq.${userData.user.id}`)
    .order('created_at', { ascending: false })
    .limit(20);
```

---

## 5. Mobile App — Cache & Explicit TTL

### [NEW] [apps/mobile/src/lib/cache.ts](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/apps/mobile/src/lib/cache.ts)

Xác định cấu hình TTL tường minh cho từng cụm tài nguyên để đảm bảo dữ liệu hiển thị không bị quá cũ.

```typescript
// apps/mobile/src/lib/cache.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

// Định nghĩa TTL tường minh cho từng dịch vụ (đơn vị: phút)
export const CACHE_TTLS = {
  KPI: 5,             // Dashboard KPI: 5 phút
  TODAY_SESSIONS: 2,  // Danh sách buổi hôm nay: 2 phút (cần realtime nhanh hơn)
  SCHEDULE: 15,       // Lịch làm việc tuần: 15 phút (ít thay đổi đột xuất)
};

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export async function setLocalCache<T>(key: string, data: T, ttlMinutes: number): Promise<void> {
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000;
  const entry: CacheEntry<T> = { data, expiresAt };
  await AsyncStorage.setItem(key, JSON.stringify(entry));
}

export async function getLocalCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch (e) {
    console.warn('[Cache] Error reading local cache:', e);
    return null;
  }
}

export async function invalidateLocalCache(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

// Xoá toàn bộ cache khi đăng xuất
export async function clearAllLocalCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cacheKeys = keys.filter(k => k.startsWith('@bella/cache/'));
    if (cacheKeys.length > 0) {
      await AsyncStorage.multiRemove(cacheKeys);
    }
  } catch (e) {
    console.error('[Cache] Failed to clear caches on logout:', e);
  }
}
```

---

## 6. Mobile App — Offline Context, Reducer & SyncAgent Lock

Sử dụng Reducer để cập nhật queue chính xác khi có thao tác dồn dập, đồng thời áp dụng `isSyncingRef` và `syncQueueRef` để đồng bộ FIFO đơn luồng chuẩn xác.

### [NEW] [apps/mobile/src/contexts/OfflineContext.tsx](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/apps/mobile/src/contexts/OfflineContext.tsx)

```typescript
// apps/mobile/src/contexts/OfflineContext.tsx
import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

export type OfflineActionType = 'CHECKIN' | 'CHECKOUT' | 'SUBMIT_NOTE';

export interface OfflineAction {
  clientActionId: string; // UUID v4
  actionType: OfflineActionType;
  payload: any;
  localTimestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
}

interface OfflineContextValue {
  isOnline: boolean;
  pendingCount: number;
  enqueueOfflineAction: (actionType: OfflineActionType, payload: any) => Promise<boolean>;
  triggerSync: () => Promise<void>;
  clearQueueOnLogout: () => Promise<void>;
}

const OfflineContext = createContext<OfflineContextValue | null>(null);

const QUEUE_STORAGE_KEY = '@bella/offline-queue';
const MAX_QUEUE_SIZE = 500; // Giới hạn hàng đợi tối đa chống tràn AsyncStorage

// Reducer cho offline queue để chặn race condition
type QueueAction =
  | { type: 'LOAD_QUEUE'; payload: OfflineAction[] }
  | { type: 'ADD_ACTION'; action: OfflineAction }
  | { type: 'UPDATE_STATUS'; id: string; status: OfflineAction['status']; error?: string }
  | { type: 'REMOVE_ACTION'; id: string }
  | { type: 'CLEAR_QUEUE' };

function queueReducer(state: OfflineAction[], action: QueueAction): OfflineAction[] {
  switch (action.type) {
    case 'LOAD_QUEUE':
      return action.payload;
    case 'ADD_ACTION':
      if (state.length >= MAX_QUEUE_SIZE) return state; // Block nếu vượt limit
      return [...state, action.action];
    case 'UPDATE_STATUS':
      return state.map(item => 
        item.clientActionId === action.id 
          ? { ...item, status: action.status, errorMessage: action.error } 
          : item
      );
    case 'REMOVE_ACTION':
      return state.filter(item => item.clientActionId !== action.id);
    case 'CLEAR_QUEUE':
      return [];
    default:
      return state;
  }
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const queueRef = useRef<OfflineAction[]>([]); // Giữ bản ghi mới nhất để SyncAgent đọc không bị closure stale
  const isSyncingRef = useRef<boolean>(false); // Single worker lock
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Đồng bộ queue từ state vào ref và persistence storage
  const updateQueueStateAndStorage = (newQueue: OfflineAction[]) => {
    setQueue(newQueue);
    queueRef.current = newQueue;
    void AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(newQueue));
  };

  // Khởi chạy load hàng đợi từ storage
  useEffect(() => {
    async function loadQueue() {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        setQueue(loaded);
        queueRef.current = loaded;
      }
    }
    void loadQueue();
  }, []);

  // Lắng nghe sự thay đổi kết nối mạng
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const online = !!state.isConnected && !!state.isInternetReachable;
      setIsOnline(online);
    });
    return () => unsubscribe();
  }, []);

  // Tự động sync khi có mạng trở lại
  useEffect(() => {
    if (isOnline && queueRef.current.some(a => a.status === 'pending' || a.status === 'failed')) {
      void triggerSync();
    }
  }, [isOnline]);

  const enqueueOfflineAction = useCallback(async (actionType: OfflineActionType, payload: any): Promise<boolean> => {
    if (queueRef.current.length >= MAX_QUEUE_SIZE) {
      Alert.alert(
        'Bộ nhớ tạm đầy',
        `Bộ nhớ tạm đã đạt giới hạn ${MAX_QUEUE_SIZE} hành động. Vui lòng kết nối mạng để đồng bộ dữ liệu trước khi tiếp tục.`
      );
      return false;
    }

    // Client tự sinh UUID v4
    const clientActionId = 'client-act-' + Math.random().toString(36).substring(2, 15) + '-' + Date.now();
    const newAction: OfflineAction = {
      clientActionId,
      actionType,
      payload,
      localTimestamp: Date.now(),
      retryCount: 0,
      status: 'pending'
    };

    const nextQueue = queueReducer(queueRef.current, { type: 'ADD_ACTION', action: newAction });
    updateQueueStateAndStorage(nextQueue);
    return true;
  }, []);

  // Giải quyết tranh chấp khi dữ liệu trên máy chủ đã thay đổi (Ví dụ: Admin checkout trước)
  const handleSyncConflict = async (action: OfflineAction, serverError: string) => {
    const { getMobileSupabase } = await import('../lib/supabase');
    const supabase = getMobileSupabase();

    // 1. Kéo dữ liệu thực từ máy chủ về ghi đè cache cục bộ
    const sessionId = action.payload.sessionId;
    const { data: serverSession } = await supabase
      .from('session_logs')
      .select('status, notes, checkout_notes, completed_by_ktv_id')
      .eq('id', sessionId)
      .single();

    if (serverSession) {
      // Ghi đè trạng thái cache cục bộ với server state thật
      const cacheKey = `@bella/cache/today-sessions-detail/${sessionId}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify({
        data: serverSession,
        expiresAt: Date.now() + 60 * 1000 // 1 phút cache
      }));
    }

    // 2. Alert cảnh báo cho người dùng
    Alert.alert(
      'Xung đột dữ liệu',
      `Yêu cầu hoàn thành buổi hẹn của bạn gặp lỗi: ${serverError}. Dữ liệu thiết bị đã được tự động cập nhật lại từ máy chủ.`
    );
  };

  const triggerSync = useCallback(async () => {
    // Chặn trùng lặp xử lý (Single Worker Lock)
    if (isSyncingRef.current || !isOnline) return;
    isSyncingRef.current = true;

    try {
      while (true) {
        // Lấy queue mới nhất từ ref
        const currentQueue = queueRef.current;
        const pendingAction = currentQueue.find(a => a.status === 'pending' || a.status === 'failed');

        if (!pendingAction) break;

        // Cập nhật status sang 'syncing'
        let updated = queueReducer(queueRef.current, { type: 'UPDATE_STATUS', id: pendingAction.clientActionId, status: 'syncing' });
        updateQueueStateAndStorage(updated);

        try {
          const result = await executeServerAction(pendingAction);

          if (result.ok) {
            // Đồng bộ thành công -> Xóa khỏi queue
            updated = queueReducer(queueRef.current, { type: 'REMOVE_ACTION', id: pendingAction.clientActionId });
            updateQueueStateAndStorage(updated);
          } else {
            // Phát hiện lỗi nghiệp vụ (State conflict trên DB)
            if (result.code === 'STATE_CONFLICT') {
              // Giải quyết xung đột: Fetch truth và xóa action hỏng khỏi queue
              await handleSyncConflict(pendingAction, result.error || 'Trạng thái máy chủ đã thay đổi');
              updated = queueReducer(queueRef.current, { type: 'REMOVE_ACTION', id: pendingAction.clientActionId });
              updateQueueStateAndStorage(updated);
            } else {
              // Lỗi DB/Hệ thống thông thường -> update status failed để lần sau thử lại
              updated = queueReducer(queueRef.current, { 
                type: 'UPDATE_STATUS', 
                id: pendingAction.clientActionId, 
                status: 'failed',
                error: result.error
              });
              updateQueueStateAndStorage(updated);
              break; // Dừng vòng lặp để giữ trật tự FIFO
            }
          }
        } catch (err: any) {
          // Lỗi mất kết nối vật lý bất ngờ trong lúc gửi HTTP
          updated = queueReducer(queueRef.current, { 
            type: 'UPDATE_STATUS', 
            id: pendingAction.clientActionId, 
            status: 'failed',
            error: err.message || 'Network loss'
          });
          updateQueueStateAndStorage(updated);
          break; // Tạm dừng để retry lần sau
        }
      }
    } finally {
      isSyncingRef.current = false;
    }
  }, [isOnline]);

  const clearQueueOnLogout = useCallback(async () => {
    updateQueueStateAndStorage([]);
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
  }, []);

  return (
    <OfflineContext.Provider value={{ 
      isOnline, 
      pendingCount: queue.length, 
      enqueueOfflineAction, 
      triggerSync,
      clearQueueOnLogout
    }}>
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) throw new Error('useOffline must be used within OfflineProvider');
  return ctx;
}

// Chuyển tiếp hành động lên máy chủ kèm client_action_id để đảm bảo tính idempotent
async function executeServerAction(action: OfflineAction): Promise<{ ok: boolean; error?: string; code?: string }> {
  const { getMobileSupabase } = await import('../lib/supabase');
  const supabase = getMobileSupabase();

  switch (action.actionType) {
    case 'CHECKIN': {
      const { sessionId, lat, lon } = action.payload;
      const { data, error } = await supabase.rpc('rpc_mobile_checkin_session', {
        p_session_id: sessionId,
        p_client_action_id: action.clientActionId,
        p_lat: lat,
        p_lon: lon
      });
      if (error) return { ok: false, error: error.message, code: 'DB_ERROR' };
      const res = data as { ok: boolean; error?: string; code?: string };
      return res;
    }
    case 'CHECKOUT': {
      const { sessionId, bookingId, notes, checkoutNote, lat, lon } = action.payload;
      const { data, error } = await supabase.rpc('rpc_mobile_complete_session', {
        p_session_id: sessionId,
        p_booking_id: bookingId,
        p_client_action_id: action.clientActionId,
        p_notes: notes,
        p_checkout_note: checkoutNote,
        p_lat: lat,
        p_lon: lon
      });
      if (error) return { ok: false, error: error.message, code: 'DB_ERROR' };
      const res = data as { ok: boolean; error?: string; code?: string };
      return res;
    }
    case 'SUBMIT_NOTE': {
      const { sessionId, notes } = action.payload;
      const { data, error } = await supabase.rpc('rpc_mobile_save_session_note', {
        p_session_id: sessionId,
        p_client_action_id: action.clientActionId,
        p_notes: notes
      });
      if (error) return { ok: false, error: error.message, code: 'DB_ERROR' };
      const res = data as { ok: boolean; error?: string; code?: string };
      return res;
    }
    default:
      return { ok: false, error: 'Hành động không hợp lệ' };
  }
}
```

---

## 7. Backlog Hạng Mục Phase 3

### [NEW] [20260712000002_backlog_notification_delivery_logs.sql](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260712000002_backlog_notification_delivery_logs.sql)

Ghi nhận logs gửi thông báo của Dịch vụ để phục vụ cơ chế tự động gửi lại (Retry mechanism) và quản lý hàng đợi chết (Dead Letter Queue) trong tương lai.

```sql
-- supabase/migrations/20260712000002_backlog_notification_delivery_logs.sql
CREATE TABLE IF NOT EXISTS public.notification_delivery_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID REFERENCES public.app_notifications(id) ON DELETE CASCADE,
    device_token_id UUID REFERENCES public.device_tokens(id) ON DELETE SET NULL,
    expo_push_token TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'retrying')),
    attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_delivery_logs_notification ON public.notification_delivery_logs(notification_id);
CREATE INDEX idx_delivery_logs_status       ON public.notification_delivery_logs(status) WHERE status = 'failed';

COMMENT ON TABLE public.notification_delivery_logs IS
    '[PHASE 3 Backlog] Bảng ghi nhận vết gửi notification từ Edge Function sang Expo API. '
    'Hỗ trợ đắc lực việc phân tích lý do trễ tin, lỗi 5xx, và xây dựng worker tự động gửi lại.';
```

---

## Thứ Tự Thực Thi Cập Nhật (15 bước)

```
── Supabase Backend (Idempotency & Safety) ──────────────────────────────
Bước 1   Chạy migration 20260712000000_mobile_idempotency_and_webhook.sql
          → Tạo processed actions + Webhook trigger an toàn
Bước 2   Chạy migration 20260712000001_idempotent_session_rpcs.sql
          → Khai báo RPCs nhận client_action_id chống chạy trùng lặp
Bước 3   Chạy migration 20260712000002_backlog_notification_delivery_logs.sql
          → Đăng ký cấu trúc bảng log phục vụ retry Phase 3
Bước 4   Deploy Edge Function `push-notifications` với cấu hình kiểm tra x-webhook-secret tuyệt đối

── Next.js Web App (Bảo mật) ─────────────────────────────────────────────
Bước 5   Cập nhật getUnreadNotifications() tại src/core/services/notification/notification-actions.ts
          → Thêm lọc target_user_id

── Mobile App (Offline Engine) ───────────────────────────────────────────
Bước 6   Cài đặt npm package `@react-native-community/netinfo`
Bước 7   Tạo apps/mobile/src/lib/cache.ts hỗ trợ set/get cache với TTL (KPI: 5m, Sessions: 2m, Schedule: 15m)
Bước 8   Tạo Context ngoại tuyến contexts/OfflineContext.tsx
          → SyncAgent single worker lock, xử lý xung đột dữ liệu bằng cách cập nhật server truth
Bước 9   Cập nhật AuthContext: Tích hợp dọn cache và clear queue vào signOut()
Bước 10  Tạo Component hiển thị trạng thái mạng components/OfflineBanner.tsx
Bước 11  Tích hợp OfflineProvider vào apps/mobile/app/_layout.tsx
Bước 12  Cập nhật Dashboard Service & Hook
          → Đọc local cache khi khởi động → render ngay → fetch Supabase refresh ngầm
Bước 13  Cập nhật Action CompleteSessionButton và CheckinButton
          → Nếu offline: Ghi nhận action vào OfflineContext, cập nhật optimistic UI, hiển thị badge "Chờ đồng bộ"
```

---

## Verification Plan (Kịch Bản Kiểm Thử v2)

### 1. Kiểm thử chống chạy trùng (Server-Side Idempotency)

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Gọi RPC `rpc_mobile_complete_session` lần đầu tiên với `client_action_id = 'A'` | Trả về `{ ok: true }`, row check-out cập nhật, 1 dòng chèn vào `mobile_processed_actions`. |
| 2 | Gọi lại RPC trên với cùng `client_action_id = 'A'` lần thứ 2 | Trả về `{ ok: true, message: 'Đã xử lý trước đó' }`, không tăng thêm số lượng buổi hoàn thành trong bookings. |

### 2. Kiểm thử Single Worker Lock & Tranh chấp dữ liệu

| Bước | Thực hiện | Kết quả mong đợi |
|---|---|---|
| 1 | Offline: Nhấn liên tiếp "Checkin" và "Checkout" nhanh dưới 1s | Hàng đợi ghi nhận tuần tự, không bị ghi đè dữ liệu trạng thái nhờ reducer. |
| 2 | Kết nối lại mạng | SyncAgent xử lý FIFO tuần tự, log "Syncing" chạy từng action. `isSyncingRef` chặn các luồng gọi song song. |
| 3 | Offline: Nhấn hoàn thành buổi hẹn số 5 | Trạng thái hiển thị completed trên thiết bị tạm thời. |
| 4 | Admin trên web đổi trạng thái buổi hẹn số 5 thành cancelled | DB ghi nhận cancelled. |
| 5 | Mobile kết nối mạng trở lại để đồng bộ | Server trả về lỗi `STATE_CONFLICT` -> Mobile kích hoạt `handleSyncConflict()`, kéo dữ liệu thực từ server về đè cache, hiển thị cảnh báo, UI cập nhật lại chuẩn xác. |
| 6 | Nhấn Logout trên Mobile | Toàn bộ cache `@bella/cache/` và hàng đợi `@bella/offline-queue` bị dọn sạch khỏi AsyncStorage. |

---

## Định Nghĩa Hoàn Thành (DoD)

- [ ] Webhook trigger `trig_push_notifications` chạy an toàn qua secret `x-webhook-secret`.
- [ ] Edge function dispatch push message thành công và xử lý dọn dẹp token chết.
- [ ] Web app Next.js không bị rò rỉ targeted notification của người dùng khác.
- [ ] Mọi hành động thực hiện khi offline được gán `clientActionId` (UUID) và lưu trữ bền vững trên AsyncStorage.
- [ ] RPCs nghiệp vụ kiểm tra bảng `mobile_processed_actions` trước khi thực thi để chống trùng lặp.
- [ ] SyncAgent sử dụng ref lock chặn đồng bộ song song khi mạng chập chờn.
- [ ] Cơ chế xử lý xung đột kéo server truth về ghi đè cache khi gặp lỗi đồng bộ.
- [ ] Logout dọn sạch cache và queue offline.
- [ ] CI pass: Mobile typecheck + Web build thành công không lỗi regression.
