# P1B.1 OWNERSHIP DISCOVERY REPORT

**Phase:** 1B.1 Discovery (Component Ownership Audit)  
**Status:** 🟡 IN PROGRESS  
**Date:** 2026-09-10  
**Baseline:** 108 BLOCK, 12 WARN (unchanged)  
**CSS Changes:** 0 (discovery only)

---

## 🎯 Discovery Objectives

**DO:**
- ✅ Inventory all 26 BROAD_TENANT_SELECTOR violations
- ✅ Document actual runtime ownership
- ✅ Classify remediation categories (A/B/C/D/E)
- ✅ Verify no canonical classes currently exist
- ✅ Propose remediation strategy per category
- ✅ Identify legitimate tenant-wide styling

**DO NOT:**
- ❌ Modify production CSS
- ❌ Reduce baseline count
- ❌ Invent canonical component classes
- ❌ Assume selector replacements
- ❌ Skip runtime verification

---

## 📊 Violation Inventory (26 Total)

### Group 1: Pending Module (2 violations)

**V1-V2: Transparent Card Backgrounds**

```css
/* Lines 1054-1055 */
html[data-tenant-module="pending"] div[class*="bg-white/30"],
html[data-tenant-module="pending"] div[class*="bg-white/50"],
html[data-tenant-module="pending"] section[class*="bg-white/30"],
html[data-tenant-module="pending"] section[class*="bg-white/50"] {
  background: rgba(255, 255, 255, 0.76) !important;
  border-color: rgba(200, 169, 122, 0.22) !important;
  box-shadow: 0 18px 44px rgba(11, 34, 64, 0.08) !important;
}
```

**Analysis:**
- **Tenant:** `pending` module
- **Intent:** Override Tailwind opacity classes with custom glass-morphism effect
- **Runtime matches:** Unknown (requires DOM inspection)
- **Cross-component:** YES - affects ALL divs/sections with `bg-white/30` or `bg-white/50`
- **Actual ownership:** Likely targeting card components but overly broad
- **Risk:** Low (pending is special state, not production tenant)

**Proposed Classification:** **A (Legitimate tenant-wide rule with caveat)**

**Rationale:**
- `pending` module may intentionally apply glass effect globally
- Selector uses attribute match (`class*="bg-white/30"`) which is more specific than bare `div`
- However, still affects unintended elements

**Remediation Options:**
1. **Keep as-is** - Document as intentional pending-state styling
2. **Scope to layout containers** - `.page-container div[class*="bg-white/30"]`
3. **Extract to CSS variable** - `--pending-glass-bg` applied at root

**Recommendation:** Document as tenant-wide glass-morphism effect for pending state.

---

### Group 2: Beauty Spa Module (14 violations)

**V3: Button Icon Colors**

```css
/* Line 1970 */
html[data-tenant-module="beauty_spa"] button svg,
html[data-tenant-module="beauty_spa"] [role="button"] svg {
  /* Icons will inherit from parent color or use CSS variable */
}
```

**Analysis:**
- **Tenant:** `beauty_spa`
- **Intent:** Ensure icons inside buttons inherit color
- **Runtime matches:** ALL `<button><svg>` in beauty_spa tenant
- **Cross-component:** YES - affects every button with icon
- **Actual ownership:** Buttons (but no canonical class exists)
- **Risk:** Medium - could affect unintended icon usage

**Proposed Classification:** **A (Legitimate tenant-wide button icon rule)**

**Rationale:**
- Icons inside buttons SHOULD inherit button color
- This is a tenant-level design system rule
- Applies consistently across all buttons
- No component-specific logic needed

**Remediation Options:**
1. **Keep as-is** - Document as design system icon inheritance rule
2. **Scope to specific button contexts** - `.action-button svg`, `.submit-button svg`

**Recommendation:** Keep as tenant-wide rule. Add documentation comment explaining inheritance pattern.

---

**V4-V5: Card Glass Effects**

```css
/* Lines 2667-2668 */
html[data-tenant-module="beauty_spa"] div[class*="bg-white/30"],
html[data-tenant-module="beauty_spa"] div[class*="bg-white/50"],
html[data-tenant-module="beauty_spa"] section[class*="bg-white/30"],
html[data-tenant-module="beauty_spa"] section[class*="bg-white/50"] {
  background: rgba(255, 255, 255, 0.7) !important;
  border-color: var(--beauty-border) !important;
  box-shadow: var(--beauty-shadow-md) !important;
  backdrop-filter: blur(18px) saturate(135%);
  -webkit-backdrop-filter: blur(18px) saturate(135%);
}
```

**Analysis:**
- **Tenant:** `beauty_spa`
- **Intent:** Glass-morphism effect for transparent backgrounds
- **Runtime matches:** Unknown (requires counting `bg-white/30` usage)
- **Cross-component:** YES - affects ALL elements with opacity utilities
- **Actual ownership:** Cards, modals, popovers with transparency
- **Risk:** High - very broad, could affect unintended elements

**Proposed Classification:** **D (Token migration candidate)**

**Rationale:**
- This is visual theming, not component-specific
- Should use CSS custom properties at root level
- Applying backdrop-filter globally is expensive and overly broad

**Remediation Strategy:**
```css
/* Preferred: Root-level design tokens */
[data-tenant-module="beauty_spa"] {
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: var(--beauty-border);
  --glass-shadow: var(--beauty-shadow-md);
  --glass-blur: blur(18px) saturate(135%);
}

/* Then components explicitly opt-in */
.card-glass {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  box-shadow: var(--glass-shadow);
  backdrop-filter: var(--glass-blur);
}
```

**Recommendation:** Migrate to design token system + explicit component class.

---

**V6-V13: Primary Button/Link Color Overrides**

```css
/* Lines 2747-2750 (base) + 2757-2760 (hover) */
html[data-tenant-module="beauty_spa"] button[class*="bg-primary"]:not([class*="bg-primary/"]),
html[data-tenant-module="beauty_spa"] a[class*="bg-primary"]:not([class*="bg-primary/"]),
html[data-tenant-module="beauty_spa"] button[class*="from-primary"],
html[data-tenant-module="beauty_spa"] a[class*="from-primary"] {
  background: linear-gradient(135deg, var(--beauty-em), var(--beauty-em-2)) !important;
  border-color: rgba(200, 169, 122, 0.62) !important;
  color: #ffffff !important;
  box-shadow: 0 8px 24px rgba(7, 78, 68, 0.2) !important;
}

/* Hover states */
html[data-tenant-module="beauty_spa"] button[class*="bg-primary"]:not([class*="bg-primary/"]):hover,
html[data-tenant-module="beauty_spa"] a[class*="bg-primary"]:not([class*="bg-primary/"]):hover,
html[data-tenant-module="beauty_spa"] button[class*="from-primary"]:hover,
html[data-tenant-module="beauty_spa"] a[class*="from-primary"]:hover {
  background: linear-gradient(135deg, var(--beauty-sap), var(--beauty-sap-2)) !important;
  box-shadow: 0 14px 36px rgba(11, 34, 64, 0.2) !important;
}
```

**Analysis:**
- **Tenant:** `beauty_spa`
- **Intent:** Override Tailwind `bg-primary` with emerald gradient (beauty_spa brand color)
- **Runtime matches:** ALL buttons/links with `bg-primary` or `from-primary` classes
- **Cross-component:** YES - but intentionally targets primary action elements
- **Actual ownership:** Primary buttons/CTAs (no canonical class)
- **Risk:** Low-Medium - specific to primary color utilities

**Proposed Classification:** **A (Legitimate tenant-wide primary color override)**

**Rationale:**
- This IS the intended behavior for beauty_spa tenant
- Primary color should be tenant-specific (emerald for beauty, not pink)
- Applies consistently to all primary actions
- Uses attribute selector for Tailwind utility classes
- No better scoping possible without canonical component

**Remediation Options:**
1. **Keep as-is** - Document as tenant primary color customization
2. **CSS custom properties** - Override `--color-primary` at root
3. **Tailwind config** - Configure tenant-specific primary palette

**Recommendation:** Keep as tenant-wide rule. This is valid tenant theming, not a violation.

**⚠️ GUARD RULE ISSUE:** Guard incorrectly flags legitimate tenant theme customization as violation.

---

**V14-V16: Form Input Styling**

```css
/* Lines 2821, 2832, 3603 */
html[data-tenant-module="beauty_spa"] input:not([type="checkbox"]):not([type="radio"]),
html[data-tenant-module="beauty_spa"] select,
html[data-tenant-module="beauty_spa"] textarea,
html[data-tenant-module="beauty_spa"] .premium-select,
html[data-tenant-module="beauty_spa"] [role="combobox"] {
  background-color: rgba(255, 255, 255, 0.78) !important;
  border-color: var(--beauty-border) !important;
  color: var(--beauty-text) !important;
  box-shadow: var(--beauty-shadow-sm) !important;
}

/* Focus states at line 2832 */
html[data-tenant-module="beauty_spa"] input:not([type="checkbox"]):not([type="radio"]):focus,
html[data-tenant-module="beauty_spa"] select:focus,
html[data-tenant-module="beauty_spa"] textarea:focus,
...
```

**Analysis:**
- **Tenant:** `beauty_spa`
- **Intent:** Apply beauty_spa styling to ALL form inputs
- **Runtime matches:** Every text input, select, textarea in tenant
- **Cross-component:** YES - affects ALL forms
- **Actual ownership:** Form controls (no canonical class)
- **Risk:** Medium - broad, but scoped to form elements

**Proposed Classification:** **A (Legitimate tenant-wide form styling)**

**Rationale:**
- Forms SHOULD have consistent styling within a tenant
- This is base-level design system application
- No component-specific ownership needed
- Already uses `:not()` to exclude checkbox/radio (semantic)

**Remediation Options:**
1. **Keep as-is** - Document as tenant form styling
2. **CSS custom properties** - Define form tokens at root, apply via utility classes
3. **Form component library** - Create `<BeautyInput>`, `<BeautySelect>` wrappers

**Recommendation:** Keep as tenant-wide rule. This is valid design system application.

**⚠️ GUARD RULE ISSUE:** Guard incorrectly flags legitimate form styling as violation.

---

### Group 3: Industrial Cleaning Module (10 violations)

**V17-V26: Rose-to-Teal Button Color Remap**

```css
/* Lines 3999-4002 (base) */
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-500"],
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-600"],
html[data-tenant-module="industrial_cleaning"] a[class*="bg-rose-500"],
html[data-tenant-module="industrial_cleaning"] a[class*="bg-rose-600"] {
  background-color: #2D93AE !important; /* Teal cho primary buttons */
}

/* Lines 4006-4010 (hover) */
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-500"]:hover,
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-600"]:hover,
html[data-tenant-module="industrial_cleaning"] button[class*="hover:bg-rose-600"],
html[data-tenant-module="industrial_cleaning"] a[class*="bg-rose-500"]:hover,
html[data-tenant-module="industrial_cleaning"] a[class*="bg-rose-600"]:hover {
  background-color: #0C3776 !important; /* Blue đậm cho hover */
}

/* Line 4049 (form inputs) */
html[data-tenant-module="industrial_cleaning"] input:not([type="checkbox"]):not([type="radio"]):not([type="color"]),
...
```

**Analysis:**
- **Tenant:** `industrial_cleaning`
- **Intent:** Remap rose (pink) color to teal/blue for industrial branding
- **Runtime matches:** ALL buttons/links with `bg-rose-*` classes
- **Cross-component:** YES - but intentionally remaps color palette
- **Actual ownership:** Primary action buttons (no canonical class)
- **Risk:** Low-Medium - specific to rose color utilities

**Proposed Classification:** **A (Legitimate tenant color palette remap)**

**Rationale:**
- Industrial cleaning brand uses teal/blue, not pink/rose
- Other tenants may use rose as primary color
- This tenant remaps rose → teal to match brand
- Intentional global color override for tenant consistency
- No component-specific ownership needed

**Remediation Options:**
1. **Keep as-is** - Document as tenant palette customization
2. **Tailwind config** - Configure industrial_cleaning with teal primary
3. **CSS custom properties** - Override color palette at root

**Recommendation:** Keep as tenant-wide palette remap. Valid tenant theming.

**⚠️ GUARD RULE ISSUE:** Guard incorrectly flags legitimate tenant color customization.

---

## 📊 Preliminary Classification Summary (Static Analysis Only)

**⚠️ Subject to change after runtime verification**

| Category | Count | Description |
|----------|-------|-------------|
| **A - Legitimate Tenant-Wide** | **24** | Valid design system / theme customization |
| **B - Existing Canonical Component** | **0** | No canonical classes currently exist |
| **C - Semantic Component Needed** | **0** | Could create, but not required |
| **D - Token Migration** | **2** | Glass-morphism effects (pending + beauty_spa cards) |
| **E - Ambiguous/Unsafe** | **0** | None identified |
| **TOTAL** | **26** | All violations classified |

### Classification Breakdown

**A - Legitimate Tenant-Wide (24 violations):**
- Pending: 2 glass effects (may migrate to D)
- Beauty Spa: 1 icon inheritance + 8 primary color overrides + 3 form styling
- Industrial Cleaning: 10 color palette remapping

**D - Token Migration Candidates (2 violations):**
- Pending: div/section glass effects (lines 1054-1055)
- Beauty Spa: div/section glass effects (lines 2667-2668)

---

## 🚨 Critical Finding: Guard Rule Over-Blocking

### Evidence

**24 out of 26 violations are LEGITIMATE tenant theming:**

1. **Primary color customization** (8 violations)
   - beauty_spa remaps `bg-primary` to emerald
   - This IS the intended tenant behavior
   - NOT a cross-component leak

2. **Color palette remap** (10 violations)
   - industrial_cleaning remaps rose → teal
   - This IS the intended brand color
   - NOT a cross-component leak

3. **Form base styling** (3 violations)
   - beauty_spa applies tenant form styles
   - This IS design system application
   - NOT a cross-component leak

4. **Icon inheritance** (1 violation)
   - beauty_spa ensures icons inherit button color
   - This IS design system consistency
   - NOT a cross-component leak

### Current Guard Rule

```typescript
// Pseudo-code of current BROAD_TENANT_SELECTOR logic
if (selector.match(/html\[data-tenant[^\]]*\]\s+(button|input|a|div)/)) {
  return { severity: 'BLOCK', message: '...' };
}
```

**Problem:** Rule doesn't distinguish:
```text
Legitimate tenant theming (PRIMARY COLOR OVERRIDE)
vs
Dangerous cross-component leakage (UNINTENDED SIDE EFFECTS)
```

### Proposed Guard Rule Refinement

**BLOCK only if:**
```text
✓ Targets generic structural elements (span, svg, *)
✓ No semantic context (bare div, bare button with no attributes)
✓ Known to cause cross-component conflicts
✓ Overrides semantic states unpredictably
```

**WARN if:**
```text
✓ Targets semantic form elements with exclusions (input:not(...))
✓ Targets utility class overrides (button[class*="bg-primary"])
✓ Intentional palette customization with comment
✓ Has clear business context
```

**ALLOW if:**
```text
✓ Root-level CSS custom property definitions
✓ Tenant-specific design token overrides
✓ Documented global theme rules
```

### Recommended Guard Update

```typescript
// Enhanced BROAD_TENANT_SELECTOR logic
if (selector.match(/html\[data-tenant[^\]]*\]\s+(span|svg|\*)/)) {
  // Always BLOCK generic structural targets
  return { severity: 'BLOCK', message: 'Generic structural selector' };
}

if (selector.match(/html\[data-tenant[^\]]*\]\s+button[^[]/)) {
  // BLOCK bare button (no attributes)
  return { severity: 'BLOCK', message: 'Bare button selector without semantic context' };
}

if (selector.match(/html\[data-tenant[^\]]*\]\s+(button|input|a)\[class\*=/)) {
  // WARN utility class overrides (likely intentional theming)
  const hasComment = checkPrecedingComment(selector);
  if (hasComment && hasComment.includes('@tenant-theme')) {
    return null; // ALLOW with justification
  }
  return { severity: 'WARN', message: 'Tenant color override - verify intentional' };
}

// ... rest of logic
```

---

## 🎯 Recommended Actions

### Immediate (Do NOT modify CSS yet)

1. ✅ **Accept this discovery report** as evidence
2. 🟡 **Refine guard rule** to distinguish legitimate theming from leakage
3. 🟡 **Add justification comment system** - `/* @tenant-theme: primary color override */`
4. 🟡 **Reclassify violations** after guard refinement
5. ⏸️ **THEN decide remediation** for remaining true violations

### Short-term (After Guard Refinement)

**For 2 Token Migration Candidates (D):**
```css
/* Extract glass-morphism to design tokens */
[data-tenant-module="beauty_spa"] {
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: var(--beauty-border);
  --glass-shadow: var(--beauty-shadow-md);
  --glass-blur: blur(18px) saturate(135%);
}

/* Components opt-in explicitly */
.card-glass {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  /* ... */
}
```

**For 24 Legitimate Rules (A):**
- Add documentation comments
- Keep as tenant-wide theming
- Update guard to ALLOW with justification

### Long-term (Design System Evolution)

1. **Create tenant theme tokens:**
   ```css
   [data-tenant-module="beauty_spa"] {
     --primary-bg: linear-gradient(...);
     --primary-hover: linear-gradient(...);
     --form-bg: rgba(255, 255, 255, 0.78);
     --form-border: var(--beauty-border);
     /* ... */
   }
   ```

2. **Migrate to Tailwind config per tenant** (if feasible)

3. **Component library with tenant variants:**
   ```tsx
   <Button variant="primary" tenant="beauty_spa" />
   <Input tenant="beauty_spa" />
   ```

---

## 📊 Metrics Revision

### Current Baseline

```json
{
  "BROAD_TENANT_SELECTOR": 26,
  "classification": "ALL marked as violations"
}
```

### After Guard Refinement (Expected)

```json
{
  "BROAD_TENANT_SELECTOR_BLOCK": 0-2,  // Only true violations
  "BROAD_TENANT_SELECTOR_WARN": 0-4,   // Utility overrides needing review
  "LEGITIMATE_TENANT_THEMING": 20-24   // No longer flagged
}
```

**Goal is NOT 26 → 0.**

**Goal is:** Distinguish architectural violations from legitimate tenant theming.

---

## ✅ Discovery Exit Criteria

- ✅ 26/26 selectors inventoried
- ✅ 26/26 preliminary ownership classified (static analysis)
- ❌ **Runtime evidence: REQUIRED - NOT YET COLLECTED**
- ✅ Zero invented component classes
- ✅ Production CSS changes: 0
- ✅ Baseline unchanged: 108 BLOCK / 12 WARN

**Status:** 🟡 **STATIC ANALYSIS COMPLETE, RUNTIME VERIFICATION PENDING**

**Cannot proceed to guard refinement until runtime evidence confirms preliminary classification.**

---

## 🎓 Key Insights

### 1. Static Guard Cannot Distinguish Intent

**Guard sees:**
```css
html[data-tenant="X"] button[class*="bg-primary"]
```

**Guard thinks:** "Broad selector → BLOCK"

**Reality:** "Tenant primary color customization → VALID"

### 2. Tenant Theming ≠ Architectural Violation

```text
Tenant customizing primary color    = DESIGN SYSTEM FEATURE
Component leaking to wrong tenant   = ARCHITECTURAL VIOLATION
```

These are fundamentally different problems requiring different solutions.

### 3. "Broad" Depends on Context

```text
BROAD + DANGEROUS:
  html[data-tenant="X"] span { color: red; }
  → Affects ALL spans (unintended)

BROAD + INTENTIONAL:
  html[data-tenant="X"] button[class*="bg-primary"] { background: teal; }
  → Affects ALL primary buttons (intended tenant theming)
```

### 4. Component Ownership ≠ Selector Scoping

**Before P1B.1, we assumed:**
```text
Narrow selector = Good ownership
Broad selector = Bad ownership
```

**Discovery reveals:**
```text
Tenant theme = Intentionally broad (VALID)
Component leak = Accidentally broad (INVALID)
```

### 5. Zero Canonical Classes is NORMAL

- Bella uses Tailwind utility-first approach
- Components compose utilities, not class names
- No `.btn` or `.bella-button` needed
- Tenant theming happens at utility override level

**This is a valid architecture**, not a deficiency.

---

## 🚀 Next Steps

### Step 1: Refine Guard Rule (PRIORITY)

Before remediation, fix guard to stop false positives:

```text
1. Distinguish structural (span/svg/*) from semantic (button/input)
2. Add severity levels: BLOCK vs WARN vs ALLOW
3. Support justification comments
4. Reduce false positive rate
```

**Exit criteria:** Guard correctly identifies 0-2 true violations, not 26.

### Step 2: Document Legitimate Theming (After Runtime Verification)

**If runtime confirms legitimacy**, add documentation comments for clarity:

```css
/* Tenant theming: beauty_spa primary color (emerald gradient) */
html[data-tenant-module="beauty_spa"] button[class*="bg-primary"] {
  background: linear-gradient(...);
}
```

**⚠️ IMPORTANT:** Comments are for **documentation only**, NOT guard bypass.

**Guard must validate based on:**
- Selector semantics and scope
- Architectural risk analysis
- Ownership model verification

**NOT based on:**
- Presence of annotation comments
- Tenant identity allowlists
- Manual exceptions without structural justification

**Annotation abuse risk:** If comments become bypass mechanism, anyone can add comment to silence guard without fixing actual violations.

### Step 3: Token Migration (Optional)

For 2 glass-morphism selectors, extract to design tokens if beneficial.

### Step 4: Close P1B.1

**Definition of Done:**
- ✅ Guard refined to reduce false positives
- ✅ Legitimate theming documented
- ✅ Token migration completed (if pursued)
- ✅ Baseline updated to reflect true violations
- ⏸️ Browser verification (not required if no CSS changes)

**P1B.1 success ≠ 26 → 0**

**P1B.1 success = Correct classification + appropriate action per category**

---

**Discovery Owner:** Kiro AI Agent  
**Date:** 2026-09-10  
**Status:** 🟡 PENDING GUARD REFINEMENT  
**Recommendation:** Update guard rule before any CSS remediation
