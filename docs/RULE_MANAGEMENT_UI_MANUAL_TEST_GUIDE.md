# Rule Management UI - Manual Testing Guide

**Date**: 2026-07-12  
**Environment**: Local Development (http://localhost:3000)  
**Status**: Ready for Manual Testing  

---

## 🎯 TESTING OBJECTIVE

Verify that Rule Management UI works correctly for business users to create, test, and manage decision rules without writing code.

---

## 📋 PRE-TESTING CHECKLIST

### ✅ Prerequisites
- [ ] Dev server running at http://localhost:3000
- [ ] Browser opened (Chrome/Edge/Firefox)
- [ ] Admin user credentials ready
- [ ] Test data prepared (see below)

### ✅ Test Environment Status
```
✓ Dev Server: Running (http://localhost:3000)
✓ Backend: Ready (339/340 tests passed)
✓ Database: Connected (Supabase)
✓ Decision Engine: Operational (all providers tested)
```

---

## 🚀 TESTING SCENARIOS

### Scenario 1: Access Rule Management UI

#### Step 1.1: Navigate to Dashboard
1. Open browser: http://localhost:3000
2. Login with admin credentials
3. Navigate to Dashboard

**Expected Result**:
- ✅ Dashboard loads successfully
- ✅ Navigation menu visible
- ✅ Admin menu accessible

#### Step 1.2: Navigate to Rule Management
1. Click "Admin" in sidebar (or top menu)
2. Click "Rule Management" or navigate to `/dashboard/admin/rules`
3. Alternatively, go directly to: http://localhost:3000/dashboard/admin/rules

**Expected Result**:
- ✅ Rule Management page loads
- ✅ "Create Rule" button visible
- ✅ Rule list displays (may be empty initially)
- ✅ Search/filter controls visible
- ✅ No JavaScript errors in console (F12)

**Screenshot Checklist**:
- [ ] Page header shows "Rule Management" or similar
- [ ] "Create Rule" button (usually top-right)
- [ ] Empty state message (if no rules) or rule list
- [ ] Sidebar navigation visible

---

### Scenario 2: Create a New Discount Rule

#### Test Case 2.1: Basic Rule Creation

**Test Goal**: Create a VIP customer discount rule

**Steps**:
1. Click "Create Rule" button
2. Fill in basic info:
   - **Rule Name**: "VIP Customer 15% Discount"
   - **Provider**: "Discount" (select from dropdown)
   - **Decision Type**: "calculate" (select from dropdown)
   - **Priority**: 10 (higher number = higher priority)
   - **Description**: "Apply 15% discount to VIP customers"
   - **Status**: Enabled (toggle ON)

**Expected Result**:
- ✅ Form displays all fields correctly
- ✅ Dropdowns populate with options
- ✅ No validation errors yet
- ✅ "Next" or "Add Conditions" button appears

**Screenshot**: Capture the basic info form

---

#### Test Case 2.2: Add Conditions (Visual Builder)

**Test Goal**: Build condition "Customer Tier equals VIP"

**Steps**:
1. Click "Add Condition" or navigate to Conditions tab
2. **Field Selection**:
   - Click "Select Field" dropdown
   - Search or scroll to "Customer Tier"
   - Select "Customer Tier"
3. **Operator Selection**:
   - Click "Select Operator" dropdown
   - Select "equals" (or "=")
4. **Value Input**:
   - Click "Value" input field
   - Enter "VIP" (or select from dropdown if provided)
5. Click "Add Condition" to confirm

**Expected Result**:
- ✅ Field dropdown shows available fields (customer tier, subtotal, membership, etc.)
- ✅ Operator dropdown shows logical operators (equals, not equals, greater than, etc.)
- ✅ Value input type changes based on field (text, number, dropdown, date)
- ✅ Condition row displays: "Customer Tier = VIP"
- ✅ "Add Condition" button available to add more
- ✅ AND/OR toggle visible (if multiple conditions)

**Advanced Test** (Optional):
6. Click "Add Condition" again
7. Build second condition: "Subtotal >= 500000"
8. Change AND/OR toggle to "AND"

**Expected Result**:
- ✅ Two condition rows visible
- ✅ Logic: "Customer Tier = VIP AND Subtotal >= 500000"
- ✅ Can remove individual conditions (X button)

**Screenshot**: Capture the condition builder with 1-2 conditions

---

#### Test Case 2.3: Add Actions (Visual Builder)

**Test Goal**: Build action "Assign 15% discount"

**Steps**:
1. Click "Add Action" or navigate to Actions tab
2. **Action Type Selection**:
   - Click "Select Action" dropdown
   - Select "Assign Discount" (or similar)
3. **Action Parameters**:
   - **Discount Type**: Select "Percentage" (from dropdown)
   - **Discount Value**: Enter "15"
   - **Reason** (optional): "VIP Customer Discount"
4. Click "Add Action" to confirm

**Expected Result**:
- ✅ Action dropdown shows available actions (Assign Discount, Set Priority, etc.)
- ✅ Dynamic form appears based on action type
- ✅ Form fields match action requirements (percentage, fixed amount, etc.)
- ✅ Action row displays: "Assign Discount: 15% (VIP Customer Discount)"
- ✅ Can add multiple actions (if needed)

**Screenshot**: Capture the action builder

---

#### Test Case 2.4: Validate and Save Rule

**Steps**:
1. Review rule summary (if displayed)
2. Click "Save Rule" or "Create Rule" button

**Expected Result - Validation Errors** (if incomplete):
- ✅ Red error messages appear near incomplete fields
- ✅ Cannot save until all required fields filled
- ✅ Error messages clear, actionable (e.g., "Rule name is required")

**Expected Result - Successful Save**:
- ✅ Success message appears (toast, alert, or banner)
- ✅ Redirect to rule list page
- ✅ New rule visible in list
- ✅ Rule shows correct status (Enabled)
- ✅ Rule shows correct priority (10)

**Screenshot**: Capture success message and updated rule list

---

### Scenario 3: Test Decision Simulator

#### Test Case 3.1: Navigate to Simulator

**Steps**:
1. From rule list, click the rule created earlier ("VIP Customer 15% Discount")
2. Navigate to "Test" tab or "Simulator" section
3. Alternatively, go to: http://localhost:3000/dashboard/admin/rules/[ruleId]/test

**Expected Result**:
- ✅ Simulator page loads
- ✅ JSON input editor visible
- ✅ "Execute Decision" button visible
- ✅ Results section empty (no test run yet)

**Screenshot**: Capture the simulator UI

---

#### Test Case 3.2: Execute Decision with Matching Input

**Test Goal**: Test rule with VIP customer data

**Steps**:
1. **Input JSON** (paste into editor):
   ```json
   {
     "tenantId": "test-tenant",
     "customerId": "customer-vip-001",
     "customerTier": "VIP",
     "subtotal": 1000000,
     "items": [
       {
         "id": "item-001",
         "name": "Combo Massage",
         "price": 500000,
         "quantity": 2
       }
     ]
   }
   ```
2. Click "Execute Decision" button
3. Wait for results

**Expected Result**:
- ✅ Loading indicator appears briefly
- ✅ Results section displays:
   - **Decision Result**: Success (or similar)
   - **Discount Applied**: 15% (150,000 VND)
   - **Final Total**: 850,000 VND
- ✅ **Execution Trace** shows:
   - Rules evaluated: 1 (or more)
   - Rules matched: 1 ("VIP Customer 15% Discount")
   - Execution time: < 2ms
   - Actions executed: "Assign Discount: 15%"
- ✅ **Metadata** shows:
   - Timestamp
   - Provider: Discount
   - Decision Type: calculate

**Screenshot**: Capture the results with execution trace

---

#### Test Case 3.3: Execute Decision with Non-Matching Input

**Test Goal**: Test rule with non-VIP customer (should NOT apply discount)

**Steps**:
1. **Input JSON** (modify previous):
   ```json
   {
     "tenantId": "test-tenant",
     "customerId": "customer-regular-001",
     "customerTier": "Regular",
     "subtotal": 1000000,
     "items": [
       {
         "id": "item-001",
         "name": "Combo Massage",
         "price": 500000,
         "quantity": 2
       }
     ]
   }
   ```
2. Click "Execute Decision" again

**Expected Result**:
- ✅ Results section updates
- ✅ **Decision Result**: No discount applied (or 0%)
- ✅ **Final Total**: 1,000,000 VND (unchanged)
- ✅ **Execution Trace** shows:
   - Rules evaluated: 1 (or more)
   - Rules matched: 0 (condition "Customer Tier = VIP" not met)
   - Execution time: < 2ms

**Screenshot**: Capture the negative test result

---

### Scenario 4: Edit Existing Rule

#### Test Case 4.1: Edit Rule Conditions

**Steps**:
1. Navigate back to rule list
2. Click "Edit" button on "VIP Customer 15% Discount" rule
3. Navigate to Conditions section
4. **Modify condition**:
   - Change "Customer Tier = VIP" to "Customer Tier = Loyal"
5. Click "Update" or "Save Changes"

**Expected Result**:
- ✅ Edit page loads with existing values pre-filled
- ✅ Can modify conditions without starting from scratch
- ✅ Changes save successfully
- ✅ Success message appears

**Verify**:
6. Test in simulator with "Loyal" customer
7. Verify discount now applies to Loyal customers, not VIP

**Screenshot**: Capture the edit form and verification

---

### Scenario 5: Enable/Disable Rule

#### Test Case 5.1: Disable Rule

**Steps**:
1. Navigate to rule list
2. Find "VIP Customer 15% Discount" rule
3. Toggle the "Enabled" switch to OFF (or click "Disable" button)

**Expected Result**:
- ✅ Toggle switches to OFF state
- ✅ Rule status changes to "Disabled"
- ✅ Rule grays out or shows disabled indicator
- ✅ Success message: "Rule disabled successfully"

**Verify**:
4. Test in simulator with VIP customer input
5. Verify discount NO LONGER applied (rule disabled)

**Screenshot**: Capture disabled rule in list and simulator result

---

#### Test Case 5.2: Re-enable Rule

**Steps**:
1. Toggle the "Enabled" switch back to ON
2. Verify status changes to "Enabled"
3. Test in simulator again
4. Verify discount now applies again

**Expected Result**:
- ✅ Rule re-enabled successfully
- ✅ Discount applies in simulator test

---

### Scenario 6: Rule Priority and Ordering

#### Test Case 6.1: Create Second Rule with Different Priority

**Steps**:
1. Create another discount rule:
   - **Name**: "Loyal Customer 10% Discount"
   - **Provider**: Discount
   - **Decision Type**: calculate
   - **Priority**: 5 (lower than VIP rule)
   - **Condition**: "Customer Tier = Loyal"
   - **Action**: "Assign Discount: 10%"
2. Save rule

**Expected Result**:
- ✅ Two rules now in list
- ✅ Rules sorted by priority (VIP rule 10 appears before Loyal rule 5)

**Screenshot**: Capture rule list with 2 rules

---

#### Test Case 6.2: Test Priority (First Match Wins)

**Steps**:
1. Create test customer with BOTH VIP and Loyal tiers (edge case)
2. Test in simulator
3. Verify which discount applies

**Expected Result**:
- ✅ Higher priority rule (VIP 15%) should win
- ✅ Execution trace shows both rules evaluated
- ✅ Only first matching rule's action executed

---

### Scenario 7: Validation and Error Handling

#### Test Case 7.1: Required Field Validation

**Steps**:
1. Click "Create Rule"
2. Leave "Rule Name" blank
3. Try to save

**Expected Result**:
- ✅ Error message: "Rule name is required"
- ✅ Cannot proceed until filled

---

#### Test Case 7.2: Invalid Value Validation

**Steps**:
1. Create rule with condition: "Subtotal >= ABC" (invalid number)
2. Try to save

**Expected Result**:
- ✅ Error message: "Value must be a number"
- ✅ Cannot save invalid rule

---

#### Test Case 7.3: Circular Dependency Detection

**Steps**:
1. Try to create rule that references itself (if UI allows)
2. Try to save

**Expected Result**:
- ✅ Error message: "Circular dependency detected"
- ✅ Rule not saved

---

### Scenario 8: Performance and Responsiveness

#### Test Case 8.1: Load Time

**Steps**:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Navigate to Rule Management page
4. Measure load time

**Expected Result**:
- ✅ Page loads in < 1 second
- ✅ No network errors (500, 404)
- ✅ All assets load successfully

---

#### Test Case 8.2: Large Rule Set

**Steps**:
1. Create 10+ rules (use API or UI)
2. Load rule list page
3. Verify pagination or scrolling works

**Expected Result**:
- ✅ Page loads smoothly even with many rules
- ✅ Pagination controls work (if implemented)
- ✅ Search/filter works (if implemented)

---

## 🐛 BUG REPORTING TEMPLATE

If you find any issues during testing, document using this template:

```markdown
### Bug Report

**Bug Title**: [Short description]

**Severity**: [Critical / High / Medium / Low]

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected Result**:
[What should happen]

**Actual Result**:
[What actually happened]

**Screenshots**:
[Attach screenshots]

**Browser**: [Chrome/Edge/Firefox, version]
**URL**: [Exact URL where bug occurred]
**Console Errors**: [Copy any errors from browser console]

**Environment**:
- Dev Server: http://localhost:3000
- Date: 2026-07-12
```

---

## ✅ TESTING CHECKLIST

### Core Functionality
- [ ] Rule Management page loads
- [ ] Create new rule works
- [ ] Visual Condition Builder works
- [ ] Visual Action Builder works
- [ ] Save rule works
- [ ] Edit rule works
- [ ] Delete rule works (if implemented)
- [ ] Enable/disable toggle works
- [ ] Rule list displays correctly
- [ ] Search/filter works (if implemented)

### Decision Simulator
- [ ] Simulator page loads
- [ ] JSON input editor works
- [ ] Execute decision works
- [ ] Results display correctly
- [ ] Execution trace shows details
- [ ] Performance metrics shown
- [ ] Test history saved (if implemented)

### Validation
- [ ] Required field validation works
- [ ] Invalid value validation works
- [ ] Error messages clear and helpful
- [ ] Cannot save invalid rules

### UI/UX
- [ ] No JavaScript errors in console
- [ ] Page loads in < 1 second
- [ ] All buttons clickable
- [ ] All forms responsive
- [ ] Mobile-friendly (if applicable)
- [ ] Tooltips/help text present
- [ ] Loading indicators shown during async operations

### Integration
- [ ] Rules saved to database
- [ ] Rules retrievable after page refresh
- [ ] Multiple providers supported (Booking, Discount, Payroll, etc.)
- [ ] Decision Engine executes rules correctly
- [ ] Observability metrics collected

---

## 📊 EXPECTED PERFORMANCE

### Page Load Times
| Page | Expected | Acceptable | Critical |
|------|----------|------------|----------|
| Rule List | < 500ms | < 1s | > 2s |
| Create Rule | < 300ms | < 800ms | > 1.5s |
| Edit Rule | < 500ms | < 1s | > 2s |
| Simulator | < 300ms | < 800ms | > 1.5s |

### Decision Execution
| Metric | Target | Measured |
|--------|--------|----------|
| Execution Time | < 2ms | ~0.6ms (from tests) |
| Response Time | < 500ms | TBD (manual test) |

---

## 🚀 QUICK START

**Fastest way to test**:

1. **Open Browser**:
   ```
   http://localhost:3000/dashboard/admin/rules
   ```

2. **Login** (if prompted)

3. **Create Test Rule**:
   - Name: "Test VIP Discount"
   - Provider: Discount
   - Condition: Customer Tier = VIP
   - Action: Assign Discount 15%

4. **Test in Simulator**:
   ```json
   {
     "tenantId": "test",
     "customerTier": "VIP",
     "subtotal": 1000000
   }
   ```

5. **Verify Result**:
   - ✅ 15% discount applied
   - ✅ Final total: 850,000
   - ✅ Execution time < 2ms

**If all above pass → UI works correctly! ✅**

---

## 📝 MANUAL TEST REPORT TEMPLATE

After testing, fill out this report:

```markdown
# Rule Management UI - Manual Test Report

**Date**: 2026-07-12
**Tester**: [Your Name]
**Duration**: [Time spent testing]

## Test Results Summary
- Total Scenarios Tested: X
- Passed: Y
- Failed: Z
- Blocked: W

## Detailed Results

### Scenario 1: Access Rule Management UI
- Status: PASS/FAIL
- Notes: [Any observations]

### Scenario 2: Create New Discount Rule
- Status: PASS/FAIL
- Notes: [Any observations]

### Scenario 3: Test Decision Simulator
- Status: PASS/FAIL
- Notes: [Any observations]

[... continue for all scenarios]

## Bugs Found
1. [Bug title] - [Severity]
2. [Bug title] - [Severity]

## Overall Assessment
- UI Quality: [Excellent / Good / Needs Work / Poor]
- Usability: [Excellent / Good / Needs Work / Poor]
- Performance: [Excellent / Good / Needs Work / Poor]
- Recommendation: [Ready for Production / Needs Fixes / Major Issues]

## Screenshots
[Attach all screenshots]

## Next Steps
[List any follow-up actions needed]
```

---

## 🎯 SUCCESS CRITERIA

**UI Testing is SUCCESSFUL if**:
- ✅ All 8 scenarios pass without blocking issues
- ✅ No critical bugs found
- ✅ Page load times < 1 second
- ✅ Decision execution < 2ms
- ✅ No JavaScript errors in console
- ✅ All CRUD operations work (Create, Read, Update, Delete/Disable)
- ✅ Decision Simulator produces correct results
- ✅ Validation prevents invalid rules

**Ready for Production if**:
- ✅ 90%+ scenarios pass
- ✅ Zero critical/high severity bugs
- ✅ Performance within targets
- ✅ User experience is intuitive

---

**START TESTING NOW**: http://localhost:3000/dashboard/admin/rules

Good luck! 🚀

---

**END OF MANUAL TEST GUIDE**
