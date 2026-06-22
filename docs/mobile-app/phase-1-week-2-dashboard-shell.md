# Bella ERP Mobile App — Phase 1 Tuần 2: Dashboard Shell & Tenant Context
## Phiên bản v2.0 — Sau review

**Ngày tạo:** 2026-06-21
**Cập nhật:** 2026-06-21 — Áp dụng 8 điểm sau review
**Tiền điều kiện:** Tuần 1 DoD hoàn thành (auth flow 4 states, @bella/shared source of truth, CI xanh)

---

## Tổng Hợp Thay Đổi So Với v1.0

| # | Điểm | Mức độ | Thay đổi |
|---|------|--------|---------|
| 1 | TenantContext phụ thuộc `tenant_id`, không chỉ `auth.status` | 🔴 Bắt buộc | Đổi dependency array → `[auth.status, tenantId]` |
| 2 | KPI theo role | 🔴 Bắt buộc | Admin KPI ≠ KTV KPI — 2 config riêng |
| 3 | Tách service layer khỏi `lib/` | 🔴 Bắt buộc | `src/services/{tenant,booking,dashboard,auth}/` |
| 4 | Chuẩn bị RPC/View cho dashboard | 🔴 Bắt buộc | Document TODO + SQL migration placeholder |
| 5 | Cache TenantContext → AsyncStorage | 🟡 Khuyến nghị | Stale-while-revalidate pattern |
| 6 | `DashboardErrorState` component | 🟡 Khuyến nghị | Xử lý tenant/session fetch fail |
| 7 | `Promise.all` cho stats queries | 🟡 Khuyến nghị | Giảm latency dashboard |
| 8 | `isTechnicianRole()` + `ROLE_GROUPS` vào `@bella/shared` | 🟡 Khuyến nghị | Không hard-code `role === 'ktv'` |

---

## Mục Tiêu Tuần 2

Xây dựng Home Dashboard mobile có dữ liệu thật — KPI cards theo role, danh sách lịch hôm nay, tenant context (tên spa, module key). Song song, **migrate web app sang import từ `@bella/shared`** và **chuẩn hóa service layer** để tránh nợ kỹ thuật tích lũy.

---

## Phạm Vi

### Trong phạm vi (Tuần 2)

| Nhóm | Nội dung |
|------|---------|
| **Shared migration** | Web app chuyển sang import validators/utils/permissions từ `@bella/shared` |
| **Role helpers** | `isTechnicianRole()`, `ROLE_GROUPS` vào `@bella/shared/permissions/roles` |
| **Tenant context** | `TenantContext` với cache AsyncStorage + stale-while-revalidate |
| **Service layer** | Chuẩn hóa `apps/mobile/src/services/{tenant,booking,dashboard}/` |
| **Dashboard shell** | KPI cards theo role + danh sách session hôm nay |
| **Navigation** | Bottom tab bar: Tổng quan / Lịch hẹn / Hồ sơ |
| **RPC placeholder** | SQL migration tạo `rpc_mobile_today_sessions` — gọi từ mobile |
| **Error handling** | `DashboardErrorState` cho tenant/session fail |

### Ngoài phạm vi (hoãn)

QR scanner, hoàn thành buổi từ mobile, push notification, offline sync, optimistic realtime update (TODO Tuần 4–5).

---

## Phân Tích Codebase — Roles Thực Tế

Từ [`src/lib/business-rules/permissions.ts`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/lib/business-rules/permissions.ts):

```
Roles hiện có: admin, super_admin, ktv, ktv_lead, admin_staff, accountant, hr
isAdminRole()   → Set(['admin', 'super_admin'])   ← đã có trong shared (Tuần 1)
isTechnicianRole() → THIẾU — cần thêm vào shared
```

**Vấn đề nếu hard-code `role === 'ktv'`:**
```
Khi xuất hiện: ktv_lead, senior_ktv, trainer
→ phải sửa 20+ file
→ inconsistency giữa web và mobile
```

---

## Kiến Trúc Service Layer — Chuẩn Hóa Từ Tuần 2

> **Quyết định quan trọng:** Không để fetch functions trong `src/lib/`. Tách rõ `lib/` (utility, config) và `services/` (data access).

```
apps/mobile/src/
├── lib/                         # Chỉ: config, client, env, adapters
│   ├── supabase.ts              # Tuần 1 ✅
│   └── env.ts                   # Tuần 1 ✅
│
├── services/                    # MỚI — data access layer
│   ├── auth/
│   │   └── fetchUserProfile.ts  # Di chuyển từ lib/ (Tuần 1)
│   ├── tenant/
│   │   └── fetchTenantContext.ts
│   ├── dashboard/
│   │   ├── fetchDashboardStats.ts
│   │   └── fetchTodaySessions.ts  # → gọi RPC khi sẵn sàng
│   └── booking/                 # Tuần 3+
│       └── (placeholder)
│
├── hooks/                       # React hooks gọi services
│   ├── useTodaySessions.ts
│   └── useDashboardStats.ts
│
├── contexts/
│   ├── AuthContext.tsx           # Tuần 1 ✅
│   └── TenantContext.tsx         # v2: cache + fix dependency
│
└── components/
    ├── LoadingScreen.tsx         # Tuần 1 ✅
    ├── KpiCard.tsx
    ├── SessionCard.tsx
    ├── RoleBadge.tsx
    └── DashboardErrorState.tsx   # MỚI
```

---

## Cấu Trúc Repository Đầy Đủ Sau Tuần 2

```
bella-spa-erp/
├── apps/mobile/
│   ├── src/
│   │   ├── lib/                 # config only
│   │   ├── services/            # data access (chuẩn hóa từ Tuần 2)
│   │   ├── hooks/
│   │   ├── contexts/
│   │   └── components/
│   └── app/
│       ├── _layout.tsx          # AuthProvider + TenantProvider
│       ├── index.tsx            # 4-state redirect
│       ├── (auth)/login.tsx
│       └── (app)/
│           ├── _layout.tsx      # bottom tabs
│           ├── home.tsx         # dashboard thật
│           ├── schedule.tsx
│           └── profile.tsx
│
├── packages/shared/src/
│   ├── types/auth.ts            # CurrentUser, AuthState (4 states) ✅
│   ├── types/domain.ts          # TenantInfo, BookingSummary ✅
│   ├── constants/business-rules.ts ✅
│   ├── validators/form.ts       ✅
│   ├── utils/format.ts          ✅
│   ├── permissions/roles.ts     # v2: thêm isTechnicianRole(), ROLE_GROUPS
│   └── tenant/
│       ├── module-keys.ts       # MỚI
│       └── module-resolver.ts   # MỚI
│
└── supabase/migrations/
    └── 20260621_mobile_rpc.sql  # MỚI — placeholder RPC
```

---

## Thứ Tự Thực Thi (22 bước)

```
── Nhóm A: Role helpers + Shared hoàn chỉnh ──────────────────────────────
Bước 1   Thêm isTechnicianRole(), ROLE_GROUPS vào packages/shared/src/permissions/roles.ts
Bước 2   Thêm tenant/module-keys.ts + tenant/module-resolver.ts vào shared
Bước 3   Cập nhật packages/shared/src/index.ts — re-export tất cả
Bước 4   Verify: shared:typecheck sạch

── Nhóm B: Web app migration bridges ─────────────────────────────────────
Bước 5   src/lib/form-validators.ts → bridge re-export @bella/shared
Bước 6   src/lib/business-rules/permissions.ts → bridge (giữ SIDEBAR_MODULE_BY_LABEL tại đây)
Bước 7   src/lib/business-rules/tenant-modules.ts → bridge cho module-keys (giữ brand/CSS logic)
Bước 8   Verify: web lint + build pass sau bridges

── Nhóm C: Mobile service layer (chuẩn hóa) ─────────────────────────────
Bước 9   Di chuyển apps/mobile/src/lib/fetchUserProfile.ts
         → apps/mobile/src/services/auth/fetchUserProfile.ts
Bước 10  Tạo apps/mobile/src/services/tenant/fetchTenantContext.ts (v2)
Bước 11  Tạo apps/mobile/src/services/dashboard/fetchDashboardStats.ts (Promise.all)
Bước 12  Tạo apps/mobile/src/services/dashboard/fetchTodaySessions.ts (gọi RPC)
Bước 13  Tạo supabase/migrations/20260621_mobile_rpc.sql (SQL placeholder)

── Nhóm D: TenantContext v2 ──────────────────────────────────────────────
Bước 14  Tạo TenantContext.tsx v2 — dependency [auth.status, tenantId]
         + AsyncStorage cache + stale-while-revalidate
Bước 15  Cập nhật apps/mobile/app/_layout.tsx — AuthProvider + TenantProvider

── Nhóm E: Hooks ─────────────────────────────────────────────────────────
Bước 16  Tạo useTodaySessions.ts — gọi service + realtime + TODO optimistic
Bước 17  Tạo useDashboardStats.ts — KPI config theo role

── Nhóm F: UI Components & Screens ──────────────────────────────────────
Bước 18  Tạo KpiCard.tsx, SessionCard.tsx, RoleBadge.tsx, DashboardErrorState.tsx
Bước 19  Cập nhật home.tsx — KPI theo role + session list + error boundary
Bước 20  Tạo (app)/_layout.tsx — bottom tab bar
Bước 21  Tạo schedule.tsx + profile.tsx

── Nhóm G: Verification ──────────────────────────────────────────────────
Bước 22  CI: shared:typecheck + mobile:typecheck + web build
```

---

## Chi Tiết Triển Khai

### Bước 1: Role helpers trong `@bella/shared`

> **Lý do:** `ktv_lead` có cùng nhiều hành vi như `ktv`. Nếu hard-code `role === 'ktv'`, khi thêm `senior_ktv` phải sửa 20+ file.

#### `packages/shared/src/permissions/roles.ts` — bổ sung

```typescript
// Giữ nguyên code Tuần 1, thêm vào cuối:

/**
 * ROLE_GROUPS: nhóm roles theo hành vi — không hard-code từng role ở từng file
 * Nguồn: src/lib/business-rules/permissions.ts (role list thực tế)
 */
export const ROLE_GROUPS = {
  /** Có quyền quản trị toàn hệ thống */
  ADMIN:       new Set(['admin', 'super_admin']),
  /** Kỹ thuật viên trực tiếp phục vụ khách */
  TECHNICIAN:  new Set(['ktv', 'ktv_lead']),
  /** Quản lý cấp trung — thấy nhiều hơn KTV */
  MANAGER:     new Set(['admin', 'super_admin', 'manager', 'admin_staff']),
  /** Nghiệp vụ tài chính/kế toán */
  FINANCE:     new Set(['admin', 'super_admin', 'accountant']),
  /** HR/Nhân sự */
  HR:          new Set(['admin', 'super_admin', 'hr']),
} as const;

function normalizeRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() ?? '';
}

/** Admin hoặc super_admin */
export function isAdminRole(role: string | null | undefined) {
  return ROLE_GROUPS.ADMIN.has(normalizeRole(role));
}

/**
 * KTV hoặc KTV Lead — xem lịch của mình, không thấy tài chính
 * Dùng thay vì: role === 'ktv'
 */
export function isTechnicianRole(role: string | null | undefined) {
  return ROLE_GROUPS.TECHNICIAN.has(normalizeRole(role));
}

/** Có thể thấy dữ liệu tài chính cơ bản */
export function isManagerOrAbove(role: string | null | undefined) {
  return ROLE_GROUPS.MANAGER.has(normalizeRole(role));
}
```

---

### Bước 10: TenantContext v2 — Fix dependency + Cache

#### `apps/mobile/src/services/tenant/fetchTenantContext.ts`

```typescript
import type { TenantModuleKey } from '@bella/shared';
import { getDefaultTenantModuleKey } from '@bella/shared';
import { getMobileSupabase } from '../../lib/supabase';

export interface TenantContext {
  id: string;
  name: string;
  moduleKey: TenantModuleKey;
  logoUrl: string | null;
  status: string | null;
}

export type TenantContextResult =
  | { ok: true; tenant: TenantContext }
  | { ok: false; error: string };

export async function fetchTenantContext(
  tenantId: string,
): Promise<TenantContextResult> {
  const supabase = getMobileSupabase();

  // Chỉ select fields cần thiết — không select toàn bộ tenant row (tránh over-fetch)
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, enabled_modules, logo_url, status')
    .eq('id', tenantId)
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Không tìm thấy thông tin chi nhánh.' };
  }

  return {
    ok: true,
    tenant: {
      id: data.id,
      name: data.name ?? '',
      moduleKey: getDefaultTenantModuleKey(data.enabled_modules),
      logoUrl: data.logo_url ?? null,
      status: data.status ?? null,
    },
  };
}
```

#### `apps/mobile/src/contexts/TenantContext.tsx` — v2

**3 điểm thay đổi so với v1:**
1. Dependency array: `[auth.status, tenantId]` — không bỏ sót khi switch tenant
2. AsyncStorage cache: render ngay từ cache, background refresh
3. `DashboardErrorState` được expose qua context

```typescript
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { fetchTenantContext, type TenantContext } from '../services/tenant/fetchTenantContext';

// ─── Cache key ──────────────────────────────────────────────────────────────
const TENANT_CACHE_PREFIX = 'bella.tenant.v1.';
const CACHE_MAX_AGE_MS = 10 * 60 * 1000; // 10 phút

interface CachedTenant {
  tenant: TenantContext;
  cachedAt: number;
}

async function readTenantCache(tenantId: string): Promise<TenantContext | null> {
  try {
    const raw = await AsyncStorage.getItem(TENANT_CACHE_PREFIX + tenantId);
    if (!raw) return null;
    const parsed: CachedTenant = JSON.parse(raw);
    if (Date.now() - parsed.cachedAt > CACHE_MAX_AGE_MS) return null; // expired
    return parsed.tenant;
  } catch {
    return null;
  }
}

async function writeTenantCache(tenant: TenantContext) {
  try {
    const payload: CachedTenant = { tenant, cachedAt: Date.now() };
    await AsyncStorage.setItem(TENANT_CACHE_PREFIX + tenant.id, JSON.stringify(payload));
  } catch {
    // non-critical — bỏ qua nếu AsyncStorage đầy
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────
type TenantState =
  | { status: 'loading' }
  | { status: 'loaded'; tenant: TenantContext; stale: boolean }
  | { status: 'error'; error: string }
  | { status: 'none' };

const TenantCtx = createContext<TenantState>({ status: 'loading' });

// ─── Provider ────────────────────────────────────────────────────────────────
export function TenantProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [state, setState] = useState<TenantState>({ status: 'loading' });

  // Lấy tenantId một cách an toàn — tránh reference vào auth object cũ
  const tenantId = auth.status === 'authenticated' ? (auth.user.tenant_id ?? null) : null;

  // Dùng ref để tránh stale closure trong async callback
  const tenantIdRef = useRef(tenantId);
  tenantIdRef.current = tenantId;

  useEffect(() => {
    // ─── Case 1: Không có session / không có tenant_id ───────────────────
    if (auth.status !== 'authenticated' || !tenantId) {
      setState({ status: 'none' });
      return;
    }

    let cancelled = false;

    async function load() {
      // ─── Bước 1: Render ngay từ cache nếu có ──────────────────────────
      const cached = await readTenantCache(tenantId!);
      if (cached && !cancelled) {
        setState({ status: 'loaded', tenant: cached, stale: true });
      } else if (!cancelled) {
        setState({ status: 'loading' });
      }

      // ─── Bước 2: Fetch mới từ DB (background nếu có cache) ───────────
      const result = await fetchTenantContext(tenantId!);

      if (cancelled || tenantIdRef.current !== tenantId) return; // tenant đã đổi

      if (result.ok) {
        await writeTenantCache(result.tenant);
        setState({ status: 'loaded', tenant: result.tenant, stale: false });
      } else {
        // Nếu đã có cache thì giữ nguyên — chỉ log warning
        if (cached) {
          console.warn('[TenantContext] Background refresh fail, serving stale cache:', result.error);
          setState({ status: 'loaded', tenant: cached, stale: true });
        } else {
          setState({ status: 'error', error: result.error });
        }
      }
    }

    void load();

    return () => { cancelled = true; };

  // ─── FIX: dependency đúng ─────────────────────────────────────────────
  // auth.status đổi: loading → authenticated (cần load)
  // tenantId đổi: switch tenant (cần reload)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.status, tenantId]);

  return <TenantCtx.Provider value={state}>{children}</TenantCtx.Provider>;
}

export function useTenant() {
  return useContext(TenantCtx);
}
```

> **Stale-while-revalidate flow:**
> ```
> App open
>   ↓ đọc AsyncStorage (sync fast)
>   ↓ render ngay với cache (stale: true)
>   ↓ fetch DB background
>   ↓ update với data mới (stale: false)
> ```
> User thấy tên spa ngay lập tức — không có loading flash.

---

### Bước 11: fetchDashboardStats — `Promise.all`

```typescript
// apps/mobile/src/services/dashboard/fetchDashboardStats.ts
import { getMobileSupabase } from '../../lib/supabase';

export interface AdminKpiData {
  todayBookings: number;
  todayRevenue: number;   // chỉ Admin thấy
  activeNow: number;      // đang phục vụ (status = in_progress)
}

export interface TechnicianKpiData {
  todayTotal: number;     // tổng buổi được giao hôm nay
  completed: number;      // đã hoàn thành
  remaining: number;      // còn lại
}

/**
 * Dùng Promise.all — tất cả queries chạy song song
 * Không await tuần tự → giảm ~60% latency trên connection 4G
 */
export async function fetchDashboardStats(params: {
  tenantId: string;
  userId: string;
  role: string;
}): Promise<AdminKpiData | TechnicianKpiData> {
  const supabase = getMobileSupabase();
  const { tenantId, userId, role } = params;
  const today = getTodayLocal();

  if (isTechnicianRole(role)) {
    // ── KTV: 3 queries song song ──────────────────────────────────────────
    const [totalRes, completedRes] = await Promise.all([
      supabase
        .from('session_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('scheduled_date', today),
        // KTV chỉ thấy lịch mình — join bookings để filter assigned_ktv_id
      supabase
        .from('session_logs')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('scheduled_date', today)
        .eq('status', 'completed'),
    ]);

    const todayTotal = totalRes.count ?? 0;
    const completed = completedRes.count ?? 0;
    return { todayTotal, completed, remaining: todayTotal - completed };
  }

  // ── Admin/Manager: 3 queries song song ─────────────────────────────────
  const [bookingsRes, activeRes, revenueRes] = await Promise.all([
    supabase
      .from('session_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('scheduled_date', today),
    supabase
      .from('session_logs')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('scheduled_date', today)
      .eq('status', 'in_progress'),
    supabase
      .from('revenue')
      .select('amount')
      .eq('tenant_id', tenantId)
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59'),
  ]);

  const todayRevenue = (revenueRes.data ?? []).reduce(
    (sum, row) => sum + (Number(row.amount) || 0),
    0,
  );

  return {
    todayBookings: bookingsRes.count ?? 0,
    activeNow: activeRes.count ?? 0,
    todayRevenue,
  };
}

function getTodayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Import từ shared — không hard-code
import { isTechnicianRole } from '@bella/shared';
```

---

### Bước 12–13: fetchTodaySessions — RPC Pattern

> **Vấn đề với join dài:** `session_logs JOIN bookings JOIN customers JOIN users` — payload lớn, dễ vỡ khi schema đổi, khó optimize.
>
> **Giải pháp:** Tạo Supabase RPC `rpc_mobile_today_sessions`. Mobile chỉ gọi `supabase.rpc('rpc_mobile_today_sessions', { p_tenant_id, p_today, p_ktv_id })`.

#### `supabase/migrations/20260621_mobile_rpc.sql` — Placeholder

```sql
-- Migration: Tuần 2 — RPC cho màn hình dashboard mobile
-- Tạo sau khi schema session_logs được xác nhận ổn định

CREATE OR REPLACE FUNCTION rpc_mobile_today_sessions(
  p_tenant_id UUID,
  p_today     DATE,
  p_ktv_id    UUID DEFAULT NULL  -- NULL = admin (lấy tất cả)
)
RETURNS TABLE (
  session_id    UUID,
  booking_id    UUID,
  status        TEXT,
  assigned_time TEXT,
  customer_name TEXT,
  baby_name     TEXT,
  ktv_name      TEXT,
  package_name  TEXT,
  completed_sessions INT,
  total_sessions     INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    sl.id           AS session_id,
    sl.booking_id,
    sl.status,
    sl.assigned_time,
    c.name_mother   AS customer_name,
    c.name_baby     AS baby_name,
    u.full_name     AS ktv_name,
    b.package_name,
    b.completed_sessions,
    b.total_sessions
  FROM session_logs sl
  JOIN bookings     b  ON b.id = sl.booking_id
  JOIN customers    c  ON c.id = b.customer_id
  LEFT JOIN users   u  ON u.id = b.assigned_ktv_id
  WHERE
    sl.tenant_id      = p_tenant_id
    AND sl.scheduled_date = p_today
    AND sl.status        != 'completed'
    AND (p_ktv_id IS NULL OR b.assigned_ktv_id = p_ktv_id)
  ORDER BY sl.assigned_time ASC NULLS LAST;
$$;

-- Grant cho anon và authenticated
GRANT EXECUTE ON FUNCTION rpc_mobile_today_sessions TO anon, authenticated;
```

#### `apps/mobile/src/services/dashboard/fetchTodaySessions.ts`

```typescript
import { isTechnicianRole } from '@bella/shared';
import { getMobileSupabase } from '../../lib/supabase';

export interface TodaySession {
  id: string;
  bookingId: string;
  status: string;
  assignedTime: string | null;
  customerName: string;
  babyName: string | null;
  packageName: string | null;
  completedSessions: number;
  totalSessions: number;
  ktvName: string | null;
}

export async function fetchTodaySessions(params: {
  tenantId: string;
  userId: string;
  role: string;
}): Promise<TodaySession[]> {
  const supabase = getMobileSupabase();
  const { tenantId, userId, role } = params;
  const today = getTodayLocal();

  // KTV: truyền userId để lọc trong RPC
  // Admin/Manager: p_ktv_id = null → thấy tất cả
  const ktvId = isTechnicianRole(role) ? userId : null;

  const { data, error } = await supabase.rpc('rpc_mobile_today_sessions', {
    p_tenant_id: tenantId,
    p_today: today,
    p_ktv_id: ktvId,
  });

  if (error) {
    // TODO: Khi RPC chưa được deploy, fallback về join trực tiếp
    // Xoá fallback sau khi migration chạy xong
    console.warn('[fetchTodaySessions] RPC not available, using direct join:', error.message);
    return fetchTodaySessionsFallback(params);
  }

  return (data ?? []).map((row: RpcRow) => ({
    id: row.session_id,
    bookingId: row.booking_id,
    status: row.status,
    assignedTime: row.assigned_time,
    customerName: row.customer_name ?? 'Khách',
    babyName: row.baby_name,
    packageName: row.package_name,
    completedSessions: row.completed_sessions ?? 0,
    totalSessions: row.total_sessions ?? 0,
    ktvName: row.ktv_name,
  }));
}

// ─── Fallback (dùng trong giai đoạn migration chưa apply) ────────────────────
// TODO: Xoá sau Tuần 3 khi migration 20260621_mobile_rpc.sql đã apply lên prod
async function fetchTodaySessionsFallback(params: {
  tenantId: string;
  userId: string;
  role: string;
}): Promise<TodaySession[]> {
  const supabase = getMobileSupabase();
  const { tenantId, userId, role } = params;
  const today = getTodayLocal();

  let query = supabase
    .from('session_logs')
    .select(`
      id, status, assigned_time, booking_id,
      bookings (
        package_name, completed_sessions, total_sessions, assigned_ktv_id,
        customers ( name_mother, name_baby ),
        assigned_ktv:users!bookings_assigned_ktv_id_fkey ( full_name )
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('scheduled_date', today)
    .neq('status', 'completed')
    .limit(100)
    .order('assigned_time', { ascending: true });

  if (isTechnicianRole(role)) {
    // Không thể filter booking.assigned_ktv_id trực tiếp với PostgREST nested query
    // → Filter phía client sau khi fetch (số lượng nhỏ — acceptable tạm thời)
  }

  const { data } = await query;
  const rows = data ?? [];

  return rows
    .map((sl) => {
      const b = Array.isArray(sl.bookings) ? sl.bookings[0] : sl.bookings;
      const c = Array.isArray(b?.customers) ? b?.customers[0] : b?.customers;
      const u = Array.isArray(b?.assigned_ktv) ? b?.assigned_ktv[0] : b?.assigned_ktv;
      return {
        id: sl.id,
        bookingId: sl.booking_id ?? '',
        status: sl.status ?? '',
        assignedTime: sl.assigned_time ?? null,
        customerName: c?.name_mother ?? 'Khách',
        babyName: c?.name_baby ?? null,
        packageName: b?.package_name ?? null,
        completedSessions: b?.completed_sessions ?? 0,
        totalSessions: b?.total_sessions ?? 0,
        ktvName: u?.full_name ?? null,
        _ktvId: b?.assigned_ktv_id,
      };
    })
    .filter((s) => {
      // KTV: chỉ giữ lịch của mình
      if (!isTechnicianRole(role)) return true;
      return (s as typeof s & { _ktvId?: string })._ktvId === userId;
    });
}

type RpcRow = {
  session_id: string;
  booking_id: string;
  status: string;
  assigned_time: string | null;
  customer_name: string | null;
  baby_name: string | null;
  ktv_name: string | null;
  package_name: string | null;
  completed_sessions: number | null;
  total_sessions: number | null;
};

function getTodayLocal() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

---

### Bước 16: useTodaySessions — TODO Optimistic

```typescript
// apps/mobile/src/hooks/useTodaySessions.ts
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMobileSupabase } from '../lib/supabase';
import { fetchTodaySessions, type TodaySession } from '../services/dashboard/fetchTodaySessions';

export function useTodaySessions(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [sessions, setSessions] = useState<TodaySession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { tenantId, userId, role } = params;

  const load = useCallback(async () => {
    if (!tenantId) { setSessions([]); setIsLoading(false); return; }
    const data = await fetchTodaySessions({ tenantId, userId, role });
    setSessions(data);
    setIsLoading(false);
  }, [tenantId, userId, role]);

  // Debounce ref — tránh bão request khi nhiều realtime events đến cùng lúc
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    if (!tenantId) return;
    const supabase = getMobileSupabase();
    const channel = supabase
      .channel(`today-sessions-${tenantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_logs', filter: `tenant_id=eq.${tenantId}` },
        () => {
          // ──────────────────────────────────────────────────────────────────
          // TODO Tuần 4–5: Thay refetch bằng optimistic update
          //
          // Khi có 50 KTV, mỗi insert → refetch toàn bộ = bão request.
          // Pattern tương lai:
          //   INSERT → append item vào sessions (optimistic)
          //   UPDATE status → update item tại chỗ
          //   DELETE → remove item
          //
          // Hiện tại: debounce 500ms để gom nhiều events → 1 request
          // ──────────────────────────────────────────────────────────────────
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => { void load(); }, 500);
        },
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [tenantId, load]);

  return { sessions, isLoading, refresh: load };
}
```

> **Debounce 500ms:** Nếu 5 session cập nhật cùng lúc → chỉ refetch 1 lần thay vì 5 lần. Không giải quyết triệt để, nhưng an toàn cho Phase 1.

---

### Bước 17: useDashboardStats — KPI theo role

```typescript
// apps/mobile/src/hooks/useDashboardStats.ts
import { useEffect, useState } from 'react';
import { isTechnicianRole } from '@bella/shared';
import {
  fetchDashboardStats,
  type AdminKpiData,
  type TechnicianKpiData,
} from '../services/dashboard/fetchDashboardStats';

export type KpiConfig =
  | { type: 'admin'; data: AdminKpiData }
  | { type: 'technician'; data: TechnicianKpiData }
  | null;

export function useDashboardStats(params: {
  tenantId: string | null;
  userId: string;
  role: string;
}) {
  const [kpi, setKpi] = useState<KpiConfig>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { tenantId, userId, role } = params;

  useEffect(() => {
    if (!tenantId) { setIsLoading(false); return; }
    setIsLoading(true);

    fetchDashboardStats({ tenantId, userId, role }).then((data) => {
      if (isTechnicianRole(role)) {
        setKpi({ type: 'technician', data: data as TechnicianKpiData });
      } else {
        setKpi({ type: 'admin', data: data as AdminKpiData });
      }
      setIsLoading(false);
    });
  }, [tenantId, userId, role]);

  return { kpi, isLoading };
}
```

---

### Bước 18: DashboardErrorState

```typescript
// apps/mobile/src/components/DashboardErrorState.tsx
import { View, Text, TouchableOpacity } from 'react-native';

interface Props {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function DashboardErrorState({ title = 'Không thể tải dữ liệu', message, onRetry }: Props) {
  return (
    <View>
      <Text>{title}</Text>
      <Text>{message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry}>
          <Text>Thử lại</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
```

---

### Bước 19: home.tsx — KPI theo role + Error handling

```typescript
// apps/mobile/app/(app)/home.tsx
import { isTechnicianRole } from '@bella/shared';
import { useAuth } from '../../src/contexts/AuthContext';
import { useTenant } from '../../src/contexts/TenantContext';
import { useTodaySessions } from '../../src/hooks/useTodaySessions';
import { useDashboardStats } from '../../src/hooks/useDashboardStats';
import { KpiCard } from '../../src/components/KpiCard';
import { SessionCard } from '../../src/components/SessionCard';
import { DashboardErrorState } from '../../src/components/DashboardErrorState';

export default function HomeScreen() {
  const auth = useAuth();
  const tenant = useTenant();
  if (auth.status !== 'authenticated') return null;
  const { user } = auth;

  // ─── Tenant error ────────────────────────────────────────────────────────
  if (tenant.status === 'error') {
    return <DashboardErrorState message={tenant.error} title="Không tải được thông tin chi nhánh" />;
  }

  const tenantId = tenant.status === 'loaded' ? tenant.tenant.id : null;
  const tenantName = tenant.status === 'loaded' ? tenant.tenant.name : '';

  const { sessions, isLoading: sessionsLoading, refresh } = useTodaySessions({
    tenantId,
    userId: user.id,
    role: user.role,
  });

  const { kpi, isLoading: statsLoading } = useDashboardStats({
    tenantId,
    userId: user.id,
    role: user.role,
  });

  const isKtv = isTechnicianRole(user.role); // không hard-code role === 'ktv'

  return (
    <ScrollView refreshControl={<RefreshControl onRefresh={refresh} />}>
      {/* Header */}
      <Text>{tenantName || 'Bella Spa'}</Text>
      <RoleBadge role={user.role} />

      {/* KPI Cards — theo role */}
      {kpi?.type === 'admin' && (
        <Row>
          <KpiCard label="Lịch hôm nay"    value={kpi.data.todayBookings} loading={statsLoading} />
          <KpiCard label="Đang phục vụ"    value={kpi.data.activeNow}     loading={statsLoading} />
          <KpiCard label="Doanh thu hôm nay" value={formatVnd(kpi.data.todayRevenue)} loading={statsLoading} />
        </Row>
      )}
      {kpi?.type === 'technician' && (
        <Row>
          <KpiCard label="Buổi hôm nay"   value={kpi.data.todayTotal}  loading={statsLoading} />
          <KpiCard label="Đã hoàn thành"  value={kpi.data.completed}   loading={statsLoading} />
          <KpiCard label="Còn lại"        value={kpi.data.remaining}   loading={statsLoading} />
        </Row>
      )}

      {/* Danh sách lịch hẹn */}
      <Text>{isKtv ? 'Lịch của tôi hôm nay' : 'Tất cả lịch hôm nay'}</Text>
      {sessionsLoading ? <LoadingSpinner /> :
       sessions.length === 0 ? <EmptyState /> :
       sessions.map(s => <SessionCard key={s.id} session={s} />)}
    </ScrollView>
  );
}
```

---

## Danh Sách Files Đầy Đủ

### packages/shared/ — Bổ sung

| File | Thay đổi |
|------|---------|
| `packages/shared/src/permissions/roles.ts` | Thêm `isTechnicianRole()`, `isManagerOrAbove()`, `ROLE_GROUPS` |
| `packages/shared/src/tenant/module-keys.ts` | MỚI |
| `packages/shared/src/tenant/module-resolver.ts` | MỚI |
| `packages/shared/src/index.ts` | Cập nhật re-export |

### src/ (web) — Migration bridges

| File | Thay đổi |
|------|---------|
| `src/lib/form-validators.ts` | Bridge → `@bella/shared` |
| `src/lib/business-rules/permissions.ts` | Bridge → `@bella/shared` (giữ SIDEBAR_MODULE_BY_LABEL) |
| `src/lib/business-rules/tenant-modules.ts` | Bridge cho module-keys (giữ brand/CSS logic) |

### supabase/ — Mới

| File | Ghi chú |
|------|---------|
| `supabase/migrations/20260621_mobile_rpc.sql` | RPC `rpc_mobile_today_sessions` |

### apps/mobile/ — Chuẩn hóa + Mới

| File | Ghi chú |
|------|---------|
| `apps/mobile/src/services/auth/fetchUserProfile.ts` | Di chuyển từ `lib/` |
| `apps/mobile/src/services/tenant/fetchTenantContext.ts` | MỚI |
| `apps/mobile/src/services/dashboard/fetchDashboardStats.ts` | MỚI — Promise.all |
| `apps/mobile/src/services/dashboard/fetchTodaySessions.ts` | MỚI — RPC + fallback |
| `apps/mobile/src/hooks/useTodaySessions.ts` | MỚI — debounce realtime |
| `apps/mobile/src/hooks/useDashboardStats.ts` | MỚI — role-based KPI |
| `apps/mobile/src/contexts/TenantContext.tsx` | MỚI v2 — fix dep + cache |
| `apps/mobile/src/components/KpiCard.tsx` | MỚI |
| `apps/mobile/src/components/SessionCard.tsx` | MỚI |
| `apps/mobile/src/components/RoleBadge.tsx` | MỚI |
| `apps/mobile/src/components/DashboardErrorState.tsx` | MỚI |
| `apps/mobile/app/_layout.tsx` | Cập nhật — TenantProvider |
| `apps/mobile/app/(app)/_layout.tsx` | MỚI — bottom tabs |
| `apps/mobile/app/(app)/home.tsx` | Cập nhật — role KPI + error |
| `apps/mobile/app/(app)/schedule.tsx` | MỚI |
| `apps/mobile/app/(app)/profile.tsx` | MỚI |

**Tổng: 4 file shared, 3 file web bridge, 1 SQL migration, 16 file mobile**

---

## Rủi Ro Đã Cập Nhật

| Rủi ro | Mức độ | Biện pháp |
|--------|--------|-----------|
| RPC migration chưa apply lên prod khi code | 🟡 Trung bình | Fallback join trực tiếp trong `fetchTodaySessionsFallback()` |
| Web bridge file bị lỗi import cycle | 🟡 Trung bình | Test `npm run build` ngay sau mỗi bridge — không batch |
| AsyncStorage quota đầy | 🟡 Thấp | `writeTenantCache` bắt exception, không crash |
| Tenant switch không trigger reload | 🔴 Đã giải quyết | Dep array `[auth.status, tenantId]` — không chỉ `auth.status` |
| KPI hardcode role | 🔴 Đã giải quyết | `isTechnicianRole()` từ `@bella/shared` |
| Bão request khi 50 KTV cập nhật cùng lúc | 🟡 Giảm thiểu | Debounce 500ms. TODO optimistic Tuần 4–5 |
| `fetchUserProfile` vẫn nằm trong `lib/` | 🔴 Đã giải quyết | Di chuyển sang `services/auth/` ở Bước 9 |

---

## Kế Hoạch Kiểm Tra

### Tự động

```bash
# Sau Bước 4
npm run shared:typecheck

# Sau Bước 8
npm run lint && npm run build    # web không bị ảnh hưởng

# Sau Bước 22 — full
npm run shared:typecheck
npm run mobile:typecheck
npm run build
npx tsc --build
```

### Thủ công — Simulator

| # | Kiểm tra | Kết quả mong đợi |
|---|---------|-----------------|
| 1 | App start lần 2 | Tên spa hiện **ngay lập tức** từ cache — không flash loading |
| 2 | Đăng nhập Admin | KPI: Lịch hôm nay / Đang phục vụ / Doanh thu |
| 3 | Đăng nhập KTV | KPI: Buổi hôm nay / Đã hoàn thành / Còn lại |
| 4 | Đăng nhập `ktv_lead` | KPI giống KTV (không phải Admin) |
| 5 | Insert booking từ web | Mobile refresh sau <1s (debounce 500ms) |
| 6 | Tắt network → mở app | Cache hiển thị tên spa, sessions fail gracefully |
| 7 | `tenant.status === error` | `DashboardErrorState` hiện với nút "Thử lại" |
| 8 | Switch tenant (tương lai) | TenantContext reload đúng — không dùng tenant cũ |
| 9 | 10 session update cùng lúc | Chỉ 1 request sau debounce |
| 10 | Web `localhost:3000` | Build pass, không regression |

---

## Định Nghĩa Hoàn Thành (DoD)

- [ ] `isTechnicianRole()` và `ROLE_GROUPS` trong `@bella/shared` — không còn `role === 'ktv'` hardcode.
- [ ] TenantContext dependency array: `[auth.status, tenantId]` — tenant switch hoạt động.
- [ ] TenantContext cache: tên spa hiện ngay khi mở app lần 2 — không flash.
- [ ] `fetchDashboardStats` dùng `Promise.all` — tất cả queries song song.
- [ ] KPI Admin ≠ KTV — 2 bộ metrics khác nhau, không render sai.
- [ ] RPC migration SQL được tạo và apply; fallback hoạt động khi RPC chưa có.
- [ ] `fetchTodaySessions` dùng `isTechnicianRole()` — không hardcode.
- [ ] Service layer tách rõ: `services/` không nằm trong `lib/`.
- [ ] `DashboardErrorState` hiện khi tenant/session fetch fail.
- [ ] Realtime debounce 500ms — không bão request khi nhiều events đến cùng lúc.
- [ ] Web bridges: `form-validators.ts`, `permissions.ts` → `@bella/shared`.
- [ ] CI pass: `shared:typecheck` + `mobile:typecheck` + web `build`.

---

## Tuần 3 Preview

| Mục | Nội dung |
|-----|---------|
| **Session detail** | Tap vào `SessionCard` → xem chi tiết booking + ghi chú nhanh |
| **Hoàn thành buổi** | `UPDATE session_logs.status = 'completed'` từ mobile |
| **Customer profile** | Lịch sử buổi tập, gói đang dùng |
| **@bella/shared domain** | `BookingSummary`, `CustomerInfo` vào shared |
| **Permission guards** | Route protection theo role (KTV không vào reports) |
| **Xoá fallback** | Remove `fetchTodaySessionsFallback()` sau khi RPC apply lên prod |
