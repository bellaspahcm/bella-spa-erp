# Rule Management User Guide

**Version**: 1.0.0  
**Last Updated**: 2026-07-12  
**Target Audience**: Business Users, Administrators  

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Creating a Rule](#creating-a-rule)
4. [Testing a Rule](#testing-a-rule)
5. [Managing Rules](#managing-rules)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is Rule Management?

The Rule Management system allows you to **create, test, and manage business rules without writing code**. Rules automate decisions like:

- ✅ Auto-approving bookings (VIP customers → auto-approve)
- 💰 Applying discounts (3+ services → 12% bundle discount)
- 📊 Calculating KPI bonuses (rating ≥ 4.5 → 50,000đ bonus)
- 📦 Managing inventory (stock < 10 → auto-reorder)

### Why Use Rules?

**Before Rules** (hardcoded):
```typescript
if (customer.tier === 'VIP' && booking.totalAmount > 5000000) {
  booking.status = 'approved';
  booking.requiresDeposit = false;
} else if (customer.tier === 'Loyal') {
  booking.status = 'pending_approval';
  booking.requiresDeposit = true;
}
// 100+ lines of if-else...
```

**After Rules** (no-code):
- Rule 1: `IF customer.tier = VIP AND booking.totalAmount > 5M THEN approve`
- Rule 2: `IF customer.tier = Loyal THEN require approval + deposit`
- **Editable by business users** ✅
- **Testable before activation** ✅
- **No developer needed** ✅

---

## Getting Started

### Accessing Rule Management

1. **Navigate** to Dashboard → Rules
2. **URL**: `/dashboard/rules`
3. **Required Permission**: `admin` or `manager` role

### Rule Management Interface

```
┌─────────────────────────────────────────────────────────┐
│                     📋 Rules                             │
├─────────────────────────────────────────────────────────┤
│  [+ New Rule]  [🔍 Search]  [Filter ▼]                  │
├─────────────────────────────────────────────────────────┤
│  Rule Name          Provider   Status    Priority       │
│  ───────────────────────────────────────────────────── │
│  VIP Auto-Approval  Booking    ✅ Active   100         │
│  Bundle Discount    Discount   ✅ Active   90          │
│  KPI Bonus         Payroll     ⏸️  Draft    80         │
└─────────────────────────────────────────────────────────┘
```

---

## Creating a Rule

### Step 1: Start New Rule

1. Click **[+ New Rule]** button
2. You'll see the Rule Editor with 3 sections:
   - **Metadata**: Name, description, provider
   - **Conditions**: When to trigger rule
   - **Actions**: What to do when triggered

### Step 2: Fill Metadata

**Required fields**:
- **Name**: Short descriptive name (e.g., "VIP Auto-Approval")
- **Provider**: Business module (Booking, Discount, Payroll, etc.)
- **Priority**: Execution order (100 = highest, 1 = lowest)

**Optional fields**:
- **Description**: Detailed explanation for other users
- **Category**: Group related rules (e.g., "Customer Tier", "Seasonal")

**Example**:
```
Name: VIP Auto-Approval
Description: Auto-approve bookings for VIP customers with high order value
Provider: Booking
Priority: 100
Category: Customer Tier
```

### Step 3: Add Conditions

Conditions define **WHEN** the rule applies. Think of it as an IF statement.

#### 3.1. Add First Condition

1. Click **[+ Add Condition]**
2. Select **Field** (what to check)
   - Example: `customer.tier`
3. Select **Operator** (how to check)
   - Example: `equals`
4. Enter **Value** (what to match)
   - Example: `VIP`

**Result**: `IF customer.tier equals VIP`

#### 3.2. Add Multiple Conditions

Click **[+ Add Condition]** again:

**Condition 2**:
- Field: `booking.totalAmount`
- Operator: `greater_than`
- Value: `5000000`

**Result**: `IF customer.tier equals VIP AND booking.totalAmount > 5M`

#### 3.3. Change Logical Operator (AND → OR)

- By default: All conditions must match (**AND**)
- Click **[AND]** button to toggle to **[OR]**
- **OR** means: ANY condition matches

**Example AND**:
```
✅ VIP customers with orders > 5M
❌ VIP customers with orders < 5M (condition 2 fails)
❌ Loyal customers with orders > 5M (condition 1 fails)
```

**Example OR**:
```
✅ VIP customers (regardless of amount)
✅ ANY customer with orders > 5M (regardless of tier)
```

### Step 4: Add Actions

Actions define **WHAT TO DO** when conditions match.

#### 4.1. Add First Action

1. Click **[+ Add Action]**
2. Select **Action Type**:
   - `approve` - Auto-approve
   - `reject` - Auto-reject
   - `requiresDeposit` - Set deposit requirement
   - `modifyAmount` - Change amounts
   - `sendNotification` - Send alerts

3. Fill **Parameters** (depends on action type)

**Example - Approve Action**:
```
Action Type: approve
Reason: VIP customer with high order value
```

**Example - Deposit Action**:
```
Action Type: requiresDeposit
Deposit Amount: 30%
Reason: Standard deposit for non-VIP
```

#### 4.2. Add Multiple Actions

You can add multiple actions that execute in order:

**Action 1**: `approve` (auto-approve booking)  
**Action 2**: `sendNotification` (notify staff "VIP booking approved")  
**Action 3**: `assignKTV` (auto-assign highest-rated KTV)

### Step 5: Save Rule

1. Click **[Save]** button
2. Rule status: **Draft** (not active yet)
3. **Next**: Test the rule before activating

---

## Testing a Rule

### Why Test Rules?

**ALWAYS test rules before activating** to avoid:
- ❌ Wrong discounts applied → Revenue loss
- ❌ Wrong bookings auto-approved → Capacity issues
- ❌ Wrong KPI calculated → Employee disputes

### Step 1: Navigate to Test Page

1. Go to Rules List
2. Click rule name
3. Click **[Test]** tab
4. URL: `/dashboard/rules/[ruleId]/test`

### Step 2: Enter Test Data

**Input Data** (JSON format):
```json
{
  "customer": {
    "tier": "VIP",
    "totalSpent": 10000000
  },
  "booking": {
    "totalAmount": 6000000,
    "serviceCount": 3
  }
}
```

**Tips**:
- Use **real customer data** for accuracy
- Copy from recent bookings
- Test **edge cases** (minimum values, maximum values)

### Step 3: Execute Test

1. Click **[▶ Execute Test]** button
2. Wait 1-2 seconds
3. See results:

```
✅ Test Passed
Execution Time: 50ms

Conditions Matched: 2
Actions Executed: 1

Actual Output:
{
  "status": "approved",
  "requiresDeposit": false,
  "reason": "VIP customer with high order value"
}
```

### Step 4: Review Execution Trace

The **Execution Trace** shows step-by-step what happened:

```
1. Evaluating conditions
   → started

2. Condition 1: customer.tier equals VIP
   → matched

3. Condition 2: booking.totalAmount > 5000000
   → matched

4. All conditions evaluated
   → all met

5. Executing actions
   → started

6. Action: approve
   → executed

7. All actions executed
   → success
```

### Step 5: Test Multiple Scenarios

**Scenario 1**: VIP with high amount → Should approve ✅  
**Scenario 2**: VIP with low amount → Should approve or reject? (depends on your rule)  
**Scenario 3**: Loyal with high amount → Should approve or require deposit?  
**Scenario 4**: New customer with low amount → Should reject?

**Pro Tip**: Save test names like "VIP High Value", "Loyal Low Value" to reuse later.

### Step 6: Activate Rule

Once tests pass:

1. Go back to Rules List
2. Click **[Enable]** button
3. Rule status: **Draft** → **Active** ✅
4. Rule now applies to **all new bookings** automatically

---

## Managing Rules

### Enabling/Disabling Rules

**Enable**: Activate rule (applies to new transactions)  
**Disable**: Deactivate rule (stops applying, doesn't delete)

**Use Cases**:
- Disable seasonal rules (Lunar New Year ended)
- Disable buggy rules (wrong calculation)
- Enable during campaign (re-enable referral discount)

### Changing Rule Priority

Rules execute in **priority order** (100 → 1):

**Example**:
- Rule 1 (Priority 100): VIP Auto-Approval
- Rule 2 (Priority 90): Bundle Discount
- Rule 3 (Priority 80): Standard Approval

**What happens**:
1. Check VIP rule first → If matches, approve immediately
2. If not VIP, check Bundle discount
3. If no discount, use Standard approval

**To Change Priority**:
1. Edit rule
2. Change priority number
3. Save

**Tip**: Leave gaps (100, 90, 80) so you can insert rules later (95, 85).

### Viewing Rule History

1. Click rule name
2. Click **[Versions]** tab
3. See all changes:

```
Version 3 (Current)
- Changed: priority 100 → 90
- By: admin@bella.vn
- Date: 2026-07-12 10:30

Version 2
- Changed: added condition "booking.serviceCount > 2"
- By: manager@bella.vn
- Date: 2026-07-11 14:20

Version 1 (Original)
- Created by: admin@bella.vn
- Date: 2026-07-10 09:00
```

### Rolling Back Rules

If a rule change causes issues:

1. Go to Versions tab
2. Click version you want to restore
3. Click **[Rollback]** button
4. Confirm
5. Rule reverts to old version ✅

---

## Best Practices

### 1. Use Clear Names

❌ Bad: "Rule 1", "Test", "New Rule"  
✅ Good: "VIP Auto-Approval", "Bundle Discount 12%", "KPI Tier 3 Bonus"

### 2. Write Descriptions

Help future users understand:

**Example**:
```
Name: VIP Auto-Approval
Description: Auto-approve bookings for VIP customers when:
- Total amount > 5,000,000đ
- At least 2 services
- No conflicting bookings
Approved by: Management (2026-07-10)
```

### 3. Test Before Activating

**Always test**:
- ✅ Happy path (rule should trigger)
- ✅ Edge cases (minimum values, maximum values)
- ✅ Negative cases (rule should NOT trigger)

### 4. Start with Draft Status

**Recommended workflow**:
1. Create rule → Status: **Draft**
2. Test thoroughly → Fix issues
3. Enable rule → Status: **Active**
4. Monitor for 1-2 days → Check for errors
5. If issues → Disable immediately → Fix → Re-test

### 5. Use Priority Wisely

**High Priority (90-100)**: Critical rules (VIP, safety)  
**Medium Priority (50-89)**: Normal business rules  
**Low Priority (1-49)**: Fallback rules (default behavior)

### 6. Document Business Logic

Add comments in description:

```
Business Rule: All VIP customers get auto-approval
Reason: Increase VIP satisfaction, reduce wait time
Owner: Sales Manager
Approved: 2026-07-10 Board Meeting
Review Date: 2026-10-10 (quarterly review)
```

### 7. Review Rules Quarterly

**Checklist**:
- [ ] Are seasonal rules still needed?
- [ ] Do thresholds need updating? (inflation, pricing changes)
- [ ] Are there disabled rules to delete?
- [ ] Can we consolidate duplicate rules?

---

## Troubleshooting

### Issue 1: Rule Not Triggering

**Symptoms**: Rule is Active but not applying to new transactions

**Possible Causes**:
1. **Conditions don't match**
   - Solution: Test with real transaction data
   - Check execution trace → See which condition failed

2. **Priority too low**
   - Solution: Another rule executed first and stopped execution
   - Increase priority or disable conflicting rule

3. **Rule disabled by mistake**
   - Solution: Check status → Re-enable

### Issue 2: Wrong Action Executed

**Symptoms**: Rule triggers but does wrong thing (wrong discount, wrong approval)

**Possible Causes**:
1. **Action parameters wrong**
   - Solution: Edit rule → Check action parameters
   - Test again with same data

2. **Multiple actions conflict**
   - Solution: Review action order
   - Remove conflicting actions

### Issue 3: Test Fails But Should Pass

**Symptoms**: Test shows "Failed" but data looks correct

**Possible Causes**:
1. **JSON format wrong**
   - Solution: Check for typos, missing commas, missing quotes
   - Use JSON validator: https://jsonlint.com

2. **Field names don't match**
   - Solution: Check exact field names (case-sensitive)
   - Example: `customerTier` ≠ `customer.tier`

3. **Value types don't match**
   - Solution: Check data types
   - Number: `5000000` (no quotes)
   - String: `"VIP"` (with quotes)

### Issue 4: Execution Time Too Slow

**Symptoms**: Test takes > 5 seconds

**Possible Causes**:
1. **Complex conditions**
   - Solution: Simplify conditions (split into 2 rules)

2. **Too many actions**
   - Solution: Remove unnecessary actions

3. **External API calls in actions**
   - Solution: Use async actions (don't block execution)

### Getting Help

**Contact Support**:
- Email: support@bella.vn
- Slack: #rule-management channel
- Docs: https://docs.bella.vn/rules

**Include in support request**:
1. Rule ID
2. Test data (JSON)
3. Expected output
4. Actual output
5. Screenshot of execution trace

---

## Summary

### Key Takeaways

✅ **Rules automate decisions** without code  
✅ **Always test before activating**  
✅ **Use clear names and descriptions**  
✅ **Monitor rules after activation**  
✅ **Review rules quarterly**

### Quick Reference

**Create Rule**:
1. New Rule → Fill metadata
2. Add conditions (IF)
3. Add actions (THEN)
4. Save as Draft

**Test Rule**:
1. Test tab → Enter JSON data
2. Execute → Review results
3. Check execution trace
4. Fix if needed

**Activate Rule**:
1. All tests pass → Enable
2. Monitor for 1-2 days
3. If issues → Disable immediately

### Next Steps

- [ ] Create your first rule
- [ ] Test with real data
- [ ] Activate and monitor
- [ ] Review rule performance weekly
- [ ] Train your team on rule management

---

**Document Version**: 1.0.0  
**Last Updated**: 2026-07-12  
**Maintained by**: Product Team  
**Feedback**: Please send suggestions to product@bella.vn

