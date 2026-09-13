# THEME ARCHITECTURE GUARD - PHASE 1B ROADMAP

**Phase:** 1B (Incremental Violation Cleanup)  
**Status:** Ready to Start  
**Baseline:** 108 BLOCK, 12 WARN  
**Target:** 0 BLOCK, ≤5 WARN  
**Enforcement:** ✅ **NO-NEW-DEBT ACTIVE** (blocks regressions)

---

## 🎯 Phase 1B Goals

1. **Fix 26 BROAD_TENANT_SELECTOR violations** (scoping improvements)
2. **Fix 8 DUPLICATE_VISUAL_OWNER violations** (consolidation)
3. **Fix 74 EXCLUSION_CHAIN_SMELL_BLOCK violations** (incremental tenant-by-tenant)
4. **Browser verify after each batch** (prevent regressions)
5. **Extract semantic tokens organically** (no upfront 50-70 token design)

**Critical Success Factor:** Fix incrementally with browser verification after EACH batch, not all at once.

---

## 📊 Current State

### Violations Breakdown

| Rule | Count | Severity | Effort | Risk |
|------|-------|----------|--------|------|
| BROAD_TENANT_SELECTOR | 26 | BLOCK | 2-3h | Low |
| DUPLICATE_VISUAL_OWNER | 8 | BLOCK | 1-2h | Medium |
| EXCLUSION_CHAIN_SMELL | 74 | BLOCK | 4-5h | High |
| EXCLUSION_CHAIN_SMELL | 12 | WARN | N/A | Low |
| **TOTAL** | **120** | - | **7-10h** | - |

### Metrics Reconciliation

```text
Raw rule hits:               120 (26 + 8 + 86)
Unique BLOCK violations:     108 (26 + 8 + 74)
WARN violations:             12  (EXCLUSION_CHAIN with 2 :not())
Overlap:                     12  (WARN counted in raw but not BLOCK)
```

**Why 108 not 120?**
- EXCLUSION_CHAIN_SMELL has severity logic: `>= 3 :not() → BLOCK`, `2 :not() → WARN`
- 86 total exclusion chains = 74 BLOCK + 12 WARN
- BLOCK total = 26 + 8 + 74 = **108** ✅

---

## 🗺️ Execution Plan

### Step 0: Verify No-New-Debt Enforcement ✅

**Status:** COMPLETE

**Verification:**
```bash
# Should PASS (no change)
npm run theme:guard:diff

# Should show 108 BLOCK baseline
npm run theme:guard
```

**Evidence:** Pre-commit hook blocks new violations, CI workflow blocks PRs with debt increase.

---

### Step 1: Fix BROAD_TENANT_SELECTOR (26 violations)

**Estimated Time:** 2-3 hours  
**Risk:** Low (scoping changes, minimal behavior change)  
**Priority:** HIGH (quick wins, reduces surface area)

#### What to Fix

Tenant selectors targeting global elements without proper scoping:

```css
/* ❌ BEFORE: Broad selector */
[data-tenant="jade_wellness"] body {
  background: #f0fdf4;
}

/* ✅ AFTER: Scoped to layout component */
[data-tenant="jade_wellness"] .app-layout {
  background: #f0fdf4;
}
```

#### Files to Modify

- `src/app/globals.css` (lines 1054-4049)
  - All `[data-tenant="*"] body` selectors
  - All `[data-tenant="*"] html` selectors
  - All `[data-tenant="*"] *` universal selectors

#### Fix Strategy

1. **Scope to layout components:**
   - `.app-layout` (main container)
   - `.page-container` (page wrapper)
   - `.content-wrapper` (content area)

2. **Avoid global targets:**
   - No `body`, `html`, `*` selectors
   - No descendant combinators without intermediate class

3. **Test each tenant:**
   ```bash
   # After fixing each tenant
   npm run theme:guard
   npm run dev
   # Manual browser test: switch tenants, verify no visual regression
   ```

#### Browser Verification Checklist

- [ ] Jade Wellness: sidebar, cards, buttons render correctly
- [ ] Luxury Navy: colors distinct from jade
- [ ] Ocean Clean: no color leakage from previous tenants
- [ ] Beauty Spa: active state remains distinct
- [ ] Switch A→B→C→A: final state matches initial

#### Success Criteria

```bash
npm run theme:guard:diff
# Expected: BROAD_TENANT_SELECTOR reduced from 26 to 0
# Other violations unchanged
```

---

### Step 2: Fix DUPLICATE_VISUAL_OWNER (8 violations)

**Estimated Time:** 1-2 hours  
**Risk:** Medium (requires manual review of ownership)  
**Priority:** MEDIUM (architectural clarity)

#### What to Fix

Multiple definitions controlling the same visual state:

```css
/* ❌ BEFORE: Duplicate ownership */
.sidebar-item.active {
  background: emerald-500;
}

.sidebar-item[aria-current="page"] {
  background: emerald-600; /* Conflict! */
}

/* ✅ AFTER: Single source of truth */
.sidebar-item.active,
.sidebar-item[aria-current="page"] {
  background: var(--sidebar-item-active-bg);
}
```

#### Fix Strategy

1. **Identify conflicting selectors:**
   ```bash
   npm run theme:guard | grep "DUPLICATE_VISUAL_OWNER" -A 5
   ```

2. **Choose canonical state:**
   - Prefer semantic class (`.active`) over attribute selector
   - Prefer BEM naming over nested selectors

3. **Consolidate rules:**
   - Merge duplicate definitions
   - Extract shared values to CSS variables (semantic tokens)

4. **Verify specificity:**
   - Ensure active state always wins over hover
   - Test with browser DevTools

#### Browser Verification Checklist

- [ ] Active sidebar item visually distinct from hover
- [ ] Hover on active item does not override active state
- [ ] All tenants show correct active/hover hierarchy
- [ ] Dark mode preserves state distinction

#### Success Criteria

```bash
npm run theme:guard:diff
# Expected: DUPLICATE_VISUAL_OWNER reduced from 8 to 0
# BROAD_TENANT_SELECTOR remains 0
```

---

### Step 3: Fix EXCLUSION_CHAIN_SMELL (74 BLOCK, incremental)

**Estimated Time:** 4-5 hours (spread across multiple sessions)  
**Risk:** HIGH (complex refactoring, high regression potential)  
**Priority:** CRITICAL (biggest technical debt)

#### ⚠️ CRITICAL: Incremental Migration Strategy

**DO NOT** fix all 86 exclusion chains at once!

**Migration Order:** One tenant/preset per batch

```text
Batch 1: jade_wellness
  → Fix exclusion chains
  → Run guard
  → Browser verify
  → Commit & freeze

Batch 2: slate_minimal
  → Fix exclusion chains
  → Run guard
  → Browser verify
  → Commit & freeze

Batch 3: luxury_navy
  → ...

Batch 4: beauty_spa
  → ...

Batch 5: industrial_cleaning
  → ...
```

**Rationale:** If regression occurs, we know exactly which batch caused it.

#### What to Fix

Chained `:not()` selectors (3+ chains = code smell):

```css
/* ❌ BEFORE: 5-chain exclusion smell */
[data-tenant="jade_wellness"]:not([data-tenant="luxury_navy"]):not([data-tenant="ocean_clean"]):not([data-tenant="beauty_spa"]):not([data-tenant="industrial_cleaning"]) .sidebar {
  background: linear-gradient(180deg, #064e3b 0%, #047857 100%);
}

/* ✅ AFTER: Positive definition */
[data-tenant="jade_wellness"] .sidebar {
  background: var(--sidebar-bg-jade);
}
```

#### Fix Strategy (Per Tenant)

1. **Extract semantic tokens:**
   ```css
   /* jade_wellness theme tokens */
   [data-tenant="jade_wellness"] {
     --sidebar-bg: linear-gradient(180deg, #064e3b 0%, #047857 100%);
     --sidebar-text: #f0fdf4;
     --sidebar-item-active-bg: rgba(5, 150, 105, 0.15);
     --sidebar-item-active-text: #ffffff;
     --sidebar-item-active-icon: #fbbf24;
     --sidebar-item-hover-bg: rgba(255, 255, 255, 0.1);
   }
   ```

2. **Replace exclusion chains with positive selectors:**
   ```css
   [data-tenant="jade_wellness"] .sidebar {
     background: var(--sidebar-bg);
     color: var(--sidebar-text);
   }
   
   [data-tenant="jade_wellness"] .sidebar-item.active {
     background: var(--sidebar-item-active-bg);
     color: var(--sidebar-item-active-text);
   }
   ```

3. **Verify no leakage:**
   ```bash
   npm run theme:guard:diff
   # Should not increase violations
   ```

4. **Browser test:**
   - Switch from jade → luxury → jade
   - Verify colors remain distinct
   - Check active/hover states
   - Test dark mode

5. **Commit & lock:**
   ```bash
   git add src/app/globals.css
   git commit -m "fix(theme): migrate jade_wellness exclusion chains to semantic tokens"
   npm run theme:guard:update-baseline
   ```

#### Semantic Token Naming (Organic Growth)

**Start with ~15 sidebar tokens (per tenant):**

```css
--sidebar-bg
--sidebar-text
--sidebar-muted-text

--sidebar-item-bg
--sidebar-item-text

--sidebar-item-hover-bg
--sidebar-item-hover-text

--sidebar-item-active-bg
--sidebar-item-active-text
--sidebar-item-active-border
--sidebar-item-active-icon

--sidebar-section-text

--sidebar-profile-bg
--sidebar-profile-text
```

**Expand tokens as migration reveals needs:**
- Card tokens (--card-bg, --card-border, --card-shadow)
- Button tokens (--btn-primary-bg, --btn-primary-hover)
- Table tokens (--table-header-bg, --table-row-hover)

**Do NOT design 50-70 token system upfront!** Let migration evidence drive token taxonomy.

#### Browser Verification Checklist (Per Tenant)

- [ ] Sidebar colors render correctly
- [ ] Active state distinct from hover
- [ ] Switching tenants shows no stale CSS
- [ ] Dark mode works
- [ ] Cards/buttons/tables use correct colors
- [ ] No console errors or warnings

#### Success Criteria (Final)

```bash
npm run theme:guard
# Expected: 0 BLOCK, ≤5 WARN
```

---

## 🧪 Testing Strategy

### Automated Tests

1. **Guard verification:**
   ```bash
   npm run theme:guard:diff
   # Exit 0 = no new debt
   # Exit 1 = new violations (BLOCK)
   # Exit 2 = improvement detected
   ```

2. **Regression tests:**
   ```bash
   npm test -- src/__tests__/theme-guard-diff.test.ts
   # 10/10 must pass
   ```

### Manual Browser Testing

**Use:** `scripts/architecture/browser-verification-matrix.md`

**Test Matrix:**
- 5 test scenarios × 4 browsers × 4 viewports = 80 test cases
- Estimated time: 2-3 hours for full coverage

**Critical Paths:**
1. Tenant switching consistency (A→B→C→A)
2. Active vs hover distinction
3. Component isolation (modals, popovers)
4. Dark mode consistency
5. Cross-component leakage

---

## 📈 Progress Tracking

### Definition of Done (Per Step)

- [ ] Violation count reduced (confirmed by `npm run theme:guard:diff`)
- [ ] No new violations introduced (exit code 0)
- [ ] Browser verification passed (no visual regressions)
- [ ] Changes committed with descriptive message
- [ ] Baseline updated if justified (`npm run theme:guard:update-baseline`)

### Phase 1B Completion Criteria

- [ ] BROAD_TENANT_SELECTOR: 26 → 0
- [ ] DUPLICATE_VISUAL_OWNER: 8 → 0
- [ ] EXCLUSION_CHAIN_SMELL_BLOCK: 74 → 0
- [ ] Total BLOCK: 108 → 0
- [ ] Browser verification: All 5 scenarios PASS
- [ ] CI/CD: Full blocking mode enabled (no legacy allowance)

---

## 🚀 Commands Reference

```bash
# Check current violations
npm run theme:guard

# Check against baseline (no-new-debt)
npm run theme:guard:diff

# Update baseline after justified fixes
npm run theme:guard:update-baseline

# Run diff tests
npm test -- src/__tests__/theme-guard-diff.test.ts

# Development server (for browser testing)
npm run dev

# CI verification (local simulation)
.husky/pre-commit
```

---

## 📚 Documentation Reference

- [Guard README](../scripts/architecture/THEME_GUARD_README.md) - Fix guidelines
- [Baseline Report](./THEME_GUARD_BASELINE_REPORT.md) - Initial state
- [Progress Report](./THEME_GUARD_PROGRESS_REPORT.md) - Current state
- [Final Summary](./THEME_GUARD_FINAL_SUMMARY.md) - Phase 1A recap
- [Browser Verification](../scripts/architecture/browser-verification-matrix.md) - Test plan
- [CI Guide](../scripts/architecture/THEME_GUARD_CI.md) - Workflow docs

---

## ⚠️ Risk Mitigation

### High-Risk Operations

1. **Bulk exclusion chain refactoring:**
   - **Mitigation:** Migrate one tenant at a time, browser verify after each
   - **Rollback:** Git revert specific tenant commit

2. **Semantic token naming conflicts:**
   - **Mitigation:** Use tenant-scoped token names initially
   - **Example:** `--jade-sidebar-bg` not `--sidebar-bg` (if conflicts arise)

3. **Specificity regressions:**
   - **Mitigation:** Test active/hover hierarchy after each fix
   - **Tool:** Browser DevTools > Computed styles

### Rollback Strategy

```bash
# If regression detected
git log --oneline -10
# Find problematic commit
git revert <commit-sha>
npm run theme:guard:update-baseline
```

---

## 🎯 Success Metrics

| Metric | Start (1A) | Target (1B) |
|--------|------------|-------------|
| BLOCK violations | 108 | 0 |
| WARN violations | 12 | ≤5 |
| Test coverage | 85% | 100% |
| Browser tests | Planned | Executed |
| Enforcement mode | No-new-debt | Full blocking |

---

## 📅 Estimated Timeline

**Conservative Estimate:**
- Step 1 (Broad selectors): 1 session (2-3 hours)
- Step 2 (Duplicates): 1 session (1-2 hours)
- Step 3 (Exclusion chains): 3-5 sessions (4-5 hours total)
- Browser verification: 1 session (2-3 hours)

**Total:** 5-8 sessions over 1-2 weeks

**Aggressive Estimate:** 2-3 days of focused work

---

## ✅ Next Action

**Start Phase 1B.1:**
```bash
# Fix first BROAD_TENANT_SELECTOR violation
npm run theme:guard | head -50
# Follow fix guidelines in THEME_GUARD_README.md
# Test locally
npm run dev
# Commit
git add src/app/globals.css
git commit -m "fix(theme): scope jade_wellness body selector to .app-layout"
# Verify no new debt
npm run theme:guard:diff
```

---

**Phase 1B Status:** 🟡 READY TO START  
**Enforcement Status:** ✅ NO-NEW-DEBT ACTIVE  
**Blocker:** None  
**Owner:** Development Team
