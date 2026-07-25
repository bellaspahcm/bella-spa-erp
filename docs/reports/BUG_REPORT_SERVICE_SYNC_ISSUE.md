# Bug Report: Danh Sách Dịch Vụ Không Đồng Bộ

**Date**: 15/07/2026  
**Reporter**: User  
**Priority**: HIGH  
**Status**: INVESTIGATING  

---

## 📋 Mô Tả Vấn Đề

**Triệu chứng**: Khi thêm 1 dịch vụ mới trong trang cấu hình dịch vụ (Admin), dịch vụ đó không hiển thị trong trang booking (Customer-facing booking page).

**User Flow**:
1. User vào `/dashboard/services` (Admin)
2. User click "Thêm dịch vụ mới"
3. User điền thông tin dịch vụ và lưu
4. User vào `/book` (Public booking page)
5. **❌ Dịch vụ mới không hiển thị trong danh sách "CHỌN GÓI DỊCH VỤ"**

---

## 🔍 Root Cause Analysis

### 1. Data Flow

```
Admin Service Page (/dashboard/services)
  ↓
  [Create/Update Service]
  ↓
Database (packages table)
  ↓
  [getPublicBabycareBookingPackages()]
  ↓
Public Booking Page (/book)
```

### 2. Filtering Logic

**File**: `src/core/services/order/public-booking-packages.ts`

```typescript
export async function getPublicBabycareBookingPackages() {
  // ...
  const { data, error } = await supabase
    .from('packages')
    .select('...')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')  // ❌ ISSUE #1: Only 'active' services
    .or('module_key.is.null,module_key.eq.babycare')  // ❌ ISSUE #2: Only babycare or null
    .order('name', { ascending: true });
  // ...
}
```

### 3. Possible Root Causes

#### Issue #1: Status Filter
**Query**: `.eq('status', 'active')`

**Vấn đề**: Nếu service mới được tạo với status khác 'active' (ví dụ: 'draft', 'inactive', 'pending'), nó sẽ KHÔNG hiển thị trong booking page.

**Verification**:
```sql
-- Check status of newly created service
SELECT id, name, status, module_key, created_at 
FROM packages 
WHERE tenant_id = '<tenant_id>'
ORDER BY created_at DESC 
LIMIT 5;
```

**Expected Behavior**:
- Service mới cần có `status = 'active'` để hiển thị
- Nếu form tạo service có default status là 'inactive' hoặc 'draft' → Service sẽ không hiển thị

---

#### Issue #2: Module Key Filter
**Query**: `.or('module_key.is.null,module_key.eq.babycare')`

**Vấn đề**: Nếu service mới được tạo với `module_key` khác 'babycare' (ví dụ: 'beauty_spa', 'industrial_cleaning'), nó sẽ KHÔNG hiển thị.

**Verification**:
```sql
-- Check module_key of newly created service
SELECT id, name, status, module_key, service_category 
FROM packages 
WHERE tenant_id = '<tenant_id>'
AND name LIKE '%<service_name>%';
```

**Expected Behavior**:
- Booking page (`/book`) là cho **Babycare module**
- Nếu service mới có `module_key = 'beauty_spa'` → Service sẽ KHÔNG hiển thị trong `/book`
- Service chỉ hiển thị nếu `module_key IS NULL` hoặc `module_key = 'babycare'`

---

## 🎯 Diagnosis Checklist

Để xác định chính xác root cause, kiểm tra:

- [ ] **Status của service mới**: Có phải `status = 'active'` không?
  ```sql
  SELECT name, status FROM packages WHERE id = '<new_service_id>';
  ```
  - ✅ Nếu `status = 'active'` → Không phải vấn đề status
  - ❌ Nếu `status != 'active'` → **ROOT CAUSE #1**: Service chưa được activate

- [ ] **Module key của service mới**: Có phải `module_key IS NULL` hoặc `= 'babycare'` không?
  ```sql
  SELECT name, module_key FROM packages WHERE id = '<new_service_id>';
  ```
  - ✅ Nếu `module_key IS NULL` hoặc `= 'babycare'` → Không phải vấn đề module
  - ❌ Nếu `module_key = 'beauty_spa'` hoặc giá trị khác → **ROOT CAUSE #2**: Service thuộc module khác

- [ ] **Tenant ID có đúng không?**
  ```sql
  SELECT name, tenant_id FROM packages WHERE id = '<new_service_id>';
  ```
  - Verify tenant_id khớp với public booking page

- [ ] **Cache issue**: Public booking page có cache server-side không?
  - Next.js có thể cache kết quả của `getPublicBabycareBookingPackages()`
  - Thử hard refresh hoặc clear cache

---

## 💡 Solutions

### Solution 1: Fix Status (If ROOT CAUSE #1)

**Vấn đề**: Service được tạo với status 'inactive' hoặc 'draft'

**Fix trong Admin UI**:
1. Vào `/dashboard/services`
2. Tìm service mới (có badge "Tạm ngưng / Nháp")
3. Click nút toggle status (switch button) để activate
4. Refresh booking page

**Fix trong Database** (nếu cần):
```sql
UPDATE packages 
SET status = 'active', updated_at = NOW()
WHERE id = '<new_service_id>';
```

**Permanent Fix** (Code):
```typescript
// File: src/app/dashboard/services/hooks/useServicesPageState.ts
// Ensure default status is 'active' when creating new service

const handleSubmit = async (e) => {
  // ...
  const serviceData = {
    // ...
    status: status || 'active',  // ✅ Default to 'active'
    // ...
  };
};
```

---

### Solution 2: Fix Module Key (If ROOT CAUSE #2)

**Vấn đề**: Service được tạo với `module_key = 'beauty_spa'` nhưng booking page chỉ hiển thị babycare services

**Option A: Thay đổi module_key của service mới**
```sql
-- Change service to babycare module
UPDATE packages 
SET module_key = 'babycare', updated_at = NOW()
WHERE id = '<new_service_id>';

-- Or make it module-agnostic (show in all modules)
UPDATE packages 
SET module_key = NULL, updated_at = NOW()
WHERE id = '<new_service_id>';
```

**Option B: Tạo separate booking page cho Beauty Spa**
- Nếu service thuộc Beauty Spa, cần tạo booking page riêng cho module đó
- Path: `/book/beauty-spa` hoặc `/beauty-spa/book`
- Clone `src/app/book/page.tsx` và update filter:

```typescript
// New file: src/app/book/beauty-spa/page.tsx
export default async function BeautySpaBookPage() {
  const { packages } = await getPublicBeautySpaBookingPackages(); // ✅ New function
  return <BookingPageClient packages={packages} />;
}

// New function: src/core/services/order/public-booking-packages.ts
export async function getPublicBeautySpaBookingPackages() {
  // ...
  .or('module_key.is.null,module_key.eq.beauty_spa')  // ✅ Filter for beauty_spa
  // ...
}
```

**Option C: Dynamic Module Routing**
- Make booking page detect module from URL parameter
- Example: `/book?module=babycare` vs `/book?module=beauty_spa`

---

### Solution 3: Fix Cache (If ROOT CAUSE #3)

**Vấn đề**: Next.js đang cache kết quả query

**Quick Fix**:
1. Hard refresh browser: `Ctrl + Shift + R`
2. Clear browser cache
3. Restart Next.js dev server

**Permanent Fix** (Code):
```typescript
// File: src/app/book/page.tsx
export const revalidate = 0;  // ✅ Disable caching

export default async function BookPage() {
  const { packages } = await getPublicBabycareBookingPackages();
  return <BookingPageClient packages={packages} />;
}
```

Or use `cache: 'no-store'`:
```typescript
// File: src/core/services/order/public-booking-packages.ts
export async function getPublicBabycareBookingPackages() {
  const supabase = await createClient();
  // ...
  const { data, error } = await supabase
    .from('packages')
    .select('...')
    // ...
    .abortSignal(AbortSignal.timeout(5000));  // ✅ Prevent stale cache
}
```

---

## 🔧 Quick Diagnosis Script

Run this SQL to check service status:

```sql
-- Get latest 10 services
SELECT 
  id,
  name,
  status,
  module_key,
  service_category,
  created_at,
  CASE 
    WHEN status != 'active' THEN '❌ Status không phải active'
    WHEN module_key NOT IN ('babycare', NULL) THEN '❌ Module key không phải babycare'
    ELSE '✅ Service OK, có thể do cache'
  END as diagnosis
FROM packages
WHERE tenant_id = '<tenant_id>'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📊 Expected vs Actual Behavior

### Expected Behavior
1. User tạo service mới với status = 'active' và module_key = 'babycare'
2. Service lưu vào database
3. Public booking page query packages với filter đúng
4. Service mới hiển thị trong danh sách "CHỌN GÓI DỊCH VỤ"

### Actual Behavior
1. User tạo service mới
2. Service lưu vào database (có thể status='draft' hoặc module_key='beauty_spa')
3. Public booking page query packages với filter `status='active' AND (module_key IS NULL OR module_key='babycare')`
4. ❌ Service mới KHÔNG match filter → Không hiển thị

---

## 🎬 Next Steps

1. **Immediate**: Run diagnosis SQL để xác định root cause
2. **Short-term**: Apply Solution 1, 2, hoặc 3 dựa trên diagnosis
3. **Long-term**: 
   - Add validation trong service creation form (enforce status='active' if user wants it visible)
   - Add warning message: "Dịch vụ chỉ hiển thị trên booking page khi Status = Đang hoạt động và Module = Babycare"
   - Consider module-aware routing for multi-module booking pages

---

## 📝 Related Files

- `src/app/book/page.tsx` - Public booking page (SSR)
- `src/app/book/BookingPageClient.tsx` - Booking page client component
- `src/core/services/order/public-booking-packages.ts` - Query logic (ROOT CAUSE HERE)
- `src/app/dashboard/services/page.tsx` - Admin service management
- `src/app/dashboard/services/hooks/useServicesPageState.ts` - Service CRUD logic

---

**Priority**: HIGH  
**Estimated Fix Time**: 15-30 minutes  
**Testing Required**: Yes (verify service appears after fix)

---

**Report Created**: 15/07/2026  
**Status**: Awaiting diagnosis results from user
