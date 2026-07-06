# Manual Testing Guide - Decision Engine on Beauty Tenant

## 🎯 Objective
Verify Decision Engine works correctly with real data on beauty tenant.

---

## Pre-requisites

### 1. Test User Accounts
You need access to:
- **Admin account** (to access Leave Approval Modal)
- **KTV account(s)** with various scenarios

### 2. Test Data Setup
Ensure beauty tenant has:
- KTVs with different leave balances (0, 1, 5, 10 days)
- Some KTVs with scheduled sessions
- Some KTVs with attendance violations
- Pending leave requests to test

---

## Test Scenarios

### ✅ Scenario 1: APPROVE - Happy Path
**Setup:**
- KTV has `leave_balance >= 1`
- No violations in last 90 days
- No sessions scheduled on leave date
- Leave request submitted > 24h in advance

**Steps:**
1. Login as Admin
2. Navigate to Leave Approval Modal
3. Select pending leave request from KTV matching criteria
4. Wait for Decision Engine to analyze

**Expected Result:**
```
✅ Panel màu xanh (green)
Title: "✅ Khuyến nghị: PHÊ DUYỆT"
Explanation: "Advance notice is sufficient (XX hours), no balance issues, no violations detected."
Execution Time: ~30-50ms
Policy: leave-approval-v1 v1.0.0
```

**Verify:**
- [ ] Green panel displays
- [ ] Explanation is accurate
- [ ] Execution time is reasonable (< 100ms)
- [ ] Admin can still approve/reject manually

---

### ❌ Scenario 2: REJECT - Insufficient Balance
**Setup:**
- KTV has `leave_balance = 0`
- Leave request for 1 day

**Steps:**
1. Login as Admin
2. Navigate to Leave Approval Modal
3. Select leave request from KTV with 0 balance

**Expected Result:**
```
❌ Panel màu đỏ (red)
Title: "❌ Khuyến nghị: TỪ CHỐI"
Explanation: "Insufficient leave balance (0 days remaining)"
```

**Verify:**
- [ ] Red panel displays
- [ ] Explanation mentions 0 balance
- [ ] Admin can still override and approve if needed

---

### ❌ Scenario 3: REJECT - Short Notice
**Setup:**
- KTV submits leave request < 24h before leave date
- Example: Request at 23:00 for tomorrow 08:00 (only 9 hours notice)

**Steps:**
1. Create leave request with short notice
2. Login as Admin
3. Select this leave request

**Expected Result:**
```
❌ Panel màu đỏ (red)
Title: "❌ Khuyến nghị: TỪ CHỐI"
Explanation: "Insufficient advance notice (only XX hours before leave date). Policy requires 24 hours minimum."
```

**Verify:**
- [ ] Red panel displays
- [ ] Hours calculation is accurate
- [ ] Explanation mentions 24h requirement

---

### ⚠️ Scenario 4: ESCALATE - Session Conflicts (Full Day)
**Setup:**
- KTV has session scheduled on leave date (any time)
- Leave type: `full_day`

**Steps:**
1. Ensure KTV has session on leave date in `session_logs`
2. KTV submits full day leave request
3. Admin selects this request

**Expected Result:**
```
⚠️ Panel màu vàng (amber/yellow)
Title: "⚠️ Khuyến nghị: CẦN XEM XÉT"
Explanation: "Sessions scheduled during requested leave period. Requires reassignment."
```

**Verify:**
- [ ] Yellow panel displays
- [ ] Conflict sessions are listed separately in modal
- [ ] Admin must assign replacement KTV before approving

---

### ⚠️ Scenario 5: ESCALATE - Session Conflicts (Morning)
**Setup:**
- KTV has session at 09:00 on leave date
- Leave type: `morning`

**Steps:**
1. Ensure KTV has morning session (before 12:00)
2. KTV submits morning leave request
3. Admin selects this request

**Expected Result:**
```
⚠️ Panel màu vàng (amber/yellow)
Title: "⚠️ Khuyến nghị: CẦN XEM XÉT"
Explanation: "Sessions scheduled during requested leave period."
```

**Verify:**
- [ ] Yellow panel displays
- [ ] hasConflict = true triggered
- [ ] Morning session is detected

---

### ✅ Scenario 6: APPROVE - Afternoon Leave with Morning Session
**Setup:**
- KTV has session at 09:00 on leave date
- Leave type: `afternoon`

**Steps:**
1. Ensure KTV has morning session (before 12:00)
2. KTV submits afternoon leave request
3. Admin selects this request

**Expected Result:**
```
✅ Panel màu xanh (green)
Title: "✅ Khuyến nghị: PHÊ DUYỆT"
Explanation: "Advance notice is sufficient, no balance issues, no violations detected."
```

**Verify:**
- [ ] Green panel displays (NOT yellow)
- [ ] hasConflict = false (morning session doesn't conflict with afternoon leave)
- [ ] Logic correctly filters by time

---

### ⚠️ Scenario 7: ESCALATE - Multiple Violations
**Setup:**
- KTV has >= 3 violations in last 90 days
- Violations are `status = 'absent'` or `status = 'late'` in `attendance` table

**Steps:**
1. Ensure KTV has 3+ violations
2. KTV submits leave request
3. Admin selects this request

**Expected Result:**
```
⚠️ Panel màu vàng (amber/yellow)
Title: "⚠️ Khuyến nghị: CẦN XEM XÉT"
Explanation: "Multiple attendance violations detected (X violations in last 90 days). Requires senior approval."
```

**Verify:**
- [ ] Yellow panel displays
- [ ] Violation count is accurate
- [ ] Only counts last 90 days

---

### 🔄 Scenario 8: Loading State
**Setup:**
- Slow network or large dataset

**Steps:**
1. Select any leave request
2. Observe panel during Decision Engine evaluation

**Expected Result:**
```
During loading:
- Loading spinner visible
- Text: "Đang phân tích..."
- Sub-text: "Decision Engine đang đánh giá đơn nghỉ phép"

After loading:
- Recommendation panel displays
- Loading state disappears
```

**Verify:**
- [ ] Loading state shows before result
- [ ] Loading state disappears after result
- [ ] Transition is smooth

---

## Performance Benchmarks

| Operation | Target | Acceptable Range |
|-----------|--------|------------------|
| buildLeaveKnowledge() | < 30ms | < 50ms |
| RuleReasoner.evaluate() | < 5ms | < 10ms |
| Total recommendation | < 50ms | < 100ms |

**How to verify:**
- Check execution time displayed in recommendation panel
- Check browser console for `[DecisionEngine]` logs

---

## Data Integrity Checks

### Before Testing

**1. Verify Users Table:**
```sql
SELECT id, full_name, role, leave_balance, status
FROM users
WHERE tenant_id = 'beauty'
  AND role = 'ktv'
LIMIT 10;
```

**2. Verify Session Logs:**
```sql
SELECT id, ktv_id, session_date, assigned_time, status
FROM session_logs
WHERE tenant_id = 'beauty'
  AND session_date >= CURRENT_DATE
  AND status IN ('pending', 'confirmed')
LIMIT 10;
```

**3. Verify Attendance:**
```sql
SELECT ktv_id, date, status, COUNT(*)
FROM attendance
WHERE tenant_id = 'beauty'
  AND date >= (CURRENT_DATE - INTERVAL '90 days')
  AND status IN ('absent', 'late')
GROUP BY ktv_id, date, status;
```

---

## Debugging Tips

### If recommendation doesn't show:
1. Check browser console for errors
2. Verify `getLeaveDecisionRecommendation()` is called
3. Check network tab for API failures
4. Verify Supabase queries return data

### If recommendation is incorrect:
1. Check `[DecisionEngine]` logs in console
2. Verify Knowledge object has correct data
3. Check rule evaluation order in policy
4. Verify database data matches expectations

### If performance is slow:
1. Check execution time in panel
2. Verify database indexes exist
3. Check for slow Supabase queries
4. Consider caching if needed

---

## Success Criteria

### Must Pass (Blocking)
- [ ] All 7 scenarios produce correct outcomes
- [ ] No JavaScript errors in console
- [ ] No Supabase query errors
- [ ] Performance < 100ms (95th percentile)
- [ ] UI displays correctly on all outcomes

### Should Pass (Non-blocking)
- [ ] Loading state appears for slow queries
- [ ] Execution time is displayed accurately
- [ ] Policy metadata is shown correctly
- [ ] Admin can override all recommendations

---

## Bug Reporting Template

If you find a bug, document it using this template:

```markdown
**Bug Title:** [Short description]

**Scenario:** [Which test scenario?]

**Expected:**
- [What should happen?]

**Actual:**
- [What actually happened?]

**Steps to Reproduce:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Screenshots:**
[Attach screenshot if UI bug]

**Console Logs:**
```
[Paste console logs here]
```

**Environment:**
- Tenant: beauty
- Browser: [Chrome/Firefox/etc]
- User: [Admin/KTV]
- Date: [YYYY-MM-DD]
```

---

## Post-Testing Checklist

After completing all scenarios:

### If All Tests Pass ✅
- [ ] Update Integration Complete Checklist
- [ ] Mark Sprint 2 as complete
- [ ] Document any edge cases discovered
- [ ] Plan Sprint 3 (Booking policy)
- [ ] Celebrate! 🎉

### If Any Tests Fail ❌
- [ ] File bugs using template above
- [ ] Prioritize bugs (blocking vs non-blocking)
- [ ] Fix blocking bugs
- [ ] Re-test until all pass
- [ ] Update documentation with findings

---

## Next Steps After Testing

### Sprint 2 Complete
1. Merge Decision Engine feature branch
2. Deploy to staging
3. Monitor production logs
4. Gather user feedback

### Sprint 3 Planning
1. Add second policy: **Booking Capacity**
2. Verify RuleReasoner needs no changes
3. If successful → Architecture validated ✅

---

**Test Duration:** Estimated 30-45 minutes  
**Required Role:** Admin access on beauty tenant  
**Dependencies:** Real leave requests in pending status
