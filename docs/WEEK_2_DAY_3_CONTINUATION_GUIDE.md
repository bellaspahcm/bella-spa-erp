# WEEK 2 DAY 3: CONTINUATION GUIDE
**Date:** August 25-26, 2026  
**Current Status:** 40% Track A, Design Complete Track B  
**Purpose:** Quick reference for continuing Day 3 work

---

## 🎯 MISSION

**Close P1 violation + Automate Constitution with FULL EVIDENCE**

**Not Done Until:**
- ✅ 4/4 hooks migrated
- ✅ 52/52 Healthcare regression PASS
- ✅ 0 direct engine imports verified
- ✅ ESLint/hooks/CI implemented
- ✅ **Negative tests show violations blocked**
- ✅ All evidence documented

---

## 📋 IMMEDIATE NEXT STEPS

### Step 1: Complete Hook Migrations (3 hours)

**Files to Migrate:**
1. `src/products/bella-hospital/hooks/use-cds-engine.ts`
2. `src/products/bella-hospital/hooks/use-nursing-engine.ts`
3. `src/products/bella-hospital/hooks/use-order-engine.ts`

**Pattern (from use-bed-engine.ts):**

**Remove:**
```typescript
import { XxxEngineService } from '@/platform/healthcare/engines/xxx-engine';
const engine = new XxxEngineService(supabase);
```

**Add:**
```typescript
import { getHealthcareService } from '@/platform/healthcare';
import type { XxxEngineContract } from '@/platform/healthcare/contracts/xxx-engine.contract';

const engine = useMemo(
  () => getHealthcareService<XxxEngineContract>('xxx-engine', supabase),
  [supabase]
);
```

---

### Step 2: Run Regression Tests (1 hour)

**Command:**
```bash
npm run test:healthcare
```

**Expected:**
- 52/52 test suites PASS
- 504/504 tests PASS
- 0 failures

**If Failures:**
1. Check Service Locator implementation
2. Verify engine initialization
3. Check contract type compatibility
4. Debug specific failing tests

---

### Step 3: Verify Zero Violations (15 minutes)

**Command:**
```powershell
Get-ChildItem -Recurse -File "src/products" -Include "*.ts","*.tsx" | 
  Select-String "from.*@/platform.*engines/" | 
  Measure-Object
```

**Expected:** Count = 0

**If Not Zero:**
1. List remaining violations
2. Identify files
3. Migrate remaining hooks
4. Re-run scan

---

### Step 4: Implement ESLint Rules (1 hour)

**Create:** `.eslintrc.architecture.js`

**Rules to Add:**
```javascript
module.exports = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/platform/*/engines/*'],
            message: 'Products must use getHealthcareService(), not direct engine imports',
          },
        ],
      },
    ],
  },
  overrides: [
    {
      files: ['src/foundation/**/*', 'src/core/**/*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: ['@/platform/healthcare/*', '@/platform/finance/*'],
            message: 'Core cannot import from Kernels',
          },
        ],
      },
    },
  ],
};
```

**Test:**
```bash
npm run lint
```

---

### Step 5: Install Pre-Commit Hooks (30 minutes)

**Commands:**
```bash
npm install --save-dev husky lint-staged
npx husky install
npx husky add .husky/pre-commit "npx lint-staged"
```

**Configure:** `package.json`
```json
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "npm run type-check"
    ]
  }
}
```

---

### Step 6: Create CI/CD Workflow (1 hour)

**Create:** `.github/workflows/architecture-guard.yml`

```yaml
name: Architecture Guard

on:
  pull_request:
    branches: [main, develop]

jobs:
  architecture:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install
        run: npm ci
      
      - name: Lint (Architecture Rules)
        run: npm run lint
      
      - name: Healthcare Regression
        run: npm run test:healthcare
      
      - name: Check Direct Imports
        run: |
          if grep -r "from.*@/platform.*engines/" src/products/; then
            echo "❌ Direct engine imports found"
            exit 1
          fi
```

---

### Step 7: CRITICAL - Negative Tests (2 hours)

**Test 1: Direct Engine Import**

**Create violation:**
```typescript
// src/products/bella-hospital/test-violation.ts
import { BedEngineService } from '@/platform/healthcare/engines/bed-engine'; // Intentional violation
```

**Commit:**
```bash
git add src/products/bella-hospital/test-violation.ts
git commit -m "Test: direct engine import"
```

**Expected:**
- Pre-commit hook FAILS
- ESLint error shown
- Commit BLOCKED

**Capture:**
- Screenshot of error
- Error message text
- Copy to evidence doc

**Revert:**
```bash
git reset HEAD~1
rm src/products/bella-hospital/test-violation.ts
```

---

**Test 2: Core → Kernel Import**

**Create violation:**
```typescript
// src/core/test-violation.ts
import { BedEngineService } from '@/platform/healthcare/engines/bed-engine';
```

**Expected:** ESLint blocks, pre-commit fails

---

**Test 3: PR with Violation**

**Create branch:**
```bash
git checkout -b test/architecture-violation
```

**Add violation + push:**
```bash
# Add violation file
git add .
git commit -m "Test: architecture violation"
git push origin test/architecture-violation
```

**Create PR on GitHub**

**Expected:**
- CI/CD workflow runs
- Architecture Guard job FAILS
- PR shows red X
- Cannot merge

**Capture:**
- GitHub Actions log
- PR screenshot
- Failure message

**Clean up:**
```bash
git checkout main
git branch -D test/architecture-violation
git push origin --delete test/architecture-violation
```

---

### Step 8: Document Evidence (1 hour)

**Update:** `docs/WEEK_2_DAY_3_TRACK_A_EVIDENCE.md`

**Add:**
- Migration completion report (4/4 hooks)
- Regression test results (52/52 PASS)
- Zero-import verification (scan output)
- TypeScript compilation (no errors)

**Update:** `docs/WEEK_2_DAY_3_TRACK_B_EVIDENCE.md` (create new)

**Add:**
- ESLint config file
- Pre-commit hook setup
- CI/CD workflow file
- **Negative test results (logs + screenshots)**

**Update:** `docs/WEEK_2_DAY_2_ARCHITECTURE_INTEGRITY_AUDIT.md`

**Add Addendum:**
```markdown
## ADDENDUM: P1 CLOSURE (Day 3)

**Date:** August 26, 2026

### Remediation Results

| Metric | Before | After | Evidence |
|--------|--------|-------|----------|
| Direct Engine Imports | 4 files | 0 files | Scan output ✅ |
| Service Locator | No | Yes | 201 lines code ✅ |
| Hooks Migrated | 0/4 | 4/4 | Git diff ✅ |
| Regression Tests | N/A | 52/52 PASS | Test results ✅ |
| Enforcement | Manual | Automated | Negative tests ✅ |

**Status:** ✅ P1 CLOSED - Evidence complete
```

---

## ✅ COMPLETION CHECKLIST

### Track A: P1 Closure

- [ ] use-cds-engine.ts migrated
- [ ] use-nursing-engine.ts migrated
- [ ] use-order-engine.ts migrated
- [ ] Healthcare regression: 52/52 PASS
- [ ] Direct import scan: 0 violations
- [ ] TypeScript compile: 0 errors
- [ ] Evidence documented

### Track B: Enforcement

- [ ] ESLint rules created + tested
- [ ] Pre-commit hooks installed + tested
- [ ] CI/CD workflow created + tested
- [ ] Negative Test 1: Pre-commit blocks (evidence captured)
- [ ] Negative Test 2: ESLint detects Core→Kernel (evidence captured)
- [ ] Negative Test 3: CI blocks PR (evidence captured)
- [ ] Evidence documented

### Evidence Package

- [ ] Track A evidence complete
- [ ] Track B evidence complete
- [ ] Day 2 audit updated (P1 → 0 addendum)
- [ ] All screenshots/logs collected

---

## 🎯 DEFINITION OF DONE

**Day 3 is complete ONLY when:**

1. ✅ All 4 hooks migrated (code changes in git)
2. ✅ Healthcare regression PASS (test output saved)
3. ✅ Zero direct imports (scan output saved)
4. ✅ ESLint rules active (config file in git)
5. ✅ Pre-commit hooks active (hook files in git)
6. ✅ CI/CD pipeline active (workflow file in git)
7. ✅ **Negative tests executed (logs + screenshots saved)**
8. ✅ All evidence documented (3 updated docs)

**Current:** 1/8 (Service Locator + 1 hook + design)

---

## 🔥 CRITICAL REMINDER

### The Two-Sided Evidence Requirement

**Not Enough:**
- ✅ Code passes CI

**Required:**
- ✅ Code passes CI
- ✅ **Violation blocked by CI (with log proof)**

**Why:** Proves enforcement is real, not theoretical

---

## 📊 TIME ESTIMATE

| Task | Time | Total |
|------|------|-------|
| Migrate 3 hooks | 3h | 3h |
| Run regression | 1h | 4h |
| Verify zero imports | 0.25h | 4.25h |
| Implement ESLint | 1h | 5.25h |
| Install hooks | 0.5h | 5.75h |
| Create CI/CD | 1h | 6.75h |
| **Negative tests** | 2h | 8.75h |
| Document evidence | 1h | 9.75h |

**Total:** ~10 hours (can span 2 days)

---

## ⚠️ RISKS & MITIGATIONS

**Risk 1: Regression Failures**
- Mitigation: Service Locator matches engine API
- Contingency: Debug failures, adjust Service Locator

**Risk 2: Negative Tests Don't Block**
- Mitigation: Test ESLint rules before CI integration
- Contingency: Fix rules until violations ARE blocked

**Risk 3: Timeline Extension**
- Mitigation: Quality > Speed (acceptable +1 day)
- Contingency: Communicate to stakeholders

---

## 🎯 SUCCESS CRITERIA

**Day 3 successful when:**

1. **P1 Closed:**
   - 4/4 hooks use Service Locator
   - 0 direct engine imports
   - All tests pass

2. **Enforcement Active:**
   - ESLint blocks violations
   - Pre-commit blocks commits
   - CI blocks PRs

3. **Evidence Complete:**
   - Positive tests documented
   - **Negative tests documented**
   - Day 2 audit updated

**Then:** Move to Day 4 (Evidence Package)

---

**Prepared By:** Platform Architecture Team  
**Date:** August 25, 2026  
**Purpose:** Quick continuation reference  
**Next:** Execute remaining work with full evidence collection

---

**Remember: Quality of evidence > Speed of completion**
