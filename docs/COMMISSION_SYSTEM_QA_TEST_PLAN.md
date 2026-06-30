# Commission System - QA Test Plan

> **Environment:** Staging  
> **Version:** 1.0.0  
> **Test Date:** 22/06/2026  
> **Tester:** QA Team

---

## 1. Test Overview

### Scope
- Service commission functionality
- Product sales commission functionality
- Position & seniority bonuses
- Manual adjustments workflow
- Salary calculation accuracy
- Multi-tenant isolation
- Performance & security

### Test Environments
- **Staging:** Full QA testing
- **Production:** Smoke testing only

### Test Data
- 3 test tenants (Bella Spa, Beauty Spa, Cleaning)
- 10 test KTV users per tenant
- 50 test bookings
- 100 test service items
- 50 test product sales
- 20 test manual adjustments

---

## 2. Functional Testing

### 2.1. Service Commission Flow

#### Test Case 1.1: Create Service Item with Commission
**Priority:** Critical  
**Preconditions:** 
- Admin logged in
- Booking exists
- KTV exists

**Steps:**
1. Navigate to Booking detail
2. Click "Thêm dịch vụ"
3. Select package: "Chăm sóc Mẹ & Bé VIP"
4. Select KTV: "Nguyễn Thị Mai"
5. Price auto-filled: 500,000 VND
6. Commission auto-calculated: 15% = 75,000 VND
7. Click "Lưu"

**Expected Results:**
- ✅ Service item created successfully
- ✅ Commission = 75,000 VND (500,000 × 15%)
- ✅ KTV can see commission in salary breakdown
- ✅ Service item appears in booking detail

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe issue):

**Screenshots:**
- [ ] Attached

---

#### Test Case 1.2: Override Service Commission
**Priority:** High  
**Preconditions:** Service item exists

**Steps:**
1. Open service item detail
2. Click "Chỉnh sửa hoa hồng"
3. Change to fixed amount: 100,000 VND
4. Save

**Expected Results:**
- ✅ Commission updated to 100,000 VND
- ✅ Percentage override ignored
- ✅ Salary recalculated automatically

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

### 2.2. Product Sales Commission Flow

#### Test Case 2.1: Record Product Sale
**Priority:** Critical  
**Steps:**
1. Navigate to Kho → Bán hàng
2. Click "Tạo đơn mới"
3. Select product: "Dầu massage 500ml"
4. Quantity: 3
5. Select KTV: "Trần Văn Nam"
6. Payment method: Cash
7. Submit

**Expected Results:**
- ✅ Sale recorded
- ✅ Commission = (200,000 × 3) × 5% × 1.2 = 36,000 VND
- ✅ Inventory decreased by 3
- ✅ KTV can see commission

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 2.2: Product Refund (Full)
**Priority:** Critical  
**Steps:**
1. Open product sale detail
2. Click "Hoàn trả toàn bộ"
3. Enter reason: "Khách không hài lòng"
4. Confirm

**Expected Results:**
- ✅ Sale status = `refunded`
- ✅ Commission clawed back: -36,000 VND
- ✅ Inventory increased by 3
- ✅ Salary recalculated

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 2.3: Product Refund (Partial)
**Priority:** High  
**Steps:**
1. Sale: 5 products × 100,000 VND = 500,000 VND
2. Original commission: 25,000 VND
3. Refund 2 products
4. Check commission adjustment

**Expected Results:**
- ✅ Commission clawed back: 25,000 × (2/5) = 10,000 VND
- ✅ Remaining commission: 15,000 VND
- ✅ Inventory increased by 2 only

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

### 2.3. Manual Adjustments Workflow

#### Test Case 3.1: Create Bonus Adjustment
**Priority:** High  
**Steps:**
1. Navigate to Lương → Điều chỉnh
2. Click "Thêm điều chỉnh"
3. Select KTV: "Lê Thị Hoa"
4. Month: June 2026
5. Type: Bonus
6. Category: KPI Achievement
7. Amount: 2,000,000 VND
8. Reason: "Hoàn thành 120% KPI tháng 6"
9. Save as draft

**Expected Results:**
- ✅ Adjustment saved with status = `draft`
- ✅ Not yet applied to salary
- ✅ Appears in adjustments list

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 3.2: Approve Adjustment
**Priority:** Critical  
**Steps:**
1. Open adjustment from Test Case 3.1
2. Click "Gửi phê duyệt"
3. Admin clicks "Phê duyệt"

**Expected Results:**
- ✅ Status changed to `approved`
- ✅ Salary auto-recalculated
- ✅ KTV sees +2,000,000 VND in salary breakdown
- ✅ Cannot edit approved adjustment

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 3.3: Reject Adjustment
**Priority:** Medium  
**Steps:**
1. Create deduction: -500,000 VND
2. Submit for approval
3. Admin clicks "Từ chối"
4. Enter reason: "Không đủ căn cứ"

**Expected Results:**
- ✅ Status = `rejected`
- ✅ Not applied to salary
- ✅ Creator notified

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

### 2.4. Salary Calculation Accuracy

#### Test Case 4.1: Full Salary Calculation
**Priority:** Critical  
**Test Data:**
- KTV: Nguyễn Thị Mai
- Position: Senior (1.2x multiplier)
- Seniority: 4 years
- Base salary: 10,000,000 VND
- Working days: 26/26

**Activities in June 2026:**
- 15 service sessions × 500,000 VND × 15% commission
- 10 product sales = 5,000,000 VND × 5% commission
- KPI bonus: 2,000,000 VND
- Rating bonus: 300,000 VND (4.8 stars)
- Manual bonus: +500,000 VND
- Manual deduction: -100,000 VND

**Expected Calculation:**
```
Base salary:            10,000,000 VND
Service commission:     15 × 500k × 15% × 1.2 = 1,350,000 VND
Product commission:     5,000k × 5% × 1.2 = 300,000 VND
Seniority bonus:        1,000,000 VND (3-5 years)
KPI bonus:              2,000,000 VND
Rating bonus:           300,000 VND
Manual adjustments:     +500k - 100k = 400,000 VND
---
TOTAL:                  15,350,000 VND
```

**Actual Results:**
- [ ] Calculation matches expected
- [ ] Difference (if any):

---

### 2.5. Edge Cases Testing

#### Test Case 5.1: Zero Commission
**Priority:** Medium  
**Steps:**
1. Create service item with commission = 0%
2. Check salary calculation

**Expected Results:**
- ✅ No commission added
- ✅ Other components still calculated

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 5.2: Very Large Commission (Boundary)
**Priority:** Medium  
**Steps:**
1. Create service: 50,000,000 VND (50M VND service)
2. Commission: 20%
3. Check calculation

**Expected Results:**
- ✅ Commission = 10,000,000 VND (no overflow)
- ✅ Salary total correct

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 5.3: Cross-Month Service
**Priority:** High  
**Steps:**
1. Create service on June 30, 2026
2. Complete service on July 1, 2026
3. Check which month gets commission

**Expected Results:**
- ✅ Commission counted in completion month (July)
- ✅ Not duplicated in June

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 5.4: Empty Data (New KTV)
**Priority:** Medium  
**Steps:**
1. Create new KTV (no activities)
2. View salary breakdown

**Expected Results:**
- ✅ Shows base salary only
- ✅ All commission fields = 0
- ✅ No errors

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 5.5: Bulk Operations (100+ Records)
**Priority:** High  
**Steps:**
1. Import 100 service items via API
2. Check processing time
3. Verify all commissions calculated

**Expected Results:**
- ✅ Processing time < 30 seconds
- ✅ All 100 items have commission
- ✅ No duplicates

**Actual Results:**
- [ ] Pass
- [ ] Processing time:
- [ ] Fail:

---

## 3. Multi-Tenant Isolation Testing

#### Test Case 6.1: Tenant Data Isolation
**Priority:** Critical  
**Steps:**
1. Login as Bella Spa admin
2. View salary list
3. Check if any Beauty Spa KTV visible

**Expected Results:**
- ✅ Only Bella Spa KTV shown
- ✅ No Beauty Spa data visible
- ✅ Commission data isolated

**Actual Results:**
- [ ] Pass
- [ ] Fail (describe leakage):

---

#### Test Case 6.2: Cross-Tenant Service Items
**Priority:** Critical  
**Steps:**
1. Attempt to create service item for KTV from different tenant
2. Check if API blocks request

**Expected Results:**
- ✅ Request blocked
- ✅ Error message: "KTV not found" or "Permission denied"
- ✅ No data created

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

## 4. Performance Testing

#### Test Case 7.1: Page Load Times
**Priority:** High  
**Metrics:**

| Page | Target | Actual | Status |
|------|--------|--------|--------|
| Dashboard Lương | < 3s | ___ s | [ ] Pass / [ ] Fail |
| Chi tiết lương KTV | < 2s | ___ s | [ ] Pass / [ ] Fail |
| Danh sách điều chỉnh | < 3s | ___ s | [ ] Pass / [ ] Fail |
| Báo cáo hoa hồng | < 5s | ___ s | [ ] Pass / [ ] Fail |

---

#### Test Case 7.2: Salary Recalculation Performance
**Priority:** Critical  
**Steps:**
1. Trigger salary recalculation for 1 KTV
2. Measure time

**Expected Results:**
- ✅ < 5 seconds per KTV
- ✅ No database timeouts

**Actual Results:**
- [ ] Time: ___ seconds
- [ ] Pass / Fail:

---

#### Test Case 7.3: Bulk Recalculation (50 KTV)
**Priority:** High  
**Steps:**
1. Trigger bulk recalculation for 50 KTV
2. Measure total time

**Expected Results:**
- ✅ < 3 minutes (average 3.6s per KTV)
- ✅ No memory issues

**Actual Results:**
- [ ] Time: ___ minutes
- [ ] Pass / Fail:

---

## 5. Security Testing

#### Test Case 8.1: RLS Policies Enforced
**Priority:** Critical  
**Steps:**
1. Use Postman/curl to query `booking_service_items` directly
2. Use anon key (no auth)

**Expected Results:**
- ✅ Returns 0 rows (RLS blocks)
- ✅ Or returns 401/403 error

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 8.2: SQL Injection Prevention
**Priority:** Critical  
**Steps:**
1. Try SQL injection in search fields:
   - `'; DROP TABLE salary_adjustments; --`
   - `1' OR '1'='1`
2. Check if system sanitizes input

**Expected Results:**
- ✅ No SQL executed
- ✅ Safe error message or no results

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 8.3: XSS Prevention
**Priority:** High  
**Steps:**
1. Create adjustment with reason: `<script>alert('XSS')</script>`
2. View adjustment detail

**Expected Results:**
- ✅ Script not executed
- ✅ Text displayed safely (HTML escaped)

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

## 6. Browser Compatibility Testing

#### Test Matrix

| Browser | Version | Service UI | Product UI | Adjustments | Salary View | Status |
|---------|---------|------------|------------|-------------|-------------|--------|
| Chrome  | Latest  | [ ] Pass   | [ ] Pass   | [ ] Pass    | [ ] Pass    | [ ] OK / [ ] Fail |
| Firefox | Latest  | [ ] Pass   | [ ] Pass   | [ ] Pass    | [ ] Pass    | [ ] OK / [ ] Fail |
| Safari  | Latest  | [ ] Pass   | [ ] Pass   | [ ] Pass    | [ ] Pass    | [ ] OK / [ ] Fail |
| Edge    | Latest  | [ ] Pass   | [ ] Pass   | [ ] Pass    | [ ] Pass    | [ ] OK / [ ] Fail |
| Mobile Chrome | Latest | [ ] Pass | [ ] Pass | [ ] Pass  | [ ] Pass    | [ ] OK / [ ] Fail |
| Mobile Safari | Latest | [ ] Pass | [ ] Pass | [ ] Pass  | [ ] Pass    | [ ] OK / [ ] Fail |

**Common Issues Found:**
- [ ] None
- [ ] List issues:

---

## 7. Regression Testing

#### Test Case 9.1: Baby Care Salary Unaffected
**Priority:** Critical  
**Steps:**
1. Login as Baby Care tenant admin
2. View salary records for June 2026
3. Compare with previous month

**Expected Results:**
- ✅ Baby Care salary calculations unchanged
- ✅ No commission fields interfering
- ✅ All existing features work

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 9.2: Industrial Cleaning Unaffected
**Priority:** High  
**Steps:**
1. Login as Cleaning tenant admin
2. Check salary module

**Expected Results:**
- ✅ No commission UI visible (not enabled)
- ✅ Existing salary features work

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

#### Test Case 9.3: Existing Booking Flow
**Priority:** Critical  
**Steps:**
1. Create normal booking (without service items)
2. Complete booking
3. Check if process unchanged

**Expected Results:**
- ✅ Booking created normally
- ✅ No commission errors
- ✅ Session completion works

**Actual Results:**
- [ ] Pass
- [ ] Fail:

---

## 8. User Acceptance Testing (UAT)

#### UAT 1: Admin Creates First Commission
**Tester:** Business Owner  
**Scenario:** Real-world first-time setup

**Steps:**
1. Configure commission defaults
2. Create service item for real booking
3. Verify commission calculation
4. Approve manual adjustment
5. View final salary

**Feedback:**
- [ ] Easy to use
- [ ] Confusing (where?):
- [ ] Suggestions:

---

#### UAT 2: KTV Views Commission
**Tester:** Real KTV User  
**Scenario:** Check salary breakdown on mobile

**Steps:**
1. Login to KTV mobile app
2. Navigate to Salary tab
3. View commission details

**Feedback:**
- [ ] Clear and understandable
- [ ] Confusing (what?):
- [ ] Suggestions:

---

## 9. Bug Tracking

### Critical Bugs (Must Fix Before Production)

| Bug ID | Description | Steps to Reproduce | Status |
|--------|-------------|-------------------|--------|
| BUG-001 | ___ | ___ | [ ] Open / [ ] Fixed |
| BUG-002 | ___ | ___ | [ ] Open / [ ] Fixed |

### High Priority Bugs (Should Fix)

| Bug ID | Description | Steps to Reproduce | Status |
|--------|-------------|-------------------|--------|
| BUG-101 | ___ | ___ | [ ] Open / [ ] Fixed |
| BUG-102 | ___ | ___ | [ ] Open / [ ] Fixed |

### Medium/Low Priority Bugs (Nice to Fix)

| Bug ID | Description | Steps to Reproduce | Status |
|--------|-------------|-------------------|--------|
| BUG-201 | ___ | ___ | [ ] Open / [ ] Fixed |

---

## 10. Test Summary

### Statistics

- **Total Test Cases:** 35
- **Passed:** ___ / 35
- **Failed:** ___ / 35
- **Blocked:** ___ / 35
- **Pass Rate:** ___%

### Critical Issues Found

1. ___
2. ___
3. ___

### Recommendations

- [ ] Ready for production deployment
- [ ] Needs minor fixes (list above)
- [ ] Needs major fixes (DO NOT deploy)

### Sign-Off

**QA Team Lead:**  
Name: _______________  
Date: _______________  
Signature: _______________

**Product Owner:**  
Name: _______________  
Date: _______________  
Signature: _______________

---

*Test plan version: 1.0.0*  
*Last updated: 22/06/2026*
