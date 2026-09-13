# THEME ARCHITECTURE - BROWSER VERIFICATION MATRIX

Manual testing checklist to verify no CSS leakage between tenant presets.

---

## 🎯 Verification Goals

1. **No stale CSS** when switching tenants
2. **No color inheritance** between tenant presets
3. **Active sidebar state** remains visually distinct from hover
4. **No cross-tenant leakage** in cards, buttons, tables, modals

---

## 🧪 Test Matrix

### Test 1: Tenant Switching Consistency

**Objective:** Verify tenant A → B → C → A produces identical UI

**Steps:**
1. Login as tenant with `jade_wellness` preset
2. Navigate to Dashboard
3. Note exact colors of:
   - Sidebar background
   - Active menu item
   - Hover menu item (non-active)
   - Card backgrounds
   - Primary buttons
4. Switch tenant to `luxury_navy` preset
5. Verify all colors changed to navy/gold
6. Switch to `ocean_clean` preset
7. Verify all colors changed to blue
8. Switch back to `jade_wellness`
9. **VERIFY:** Colors match step 3 exactly (no stale CSS)

**Expected Result:**
```
jade_wellness:
  - Sidebar: Dark emerald gradient
  - Active item: Translucent emerald + white text + gold icon
  - Hover: Semi-transparent white background

luxury_navy:
  - Sidebar: Navy blue gradient
  - Active item: Translucent emerald + white text + amber icon
  - Hover: Semi-transparent white background

ocean_clean:
  - Sidebar: Blue gradient
  - Active item: Translucent emerald + white text + blue icon
  - Hover: Light blue background
```

**Pass Criteria:** ✅ Colors consistent on repeat, no leakage

---

### Test 2: Active vs Hover State Distinction

**Objective:** Verify active sidebar item always visually distinct from hover

**Steps:**
1. Navigate to Dashboard (active item)
2. Hover over "Customers" menu item (inactive)
3. **VERIFY:** Hover state is different from active
4. Hover over "Dashboard" menu item (active)
5. **VERIFY:** Active state remains dominant (not overridden by hover)
6. Repeat for all tenant presets

**Expected Result:**
```
Active state (Dashboard):
  - Background: Emerald gradient
  - Text: White, bold
  - Icon: Gold with glow

Hover on inactive (Customers):
  - Background: Semi-transparent white
  - Text: White
  - Icon: Amber

Hover on active (Dashboard):
  - Background: SAME emerald gradient (slightly brighter)
  - Text: STILL white, bold
  - Icon: STILL gold with glow
```

**Pass Criteria:** ✅ Active state never looks like inactive hover

---

### Test 3: Component Isolation Test

**Objective:** Verify modals, popovers, cards maintain tenant styling

**Steps:**
1. Login as `jade_wellness` tenant
2. Open "New Customer" modal
3. **VERIFY:** Modal buttons use emerald colors
4. Open user profile popover
5. **VERIFY:** Popover uses emerald accent
6. Switch tenant to `luxury_navy`
7. Open same modal
8. **VERIFY:** Modal buttons now use navy/amber colors
9. **VERIFY:** No emerald colors remain from previous tenant

**Expected Result:**
```
jade_wellness modal:
  - Primary button: Emerald background
  - Border: Gold accent
  - Card: Warm white

luxury_navy modal:
  - Primary button: Navy background
  - Border: Amber accent
  - Card: Cool white
```

**Pass Criteria:** ✅ No color leakage, components fully tenant-scoped

---

### Test 4: Dark Mode Consistency

**Objective:** Verify tenant colors work in both light and dark mode

**Steps:**
1. Login as `jade_wellness` tenant (light mode)
2. Note sidebar colors
3. Toggle dark mode
4. **VERIFY:** Sidebar remains emerald (darker shade)
5. **VERIFY:** Text remains legible
6. Switch to `luxury_navy` tenant (dark mode)
7. **VERIFY:** Sidebar changes to navy (darker shade)
8. Toggle light mode
9. **VERIFY:** Sidebar changes to navy (lighter shade)

**Expected Result:**
```
Light mode - jade_wellness:
  - Sidebar: #074e44 (emerald 700)
  - Text: #ffffff

Dark mode - jade_wellness:
  - Sidebar: #042f2e (emerald 900)
  - Text: #f0fdf4 (emerald 50)

Light mode - luxury_navy:
  - Sidebar: #1e3a8a (blue 800)
  - Text: #ffffff

Dark mode - luxury_navy:
  - Sidebar: #1e293b (slate 800)
  - Text: #f1f5f9 (slate 100)
```

**Pass Criteria:** ✅ Both modes work, colors remain distinct

---

### Test 5: Cross-Component Leakage Test

**Objective:** Verify global selectors don't leak styles

**Steps:**
1. Login as `beauty_spa` tenant
2. Navigate to page with:
   - Data table
   - Form inputs
   - Buttons
   - Cards
3. Inspect each component type
4. **VERIFY:** No unexpected colors
5. Switch to `bella_healthcare` tenant
6. **VERIFY:** All components changed colors
7. **VERIFY:** No beauty_spa green remains

**Expected Result:**
```
beauty_spa:
  - Tables: Emerald headers
  - Inputs: Emerald focus border
  - Buttons: Emerald primary
  - Cards: Warm background

bella_healthcare:
  - Tables: Teal headers
  - Inputs: Teal focus border
  - Buttons: Teal primary
  - Cards: Clinical white background
```

**Pass Criteria:** ✅ No broad selector leakage, all scoped correctly

---

## 🌐 Browser Matrix

Test on each browser:

| Browser | Version | Desktop | Tablet | Mobile |
|---------|---------|---------|--------|--------|
| Chrome | 130+ | ✅ | ✅ | ✅ |
| Safari | 18+ | ✅ | ✅ | ✅ |
| Firefox | 133+ | ✅ | ✅ | N/A |
| Edge | 130+ | ✅ | N/A | N/A |

**Viewports:**
- Desktop: 1920x1080
- Laptop: 1366x768
- Tablet: 768x1024
- Mobile: 375x667

---

## 📝 Test Report Template

```markdown
## Browser Verification Report

**Date:** YYYY-MM-DD
**Tester:** [Name]
**Build:** [Git commit SHA]

### Test Results

| Test | Chrome | Safari | Firefox | Edge | Status |
|------|--------|--------|---------|------|--------|
| 1. Tenant Switching | ✅ | ✅ | ✅ | ✅ | PASS |
| 2. Active vs Hover | ✅ | ⚠️ | ✅ | ✅ | WARN |
| 3. Component Isolation | ✅ | ✅ | ✅ | ✅ | PASS |
| 4. Dark Mode | ✅ | ✅ | ✅ | ✅ | PASS |
| 5. Cross-Component | ❌ | ✅ | ✅ | ✅ | FAIL |

### Issues Found

**Issue #1:** Safari - Active hover state briefly shows incorrect color
- Severity: Low
- Impact: 1-frame flicker on fast hover
- Fix: Add `will-change: background` to active items

**Issue #2:** Chrome - Table header leaks green in healthcare tenant
- Severity: High
- Impact: Wrong brand colors displayed
- Fix: Scope `.bella-data-table thead` selector to tenant

### Recommendation

- ✅ PASS with minor issues
- Fix Issue #2 before production deployment
```

---

## 🤖 Automated Visual Regression (Future)

**Tool:** Playwright + Percy/Chromatic

**Script location:** `tests/visual/theme-verification.spec.ts`

**Coverage:**
- Screenshot each tenant preset
- Compare against baseline
- Detect pixel-level changes
- Alert on unexpected color shifts

**Run command:**
```bash
npm run test:visual:theme
```

---

## ✅ Sign-off Checklist

Before marking verification complete:

- [ ] All 5 tests executed on 4 browsers
- [ ] No FAIL results (WARN acceptable if documented)
- [ ] Dark mode tested for all tenants
- [ ] Mobile viewport tested (375px width)
- [ ] Report filed in `docs/verification/`
- [ ] Screenshots attached for any issues
- [ ] Guard reports 0 BLOCK violations
- [ ] Product owner approved visual consistency

---

**Status:** ⏳ **PENDING** - Cannot execute until 108 BLOCK violations fixed  
**Next Action:** Complete Phase 1B (fix remaining violations), then run verification  
**Estimated Time:** 2-3 hours for full manual verification across all browsers
