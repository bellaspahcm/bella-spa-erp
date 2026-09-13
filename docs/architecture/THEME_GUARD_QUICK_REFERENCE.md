# THEME GUARD - QUICK REFERENCE

**Status:** ✅ NO-NEW-DEBT ENFORCEMENT ACTIVE  
**Baseline:** 108 BLOCK (legacy), 12 WARN  
**Policy:** New violations BLOCKED, legacy violations temporarily allowed

---

## 🚨 Common Scenarios

### "My commit is blocked by theme guard"

```bash
# See what violations you introduced
npm run theme:guard

# Check against baseline
npm run theme:guard:diff

# If you see "NEW DEBT DETECTED":
# → You introduced new violations
# → Fix them before committing
# → See fix guidelines below
```

### "I fixed violations but baseline won't update"

```bash
# Only update baseline if justified (e.g., after bulk cleanup)
npm run theme:guard:update-baseline

# Generally you should NOT update baseline for individual commits
# Let the no-new-debt gate track your improvements automatically
```

### "I need to add tenant-specific styles"

```css
/* ✅ CORRECT: Use tenant-scoped semantic tokens */
[data-tenant="my_tenant"] {
  --sidebar-bg: #custom-color;
}

[data-tenant="my_tenant"] .sidebar {
  background: var(--sidebar-bg);
}

/* ❌ WRONG: Broad selector */
[data-tenant="my_tenant"] body {
  background: #custom-color;
}

/* ❌ WRONG: Exclusion chain */
[data-tenant="my_tenant"]:not([data-tenant="other"]) .sidebar {
  background: #custom-color;
}
```

---

## 📋 Rules at a Glance

| Rule | Severity | What It Catches | Quick Fix |
|------|----------|-----------------|-----------|
| **TENANT_COLOR_IN_SHARED_JSX** | BLOCK | Hardcoded tenant colors in components | Use semantic class instead |
| **DUPLICATE_VISUAL_OWNER** | BLOCK | Multiple definitions for same state | Consolidate into single rule |
| **HOVER_ACTIVE_LEAKAGE** | BLOCK | Hover overriding active state | Increase active specificity |
| **BROAD_TENANT_SELECTOR** | BLOCK | Tenant selector targeting `body`/`html` | Scope to component class |
| **EXCLUSION_CHAIN_SMELL** | BLOCK | 3+ chained `:not()` selectors | Use positive tenant selector |
| **ACCIDENTAL_INHERITANCE** | WARN | Visual styles outside tenant scope | Review if intentional |

---

## 🔧 Quick Fixes

### Broad Tenant Selector

```css
/* ❌ BEFORE */
[data-tenant="jade_wellness"] body {
  background: #f0fdf4;
}

/* ✅ AFTER */
[data-tenant="jade_wellness"] .app-layout {
  background: #f0fdf4;
}
```

### Exclusion Chain

```css
/* ❌ BEFORE */
[data-tenant="jade"]:not([data-tenant="luxury"]):not([data-tenant="ocean"]) .sidebar {
  background: emerald-500;
}

/* ✅ AFTER */
[data-tenant="jade"] .sidebar {
  background: var(--sidebar-bg-jade);
}
```

### Duplicate Visual Owner

```css
/* ❌ BEFORE */
.sidebar-item.active { background: emerald-500; }
.sidebar-item[aria-current="page"] { background: emerald-600; } /* Conflict! */

/* ✅ AFTER */
.sidebar-item.active,
.sidebar-item[aria-current="page"] {
  background: var(--sidebar-item-active-bg);
}
```

### Hover/Active Leakage

```css
/* ❌ BEFORE */
.sidebar-item { background: transparent; }
.sidebar-item:hover { background: white; } /* Can override active! */
.sidebar-item.active { background: emerald; }

/* ✅ AFTER */
.sidebar-item { background: transparent; }
.sidebar-item.active { background: emerald; }
.sidebar-item:not(.active):hover { background: white; }
```

### Tenant Color in JSX

```tsx
{/* ❌ BEFORE */}
<button className="bg-emerald-500">Active</button>

{/* ✅ AFTER */}
<button className="sidebar-item-active">Active</button>
```

---

## 🧪 Testing Workflow

```bash
# 1. Make your changes
vim src/app/globals.css

# 2. Check for violations
npm run theme:guard

# 3. Check against baseline (no-new-debt)
npm run theme:guard:diff

# 4. Test in browser
npm run dev
# Manual: Switch tenants, verify no visual regression

# 5. Commit (hook will auto-verify)
git add src/app/globals.css
git commit -m "fix(theme): improve tenant scoping"
```

---

## 📊 Understanding Exit Codes

```bash
npm run theme:guard:diff

# Exit 0 = PASS
# → No new violations introduced
# → You can commit safely

# Exit 1 = BLOCK
# → New violations or count increased
# → Fix violations before committing

# Exit 2 = IMPROVEMENT
# → Violations reduced
# → Great work! Consider updating baseline
```

---

## 🆘 Getting Help

**Detailed docs:**
- [Theme Guard README](../scripts/architecture/THEME_GUARD_README.md)
- [Fix Guidelines](./THEME_GUARD_PROGRESS_REPORT.md)
- [Phase 1B Roadmap](./THEME_GUARD_PHASE_1B_ROADMAP.md)

**Commands:**
```bash
# Verbose output with suggestions
npm run theme:guard:verbose

# Run tests
npm test -- src/__tests__/theme-guard-diff.test.ts

# Check CI workflow
cat .github/workflows/theme-guard.yml
```

**Common Questions:**
- "Why 108 not 120?" → See metrics reconciliation in FINAL_SUMMARY.md
- "Can I skip the guard?" → No, enforcement is active (pre-commit blocks)
- "How to fix all violations?" → See Phase 1B roadmap (incremental approach)

---

## 🎯 Current Status

```bash
npm run theme:guard:diff
```

**Baseline Violations (Allowed):**
- 26 BROAD_TENANT_SELECTOR
- 8 DUPLICATE_VISUAL_OWNER
- 74 EXCLUSION_CHAIN_SMELL (BLOCK)
- 12 EXCLUSION_CHAIN_SMELL (WARN)

**Your Goal:** Don't add to these numbers!

**Team Goal:** Reduce to zero through Phase 1B

---

## ⚡ TL;DR

1. **Guard blocks new violations** (no-new-debt policy)
2. **108 legacy violations allowed** (temporary baseline)
3. **Run `npm run theme:guard:diff`** before committing
4. **Use semantic tokens** for tenant-specific styles
5. **Scope to components**, not `body`/`html`
6. **No exclusion chains** (3+ `:not()`)
7. **Browser test** after CSS changes

---

**Last Updated:** 2026-09-10  
**Phase:** 1B Ready  
**Enforcement:** ACTIVE
