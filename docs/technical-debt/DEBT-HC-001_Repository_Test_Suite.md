# DEBT-HC-001: Repository Test Suite Quality

**Status:** 🔴 OPEN  
**Priority:** P2 (Medium)  
**Owner:** Healthcare Platform Team  
**Created:** 2026-08-12  
**Target Resolution:** Phase 4 or dedicated Repository Quality Track  

---

## 📊 Current State

```
Repository Test Suite: 2/21 PASS (10%)
Failed Tests: 19/21
```

**Location:** `src/platform/healthcare/engines/encounter-engine/infrastructure/__tests__/supabase-encounter.repository.test.ts`

---

## 🔍 Root Cause

Repository unit tests attempt **direct database access** without proper test data setup:

1. **No test data bootstrap** for repository-specific fixtures
2. **No Supabase client mocking** (tests expect real DB)
3. **Ambiguous test classification:** Unit tests behaving like integration tests
4. **UUID format mismatch:** Tests may use old string-based IDs instead of UUIDs
5. **FK constraints:** Test data doesn't satisfy foreign key relationships

---

## ✅ Already Validated (Gate 1C)

Gate 1C **integration tests (13/13 PASS)** already validate the **Service → Repository → DB** path end-to-end with real data:

- ✅ Repository.save() with real DB
- ✅ Repository.findById() with real DB
- ✅ Repository.exists() with real DB
- ✅ Repository.delete() with real DB
- ✅ Tenant isolation at repository layer
- ✅ FK constraints enforced

**Conclusion:** Repository **functionality** is validated. Repository **unit test quality** is the debt.

---

## 🎯 Work Required

### Option A: Convert to Integration Tests (Recommended)
1. Extend `scripts/seed-healthcare-test-data.js` with repository-specific fixtures
2. Mark tests as integration tests (not unit tests)
3. Update test setup to use real tenant/patient IDs
4. Handle FK constraints in test data
5. Update to UUID format (not string IDs)

**Effort:** 2-3 days  
**Benefit:** Validates repository against real DB schema

### Option B: Add Proper Mocking
1. Mock Supabase client properly (using `jest.mock()`)
2. Separate repository logic tests from DB integration tests
3. Create repository unit tests (mocked) + integration tests (real DB)
4. Update test assertions to match current implementation

**Effort:** 3-4 days  
**Benefit:** Faster test execution, better separation of concerns

### Option C: Hybrid Approach
1. Keep critical path tests as integration (create, read, update, delete)
2. Mock edge cases and error scenarios
3. Move tenant isolation tests to integration suite
4. Add performance benchmarks (separate from unit/integration)

**Effort:** 2-3 days  
**Benefit:** Balance between speed and validation depth

---

## 🚫 Why Not Blocking Gate 1C

1. **Integration tests already validate repository functionality** (13/13 PASS)
2. **Original Gate 1C scope:** Service → Repository → DB integration (NOT repository unit tests)
3. **No regression risk:** Service layer tests cover all critical paths
4. **Architecture validated:** Repository pattern working correctly
5. **Technical debt is TRACKED:** Not being swept under the rug

---

## 📅 Resolution Plan

### Phase 1: Assessment (Week 1)
- [ ] Review all 21 repository tests
- [ ] Classify: Unit vs Integration vs Edge Case
- [ ] Identify reusable fixtures from existing test data bootstrap
- [ ] Decide: Option A, B, or C

### Phase 2: Implementation (Week 2-3)
- [ ] Extend test data bootstrap (if Option A/C)
- [ ] Add Supabase client mocking (if Option B/C)
- [ ] Update tests to UUID format
- [ ] Fix FK constraint issues
- [ ] Separate unit from integration tests

### Phase 3: Validation (Week 4)
- [ ] Run repository test suite: Target 21/21 PASS
- [ ] Verify no regression in Gate 1C integration tests
- [ ] Update test documentation
- [ ] Close DEBT-HC-001

---

## 📈 Success Criteria

```
BEFORE (Current):
Repository Tests: 2/21 PASS (10%)

AFTER (Target):
Repository Unit Tests:        15/15 PASS (mocked)
Repository Integration Tests:  6/6  PASS (real DB)
Total:                        21/21 PASS (100%)
```

**Definition of Done:**
- [ ] All 21 repository tests pass
- [ ] Tests properly classified (unit vs integration)
- [ ] Test data bootstrap extended (if needed)
- [ ] No regression in Gate 1C integration tests (13/13 still PASS)
- [ ] Documentation updated

---

## 🔗 Related

- **Gate 1C Closure Report:** `docs/execution/PHASE_3_GATE_1C_CLOSURE_REPORT.md`
- **Test Data Bootstrap:** `scripts/seed-healthcare-test-data.js`
- **Integration Tests (Reference):** `src/platform/healthcare/engines/encounter-engine/__tests__/encounter-engine.integration.test.ts`

---

## 📝 Notes

- **Do NOT reopen Gate 1C** to fix this debt. Gate 1C acceptance criteria already met (322/322 PASS).
- **Do NOT block Phase 4** on this debt. Repository functionality already validated via integration tests.
- **Do resolve this debt** in a dedicated quality track or Phase 4 backlog item.

---

**Debt Owner Signature:** ___________________  
**Target Resolution Date:** 2026-08-26 (2 weeks from creation)  
**Review Date:** 2026-08-19 (1 week check-in)
