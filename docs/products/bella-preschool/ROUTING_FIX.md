# Bella Preschool Routing Fix

**Date:** 2026-09-08  
**Status:** ✅ COMPLETE

---

## Problem

User sau khi login vào Preschool tenant thấy:
- ❌ Bella Spa menu (wrong UI)
- ❌ URL `/preschool/*` không hoạt động trên production

**Root cause:**
1. Production URL là `/dashboard/preschool/*` nhưng code có routing cũ `/preschool/*`
2. `/dashboard/page.tsx` thiếu redirect logic cho `bella_preschool` module
3. `TENANT_MODULE_KEYS` thiếu `bella_preschool`
4. Tenant settings chưa enable `bella_preschool` module

---

## Solution

### 1. Xóa legacy routes `/preschool/*`

**Deleted:**
```
src/app/(authenticated)/preschool/
├── page.tsx (redirect to /preschool/students)
├── students/
├── enrollments/
└── ... (all legacy routes)
```

**Reason:** Production sử dụng `/dashboard/preschool/*`, không cần `/preschool/*`

---

### 2. Thêm redirect logic cho Preschool

**File:** `src/app/dashboard/page.tsx`

**Before:**
```typescript
if (tenantModuleKey === 'bella_auto' && !hasRedirected.current) {
  window.location.replace('/dashboard/bella-auto');
} else if (tenantModuleKey === 'bella_healthcare' && !hasRedirected.current) {
  window.location.replace('/dashboard/hospital');
}
```

**After:**
```typescript
if (tenantModuleKey === 'bella_auto' && !hasRedirected.current) {
  window.location.replace('/dashboard/bella-auto');
} else if (tenantModuleKey === 'bella_healthcare' && !hasRedirected.current) {
  window.location.replace('/dashboard/hospital');
} else if (tenantModuleKey === 'bella_preschool' && !hasRedirected.current) {
  window.location.replace('/dashboard/preschool');
}
```

---

### 3. Register `bella_preschool` module

**File:** `src/lib/business-rules/tenant-modules.ts`

**Before:**
```typescript
export const TENANT_MODULE_KEYS = [
  'babycare', 'beauty_spa', 'student_training', 
  'industrial_cleaning', 'real_estate', 'bella_auto', 'bella_healthcare'
] as const;

export const TENANT_PRIMARY_BUSINESS_MODULE_KEYS = [
  'babycare', 'beauty_spa', 'industrial_cleaning', 
  'real_estate', 'bella_auto', 'bella_healthcare'
] as const;
```

**After:**
```typescript
export const TENANT_MODULE_KEYS = [
  'babycare', 'beauty_spa', 'student_training', 
  'industrial_cleaning', 'real_estate', 'bella_auto', 
  'bella_healthcare', 'bella_preschool'
] as const;

export const TENANT_PRIMARY_BUSINESS_MODULE_KEYS = [
  'babycare', 'beauty_spa', 'industrial_cleaning', 
  'real_estate', 'bella_auto', 'bella_healthcare', 'bella_preschool'
] as const;
```

---

### 4. Enable Preschool module in tenant settings

**Script:** `scripts/update-preschool-tenant-settings.ts`

```typescript
await supabase
  .from('tenants')
  .update({
    enabled_modules: {
      bella_preschool: true,
      babycare: false,
      beauty_spa: false,
      student_training: false,
      industrial_cleaning: false,
      real_estate: false,
      bella_auto: false,
      bella_healthcare: false,
    },
  })
  .eq('id', 'b5d38901-f9c1-4451-9e16-eaeab35aaeae');
```

**Executed:** ✅ SUCCESS

**Result:**
```json
{
  "enabled_modules": {
    "bella_preschool": true,
    "babycare": false,
    "beauty_spa": false,
    ...
  }
}
```

---

## Routing Logic After Fix

### User Journey

1. **Login at:** `https://bella-spa-erp.vercel.app/login`
   - Email: `admin@preschool-test.local`
   - Password: `test`

2. **Redirect to:** `/dashboard` (root dashboard)

3. **Auto-detect tenant module:**
   - Read `tenants.enabled_modules`
   - Find `bella_preschool: true`
   - Set `tenantModuleKey = 'bella_preschool'`

4. **Auto-redirect to:** `/dashboard/preschool`
   - Trigger: `useEffect` in `/dashboard/page.tsx`
   - Condition: `tenantModuleKey === 'bella_preschool'`
   - Action: `window.location.replace('/dashboard/preschool')`

5. **User sees:** Preschool Dashboard ✅
   - Page: `/dashboard/preschool/page.tsx`
   - UI: Student stats, classroom stats, attendance stats
   - Menu: Students, Classrooms, Attendance, Enroll Student

---

## URL Structure

### Correct URLs (Production)

```
/dashboard                           → Auto-redirect based on tenant
/dashboard/preschool                 → Dashboard page
/dashboard/preschool/students        → Student list
/dashboard/preschool/students/new    → Add student
/dashboard/preschool/students/[id]   → Student detail
/dashboard/preschool/classrooms      → Classroom list
/dashboard/preschool/attendance      → Attendance tracking
```

### Legacy URLs (Deleted)

```
/preschool                    → 404 (deleted)
/preschool/students           → 404 (deleted)
/preschool/enrollments        → 404 (deleted)
```

---

## Verification

### After Fix, User Should:

1. ✅ Login at `/login` with `admin@preschool-test.local/test`
2. ✅ Auto-redirect from `/dashboard` → `/dashboard/preschool`
3. ✅ See Preschool dashboard (NOT Bella Spa menu)
4. ✅ See correct stats: Students, Classrooms, Attendance
5. ✅ Navigate to `/dashboard/preschool/students` works
6. ✅ Navigate to `/dashboard/preschool/classrooms` works
7. ✅ Navigate to `/dashboard/preschool/attendance` works

---

## Summary

| Change | Before | After |
|--------|--------|-------|
| **Route structure** | `/preschool/*` + `/dashboard/preschool/*` (duplicate) | `/dashboard/preschool/*` only |
| **Dashboard redirect** | No redirect for preschool | Auto-redirect to `/dashboard/preschool` |
| **Module registration** | Not in `TENANT_MODULE_KEYS` | Added to both key arrays |
| **Tenant settings** | No `bella_preschool` key | `bella_preschool: true` |
| **User experience** | Sees Bella Spa menu | Sees Preschool dashboard ✅ |

---

## Related Files

**Modified:**
- `src/app/dashboard/page.tsx` - Added preschool redirect
- `src/lib/business-rules/tenant-modules.ts` - Added `bella_preschool` to module keys

**Deleted:**
- `src/app/(authenticated)/preschool/` - Entire legacy route tree

**Created:**
- `scripts/update-preschool-tenant-settings.ts` - Script to enable module in DB

**Existing (Correct):**
- `src/app/(authenticated)/dashboard/preschool/page.tsx` - Preschool dashboard
- `src/app/(authenticated)/dashboard/preschool/students/*` - Student routes
- `src/app/(authenticated)/dashboard/preschool/classrooms/*` - Classroom routes
- `src/app/(authenticated)/dashboard/preschool/attendance/*` - Attendance routes

---

**Status:** ✅ READY FOR DEPLOYMENT
