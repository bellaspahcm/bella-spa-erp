# Manual QA Test Plan - Break Time Buffer - July 15, 2026

## 🎯 Test Objective

Verify that the Break Time Buffer feature is working correctly in production:
- Bookings with gap < 15 minutes should be **REJECTED**
- Bookings with gap ≥ 15 minutes should be **ALLOWED**

---

## 🔐 Pre-Test Setup

### Step 1: Check Current Bookings (SQL)
Run this in Supabase SQL Editor to see today's bookings:

```sql
-- Find KTVs with bookings today
SELECT 
  u.full_name as ktv_name,
  b.scheduled_start,
  b.scheduled_end,
  b.status,
  b.id as booking_id,
  p.name as package_name
FROM bookings b
JOIN users u ON u.id = b.assigned_ktv_id
JOIN packages p ON p.id = b.package_id
WHERE b.tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
  AND b.scheduled_start::date = CURRENT_DATE
  AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'deposit_pending')
ORDER BY u.full_name, b.scheduled_start;
```

**Note down**:
- KTV name with existing booking
- Booking start time (e.g., 14:00)
- This will be used for testing

### Step 2: If No Bookings Today
Create a test booking first:
1. Login as Admin
2. Go to **Bookings** → **New Booking**
3. Select any customer
4. Select any package (e.g., "Combo Mẹ & Bé Tiết Kiệm")
5. Select any KTV (e.g., "Alice")
6. Select time: **14:00 today**
7. Click **Create Booking**
8. ✅ This should succeed (no conflicts yet)

---

## 🧪 Test Cases

### Test Case 1: Reject 5-Minute Gap ❌
**Expected**: System should REJECT

**Steps**:
1. **Go to Bookings** → Click "New Booking" button
2. **Select Customer**: Any customer (e.g., "Nguyễn Thị Mai")
3. **Select Package**: Any package (e.g., "Combo Mẹ & Bé Tiết Kiệm")
4. **Select KTV**: Same KTV as existing booking (e.g., "Alice")
5. **Select Date**: Today
6. **Select Time**: 14:10 (if existing booking is at 14:00)
   - This creates a **10-minute gap** (< 15 min)
7. **Click "Create Booking"**

**Expected Result**: ❌
- Error message appears
- Error text: "KTV cần thời gian nghỉ giữa các ca (tối thiểu 15 phút)"
- OR similar Vietnamese message about break time
- Booking is NOT created

**If it succeeds**: 🚨 BUG! Feature not working

---

### Test Case 2: Reject 10-Minute Gap ❌
**Expected**: System should REJECT

**Steps**:
1. Same as Test Case 1
2. **Select Time**: 14:05 (if existing booking is at 14:00)
   - This creates a **5-minute gap** (< 15 min)
3. **Click "Create Booking"**

**Expected Result**: ❌
- Error message appears
- Error about break time requirement
- Booking is NOT created

---

### Test Case 3: Allow 15-Minute Gap ✅
**Expected**: System should ALLOW

**Steps**:
1. Same as Test Case 1
2. **Select Time**: 14:15 (if existing booking is at 14:00)
   - This creates a **15-minute gap** (= 15 min, minimum)
3. **Click "Create Booking"**

**Expected Result**: ✅
- Success message appears
- Booking is created
- Can see new booking in bookings list

**If it fails**: 🚨 BUG! Boundary condition incorrect

---

### Test Case 4: Allow 20-Minute Gap ✅
**Expected**: System should ALLOW

**Steps**:
1. Same as Test Case 1
2. **Select Time**: 14:20 (if existing booking is at 14:00)
   - This creates a **20-minute gap** (> 15 min)
3. **Click "Create Booking"**

**Expected Result**: ✅
- Success message appears
- Booking is created

---

### Test Case 5: Backward Gap (Before Existing Booking) ❌
**Expected**: System should REJECT if too close

**Steps**:
1. Same as Test Case 1
2. **Select Time**: 13:50 (if existing booking is at 14:00)
   - This creates a **10-minute gap BEFORE** existing booking
3. **Click "Create Booking"**

**Expected Result**: ❌
- Error message appears
- Error about break time requirement
- System checks gap BOTH before and after

---

### Test Case 6: Different KTV ✅
**Expected**: System should ALLOW (no conflict)

**Steps**:
1. Same as Test Case 1
2. **Select KTV**: Different KTV (e.g., "Bob" instead of "Alice")
3. **Select Time**: 14:10 (same time as Alice's booking)
4. **Click "Create Booking"**

**Expected Result**: ✅
- Success message appears
- Booking is created
- Break time only applies to SAME KTV, not different KTVs

---

## 📸 Screenshot Checklist

Please capture screenshots for:
- [ ] Test Case 1: Error message when 10-min gap rejected
- [ ] Test Case 3: Success message when 15-min gap allowed
- [ ] Test Case 4: Success message when 20-min gap allowed

Save screenshots to: `docs/screenshots/break-time-buffer-qa/`

---

## 🐛 Bug Report Template

If any test fails, use this template:

```markdown
## Bug Report: Break Time Buffer Not Working

**Test Case**: [Test Case #X name]
**Date**: July 15, 2026
**Tester**: [Your name]

**Environment**:
- URL: http://localhost:3000 OR production URL
- Browser: [Chrome/Firefox/Safari]
- User Role: Admin

**Steps to Reproduce**:
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Expected Result**: [What should happen]
**Actual Result**: [What actually happened]

**Screenshot**: [Attach screenshot]

**SQL Verification**:
```sql
-- Check tenant config
SELECT name, metadata->'capacity_config' 
FROM tenants 
WHERE id = '[tenant_id]';

-- Check booking details
SELECT * FROM bookings WHERE id = '[booking_id]';
```

**Severity**: [Critical/High/Medium/Low]
**Priority**: [P0/P1/P2/P3]
```

---

## 🔍 Debug Queries (If Tests Fail)

### Check Tenant Config
```sql
-- Verify tenant has correct config
SELECT 
  id,
  name,
  metadata->'capacity_config'->>'minBreakMinutes' as min_break,
  metadata->'capacity_config'->>'enforceBreakTimes' as enforce
FROM tenants
WHERE name ILIKE '%bella%'
LIMIT 1;
```

**Expected**:
- `min_break = "15"`
- `enforce = "true"`

### Check Booking Details
```sql
-- Get details of the bookings you're testing
SELECT 
  b.id,
  b.scheduled_start,
  b.scheduled_end,
  b.status,
  u.full_name as ktv_name,
  EXTRACT(EPOCH FROM (
    LEAD(b.scheduled_start) OVER (
      PARTITION BY b.assigned_ktv_id 
      ORDER BY b.scheduled_start
    ) - b.scheduled_start
  )) / 60 as gap_to_next_minutes
FROM bookings b
JOIN users u ON u.id = b.assigned_ktv_id
WHERE b.tenant_id = (SELECT id FROM tenants WHERE name ILIKE '%bella%' LIMIT 1)
  AND b.scheduled_start::date = CURRENT_DATE
  AND b.status IN ('confirmed', 'in_progress', 'scheduled', 'deposit_pending')
ORDER BY u.full_name, b.scheduled_start;
```

This shows gaps between consecutive bookings for same KTV.

### Check Decision Engine Logs
```sql
-- If you have decision_engine_logs table
SELECT 
  created_at,
  decision_type,
  input_data,
  decision_result,
  explanation
FROM decision_engine_logs
WHERE decision_type = 'booking_validation'
  AND created_at >= NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📊 Test Results Template

After testing, fill this out:

### Test Execution Summary

**Date**: July 15, 2026  
**Tester**: [Your name]  
**Environment**: http://localhost:3000  
**Duration**: [X] minutes  

| Test Case | Expected | Actual | Status | Notes |
|-----------|----------|--------|--------|-------|
| TC1: 5-min gap | Reject | [Pass/Fail] | [✅/❌] | [Any notes] |
| TC2: 10-min gap | Reject | [Pass/Fail] | [✅/❌] | |
| TC3: 15-min gap | Allow | [Pass/Fail] | [✅/❌] | |
| TC4: 20-min gap | Allow | [Pass/Fail] | [✅/❌] | |
| TC5: Backward gap | Reject | [Pass/Fail] | [✅/❌] | |
| TC6: Different KTV | Allow | [Pass/Fail] | [✅/❌] | |

**Pass Rate**: [X/6] = [Y]%

### Overall Assessment
- [ ] Feature working as expected
- [ ] Minor issues found (describe)
- [ ] Major issues found (describe)
- [ ] Feature not working (critical bug)

### Next Steps
- [ ] Report bugs (if any)
- [ ] Update deployment status document
- [ ] Monitor production for 1 week
- [ ] Collect user feedback

---

## 🎯 Success Criteria

Feature is considered **WORKING** if:
- ✅ Test Cases 1, 2, 5 REJECT bookings (gap < 15 min)
- ✅ Test Cases 3, 4 ALLOW bookings (gap ≥ 15 min)
- ✅ Test Case 6 ALLOWS (different KTV)
- ✅ Error messages display correctly
- ✅ Booking list updates correctly

**Minimum Pass Rate**: 6/6 (100%)

---

## 📞 Escalation

If you encounter critical issues:
1. **Screenshot the error**
2. **Copy the error message**
3. **Run debug queries above**
4. **Document in bug report**
5. **Consider rollback** (see `DEPLOYMENT_STATUS_BREAK_TIME_BUFFER_15_07_2026.md`)

---

## 📝 Test Completion

After completing tests:
1. Fill out "Test Results Template" above
2. Update `DEPLOYMENT_STATUS_BREAK_TIME_BUFFER_15_07_2026.md` with results
3. Create session summary
4. Notify team of results

---

**Document Created**: July 15, 2026, 22:10 ICT  
**Test Start Time**: [Fill in]  
**Test End Time**: [Fill in]  
**QA Engineer**: [Your name]  
