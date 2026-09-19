# P2-R1: BabyCare Regression Census

**Date:** 2026-09-16  
**Phase:** R1 - Census (Read-only analysis)  
**Status:** 🔄 IN PROGRESS  
**Part of:** Bella Platform Hardening Initiative

---

## **Objective**

Answer the equation: **321 = PASS + FAIL + SKIP + BLOCKED**

Classify all BabyCare regression tests to understand actual stability state.

---

## **Known Baseline**

From previous reports:
- **Total BabyCare tests:** 321
- **PASS (known):** 289 (90.0%)
- **Remainder:** 32 (10.0%) — status unknown

**Goal:** Classify the 32 remainder into FAIL / SKIP / BLOCKED with reasons.

---

## **BabyCare Test Inventory**

### **Total Test Files in Repository: 240**

### **BabyCare Core Modules (Identified)**

**Booking Engine (11 files):**
- booking-conflict-customer-level.test.ts
- booking-invoice-print-actions.test.ts
- booking-package-module-scope.test.ts
- booking-resource-actions.test.ts
- booking-resource-rules.test.ts
- booking-resource-schedule-guard.test.ts
- booking-tenant-scope.test.ts
- booking.test.ts
- create-booking-payment-status.test.ts
- e2e-partner-api-create-booking.test.ts
- online-booking-package-scope.test.ts
- public-booking-packages.test.ts
- update-booking-conflicts.test.ts

**Booking Engine (subfolder booking-engine/):**
- booking-engine-schema.test.ts
- booking-process.test.ts
- booking-capacity.test.ts
- booking-flow.integration.test.ts

**Session Management (4 files):**
- complete-session-action.test.ts
- e2e-payroll-cross-month-session.test.ts
- session-completion-accounting.test.ts
- session-read-actions.test.ts

**Customer Management (5 files):**
- auto-phase2-customer-extension.test.ts
- booking-conflict-customer-level.test.ts (duplicate in booking)
- customer-actions.test.ts
- customer-list-rules.test.ts

**Package/Service Catalog (5 files):**
- booking-package-module-scope.test.ts (duplicate in booking)
- online-booking-package-scope.test.ts (duplicate in booking)
- package-actions.test.ts
- public-booking-packages.test.ts (duplicate in booking)
- service-package-rules.test.ts

**Financial/Salary (11 files - accounting category):**
- accounting-engine.test.ts
- accounting-error-message.test.ts
- accounting-health.test.ts
- accounting-ledger-boundary.test.ts
- accounting-outbox-helper.test.ts
- accounting-outbox-idempotency.test.ts
- accounting-outbox-replay-safety.test.ts
- accounting-outbox.test.ts
- accounting-reports.test.ts
- accounting-template-rules.test.ts
- accounting-worker-cron-smoke.test.ts

**Salary Management (5 files):**
- admin-salary-actions.test.ts
- salary-recalculation-lifecycle.test.ts
- salary-reconciliation-summary.test.ts
- salary-reconciliation.test.ts
- salary-surface-parity.test.ts

**Finance (5 files):**
- finance-transaction-mutations.test.ts
- finance.test.ts
- (+ 3 more in accounting category)

**Reporting/KTV (3 files):**
- ktv-* (TBD - need to enumerate)

**Totals by Category:**
- Booking: ~15 files
- Session: ~4 files
- Customer: ~4 files
- Package: ~4 files
- Accounting: ~11 files
- Salary: ~5 files
- Finance: ~5 files
- KTV/Reporting: ~3 files

**Estimated BabyCare test files: ~50+ files**

---

## **Census Strategy**

### **Phase R1.1: Inventory Verification (CURRENT)**

**Status:** ✅ COMPLETE

Identified BabyCare test files by pattern matching:
- booking, session, customer, package (core operations)
- salary, finance, accounting (financial layer)
- ktv, revenue, expense (reporting)

**Challenge:** 321 tests ≠ direct file count (tests are in describe blocks)

## **Phase R1.2: Baseline Test Run (READY)**

**CRITICAL:** Identify canonical test suite BEFORE running.

### **Canonical 321 Test Suite Identified**

**Source:** `docs/deployment/BABYCARE_REGRESSION_EVIDENCE.md` (Gate 1, 2026-09-16)

**Original Command:**
```bash
npm test -- --testPathPatterns="booking.*\.test\.ts"
```

**Original Results:**
```text
Test Suites: 24 passed, 2 failed, 1 skipped, 27 total
Tests:       289 passed, 32 skipped, 321 total
Time:        51.329s
```

**Breakdown:**
- **PASS:** 289 (90.0%)
- **SKIP:** 32 (10.0%)
- **FAIL:** 2 test suites (test infrastructure issues, NOT regression)

**Critical Clarification:**
- "32 remainder" = 32 SKIPPED (not failed)
- 2 FAIL were non-regression (test bug + Healthcare infra gap)
- BabyCare booking logic: NO REGRESSION DETECTED

### **R1.2 Execution Strategy**

**Goal:** Re-run SAME canonical suite, classify current state.

**Command (identical to original):**
```bash
npm test -- --testPathPatterns="booking.*\.test\.ts" --verbose
```

**Expected Classification:**

```text
321 tests
├── PASS: Should match or exceed 289
├── SKIP: Document reasons (32 baseline)
├── FAIL: Classify each
│   ├── F1: Critical regression (BabyCare logic broken)
│   ├── F2: Feature regression (non-critical)
│   ├── F3: Flaky test (timing/environment)
│   ├── F4: Expected (test bug, infrastructure gap)
│   └── F5: Blocked (missing prerequisite)
└── Total: Must equal 321
```

**Rules:**
1. ✅ DO: Run identical command to original baseline
2. ✅ DO: Classify FAIL vs SKIP accurately
3. ✅ DO: Distinguish regression from existing debt
4. ❌ DO NOT: Assume 32 remainder = 32 failures (they were skips)
5. ❌ DO NOT: Fix immediately on seeing FAIL (classify first)

### **After R1.2: Create BabyCare Regression Manifest v1**

If suite has changed since original run:
- Document delta (tests added/removed)
- Establish NEW canonical baseline
- Version it: "BabyCare Regression Manifest v1"
- Future runs compare against THIS baseline

**Deliverables:**
- [ ] Test execution log (full verbose output)
- [ ] PASS/SKIP/FAIL breakdown (exact counts)
- [ ] Classification matrix (each failure → F1/F2/F3/F4/F5)
- [ ] Regression vs Debt determination
- [ ] BabyCare Regression Manifest v1.csv

---

## **Current Status**

**R1.1 Inventory:** ✅ COMPLETE
- Identified ~50+ BabyCare test files
- Grouped by module (booking, session, financial, etc.)

**R1.2 Test Run:** ⏸️ PENDING
- Awaiting decision: Full run vs selective vs manual review

**R1.3 Classification:** ⏸️ BLOCKED (awaiting R1.2)

---

## **Known Test Results (From Previous Reports)**

**BabyCare Regression: 289/321 PASS (90.0%)**

This was reported in context but details not preserved:
- Which 289 tests passed?
- Which 32 tests are in remainder?
- Were failures, skips, or blocks counted?

**Action Required:**
1. Re-run BabyCare tests with detailed output
2. Capture full pass/fail/skip breakdown
3. Classify remainder into F1-F5 categories

---

## **Practical Next Steps**

### **Recommended Approach: Selective Module Census**

**Step 1: Run critical modules first**
```bash
# Financial (production-critical)
npm test -- --testPathPattern="(accounting|salary|finance)" --verbose

# Booking Engine (production-critical)
npm run test:booking-engine --verbose

# Session/Customer (production-critical)
npm test -- --testPathPattern="(session|customer)" --verbose
```

**Step 2: Document results**
For each module run, record:
- Total tests in module
- PASS count
- FAIL count + test names
- SKIP count + reasons
- BLOCKED count + blockers

**Step 3: Classify failures**
Use F1-F5 categories for each failure.

**Step 4: Aggregate**
Sum across modules to verify 321 total.

---

## **Decision Gate**

**Before proceeding to R2 (stabilization):**
- [ ] 321 test equation resolved (PASS + FAIL + SKIP + BLOCKED = 321)
- [ ] All failures classified (F1 / F2 / F3 / F4 / F5)
- [ ] Critical failures identified (F1 category)
- [ ] Skip reasons documented (F3 / F4 / F5)

**Then proceed to R2:**
- Fix F1 (critical) to 0
- Fix or document F2 (feature) <10%
- Stabilize or skip F3 (flaky)
- Document F4/F5 with clear reasons

---

## **Files**

- `docs/platform/P2_R1_BABYCARE_REGRESSION_CENSUS.md` (this document)
- `scripts/census-regression.ts` (tooling - needs enhancement)
- `test-results.json` (will be generated by test run)
- `docs/platform/P2_R1_MODULE_SUMMARY.csv` (TBD)

---

## **Integration with P0**

**P0-M1 and P2-R1 are independent:**
- P0 focuses on migration reproducibility
- P2 focuses on regression stability

**However, P0 affects P2:**
- If migrations cannot reproduce schema, tests may fail unpredictably
- Clean-build reproducibility (P0 goal) enables reliable test environments
- Recommend: Complete P0-M2 decision gate before heavy P2 stabilization work

**Safe to run P2-R1 census now:**
- Census = read-only observation
- Does not modify code or tests
- Provides data for strategic decisions

---

**Last Updated:** 2026-09-16  
**Status:** R1.1 COMPLETE, R1.2 PENDING
