/**
 * THEME GUARD TEST FIXTURES
 * 
 * Provides BLOCK and ALLOW examples to validate guard rules.
 * Each fixture proves the guard can distinguish between violations and legitimate code.
 */

// ============================================================================
// FIXTURE 1: TENANT_COLOR_IN_SHARED_JSX
// ============================================================================

export const TENANT_COLOR_JSX_BLOCK = `
// ❌ BLOCK: Shared component with tenant-specific color
export function Sidebar() {
  return (
    <div className="sidebar">
      <button className="bg-emerald-500 text-white">
        Active
      </button>
    </div>
  );
}
`;

export const TENANT_COLOR_JSX_ALLOW = `
// ✅ ALLOW: Semantic class name
export function Sidebar() {
  return (
    <div className="sidebar">
      <button className="sidebar-item-active">
        Active
      </button>
    </div>
  );
}

// ✅ ALLOW: Structural utilities (spacing, layout)
export function Card() {
  return (
    <div className="p-4 rounded-lg border-2 flex gap-4">
      <span className="text-sm font-semibold">Title</span>
    </div>
  );
}
`;

// ============================================================================
// FIXTURE 2: DUPLICATE_VISUAL_OWNER
// ============================================================================

export const DUPLICATE_OWNER_BLOCK = `
/* ❌ BLOCK: Two conflicting definitions for same component state */
.sidebar-item.active {
  background: #10b981;
  color: white;
}

.sidebar-item-active {
  background: #3b82f6;  /* CONFLICT - which one wins? */
  color: white;
}
`;

export const DUPLICATE_OWNER_ALLOW = `
/* ✅ ALLOW: Single definition for active state */
.sidebar-item-active {
  background: var(--sidebar-active-bg);
  color: var(--sidebar-active-text);
}

/* ✅ ALLOW: Same state across different tenants (scoped) */
html[data-tenant-brand-preset="jade_wellness"] .sidebar-item-active {
  background: #10b981;
}

html[data-tenant-brand-preset="luxury_navy"] .sidebar-item-active {
  background: #1e3a8a;
}
`;

// ============================================================================
// FIXTURE 3: HOVER_ACTIVE_LEAKAGE
// ============================================================================

export const HOVER_ACTIVE_BLOCK = `
/* ❌ BLOCK: Hover will override active state */
.sidebar-item:hover {
  background: #e5e7eb;
  color: #1f2937;
}

.sidebar-item-active {
  background: #10b981;
  color: white;
}

/* Problem: hovering active item triggers gray background instead of keeping green */
`;

export const HOVER_ACTIVE_ALLOW = `
/* ✅ ALLOW: Hover excludes active state */
.sidebar-item:not(.sidebar-item-active):hover {
  background: #e5e7eb;
  color: #1f2937;
}

.sidebar-item-active {
  background: #10b981;
  color: white;
}

/* ✅ ALLOW: Active hover has different style (intentional) */
.sidebar-item-active:hover {
  background: #059669;  /* Darker green on hover */
  color: white;
}
`;

// ============================================================================
// FIXTURE 4: BROAD_TENANT_SELECTOR
// ============================================================================

export const BROAD_SELECTOR_BLOCK = `
/* ❌ BLOCK: Tenant selector affects ALL spans globally */
html[data-tenant-brand-preset="jade_wellness"] span {
  color: #065f46;
}

/* ❌ BLOCK: Affects ALL buttons */
html[data-tenant-brand-preset="luxury_navy"] button {
  background: #1e3a8a;
}
`;

export const BROAD_SELECTOR_ALLOW = `
/* ✅ ALLOW: Scoped to specific component */
html[data-tenant-brand-preset="jade_wellness"] .sidebar-item span {
  color: #065f46;
}

html[data-tenant-brand-preset="luxury_navy"] .beauty-erp-nav-item button {
  background: #1e3a8a;
}

/* ✅ ALLOW: Element selector in pseudo-element (not real DOM) */
html[data-tenant-brand-preset="jade_wellness"] .sidebar::before {
  content: "•";
}
`;

// ============================================================================
// FIXTURE 5: EXCLUSION_CHAIN_SMELL
// ============================================================================

export const EXCLUSION_CHAIN_BLOCK = `
/* ❌ BLOCK: Growing exclusion list (3+ :not selectors) */
.sidebar-item:not([data-tenant-brand-preset="jade_wellness"]):not([data-tenant-brand-preset="luxury_navy"]):not([data-tenant-brand-preset="ocean_clean"]) {
  background: #9d174d;
  color: white;
}

/* This indicates tenants are inheriting each other's styles */
`;

export const EXCLUSION_CHAIN_WARN = `
/* ⚠️  WARN: Two :not() selectors (review recommended) */
.sidebar-item:not([data-tenant-brand-preset="jade_wellness"]):not([data-tenant-brand-preset="luxury_navy"]) {
  background: #9d174d;
}

/* Not blocked yet, but moving toward anti-pattern */
`;

export const EXCLUSION_CHAIN_ALLOW = `
/* ✅ ALLOW: Single :not() for legitimate state exclusion */
.sidebar-item:not(.sidebar-item-active):hover {
  background: #e5e7eb;
}

/* ✅ ALLOW: No :not() at all - each tenant defines complete theme */
html[data-tenant-brand-preset="jade_wellness"] .sidebar-item {
  background: transparent;
  color: #f1f5f9;
}

html[data-tenant-brand-preset="luxury_navy"] .sidebar-item {
  background: transparent;
  color: #f8fafc;
}
`;

// ============================================================================
// FIXTURE 6: ACCIDENTAL_INHERITANCE
// ============================================================================

export const ACCIDENTAL_INHERITANCE_WARN = `
/* ⚠️  WARN: Component visual style outside tenant scope */
.beauty-erp-sidebar {
  background: linear-gradient(158deg, #9d174d 0%, #831843 100%);
  color: #f8f6f2;
}

/* This becomes the "default" that other tenants might inherit accidentally */
`;

export const ACCIDENTAL_INHERITANCE_ALLOW = `
/* ✅ ALLOW: Visual styles inside tenant scope */
html[data-tenant-brand-preset="luxury_navy"] .beauty-erp-sidebar {
  background: linear-gradient(158deg, #0b192c 0%, #1e3a8a 52%, #0f172a 100%);
  color: #f8fafc;
}

/* ✅ ALLOW: CSS variables (semantic layer) */
.beauty-erp-sidebar {
  background: var(--sidebar-bg);
  color: var(--sidebar-text);
}

/* ✅ ALLOW: Structural properties only (no colors) */
.beauty-erp-sidebar {
  padding: 1rem;
  border-radius: 0.5rem;
  display: flex;
  flex-direction: column;
}
`;

// ============================================================================
// FIXTURE 7: COMPLEX REAL-WORLD SCENARIOS
// ============================================================================

export const REAL_WORLD_MIXED = `
/* Mixed: Contains both violations and legitimate code */

/* ✅ ALLOW: Structural base */
.sidebar-item {
  padding: 0.75rem 1rem;
  border-radius: 0.5rem;
  transition: all 0.2s ease;
}

/* ❌ BLOCK: Visual style outside tenant scope */
.sidebar-item {
  background: #f1f5f9;
  color: #334155;
}

/* ❌ BLOCK: Hover without active exclusion */
.sidebar-item:hover {
  background: #e2e8f0;
  color: #0f172a;
}

/* ✅ ALLOW: Tenant-scoped complete theme */
html[data-tenant-brand-preset="jade_wellness"] .sidebar-item {
  background: transparent;
  color: rgba(241, 245, 249, 0.90);
}

html[data-tenant-brand-preset="jade_wellness"] .sidebar-item:not(.sidebar-item-active):hover {
  background: rgba(255, 255, 255, 0.09);
  color: #ffffff;
}

html[data-tenant-brand-preset="jade_wellness"] .sidebar-item-active {
  background: linear-gradient(90deg, rgba(16, 185, 129, 0.28) 0%, rgba(16, 185, 129, 0.13) 100%);
  color: #ffffff;
}
`;

// ============================================================================
// EXPECTED VIOLATION COUNTS FOR EACH FIXTURE
// ============================================================================

export const EXPECTED_VIOLATIONS = {
  TENANT_COLOR_JSX_BLOCK: {
    BLOCK: 1,  // bg-emerald-500
    WARN: 0
  },
  TENANT_COLOR_JSX_ALLOW: {
    BLOCK: 0,
    WARN: 0
  },
  DUPLICATE_OWNER_BLOCK: {
    BLOCK: 1,  // sidebar-item active state conflict
    WARN: 0
  },
  DUPLICATE_OWNER_ALLOW: {
    BLOCK: 0,
    WARN: 0
  },
  HOVER_ACTIVE_BLOCK: {
    BLOCK: 1,  // .sidebar-item:hover without :not(.active)
    WARN: 0
  },
  HOVER_ACTIVE_ALLOW: {
    BLOCK: 0,
    WARN: 0
  },
  BROAD_SELECTOR_BLOCK: {
    BLOCK: 2,  // span and button without component scope
    WARN: 0
  },
  BROAD_SELECTOR_ALLOW: {
    BLOCK: 0,
    WARN: 0
  },
  EXCLUSION_CHAIN_BLOCK: {
    BLOCK: 1,  // 3+ :not() selectors
    WARN: 0
  },
  EXCLUSION_CHAIN_WARN: {
    BLOCK: 0,
    WARN: 1  // 2 :not() selectors
  },
  EXCLUSION_CHAIN_ALLOW: {
    BLOCK: 0,
    WARN: 0
  },
  ACCIDENTAL_INHERITANCE_WARN: {
    BLOCK: 0,
    WARN: 1  // Visual style outside tenant scope
  },
  ACCIDENTAL_INHERITANCE_ALLOW: {
    BLOCK: 0,
    WARN: 0
  },
  REAL_WORLD_MIXED: {
    BLOCK: 2,  // Visual outside scope + hover without exclusion
    WARN: 0
  }
};
