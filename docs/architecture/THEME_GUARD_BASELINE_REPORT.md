# THEME ARCHITECTURE GUARD - BASELINE REPORT

**Date:** 2026-09-10  
**Guard Version:** 1.0.0  
**Status:** INITIAL BASELINE (Before Phase 1 Fixes)

---

## 📊 Summary

| Metric | Count |
|--------|-------|
| **Files Scanned** | 30 |
| **BLOCK Violations** | 132 |
| **WARN Violations** | 12 |
| **Total Issues** | 144 |

**Verdict:** ❌ **FAILED** - Must fix BLOCK violations before commit

---

## 🔴 BLOCK Violations Breakdown

### By Rule Type

| Rule | Count | Severity | Description |
|------|-------|----------|-------------|
| **DUPLICATE_VISUAL_OWNER** | 8 | BLOCK | Multiple conflicting definitions for same component state |
| **HOVER_ACTIVE_LEAKAGE** | 21 | BLOCK | Hover selectors can override active states |
| **BROAD_TENANT_SELECTOR** | 85 | BLOCK | Tenant selectors target global elements without component scope |
| **EXCLUSION_CHAIN_SMELL** | 15 | BLOCK | 3+ chained `:not()` selectors (architectural smell) |
| **TENANT_COLOR_IN_SHARED_JSX** | 3 | BLOCK | Shared components contain tenant-specific color utilities |

### Top Offenders

#### 1. BROAD_TENANT_SELECTOR (85 violations)
Tenant scopes targeting `<div>`, `<button>`, `<span>`, `<svg>`, `<a>` without component classes.

**Example:**
```css
/* ❌ Affects ALL divs in app */
html[data-tenant-module="pending"] div[class*="bg-white/30"] {
  background: ...;
}
```

**Impact:** HIGH - Global element styling causes CSS cascade leakage.

---

#### 2. HOVER_ACTIVE_LEAKAGE (21 violations)
`.beauty-erp-nav-item` hover states detected across multiple tenant presets without proper active exclusion.

**Affected Presets:**
- `pending` (3 violations)
- `jade_wellness` (2 violations)
- `luxury_navy` (2 violations)
- `ocean_clean` (2 violations)
- `graphite_luxe` (2 violations)
- `bella_rose` (2 violations)
- `slate_minimal` (2 violations)
- `bella_healthcare` (2 violations)
- `beauty_spa` (2 violations)
- `industrial_cleaning` (2 violations)

**Example:**
```css
/* ❌ Hover will override active styling */
html[data-tenant-brand-preset="jade_wellness"] .beauty-erp-nav-item-active:hover {
  /* This is already active, but hover triggers anyway */
}
```

**Impact:** MEDIUM - Active sidebar items show incorrect visual state on hover.

---

#### 3. EXCLUSION_CHAIN_SMELL (15 violations, BLOCK-level)

**5+ chained :not() found:**
```css
/* ❌ BLOCK: 5 exclusions for real_estate preset */
html[data-tenant-module="real_estate"]
  :not([data-tenant-brand-preset="jade_wellness"])
  :not([data-tenant-brand-preset="ocean_clean"])
  :not([data-tenant-brand-preset="graphite_luxe"])
  :not([data-tenant-brand-preset="bella_rose"])
  :not([data-tenant-brand-preset="slate_minimal"]) {
  /* ... */
}
```

**12+ chained :not() found (worst case):**
```css
/* ❌ BLOCK: 12 exclusions in beauty_spa luxury-card-pink */
html[data-tenant-module="beauty_spa"] .luxury-card-pink *
  :not(.bg-white)
  :not(.bg-white *)
  :not([class*="bg-white"])
  :not([class*="bg-primary"])
  /* ... 8 more :not() ... */
```

**Impact:** CRITICAL - Each new tenant requires modifying this selector. Maintenance nightmare.

---

#### 4. DUPLICATE_VISUAL_OWNER (8 violations)

**Worst Offender:** `.beauty-erp-nav-item-active`
- **95 conflicting definitions** across different tenant scopes
- Each tenant defines `background`, `color`, `border` multiple times

**Example:**
```css
/* All of these define visual styles for same state */
html[data-tenant-module="pending"] .beauty-erp-nav-item-active { ... }
html[data-tenant-brand-preset="jade_wellness"] .beauty-erp-nav-item-active { ... }
html[data-tenant-brand-preset="luxury_navy"] .beauty-erp-nav-item-active { ... }
/* ... 92 more ... */
```

**Note:** This is partially expected (each tenant should define its own styles), but guard flags it because some definitions are outside tenant scope or have conflicting selectors like `.beauty-erp-nav-item.active` vs `.beauty-erp-nav-item-active`.

**Impact:** MEDIUM - False positive in some cases, but indicates inconsistent state naming.

---

#### 5. TENANT_COLOR_IN_SHARED_JSX (3 violations)

**Files:**
1. `src/components/ui/BeautySpaSelect.tsx:86`
   - `className="text-emerald-600"` (tenant-specific color)
   
2. `src/components/ui/CurrencyInput.stories.tsx:101`
   - `className="text-emerald-600"`
   
3. `src/components/ui/CurrencyInput.stories.tsx:115`
   - `className="text-rose-600"`

**Impact:** LOW - Only 3 instances found, but these are in shared UI components. Must use semantic classes instead.

---

## ⚠️  WARN Violations (12 total)

All WARN violations are **2 chained :not() selectors** (below BLOCK threshold of 3+).

**Examples:**
```css
/* ⚠️  WARN: Moving toward anti-pattern */
.beauty-erp-nav-item-active:not(.bg-white):not([class*="bg-white"]) { ... }
```

**Impact:** LOW - Not blocking commit, but should be reviewed during Phase 1 cleanup.

---

## 📋 Phase 1 Fix Priority

### Priority 1: BROAD_TENANT_SELECTOR (85 violations)
- **Action:** Scope all tenant selectors to component classes
- **Estimated Effort:** 2-3 hours
- **Risk:** Medium (need to verify no visual regression)

### Priority 2: HOVER_ACTIVE_LEAKAGE (21 violations)
- **Action:** Fix `.beauty-erp-nav-item-active:hover` detection logic
- **Estimated Effort:** 1 hour
- **Risk:** Low (false positives due to guard logic)

### Priority 3: EXCLUSION_CHAIN_SMELL (15 BLOCK violations)
- **Action:** Refactor `real_estate` and `beauty_spa` selectors
- **Estimated Effort:** 2-3 hours
- **Risk:** High (affects multiple tenants)

### Priority 4: TENANT_COLOR_IN_SHARED_JSX (3 violations)
- **Action:** Replace tenant colors with semantic classes
- **Estimated Effort:** 15 minutes
- **Risk:** Low (only 3 instances)

### Priority 5: DUPLICATE_VISUAL_OWNER (8 violations)
- **Action:** Review and consolidate state definitions
- **Estimated Effort:** 1-2 hours
- **Risk:** Medium (need to preserve tenant visual identity)

---

## 🎯 Success Criteria (Post-Fix)

- ✅ BLOCK violations: 132 → **0**
- ✅ WARN violations: 12 → **≤ 5** (some may be acceptable)
- ✅ All tenant presets maintain visual identity
- ✅ Active state always visually distinct from hover
- ✅ No CSS leakage when switching tenants
- ✅ Browser verification matrix passes

---

## 🚀 Next Steps

1. ✅ **Task #1 Complete:** Guard created with test fixtures
2. 🔄 **Task #2 In Progress:** Baseline report documented
3. 🔜 **Task #3:** Fix sidebar component (JSX + CSS)
4. 🔜 **Task #4:** Fix broad selectors + exclusion chains
5. 🔜 **Task #5:** Re-run guard and verify zero violations
6. 🔜 **Task #6:** Browser verification matrix
7. 🔜 **Task #7:** Integrate into Git pre-commit + CI

---

## 📚 References

- **Guard Script:** `scripts/architecture/theme-guard.ts`
- **Guard README:** `scripts/architecture/THEME_GUARD_README.md`
- **Test Fixtures:** `scripts/architecture/__tests__/theme-guard.fixtures.ts`
- **Architecture Doc:** `docs/architecture/ARCHITECTURE_GATE_RESULT_TENANT_THEME_ISOLATION.md`

---

**Prepared by:** Theme Architecture Guard v1.0.0  
**Baseline Status:** DOCUMENTED  
**Ready for Phase 1 Fixes:** ✅ YES
