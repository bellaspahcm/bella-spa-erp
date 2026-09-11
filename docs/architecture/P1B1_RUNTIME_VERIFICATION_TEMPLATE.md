# P1B.1 RUNTIME VERIFICATION TEMPLATE

**Status:** 🟡 IN PROGRESS  
**Verifier:** [Name]  
**Date:** [YYYY-MM-DD]  
**Environment:** [Browser/OS]

---

## 🎯 Verification Objectives

**Convert preliminary static classification into runtime-backed evidence.**

**Required for each selector:**
- ✅ Actual DOM match count
- ✅ Expected match count
- ✅ Unexpected matches identified
- ✅ Missing expected matches identified
- ✅ Cross-component leakage detected/absent
- ✅ Cross-tenant leakage detected/absent
- ✅ Runtime ownership verdict

---

## 🧪 Test Environment Setup

```bash
# 1. Start development server
npm run dev

# 2. Open browser to: http://localhost:3000

# 3. Install browser extension for CSS debugging (optional but recommended):
#    - Chrome DevTools > Elements > Computed Styles
#    - Firefox Developer Tools > Inspector

# 4. Have this template open for recording findings
```

**⚠️ Testing Strategy:**

Do NOT mechanically test "26 selectors × 3 tenants".

**Instead:**
- Test each selector on its **actual affected tenant/route**
- Then test **tenant switching** to detect cross-tenant leakage
- Focus on routes where selector is expected to match

**Example:**
```text
Selector: html[data-tenant="beauty_spa"] button[class*="bg-primary"]
Test: beauty_spa routes (expected matches)
Then: Switch to industrial_cleaning (verify no leakage)
Then: Switch back to beauty_spa (verify no stale CSS)
```

This approach is more accurate and efficient than exhaustive cross-product testing.

---

## 📋 Verification Procedure

### Step 1: For Each Tenant

Navigate to tenant-specific routes:

**beauty_spa routes:**
- `/dashboard` (or main route for beauty_spa)
- Any route with forms (inputs)
- Any route with primary buttons
- Any route with cards/sections

**industrial_cleaning routes:**
- `/dashboard` (or main route for industrial_cleaning)
- Any route with primary/action buttons

**pending routes:**
- Any route showing "pending" state
- Look for card overlays with transparency

### Step 2: For Each Selector

**Use browser DevTools Console:**

```javascript
// Count matches for selector
const selector = 'html[data-tenant-module="beauty_spa"] button[class*="bg-primary"]';
const matches = document.querySelectorAll(selector);
console.log(`Matches: ${matches.length}`);
console.log('Elements:', matches);

// Inspect computed styles
matches.forEach((el, i) => {
  console.log(`Element ${i}:`, {
    tag: el.tagName,
    classes: el.className,
    computed: window.getComputedStyle(el).background
  });
});
```

**Record in table below.**

### Step 3: Tenant Switching Test

```text
1. Start in beauty_spa tenant
2. Note button/form colors
3. Switch to industrial_cleaning
4. Verify colors changed
5. Switch to pending
6. Verify colors changed
7. Switch back to beauty_spa
8. Verify colors match step 2 (no stale CSS)
```

### Step 4: Interactive State Testing

For button/input selectors, test:

```text
- Default state
- :hover (mouse over)
- :focus (tab/click into input)
- :active (button press)
- :disabled (if applicable)
```

---

## 📊 Verification Results

### Group 1: Pending Module

#### V1-V2: Transparent Card Backgrounds

**Selector:**
```css
html[data-tenant-module="pending"] div[class*="bg-white/30"],
html[data-tenant-module="pending"] div[class*="bg-white/50"]
```

**Route Tested:** _______________

**DOM Inspection:**
- Expected matches: _____ (cards/sections with transparency)
- Actual matches: _____
- Unexpected elements: _____ (list if any)
- Missing expected: _____ (list if any)

**Computed Styles:**
```
Sample element 1:
  background: _____
  border-color: _____
  box-shadow: _____
  backdrop-filter: _____

Sample element 2:
  ...
```

**Cross-Component Leakage:**
- Detected: YES / NO
- If YES, describe: _____

**Cross-Tenant Leakage:**
- Detected: YES / NO
- Test: Switched from pending → beauty_spa → pending
- Result: _____

**Runtime Ownership Verdict:**
- [ ] ✅ EXACT (matches only intended elements)
- [ ] 🟡 BROAD-BUT-INTENTIONAL (matches more than intended but acceptable)
- [ ] 🔴 LEAKING (matches unintended components/tenants)
- [ ] ⚫ ZERO-MATCH (selector matches nothing)

**Final Classification:**
- [ ] A (Legitimate tenant-wide rule)
- [ ] B (Existing canonical component owner)
- [ ] C (Semantic component needed)
- [ ] D (Token migration candidate)
- [ ] E (Ambiguous/unsafe)

**Notes:** _____

---

### Group 2: Beauty Spa Module

#### V3: Button Icon Colors

**Selector:**
```css
html[data-tenant-module="beauty_spa"] button svg
```

**Route Tested:** _______________

**DOM Inspection:**
- Expected matches: _____ (icons inside buttons)
- Actual matches: _____
- Unexpected elements: _____ (standalone SVGs? non-button icons?)
- Missing expected: _____

**Computed Styles:**
```
Button icon 1:
  color: _____ (should inherit from button)
  
Button icon 2:
  color: _____
```

**Intentional Scope:**
- Should match: Icons inside `<button>` elements
- Should NOT match: Standalone icons, non-button icons

**Cross-Component Leakage:**
- Detected: YES / NO
- If YES, describe: _____

**Cross-Tenant Leakage:**
- Detected: YES / NO
- Test: beauty_spa → industrial_cleaning
- Result: _____

**Runtime Ownership Verdict:**
- [ ] ✅ EXACT
- [ ] 🟡 BROAD-BUT-INTENTIONAL
- [ ] 🔴 LEAKING
- [ ] ⚫ ZERO-MATCH

**Final Classification:**
- [ ] A - Legitimate tenant-wide icon inheritance rule
- [ ] Other: _____

**Notes:** _____

---

#### V4-V5: Card Glass Effects

**Selector:**
```css
html[data-tenant-module="beauty_spa"] div[class*="bg-white/30"],
html[data-tenant-module="beauty_spa"] div[class*="bg-white/50"]
```

**Route Tested:** _______________

**DOM Inspection:**
- Expected matches: _____ (cards, modals with transparency)
- Actual matches: _____
- Unexpected elements: _____ (describe)
- Missing expected: _____

**Computed Styles:**
```
Card 1:
  background: _____
  backdrop-filter: _____
  
Modal 1:
  background: _____
  backdrop-filter: _____
```

**Cross-Component Leakage:**
- Detected: YES / NO
- Unexpected components affected: _____

**Runtime Ownership Verdict:**
- [ ] ✅ EXACT
- [ ] 🟡 BROAD-BUT-INTENTIONAL
- [ ] 🔴 LEAKING
- [ ] ⚫ ZERO-MATCH

**Final Classification:**
- [ ] A (if intentional glass effect for all transparent elements)
- [ ] D (if should be design token instead)

**Notes:** _____

---

#### V6-V13: Primary Button/Link Color Overrides

**Selector (Base):**
```css
html[data-tenant-module="beauty_spa"] button[class*="bg-primary"]
html[data-tenant-module="beauty_spa"] a[class*="bg-primary"]
```

**Selector (Hover):**
```css
html[data-tenant-module="beauty_spa"] button[class*="bg-primary"]:hover
html[data-tenant-module="beauty_spa"] a[class*="bg-primary"]:hover
```

**Route Tested:** _______________

**DOM Inspection:**
- Expected matches: _____ (primary action buttons/links)
- Actual matches (buttons): _____
- Actual matches (links): _____
- Unexpected elements: _____
- Missing expected: _____

**Computed Styles:**
```
Primary button (default):
  background: _____ (should be emerald gradient)
  
Primary button (hover):
  background: _____ (should be darker gradient)
  
Primary link (default):
  background: _____
```

**Interactive State Testing:**
- [ ] Default state: _____
- [ ] :hover tested: YES / NO - Result: _____
- [ ] Gradient applied: YES / NO
- [ ] Emerald color (not pink): YES / NO

**Intent Verification:**
- This selector remaps Tailwind `bg-primary` → beauty_spa emerald gradient
- Expected: ALL elements with `bg-primary` class should use emerald
- Actual: _____

**Cross-Component Leakage:**
- Detected: YES / NO
- Should affect: Primary buttons across ALL components
- Unexpected: _____

**Cross-Tenant Leakage:**
- Detected: YES / NO
- Test: beauty_spa → industrial_cleaning → beauty_spa
- Result: _____

**Runtime Ownership Verdict:**
- [ ] ✅ EXACT
- [ ] 🟡 BROAD-BUT-INTENTIONAL (tenant-wide primary color override)
- [ ] 🔴 LEAKING
- [ ] ⚫ ZERO-MATCH

**Final Classification:**
- [ ] A - Legitimate tenant primary color customization
- [ ] Other: _____

**Notes:** _____

---

#### V14-V16: Form Input Styling

**Selector (Base):**
```css
html[data-tenant-module="beauty_spa"] input:not([type="checkbox"]):not([type="radio"])
html[data-tenant-module="beauty_spa"] select
html[data-tenant-module="beauty_spa"] textarea
```

**Selector (Focus):**
```css
html[data-tenant-module="beauty_spa"] input:not([type="checkbox"]):not([type="radio"]):focus
...
```

**Route Tested:** _______________

**DOM Inspection:**
- Expected matches (inputs): _____
- Expected matches (selects): _____
- Expected matches (textareas): _____
- Actual matches (inputs): _____
- Actual matches (selects): _____
- Actual matches (textareas): _____
- Unexpected elements: _____

**Computed Styles:**
```
Text input (default):
  background: _____ (should be rgba(255, 255, 255, 0.78))
  border-color: _____
  
Text input (focus):
  border-color: _____ (should be beauty emerald)
  box-shadow: _____
```

**Interactive State Testing:**
- [ ] Default state: _____
- [ ] :focus tested (tab into input): YES / NO - Result: _____
- [ ] Beauty theme applied: YES / NO
- [ ] Checkboxes excluded: YES / NO
- [ ] Radio buttons excluded: YES / NO

**Intent Verification:**
- Should match: ALL text inputs, selects, textareas
- Should NOT match: checkboxes, radio buttons
- Actual: _____

**Cross-Component Leakage:**
- Detected: YES / NO
- Should affect: Forms across ALL components
- Unexpected: _____

**Cross-Tenant Leakage:**
- Detected: YES / NO

**Runtime Ownership Verdict:**
- [ ] ✅ EXACT
- [ ] 🟡 BROAD-BUT-INTENTIONAL (tenant-wide form styling)
- [ ] 🔴 LEAKING
- [ ] ⚫ ZERO-MATCH

**Final Classification:**
- [ ] A - Legitimate tenant form styling
- [ ] Other: _____

**Notes:** _____

---

### Group 3: Industrial Cleaning Module

#### V17-V26: Rose-to-Teal Button Color Remap

**Selector (Base):**
```css
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-500"]
html[data-tenant-module="industrial_cleaning"] button[class*="bg-rose-600"]
html[data-tenant-module="industrial_cleaning"] a[class*="bg-rose-500"]
html[data-tenant-module="industrial_cleaning"] a[class*="bg-rose-600"]
```

**Selector (Hover):**
```css
... :hover
```

**Route Tested:** _______________

**DOM Inspection:**
- Expected matches (buttons): _____
- Expected matches (links): _____
- Actual matches (buttons): _____
- Actual matches (links): _____
- Unexpected elements: _____

**Computed Styles:**
```
Rose button (default):
  background-color: _____ (should be #2D93AE teal, NOT rose)
  
Rose button (hover):
  background-color: _____ (should be #0C3776 blue)
```

**Color Remap Verification:**
- Original Tailwind color: Rose (pink)
- Industrial cleaning brand color: Teal/Blue
- Selector remaps: rose → teal
- Actual displayed color: _____
- Remap working: YES / NO

**Interactive State Testing:**
- [ ] Default state: Teal (not rose)
- [ ] :hover tested: YES / NO - Result: Dark blue (not darker rose)

**Intent Verification:**
- Industrial cleaning brand ≠ rose/pink
- This selector remaps rose palette → teal/blue
- Expected: Global color override for tenant
- Actual: _____

**Cross-Component Leakage:**
- Detected: YES / NO
- Should affect: ALL buttons/links with rose colors
- Unexpected: _____

**Cross-Tenant Leakage:**
- Detected: YES / NO
- Test: industrial_cleaning → beauty_spa
- Beauty spa should still have rose (not remapped): _____

**Runtime Ownership Verdict:**
- [ ] ✅ EXACT
- [ ] 🟡 BROAD-BUT-INTENTIONAL (tenant palette customization)
- [ ] 🔴 LEAKING
- [ ] ⚫ ZERO-MATCH

**Final Classification:**
- [ ] A - Legitimate tenant color palette remap
- [ ] Other: _____

**Notes:** _____

---

## 📊 Summary of Findings

### Verification Statistics

```text
Total selectors verified:           ____ / 26
Runtime evidence collected:         ____ / 26
Tenant switching tests passed:      ____ / 3

Classification changes from static analysis:
  A → other:                        ____
  D → A:                            ____
  A → E:                            ____
```

### Final Classification

| Category | Count | Description |
|----------|-------|-------------|
| **A - Legitimate Tenant-Wide** | ____ | Valid theming (runtime confirmed) |
| **B - Existing Canonical** | ____ | Use existing component class |
| **C - Semantic Component Needed** | ____ | Create new component class |
| **D - Token Migration** | ____ | Extract to design tokens |
| **E - Ambiguous/Unsafe** | ____ | Requires architecture review |
| **ZERO-MATCH** | ____ | Selector matches nothing |
| **LEAKING** | ____ | Cross-component/tenant leakage |

### Runtime Ownership Verdicts

- ✅ EXACT: ____
- 🟡 BROAD-BUT-INTENTIONAL: ____
- 🔴 LEAKING: ____
- ⚫ ZERO-MATCH: ____

### Critical Findings

**True architectural violations found:** ____

**False positives confirmed:** ____

**Leakage detected:** ____

**Zero-match selectors:** ____

---

## 🎯 Recommendations

**Based on runtime evidence:**

### If 24/26 confirmed as legitimate (A):

✅ **Refine guard rule** to distinguish theming from leakage
- Update `BROAD_TENANT_SELECTOR` logic
- Add BLOCK/ALLOW test fixtures
- Reduce false-positive rate

✅ **Document tenant theming patterns**
- Add comments to legitimate rules
- Create tenant theming guide

✅ **Update baseline** after guard refinement
- Re-run guard against repository
- Regenerate baseline from corrected detector

### If true violations found:

❌ **Address violations first** before guard refinement
- Fix cross-component leakage
- Fix zero-match selectors
- Fix cross-tenant leakage

### If classification unclear:

⚠️ **Escalate to architecture review**
- Document ambiguous cases
- Propose alternative approaches
- Get stakeholder decision

---

## ✅ Sign-Off

**Verifier:** _______________  
**Date:** _______________  
**Status:** _______________  
**Runtime Evidence:** COMPLETE / INCOMPLETE  
**Recommendation:** _______________

---

**Next Steps:**
1. [ ] Complete all 26 selector verifications
2. [ ] Finalize classification based on runtime evidence
3. [ ] Document findings in `P1B1_RUNTIME_VERIFICATION.md`
4. [ ] Proceed to guard refinement with confirmed data
5. [ ] Add regression test fixtures
6. [ ] Regenerate baseline
7. [ ] Close P1B.1
