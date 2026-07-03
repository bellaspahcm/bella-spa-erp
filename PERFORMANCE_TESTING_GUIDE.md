# 🔍 KTV PWA Performance Testing Guide

## 🎯 Mục tiêu
Chẩn đoán lý do **KTV PWA Dashboard load > 5 giây** bằng performance profiling logs.

---

## 📋 Cách test

### Bước 1: Deploy lên Vercel
Code đã được push lên `main` branch (commit `42fb3c38`). Vercel sẽ tự động deploy trong 2-3 phút.

### Bước 2: Truy cập KTV PWA trên mobile/browser
1. Mở Chrome/Edge trên điện thoại hoặc máy tính
2. Truy cập: `https://yourdomain.vercel.app/login`
3. Đăng nhập bằng tài khoản KTV
4. **BẮT ĐẦU GHI LOG**: Mở Developer Tools (F12 trên desktop, hoặc Chrome Remote Debugging trên mobile)
5. Chuyển đến tab **Console**
6. **QUAN TRỌNG**: Xóa cache để test performance từ đầu:
   - Desktop: `Ctrl + Shift + R` (hard reload)
   - Mobile: Settings → Site Settings → Clear data

### Bước 3: Phân tích logs trong Console

Sau khi dashboard load xong, bạn sẽ thấy các logs như sau:

```
[KTV Dashboard] ⏱️ Starting data fetch...
[getCurrentUser] auth.getUser took XXXms
[getCurrentUser] users table query took XXXms
[getCurrentUser] tenant status query took XXXms
[getCurrentUser] TOTAL TIME: XXXms
[getTenantSettings] getCurrentUser took XXXms
[getTenantSettings] fetchTenantSnapshot took XXXms
[getTenantSettings] TOTAL TIME: XXXms
[KTV Dashboard] ✅ Critical data loaded in XXXms
[KTV Dashboard] 💾 Cache HIT - loaded sessions in XXXms
[KTV Dashboard] 🎉 UI READY in XXXms (cached path)
```

**HOẶC** (nếu cache miss):

```
[KTV Dashboard] ⏱️ Starting data fetch...
[getCurrentUser] TOTAL TIME: XXXms
[getTenantSettings] TOTAL TIME: XXXms
[KTV Dashboard] ✅ Critical data loaded in XXXms
[KTV Dashboard] 💨 Cache MISS - fetching sessions from API...
[getKTVActiveSessions] getCurrentUser took XXXms
[getKTVActiveSessions] DB query took XXXms
[getKTVActiveSessions] Processing took XXXms
[getKTVActiveSessions] TOTAL TIME: XXXms
[getKTVUpcomingSessions] getCurrentUser took XXXms
[getKTVUpcomingSessions] Original sessions query took XXXms
[getKTVUpcomingSessions] Reassigned sessions query took XXXms
[getKTVUpcomingSessions] Merge & dedup took XXXms
[getKTVUpcomingSessions] All sessions for bookings query took XXXms
[getKTVUpcomingSessions] Processing took XXXms
[getKTVUpcomingSessions] TOTAL TIME: XXXms
[KTV Dashboard] 📡 Sessions fetched in XXXms
[KTV Dashboard] 🎉 UI READY in XXXms (API path)
[KTV Dashboard] 📊 Background data loaded in XXXms
```

---

## 🔬 Chẩn đoán bottlenecks

### Kịch bản 1: `cache_import` > 1000ms
**Vấn đề**: IndexedDB import chậm (thường xảy ra trên Safari/iOS)
**Giải pháp**: 
- Lazy load offline-db module: `const { getCachedSessions } = await import('@/lib/offline-db')`
- Hoặc disable cache cho KTV PWA (trade-off: không offline được)

### Kịch bản 2: `critical_data` > 2000ms
**Vấn đề**: `getCurrentUser()` hoặc `getTenantSettings()` chậm
**Nguyên nhân có thể**:
- Supabase auth.getUser() chậm (network latency)
- Query `users` table chậm (thiếu index trên `email` hoặc `tenant_id`)
- Query `tenants` table chậm (thiếu index)

**Giải pháp**:
```sql
-- Tạo indexes trên Supabase
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_tenant ON public.users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_id ON public.tenants (id);
```

### Kịch bản 3: `sessions_fetch` > 3000ms
**Vấn đề**: `getKTVActiveSessions()` hoặc `getKTVUpcomingSessions()` chậm

**Nếu `Original sessions query` > 1000ms**:
```sql
-- Session logs cần index trên (completed_by_ktv_id, status)
CREATE INDEX IF NOT EXISTS idx_session_logs_ktv_status 
ON public.session_logs (completed_by_ktv_id, status);

-- Bookings cần index trên assigned_ktv_id
CREATE INDEX IF NOT EXISTS idx_bookings_assigned_ktv 
ON public.bookings (assigned_ktv_id);
```

**Nếu `All sessions for bookings query` > 1500ms**:
```sql
-- Session logs cần composite index cho IN query
CREATE INDEX IF NOT EXISTS idx_session_logs_booking_id 
ON public.session_logs (booking_id, session_number);
```

### Kịch bản 4: `background_data` > 2000ms
**Vấn đề**: `getKTVEarnings()`, `getKTVNotifications()`, hoặc `getKTVLeaderboard()` chậm
**Ảnh hưởng**: Không block UI, nhưng header earnings/notifications load chậm

**Giải pháp**:
- Optimize RPC `get_ktv_leaderboard` (nếu chậm)
- Add index cho `Notification` table trên `userId`
- Consider caching earnings trong Redis (nếu scale lớn)

---

## 📊 Benchmark mục tiêu

| Metric | Target | Acceptable | Slow |
|--------|--------|------------|------|
| `cache_import` | < 100ms | < 500ms | > 1000ms |
| `critical_data` | < 500ms | < 1000ms | > 2000ms |
| `sessions_fetch` | < 1000ms | < 2000ms | > 3000ms |
| `background_data` | < 500ms | < 1500ms | > 2500ms |
| **TOTAL to UI** | **< 1500ms** | **< 3000ms** | **> 5000ms** |

---

## 🚀 Nếu vẫn chậm sau khi optimize

### Option 1: Server-Side Rendering (SSR) cho critical data
```tsx
// src/app/ktv/dashboard/page.tsx
export default async function KTVDashboard() {
  // Server-side fetch (không qua Supabase client)
  const user = await getCurrentUser();
  const sessions = await getKTVUpcomingSessions();
  
  return <KTVDashboardClient initialUser={user} initialSessions={sessions} />;
}
```

### Option 2: Edge caching với Vercel KV
```typescript
// Cache user + tenant settings for 60s
import { kv } from '@vercel/kv';

export async function getCurrentUser() {
  const cached = await kv.get(`user:${userId}`);
  if (cached) return cached;
  
  const user = await fetchFromDB();
  await kv.set(`user:${userId}`, user, { ex: 60 });
  return user;
}
```

### Option 3: Prefetch qua Service Worker
```javascript
// public/sw.js
self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('/api/ktv/sessions')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          const copy = response.clone();
          caches.open('api-cache').then(cache => cache.put(event.request, copy));
          return response;
        });
        return cached || fetchPromise;
      })
    );
  }
});
```

---

## 📸 Screenshot logs để gửi tôi

Sau khi test, chụp ảnh Console logs và gửi cho tôi. Tôi sẽ phân tích và đưa ra giải pháp cụ thể.

**Lưu ý**: Nếu thấy lỗi `CORS` hoặc `Network Error`, restart Vercel deployment hoặc kiểm tra Supabase URL.
