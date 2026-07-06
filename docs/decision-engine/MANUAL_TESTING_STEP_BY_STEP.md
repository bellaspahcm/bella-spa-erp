# Manual Testing Guide - Overbooking Detection
## Step-by-Step Instructions

**Date**: June 22, 2026  
**Duration**: 30 minutes  
**Priority**: 🔴 CRITICAL  
**Goal**: Verify overbooking detection works in production

---

## 📋 Pre-Test Checklist

### ✅ Before You Start

- [ ] Production code deployed (commit: `272efde6`)
- [ ] Browser ready (Chrome/Edge recommended)
- [ ] DevTools open (F12) - to check console errors
- [ ] This document open - to record results
- [ ] 30 minutes available

### 🎯 What We're Testing

```
3 Critical Scenarios (MUST PASS):
  1. Happy Path - Booking works normally
  2. KTV Conflict - Blocks double-booking
  3. Room Conflict - Blocks double-booking

5 Optional Scenarios (nice to have):
  4. Soft Limit - Warning at 9 sessions
  5. Hard Limit - Block at 10 sessions
  6. No KTV - Skips check
  7. No Date - Skips check
  8. Adjacent Times - Allows non-overlap
```

---

## 🚀 Test Execution

### 🔐 Step 1: Login to Test Beauty Spa (2 minutes)

**Action**:
1. Open browser: `https://[your-domain].vercel.app`
2. Login với Test Beauty Spa account
3. Verify tenant context

**How to verify tenant**:
```javascript
// Open DevTools Console (F12)
// Run this command:
localStorage.getItem('tenant_id')

// Should see: "11111111-1111-1111-1111-111111111111"
// If NOT, switch to Test Beauty Spa tenant
```

**Expected**:
- ✅ Login successful
- ✅ Tenant ID matches Test Beauty Spa
- ✅ Can see dashboard

**If failed**:
- Check account credentials
- Verify Test Beauty Spa tenant exists
- Check network connection

**Record Result**:
```
[ ] ✅ PASS - Logged in successfully
[ ] ❌ FAIL - Could not login: _________________
```

---

### 📦 Step 2: Navigate to Bookings Page (1 minute)

**Action**:
1. Click sidebar menu
2. Navigate to `/dashboard/bookings`
3. Wait for page to load

**Expected**:
- ✅ Bookings page loads
- ✅ Can see bookings list or calendar
- ✅ See "Tạo lịch hẹn mới" button
- ✅ No console errors (check F12)

**If failed**:
- Check URL is correct: `/dashboard/bookings`
- Refresh page (Ctrl+Shift+R)
- Check console for errors

**Record Result**:
```
[ ] ✅ PASS - Bookings page loaded
[ ] ❌ FAIL - Page error: _________________
```

---

### ✅ TEST 1: Happy Path - Normal Booking (5 minutes)

**Goal**: Verify booking works without conflicts

**Action**:
1. Click "Tạo lịch hẹn mới" button
2. Fill form:
   ```
   Booking/Khách hàng: [Select any existing booking]
   Ngày: Hôm nay (today's date)
   Giờ: 09:00 (pick empty time slot)
   Phòng: [Select any room - optional]
   Ghi chú: "Test 1 - Happy Path"
   ```
3. Click "Tạo lịch" button
4. Observe result

**Expected**:
- ✅ Toast message: "Đã tạo lịch hẹn mới thành công!"
- ✅ Modal closes automatically
- ✅ New session appears on timeline/calendar
- ✅ No error toasts
- ✅ Console shows no errors

**If WARNING toast appears**:
- ⚠️ "Cảnh báo: Vượt quá số ca khuyến nghị" = OK (soft limit)
- This is expected if KTV already has 9+ sessions today
- Booking should still be created ✅

**If ERROR toast appears**:
- ❌ This is UNEXPECTED for Test 1
- Check console for errors
- Take screenshot
- Record error message

**Record Result**:
```
[ ] ✅ PASS - Booking created successfully
    Toast: "Đã tạo lịch hẹn mới thành công!"
    Session visible on timeline: Yes/No
    Console errors: None

[ ] ⚠️ PASS WITH WARNING - Booking created with warning
    Warning: "_________________________________"
    Reason: Soft limit triggered (>8 sessions)

[ ] ❌ FAIL - Booking blocked or error
    Error: "_________________________________"
    Screenshot: _____________________________
```

**Screenshot Checklist**:
- [ ] Success toast visible
- [ ] New session on timeline
- [ ] Console tab (no errors)

---

### ❌ TEST 2: KTV Double-Booking (10 minutes)

**Goal**: Verify system blocks conflicting KTV bookings

**Setup** (5 minutes):
1. Note down the KTV and time from Test 1
   ```
   KTV: ________________
   Time: 09:00
   Date: ________________
   ```

2. Verify Test 1 booking exists:
   - Check timeline/calendar
   - Confirm session is visible
   - If not visible, repeat Test 1 first

**Action** (5 minutes):
1. Click "Tạo lịch hẹn mới" again
2. Fill form with CONFLICTING data:
   ```
   Booking/Khách hàng: [Select DIFFERENT booking]
   KTV: [SAME KTV as Test 1] ← IMPORTANT
   Ngày: [SAME date as Test 1]
   Giờ: 09:30 ← Overlaps with 09:00-10:30
   Phòng: [DIFFERENT room or none]
   Ghi chú: "Test 2 - KTV Conflict"
   ```
3. Click "Tạo lịch" button
4. Observe result

**Expected** (MUST see ALL of these):
- ❌ Toast Error (red): "Không thể tạo lịch hẹn do xung đột"
- ❌ Toast Error (red): "⚠️ KTV đã có lịch lúc 09:00 với khách [Customer Name]"
- ✅ Modal STAYS OPEN (does not close)
- ✅ Booking NOT created (check timeline)
- ✅ Console shows decision log (optional)

**If booking WAS created**:
- 🚨 CRITICAL BUG - Overbooking detection NOT working
- Take screenshot immediately
- Check console errors
- Record all details

**If no error toast**:
- 🚨 CRITICAL BUG - Decision not blocking
- Verify KTV is the same
- Verify time overlaps (09:30 overlaps 09:00-10:30)
- Check console errors

**Record Result**:
```
[ ] ✅ PASS - Booking blocked correctly
    Error toast 1: "Không thể tạo lịch hẹn do xung đột"
    Error toast 2: "⚠️ KTV đã có lịch lúc 09:00 với khách ___"
    Modal stayed open: Yes
    Booking NOT created: Confirmed
    Console errors: None (decision logs OK)

[ ] ❌ FAIL - Booking NOT blocked (CRITICAL BUG)
    Booking was created: Yes/No
    Error toasts shown: Yes/No
    Error messages: "_________________________________"
    Screenshot: _____________________________
```

**Screenshot Checklist**:
- [ ] Both error toasts visible
- [ ] Modal still open
- [ ] Timeline shows NO new booking
- [ ] Console tab

**Debug Steps if Failed**:
1. Check console for decision log:
   ```javascript
   // Should see something like:
   [checkBookingConflicts] Decision: REJECT
   [checkBookingConflicts] Reason: KTV đã có lịch...
   ```

2. Verify Test 1 booking still exists
3. Verify same KTV selected
4. Verify time overlap calculation correct

---

### ❌ TEST 3: Room Double-Booking (10 minutes)

**Goal**: Verify system blocks conflicting room bookings

**Setup** (5 minutes):
1. Create a fresh booking with a room:
   ```
   Booking/Khách hàng: [Select any]
   KTV: [Select KTV A]
   Ngày: Hôm nay
   Giờ: 14:00
   Phòng: "Phòng VIP 1" ← IMPORTANT: Pick specific room
   Ghi chú: "Test 3 Setup - Room booking"
   ```
2. Verify booking created successfully
3. Note down room name: ________________

**Action** (5 minutes):
1. Click "Tạo lịch hẹn mới" again
2. Fill form with CONFLICTING room:
   ```
   Booking/Khách hàng: [Select DIFFERENT booking]
   KTV: [Select DIFFERENT KTV B] ← NOT same KTV
   Ngày: [SAME date]
   Giờ: 14:30 ← Overlaps with 14:00-15:30
   Phòng: "Phòng VIP 1" ← SAME room as setup
   Ghi chú: "Test 3 - Room Conflict"
   ```
3. Click "Tạo lịch" button
4. Observe result

**Expected** (MUST see ALL of these):
- ❌ Toast Error (red): "Không thể tạo lịch hẹn do xung đột"
- ❌ Toast Error (red): "⚠️ Phòng Phòng VIP 1 đã có lịch lúc 14:00"
- ✅ Modal STAYS OPEN
- ✅ Booking NOT created
- ✅ Console shows decision log

**If booking WAS created**:
- 🚨 CRITICAL BUG - Room overbooking detection NOT working
- Take screenshot
- Check console errors

**Record Result**:
```
[ ] ✅ PASS - Room conflict blocked correctly
    Error toast 1: "Không thể tạo lịch hẹn do xung đột"
    Error toast 2: "⚠️ Phòng Phòng VIP 1 đã có lịch lúc 14:00"
    Modal stayed open: Yes
    Booking NOT created: Confirmed
    Console errors: None

[ ] ❌ FAIL - Room conflict NOT blocked (CRITICAL BUG)
    Booking was created: Yes/No
    Error messages: "_________________________________"
    Screenshot: _____________________________
```

**Screenshot Checklist**:
- [ ] Both error toasts visible
- [ ] Modal still open
- [ ] Timeline shows NO new conflicting booking
- [ ] Console tab

---

## 🎉 Test Results Summary

### Critical Tests (MUST PASS)

```
Test 1: Happy Path
[ ] ✅ PASS
[ ] ❌ FAIL

Test 2: KTV Conflict
[ ] ✅ PASS
[ ] ❌ FAIL

Test 3: Room Conflict
[ ] ✅ PASS
[ ] ❌ FAIL
```

**Overall Result**:
```
[ ] ✅ ALL PASSED - Ready for production use
[ ] ⚠️ PARTIAL - Some tests failed (needs investigation)
[ ] ❌ FAILED - Critical bugs found (needs fix)
```

---

## 📊 Post-Test Actions

### If ALL TESTS PASSED ✅

**Congratulations!** Overbooking detection is working.

**Next Steps**:
1. ✅ Update Week 1 progress: 85% → 90%
2. ✅ Mark manual testing as complete
3. ⏳ Start collecting real booking decisions
4. ⏳ Monitor for 7 days
5. ⏳ Move to Week 2 tasks (replay validation)

**Update Document**:
```markdown
## Week 1 Manual Testing
**Status**: ✅ COMPLETE
**Date**: [Today's date]
**Result**: All 3 critical tests passed
**Tester**: [Your name]
**Evidence**: Screenshots attached
```

---

### If ANY TEST FAILED ❌

**Don't panic!** This is why we test.

**Immediate Actions**:
1. 🔍 Take screenshots of all errors
2. 📋 Copy console errors (full text)
3. 📝 Document exact steps to reproduce
4. 🐛 Create bug report

**Bug Report Template**:
```markdown
## Bug Report: Overbooking Detection Not Working

**Test Failed**: Test X - [Name]
**Date**: [Today's date]
**Environment**: Production / Staging
**Tenant**: Test Beauty Spa

**Expected**:
- [What should happen]

**Actual**:
- [What actually happened]

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
...

**Console Errors**:
```
[Paste console errors here]
```

**Screenshots**:
- [Attach screenshots]

**Impact**: 🔴 HIGH / 🟡 MEDIUM / 🟢 LOW
```

**Who to notify**:
- Engineering team
- CTO
- Product owner

---

## 🔍 Troubleshooting

### Issue: "Cannot create booking"

**Possible Causes**:
1. No bookings exist in Test Beauty Spa
2. No KTVs assigned to bookings
3. Form validation error
4. Network error

**Solutions**:
1. Run database Query 8 first (verify test data)
2. Create test booking manually
3. Check console for errors
4. Check network tab (F12)

---

### Issue: "Toast doesn't appear"

**Possible Causes**:
1. Toast library not loaded
2. JavaScript error
3. Too fast (toast already dismissed)

**Solutions**:
1. Check console for errors
2. Try again slower
3. Check toast library version

---

### Issue: "Modal doesn't close"

**Check**:
- This is EXPECTED for rejected bookings (Test 2-3)
- This is UNEXPECTED for approved bookings (Test 1)

---

### Issue: "Cannot see timeline"

**Solutions**:
1. Refresh page
2. Check date filter
3. Switch view mode
4. Check tenant context

---

## 📸 Screenshot Checklist

**For EACH test**, capture:
1. ✅ Toast message (success or error)
2. ✅ Timeline view (with or without new booking)
3. ✅ Console tab (no errors for success, decision logs OK)
4. ✅ Modal state (closed for success, open for error)

**Screenshot Tips**:
- Use Snipping Tool (Windows) or Screenshot (Mac)
- Include timestamp
- Include full screen (not cropped)
- Save with clear names: `test1_success.png`

---

## ⏱️ Time Tracking

**Estimated**: 30 minutes  
**Breakdown**:
- Setup & Login: 5 min
- Test 1 (Happy): 5 min
- Test 2 (KTV): 10 min
- Test 3 (Room): 10 min

**Actual Time Spent**: _______ minutes

**Notes**:
```
[Any observations, issues, or comments]
```

---

## ✅ Completion Checklist

After finishing all tests:

- [ ] All 3 tests executed
- [ ] Results recorded (Pass/Fail)
- [ ] Screenshots captured (at least 3)
- [ ] Console checked (no unexpected errors)
- [ ] Bug report created (if any failures)
- [ ] Summary updated
- [ ] Next steps identified

---

**Tested by**: _________________  
**Date**: _________________  
**Time**: _________________  
**Result**: ✅ PASS / ⚠️ PARTIAL / ❌ FAIL  

**Ready for production use?** ✅ YES / ❌ NO

---

## 📞 Support

**If stuck, check**:
1. Console errors (F12)
2. Network tab (API calls)
3. Vercel logs (deployment logs)
4. Database queries (data exists?)

**Need help?**
- Review: `TESTING_RESULTS_SUMMARY.md`
- Review: `OVERBOOKING_DETECTION_CODE_REVIEW.md`
- Check: `WEEK1_EXECUTIVE_SUMMARY.md`

---

**Good luck with testing!** 🚀
