---
tier: ARCHITECTURE_ANALYSIS
domain: frontend_ui
status: PHASE_1_DESIGN
date: "2026-09-10"
task: "TENANT-SAFE THEME ARCHITECTURE HARDENING"
description: "Prevent CSS leakage between tenants through semantic token layer and strict tenant scoping"
---

# ARCHITECTURE GATE RESULT: TENANT-SAFE THEME ARCHITECTURE

> **Goal:** Allow every tenant/product to have unique visual design without causing CSS regression in other tenants.
>
> **Current Status:** HIGH RISK — Multiple tenant presets with growing `:not()` exclusion patterns
>
> **Proposed Solution:** Semantic token layer + strict tenant-scoped overrides

---

## I. ARCHITECTURAL STATUS & COMPLIANCE

### Kernel Freeze Status
✅ **COMPLIANT** — This is a **UI/Frontend Architecture Task**
- No Healthcare OS Kernel (H1-H12) modification
- No Logistics OS Kernel (E7.1, E7.2, E7.3) modification
- No backend business logic changes
- Pure CSS/Theme architecture refactoring
- Product Vertical Layer only (frontend presentation)

### Scope
```
LAYER: Product Vertical UI Layer
FILES: src/app/globals.css, tenant theme configurations
IMPACT: Visual presentation only (no data, no business logic)
RISK LEVEL: Medium (CSS leakage between tenants)
```

---

## II. CURRENT ARCHITECTURE ANALYSIS

### A. Current Tenant/Preset Inventory

**Discovered Presets in `globals.css`:**

1. `[data-tenant-module="pending"]` — Neutral first-paint shell (slate/gold)
2. `[data-tenant-module="beauty_spa"]` — Emerald green
3. `[data-tenant-module="baby_care"]` — Rose-700 (Bella brand)
4. `[data-tenant-module="babycare"]` — Rose-700 (alias)
5. `[data-tenant-brand-preset="jade_wellness"]` — Emerald (#074E44 / #C8A97A)
6. `[data-tenant-brand-preset="luxury_navy"]` — Navy Blue (#1E3A8A / #D97706 amber)
7. `[data-tenant-brand-preset="ocean_clean"]` — Blue (#1E40AF / #3B82F6)
8. *(Appears to continue with more presets — file truncated)*

### B. Current CSS Architecture Pattern

```css
/* CURRENT PROBLEMATIC PATTERN */

/* Default rule */
.sidebar-item {
  color: #9D174D; /* luxury_navy becomes accidental "default" */
}

/* Growing exclusion list as new tenants are added */
.sidebar-item:not([data-tenant="jade_wellness"]):not([data-tenant="ocean_clean"]) {
  color: #9D174D;
}

/* Each tenant must override */
html[data-tenant-brand-preset="jade_wellness"] .sidebar-item {
  color: #074E44 !important;
}

html[data-tenant-brand-preset="ocean_clean"] .sidebar-item {
  color: #1E40AF !important;
}
```

**PROBLEM:** Each new tenant requires modifying CSS for ALL previous tenants.

---

## III. CLASSIFICATION OF CURRENT CSS

### Risk Assessment Matrix

| CSS Type | Location | Tenant Specificity | Leakage Risk | Action Required |
|----------|----------|-------------------|--------------|-----------------|
| **Token Definitions** | `:root`, `.dark` | None (semantic) | LOW | ✅ Keep as-is |
| **Shared Component Structure** | `.bella-data-table`, `.bella-toolbar` | None | LOW | ✅ Keep as-is |
| **Tenant Visual Overrides** | `html[data-tenant-brand-preset]` | HIGH | HIGH | 🔴 REFACTOR |
| **Inline Tenant Colors in JSX** | Component files (TBD) | HIGH | HIGH | 🔴 AUDIT NEEDED |
| **Broad Global Selectors** | `span`, `svg`, `*`, `button` | None but wide scope | MEDIUM | ⚠️ SCOPE DOWN |
| **Module-Specific Fixes** | `.customer-detail-ktv-select` | Component-scoped | LOW | ✅ Acceptable |

---

## IV. PROPOSED SEMANTIC TOKEN ARCHITECTURE

### A. Layered Theme Contract

```text
┌─────────────────────────────────────────┐
│   SHARED UI COMPONENTS                  │ ← Structure + Semantic State Only
│   (sidebar, button, card, table...)     │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   SEMANTIC STATE CONTRACT               │ ← :hover, :active, :disabled, :focus
│   (no colors, only state logic)         │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   BASE PRODUCT THEME                    │ ← Default neutral tokens
│   (neutral slate/gray palette)          │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   TENANT THEME PACK                     │ ← [data-tenant-brand-preset="..."]
│   (complete theme override per tenant)  │
└─────────────────┬───────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│   TENANT-SCOPED OVERRIDES               │ ← Component-specific adjustments
│   (optional, minimal)                   │
└─────────────────────────────────────────┘
```

### B. Canonical Semantic Token Layer

**Required Tokens (minimum viable set):**

```css
/* SIDEBAR TOKENS */
--sidebar-bg
--sidebar-text
--sidebar-text-muted
--sidebar-border
--sidebar-hover-bg
--sidebar-hover-text
--sidebar-active-bg
--sidebar-active-text
--sidebar-active-border
--sidebar-active-icon

/* SURFACE TOKENS */
--surface-card-bg
--surface-card-border
--surface-modal-bg
--surface-popover-bg

/* TEXT TOKENS */
--text-primary
--text-secondary
--text-muted
--text-heading

/* BORDER TOKENS */
--border-default
--border-muted
--border-emphasis

/* BUTTON TOKENS */
--button-primary-bg
--button-primary-text
--button-primary-hover
--button-secondary-bg
--button-secondary-text

/* INPUT TOKENS */
--input-bg
--input-border
--input-text
--input-focus-border

/* TABLE TOKENS */
--table-header-bg
--table-header-text
--table-row-hover
--table-border

/* STATUS TOKENS */
--status-success
--status-warning
--status-error
--status-info
```

### C. Shared Component Design Rules

**Mandatory Constraints:**

1. **No tenant colors in JSX** — Components must use semantic class names only
2. **No tenant colors in shared CSS** — Only CSS variables allowed
3. **State logic in base classes** — `:hover`, `:active`, etc. defined once
4. **Tenant scope = data attribute** — `[data-tenant-brand-preset="preset_name"]`

**Example: Sidebar Item (BEFORE)**

```tsx
// ❌ BAD: Tenant color baked into JSX
<div className={cn(
  "sidebar-item",
  isActive && "bg-emerald-100 text-emerald-900" // TENANT COLOR LEAK
)}>
```

**Example: Sidebar Item (AFTER)**

```tsx
// ✅ GOOD: Semantic state only
<div className={cn(
  "sidebar-item",
  isActive && "sidebar-item-active" // SEMANTIC STATE
)}>
```

```css
/* Base component structure (shared) */
.sidebar-item {
  padding: 0.5rem 1rem;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  color: var(--sidebar-text);
  background: transparent;
}

/* State logic (shared) */
.sidebar-item:not(.sidebar-item-active):hover {
  background: var(--sidebar-hover-bg);
  color: var(--sidebar-hover-text);
}

.sidebar-item.sidebar-item-active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
  border-left: 3px solid var(--sidebar-active-border);
}
```

```css
/* Tenant theme pack (scoped) */
[data-tenant-brand-preset="jade_wellness"] {
  --sidebar-bg: linear-gradient(158deg, #03211d 0%, #074e44 48%, #05362f 100%);
  --sidebar-text: rgba(241, 245, 249, 0.90);
  --sidebar-hover-bg: rgba(255, 255, 255, 0.09);
  --sidebar-hover-text: #ffffff;
  --sidebar-active-bg: linear-gradient(90deg, rgba(16, 185, 129, 0.28) 0%, rgba(16, 185, 129, 0.13) 100%);
  --sidebar-active-text: #ffffff;
  --sidebar-active-border: #10b981;
  --sidebar-active-icon: #f59e0b;
}

[data-tenant-brand-preset="luxury_navy"] {
  --sidebar-bg: linear-gradient(158deg, #0b192c 0%, #1e3a8a 52%, #0f172a 100%);
  --sidebar-text: rgba(248, 250, 252, 0.80);
  --sidebar-hover-bg: rgba(255, 255, 255, 0.07);
  --sidebar-hover-text: #ffffff;
  --sidebar-active-bg: linear-gradient(90deg, rgba(16, 185, 129, 0.28) 0%, rgba(16, 185, 129, 0.13) 100%);
  --sidebar-active-text: #ffffff;
  --sidebar-active-border: #10b981;
  --sidebar-active-icon: #f59e0b;
}
```

---

## V. TENANT THEME OWNERSHIP MATRIX

### Strict Ownership Model

```text
┌────────────────────┬──────────────────────┬───────────────────────┬──────────────────┐
│ Tenant/Preset      │ Token Pack Owner     │ Component Overrides   │ Cross-Tenant OK? │
├────────────────────┼──────────────────────┼───────────────────────┼──────────────────┤
│ jade_wellness      │ jade_wellness.tokens │ jade_wellness.scope   │ ❌ NO            │
│ luxury_navy        │ luxury_navy.tokens   │ luxury_navy.scope     │ ❌ NO            │
│ ocean_clean        │ ocean_clean.tokens   │ ocean_clean.scope     │ ❌ NO            │
│ [default/neutral]  │ :root base tokens    │ None (fallback)       │ ✅ YES (base)    │
└────────────────────┴──────────────────────┴───────────────────────┴──────────────────┘
```

**Ownership Rules:**

1. Each tenant **MUST** declare its own complete theme token set
2. No tenant **MAY** inherit accidental visual behavior from another tenant
3. Switching tenant A → B → C → A **MUST** produce identical visual state
4. No tenant-specific selector **MAY** exist outside `[data-tenant-brand-preset]` scope

---

## VI. FORBIDDEN PATTERNS & REGRESSION GUARDS

### A. Forbidden Patterns

```css
/* ❌ FORBIDDEN: Growing exclusion list */
.sidebar-item:not([data-tenant="A"]):not([data-tenant="B"]):not([data-tenant="C"]) {
  color: #default;
}

/* ❌ FORBIDDEN: Broad tenant selector without component scope */
html[data-tenant-brand-preset="jade_wellness"] span {
  color: #074E44; /* LEAKS TO ALL SPANS */
}

/* ❌ FORBIDDEN: Duplicate visual owner for same state */
.sidebar-item.active { background: #emerald; }
.sidebar-item-active { background: #blue; } /* CONFLICT */

/* ❌ FORBIDDEN: Tenant color utility in shared component */
<Button className="bg-emerald-500"> {/* TENANT-SPECIFIC COLOR */}

/* ❌ FORBIDDEN: Hover state identical to active state */
.sidebar-item:hover { background: #10b981; }
.sidebar-item.active { background: #10b981; } /* CANNOT DISTINGUISH */
```

### B. Automated Regression Guards (Proposed)

```typescript
// scripts/architecture/theme-guard.ts

export const THEME_GUARD_RULES = {
  // Rule 1: Tenant selector MUST be scoped to component class
  TENANT_SCOPE_ENFORCEMENT: {
    pattern: /html\[data-tenant-brand-preset="[^"]+"\]\s+(?!\.[\w-]+|aside\.|button\.|input\.|div\.)/,
    error: "BLOCK: Tenant-specific selector outside component scope",
    severity: "BLOCK"
  },

  // Rule 2: No growing exclusion lists
  EXCLUSION_LIST_DETECTION: {
    pattern: /:not\([^\)]+\):not\([^\)]+\):not\([^\)]+\)/,
    error: "WARN: Three or more :not() selectors detected — use tenant token instead",
    severity: "WARN"
  },

  // Rule 3: No duplicate state owners
  DUPLICATE_VISUAL_OWNER: {
    check: (css: string) => {
      // Parse CSS and detect conflicting rules for same element state
    },
    error: "BLOCK: Duplicate visual owner for same component state",
    severity: "BLOCK"
  },

  // Rule 4: Shared components cannot contain tenant color utilities
  TENANT_COLOR_IN_SHARED_COMPONENT: {
    pattern: /className={[^}]*(?:bg-(?:emerald|rose|blue|indigo|amber)-\d+|text-(?:emerald|rose|blue)-\d+)/,
    error: "BLOCK: Shared component contains tenant-specific color utility",
    severity: "BLOCK",
    excludePaths: ["src/products/", "src/features/tenant-specific/"]
  },

  // Rule 5: Active and hover states must be visually distinct
  HOVER_ACTIVE_COLLISION: {
    check: (css: string) => {
      // Ensure hover and active states have different visual properties
    },
    error: "BLOCK: Hover state matches active state — cannot distinguish visually",
    severity: "BLOCK"
  }
};
```

---

## VII. IMPLEMENTATION PHASES

### Phase 1: Stabilize Current System (PRIORITY)
**Goal:** Stop bleeding — fix immediate sidebar/theme leak issues

**Tasks:**
1. ✅ Document current architecture (this document)
2. 🔴 Audit sidebar component for inline tenant colors
3. 🔴 Fix jade_wellness hover → active state conflict
4. 🔴 Ensure tenant switching A → B → A produces consistent UI
5. 🔴 Browser test matrix (Chrome, Safari, Firefox, Edge)

**Acceptance Criteria:**
- No visual regression when switching tenants
- Active state always visually distinct from hover
- No CSS from tenant A visible when tenant B is active

---

### Phase 2: Semantic Token Migration (FUTURE)
**Goal:** Migrate to full semantic token layer architecture

**Tasks:**
1. Define complete semantic token contract (50-70 tokens)
2. Create base theme pack (neutral/default)
3. Migrate 1 tenant (jade_wellness) to new architecture
4. Validate zero leakage with automated tests
5. Migrate remaining tenants incrementally
6. Remove all `:not()` exclusion patterns
7. Establish theme pack template for future tenants

**Acceptance Criteria:**
- Every tenant has complete, independent theme token set
- No cross-tenant CSS dependencies
- New tenant can be added by creating theme pack only (no edits to shared CSS)
- Architecture guard prevents tenant leakage at commit time

---

## VIII. BROWSER TEST MATRIX (Phase 1)

**Test Scenarios:**

```text
Tenant Switch Flow:
  1. Load app with tenant A (jade_wellness)
  2. Verify sidebar active state = emerald gradient + white text
  3. Switch to tenant B (luxury_navy)
  4. Verify sidebar active state = emerald gradient + white text (canonical)
  5. Verify NO stale emerald colors outside sidebar
  6. Switch to tenant C (ocean_clean)
  7. Verify sidebar active state = emerald gradient + white text (canonical)
  8. Switch back to tenant A
  9. Verify sidebar matches step 2 exactly

State Transition Test:
  1. Hover over inactive sidebar item
  2. Verify hover state is visually distinct
  3. Click to activate
  4. Verify active state is different from hover
  5. Hover over active item
  6. Verify active state remains dominant (not overridden by hover)

Component Isolation Test:
  1. Open modal/popover in tenant A
  2. Verify modal styling matches tenant A
  3. Switch tenant to B
  4. Open same modal
  5. Verify modal styling matches tenant B
  6. Verify NO tenant A colors leak into tenant B modal
```

**Browsers:**
- Chrome 130+
- Safari 18+
- Firefox 133+
- Edge 130+

**Devices:**
- Desktop 1920x1080
- Laptop 1366x768
- Tablet 768x1024
- Mobile 375x667

---

## IX. LONG-TERM TENANT THEME GOVERNANCE

### Future Tenant Addition Workflow

```text
1. Product Manager requests new tenant theme
   ↓
2. Designer creates theme specification (colors, radius, shadows, typography)
   ↓
3. Developer creates theme pack:
   → Copy template: `theme-pack-template.css`
   → Fill semantic tokens with tenant-specific values
   → Place in: `src/styles/tenants/tenant_name.css`
   ↓
4. Automated Guard validates:
   ✅ All required tokens defined
   ✅ No cross-tenant selectors
   ✅ All tokens scoped under [data-tenant-brand-preset]
   ✅ No broad element selectors (span, svg, button)
   ↓
5. Manual QA:
   ✅ Browser test matrix (4 browsers x 4 viewports)
   ✅ Tenant switch regression test
   ↓
6. Deployment + Monitoring
   → CSS bundle size check
   → Runtime CSS leakage detection (Sentry/LogRocket)
```

### Architecture Decision Records (ADRs) Required

For Phase 2 implementation, create:

1. **ADR-001: Semantic Token Contract**
   - Complete token taxonomy
   - Naming conventions
   - Token inheritance rules

2. **ADR-002: Tenant Theme Pack Structure**
   - File organization
   - Token definition format
   - Validation schema

3. **ADR-003: Shared Component Design Constraints**
   - Allowed CSS properties
   - State transition logic
   - Accessibility requirements

---

## X. RISK ASSESSMENT & MITIGATION

### Current Risks

| Risk | Severity | Likelihood | Impact | Mitigation |
|------|----------|------------|--------|------------|
| CSS leakage between tenants | HIGH | HIGH | Users see wrong brand colors | Phase 1: Fix immediate issues |
| Growing `:not()` complexity | MEDIUM | MEDIUM | Maintenance nightmare | Phase 2: Semantic tokens |
| New tenant breaks old tenant | HIGH | MEDIUM | Production visual regression | Automated guard + browser tests |
| Developer adds tenant color to shared component | MEDIUM | HIGH | Silent CSS leak | Linting rule + code review |
| Hover/active states conflict | MEDIUM | MEDIUM | Poor UX (cannot see active state) | Visual regression testing |

### Mitigation Strategy

1. **Immediate (Phase 1):** Stabilize current system, document rules
2. **Short-term (Phase 2):** Implement architecture guard script
3. **Long-term:** Full semantic token migration, zero cross-tenant dependencies

---

## XI. SUCCESS METRICS

### Phase 1 Success Criteria
- ✅ Zero visual regression in current tenants after fixes
- ✅ Tenant switch A → B → C → A produces identical UI
- ✅ Active sidebar state always visually distinct from hover
- ✅ Browser test matrix passes 100%

### Phase 2 Success Criteria
- ✅ All tenants migrated to semantic token architecture
- ✅ Zero `:not()` exclusion patterns remain
- ✅ New tenant can be added without modifying shared CSS
- ✅ Architecture guard blocks tenant leakage at commit time
- ✅ CSS bundle size increase < 5% vs current architecture

---

## XII. CONCLUSION

**ARCHITECTURE VERDICT:** Phase 1 (stabilize) → Phase 2 (semantic token migration)

**Phase 1 STATUS:** ✅ **APPROVED TO PROCEED**
- Scope: Fix immediate sidebar/theme leak issues only
- Impact: Zero Kernel modification, frontend UI only
- Risk: Low (reversible CSS changes)

**Phase 2 STATUS:** 📋 **DESIGN COMPLETE, IMPLEMENTATION DEFERRED**
- Scope: Full semantic token layer architecture
- Impact: Major CSS refactoring across all tenants
- Risk: Medium (requires careful migration + testing)
- Timeline: After Phase 1 stabilization + stakeholder approval

**Next Action:** Proceed with Phase 1 implementation tasks 2-5.

---

**Prepared by:** Kiro AI Architect Agent  
**Date:** 2026-09-10  
**Review Status:** Pending Human Architect Review  
**Compliance:** ✅ Healthcare/Logistics Kernel Freeze Rules — NO VIOLATION
