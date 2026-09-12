# BELLA THEME ARCHITECTURE GUARD

Automated enforcement for tenant-safe theme architecture. Prevents CSS leakage between tenant presets through compile-time validation.

## 🎯 Purpose

Each tenant/product can have unique visual design without causing CSS regression in other tenants.

**Problem this solves:**
- Tenant A switches to Tenant B → Tenant A's colors leak into Tenant B UI
- Adding new tenant requires modifying CSS for all previous tenants
- Growing `:not()` exclusion chains make CSS unmaintainable
- Hover states accidentally override active states
- Tenant-specific colors hardcoded into shared components

## 🚫 Enforced Rules

### Rule 1: TENANT_COLOR_IN_SHARED_JSX ⛔ BLOCK

Shared components MUST NOT contain tenant-specific color utilities.

**❌ VIOLATION:**
```tsx
// src/components/ui/sidebar.tsx (SHARED COMPONENT)
export function Sidebar() {
  return (
    <div className="bg-emerald-500 text-white">  {/* ❌ BLOCK */}
      Active
    </div>
  );
}
```

**✅ CORRECT:**
```tsx
// Use semantic class
export function Sidebar() {
  return (
    <div className="sidebar-item-active">  {/* ✅ SEMANTIC */}
      Active
    </div>
  );
}

// Structural utilities are ALLOWED
<div className="p-4 rounded-lg border-2 flex gap-4">  {/* ✅ OK */}
```

---

### Rule 2: DUPLICATE_VISUAL_OWNER ⛔ BLOCK

Each component state MUST have single visual definition (unless tenant-scoped).

**❌ VIOLATION:**
```css
/* globals.css */
.sidebar-item.active {
  background: #10b981;  /* ❌ CONFLICT */
}

.sidebar-item-active {
  background: #3b82f6;  /* ❌ Which one wins? */
}
```

**✅ CORRECT:**
```css
/* Single definition */
.sidebar-item-active {
  background: var(--sidebar-active-bg);  /* ✅ */
}

/* OR: Tenant-scoped definitions (each complete) */
html[data-tenant-brand-preset="jade"] .sidebar-item-active {
  background: #10b981;  /* ✅ Scoped */
}

html[data-tenant-brand-preset="navy"] .sidebar-item-active {
  background: #1e3a8a;  /* ✅ Scoped */
}
```

---

### Rule 3: HOVER_ACTIVE_LEAKAGE ⛔ BLOCK

Hover selectors MUST NOT override active states.

**❌ VIOLATION:**
```css
.sidebar-item:hover {
  background: #e5e7eb;  /* ❌ Will override active! */
}

.sidebar-item-active {
  background: #10b981;
}
/* Problem: Hovering active item shows gray instead of green */
```

**✅ CORRECT:**
```css
/* Exclude active from hover */
.sidebar-item:not(.sidebar-item-active):hover {
  background: #e5e7eb;  /* ✅ Safe */
}

.sidebar-item-active {
  background: #10b981;
}

/* OR: Define active hover separately */
.sidebar-item-active:hover {
  background: #059669;  /* ✅ Darker green */
}
```

---

### Rule 4: BROAD_TENANT_SELECTOR ⛔ BLOCK

Tenant selectors MUST be scoped to specific components, not global elements.

**❌ VIOLATION:**
```css
/* Affects ALL spans in the app! */
html[data-tenant-brand-preset="jade"] span {
  color: #065f46;  /* ❌ BLOCK */
}

/* Affects ALL buttons! */
html[data-tenant-brand-preset="navy"] button {
  background: #1e3a8a;  /* ❌ BLOCK */
}
```

**✅ CORRECT:**
```css
/* Scoped to component */
html[data-tenant-brand-preset="jade"] .sidebar-item span {
  color: #065f46;  /* ✅ Safe */
}

html[data-tenant-brand-preset="navy"] .nav-button {
  background: #1e3a8a;  /* ✅ Safe */
}
```

---

### Rule 5: EXCLUSION_CHAIN_SMELL ⚠️  WARN → ⛔ BLOCK at 3+

Growing `:not()` chains indicate architectural smell.

**⚠️  WARN (2 :not()):**
```css
.sidebar:not([data-tenant="jade"]):not([data-tenant="navy"]) {
  background: #9d174d;
}
/* Warning: Moving toward anti-pattern */
```

**⛔ BLOCK (3+ :not()):**
```css
.sidebar:not([data-tenant="A"]):not([data-tenant="B"]):not([data-tenant="C"]) {
  background: #default;  /* ❌ ARCHITECTURAL SMELL */
}
/* Each new tenant requires modifying this selector */
```

**✅ CORRECT:**
```css
/* Each tenant defines complete theme */
html[data-tenant-brand-preset="jade"] .sidebar {
  background: #074e44;
}

html[data-tenant-brand-preset="navy"] .sidebar {
  background: #1e3a8a;
}

html[data-tenant-brand-preset="ocean"] .sidebar {
  background: #0284c7;
}
/* No :not() needed - each tenant is independent */
```

---

### Rule 6: ACCIDENTAL_INHERITANCE ⚠️  WARN

Component visual styles outside tenant scope may cause inheritance issues.

**⚠️  WARN:**
```css
/* Default style that becomes "accidental base" */
.beauty-erp-sidebar {
  background: linear-gradient(158deg, #9d174d 0%, #831843 100%);
  color: #f8f6f2;
}
/* Other tenants might inherit this accidentally */
```

**✅ CORRECT:**
```css
/* Option 1: CSS variables (semantic layer) */
.beauty-erp-sidebar {
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
}

/* Option 2: All visuals inside tenant scope */
html[data-tenant-brand-preset="luxury"] .beauty-erp-sidebar {
  background: linear-gradient(158deg, #9d174d 0%, #831843 100%);
  color: #f8f6f2;
}

/* Option 3: Structural only (no colors) */
.beauty-erp-sidebar {
  padding: 1rem;
  display: flex;
  border-radius: 0.5rem;
  /* No background/color here */
}
```

---

## 📋 Usage

### Manual Check
```bash
npm run theme:guard
```

### Verbose Output
```bash
npm run theme:guard:verbose
```

### Exit Codes
- **0** = All checks passed ✅
- **1** = BLOCK violations detected (must fix before commit) ❌
- **2** = WARN violations only (review recommended) ⚠️

---

## 🧪 Testing

Guard includes comprehensive test fixtures:

```bash
npm test -- theme-guard.test.ts
```

**Test coverage:**
- ✅ BLOCK cases (must reject)
- ✅ ALLOW cases (must pass)
- ✅ Real-world mixed scenarios
- ✅ Edge cases

---

## 🔧 Integration

### Git Pre-commit Hook

Add to `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run theme guard
npm run theme:guard || {
  echo "❌ Theme guard failed - fix violations before committing"
  exit 1
}
```

### CI Pipeline

Add to GitHub Actions / GitLab CI:

```yaml
- name: Theme Architecture Guard
  run: npm run theme:guard
```

---

## 📊 Violation Report Example

```
❌ THEME ARCHITECTURE VIOLATIONS DETECTED

🔴 BLOCK (3) - Must fix before commit:

  File: src/components/ui/sidebar.tsx:42
  Rule: TENANT_COLOR_IN_SHARED_JSX
  Issue: Shared component contains tenant-specific color utility
  Code: <button className="bg-emerald-500 text-white">
  Fix: Use semantic CSS class (e.g., "sidebar-item-active") instead

  File: src/app/globals.css:1245
  Rule: HOVER_ACTIVE_LEAKAGE
  Issue: Hover selector can override active state
  Code: .sidebar-item:hover { background: #blue; }
  Fix: Add :not(.active) to hover selector

  File: src/app/globals.css:1380
  Rule: BROAD_TENANT_SELECTOR
  Issue: Tenant selector targets <span> without component scope
  Code: html[data-tenant="jade"] span { color: #green; }
  Fix: Add component class: html[data-tenant="..."] .component-name span

⚠️  WARN (1) - Review recommended:

  File: src/app/globals.css:890
  Rule: EXCLUSION_CHAIN_SMELL
  Issue: Found 2 chained :not() selectors
  Fix: Each tenant should define complete theme

Total: 3 BLOCK, 1 WARN
```

---

## 🎨 Allowed vs Forbidden Patterns

### ✅ ALLOWED in Shared Components

**Structural/Layout Utilities:**
- `p-4`, `m-2`, `px-6`, `py-4` (spacing)
- `w-full`, `h-screen`, `min-w-0` (dimensions)
- `rounded-lg`, `border-2` (geometry only)
- `flex`, `grid`, `gap-4` (layout)
- `text-sm`, `font-bold` (typography size/weight)
- `opacity-50`, `z-10` (opacity, z-index)

**Semantic Classes:**
- `sidebar-item-active`
- `nav-link-disabled`
- `button-primary`
- `card-elevated`

**CSS Variables:**
- `var(--sidebar-bg)`
- `var(--text-primary)`
- `var(--border-default)`

### ❌ FORBIDDEN in Shared Components

**Tenant Color Utilities:**
- `bg-emerald-500` ❌
- `text-rose-700` ❌
- `border-indigo-300` ❌
- `from-pink-500 to-purple-600` ❌

**Hardcoded Colors:**
- `bg-[#10b981]` ❌
- `text-[rgb(16,185,129)]` ❌

---

## 🏗️ Architecture Principles

1. **Shared components = structure + semantic state only**
   - No tenant colors in JSX
   - Use semantic class names
   - Leverage CSS variables

2. **Each tenant = complete independent theme**
   - No inheritance from other tenants
   - All visual properties explicitly defined
   - Scoped under `[data-tenant-brand-preset]`

3. **Visual state ownership = single source of truth**
   - One definition per component state
   - No duplicate conflicting rules
   - Clear hover vs active distinction

4. **Broad selectors = always component-scoped**
   - Never target `span`, `svg`, `button` globally
   - Always prefix with component class
   - Prevent cascade leakage

---

## 🚀 Phase 1 vs Phase 2

### Phase 1: Stabilize (Current)
- ✅ Guard enforces current best practices
- ✅ Fix immediate leakage issues
- ✅ Prevent regressions
- ✅ Document violations

### Phase 2: Semantic Token Migration (Future)
- 🔄 Full semantic token layer (50-70 tokens)
- 🔄 Tenant theme pack template
- 🔄 Zero `:not()` exclusion patterns
- 🔄 New tenant = just add theme pack

Guard supports both phases without code changes.

---

## 📚 References

- **Architecture Document**: `docs/architecture/ARCHITECTURE_GATE_RESULT_TENANT_THEME_ISOLATION.md`
- **Test Fixtures**: `scripts/architecture/__tests__/theme-guard.fixtures.ts`
- **Healthcare Constitution**: Compliant (UI layer only, no Kernel modifications)

---

## ❓ FAQ

**Q: Why BLOCK tenant colors in shared components?**  
A: Hardcoding `bg-emerald-500` in shared sidebar means all tenants see emerald. Use semantic `sidebar-active` class instead.

**Q: Can I use `text-sm` or `rounded-lg`?**  
A: Yes! Structural/layout utilities are allowed. Only color utilities are blocked.

**Q: What if I need tenant-specific component?**  
A: Place in `src/products/<tenant>/` or `src/features/tenant-specific/`. Guard skips these folders.

**Q: Why warn on visual styles outside tenant scope?**  
A: They become "accidental defaults" that other tenants inherit. Use CSS variables or tenant scope instead.

**Q: Can I disable a rule?**  
A: No. Rules are based on proven architectural issues. If guard blocks legitimate code, it's a bug - file an issue.

---

**Maintained by**: BELLA Architecture Team  
**Status**: ACTIVE - Phase 1 Enforcement  
**Last Updated**: 2026-09-10
