# Bella ERP Mobile App — Phase 1 Tuần 1: Nền Tảng
## Phiên bản v3 — Đã tích hợp phản hồi review

**Ngày tạo:** 2026-06-21
**Cập nhật:** 2026-06-21 — Áp dụng 6 điểm chỉnh sửa sau review

---

## Tổng Hợp Phản Hồi Review

| # | Điểm chỉnh sửa | Đánh giá cũ | Đánh giá mới |
|---|----------------|------------|-------------|
| 1 | TypeScript Project References thay vì exclude | 6/10 | 9/10 |
| 2 | `@bella/shared` là source of truth — web import ngược | 7/10 | 10/10 |
| 3 | Role lấy từ bảng `users` DB — không dùng `user_metadata` | 5/10 | 9/10 |
| 4 | Thêm trạng thái `loading-profile` vào `AuthState` | _(chưa có)_ | ✅ |
| 5 | Xác nhận dùng **npm workspaces** | _(chưa chốt)_ | ✅ |
| 6 | Nâng lên **Expo SDK 53+** | 52 (cũ) | 53+ |

---

## Mục Tiêu Tuần 1

Ra mắt React Native + Expo shell chạy được trên iOS và Android, tích hợp Supabase Auth, **tải profile từ bảng `users`** sau khi đăng nhập, không làm ảnh hưởng ứng dụng web Next.js.

---

## Phân Tích Tái Sử Dụng Codebase

### ✅ Tái sử dụng trực tiếp — `@bella/shared` là nguồn chính

> **Thay đổi chiến lược quan trọng:** Không copy code sang shared. `packages/shared/` là **source of truth**. Web app sẽ import ngược lại từ `@bella/shared`.

| Nguồn hiện tại (`src/`) | Dịch chuyển sang (`packages/shared/`) | Web app sau này |
|---|---|---|
| `lib/form-validators.ts` | `src/validators/form.ts` | `import { validateEmail } from '@bella/shared'` |
| `lib/utils.ts` (hàm thuần) | `src/utils/format.ts` | `import { formatCurrency } from '@bella/shared'` |
| `constants/business-rules.ts` | `src/constants/business-rules.ts` | `import { BUSINESS_RULES } from '@bella/shared'` |
| `lib/business-rules/permissions.ts` | `src/permissions/roles.ts` | `import { isAdminRole } from '@bella/shared'` |
| `types/domain.ts` (chọn lọc) | `src/types/domain.ts` | `import type { CurrentUser } from '@bella/shared'` |

> **Tuần 1:** Chỉ *di chuyển* code (không copy). Web app tạm thời vẫn import từ `src/` — việc chuyển web sang import `@bella/shared` là việc của tuần sau.

### ⚠️ Tái sử dụng có điều kiện — Cần adapter mobile

| File nguồn | Vấn đề | Giải pháp |
|---|---|---|
| `lib/supabase-client.ts` | Dùng `@supabase/ssr` + browser only | `apps/mobile/src/lib/supabase.ts` dùng `@supabase/supabase-js` + `AsyncStorage` |
| `lib/supabase-public-env.ts` | Đọc `NEXT_PUBLIC_*` | `apps/mobile/src/lib/env.ts` đọc `EXPO_PUBLIC_*` |
| `services/user-actions.ts` → `getCurrentUser()` | `'use server'` + Next.js only | Port logic query `users` table sang mobile `fetchUserProfile()` |

### ❌ Không tái sử dụng (server/browser only)

`supabase-server.ts`, `supabase-admin-env.ts`, `crypto.ts`, `rate-limit.ts`, `offline-db.ts`, `revalidate.ts`, `app/` (Next.js routes), `hooks/*`

---

## Phạm Vi

### Trong phạm vi

- npm workspaces với `apps/*` và `packages/*`
- TypeScript Project References
- `packages/shared/` là source of truth cho validators, utils, types, permissions
- Khởi tạo React Native + Expo SDK 53+
- Supabase Auth: đăng nhập / đăng xuất email/password
- **Tải profile từ bảng `users`** sau khi có session (không dùng `user_metadata`)
- `AuthState` có 4 trạng thái: `loading` → `loading-profile` → `authenticated` / `unauthenticated`
- Session persist và restore qua `AsyncStorage`
- CI validation: `shared:typecheck` + `mobile:typecheck` + web `build`

### Ngoài phạm vi

Booking, dashboard, QR scanner, push notifications, offline sync, camera, multi-tenant migration, RBAC overhaul.

---

## Quyết Định Đã Chốt

| # | Quyết định | Lựa chọn |
|---|-----------|---------|
| 1 | **Expo SDK** | SDK 53+ (stable tại 2026) |
| 2 | **Workspaces** | npm workspaces (`"workspaces": ["apps/*", "packages/*"]`) |
| 3 | **tsconfig** | TypeScript Project References — không exclude |
| 4 | **Role nguồn** | Truy vấn bảng `users` sau login — không dùng `user_metadata` |
| 5 | **Shared strategy** | `@bella/shared` là source of truth |

---

## Cấu Trúc Repository

```
bella-spa-erp/
├── apps/
│   └── mobile/                    # React Native + Expo app
│       ├── app/
│       │   ├── _layout.tsx        # Root layout + AuthProvider
│       │   ├── index.tsx          # Redirect theo auth state
│       │   ├── (auth)/login.tsx   # Màn hình đăng nhập
│       │   └── (app)/home.tsx     # Placeholder sau login
│       ├── src/
│       │   ├── lib/
│       │   │   ├── supabase.ts    # Client mobile (AsyncStorage)
│       │   │   └── env.ts         # Adapter EXPO_PUBLIC_*
│       │   ├── contexts/
│       │   │   └── AuthContext.tsx # 4-state auth + profile load
│       │   └── components/
│       │       └── LoadingScreen.tsx
│       ├── app.json
│       ├── package.json
│       └── tsconfig.json          # "composite": true, references shared
│
├── packages/
│   └── shared/                    # SOURCE OF TRUTH (MỚI)
│       ├── src/
│       │   ├── index.ts
│       │   ├── types/
│       │   │   ├── auth.ts        # CurrentUser + AuthState (4 states)
│       │   │   └── domain.ts      # Types chọn lọc (không import database.types)
│       │   ├── constants/
│       │   │   └── business-rules.ts
│       │   ├── validators/
│       │   │   └── form.ts        # validateEmail, validatePassword, validateVnPhone...
│       │   ├── utils/
│       │   │   └── format.ts      # formatCurrency, getLocalDateString... (bỏ cn())
│       │   └── permissions/
│       │       └── roles.ts       # isAdminRole, isSidebarItemAllowed
│       ├── package.json
│       └── tsconfig.json          # "composite": true
│
├── src/                           # Next.js web app — KHÔNG THAY ĐỔI src/ files
├── package.json                   # Thêm "workspaces" + mobile:* scripts
└── tsconfig.json                  # Thêm "references" — KHÔNG dùng exclude
```

---

## Thứ Tự Thực Thi (17 bước)

```
Bước 1  ──▶  Bật npm workspaces trong root package.json
Bước 2  ──▶  Chuyển tsconfig.json sang Project References (bỏ exclude)
Bước 3  ──▶  Tạo packages/shared/ — di chuyển code từ src/ (source of truth)
Bước 4  ──▶  Tạo packages/shared/tsconfig.json (composite: true)
Bước 5  ──▶  Verify shared:typecheck sạch
Bước 6  ──▶  Scaffold apps/mobile/ bằng Expo SDK 53
Bước 7  ──▶  Tạo apps/mobile/tsconfig.json (composite + references shared)
Bước 8  ──▶  Cài dependencies apps/mobile/ + link @bella/shared qua workspace
Bước 9  ──▶  Tạo apps/mobile/src/lib/env.ts (adapter EXPO_PUBLIC_*)
Bước 10 ──▶  Tạo apps/mobile/src/lib/supabase.ts (AsyncStorage client)
Bước 11 ──▶  Tạo fetchUserProfile() — port logic getCurrentUser() từ user-actions.ts
Bước 12 ──▶  Tạo AuthContext.tsx (4-state: loading → loading-profile → authenticated/unauthenticated)
Bước 13 ──▶  Tạo các màn hình: _layout, index, login, home
Bước 14 ──▶  Tạo .env.example cho mobile
Bước 15 ──▶  Chạy shared:typecheck + mobile:typecheck
Bước 16 ──▶  Kiểm tra web app: lint + build không bị ảnh hưởng
Bước 17 ──▶  Test thủ công trên simulator + viết spec artifact
```

---

## Chi Tiết Triển Khai

### Bước 1: npm Workspaces

#### `package.json` — root

```diff
{
  "name": "bella-spa-erp",
+  "workspaces": [
+    "apps/*",
+    "packages/*"
+  ],
  "scripts": {
    ...existing scripts...,
+   "mobile:dev": "npm run start --workspace=apps/mobile",
+   "mobile:ios": "npm run ios --workspace=apps/mobile",
+   "mobile:android": "npm run android --workspace=apps/mobile",
+   "mobile:typecheck": "npm run typecheck --workspace=apps/mobile",
+   "shared:typecheck": "npm run typecheck --workspace=packages/shared"
  }
}
```

> **Lý do chọn workspaces:** Expo SDK 53 hỗ trợ tốt, `@bella/shared` được link tự động, không cần `file:` path, CI/CD đơn giản hơn.

---

### Bước 2: TypeScript Project References

#### `tsconfig.json` — root

```diff
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
-  "exclude": ["node_modules", "mcp-server"]
+  "exclude": ["node_modules", "mcp-server"],
+  "references": [
+    { "path": "./packages/shared" },
+    { "path": "./apps/mobile" }
+  ]
}
```

> **Tại sao Project References thay vì exclude?**
> - `tsc --build` ở root kiểm tra toàn bộ workspace.
> - Mỗi sub-project có tsconfig riêng với `"composite": true`.
> - Phát hiện lỗi cross-project (mobile import sai shared).
> - Không "che lỗi" như exclude.

---

### Bước 3–5: packages/shared/ — Source of Truth

#### `packages/shared/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["esnext"],
    "strict": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

#### `packages/shared/src/types/auth.ts`

> **Thay đổi v3:** AuthState có **4 trạng thái** — thêm `loading-profile` theo đề xuất reviewer.

```typescript
// packages/shared/src/types/auth.ts
// Di chuyển từ src/types/domain.ts — đây là source of truth

export interface CurrentUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  avatar_url?: string | null;
  tenant_id: string | null;
  isSuspended?: boolean;
}

// 4 trạng thái — thêm 'loading-profile' theo phản hồi review
export type AuthState =
  | { status: 'loading' }           // App khởi động, kiểm tra session
  | { status: 'loading-profile' }   // Có session, đang tải profile từ DB
  | { status: 'authenticated'; user: CurrentUser }
  | { status: 'unauthenticated' };
```

> **Lý do 4 trạng thái:** ERP cần `Session → Tenant → Role → Permissions → Modules`. Trạng thái `loading-profile` cho phép hiển thị skeleton screen trong khi chờ DB query, không flash màn hình login rồi redirect.

#### `packages/shared/src/validators/form.ts`

Di chuyển **nguyên xi** từ `src/lib/form-validators.ts`. Web app sau đó sẽ import từ đây thay vì `src/lib`.

```typescript
// Di chuyển từ src/lib/form-validators.ts
// Không thay đổi nội dung — file này đã platform-neutral hoàn toàn
export * from './form-validators-impl';
```

#### `packages/shared/src/utils/format.ts`

Di chuyển từ `src/lib/utils.ts` — **bỏ `cn()`** vì phụ thuộc `tailwind-merge` + `clsx`.

```typescript
// Từ src/lib/utils.ts — chỉ export hàm thuần (không Tailwind)
export { formatCurrency } from './utils-impl';
export { formatMoneyInput } from './utils-impl';
export { getLocalDateString } from './utils-impl';
export { sanitizeTime } from './utils-impl';
export { parseVnd } from './utils-impl';
export { resolvePackageName } from './utils-impl';
// KHÔNG export cn() — phụ thuộc tailwind-merge (web only)
```

#### `packages/shared/src/types/domain.ts`

> **Quan trọng:** KHÔNG import `database.types.ts` (136KB) vào shared. Chỉ export types cần thiết.

```typescript
// Chỉ export types cụ thể — không import toàn bộ database.types.ts
// Lý do: database.types.ts 136KB → bundle size tăng, Metro build chậm

export interface TenantInfo {
  id: string;
  name: string;
  status: string | null;
  logo_url?: string | null;
}

export interface BookingSummary {
  id: string;
  customer_name: string | null;
  service_name: string | null;
  scheduled_at: string;
  status: string;
}

// Chỉ thêm types khi mobile thực sự cần
```

---

### Bước 11: fetchUserProfile() — Port từ getCurrentUser()

> **Thay đổi quan trọng nhất so với v2:** Không lấy `role` từ `user_metadata`. Port logic từ `src/services/user-actions.ts` → `getCurrentUser()`.

**Logic gốc trong web app (`getCurrentUser`):**

```
1. supabase.auth.getUser() → lấy auth user
2. supabase.from('users').select('*').eq('id', user.id).single() → lấy profile
3. Fallback: .eq('email', user.email) nếu không tìm được bằng id
4. Kiểm tra tenant status (suspended?)
5. Trả về CurrentUser với role từ bảng users
```

#### `apps/mobile/src/lib/fetchUserProfile.ts`

```typescript
import type { CurrentUser } from '@bella/shared';
import { getMobileSupabase } from './supabase';

export type ProfileResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; error: string };

/**
 * Port từ src/services/user-actions.ts getCurrentUser()
 * Truy vấn bảng users để lấy role chính xác — KHÔNG dùng user_metadata
 * Lý do: user_metadata có thể stale, sai, hoặc bị sửa ngoài luồng chuẩn
 */
export async function fetchUserProfile(
  authUserId: string,
  authEmail: string,
): Promise<ProfileResult> {
  const supabase = getMobileSupabase();

  // Primary: lookup theo auth id
  const { data: profileById, error: idError } = await supabase
    .from('users')
    .select('id, email, full_name, role, avatar_url, tenant_id')
    .eq('id', authUserId)
    .single();

  let profile = profileById ?? null;

  // Fallback: lookup theo email (xử lý auth user tạo riêng khỏi public.users)
  if (!profile && authEmail) {
    const { data: profileByEmail } = await supabase
      .from('users')
      .select('id, email, full_name, role, avatar_url, tenant_id')
      .eq('email', authEmail)
      .single();
    profile = profileByEmail ?? null;
  }

  if (!profile) {
    const msg = idError?.message ?? 'Không tìm thấy profile người dùng.';
    return { ok: false, error: msg };
  }

  // Chuẩn hoá role về lowercase (giống web app)
  const user: CurrentUser = {
    ...profile,
    role: profile.role?.toLowerCase() ?? 'staff',
    isSuspended: false,
  };

  // Kiểm tra tenant bị suspended
  if (user.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('status')
      .eq('id', user.tenant_id)
      .single();
    if (tenant?.status === 'suspended') {
      user.isSuspended = true;
    }
  }

  return { ok: true, user };
}
```

---

### Bước 12: AuthContext — 4 Trạng Thái

#### `apps/mobile/src/contexts/AuthContext.tsx`

```typescript
import type { AuthState, CurrentUser } from '@bella/shared';
import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchUserProfile } from '../lib/fetchUserProfile';
import { getMobileSupabase } from '../lib/supabase';

type AuthContextValue = AuthState & {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' });

  useEffect(() => {
    const supabase = getMobileSupabase();

    // Khôi phục session từ AsyncStorage khi app khởi động
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => handleSession(session)
    );
    return () => subscription.unsubscribe();
  }, []);

  async function handleSession(session: Session | null) {
    if (!session?.user) {
      setState({ status: 'unauthenticated' });
      return;
    }

    // Có session → chuyển sang loading-profile để tải từ DB
    setState({ status: 'loading-profile' });

    const result = await fetchUserProfile(
      session.user.id,
      session.user.email ?? '',
    );

    if (!result.ok) {
      // Không tìm được profile → coi như chưa xác thực
      console.warn('[AuthContext] Profile fetch failed:', result.error);
      setState({ status: 'unauthenticated' });
      return;
    }

    if (result.user.isSuspended) {
      setState({ status: 'unauthenticated' });
      return;
    }

    setState({ status: 'authenticated', user: result.user });
  }

  async function signIn(email: string, password: string) {
    const supabase = getMobileSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    const supabase = getMobileSupabase();
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải được dùng trong AuthProvider');
  return ctx;
}
```

---

### Bước 13: Các Màn Hình

#### `apps/mobile/app/index.tsx` — Route gốc

```typescript
import { Redirect } from 'expo-router';
import { useAuth } from '../src/contexts/AuthContext';
import { LoadingScreen } from '../src/components/LoadingScreen';

export default function Index() {
  const auth = useAuth();

  // Cả 'loading' và 'loading-profile' đều hiện loading screen
  if (auth.status === 'loading' || auth.status === 'loading-profile') {
    return <LoadingScreen />;
  }
  if (auth.status === 'authenticated') return <Redirect href="/(app)/home" />;
  return <Redirect href="/(auth)/login" />;
}
```

#### `apps/mobile/app/(auth)/login.tsx`

- Dùng `validateEmail()` + `validatePassword()` từ `@bella/shared`
- Hiển thị lỗi rõ ràng — không im lặng
- Loading state khi submit

#### `apps/mobile/app/(app)/home.tsx`

- `CurrentUser` từ `@bella/shared`
- Hiển thị `user.email`, `user.full_name`, `user.role`
- Badge "Quản trị" nếu `isAdminRole(user.role)` từ shared
- Cảnh báo nếu `user.isSuspended`
- Nút Đăng xuất

---

## Danh Sách Files Đầy Đủ

### Root — Sửa đổi (không thêm file mới)

| File | Thay đổi |
|------|---------|
| `package.json` | Thêm `"workspaces"` + scripts `mobile:*` + `shared:typecheck` |
| `tsconfig.json` | Thêm `"references"` — KHÔNG dùng `exclude` |

### packages/shared/ — Source of truth (MỚI)

| File | Ghi chú |
|------|---------|
| `packages/shared/package.json` | `"name": "@bella/shared"` |
| `packages/shared/tsconfig.json` | `"composite": true` |
| `packages/shared/src/index.ts` | Re-export tất cả |
| `packages/shared/src/types/auth.ts` | `CurrentUser` + `AuthState` 4 states |
| `packages/shared/src/types/domain.ts` | Types chọn lọc — KHÔNG import database.types |
| `packages/shared/src/constants/business-rules.ts` | Di chuyển từ `src/constants/` |
| `packages/shared/src/validators/form.ts` | Di chuyển từ `src/lib/form-validators.ts` |
| `packages/shared/src/utils/format.ts` | Di chuyển từ `src/lib/utils.ts` (bỏ `cn()`) |
| `packages/shared/src/permissions/roles.ts` | Di chuyển từ `src/lib/business-rules/permissions.ts` |

### apps/mobile/ — MỚI

| File | Ghi chú |
|------|---------|
| `apps/mobile/package.json` | Expo SDK 53, `@bella/shared` via workspace |
| `apps/mobile/app.json` | Expo config |
| `apps/mobile/babel.config.js` | Babel preset Expo |
| `apps/mobile/tsconfig.json` | `"composite": true`, `"references": [shared]` |
| `apps/mobile/.env.example` | Chỉ `EXPO_PUBLIC_*` |
| `apps/mobile/src/lib/env.ts` | Adapter `EXPO_PUBLIC_*` |
| `apps/mobile/src/lib/supabase.ts` | Client mobile (AsyncStorage) |
| `apps/mobile/src/lib/fetchUserProfile.ts` | Port từ `getCurrentUser()` — query `users` table |
| `apps/mobile/src/contexts/AuthContext.tsx` | 4-state auth flow |
| `apps/mobile/src/components/LoadingScreen.tsx` | |
| `apps/mobile/app/_layout.tsx` | Root layout + AuthProvider |
| `apps/mobile/app/index.tsx` | Auth redirect (handle 4 states) |
| `apps/mobile/app/(auth)/login.tsx` | Form + `validateEmail/Password` từ shared |
| `apps/mobile/app/(app)/home.tsx` | User info + `isAdminRole` từ shared |

### Docs

| File | Ghi chú |
|------|---------|
| `docs/implementation-artifacts/spec-mobile-week-1.md` | Spec artifact bắt buộc |
| `.github/workflows/mobile-ci.yml` | CI validation |

**Tổng: 2 file sửa + 23 file mới (9 shared, 14 mobile)**

---

## CI Validation — GitHub Actions

> Reviewer yêu cầu: không chỉ kiểm tra local.

#### `.github/workflows/mobile-ci.yml`

```yaml
name: Mobile CI

on:
  push:
    paths:
      - 'apps/mobile/**'
      - 'packages/shared/**'
  pull_request:
    paths:
      - 'apps/mobile/**'
      - 'packages/shared/**'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Shared package typecheck
        run: npm run shared:typecheck

      - name: Mobile typecheck
        run: npm run mobile:typecheck

      - name: Web build (regression check)
        run: npm run build

      - name: Secret leak check
        run: npm run security:secrets
```

---

## Kiểm Soát Rủi Ro

| Rủi ro | Mức độ | Biện pháp |
|--------|--------|-----------|
| `user_metadata.role` stale/sai | 🔴 Đã giải quyết | Luôn query bảng `users` qua `fetchUserProfile()` |
| `database.types.ts` 136KB vào bundle mobile | 🔴 Đã giải quyết | Chỉ export types cụ thể trong `shared/types/domain.ts` |
| Secret key lộ trong Expo config | 🔴 Nguy hiểm | Chỉ `EXPO_PUBLIC_*`, review trước commit, CI check |
| Code drift giữa shared và src/ | 🟡 Giảm thiểu | shared là source of truth; web sẽ import từ shared (Tuần 2) |
| Project References config sai | 🟡 Trung bình | Verify `tsc --build` ở root sau bước 2 |
| AsyncStorage không persist | 🟡 Trung bình | Test kill + reopen thủ công |
| `fetchUserProfile` fail khi user chưa có trong `users` table | 🟡 Trung bình | Trả `{ status: 'unauthenticated' }` — không crash |
| Expo SDK 53 breaking changes | 🟡 Thấp | Kiểm tra changelog trước khi scaffold |

---

## Kế Hoạch Kiểm Tra

### Tự động (CI + Local)

```bash
# Sau bước 5 — verify shared sạch
npm run shared:typecheck

# Sau bước 15 — verify mobile sạch
npm run mobile:typecheck

# Kiểm tra toàn bộ workspace với Project References
npx tsc --build

# Web không bị ảnh hưởng
npm run lint
npm run build

# Secret check
npm run security:secrets

# Whitespace/EOL
git diff --check
```

### Thủ công — Simulator

| Bước | Kiểm tra | Kết quả mong đợi |
|------|----------|-----------------|
| 1 | `npm run mobile:dev` từ root | Expo dev server khởi động |
| 2 | Mở app trên iOS Simulator | Màn hình Loading → Màn hình Đăng nhập |
| 3 | Đăng nhập đúng | Hiện `loading-profile` skeleton → Màn hình Home |
| 4 | Home hiện email + full_name + role từ DB | ✅ (không phải từ metadata) |
| 5 | Admin role hiện badge "Quản trị" | ✅ (`isAdminRole` từ `@bella/shared`) |
| 6 | Đăng xuất | Về màn hình Đăng nhập |
| 7 | Kill app + mở lại | Session restore → loading-profile → Home |
| 8 | Đăng nhập sai mật khẩu | Error message hiện (`validatePassword` từ shared) |
| 9 | Email sai định dạng | `validateEmail()` báo lỗi ngay trên form |
| 10 | Web `http://localhost:3000` | Bình thường, không regression |

---

## Định Nghĩa Hoàn Thành (DoD)

- [ ] npm workspaces hoạt động — `@bella/shared` link đúng trong mobile.
- [ ] `tsc --build` ở root sạch với Project References.
- [ ] `packages/shared/` typecheck sạch.
- [ ] `apps/mobile/` typecheck sạch.
- [ ] `fetchUserProfile()` query đúng bảng `users` — role đúng, không dùng metadata.
- [ ] AuthState flow 4 trạng thái hoạt động đúng: `loading` → `loading-profile` → `authenticated`.
- [ ] `validateEmail()` và `validatePassword()` từ `@bella/shared` hoạt động trong form login.
- [ ] Home screen hiển thị đúng thông tin từ bảng `users` (không phải `user_metadata`).
- [ ] CI workflow pass trên GitHub Actions.
- [ ] Web app lint + build không bị ảnh hưởng.
- [ ] Spec artifact ghi kết quả verification.

---

## Kiến Trúc Hướng Tới (Không phải Tuần 1)

```
@bella/shared     → types, validators, utils, permissions (Tuần 1)
@bella/auth       → auth flows, session management (Tuần 2–3)
@bella/ui         → shared design system (Tuần 4+)
@bella/domain     → booking, customer, KTV types (Tuần 3+)
```

> Tuần 1 chỉ cần `@bella/shared` — nhưng thiết kế theo hướng này để tách tiếp dễ dàng.

---

## Công Việc Hoãn Lại

| Tuần | Nội dung | Shared cần thêm |
|------|---------|-----------------|
| Tuần 2 | Web app import từ `@bella/shared` (thay vì `src/`) | Hoàn tất migration web |
| Tuần 2 | Dashboard shell, tenant context, chọn chi nhánh | `tenant-modules.ts` → shared |
| Tuần 3 | Danh sách đặt lịch, khách hàng, tìm kiếm | `BookingSummary`, `CustomerInfo` |
| Tuần 4 | QR scanner, check-in phiên, phân công KTV | KTV types, session types |
| Tuần 5 | Thông báo đẩy, offline cache | Bổ sung `@bella/auth` package |
| Tuần 6 | Beta nội bộ, TestFlight/EAS build | — |
