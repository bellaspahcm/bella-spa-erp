# Phase 1 Waitlist - Day 14: Manual Testing Checklist

**Date:** 2026-07-12  
**Status:** Ready to Execute  
**Estimated Time:** 4-6 hours (not 8 hours - automated tests already done)  
**Goal:** Verify end-to-end workflows in browser + fix any UI/UX issues

---

## 📋 TESTING CHECKLIST

### Pre-Test Setup (15 minutes)

**Environment:**
- [ ] Local dev server running (`npm run dev`)
- [ ] Supabase local instance running OR connected to dev project
- [ ] Database migration applied (waitlist tables exist)
- [ ] Test tenant created (`tenant_id` ready)
- [ ] Test user logged in (admin role)

**Test Data:**
- [ ] 3+ test customers created (VIP, Loyal, New tiers)
- [ ] 2+ test packages created
- [ ] 2+ test services created
- [ ] At least 1 fully booked slot (for slot available testing)

**Browser:**
- [ ] Chrome DevTools open (Network + Console tabs)
- [ ] Responsive mode ready (test mobile/tablet)
- [ ] Clear cache/cookies if needed

---

## 🧪 TEST SCENARIOS

### Scenario 1: Add Customer to Waitlist (Happy Path)

**Test Case 1.1: Add VIP Customer**

**Steps:**
1. Navigate to `/waitlist` page
2. Click "Add to Waitlist" button (or similar)
3. Fill form:
   - Customer: Select VIP customer
   - Package: Select any package
   - Preferred Date: Tomorrow
   - Preferred Time: "10:00" (or available slot)
   - Flexibility: "flexible" (will accept other times)
   - Notes: "VIP customer test"
4. Click "Add to Waitlist" button

**Expected Results:**
- ✅ Priority preview shows real-time calculation (70-90 range for VIP)
- ✅ Form submits successfully
- ✅ Modal closes
- ✅ Success toast appears ("Added to waitlist")
- ✅ New entry appears at top of list (if high priority)
- ✅ Entry shows correct customer name, package, date, priority score

**Screenshot:** 📸 Take before/after

---

**Test Case 1.2: Add with Validation Errors**

**Steps:**
1. Click "Add to Waitlist"
2. Leave customer blank
3. Click "Add"

**Expected Results:**
- ✅ Error message shows "Customer is required"
- ✅ Form does NOT submit
- ✅ No API call made (check Network tab)

**Try Other Validations:**
- [ ] Date in past → Error
- [ ] Package not selected → Error
- [ ] Preferred time invalid → Error

---

**Test Case 1.3: Add to Full Slot (Capacity Test)**

**Steps:**
1. Add 10 customers to same slot (fill capacity)
2. Try adding 11th customer to same slot

**Expected Results:**
- ✅ System allows (waitlist should accept even if full)
- ✅ Position reflects queue order (11th should be position 11)

---

### Scenario 2: View Waitlist List Page

**Test Case 2.1: List Display**

**Steps:**
1. Navigate to `/waitlist`
2. Observe list

**Expected Results:**
- ✅ All waitlist entries displayed
- ✅ Sorted by priority (highest first)
- ✅ Shows customer name, package, date, time, status, priority
- ✅ Status badges colored correctly (pending=yellow, notified=blue, reserved=green, etc.)
- ✅ Priority score displayed (0-100)
- ✅ Action buttons visible (View, Notify, etc.)

---

**Test Case 2.2: Filters**

**Steps:**
1. Use status filter: Select "Pending"
2. Use date filter: Select specific date
3. Use search: Type customer name

**Expected Results:**
- ✅ URL updates with filter params (`?status=pending`)
- ✅ List refreshes with filtered results
- ✅ Clear filters button appears
- ✅ Filter state persists on page refresh

---

**Test Case 2.3: Pagination**

**Steps:**
1. Add 20+ entries (if not enough)
2. Observe pagination controls
3. Click "Next page"

**Expected Results:**
- ✅ Pagination controls show (1, 2, 3...)
- ✅ Next page loads
- ✅ URL updates with `?page=2`
- ✅ "Previous" button enabled

---

### Scenario 3: View Detail Page

**Test Case 3.1: Detail Display**

**Steps:**
1. Click any waitlist entry "View" button
2. Observe detail page

**Expected Results:**
- ✅ Detail page loads (`/waitlist/[id]`)
- ✅ Customer info card shows (name, tier, phone, email)
- ✅ Booking details card shows (package, date, time, flexibility, notes)
- ✅ Priority breakdown card shows (bar chart with 4 components)
- ✅ Timeline shows (Added → Notified → Reserved → Converted OR Expired OR Cancelled)
- ✅ Notification history card shows (if any notifications sent)

---

**Test Case 3.2: Priority Breakdown Accuracy**

**Steps:**
1. View VIP customer detail
2. Check priority breakdown

**Expected Results:**
- ✅ Tier score: 30-40 points (VIP)
- ✅ Value score: 20-30 points (high package value)
- ✅ Wait time score: 0-20 points (depends on how long waiting)
- ✅ Flexibility score: 10-20 points (if flexible)
- ✅ Total matches sum of components

---

**Test Case 3.3: Notification History**

**Steps:**
1. View entry that was notified
2. Scroll to notification history section

**Expected Results:**
- ✅ Notification log table shows
- ✅ Columns: Type, Channel, Status, Sent At, Error (if any)
- ✅ Mock provider shows "Mock SMS sent" (if mock)
- ✅ Timestamps are correct

---

### Scenario 4: Actions (Notify, Reserve, Convert, Cancel)

**Test Case 4.1: Notify Customer**

**Steps:**
1. Click "Notify" button on pending entry
2. Confirm action

**Expected Results:**
- ✅ Status changes to "notified"
- ✅ `notified_at` timestamp updated
- ✅ Notification log entry created (check detail page)
- ✅ Mock notification "sent" (check console logs)
- ✅ Success toast appears

---

**Test Case 4.2: Reserve Slot**

**Steps:**
1. Click "Reserve" button on notified entry
2. Confirm action

**Expected Results:**
- ✅ Status changes to "reserved"
- ✅ `reserved_at` timestamp updated
- ✅ Success toast appears

---

**Test Case 4.3: Convert to Booking**

**Steps:**
1. Click "Convert" button on reserved entry

**Expected Results:**
- ✅ Toast shows "Coming soon" OR booking creation modal opens
- ✅ (If modal) Booking form pre-filled with waitlist data
- ✅ (If modal) Booking created successfully
- ✅ Waitlist entry status → "converted"

**Note:** If not implemented yet, skip to Phase 2

---

**Test Case 4.4: Cancel Entry**

**Steps:**
1. Click "Cancel" button on any entry
2. Confirm cancellation

**Expected Results:**
- ✅ Status changes to "cancelled"
- ✅ `cancelled_at` timestamp updated
- ✅ Entry remains in list (soft delete)
- ✅ Success toast appears

---

### Scenario 5: Process Slot Available (Core Workflow)

**Test Case 5.1: Slot Becomes Available**

**Setup:**
- [ ] Create 3 waitlist entries for same slot (10:00 AM tomorrow)
- [ ] Entry 1: VIP, priority 85
- [ ] Entry 2: Loyal, priority 70
- [ ] Entry 3: New, priority 60

**Steps:**
1. Call `/api/waitlist/process-slot` endpoint (via Postman or curl)
   ```bash
   curl -X POST http://localhost:3000/api/waitlist/process-slot \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -d '{
       "date": "2026-07-13",
       "time": "10:00",
       "available_slots": 1
     }'
   ```

**Expected Results:**
- ✅ API returns 200 OK
- ✅ Top 1 customer notified (Entry 1 - VIP, priority 85)
- ✅ Entry 1 status → "notified"
- ✅ Entry 2 & 3 remain "pending"
- ✅ Notification log created for Entry 1
- ✅ Check detail page: notification history shows new notification

---

### Scenario 6: Expiry Management

**Test Case 6.1: Expire Old Entries**

**Setup:**
- [ ] Manually update 1 entry's `created_at` to >24 hours ago (SQL):
  ```sql
  UPDATE waitlist_entries
  SET created_at = NOW() - INTERVAL '25 hours'
  WHERE id = 'ENTRY_ID'
    AND status = 'pending';
  ```

**Steps:**
1. Call `/api/cron/waitlist-expiry` endpoint
   ```bash
   curl -X GET http://localhost:3000/api/cron/waitlist-expiry \
     -H "Authorization: Bearer CRON_SECRET"
   ```

**Expected Results:**
- ✅ API returns 200 OK
- ✅ Old entry status → "expired"
- ✅ `expired_at` timestamp set
- ✅ Expiry notification sent (check logs)
- ✅ Entry shows as expired in list

---

### Scenario 7: Mobile Responsiveness

**Test Case 7.1: Mobile Layout**

**Steps:**
1. Open Chrome DevTools → Toggle device toolbar (Cmd+Shift+M)
2. Select "iPhone 12 Pro" or "Pixel 5"
3. Navigate through waitlist pages

**Expected Results:**
- ✅ List page: Cards stack vertically
- ✅ Filters: Collapse into dropdown or drawer
- ✅ Detail page: Cards stack, no horizontal scroll
- ✅ Forms: Inputs full-width
- ✅ Buttons: Touch-friendly size (min 44px)
- ✅ Text: Readable (min 14px)

---

**Test Case 7.2: Tablet Layout**

**Steps:**
1. Select "iPad" or "iPad Pro"
2. Navigate through waitlist pages

**Expected Results:**
- ✅ List page: 2-column card grid
- ✅ Detail page: Sidebar layout (if designed)
- ✅ Forms: Responsive form layout

---

### Scenario 8: Error Handling

**Test Case 8.1: Network Error**

**Steps:**
1. Open DevTools → Network tab → Throttle to "Offline"
2. Try adding to waitlist

**Expected Results:**
- ✅ Error toast appears ("Network error")
- ✅ Loading state clears
- ✅ Form remains filled (user can retry)

---

**Test Case 8.2: API Error (500)**

**Steps:**
1. (Developer) Temporarily break API endpoint (e.g., remove DB connection)
2. Try adding to waitlist

**Expected Results:**
- ✅ Error toast appears ("Something went wrong")
- ✅ Console shows error details (not exposed to user)
- ✅ Form remains filled

---

**Test Case 8.3: Validation Error (400)**

**Steps:**
1. Submit form with invalid date (past date)

**Expected Results:**
- ✅ Error toast appears ("Date must be in future")
- ✅ Field highlighted in red
- ✅ Error message below field

---

### Scenario 9: Performance & UX

**Test Case 9.1: Loading States**

**Steps:**
1. Throttle network to "Fast 3G"
2. Navigate to waitlist list
3. Observe loading

**Expected Results:**
- ✅ Skeleton loaders appear (not blank screen)
- ✅ List loads progressively
- ✅ No layout shift after load

---

**Test Case 9.2: Optimistic UI**

**Steps:**
1. Add to waitlist
2. Observe UI before API responds

**Expected Results:**
- ✅ Modal closes immediately (optimistic)
- ✅ Entry appears in list (optimistic)
- ✅ If API fails, entry removed + error shown

---

**Test Case 9.3: Accessibility**

**Steps:**
1. Tab through form using keyboard only
2. Use screen reader (VoiceOver/NVDA)

**Expected Results:**
- ✅ All interactive elements focusable
- ✅ Focus visible (outline)
- ✅ Labels associated with inputs
- ✅ Error messages announced
- ✅ Buttons have descriptive text

---

## 🐛 BUG TRACKING

**Use this section to track bugs found during testing:**

### Bug #1: [Title]
- **Severity:** Critical / High / Medium / Low
- **Steps to Reproduce:**
  1. 
  2. 
- **Expected:** 
- **Actual:** 
- **Screenshot:** 
- **Fix:** 
- **Status:** Open / In Progress / Fixed

---

### Bug #2: [Title]
- **Severity:** 
- **Steps to Reproduce:**
- **Expected:** 
- **Actual:** 
- **Screenshot:** 
- **Fix:** 
- **Status:** 

---

## ✅ COMPLETION CRITERIA

**Must Pass (Blocking):**
- [ ] Add to waitlist works (happy path)
- [ ] List page displays entries correctly
- [ ] Detail page shows all information
- [ ] Notify action works
- [ ] Reserve action works
- [ ] Cancel action works
- [ ] Process slot API works (top priority notified)
- [ ] Expiry management works
- [ ] Mobile layout responsive
- [ ] No critical bugs

**Should Pass (Non-Blocking):**
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] Search works
- [ ] URL state persists
- [ ] Loading states smooth
- [ ] Error handling graceful
- [ ] Accessibility basics covered

**Nice to Have (Deferred):**
- [ ] Convert to booking implemented
- [ ] Stats widget
- [ ] Bulk actions
- [ ] Export to CSV

---

## 📊 TEST RESULTS SUMMARY

**Test Date:** ___________  
**Tester:** ___________  
**Environment:** Local / Dev / Staging  

**Results:**
- **Total Scenarios:** 9
- **Total Test Cases:** 25+
- **Passed:** ___ / ___
- **Failed:** ___ / ___
- **Blocked:** ___ / ___
- **Skipped:** ___ / ___

**Critical Bugs Found:** ___  
**High Priority Bugs:** ___  
**Medium Priority Bugs:** ___  
**Low Priority Bugs:** ___  

**Overall Status:** ✅ PASS / ⚠️ PASS WITH ISSUES / ❌ FAIL

---

## 🚀 NEXT STEPS AFTER TESTING

### If All Tests Pass ✅
1. Update `PHASE_1_WAITLIST_COMPLETION_STATUS.md` → 100% complete
2. Update `docs/progress/CURRENT_STATUS.md` → Waitlist 100%
3. Create deployment checklist
4. Schedule pilot with 1-2 customers
5. **START UX ROADMAP WEEK 1** (Conversational Builder)

### If Tests Fail ⚠️
1. Document all bugs in detail
2. Prioritize fixes (Critical → High → Medium)
3. Fix critical bugs first (blocking)
4. Re-test after fixes
5. Repeat until pass

### If Blocked ❌
1. Identify blocking issue
2. Document workaround if possible
3. Escalate to appropriate team/person
4. Continue with non-blocked scenarios

---

## 📝 TESTING NOTES

**Environment Issues:**
- 

**Data Issues:**
- 

**Performance Notes:**
- 

**UX Observations:**
- 

**Suggestions for Improvement:**
- 

---

**Document Status:** ✅ Ready for Testing  
**Created:** 2026-07-12  
**Next Review:** After testing complete  
**Estimated Time:** 4-6 hours
