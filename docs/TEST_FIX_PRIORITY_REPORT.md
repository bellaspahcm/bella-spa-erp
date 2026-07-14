# Test Fix Priority Report

**Ngày tạo**: 12/07/2026  
**Trạng thái**: 🚨 **URGENT - Top Priority Q1 2027**

---

## 📊 Current Test Status

**Từ test run actual (12/07/2026)**:
```
Test Suites: 192 passed, 59 failed, 3 skipped, 254 total (75.6% pass rate)
Tests:       2,683 passed, 251 failed, 101 skipped, 3,035 total (88.4% pass rate)
Execution Time: 26.2 seconds
```

**Gap Analysis**:
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Test Pass Rate | 88.4% | >95% | -6.6% (200 tests) |
| Suite Pass Rate | 75.6% | >90% | -14.4% (36 suites) |
| Skipped Tests | 101 | <10 | -91 tests |
| Failing Tests | 251 | <150 | -101 tests |

---

## 🎯 Objectives

### Primary Goal
✅ **Achieve >95% test pass rate** (2,883/3,035 passing)  
✅ **Achieve >90% suite pass rate** (228/254 passing)  
✅ **Fix all critical business logic tests**  
✅ **Resolve or document all skipped tests**

### Timeline
**Deadline**: End of Week 3, Q1 2027 (~21 days)

---

## 🔍 Investigation Plan

### Week 1: Analysis & Categorization

**Day 1-2: Categorize Failures by Module**
```bash
npm test -- --listTests | grep failing
npm test -- --verbose 2>&1 | tee test-output.log
```

**Expected Categories**:
1. **Booking Module**: ~30-50 failures
2. **HR/Payroll Module**: ~40-60 failures
3. **Inventory Module**: ~20-30 failures
4. **Finance/Accounting**: ~30-40 failures
5. **Decision Engine**: ~10-20 failures (CRITICAL)
6. **Workflow Engine**: ~5-10 failures
7. **Intelligence Layer**: ~20-30 failures
8. **UI Components**: ~40-60 failures

**Day 3-4: Root Cause Analysis**

Common failure patterns to investigate:
- [ ] **Stale mocks**: Supabase client mock không match schema mới
- [ ] **Schema changes**: Database columns added/removed/renamed
- [ ] **Type mismatches**: TypeScript strict mode violations
- [ ] **Environment vars**: Missing or incorrect `.env.test` setup
- [ ] **Async issues**: Race conditions, timing issues
- [ ] **Incomplete features**: Tests written before features complete

**Day 5: Prioritization Matrix**

| Priority | Criteria | Action |
|----------|----------|--------|
| **P0 (Critical)** | Business logic (Decision Engine, Payroll, Booking core) | Fix Week 2 |
| **P1 (High)** | Integration tests, API contracts | Fix Week 2-3 |
| **P2 (Medium)** | Unit tests for utilities, helpers | Fix Week 3 |
| **P3 (Low)** | UI component tests (non-blocking) | Fix Week 3 or defer |

---

## 🛠️ Fix Strategy

### Week 2: Fix Critical Failures (P0 + P1)

**P0: Business Logic Tests** (Target: 100% pass)

**Decision Engine Providers**:
- [ ] Booking Provider (141 tests) - Verify all passing
- [ ] Discount Provider (22 tests) - Verify all passing
- [ ] Payroll Provider (32 tests) - **CRITICAL** - Fix any failures
- [ ] Commission Provider (45 tests) - **CRITICAL** - Fix any failures
- [ ] Inventory Provider (24 tests) - Verify all passing

**Payroll Core**:
- [ ] Salary calculation (all components)
- [ ] Salary reconciliation (AI vs Legacy)
- [ ] Pro-rata logic
- [ ] KPI bonus calculations
- [ ] Commission calculations

**Booking Core**:
- [ ] Booking creation atomic transaction
- [ ] Session completion side-effects
- [ ] Inventory rollback on failure
- [ ] Revenue recording
- [ ] Commission adding to salary

**Action**:
```bash
# Run specific test suites
npm test -- src/lib/decision-engine --verbose
npm test -- src/modules/hr-salary --verbose
npm test -- src/modules/booking --verbose

# Fix failures one by one
# Update mocks, fix schema mismatches, update assertions
```

**P1: Integration & API Tests**

- [ ] Multi-module integration tests
- [ ] Database transaction tests
- [ ] Outbox pattern tests
- [ ] API endpoint tests
- [ ] Workflow orchestration tests

---

### Week 3: Fix Remaining + Skipped Tests

**P2: Unit Tests**

- [ ] Utility functions
- [ ] Helper functions
- [ ] Data transformation
- [ ] Validation schemas
- [ ] Type guards

**P3: UI Component Tests**

- [ ] React component rendering
- [ ] User interactions
- [ ] Form submissions
- [ ] Error states

**Skipped Tests (101 tests)**

**Investigation Questions**:
1. Why were these tests skipped?
   - Incomplete feature?
   - Known flaky test?
   - Environment-specific?
   - TODO/WIP?
2. Should we fix or delete?

**Action**:
```bash
# Find skipped tests
npm test -- --listTests | grep ".skip"
npm test -- --listTests | grep "xit("
npm test -- --listTests | grep "xdescribe("

# Review each skipped test
# Decision: Fix, Delete, or Keep skipped (with reason)
```

---

## 📋 Checklist

### Pre-Fix Setup
- [ ] Create backup branch `test-fixes-q1-2027`
- [ ] Setup test environment properly
- [ ] Verify all dependencies installed
- [ ] Run full test suite baseline

### Week 1: Analysis
- [ ] Categorize all 251 failures by module
- [ ] Identify root causes (top 5 patterns)
- [ ] Create prioritization matrix (P0/P1/P2/P3)
- [ ] Document findings in `TEST_FAILURE_ANALYSIS.md`

### Week 2: Critical Fixes
- [ ] Fix all Decision Engine provider tests (P0)
- [ ] Fix all Payroll core tests (P0)
- [ ] Fix all Booking core tests (P0)
- [ ] Fix all Integration tests (P1)
- [ ] Fix all API tests (P1)
- [ ] Run regression test after each fix
- [ ] Update mocks/schemas as needed

### Week 3: Remaining + Cleanup
- [ ] Fix P2 unit tests
- [ ] Fix P3 UI component tests (or defer)
- [ ] Investigate 101 skipped tests
- [ ] Resolve skipped tests (fix/delete/document)
- [ ] Run full test suite
- [ ] Verify >95% pass rate achieved
- [ ] Update test documentation

### Post-Fix
- [ ] Merge to main branch
- [ ] Deploy to staging
- [ ] Smoke test on staging
- [ ] Update README with new metrics
- [ ] Close GitHub issue

---

## 🚨 Blocking Issues

**These MUST be resolved before**:
- ❌ User training (Week 4-5)
- ❌ Production deployment
- ❌ Investor demo
- ❌ Q2 2027 core platform extraction

**Rationale**:
- 8.3% failure rate is too high for production
- Failing tests indicate potential bugs in production code
- Cannot train users on unstable system
- Cannot extract core platform with failing tests

---

## 📈 Success Metrics

**Target State (End of Week 3)**:
```
Test Suites: 228+ passed, <26 failed, <5 skipped, 254 total (>90% pass rate)
Tests:       2,883+ passed, <150 failed, <10 skipped, 3,035 total (>95% pass rate)
Business Logic: 100% passing
Execution Time: <30 seconds
```

**Acceptance Criteria**:
- ✅ Test pass rate >95%
- ✅ Suite pass rate >90%
- ✅ All critical business logic tests passing
- ✅ Zero P0/P1 failures
- ✅ Skipped tests <10 or documented
- ✅ Regression suite established

---

## 🔄 Continuous Improvement

**After achieving >95% pass rate**:

**Short-term (Q1 2027)**:
- Setup CI/CD to run tests on every PR
- Add pre-commit hook to run critical tests
- Establish test coverage gates (>85%)

**Medium-term (Q2 2027)**:
- Increase test coverage to >90%
- Add more E2E tests (target: 200+ tests)
- Add visual regression tests
- Add performance regression tests

**Long-term (Q3+ 2027)**:
- Achieve >98% test pass rate
- Zero flaky tests
- Comprehensive E2E coverage
- Test suite <20 seconds

---

## 📝 Action Items

**Immediate Next Steps**:
1. [ ] Create GitHub issue: "Fix 251 failing tests + 101 skipped tests"
2. [ ] Assign to: Development team
3. [ ] Priority: P0 (Highest)
4. [ ] Milestone: Q1 2027 Week 1-3
5. [ ] Start investigation tomorrow

**Owner**: Development Team Lead  
**Reviewers**: Technical Lead, QA Lead  
**Stakeholders**: Product Owner, CTO  

---

**Report Generated**: 12/07/2026  
**Next Update**: After Week 1 analysis complete  
**Status**: 🚨 **URGENT - ACTION REQUIRED**

**END OF REPORT**
