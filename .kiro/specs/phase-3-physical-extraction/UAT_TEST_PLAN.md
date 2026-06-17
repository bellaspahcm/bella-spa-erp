# Phase 3 UAT Test Plan

**UAT Period**: [Start Date] to [End Date] (3-5 days recommended)  
**Environment**: Staging (staging.bella-erp.com)  
**Test Approach**: Manual testing of critical user flows  
**Success Criteria**: Zero functional regression

---

## 🎯 UAT Objectives

### Primary Goals
1. ✅ Verify **zero functional regression** after Phase 3 migration
2. ✅ Confirm **user experience unchanged**
3. ✅ Validate **core workflows** still work correctly
4. ✅ Identify any **unexpected issues** before production

### What We're NOT Testing
- ❌ New features (Phase 3 added no new features)
- ❌ Performance improvements (will measure separately)
- ❌ UI/UX changes (no UI changes in Phase 3)

---

## 👥 UAT Team & Roles

### Test Participants
- **Admin Tester**: Tests admin workflows
- **KTV Tester**: Tests KTV portal and operations
- **Accountant Tester**: Tests finance and accounting
- **Operations Tester**: Tests booking and customer management

### Coordinator
- **UAT Lead**: [Name]
- **Technical Support**: [Developer Name]
- **Issue Tracker**: [Who logs issues]

---

## 🔐 Test Credentials

### Staging Environment
- **URL**: https://staging.bella-erp.com
- **Admin**: [username] / [password]
- **KTV**: [username] / [password]
- **Accountant**: [username] / [password]
- **Customer Portal**: [customer token URL]

---

## 🧪 Test Scenarios

### Scenario 1: Customer Order Flow (HIGH PRIORITY)
**Tester**: Admin  
**Duration**: 15 minutes  
**Frequency**: Test 3 times

**Steps**:
1. Login as admin
2. Navigate to "Khách hàng" (Customers)
3. Create new customer:
   - Name: "Test Customer [Your Name]"
   - Phone: "0900000001"
   - Address: "Test Address"
   - Status: "Mang thai" (Pregnant)
4. Navigate to "Đặt lịch" (Bookings)
5. Create new booking:
   - Select test customer
   - Choose package: "Combo Mẹ & Bé Tiết Kiệm"
   - Assign KTV
   - Set date: tomorrow
   - Add note
6. Process deposit payment:
   - Payment method: Bank Transfer
   - Amount: 50% deposit
   - Confirm payment
7. Verify booking created:
   - Check booking appears in dashboard
   - Check customer order list
   - Check KTV assignment

**Expected Results**:
- ✅ Customer created successfully
- ✅ Booking created without errors
- ✅ Payment recorded correctly
- ✅ Dashboard shows new booking
- ✅ Notifications sent (check system)

**Critical Validations**:
- [ ] No JavaScript errors in console
- [ ] All form fields save correctly
- [ ] Database records created
- [ ] UI responsive and fast

---

### Scenario 2: KTV Session Completion (HIGH PRIORITY)
**Tester**: KTV  
**Duration**: 10 minutes  
**Frequency**: Test 3 times

**Steps**:
1. Login as KTV
2. Navigate to "Ca làm việc" (My Sessions)
3. Find upcoming session
4. Click "Check-in":
   - Allow GPS location
   - Confirm check-in time
5. Complete session details:
   - Session notes
   - Customer satisfaction
   - Products used
6. Click "Check-out":
   - Confirm session completion
   - Add final notes
7. Verify session recorded:
   - Check session count updated
   - Check salary calculation updated

**Expected Results**:
- ✅ Check-in successful with GPS
- ✅ Session details saved
- ✅ Check-out processed
- ✅ Session count incremented
- ✅ Salary automatically recalculated

**Critical Validations**:
- [ ] GPS location captured (if applicable)
- [ ] Session multiplier applied correctly (1.0x, 1.5x, 2.0x)
- [ ] Salary calculation accurate
- [ ] No silent failures

---

### Scenario 3: Finance Transaction Management (HIGH PRIORITY)
**Tester**: Accountant  
**Duration**: 15 minutes  
**Frequency**: Test 2 times

**Steps**:
1. Login as accountant
2. Navigate to "Tài chính" (Finance)
3. Review transaction list:
   - Filter by date
   - Search by customer
   - Check transaction details
4. Process refund:
   - Select a completed booking
   - Click "Hoàn tiền" (Refund)
   - Enter refund amount
   - Add reason
   - Confirm refund
5. Review P&L report:
   - Navigate to "Báo cáo" (Reports)
   - Select current month
   - Generate P&L report
   - Export to Excel
6. Lock accounting period:
   - Navigate to "Kỳ kế toán" (Periods)
   - Select previous month
   - Click "Khóa sổ" (Lock Period)
   - Confirm lock

**Expected Results**:
- ✅ Transactions load correctly
- ✅ Refund processed successfully
- ✅ P&L report accurate
- ✅ Excel export works
- ✅ Period locked successfully

**Critical Validations**:
- [ ] Transaction amounts correct
- [ ] Refund creates accounting entries
- [ ] P&L calculations accurate
- [ ] Period lock prevents modifications
- [ ] No data loss

---

### Scenario 4: Salary Calculation & Approval (HIGH PRIORITY)
**Tester**: Admin/HR  
**Duration**: 20 minutes  
**Frequency**: Test 2 times

**Steps**:
1. Login as admin
2. Navigate to "Lương" (Salary)
3. View salary dashboard:
   - Check current month summary
   - Review KTV list
   - Check session counts
4. Recalculate salary for test KTV:
   - Select KTV
   - View salary breakdown:
     - Base salary (pro-rata)
     - Session bonus
     - KPI bonus
     - Violations deduction
   - Verify calculation correct
5. Adjust manual items (if needed):
   - Add/subtract manual adjustment
   - Add note explaining adjustment
6. Approve salary:
   - Change status from "Draft" to "Pending Approval"
   - Review one more time
   - Confirm approval
7. Export salary report:
   - Select multiple KTVs
   - Export to Excel
   - Verify Excel format

**Expected Results**:
- ✅ Salary dashboard loads
- ✅ Session counts accurate (with multipliers)
- ✅ Salary calculation correct:
  - Base: (base_salary / 26) × working_days
  - Bonus: session_count × session_bonus_rate
  - KPI: from kpi_records table
  - Deductions: from violations
- ✅ Manual adjustments save
- ✅ Status transitions work
- ✅ Excel export correct

**Critical Validations**:
- [ ] Pro-rata calculation accurate
- [ ] Session multipliers applied (1.0x, 1.5x, 2.0x)
- [ ] Decimal session counts handled (NUMERIC(5,2))
- [ ] Draft vs. finalized respected
- [ ] No recalculation after approval

---

### Scenario 5: Dashboard & Analytics (MEDIUM PRIORITY)
**Tester**: Admin  
**Duration**: 10 minutes  
**Frequency**: Test 1 time

**Steps**:
1. Login as admin
2. View main dashboard:
   - Check today's bookings widget
   - Check revenue widget
   - Check KTV performance widget
   - Check pending tasks widget
3. Navigate to analytics:
   - View monthly revenue chart
   - View service performance report
   - View customer retention metrics
4. Generate custom report:
   - Select date range
   - Select report type
   - Generate report
   - Export to PDF

**Expected Results**:
- ✅ All widgets load
- ✅ Data displayed correctly
- ✅ Charts render properly
- ✅ Reports generate successfully
- ✅ Export works

**Critical Validations**:
- [ ] Widget data accurate
- [ ] Charts interactive
- [ ] Report filters work
- [ ] Export format correct

---

### Scenario 6: Customer Management (MEDIUM PRIORITY)
**Tester**: Admin  
**Duration**: 10 minutes  
**Frequency**: Test 1 time

**Steps**:
1. Login as admin
2. Navigate to customer list
3. Search for customer:
   - By name
   - By phone
   - By status
4. View customer details:
   - Personal information
   - Booking history
   - Payment history
   - Session history
5. Update customer information:
   - Change phone number
   - Update address
   - Add notes
6. View customer timeline:
   - Check activity log
   - Check notification history

**Expected Results**:
- ✅ Search works correctly
- ✅ Customer details complete
- ✅ History accurate
- ✅ Updates save
- ✅ Timeline displays

---

### Scenario 7: Notification System (LOW PRIORITY)
**Tester**: Admin  
**Duration**: 5 minutes  
**Frequency**: Test 1 time

**Steps**:
1. Trigger notification events:
   - Create booking (notification to customer & KTV)
   - Complete session (notification to customer)
   - Process payment (notification to customer)
2. Check notification delivery:
   - In-app notifications
   - Email notifications (check logs)
   - SMS notifications (if configured)
3. Mark notifications as read
4. Check notification history

**Expected Results**:
- ✅ Notifications triggered
- ✅ Delivery successful
- ✅ Read status updates
- ✅ History accurate

---

## 📊 Test Coverage Matrix

| Feature Area | Scenario | Priority | Status |
|--------------|----------|----------|--------|
| Customer Order | #1 | HIGH | ⏳ |
| KTV Session | #2 | HIGH | ⏳ |
| Finance | #3 | HIGH | ⏳ |
| Salary | #4 | HIGH | ⏳ |
| Dashboard | #5 | MEDIUM | ⏳ |
| Customer Mgmt | #6 | MEDIUM | ⏳ |
| Notifications | #7 | LOW | ⏳ |

---

## 🐛 Issue Reporting

### How to Report Issues

**Use this template**:
```
Title: [Brief description]

Severity: [Critical / High / Medium / Low]

Scenario: [Which test scenario]

Steps to Reproduce:
1. [Step 1]
2. [Step 2]
3. [Step 3]

Expected Result: [What should happen]

Actual Result: [What actually happened]

Screenshots: [Attach if possible]

Browser: [Chrome / Firefox / Safari]
Date/Time: [When it occurred]
Tester: [Your name]
```

### Severity Levels

**Critical**: 
- Application crashes
- Data loss
- Cannot complete core workflow
- Security issue
→ **Action**: Fix immediately, may require rollback

**High**:
- Feature not working as expected
- Incorrect calculations
- Data inconsistency
→ **Action**: Fix before production

**Medium**:
- UI glitch
- Minor functional issue
- Workaround available
→ **Action**: Fix or document

**Low**:
- Cosmetic issue
- Minor inconvenience
- Enhancement suggestion
→ **Action**: Log for future improvement

---

## ✅ Exit Criteria

UAT is considered **complete and successful** when:

- [ ] All HIGH priority scenarios tested at least 3 times
- [ ] All MEDIUM priority scenarios tested at least 1 time
- [ ] Zero CRITICAL issues found
- [ ] All HIGH severity issues resolved
- [ ] MEDIUM/LOW issues documented and approved for defer
- [ ] Stakeholder sign-off obtained
- [ ] Production deployment approved

---

## 📅 Daily Status Report Template

**Date**: [Date]  
**Day**: [1/3, 2/3, 3/3...]

### Testing Completed Today
- Scenario #X: [Status - Pass/Fail]
- Scenario #Y: [Status - Pass/Fail]

### Issues Found
- [Issue #1 - Severity]
- [Issue #2 - Severity]

### Issues Resolved
- [Issue #X - Resolution]

### Blockers
- [Any blockers preventing testing]

### Tomorrow's Plan
- Test Scenario #Z
- Retest fixed issues
- Complete remaining scenarios

---

## 🎯 Final Sign-Off

### UAT Team Sign-Off

**Admin Tester**: _________________________ Date: _______  
**KTV Tester**: _________________________ Date: _______  
**Accountant Tester**: _________________________ Date: _______  
**Operations Tester**: _________________________ Date: _______

### Stakeholder Approval

**Product Manager**: _________________________ Date: _______  
**Operations Manager**: _________________________ Date: _______  
**Technical Lead**: _________________________ Date: _______

### Production Deployment Approval

**CTO/CEO**: _________________________ Date: _______

**Recommendation**: 
- [ ] ✅ Approve for production deployment
- [ ] ⚠️ Approve with noted issues
- [ ] ❌ Do not deploy (critical issues found)

---

**UAT Plan Version**: 1.0  
**Last Updated**: 2026-06-17  
**Prepared By**: Kiro AI

