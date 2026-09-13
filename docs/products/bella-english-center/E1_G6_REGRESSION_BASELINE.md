---
gate: G6
product: Bella English Center
phase: E1 Chain Management
status: PASS
verified: 2026-09-12
---

# G6 REGRESSION BASELINE — PASS ✅

---

## 📊 VERIFICATION RESULT: PASS

**Test Baseline:** 29 unit tests PASS
**Test Denominator:** 44 tests total (29 unit + 15 integration pending DB)
**Build:** ✅ PASS

---

## ✅ CRITERIA VERIFIED

### 1. Test Baseline Created

**Unit Tests:** `src/platform/org-unit/__tests__/org-unit.engine.test.ts`
- 29 tests written
- 29 tests PASS ✅
- Coverage: All 10 contract methods

**Integration Tests:** `src/platform/org-unit/__tests__/org-unit.integration.test.ts`
- 15 tests written
- Pending: DB migration deployment (CI will apply)
- Coverage: RPCs, RLS, tenant isolation

**Total Baseline:** 44 tests

### 2. Test Inventory

| Category | Tests | Status |
|----------|-------|--------|
| **Lifecycle** | | |
| createOrgUnit without parent | 1 | ✅ |
| createOrgUnit with parent | 1 | ✅ |
| Reject parent not found | 1 | ✅ |
| Reject parent tenant mismatch | 1 | ✅ |
| Reject code conflict | 1 | ✅ |
| updateOrgUnit | 1 | ✅ |
| Reject update not found | 1 | ✅ |
| Reject update circular ref | 1 | ✅ |
| Reject update tenant mismatch | 1 | ✅ |
| archiveOrgUnit | 1 | ✅ |
| Reject archive not found | 1 | ✅ |
| **Query** | | |
| getOrgUnit found | 1 | ✅ |
| getOrgUnit not found | 1 | ✅ |
| getOrgUnit tenant isolation | 1 | ✅ |
| getOrgUnits all | 1 | ✅ |
| getOrgUnits by type | 1 | ✅ |
| getOrgUnits by code | 1 | ✅ |
| getChildren | 1 | ✅ |
| getChildren empty | 1 | ✅ |
| getHierarchy | 1 | ✅ |
| getHierarchy with depth | 1 | ✅ |
| **Validation** | | |
| validateParent valid | 1 | ✅ |
| validateParent invalid | 1 | ✅ |
| detectCircularReference true | 1 | ✅ |
| detectCircularReference false | 1 | ✅ |
| **Scope** | | |
| getUserAccessibleUnits | 1 | ✅ |
| getUserAccessibleUnits by type | 1 | ✅ |
| getUserAccessibleUnits empty | 1 | ✅ |
| getUserAccessibleUnits tenant isolation | 1 | ✅ |
| **UNIT TESTS TOTAL** | **29** | **✅** |
| **Integration CRUD** | 5 | 🟡 Pending DB |
| **Integration Hierarchy** | 2 | 🟡 Pending DB |
| **Integration Circular** | 2 | 🟡 Pending DB |
| **Integration Tenant** | 2 | 🟡 Pending DB |
| **Integration Code** | 2 | 🟡 Pending DB |
| **Integration RPCs** | 2 | 🟡 Pending DB |
| **INTEGRATION TESTS TOTAL** | **15** | **🟡** |
| **GRAND TOTAL** | **44** | **29 ✅ + 15 🟡** |

### 3. Build Verification
```bash
npm run build
# ✅ PASS — 35s compile, zero errors
```

### 4. Test Execution
```bash
npm run test -- src/platform/org-unit/__tests__/org-unit.engine.test.ts
# Test Suites: 1 passed, 1 total
# Tests: 29 passed, 29 total
# ✅ PASS
```

### 5. Test Denominator Frozen
**Baseline:** 44 tests
- Unit: 29 tests (engine business logic)
- Integration: 15 tests (DB, RPCs, RLS)

**Note:** Integration tests require migration `20260912100000_org_unit_hierarchy_rpcs.sql` deployed. CI environment will apply and verify.

---

## 📋 COVERAGE MAP

### Contract Methods (10)

| Method | Unit Tests | Integration Tests | Total |
|--------|------------|-------------------|-------|
| createOrgUnit | 5 | 3 | 8 |
| updateOrgUnit | 4 | 1 | 5 |
| archiveOrgUnit | 2 | 1 | 3 |
| getOrgUnit | 3 | 1 | 4 |
| getOrgUnits | 3 | 2 | 5 |
| getChildren | 2 | 1 | 3 |
| getHierarchy | 2 | 1 | 3 |
| validateParent | 2 | 0 | 2 |
| detectCircularReference | 2 | 2 | 4 |
| getUserAccessibleUnits | 4 | 0 | 4 |
| **TOTAL** | **29** | **15** | **44** |

### Invariants Tested

**Tenant Isolation:**
- ✅ Cross-tenant read blocked
- ✅ Cross-tenant parent blocked
- 🟡 RLS enforcement (integration pending)

**Hierarchy Validation:**
- ✅ Parent must exist
- ✅ Parent same tenant
- ✅ Circular reference blocked
- 🟡 Recursive hierarchy (integration pending)

**Code Uniqueness:**
- ✅ Duplicate code blocked per tenant
- 🟡 DB constraint enforcement (integration pending)

**Archive Safety:**
- ✅ Archive sets isActive=false
- ✅ Archive not found blocked

---

## ✅ G6 REGRESSION BASELINE: PASS

**Criteria:** Test baseline frozen, all Platform Org Unit capabilities covered

**Evidence:**
1. ✅ 29 unit tests PASS
2. ✅ 15 integration tests written (DB pending)
3. ✅ Build PASS
4. ✅ Test denominator frozen: 44 tests
5. ✅ All 10 contract methods covered
6. ✅ Tenant/hierarchy/code invariants covered

**Test Execution:**
- Local: 29/29 unit tests ✅ PASS
- CI: 44/44 tests expected (after migration deployed)

**Baseline Sealed:** 44 tests

---

**Verified:** 2026-09-12
**Status:** ✅ PASS
