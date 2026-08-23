# 🚨 BÁO CÁO 18 LỖI REACT COMPILER NGHIÊM TRỌNG

**Ngày:** 2026-08-04  
**Mức độ:** CRITICAL - Có thể gây crash app  
**Tổng số lỗi nghiêm trọng:** 18 errors  
**Trạng thái build:** ✅ PASSED (sau khi fix syntax errors)

---

## ⚡ CẬP NHẬT MỚI NHẤT

### ✅ Đã fix 2 lỗi syntax BLOCKING BUILD:

1. **✅ FIXED** - `partner/bookings/page.tsx:77` - Thiếu `}` để đóng useEffect
   - **Root cause:** Missing closing brace cho useEffect hook
   - **Fix:** Thêm `}, []);` sau phần check URL params
   
2. **✅ FIXED** - `partner/application-status/page.tsx:53` - Duplicate `loadApplication` function
   - **Root cause:** Định nghĩa hàm 2 lần (line 30 & line 53)
   - **Fix:** Xóa duplicate function definition, giữ lại version có `setIsLoading(true)` ở đầu

### 🎯 Build Status:
```bash
$ npm run build
✅ Compiled successfully in 23.1s
```

---

## 📊 TỔNG QUAN

### Phân loại theo mức độ nghiêm trọng:

| Loại lỗi | Số lượng | Mức độ nguy hiểm | Có thể crash? |
|-----------|----------|------------------|---------------|
| **react-hooks/rules-of-hooks** | 1 | 🔴 CRITICAL | ✅ YES - Conditional hooks |
| **react-hooks/preserve-manual-memoization** | 4 | 🔴 CRITICAL | ✅ YES - Infinite re-renders |
| **react-hooks/exhaustive-deps** | 10 | 🟠 HIGH | ⚠️ MAYBE - Stale closures |
| **react-hooks/immutability** | 11 | 🟠 HIGH | ⚠️ MAYBE - State mutations |
| **react-hooks/purity** | 2 | 🟡 MEDIUM | ⚠️ MAYBE - Side effects |

---

## 🔴 NHÓM 1: LỖI NGHIÊM TRỌNG NHẤT (5 lỗi - CÓ THỂ CRASH APP)

### 1. **CONDITIONAL HOOK CALL** ❌ (1 lỗi)
**File:** `src/app/dashboard/page.tsx`  
**Line:** 344  
**Mức độ:** 🔴 CRITICAL

```typescript
// ❌ LỖI: Hook được gọi có điều kiện
344:3   warning  React Hook "useEffect" is called conditionally. 
        React Hooks must be called in the exact same order in every component render  
        react-hooks/rules-of-hooks
```

**Tại sao nghiêm trọng:**
- Vi phạm quy tắc cơ bản của React Hooks
- Gây crash app với lỗi: "Rendered more hooks than during the previous render"
- Không thể predict được số lượng hooks giữa các lần render

**Cách fix:**
```typescript
// ❌ SAI
if (condition) {
  useEffect(() => { ... }, []);
}

// ✅ ĐÚNG
useEffect(() => {
  if (!condition) return;
  // logic here
}, [condition]);
```

---

### 2. **MANUAL MEMOIZATION CONFLICTS** ❌ (4 lỗi)

#### 2.1. `handleShareCombinedPortal` - Customer Detail Controller
**File:** `src/app/dashboard/customers/[id]/useCustomerDetailController.ts`  
**Line:** 746:49

```typescript
746:49  warning  Compilation Skipped: Existing memoization could not be preserved
React Compiler has skipped optimizing this component because the existing manual 
memoization could not be preserved. The inferred dependencies did not match the 
manually specified dependencies, which could cause the value to change more or 
less frequently than expected. 

The inferred dependency was `customer`, 
but the source dependencies were [customer?.allBookings, selectedBookingIds]. 
Inferred less specific property than source.
```

**Tại sao nghiêm trọng:**
- Dependencies không khớp → function tạo mới mỗi lần render
- Gây infinite re-render nếu function được dùng trong dependency array
- Child components re-render không cần thiết

**Cách fix:**
```typescript
// ❌ SAI
const handleShareCombinedPortal = useCallback(async () => {
  if (selectedBookingIds.size < 2 || !customer?.allBookings) return;
  // ... logic
}, [customer?.allBookings, selectedBookingIds]); 
// ❌ React Compiler infer: customer (toàn bộ object)

// ✅ ĐÚNG - Option 1: Dùng đúng dependency React Compiler infer
const handleShareCombinedPortal = useCallback(async () => {
  if (selectedBookingIds.size < 2 || !customer?.allBookings) return;
  // ... logic
}, [customer, selectedBookingIds]); 

// ✅ ĐÚNG - Option 2: Extract property trước
const allBookings = customer?.allBookings;
const handleShareCombinedPortal = useCallback(async () => {
  if (selectedBookingIds.size < 2 || !allBookings) return;
  // ... logic
}, [allBookings, selectedBookingIds]);
```

---

#### 2.2. `handleDeleteBooking` - Customer Detail Controller
**File:** `src/app/dashboard/customers/[id]/useCustomerDetailController.ts`  
**Line:** 849:43

```typescript
849:43  warning  Compilation Skipped: Existing memoization could not be preserved
The inferred dependency was `activeBooking`, 
but the source dependencies were [activeBooking?.id, loadData]. 
Inferred less specific property than source.
```

**Cách fix:**
```typescript
// ❌ SAI
const handleDeleteBooking = useCallback(async (bookingId: string) => {
  // ... logic sử dụng activeBooking?.id và loadData
}, [activeBooking?.id, loadData]);

// ✅ ĐÚNG
const handleDeleteBooking = useCallback(async (bookingId: string) => {
  // ... logic
}, [activeBooking, loadData]);
```

---

#### 2.3. `fetchAudit` - Bella Auto Audit
**File:** `src/app/dashboard/bella-auto/audit/page.tsx`  
**Line:** ~80

```typescript
warning  React Compiler has skipped optimizing this component because the existing 
manual memoization could not be preserved. 
The inferred dependency was `filters`, 
but the source dependencies were [filters?.startDate, filters?.endDate, filters?.limit].
```

**Cách fix:**
```typescript
// ❌ SAI
const fetchAudit = useCallback(async () => {
  // ... logic sử dụng filters.startDate, filters.endDate, filters.limit
}, [filters?.startDate, filters?.endDate, filters?.limit]);

// ✅ ĐÚNG
const fetchAudit = useCallback(async () => {
  // ... logic
}, [filters]); // Dùng toàn bộ object
```

---

#### 2.4. `fetchTransactions` - Bella Auto Audit
**File:** `src/app/dashboard/bella-auto/audit/page.tsx`  
**Line:** ~81

```typescript
warning  React Compiler has skipped optimizing this component because the existing 
manual memoization could not be preserved. 
The inferred dependency was `filters`, 
but the source dependencies were [filters?.entityType, filters?.entityId, 
filters?.status, filters?.type, filters?.limit].
```

**Cách fix:** Tương tự 2.3

---

## 🟠 NHÓM 2: LỖI MISSING DEPENDENCIES (10 lỗi)

### 3. **EXHAUSTIVE-DEPS VIOLATIONS** ⚠️

#### 3.1. Bella Auto Customers - `activeProfile` dependency missing
**File:** `src/app/dashboard/bella-auto/customers/page.tsx`  
**Line:** 90:6

```typescript
90:6   warning  React Hook React.useEffect has a missing dependency: 'activeProfile'. 
       Either include it or remove the dependency array  react-hooks/exhaustive-deps
```

**Cách fix:**
```typescript
// ❌ SAI
useEffect(() => {
  // ... logic sử dụng activeProfile
}, []); // Missing activeProfile

// ✅ ĐÚNG
useEffect(() => {
  // ... logic
}, [activeProfile]);
```

---

#### 3.2. Bella Auto Trade-In - `uploadStatuses` dependency missing
**File:** `src/app/dashboard/bella-auto/trade-in/page.tsx`  
**Line:** 232:6

```typescript
232:6   warning  React Hook useCallback has a missing dependency: 'uploadStatuses'. 
       Either include it or remove the dependency array
```

---

#### 3.3. Dashboard Page - `verifyEmail` dependency missing
**File:** `src/app/dashboard/page.tsx`  
**Line:** 25:6

```typescript
25:6  warning  React Hook useEffect has a missing dependency: 'verifyEmail'. 
      Either include it or remove the dependency array
```

---

#### 3.4. Bella Auto Vehicles - `loadVehicles` dependency missing
**File:** `src/app/dashboard/bella-auto/vehicles/page.tsx`  
**Line:** 104:6

```typescript
104:6  warning  React Hook useEffect has a missing dependency: 'loadVehicles'. 
       Either include it or remove the dependency array
```

---

#### 3.5. Partner Leads - `refreshData` dependency missing
**File:** `src/app/partner/leads/page.tsx`  
**Line:** 60:6

```typescript
60:6   warning  React Hook useEffect has a missing dependency: 'refreshData'. 
       Either include it or remove the dependency array
```

---

#### 3.6. Partner Leads - `applyFilters` dependency missing
**File:** `src/app/partner/leads/page.tsx`  
**Line:** 301:6

```typescript
301:6   warning  React Hook useEffect has a missing dependency: 'applyFilters'. 
       Either include it or remove the dependency array
```

---

#### 3.7. Bella Auto Journey Steps - `loadSteps` dependency missing
**File:** `src/app/dashboard/bella-auto/journeys/[journeyId]/steps/page.tsx`  
**Line:** 61:6

```typescript
61:6   warning  React Hook useEffect has a missing dependency: 'loadSteps'. 
       Either include it or remove the dependency array
```

---

#### 3.8. Bella Auto Transactions - `loadTransactions` dependency missing
**File:** `src/app/dashboard/bella-auto/finance/transactions/page.tsx`  
**Line:** 66:6

```typescript
66:6   warning  React Hook useEffect has a missing dependency: 'loadTransactions'. 
       Either include it or remove the dependency array
```

---

#### 3.9. Real Estate Documents - `fetchDocuments` dependency missing
**File:** `src/app/dashboard/real-estate/documents/page.tsx`  
**Line:** 95:6

```typescript
95:6   warning  React Hook useEffect has a missing dependency: 'fetchDocuments'. 
       Either include it or remove the dependency array
```

---

## 🟡 NHÓM 3: LỖI IMMUTABILITY & PURITY (13 lỗi)

### 4. **IMMUTABILITY VIOLATIONS** ⚠️ (11 lỗi)

Các lỗi này xảy ra khi mutate trực tiếp state hoặc props trong hooks:

#### 4.1-4.11. Các file có lỗi immutability:
1. Partner Bookings - line 107
2. Partner Bookings - line 83  
3. Partner Bookings - line 87
4. Partner Bookings - line 65
5. Partner Bookings - line 75
6. Partner Bookings - line 53
7. Bella Auto Vehicles - line 97
8. Bella Auto Marketplace - line 176
9. Bella Auto Marketplace - line 84
10. Bella Auto Marketplace - line 78
11. Bella Auto Finance - line 179

**Pattern chung:**
```typescript
// ❌ SAI - Mutate trực tiếp
const handleClick = () => {
  someArray.push(newItem); // ❌ Mutation
  someObject.prop = value; // ❌ Mutation
};

// ✅ ĐÚNG - Immutable update
const handleClick = () => {
  setSomeArray([...someArray, newItem]); // ✅ New array
  setSomeObject({ ...someObject, prop: value }); // ✅ New object
};
```

---

### 5. **PURITY VIOLATIONS** ⚠️ (2 lỗi)

#### 5.1. Dashboard Page - side effect in render
**File:** `src/app/dashboard/page.tsx`  
**Line:** 281

```typescript
281 |     const mins = Math.floor(diff / 60000);  react-hooks/purity
```

#### 5.2. Bella Auto Documents - impure calculation
**File:** `src/app/dashboard/bella-auto/documents/page.tsx`  
**Line:** 106

```typescript
106 |       value: '',  react-hooks/purity
```

---

## ⚡ HÀNH ĐỘNG YÊU CẦU NGAY

### ƯU TIÊN CAO (Fix trong 24h):

1. ✅ **Fix conditional hook call** (dashboard/page.tsx:344)
   - Nguy cơ: App crash
   - Impact: All users

2. ✅ **Fix 4 manual memoization conflicts**
   - Nguy cơ: Infinite re-renders
   - Impact: Performance degradation, possible crashes
   - Files:
     - `useCustomerDetailController.ts` (2 lỗi)
     - `bella-auto/audit/page.tsx` (2 lỗi)

### ƯU TIÊN TRUNG BÌNH (Fix trong 1 tuần):

3. ✅ **Fix 10 exhaustive-deps warnings**
   - Nguy cơ: Stale closures, incorrect behavior
   - Impact: Feature bugs, data inconsistency

### ƯU TIÊN THẤP (Fix trong 2 tuần):

4. ✅ **Fix 13 immutability/purity violations**
   - Nguy cơ: Subtle bugs, unexpected re-renders
   - Impact: Performance, maintainability

---

## 📋 CHECKLIST FIX

### Tuần 1 (08-04 đến 08-10):
- [ ] Fix conditional hook call (dashboard/page.tsx)
- [ ] Fix handleShareCombinedPortal memoization
- [ ] Fix handleDeleteBooking memoization
- [ ] Fix fetchAudit memoization
- [ ] Fix fetchTransactions memoization

### Tuần 2 (08-11 đến 08-17):
- [ ] Fix 10 exhaustive-deps warnings
- [ ] Run full regression tests

### Tuần 3 (08-18 đến 08-24):
- [ ] Fix 13 immutability/purity violations
- [ ] Enable React Compiler strict mode
- [ ] Run performance profiling

---

## 🛠️ CÔNG CỤ HỖ TRỢ

### Kiểm tra lỗi:
```bash
# Tất cả lỗi React Hooks
npm run lint 2>&1 | grep "react-hooks"

# Chỉ lỗi nghiêm trọng
npm run lint 2>&1 | grep -E "rules-of-hooks|preserve-manual-memoization"

# Count theo loại
npm run lint 2>&1 | grep "react-hooks" | wc -l
```

### Auto-fix (nếu có):
```bash
# Fix exhaustive-deps (thận trọng!)
npm run lint -- --fix
```

---

## 📚 TÀI LIỆU THAM KHẢO

1. [React Rules of Hooks](https://react.dev/reference/rules/rules-of-hooks)
2. [React Compiler Docs](https://react.dev/learn/react-compiler)
3. [ESLint Plugin React Hooks](https://www.npmjs.com/package/eslint-plugin-react-hooks)

---

**Báo cáo bởi:** Kiro AI Assistant  
**Lần cập nhật cuối:** 2026-08-04
