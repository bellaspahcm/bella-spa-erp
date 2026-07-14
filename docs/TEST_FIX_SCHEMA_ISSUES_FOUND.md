# Schema Mismatch Issues Found - ROOT CAUSE #2

**Date**: 12/07/2026  
**Status**: 🔍 Fully Analyzed - Ready to Fix

---

## 🎯 Summary

E2E tests failing due to **schema mismatches** between test data and actual database schema.

**Impact**: ~18 E2E tests failing (all in salary, accounting, permission suites)

---

## ✅ Fixed Issues

### 1. Tenants Table
**File**: `src/__tests__/helpers/salary-e2e-db-helper.ts`

| Column in Test | DB Schema | Status | Fix |
|----------------|-----------|--------|-----|
| `is_active` | ❌ Not exists | ✅ Fixed | Use `status: 'active'` |
| `subdomain` | ❌ Not exists | ✅ Fixed | Removed |
| `module` | ❌ Not exists | ✅ Fixed | Use `enabled_modules: {baby_care: true}` (JSONB) |
| `id` | Must be UUID | ✅ Fixed | Use `'00000000-0000-0000-0000-000000000001'` |

### 2. Packages Table
**File**: `src/__tests__/helpers/salary-e2e-db-helper.ts`

| Column in Test | DB Schema | Status |
|----------------|-----------|--------|
| `is_active` | ❌ Not exists | ⚠️ Need to check |

---

## ⏳ Pending Fixes

### 3. Users Table - CamelCase vs Snake_Case Mismatch
**File**: `src/__tests__/e2e-salary-comprehensive.test.ts`

**Problem**: Test data uses camelCase, DB uses snake_case

| Test Data (camelCase) | DB Column (snake_case) | Type Issue |
|-----------------------|------------------------|------------|
| `baseSalary` | `base_salary` | ✅ Column exists, wrong case |
| `resignationDate` | `resignation_date` | ✅ Column exists, wrong case |

**Root Cause**:
```typescript
// Test data (Line 118)
const ktvProfiles: KTVProfile[] = [
  { id: 'ktv-alpha', name: 'KTV Alpha', baseSalary: 6_000_000, ... }
];

// Helper expects (Line 56)
export type TestKTVProfile = {
  base_salary: number;  // snake_case
  resignation_date: string | null;
};
```

**Solution Options**:

**Option A**: Transform data in test file
```typescript
const ktvProfiles = [
  { id: 'ktv-alpha', full_name: 'KTV Alpha', base_salary: 6_000_000, ... }
];
```

**Option B**: Transform in helper
```typescript
export async function createTestKTVs(profiles: any[]) {
  const normalized = profiles.map(p => ({
    id: p.id,
    full_name: p.name || p.full_name,
    base_salary: p.baseSalary || p.base_salary,
    resignation_date: p.resignationDate || p.resignation_date,
    // ... normalize all fields
  }));
  // ...insert normalized
}
```

**Option C**: Use consistent snake_case everywhere (RECOMMENDED)
```typescript
// Change test data to match DB
const ktvProfiles: TestKTVProfile[] = [
  { 
    id: 'ktv-alpha', 
    full_name: 'KTV Alpha', 
    base_salary: 6_000_000, 
    resignation_date: null,
    email: 'ktv-alpha@test.com',
    role: 'ktv',
    tenant_id: TEST_TENANT_ID
  }
];
```

**RECOMMENDATION**: **Option C** (consistent snake_case)

**Pros**: 
- Matches DB schema exactly
- No transformation logic needed
- TypeScript catches mismatches

**Cons**: 
- More verbose test code
- snake_case less idiomatic in TypeScript

---

## 📋 Complete Fix Checklist

### Immediate (Next 30 minutes)
- [ ] Fix `e2e-salary-comprehensive.test.ts`:
  - [ ] Change `ktvProfiles` to use snake_case (`base_salary`, `resignation_date`)
  - [ ] Add missing fields (`email`, `role`, `tenant_id`, `full_name`)
- [ ] Fix `packages` test data:
  - [ ] Remove `is_active` if not in schema
  - [ ] Add missing required fields
- [ ] Re-run test: `npm test -- "e2e-salary-comprehensive"`
- [ ] Expected: ✅ All 12+ tests passing

### Additional E2E Tests (1-2 hours)
- [ ] Find all E2E tests with schema issues
- [ ] Apply same fixes:
  - `e2e-accounting-*.test.ts`
  - `e2e-permission-*.test.ts`
  - `e2e-partner-api-*.test.ts`
- [ ] Re-run all E2E: `npm test -- "e2e-"`
- [ ] Expected: ✅ 18+ tests passing

### Verification
- [ ] Run full test suite
- [ ] Confirm pass rate >90%
- [ ] Document all schema fixes
- [ ] Update TEST_FIX_WEEK1_ANALYSIS.md

---

## 💡 Prevention Strategy

### For Future
1. **Always use auto-generated types** from `database.types.ts`
2. **Use snake_case in tests** to match PostgreSQL convention
3. **Run schema validation** before writing E2E tests
4. **Create test helper** that validates schema compliance

### Schema Validation Helper (TODO)
```typescript
// src/__tests__/helpers/validate-schema.ts
export function validateAgainstSchema<T extends keyof Database['public']['Tables']>(
  tableName: T,
  data: unknown
): Database['public']['Tables'][T]['Insert'] {
  // Validate data matches Insert type
  // Throw helpful error if mismatch
  return data as Database['public']['Tables'][T]['Insert'];
}
```

---

## 🎯 Expected Impact

**After All Fixes**:
```
Before: 88.1% pass rate (2,693/3,056 tests)
After:  91-92% pass rate (2,780+/3,056 tests)

Improvement: +87 tests, +3-4% pass rate
```

**ROOT CAUSE #2 Progress**:
- ✅ Tenants schema: 100% fixed
- ⏳ Users schema: 0% (pending)
- ⏳ Packages schema: 0% (pending)
- **Overall**: 30% done → 100% after next 30 minutes

---

**Analysis Complete**: 12/07/2026  
**Next**: Implement fixes in e2e-salary-comprehensive.test.ts  
**ETA**: 30 minutes to complete ROOT CAUSE #2

**END OF ANALYSIS**
