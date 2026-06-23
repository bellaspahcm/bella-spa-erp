# Device Testing Checklist — iPhone & Android
**Date:** 2026-06-22  
**Purpose:** Verify mobile app works correctly on real devices before Week 4  
**Priority:** 🔴 **BLOCKER** for Week 4 features

---

## 📱 REQUIRED DEVICES

### iPhone Requirements
- [ ] Device: iPhone (any model)
- [ ] iOS Version: 15.0 or higher
- [ ] Expo Go installed (latest version)
- [ ] WiFi + Cellular data available
- [ ] Good battery level (>50%)

**Recommended models:**
- iPhone 12 or newer (best performance)
- iPhone SE 2020 or newer (budget option)

---

### Android Requirements
- [ ] Device: Samsung Galaxy (preferred) or any Android
- [ ] Android Version: 10.0 or higher
- [ ] Expo Go installed (latest version)
- [ ] WiFi + Cellular data available
- [ ] Good battery level (>50%)

**Recommended models:**
- Samsung Galaxy S21 or newer
- Samsung Galaxy A52 or newer (budget option)

---

## 🔧 PRE-TEST SETUP

### 1. Prepare Test Accounts

Create test accounts in database:

```sql
-- Admin test account
INSERT INTO users (id, phone, role, full_name, tenant_id)
VALUES (
  gen_random_uuid(),
  '+84901234567',
  'admin',
  'Admin Test',
  '<your-tenant-id>'
);

-- KTV Test Account A
INSERT INTO users (id, phone, role, full_name, tenant_id, base_salary)
VALUES (
  gen_random_uuid(),
  '+84901234568',
  'ktv',
  'KTV Test A',
  '<your-tenant-id>',
  8000000
);

-- KTV Test Account B
INSERT INTO users (id, phone, role, full_name, tenant_id, base_salary)
VALUES (
  gen_random_uuid(),
  '+84901234569',
  'ktv',
  'KTV Test B',
  '<your-tenant-id>',
  8000000
);
```

---

### 2. Create Test Data

```sql
-- Create test sessions for KTV A (3 sessions)
-- Assign to KTV A via bookings.assigned_ktv_id

-- Create test sessions for KTV B (7 sessions)
-- Assign to KTV B via bookings.assigned_ktv_id
```

**Expected stats:**
- KTV A should see: 3 sessions
- KTV B should see: 7 sessions
- Admin should see: 10 sessions (all)

---

### 3. Install Expo Go

**iPhone:**
1. Open App Store
2. Search "Expo Go"
3. Install

**Android:**
1. Open Google Play Store
2. Search "Expo Go"
3. Install

---

### 4. Start Development Server

```bash
cd "d:\Antigravity\Projects\BELLA SPA ERP"
npm run mobile:dev
```

**Get QR code for testing:**
- iPhone: Scan with Camera app
- Android: Scan with Expo Go app

---

## ✅ TEST SCENARIOS

### Test A: Basic Login Flow (5-10 min per device)

**Objective:** Verify authentication works

**Steps:**

1. **Open app**
   - [ ] App loads without crashing
   - [ ] Login screen appears
   - [ ] UI renders correctly (no blank screens)
   - [ ] Text is readable (contrast is good)

2. **Enter phone number**
   - [ ] Input field accepts numbers
   - [ ] Phone number formats correctly (+84...)
   - [ ] "Gửi mã OTP" button is clickable
   - [ ] Button shows pink color (#E91E63)

3. **Request OTP**
   - [ ] Loading indicator shows
   - [ ] OTP sent successfully (check SMS or logs)
   - [ ] Screen transitions to OTP input

4. **Enter OTP**
   - [ ] 6-digit input works
   - [ ] Can paste OTP from clipboard
   - [ ] "Xác nhận" button is clickable
   - [ ] Loading indicator shows

5. **Login success**
   - [ ] Navigates to dashboard
   - [ ] User name displays correctly
   - [ ] Tenant name displays correctly
   - [ ] Role badge shows correct role

**Test with 3 accounts:**
- [ ] Admin account
- [ ] KTV A account
- [ ] KTV B account

---

### Test B: Dashboard Data Loading (10-15 min per device)

**Objective:** Verify dashboard loads correct data

**Steps:**

1. **Login as Admin**
   - [ ] Dashboard shows "Tổng quan hôm nay"
   - [ ] KPI cards display:
     - [ ] "Lịch hôm nay" with number
     - [ ] "Đang phục vụ" with number
     - [ ] "Doanh thu" with formatted currency
   - [ ] Sessions list shows:
     - [ ] "Lịch hôm nay" title
     - [ ] All tenant sessions (10 in test data)
     - [ ] Customer names visible
     - [ ] KTV names visible
     - [ ] Package names visible

2. **Login as KTV A**
   - [ ] Dashboard shows "Tổng quan hôm nay"
   - [ ] KPI cards display:
     - [ ] "Tổng ca" = 3 ✅ (CRITICAL TEST)
     - [ ] "Hoàn thành" = [correct number]
     - [ ] "Còn lại" = [correct number]
   - [ ] Sessions list shows:
     - [ ] "Lịch của tôi hôm nay" title
     - [ ] Only 3 sessions (not all 10) ✅ (CRITICAL TEST)
     - [ ] All sessions belong to KTV A

3. **Login as KTV B**
   - [ ] KPI shows "Tổng ca" = 7 ✅
   - [ ] Sessions list shows only 7 sessions ✅
   - [ ] All sessions belong to KTV B

**Red flags:**
- ❌ KTV A sees 10 sessions (bug: seeing all spa sessions)
- ❌ KTV B sees 10 sessions (same bug)
- ❌ Numbers don't match between KPIs and list

---

### Test C: Pull-to-Refresh (5 min per device)

**Objective:** Verify refresh mechanism works

**Steps:**

1. **Open dashboard**
   - [ ] Dashboard loads with data

2. **Pull down to refresh**
   - [ ] Pull-down gesture works
   - [ ] Spinner shows while loading
   - [ ] Data refreshes (timestamp updates if visible)
   - [ ] No errors in console

3. **Refresh multiple times quickly**
   - [ ] App doesn't crash
   - [ ] No duplicate data
   - [ ] Loading states handle properly

---

### Test D: Realtime Updates (15 min)

**Objective:** Verify realtime subscription works

**Setup:**
- Device A: Mobile app (logged in as KTV A)
- Device B: Laptop with web dashboard

**Steps:**

1. **Create new session from web (Device B)**
   - Assign session to KTV A
   - Status: pending
   - Scheduled for today

2. **Observe Device A (iPhone/Android)**
   - [ ] New session appears within 5-10 seconds
   - [ ] KPI "Tổng ca" increments by 1
   - [ ] Session appears in list
   - [ ] No need to manual refresh

3. **Update session status from web**
   - Change status from "pending" to "completed"

4. **Observe Device A**
   - [ ] Session status updates automatically
   - [ ] KPI "Hoàn thành" increments
   - [ ] KPI "Còn lại" decrements
   - [ ] Updates within 5-10 seconds

5. **Delete session from web**
   - Delete the test session

6. **Observe Device A**
   - [ ] Session disappears from list
   - [ ] KPIs update correctly
   - [ ] No crash or error

**Red flags:**
- ❌ Realtime doesn't work (need manual refresh)
- ❌ Updates take >30 seconds
- ❌ Duplicate sessions appear

---

### Test E: Offline Behavior (10 min per device)

**Objective:** Verify app handles network loss gracefully

**Steps:**

1. **Load dashboard with data**
   - [ ] Dashboard shows with full data
   - [ ] All KPIs and sessions visible

2. **Turn OFF WiFi**
   - Open device Settings
   - Turn off WiFi

3. **Turn OFF Cellular data**
   - Open device Settings
   - Turn off Mobile Data

4. **Return to app**
   - [ ] Cached data still shows ✅
   - [ ] UI doesn't crash
   - [ ] No blank screens

5. **Try to refresh (pull down)**
   - [ ] Shows error message ✅
   - [ ] Error message is in Vietnamese
   - [ ] Error mentions network issue
   - [ ] UI still functional (not frozen)

6. **Turn ON network**
   - Enable WiFi or Cellular

7. **Pull to refresh**
   - [ ] Data loads successfully
   - [ ] Error message disappears
   - [ ] Fresh data appears

**Red flags:**
- ❌ Blank screen when offline
- ❌ App crashes when offline
- ❌ Can't recover when back online
- ❌ No error message shown

---

### Test F: Background Resume (10 min per device)

**Objective:** Verify app handles backgrounding correctly

**Steps:**

1. **Open app and load dashboard**
   - [ ] Dashboard shows fully

2. **Switch to another app**
   - Press home button
   - Open another app (Safari, Chrome, etc.)
   - Wait 2 minutes

3. **Return to Bella ERP**
   - [ ] App resumes without crash
   - [ ] Data still shows (cached)
   - [ ] Can pull to refresh
   - [ ] No re-login required

4. **Switch away for longer (10 minutes)**
   - Press home button
   - Leave device idle for 10 minutes

5. **Return to Bella ERP**
   - [ ] App resumes without crash
   - [ ] May need to re-authenticate (expected after timeout)
   - [ ] Data loads fresh after login

**Red flags:**
- ❌ App crashes on resume
- ❌ Blank screen on resume
- ❌ Must force-quit and relaunch

---

### Test G: Error Handling (10 min per device)

**Objective:** Verify error states display correctly

**Scenario 1: Force RPC Error**

1. **Temporarily break RPC** (for testing only)
   ```sql
   -- In database, rename function temporarily
   ALTER FUNCTION rpc_mobile_today_sessions RENAME TO rpc_mobile_today_sessions_backup;
   ```

2. **Login to app**
   - [ ] Dashboard attempts to load
   - [ ] Error UI appears (inline or full-screen)
   - [ ] Error message shows in Vietnamese
   - [ ] "Thử lại" button is visible

3. **Press retry button**
   - [ ] Loading indicator shows
   - [ ] Error persists (expected, RPC still broken)
   - [ ] Error message shows again

4. **Restore RPC**
   ```sql
   ALTER FUNCTION rpc_mobile_today_sessions_backup RENAME TO rpc_mobile_today_sessions;
   ```

5. **Press retry again**
   - [ ] Data loads successfully
   - [ ] Error UI disappears
   - [ ] Dashboard shows normally

---

**Scenario 2: Network Timeout**

1. **Turn on airplane mode briefly during load**
   - [ ] Error UI shows
   - [ ] Can retry after network restored

---

### Test H: UI/UX Quality (5 min per device)

**Objective:** Verify app looks and feels good

**Visual checks:**
- [ ] Colors are consistent (pink #E91E63 theme)
- [ ] Text is readable (good contrast)
- [ ] Vietnamese text displays correctly (no boxes/broken characters)
- [ ] Numbers format correctly (8.000.000 VND)
- [ ] Icons display correctly (📅, ⏳, 💰, ✅)
- [ ] No layout overflow or cut-off text
- [ ] Buttons are easy to tap (not too small)

**Performance checks:**
- [ ] Scrolling is smooth (60 FPS)
- [ ] No lag when switching screens
- [ ] Animations are smooth (if any)
- [ ] App feels responsive

**Edge cases:**
- [ ] Long names don't break layout
- [ ] Empty states show properly (no sessions today)
- [ ] Large numbers display correctly (9.999.999 VND)

---

## 📸 DOCUMENTATION REQUIREMENTS

### Screenshots Needed (per device)

1. **Login screen**
   - [ ] Phone input screen
   - [ ] OTP input screen

2. **Dashboard (Admin)**
   - [ ] Full dashboard with data
   - [ ] KPI cards close-up

3. **Dashboard (KTV)**
   - [ ] Full dashboard with data
   - [ ] KPI cards showing correct numbers
   - [ ] Sessions list (only assigned sessions)

4. **Error states**
   - [ ] Inline error (section-level)
   - [ ] Network offline error

5. **Empty state**
   - [ ] Dashboard when no sessions today

### Videos Needed (optional but helpful)

1. **Pull-to-refresh in action** (10 seconds)
2. **Realtime update** (show before/after) (15 seconds)
3. **Offline → Online recovery** (20 seconds)

---

## 🐛 BUG REPORTING FORMAT

**If you find a bug, document it like this:**

```markdown
## Bug #X: [Brief Description]

**Device:** iPhone 13 Pro / Samsung Galaxy S21
**OS Version:** iOS 16.5 / Android 12
**App Version:** Expo Go latest

**Steps to Reproduce:**
1. Step one
2. Step two
3. Step three

**Expected Result:**
[What should happen]

**Actual Result:**
[What actually happened]

**Screenshot:**
[Attach screenshot]

**Severity:**
- 🔴 Critical (blocker)
- 🟡 High (should fix before Week 4)
- 🟢 Low (can defer)

**Logs (if available):**
```
[paste error logs from console]
```
```

---

## ✅ COMPLETION CRITERIA

**Testing is COMPLETE when:**

### Must Have (All devices must pass)
- [x] Login works on both iPhone and Android
- [x] Dashboard loads data
- [x] **KTV sees only their sessions (not all spa sessions)** ⭐
- [x] **KTV stats show correct numbers** ⭐
- [x] Pull-to-refresh works
- [x] Offline behavior is graceful (no crashes)
- [x] Error states display correctly
- [x] All screenshots captured

### Should Have
- [x] Realtime updates work
- [x] Background resume works
- [x] UI looks good on both devices
- [x] Performance is acceptable

### Blocking Issues
- [ ] No 🔴 Critical bugs found
- [ ] All 🟡 High bugs have fixes planned
- [ ] All 🟢 Low bugs documented for later

---

## 📊 TEST RESULTS SUMMARY TEMPLATE

```markdown
# Device Testing Results

**Test Date:** 2026-06-__
**Tester:** __________

## iPhone Testing
**Device:** iPhone ___
**OS Version:** iOS ___
**Status:** ✅ PASS / ❌ FAIL

**Test Results:**
- Test A (Login): ✅ / ❌
- Test B (Dashboard): ✅ / ❌
- Test C (Refresh): ✅ / ❌
- Test D (Realtime): ✅ / ❌
- Test E (Offline): ✅ / ❌
- Test F (Background): ✅ / ❌
- Test G (Errors): ✅ / ❌
- Test H (UI/UX): ✅ / ❌

**Critical Test:**
- KTV sees only assigned sessions: ✅ / ❌
- KTV stats are correct: ✅ / ❌

**Bugs Found:** __ bugs (__ critical, __ high, __ low)

---

## Android Testing
**Device:** Samsung Galaxy ___
**OS Version:** Android ___
**Status:** ✅ PASS / ❌ FAIL

**Test Results:**
- Test A (Login): ✅ / ❌
- Test B (Dashboard): ✅ / ❌
- Test C (Refresh): ✅ / ❌
- Test D (Realtime): ✅ / ❌
- Test E (Offline): ✅ / ❌
- Test F (Background): ✅ / ❌
- Test G (Errors): ✅ / ❌
- Test H (UI/UX): ✅ / ❌

**Critical Test:**
- KTV sees only assigned sessions: ✅ / ❌
- KTV stats are correct: ✅ / ❌

**Bugs Found:** __ bugs (__ critical, __ high, __ low)

---

## Overall Status
**Ready for Week 4:** ✅ YES / ❌ NO

**Blockers (if any):**
[List any critical issues that must be fixed before Week 4]

**Recommendations:**
[Any improvements or follow-up actions]
```

---

## 🚀 NEXT STEPS AFTER TESTING

1. **If all tests PASS:**
   - Fill out test report
   - Attach all screenshots
   - Mark device testing as COMPLETE ✅
   - Move to production pilot (2-3 real KTVs)

2. **If critical bugs found:**
   - Document all bugs clearly
   - Create hotfix branch
   - Fix issues
   - Re-test on devices
   - Repeat until all pass

3. **If minor bugs found:**
   - Document bugs
   - Create issues for Week 4+
   - Can proceed to pilot if non-blocking

---

**Document Owner:** Mobile Development Team  
**Version:** 1.0  
**Status:** Ready for use  
**Estimated Time:** 2-3 hours per device (4-6 hours total)
