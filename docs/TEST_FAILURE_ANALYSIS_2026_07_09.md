# Test Failure Analysis Report

**Ngày phân tích**: 9 tháng 7, 2026  
**Test run**: Full test suite  
**Execution time**: 25.694s

---

## 📊 Current Status Summary

```
Test Suites: 53 failed, 3 skipped, 196 passed, 252 total (77.8% pass rate)
Tests:       213 failed, 101 skipped, 2,756 passed, 3,070 total (89.8% pass rate)
Snapshots:   0 total
Time:        25.694 seconds
```

**Improvement vs. Last Report (12/07/2026)**:
- Suite pass rate: 75.6% → 77.8% ✅ (+2.2%)
- Test pass rate: 88.4% → 89.8% ✅ (+1.4%)
- Failing tests: 251 → 213 ✅ (-38 tests fixed)
- Failing suites: 59 → 53 ✅ (-6 suites fixed)

**Gaps Remaining**:
- Suite pass rate target: 90% (need +12.2%, ~31 suites)
- Test pass rate target: 95% (need +5.2%, ~160 tests)

---

## 🔍 Root Cause Categories

### Category 1: Schema Migration Issues ⚠️ **HIGH PRIORITY**

**Impact**: 24+ tests (Finance Intelligence module)

**Root Cause**: 
- Database schema changed (added `tier` column to `tenants` table)
- Type generation not updated
- Test mocks don't reflect new schema

**Error Pattern**:
```
Could not find the 'tier' column of 'tenants' in the schema cache
```

**Affected Tests**:
- `src/__tests__/integration/finance-intelligence-integration.test.ts` (ALL 24 tests)
  - Materialized Views (3 tests)
  - Finance Intelligence Service - Real Data (8 tests)
  - Cache Performance (2 tests)
  - Data Consistency (4 tests)
  - Tenant Isolation (1 test)
  - Error Handling (3 tests)
  - Health Check (1 test)

**Fix Strategy**:
1. Run `npm run db:types` to regenerate TypeScript types
2. Update test fixtures to include `tier` column
3. Update mock Supabase client schema cache
4. Verify all tests pass

**Estimated Time**: 1-2 hours

---

### Category 2: Missing Module Imports 🚨 **CRITICAL**

**Impact**: 3 test suites completely broken

**Root Cause**: Module paths changed or deleted

**Error Pattern**:
```
Cannot find module '../core/DecisionEngine' from 'src/lib/decision-engine/__tests__/benchmark.test.ts'
Cannot find module '../../lib/decision-engine/observability' from 'src/__tests__/observability/observability.test.ts'
Cannot find module 'vitest' from 'src/__tests__/integration/booking-flow.integration.test.ts'
```

**Affected Test Suites**:
1. `src/lib/decision-engine/__tests__/benchmark.test.ts`
   - Cannot find `../core/DecisionEngine`
   - Cannot find types from `../types`
   
2. `src/__tests__/observability/observability.test.ts`
   - Cannot find `../../lib/decision-engine/observability`
   - Cannot find `MetricsCollector`, `AuditTrail`, `DecisionEventEmitter`, `ObservabilityInterceptor`

3. `src/__tests__/integration/booking-flow.integration.test.ts`
   - Cannot find `vitest` (wrong test framework - should use Jest)
   - Importing `describe, it, expect` from vitest instead of Jest

**Fix Strategy**:
1. **Decision Engine Benchmark Test**:
   - Check if `src/lib/decision-engine/core/DecisionEngine.ts` exists
   - If moved, update import path
   - If deleted, remove test or restore module

2. **Observability Test**:
   - Check if `src/lib/decision-engine/observability/` folder exists
   - Verify all exported modules exist
   - Update import path if moved

3. **Booking Flow Integration Test**:
   - Replace `vitest` imports with Jest imports:
     ```diff
     - import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
     + import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
     ```
   - Or use implicit Jest globals (no import needed)

**Estimated Time**: 2-3 hours

---

### Category 3: Component Test Assertions ⚠️ **MEDIUM PRIORITY**

**Impact**: 2+ test suites (UI components)

**Root Cause**: 
- Accessibility improvements broke old test queries
- Labels now use custom components without proper `htmlFor` binding
- Multiple elements with same text

**Error Patterns**:
```
1. TestingLibraryElementError: Found a label with the text of: /dịch vụ/i, however no form control was found
2. TestingLibraryElementError: Found multiple elements with the text: /tùy chỉnh/i
```

**Affected Tests**:
- `src/components/bookings/__tests__/ServiceItemRow.test.tsx`
  - "should render service item with all fields" (label not associated)
  - "should show override badge when override is active" (multiple matches)

**Fix Strategy**:
1. **Label Association Issue**:
   - Update component to use `htmlFor` properly on custom components
   - OR change test to use different query (e.g., `getByRole`, `getByTestId`)

2. **Multiple Elements Issue**:
   - Use more specific queries:
     ```diff
     - expect(screen.getByText(/tùy chỉnh/i)).toBeInTheDocument();
     + expect(screen.getByRole('button', { name: /tùy chỉnh hoa hồng/i })).toBeInTheDocument();
     ```
   - OR add `data-testid` to disambiguate

**Estimated Time**: 1-2 hours

---

### Category 4: Module Isolation Test (Beauty Spa) ⚠️ **LOW PRIORITY**

**Impact**: 1 test suite

**Root Cause**: 
- Code structure changed (moved from `enabledModules.babycare` to something else)
- Test expects old code pattern

**Error Pattern**:
```
Expected string to contain "{hasLoadedTenantModules && enabledModules.babycare && ("
```

**Affected Tests**:
- `src/__tests__/beauty-spa-module-isolation.test.ts`
  - "should use module-aware logic in services page"

**Fix Strategy**:
1. Check actual implementation in services page source
2. Update test expectation to match new code pattern
3. Verify module isolation logic still works correctly

**Estimated Time**: 30 minutes

---

### Category 5: Skipped Tests 📋 **INVESTIGATION NEEDED**

**Impact**: 101 skipped tests (3.3% of total)

**Status**: Not analyzed yet (need manual review)

**Action Required**:
1. Run `grep -r "\.skip\|xit\|xdescribe" src/__tests__/ --include="*.test.ts" --include="*.test.tsx"`
2. Review each skipped test:
   - Why skipped? (incomplete feature, flaky, environment-specific, WIP)
   - Should fix or delete?
3. Document decision in spreadsheet

**Estimated Time**: 4-6 hours (Week 1)

---

## 📅 Proposed Fix Schedule

### Day 1-2 (Jul 10-11): Critical Fixes ⚡

**Priority**: P0 - Module import failures (blocks test execution)

1. ✅ Fix Decision Engine benchmark test imports (1 hour)
2. ✅ Fix Observability test imports (1 hour)
3. ✅ Fix Booking flow integration test (vitest → Jest) (1 hour)
4. ✅ Verify Decision Engine tests pass (177/177)

**Goal**: All test suites runnable (0 "cannot find module" errors)

---

### Day 3-4 (Jul 12-13): High Priority Fixes 🔥

**Priority**: P1 - Schema migration + Finance module

1. ✅ Regenerate database types (`npm run db:types`)
2. ✅ Update test fixtures with `tier` column
3. ✅ Fix all 24 Finance Intelligence integration tests
4. ✅ Verify Finance module tests pass

**Goal**: Finance Intelligence module 100% passing

---

### Day 5-6 (Jul 14-15): Medium Priority Fixes ⚙️

**Priority**: P2 - Component tests + module isolation

1. ✅ Fix ServiceItemRow component tests (label association)
2. ✅ Fix Beauty Spa module isolation test
3. ✅ Run full UI component test suite
4. ✅ Fix any other broken component tests

**Goal**: UI component tests >90% passing

---

### Week 2 (Jul 16-20): Skipped Tests Investigation 📋

**Priority**: P3 - Review and resolve 101 skipped tests

1. ✅ Categorize all skipped tests
2. ✅ Fix tests that should not be skipped
3. ✅ Document tests that must remain skipped (with reason)
4. ✅ Delete tests for removed features

**Goal**: <10 legitimately skipped tests, all documented

---

### Week 3 (Jul 23-27): Final Push & Verification ✅

**Priority**: Reach >95% test pass rate

1. ✅ Fix remaining failing tests (by priority)
2. ✅ Run full regression test suite
3. ✅ Update test documentation
4. ✅ Create test maintenance guide

**Goal**: 
- Test pass rate: >95% (2,917/3,070 passing)
- Suite pass rate: >90% (227/252 passing)
- Skipped tests: <10 (with documentation)

---

## 🎯 Success Criteria

**By End of Week 1 (Jul 15)**:
- ✅ All test suites runnable (no module import errors)
- ✅ Finance Intelligence module 100% passing
- ✅ Component tests >90% passing
- Test pass rate: >92% (target: 2,824/3,070)

**By End of Week 2 (Jul 22)**:
- ✅ Skipped tests categorized and resolved
- Test pass rate: >94% (target: 2,886/3,070)

**By End of Week 3 (Jul 29)**:
- ✅ Test pass rate: >95% (2,917/3,070)
- ✅ Suite pass rate: >90% (227/252)
- ✅ All documentation updated
- ✅ Test maintenance guide created

---

## 📝 Notes

**Key Insights from This Analysis**:

1. **Good News**: 
   - Already improved +1.4% pass rate since last report
   - 38 tests fixed naturally
   - Most failures are isolated to 5 categories

2. **Low-Hanging Fruit**:
   - Category 1 (Schema): 24 tests, 1-2 hours
   - Category 2 (Imports): 3 suites, 2-3 hours
   - Category 3 (Components): 2 suites, 1-2 hours
   - **Total**: ~5-7 hours → +30 tests fixed → 92% pass rate

3. **Time-Intensive**:
   - Category 5 (Skipped): 101 tests, 4-6 hours investigation
   - Remaining failures: ~180 tests, varies by complexity

4. **Risk**:
   - Some skipped tests may reveal unfinished features
   - Some failures may be legitimate bugs, not test issues
   - Need product owner input for feature completeness

---

**Next Action**: Start with Day 1-2 (Critical Fixes) immediately.

**Report Updated**: 2026-07-09  
**Author**: AI Development Agent  
**Status**: Ready for execution
