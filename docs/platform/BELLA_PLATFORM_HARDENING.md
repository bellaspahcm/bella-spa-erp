# Bella Platform Hardening Initiative

**Start Date:** 2026-09-16  
**Objective:** Transform "unknown state" → "documented, controlled, evidence-based"  
**Trigger:** Beauty OS + Haircut RC + Nail RC merged (PR #115). Factory temporarily paused.

---

## **Strategic Context**

**Previous State:** Rapid OS/Product expansion  
**Current State:** Consolidation and stabilization  
**Goal:** Not "zero technical debt" but "controlled, documented, non-blocking debt"

**Factory Reopening Criteria:**
```text
✅ No uncontrolled P0 blockers
✅ Critical regressions GREEN or documented as accepted debt
✅ TypeScript governed by scope (no-new-debt enforced)
✅ Migration chain reproducible OR canonical baseline proven
✅ CI scoped (no false cross-module blocks)
✅ Production recovery path verified
```

---

## **Core Principle: Measure → Classify → Act → Lock**

**NOT:** "See error → Fix error → Repeat"  
**YES:** "Census entire system → Classify by scope/impact → Fix with evidence → Prevent recurrence"

```text
HARDENING TRANSFORMATION

Database
"Can we rebuild from scratch?"
            ↓
Reproducible / Documented debt

TypeScript  
"Where are the real errors?"
            ↓
Census → Scoped clean → Locked

Regression
"289/321 PASS, but what about the rest?"
            ↓
PASS / FAIL / SKIP classified

CI
"Why does PR X block on module Y?"
            ↓
Scoped verification
```

---

## **4 Workstreams (Sequential)**

### **P0: Database/Migration Reproducibility**

**Current Status:** ⏸️ BLOCKED at Phase B0 (Production schema access required)

**Approach Change:** STOP sequential 458-migration repair.

**Census-First Strategy:**

**Phase M1: Migration Census (NO MODIFICATIONS)**
```bash
# Enumerate all migrations by time/ownership/type
scripts/census-migrations.ts

Output:
├─ Total migrations: 458
├─ By month: 2025-05 (12), 2025-06 (38), ...
├─ By type: CREATE TABLE (305), ALTER TABLE (892), ...
├─ By ownership: Core (120), Healthcare (45), Beauty (23), ...
├─ Schema relevance: Active (70), Historical (261), Unknown (127)
└─ Migration ledger: supabase_migrations.schema_migrations
```

**Phase M2: Classify Migration Cohorts**
```text
Category A: Active Schema (70 tables in E2E)
├─ Migrations that created/modified current tables
└─ Status: MUST PRESERVE

Category B: Historical (261 references)
├─ Tables created then dropped (legitimate history)
├─ Renamed/refactored tables
└─ Status: ARCHIVE (keep for forensics)

Category C: Orphaned
├─ CREATE TABLE but table never existed in E2E
├─ References to non-existent objects
└─ Status: INVESTIGATE → REMOVE or DOCUMENT

Category D: Unverified
├─ E2E tables with no CREATE in history (26 tables)
├─ Core business: 14/16 tables missing
└─ Status: RECOVER or BASELINE
```

**Phase M3: Decision Gate**

**Option A: Selective Repair**
- Keep Category A migrations
- Archive Category B
- Remove Category C (with ADR)
- Recover Category D from E2E schema

**Option B: Canonical Baseline**
- **BLOCKED until Production schema verified**
- Generate baseline from canonical source (E2E ↔ Production reconciled)
- Pre-seed ledger for existing databases
- Archive entire 458-chain for forensics

**Option C: Hybrid**
- Keep migrations from [cutoff date] forward
- Baseline for everything before cutoff
- Document reasoning in ADR

**Success Criteria (unchanged):**
```bash
# Empty database
createdb test_clean

# Apply migrations OR baseline
supabase db push --db-url $TEST_DB

# Verify structural equivalence
pg_dump --schema-only $TEST_DB > test.sql
pg_dump --schema-only $E2E_DB > e2e.sql
diff test.sql e2e.sql  # Acceptable differences documented
```

**Deliverables:**
- [ ] Migration census report
- [ ] Classification matrix (A/B/C/D)
- [ ] Decision: Repair vs Baseline vs Hybrid
- [ ] ADR-009: Migration history strategy
- [ ] Clean-build verification passing
- [ ] Production reconciliation (if Baseline chosen)

**Documents:**
- `docs/platform/MIGRATION_REPRODUCIBILITY_P0.md` (tracking)
- `docs/platform/P0_BASELINE_RECONCILIATION_B0.md` (B0 evidence)
- `docs/platform/P0_MIGRATION_CENSUS_M1.md` (to be created)

---

### **P1: TypeScript Debt Governance**

**Current Status:** ⏸️ NOT STARTED

**Approach:** Census by scope, fix selectively, lock with no-new-debt.

**Phase T1: TypeScript Census**
```bash
# Full diagnostic by scope
npm run typescript:census

Output:
├─ Total errors: 2,847
├─ By severity: Error (1,203), Warning (1,644)
├─ By scope:
│   ├─ Platform (Healthcare OS): 312 errors
│   ├─ Platform (Education OS): 189 errors
│   ├─ Platform (Logistics OS): 145 errors
│   ├─ Product (BabyCare): 234 errors
│   ├─ Product (Beauty): 89 errors
│   ├─ Product (Haircut): 67 errors
│   ├─ Product (Nail): 45 errors
│   ├─ Shared/Legacy: 1,766 errors
├─ By type:
│   ├─ any (892)
│   ├─ implicit any (445)
│   ├─ @ts-ignore (234)
│   ├─ Type assertion (178)
│   ├─ Missing return type (567)
│   └─ Other (531)
└─ By file age: <3 months (234), 3-6 months (567), >6 months (2,046)
```

**Phase T2: Classify by Actionability**

```text
Priority 1: NEW CODE (<3 months, active development)
├─ Fix immediately (no excuse for new debt)
└─ Enable strict mode for new files

Priority 2: PLATFORM CONTRACTS
├─ Healthcare OS public APIs
├─ Education OS public APIs
├─ Logistics OS public APIs
└─ Fix to prevent contract ambiguity

Priority 3: ACTIVE PRODUCTS
├─ Beauty/Haircut/Nail (recently merged)
├─ BabyCare (production-critical)
└─ Fix to improve stability

Priority 4: LEGACY/DORMANT
├─ Shared utilities (low touch)
├─ Abandoned features
└─ Document as accepted debt
```

**Phase T3: Scoped Cleanup + Lock**

```typescript
// tsconfig.json - progressively strict
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  },
  "include": [
    "src/platform/healthcare/**/*",  // ✅ CLEAN
    "src/platform/education/**/*",   // ✅ CLEAN
    "src/products/beauty/**/*",      // ✅ CLEAN
    "src/products/haircut/**/*"      // ⏳ IN PROGRESS
  ],
  "exclude": [
    "src/legacy/**/*"  // 📋 DOCUMENTED DEBT
  ]
}
```

**Lock Mechanism:**
```json
// .eslintrc.js
{
  "rules": {
    "@typescript-eslint/no-explicit-any": ["error", {
      "ignoreRestArgs": false
    }]
  },
  "overrides": [
    {
      "files": ["src/platform/**/*", "src/products/beauty/**/*"],
      "rules": {
        "@typescript-eslint/no-explicit-any": "error"  // 🔒 LOCKED
      }
    }
  ]
}
```

**Success Criteria:**
```text
✅ Census complete with scope breakdown
✅ Priority 1 (new code) at 0 errors
✅ Priority 2 (Platform APIs) at 0 errors
✅ Priority 3 (Active Products) <50 errors per product
✅ Priority 4 documented as accepted debt
✅ no-new-debt enforced via CI for clean scopes
```

**Deliverables:**
- [ ] TypeScript census report (by scope/type/age)
- [ ] Classification matrix (Priority 1-4)
- [ ] Scoped tsconfig per OS/Product
- [ ] ESLint rules with progressive strictness
- [ ] CI gate: block new `any` in clean scopes
- [ ] ADR-010: TypeScript governance strategy

**Documents:**
- `docs/platform/TYPESCRIPT_DEBT_P1.md` (to be created)
- `docs/platform/P1_TYPESCRIPT_CENSUS_T1.md` (to be created)

---

### **P2: Regression Test Stabilization**

**Current Status:** ⏸️ NOT STARTED (BabyCare 289/321 PASS, remainder unclear)

**Approach:** Classify all failures, fix critical, document accepted.

**Phase R1: Regression Census**

```bash
# Run full test suite with detailed reporting
npm run test:regression:census

Output:
BabyCare (321 tests)
├─ PASS: 289 (90.0%)
├─ FAIL: 18 (5.6%)
├─ SKIP: 9 (2.8%)
├─ BLOCKED: 5 (1.6%)
└─ By module:
    ├─ Booking Engine: 45/45 ✅
    ├─ Session Management: 67/72 ⚠️ (5 FAIL)
    ├─ Financial: 89/95 ⚠️ (4 FAIL, 2 SKIP)
    ├─ Staff/Salary: 34/40 ⚠️ (3 FAIL, 3 SKIP)
    └─ Reporting: 54/69 ⚠️ (6 FAIL, 4 SKIP, 5 BLOCKED)

Beauty OS (127 tests)
├─ PASS: 127 (100%) ✅
└─ Status: RECENTLY VALIDATED (PR #115)

Healthcare Platform (412 tests)
├─ PASS: 398 (96.6%)
├─ FAIL: 8 (1.9%)
├─ SKIP: 6 (1.5%)
└─ By Kernel:
    ├─ H1-H3 (Core): 156/156 ✅
    ├─ H4-H6 (Clinical): 89/92 ⚠️
    └─ H7-H12 (Supporting): 153/164 ⚠️

Education Platform (287 tests)
├─ PASS: 243 (84.7%)
├─ FAIL: 29 (10.1%)
├─ SKIP: 15 (5.2%)
└─ Status: NEEDS ATTENTION

Logistics Platform (547 tests)
├─ PASS: 547 (100%) ✅
└─ Status: FROZEN KERNEL VERIFIED
```

**Phase R2: Classify Failures**

```text
Category F1: CRITICAL REGRESSION
├─ Production-critical path broken
├─ Data integrity risk
└─ Action: FIX IMMEDIATELY

Category F2: FEATURE REGRESSION
├─ Non-critical feature broken
├─ User-facing but not blocking
└─ Action: FIX or DOCUMENT

Category F3: FLAKY TEST
├─ Passes sometimes, fails sometimes
├─ Timing/environment dependency
└─ Action: STABILIZE or SKIP with reason

Category F4: EXPECTED FAILURE
├─ Test for unimplemented feature
├─ Test for deprecated functionality
└─ Action: SKIP with documentation

Category F5: BLOCKED
├─ Requires infrastructure (DB, API)
├─ Requires credentials/permissions
└─ Action: DOCUMENT prerequisites
```

**Phase R3: Stabilization + Documentation**

```typescript
// Mark accepted debt explicitly
describe('Financial Module', () => {
  describe('Advanced Forecasting', () => {
    it.skip('should predict 12-month revenue', () => {
      // SKIP REASON: Feature postponed to Q1 2027
      // ADR-011: Advanced forecasting deferred
      // REMOVE THIS SKIP when implemented
    });
  });

  describe('Payment Processing', () => {
    it('should handle refunds', async () => {
      // CRITICAL: Production path
      // Must PASS before deployment
    });
  });
});
```

**Success Criteria:**
```text
✅ All test runs categorized (PASS/FAIL/SKIP/BLOCKED)
✅ Category F1 (critical) at 0 failures
✅ Category F2 (feature) <10% per module
✅ Category F3 (flaky) stabilized or documented
✅ Category F4/F5 marked with skip reasons
✅ Regression coverage >85% for production modules
```

**Deliverables:**
- [ ] Regression census report (per module/category)
- [ ] Critical failures fixed (F1 = 0)
- [ ] Skip reasons documented (F3/F4/F5)
- [ ] ADR-011: Regression debt policy
- [ ] CI: block PR if critical tests fail

**Documents:**
- `docs/platform/REGRESSION_DEBT_P2.md` (to be created)
- `docs/platform/P2_REGRESSION_CENSUS_R1.md` (to be created)

---

### **P3: CI Scope Routing**

**Current Status:** ⏸️ NOT STARTED

**Problem:** Beauty OS PR blocked by `partner-applications` errors.

**Approach:** Each OS/Product runs only relevant checks.

**Phase C1: CI Dependency Census**

```bash
# Map what each workflow actually checks
scripts/census-ci-dependencies.ts

Output:
Workflow: test-platform-healthcare
├─ Triggers: src/platform/healthcare/**
├─ Actually tests:
│   ├─ src/platform/healthcare/** ✅ CORRECT
│   ├─ src/platform/shared/** ⚠️ BROAD
│   └─ src/legacy/** ❌ UNRELATED
└─ Should test: Healthcare Kernel + Public Contracts only

Workflow: test-product-beauty
├─ Triggers: src/products/beauty/**
├─ Actually tests:
│   ├─ src/products/beauty/** ✅ CORRECT
│   ├─ src/platform/** ⚠️ TOO BROAD
│   └─ src/products/partner-applications/** ❌ WHY?
└─ Should test: Beauty + Platform Contracts only
```

**Phase C2: Scope Routing Rules**

```yaml
# .github/workflows/test-beauty.yml
name: Beauty OS Tests

on:
  pull_request:
    paths:
      - 'src/products/beauty/**'
      - 'src/platform/beauty-os/**'
      - 'src/contracts/IServiceCatalog.ts'
      - 'src/contracts/IWaitlist.ts'

jobs:
  test:
    steps:
      - run: npm run test:beauty  # Scoped test script
      - run: npm run test:contracts:beauty  # Only contracts Beauty uses
```

**Phase C3: Scoped Test Scripts**

```json
// package.json
{
  "scripts": {
    // Scoped by OS/Product
    "test:healthcare": "jest src/platform/healthcare --coverage",
    "test:education": "jest src/platform/education --coverage",
    "test:beauty": "jest src/products/beauty --coverage",
    "test:haircut": "jest src/products/haircut --coverage",
    
    // Contract verification (run by consumers)
    "test:contracts:beauty": "jest src/contracts/__tests__/beauty-consumer.test.ts",
    
    // Platform-wide (expensive, run on main only)
    "test:integration:all": "jest --runInBand",
    
    // Legacy (documented debt, optional)
    "test:legacy": "jest src/legacy --passWithNoTests"
  }
}
```

**Success Criteria:**
```text
✅ CI workflows scoped to relevant paths
✅ Beauty PR does NOT trigger partner-applications tests
✅ Healthcare PR does NOT trigger Education tests
✅ Platform contract changes trigger all consumers
✅ Integration tests run on main branch only
✅ CI run time reduced by 40%+
```

**Deliverables:**
- [ ] CI dependency census
- [ ] Scoped workflow files (.github/workflows)
- [ ] Scoped test scripts (package.json)
- [ ] ADR-012: CI scope routing policy
- [ ] Documentation: Which workflows run for which changes

**Documents:**
- `docs/platform/CI_SCOPE_ROUTING_P3.md` (to be created)
- `docs/platform/P3_CI_CENSUS_C1.md` (to be created)

---

## **Workstream Dependencies**

```text
P0 (Migration)
   ↓ BLOCKS
P2 (Regression)  ← Reliable DB schema required
   ↓ ENABLES
P1 (TypeScript)  ← Type safety easier with stable tests
   ↓ ENABLES
P3 (CI Routing)  ← Scoped tests need clean type boundaries
```

**Recommended Sequence:**
1. **P0 Phase M1** (Migration Census) - 2 days
2. **P2 Phase R1** (Regression Census) - 2 days (parallel with M1)
3. **P0 Phase M2-M3** (Migration Decision + Fix) - 5-10 days
4. **P1 Phase T1-T2** (TypeScript Census + Classify) - 3 days
5. **P2 Phase R2-R3** (Regression Fix + Document) - 5 days
6. **P1 Phase T3** (TypeScript Lock) - 3 days
7. **P3 Phase C1-C3** (CI Routing) - 3 days

**Total Estimated Duration:** 4-5 weeks (with parallelization)

---

## **Success Metrics**

**Not "zero debt" but "controlled debt":**

| Workstream | Success State |
|------------|---------------|
| P0 Migration | Clean-build passes OR canonical baseline documented |
| P1 TypeScript | New code strict, Platform APIs clean, legacy documented |
| P2 Regression | Critical tests GREEN, failures classified, skip reasons clear |
| P3 CI Routing | Scoped workflows, <5% false blocks |

---

## **Factory Reopening Gate**

**Criteria to resume OS/Product development:**

```text
✅ P0: empty DB → current schema reproducible
✅ P0: Production recovery path verified
✅ P1: no-new-debt enforced for Platform + active Products
✅ P2: BabyCare regression 95%+ PASS (critical modules)
✅ P2: Healthcare/Education/Logistics regression >90% PASS
✅ P3: CI scoped (Beauty PR ≠ partner-applications failure)
✅ Documentation: All accepted debt has ADR + tracking issue

NOT REQUIRED for reopening:
❌ Zero TypeScript errors in legacy code
❌ 100% test coverage
❌ Perfect migration history from 2025
```

**Reopening Decision:**  
→ When hardening delivers **"unknown state" → "documented, controlled, non-blocking"**  
→ NOT when "everything is perfect"

---

## **Current Status**

```text
════════════════════════════════════════════════
BELLA PLATFORM HARDENING STATUS
════════════════════════════════════════════════

P0 Migration:       ⏸️ BLOCKED at B0 (Production schema)
P1 TypeScript:      ⏸️ NOT STARTED
P2 Regression:      ⏸️ NOT STARTED
P3 CI Routing:      ⏸️ NOT STARTED

Next Action:        Obtain Production schema access
                    OR proceed with P0 M1 (Migration Census)
                    
Factory Status:     🔴 PAUSED (Hardening in progress)
```

---

## **Documents**

**Strategy:**
- `docs/platform/BELLA_PLATFORM_HARDENING.md` (this document)

**P0 Migration:**
- `docs/platform/MIGRATION_REPRODUCIBILITY_P0.md` (tracking)
- `docs/platform/P0_BASELINE_RECONCILIATION_B0.md` (B0 evidence)
- `docs/platform/P0_INVENTORY_ITEMS_FORENSIC_REPORT.md` (forensics)

**To Be Created:**
- `docs/platform/P0_MIGRATION_CENSUS_M1.md`
- `docs/platform/TYPESCRIPT_DEBT_P1.md`
- `docs/platform/P1_TYPESCRIPT_CENSUS_T1.md`
- `docs/platform/REGRESSION_DEBT_P2.md`
- `docs/platform/P2_REGRESSION_CENSUS_R1.md`
- `docs/platform/CI_SCOPE_ROUTING_P3.md`
- `docs/platform/P3_CI_CENSUS_C1.md`

**ADRs:**
- `docs/architecture/adr/ADR-009-migration-history-strategy.md` (TBD)
- `docs/architecture/adr/ADR-010-typescript-governance.md` (TBD)
- `docs/architecture/adr/ADR-011-regression-debt-policy.md` (TBD)
- `docs/architecture/adr/ADR-012-ci-scope-routing.md` (TBD)

---

**Last Updated:** 2026-09-16  
**Status:** STRATEGIC PLAN APPROVED
