# Waitlist Browser Test Guide

**Date:** 2026-07-12  
**URL:** http://localhost:3000/dashboard/waitlist  
**Status:** ✅ All infrastructure bugs fixed, ready to test

---

## 🎯 PRE-TEST VERIFICATION

### ✅ Completed Fixes
1. ✅ Database migration applied (2 tables created)
2. ✅ API routes created (packages ✅, customers ✅, users ✅)
3. ✅ Email column bug fixed (customers API 500 → 200)
4. ✅ UI upgraded to PremiumSelect (3 dropdowns)

### 🚀 Dev Server Status
- Running: ✅ YES
- Port: 3000
- Process ID: term_1783828759274_klnxor3zf9
- Latest logs show: All APIs returning 200 ✅

---

## 📋 STEP-BY-STEP TESTING CHECKLIST

### STEP 1: Open Waitlist Page

**Action:**
1. Open browser (Chrome/Edge recommended)
2. Navigate to: http://localhost:3000/dashboard/waitlist
3. Wait for page to load

**What to verify:**
- [ ] Page loads without errors
- [ ] "Danh sách chờ" title visible
- [ ] Empty state shows (if no entries yet)
- [ ] "Thêm vào" button visible in top-right

**Expected:**
```
✅ Page renders correctly
✅ No console errors
✅ Button is clickable
```

**Screenshot location:** `screenshots/01-waitlist-page.png`

---

### STEP 2: Open "Add to Waitlist" Modal

**Action:**
1. Click "Thêm vào" button (pink/rose button top-right)
2. Wait for modal to animate in

**What to verify:**
- [ ] Modal slides in with smooth animation
- [ ] White rounded modal visible
- [ ] Title: "Thêm khách vào danh sách chờ"
- [ ] Close button (X) visible top-right
- [ ] Form fields visible

**Expected:**
```
✅ Modal opens smoothly
✅ All form labels visible:
   - Khách hàng *
   - Dịch vụ *
   - Ngày mong muốn *
   - Giờ *
   - Thời lượng (phút)
   - Ưu tiên KTV (tùy chọn)
   - Ghi chú
```

**Screenshot location:** `screenshots/02-modal-open.png`

---

### STEP 3: Test Service Dropdown (PremiumSelect)

**Action:**
1. Click on "Dịch vụ" dropdown
2. Observe animation
3. Scroll through options

**What to verify:**
- [ ] Dropdown opens with fade+scale animation
- [ ] Package icon (📦) visible on each option
- [ ] Real Bella Spa packages loaded from production DB
- [ ] Format: "Package Name - Price VNĐ - Duration phút"
- [ ] Example packages visible:
  - [ ] Combo Mẹ & Bé VIP Toàn Diện
  - [ ] Combo Mẹ & Bé Hạnh Phúc  
  - [ ] Combo Mẹ & Bé Tiết Kiệm
  - [ ] Tắm Bé Chuẩn Y Khoa
  - [ ] Massage Bầu Tại Nhà
- [ ] Hover state works (background changes)
- [ ] Scrollbar appears if >10 options

**Expected:**
```
✅ Smooth animation (not instant)
✅ Icons visible and colored
✅ Real production data (not fake data)
✅ No "Chọn dịch vụ" placeholder in list
✅ Rounded dropdown with shadow
```

**Screenshot location:** `screenshots/03-service-dropdown-open.png`

---

### STEP 4: Select a Package

**Action:**
1. Click any package (e.g., "Combo Mẹ & Bé VIP")
2. Observe selection feedback
3. Verify dropdown closes

**What to verify:**
- [ ] Checkmark (✓) appears next to selected option
- [ ] Selected text turns primary color
- [ ] Dropdown closes automatically
- [ ] Selected package shows in button
- [ ] Package icon visible in closed state

**Expected:**
```
✅ Checkmark visible
✅ Color changes to primary (rose/pink)
✅ Dropdown closes smoothly
✅ Button shows: "Combo Mẹ & Bé VIP - X.XXX.XXX VNĐ - 90 phút"
```

**Screenshot location:** `screenshots/04-package-selected.png`

---

### STEP 5: Test Duration Dropdown

**Action:**
1. Click "Thời lượng (phút)" dropdown
2. Observe options

**What to verify:**
- [ ] Clock icon (⏱️) visible on each option
- [ ] 4 options visible:
  - [ ] 60 phút
  - [ ] 90 phút (default selected)
  - [ ] 120 phút
  - [ ] 180 phút
- [ ] Selected option (90 phút) has checkmark
- [ ] Same animation style as Service dropdown

**Expected:**
```
✅ Clock icons visible
✅ Default selection: 90 phút
✅ Same PremiumSelect styling
```

**Screenshot location:** `screenshots/05-duration-dropdown.png`

---

### STEP 6: Test KTV Dropdown

**Action:**
1. Click "Ưu tiên KTV (tùy chọn)" dropdown
2. Check KTV list

**What to verify:**
- [ ] User icon (👤) visible on each option
- [ ] First option: "Không chỉ định" (default)
- [ ] Real KTV names loaded from production:
  - [ ] Check if you see actual Bella Spa KTV names
  - [ ] Example: "Nguyễn Thị A", "Trần Văn B", etc.
- [ ] No fake/test names like "KTV1", "User123"

**Expected:**
```
✅ User icons visible
✅ "Không chỉ định" is first option
✅ Real KTV names from production DB
✅ Same styling consistency
```

**Screenshot location:** `screenshots/06-ktv-dropdown.png`

---

### STEP 7: Test Customer Search

**Action:**
1. Click in "Khách hàng" search box
2. Type: "Nguyễn" (or any common Vietnamese name)
3. Wait 300ms (debounce)
4. Observe results

**What to verify:**
- [ ] "Đang tìm..." message appears briefly
- [ ] Real customer results appear
- [ ] Format shows:
  - Customer name (mother name)
  - Phone number
  - Tier badge (VIP/LOYAL/NEW)
- [ ] Click on a customer → customer card appears below
- [ ] Card shows:
  - Name + baby name (if any)
  - Phone
  - Tier
  - Total spending
  - "Chọn khách khác" button

**Expected:**
```
✅ Search debounce works (not instant)
✅ Real production customers shown
✅ Tier calculation works (VIP/Loyal/New)
✅ Selected customer card appears
✅ Can deselect and choose another
```

**Screenshot location:** `screenshots/07-customer-search.png`

---

### STEP 8: Test Priority Preview

**Action:**
1. Ensure customer selected
2. Ensure package selected
3. Observe "📊 Dự kiến" blue card

**What to verify:**
- [ ] Blue card appears below form
- [ ] Shows:
  - [ ] Vị trí trong hàng: #X
  - [ ] Điểm ưu tiên: XX/100
  - [ ] Breakdown:
    - Hạng (VIP/Loyal/New): XX điểm
    - Giá trị đơn: XX điểm
    - Linh hoạt: 0 hoặc 10 điểm (if checked)

**Expected:**
```
✅ Preview updates in real-time
✅ VIP customer = 40 points
✅ Loyal customer = 25 points  
✅ New customer = 10 points
✅ Flexibility checkbox adds +10 points
```

**Screenshot location:** `screenshots/08-priority-preview.png`

---

### STEP 9: Test Date & Time Inputs

**Action:**
1. Click "Ngày mong muốn" date picker
2. Select tomorrow's date
3. Click "Giờ" time picker
4. Select "14:00"

**What to verify:**
- [ ] Date picker opens (browser native)
- [ ] Min date = today (cannot select past dates)
- [ ] Time picker shows 24h format
- [ ] Selected values appear in inputs

**Expected:**
```
✅ Date validation works
✅ Time format correct (HH:mm)
✅ No past dates selectable
```

**Screenshot location:** `screenshots/09-date-time-inputs.png`

---

### STEP 10: Test Flexibility Checkbox

**Action:**
1. Check "Có thể nhận lịch thay thế gần giờ mong muốn (+10 điểm ưu tiên)"
2. Observe priority preview update

**What to verify:**
- [ ] Checkbox toggles on/off
- [ ] Priority preview updates immediately
- [ ] "Linh hoạt: 10 điểm" appears in breakdown
- [ ] Total score increases by 10

**Expected:**
```
✅ Checkbox works
✅ Live preview updates
✅ Score changes: e.g., 50 → 60
```

**Screenshot location:** `screenshots/10-flexibility-checked.png`

---

### STEP 11: Test Submit Button States

**Action:**
1. With empty form → observe "Thêm vào hàng" button
2. Fill only customer → button still disabled
3. Fill customer + package + date + time → button enabled

**What to verify:**
- [ ] Button disabled when form incomplete
- [ ] Button shows gray/disabled state
- [ ] Cursor shows "not-allowed"
- [ ] Button enables when all required fields filled
- [ ] Button changes to pink/primary color

**Expected:**
```
✅ Validation works client-side
✅ Cannot submit incomplete form
✅ Button visual states clear
```

**Screenshot location:** `screenshots/11-button-states.png`

---

### STEP 12: Test Form Submission (OPTIONAL)

⚠️ **WARNING:** This will create a real entry in production database!

**Action (ONLY if you want to test end-to-end):**
1. Fill all required fields
2. Click "Thêm vào hàng" button
3. Observe loading state
4. Check toast notification

**What to verify:**
- [ ] Button shows spinner + "Đang thêm..."
- [ ] Toast appears: "Đã thêm vào vị trí #X trong hàng chờ"
- [ ] Modal closes automatically
- [ ] New entry appears in list (refresh page)

**Expected:**
```
✅ Loading state works
✅ Success toast appears
✅ Entry saved to database
✅ Position number shown
```

**Screenshot location:** `screenshots/12-submission-success.png`

---

## 🎨 UI CONSISTENCY CHECK

### PremiumSelect Styling Verification

**Check all 3 dropdowns for:**
- [ ] Rounded corners (rounded-2xl)
- [ ] White background
- [ ] Shadow on hover
- [ ] Primary color focus ring (4px)
- [ ] Icons properly aligned
- [ ] Selected item has checkmark (✓)
- [ ] Selected text is primary color
- [ ] Dropdown max-height with scroll
- [ ] Smooth animations (fade + scale)

**Compare with:**
- Visit: http://localhost:3000/dashboard/customers
- Check "Trạng thái" dropdown
- Should have identical styling

---

## 🐛 ERROR SCENARIOS TO TEST

### Test 1: Network Error Simulation
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Try opening "Dịch vụ" dropdown
4. Observe: Empty dropdown or error message?

### Test 2: Empty Results
1. In "Khách hàng" search
2. Type: "zzzzzzzzz" (gibberish)
3. Observe: "Không tìm thấy" or empty list?

### Test 3: Very Long Package Name
1. Check if any package name is cut off
2. Verify: Text truncation with ellipsis (...)

---

## 📸 SCREENSHOT CHECKLIST

Capture these screenshots and send to verify:

1. ✅ `01-waitlist-page.png` - Empty list page
2. ✅ `02-modal-open.png` - Modal first opened
3. ✅ `03-service-dropdown-open.png` - Packages dropdown
4. ✅ `04-package-selected.png` - Package selected
5. ✅ `05-duration-dropdown.png` - Duration options
6. ✅ `06-ktv-dropdown.png` - KTV list
7. ✅ `07-customer-search.png` - Customer search results
8. ✅ `08-priority-preview.png` - Priority calculation
9. ✅ `09-date-time-inputs.png` - Date/time pickers
10. ✅ `10-flexibility-checked.png` - Checkbox toggled
11. ✅ `11-button-states.png` - Disabled vs enabled
12. ✅ `12-submission-success.png` - Success toast (optional)

---

## ✅ SUCCESS CRITERIA

### Must Pass (Blocking):
- [ ] All 3 dropdowns open and close smoothly
- [ ] Real production data loads (packages, customers, KTVs)
- [ ] No 404 or 500 errors in console
- [ ] Icons visible in all dropdowns
- [ ] Selected items show checkmarks
- [ ] Priority preview calculates correctly

### Nice to Have (Non-blocking):
- [ ] Form submission creates entry successfully
- [ ] Mobile responsive (test on phone)
- [ ] Dark mode works (if enabled)

---

## 🚨 IF YOU ENCOUNTER ERRORS

### Console Errors
1. Open DevTools (F12) → Console tab
2. Screenshot any red errors
3. Look for:
   - 404 errors (API not found)
   - 500 errors (Server error)
   - CORS errors (Cross-origin)
   - Type errors (JS errors)

### Network Errors
1. DevTools → Network tab
2. Filter: XHR/Fetch
3. Check status codes:
   - ✅ 200 = Success
   - ❌ 404 = Not found
   - ❌ 500 = Server error
4. Click failed request → Preview tab → See error message

### Empty Dropdowns
If dropdowns are empty:
1. Check Network tab for API calls
2. Verify:
   - `/api/packages?tenant_id=...` returns 200
   - `/api/users?tenant_id=...` returns 200
   - `/api/customers?tenant_id=...` returns 200
3. Click response → Preview → Verify data structure

---

## 📞 REPORTING RESULTS

After testing, report:

1. **Overall Status:** ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL
2. **Screenshots:** Share 12 screenshots (or subset)
3. **Bugs Found:** List any issues with:
   - What you did
   - What you expected
   - What actually happened
   - Screenshot of error (if any)
4. **Browser Used:** Chrome / Edge / Firefox / Safari
5. **Performance:** Fast / Slow / Laggy

---

**Prepared by:** AI Agent  
**Test Environment:** Local Development (http://localhost:3000)  
**Production Database:** Bella Spa (real data)  
**Status:** ✅ Ready to test (all bugs fixed)

