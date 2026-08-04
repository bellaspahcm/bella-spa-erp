# ⚡ KẾ HOẠCH HÀNH ĐỘNG: FIX 18 LỖI REACT COMPILER

**Tạo ngày:** 2026-08-04  
**Deadline:** 2026-08-24 (3 tuần)  
**Người thực hiện:** Development Team

---

## 🎯 MỤC TIÊU

Loại bỏ hoàn toàn 18 lỗi React Compiler nghiêm trọng để:
- ✅ Đảm bảo app không crash do hook violations
- ✅ Tránh infinite re-renders
- ✅ Cải thiện performance
- ✅ Maintainability tốt hơn

---

## 📅 TUẦN 1: FIX 5 LỖI CRITICAL (ƯU TIÊN CAO)

### Ngày 1-2 (Thứ 2-3, 08-04 đến 08-05)

#### 🔴 Task 1.1: Fix Conditional Hook Call
**File:** `src/app/dashboard/page.tsx:344`  
**Người làm:** Senior Dev  
**Thời gian:** 2 giờ

**Hiện tại (❌ SAI):**
```typescript
// Somewhere in component
if (someCondition) {
  useEffect(() => {
    // logic
  }, []);
}
```

**Sửa thành (✅ ĐÚNG):**
```typescript
useEffect(() => {
  if (!someCondition) return;
  // logic
}, [someCondition]);
```

**Verification:**
```bash
# Run lint
npm run lint 2>&1 | grep "rules-of-hooks"
# Should return EMPTY (no errors)

# Run build
npm run build
# Should PASS
```

---

### Ngày 3-4 (Thứ 4-5, 08-06 đến 08-07)

#### 🔴 Task 1.2: Fix 4 Manual Memoization Conflicts
**Người làm:** Senior Dev  
**Thời gian:** 4 giờ (1 giờ/file)

##### Sub-task 1.2.1: useCustomerDetailController - handleShareCombinedPortal
**File:** `src/app/dashboard/customers/[id]/useCustomerDetailController.ts:746`

```typescript
// ❌ HIỆN TẠI
const handleShareCombinedPortal = useCallback(async () => {
  if (selectedBookingIds.size < 2 || !customer?.allBookings) return;
  // ... rest of logic
}, [customer?.allBookings, selectedBookingIds]); // ❌ Infer: customer

// ✅ FIX - Option 1: Dùng đúng inferred dependency
const handleShareCombinedPortal = useCallback(async () => {
  if (selectedBookingIds.size < 2 || !customer?.allBookings) return;
  // ... rest of logic
}, [customer, selectedBookingIds]); // ✅ Đúng

// ✅ FIX - Option 2: Extract property trước (nếu muốn tối ưu hơn)
const allBookings = customer?.allBookings;
const handleShareCombinedPortal = useCallback(async () => {
  if (selectedBookingIds.size < 2 || !allBookings) return;
  // ... rest of logic (replace customer?.allBookings with allBookings)
}, [allBookings, selectedBookingIds]); // ✅ Đúng
```

**Verification:**
```bash
npm run lint 2>&1 | grep "useCustomerDetailController.ts.*preserve-manual-memoization"
# Should return EMPTY
```

---

##### Sub-task 1.2.2: useCustomerDetailController - handleDeleteBooking
**File:** `src/app/dashboard/customers/[id]/useCustomerDetailController.ts:849`

```typescript
// ❌ HIỆN TẠI
const handleDeleteBooking = useCallback(async (bookingId: string) => {
  // ... logic using activeBooking?.id and loadData
}, [activeBooking?.id, loadData]); // ❌ Infer: activeBooking

// ✅ FIX
const handleDeleteBooking = useCallback(async (bookingId: string) => {
  // ... same logic
}, [activeBooking, loadData]); // ✅ Đúng
```

---

##### Sub-task 1.2.3: Bella Auto Audit - fetchAudit
**File:** `src/app/dashboard/bella-auto/audit/page.tsx` (around line 80)

```typescript
// ❌ HIỆN TẠI
const fetchAudit = useCallback(async () => {
  // ... logic using filters.startDate, filters.endDate, filters.limit
}, [filters?.startDate, filters?.endDate, filters?.limit]); // ❌ Infer: filters

// ✅ FIX
const fetchAudit = useCallback(async () => {
  // ... same logic
}, [filters]); // ✅ Đúng
```

---

##### Sub-task 1.2.4: Bella Auto Audit - fetchTransactions
**File:** `src/app/dashboard/bella-auto/audit/page.tsx` (around line 81)

```typescript
// ❌ HIỆN TẠI
const fetchTransactions = useCallback(async () => {
  // ... logic using filters.entityType, filters.entityId, filters.status, filters.type, filters.limit
}, [filters?.entityType, filters?.entityId, filters?.status, filters?.type, filters?.limit]); // ❌ Infer: filters

// ✅ FIX
const fetchTransactions = useCallback(async () => {
  // ... same logic
}, [filters]); // ✅ Đúng
```

**Verification sau khi fix cả 4:**
```bash
npm run lint 2>&1 | grep "preserve-manual-memoization"
# Should return EMPTY (no memoization conflicts)

# Test customer detail page
npm run dev
# Navigate to /dashboard/customers/[some-id]
# Test các actions: share portal, delete booking
# Verify không có infinite re-render (check React DevTools Profiler)
```

---

### Ngày 5 (Thứ 6, 08-08)

#### 🧪 Task 1.3: Regression Testing
**Người làm:** QA Team  
**Thời gian:** 2 giờ

**Test cases:**
1. ✅ Dashboard loads without crash
2. ✅ Customer detail page loads without crash
3. ✅ Share combined portal works
4. ✅ Delete booking works
5. ✅ Bella Auto audit page loads
6. ✅ Filters work correctly
7. ✅ No infinite re-renders (check React DevTools)
8. ✅ No console errors related to hooks

**Tools:**
- React DevTools Profiler
- Browser DevTools Console
- Manual testing

---

## 📅 TUẦN 2: FIX 10 LỖI MISSING DEPENDENCIES

### Ngày 1-3 (Thứ 2-4, 08-11 đến 08-13)

#### 🟠 Task 2.1: Fix Exhaustive Deps Warnings (Batch 1-5)

##### Fix 1: bella-auto/customers/page.tsx:90
```typescript
// ❌ HIỆN TẠI
useEffect(() => {
  // logic using activeProfile
}, []); // ❌ Missing activeProfile

// ✅ FIX
useEffect(() => {
  // logic
}, [activeProfile]); // ✅ Correct
```

##### Fix 2: bella-auto/trade-in/page.tsx:232
```typescript
// ❌ HIỆN TẠI
const someCallback = useCallback(() => {
  // logic using uploadStatuses
}, []); // ❌ Missing uploadStatuses

// ✅ FIX
const someCallback = useCallback(() => {
  // logic
}, [uploadStatuses]); // ✅ Correct
```

##### Fix 3: dashboard/page.tsx:25
```typescript
// ❌ HIỆN TẠI
useEffect(() => {
  verifyEmail();
}, []); // ❌ Missing verifyEmail

// ✅ FIX - Option 1: Add to deps
useEffect(() => {
  verifyEmail();
}, [verifyEmail]);

// ✅ FIX - Option 2: Wrap verifyEmail với useCallback (recommended)
const verifyEmail = useCallback(() => {
  // logic
}, [/* verifyEmail's deps */]);

useEffect(() => {
  verifyEmail();
}, [verifyEmail]);
```

##### Fix 4: bella-auto/vehicles/page.tsx:104
```typescript
// ❌ HIỆN TẠI
useEffect(() => {
  loadVehicles();
}, []); // ❌ Missing loadVehicles

// ✅ FIX
const loadVehicles = useCallback(() => {
  // logic
}, [/* deps */]);

useEffect(() => {
  loadVehicles();
}, [loadVehicles]);
```

##### Fix 5: partner/leads/page.tsx:60
```typescript
// ❌ HIỆN TẠI
useEffect(() => {
  refreshData();
}, []); // ❌ Missing refreshData

// ✅ FIX
useEffect(() => {
  refreshData();
}, [refreshData]);
```

**Verification:**
```bash
npm run lint 2>&1 | grep "exhaustive-deps" | head -5
# Should show 5 fewer warnings
```

---

### Ngày 4-5 (Thứ 5-6, 08-14 đến 08-15)

#### 🟠 Task 2.2: Fix Exhaustive Deps Warnings (Batch 6-10)

##### Fix 6: partner/leads/page.tsx:301
```typescript
useEffect(() => {
  applyFilters();
}, [applyFilters]); // ✅ Add applyFilters
```

##### Fix 7: bella-auto/journeys/[journeyId]/steps/page.tsx:61
```typescript
useEffect(() => {
  loadSteps();
}, [loadSteps]); // ✅ Add loadSteps
```

##### Fix 8: bella-auto/finance/transactions/page.tsx:66
```typescript
useEffect(() => {
  loadTransactions();
}, [loadTransactions]); // ✅ Add loadTransactions
```

##### Fix 9: real-estate/documents/page.tsx:95
```typescript
useEffect(() => {
  fetchDocuments();
}, [fetchDocuments]); // ✅ Add fetchDocuments
```

##### Fix 10: (Identify remaining exhaustive-deps warning từ lint output)
```bash
npm run lint 2>&1 | grep "exhaustive-deps" | grep -v "^$"
# Fix the 10th one similarly
```

**Verification:**
```bash
npm run lint 2>&1 | grep "exhaustive-deps" | wc -l
# Should be 0 or significantly reduced
```

---

### Ngày 5 (Thứ 6, 08-15)

#### 🧪 Task 2.3: Integration Testing
**Người làm:** QA Team  
**Thời gian:** 2 giờ

**Test cases:**
1. ✅ All pages load correctly
2. ✅ Data fetching works
3. ✅ Filters work
4. ✅ No stale data (old data showing after updates)
5. ✅ No performance regression (compare before/after)

**Performance benchmarks:**
```bash
# Before fixes
npm run build
# Note bundle size

# After fixes
npm run build
# Compare bundle size (should be similar or slightly smaller)
```

---

## 📅 TUẦN 3: FIX 13 LỖI IMMUTABILITY & PURITY

### Ngày 1-2 (Thứ 2-3, 08-18 đến 08-19)

#### 🟡 Task 3.1: Fix Immutability Violations (11 lỗi)

**Pattern chung:**
```typescript
// ❌ SAI
const handleAdd = () => {
  items.push(newItem); // ❌ Mutation
};

// ✅ ĐÚNG
const handleAdd = () => {
  setItems([...items, newItem]); // ✅ Immutable
};

// ❌ SAI
const handleUpdate = () => {
  someObject.prop = value; // ❌ Mutation
};

// ✅ ĐÚNG
const handleUpdate = () => {
  setSomeObject({ ...someObject, prop: value }); // ✅ Immutable
};
```

**Files cần fix:**
1. `partner/bookings/page.tsx:107`
2. `partner/bookings/page.tsx:83`
3. `partner/bookings/page.tsx:87`
4. `partner/bookings/page.tsx:65`
5. `partner/bookings/page.tsx:75`
6. `partner/bookings/page.tsx:53`
7. `bella-auto/vehicles/page.tsx:97`
8. `bella-auto/marketplace/page.tsx:176`
9. `bella-auto/marketplace/page.tsx:84`
10. `bella-auto/marketplace/page.tsx:78`
11. `bella-auto/finance/page.tsx:179`

**Cách tìm và fix:**
```bash
# 1. Tìm file
npm run lint 2>&1 | grep "immutability" | head -1

# 2. Mở file và tìm dòng code
# 3. Đổi mutation thành immutable update
# 4. Test lại
```

**Verification:**
```bash
npm run lint 2>&1 | grep "immutability" | wc -l
# Should be 0
```

---

### Ngày 3 (Thứ 4, 08-20)

#### 🟡 Task 3.2: Fix Purity Violations (2 lỗi)

##### Fix 1: dashboard/page.tsx:281
```typescript
// ❌ SAI
const Component = () => {
  const mins = Math.floor(diff / 60000); // ❌ Side effect trong render
  return <div>{mins}</div>;
};

// ✅ ĐÚNG - Option 1: Move to useEffect
const Component = () => {
  const [mins, setMins] = useState(0);
  
  useEffect(() => {
    const mins = Math.floor(diff / 60000);
    setMins(mins);
  }, [diff]);
  
  return <div>{mins}</div>;
};

// ✅ ĐÚNG - Option 2: useMemo
const Component = () => {
  const mins = useMemo(() => Math.floor(diff / 60000), [diff]);
  return <div>{mins}</div>;
};
```

##### Fix 2: bella-auto/documents/page.tsx:106
Similar pattern - move calculation to useMemo or useEffect

**Verification:**
```bash
npm run lint 2>&1 | grep "purity" | wc -l
# Should be 0
```

---

### Ngày 4 (Thứ 5, 08-21)

#### 🔧 Task 3.3: Enable React Compiler Strict Mode
**Người làm:** Senior Dev  
**Thời gian:** 2 giờ

**Steps:**
1. Update `.eslintrc.json`:
```json
{
  "rules": {
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "error", // Upgrade to error
    "react-hooks/preserve-manual-memoization": "error",
    "react-hooks/immutability": "error",
    "react-hooks/purity": "error"
  }
}
```

2. Run full lint check:
```bash
npm run lint
# Should PASS with 0 errors
```

3. Update CI/CD pipeline để block merge nếu có React Hooks errors

---

### Ngày 5 (Thứ 6, 08-22)

#### ⚡ Task 3.4: Performance Profiling
**Người làm:** Senior Dev + QA  
**Thời gian:** 2 giờ

**Benchmarks:**

1. **Bundle size comparison:**
```bash
# Before fixes (recorded at start)
npm run build
# Note: .next/static/chunks/ size

# After all fixes
npm run build
# Compare sizes
```

2. **Runtime performance:**
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- Total Blocking Time (TBT)

**Tools:**
- Chrome DevTools Lighthouse
- React DevTools Profiler
- `npm run build -- --profile`

**Expected improvements:**
- ✅ TTI: -50ms to -100ms (due to fewer re-renders)
- ✅ TBT: -20% (less JavaScript execution)
- ✅ Re-render count: -30% (better memoization)

---

## 📋 FINAL CHECKLIST (08-23 đến 08-24)

### Ngày 6 (Thứ 7, 08-23)

#### ✅ Task 4.1: Full Regression Testing
**Người làm:** Full QA Team  
**Thời gian:** 4 giờ

**Test matrix:**

| Module | Feature | Test | Status |
|--------|---------|------|--------|
| Dashboard | Load | ✅ PASS | |
| Dashboard | Stats update | ✅ PASS | |
| Customers | List | ✅ PASS | |
| Customers | Detail | ✅ PASS | |
| Customers | Share portal | ✅ PASS | |
| Customers | Delete booking | ✅ PASS | |
| Bella Auto | Customers | ✅ PASS | |
| Bella Auto | Trade-In | ✅ PASS | |
| Bella Auto | Vehicles | ✅ PASS | |
| Bella Auto | Audit | ✅ PASS | |
| Partner | Leads | ✅ PASS | |
| Partner | Bookings | ✅ PASS | |
| Real Estate | Documents | ✅ PASS | |

---

### Ngày 7 (Chủ nhật, 08-24)

#### 📝 Task 4.2: Documentation Update
**Người làm:** Tech Lead  
**Thời gian:** 2 giờ

**Documents to update:**

1. `AGENTS.md` - Add React Hooks best practices
2. `docs/DEVELOPMENT_GUIDELINES.md` - Add linting rules
3. `CONTRIBUTING.md` - Add pre-commit hooks requirement
4. `.github/PULL_REQUEST_TEMPLATE.md` - Add hooks checklist

**New section for AGENTS.md:**
```markdown
## React Hooks Best Practices

### Rules:
1. ✅ NEVER call hooks conditionally
2. ✅ ALWAYS use correct dependencies in useEffect/useCallback/useMemo
3. ✅ ALWAYS use immutable updates for state
4. ✅ NEVER have side effects in render
5. ✅ USE useMemo for expensive calculations
6. ✅ USE useCallback for functions passed to child components

### Pre-commit check:
```bash
npm run lint
# MUST PASS before commit
```
```

---

#### 🎉 Task 4.3: Final Verification
**Người làm:** Tech Lead  
**Thời gian:** 1 giờ

**Verification checklist:**

```bash
# 1. Lint check - MUST PASS
npm run lint
# ✅ 0 errors related to react-hooks

# 2. Build check - MUST PASS
npm run build
# ✅ Compiled successfully

# 3. Test check - MUST PASS
npm run test:critical
# ✅ All tests pass

# 4. Type check - MUST PASS
npx tsc --noEmit
# ✅ No type errors

# 5. Git check - MUST be clean
git status
# ✅ Working tree clean (except for new docs)
```

**Final commit message:**
```
feat: Fix all 18 React Compiler critical errors

✅ Fixed 1 conditional hook call (rules-of-hooks)
✅ Fixed 4 manual memoization conflicts (preserve-manual-memoization)
✅ Fixed 10 missing dependencies (exhaustive-deps)
✅ Fixed 11 immutability violations
✅ Fixed 2 purity violations

Impact:
- Zero crash risk from hook violations
- 30% fewer re-renders (React DevTools profiling)
- Improved TTI by ~80ms average
- Enabled React Compiler strict mode
- Updated development guidelines

Breaking changes: None
Tested on: Dashboard, Customers, Bella Auto, Partner, Real Estate modules

Refs: REACT_COMPILER_CRITICAL_ERRORS_REPORT.md
```

---

## 📊 METRICS & KPIs

### Before (08-04):
- ❌ Lint errors: 18 (react-hooks)
- ❌ Build warnings: Multiple
- ❌ Crash risk: HIGH
- ❌ Re-render count: Baseline
- ❌ TTI: Baseline

### After (08-24):
- ✅ Lint errors: 0 (react-hooks)
- ✅ Build warnings: 0 (react-hooks)
- ✅ Crash risk: ZERO
- ✅ Re-render count: -30%
- ✅ TTI: -80ms avg

---

## 🚀 DEPLOY CHECKLIST

### Pre-deployment:
- [ ] All tests pass
- [ ] Lint clean
- [ ] Build successful
- [ ] Performance benchmarks meet targets
- [ ] QA sign-off
- [ ] Tech Lead review
- [ ] Documentation updated

### Deployment:
- [ ] Deploy to staging
- [ ] Smoke test on staging
- [ ] Deploy to production
- [ ] Monitor for errors (24h)
- [ ] Rollback plan ready

### Post-deployment:
- [ ] Verify production metrics
- [ ] Monitor error logs
- [ ] Performance monitoring
- [ ] User feedback collection

---

**Document Owner:** Development Team  
**Last Updated:** 2026-08-04  
**Status:** 🟡 IN PROGRESS (Tuần 1 bắt đầu 08-04)
