# Bella Auto - Testing Checklist (Quick Reference)

**Version:** 1.0.0  
**Date:** August 3, 2026  
**Status:** Ready for Testing

---

## 🎯 Quick Testing Matrix

### Phase 0-1: Foundation (Priority: CRITICAL)

| ID | Test Case | Steps | Expected | Status | Notes |
|----|-----------|-------|----------|--------|-------|
| 0.1 | Module Isolation | Login → Navigate to /bella-auto | Dashboard loads, no cross-module access | ☐ Pass ☐ Fail | |
| 0.2 | RLS Verification | Query other tenant data | Access denied | ☐ Pass ☐ Fail | |
| 1.1 | Create Vehicle | Add vehicle with VIN | Vehicle created, status=in_transit | ☐ Pass ☐ Fail | |
| 1.2 | State Transitions | Transit through all 7 states | Valid transitions succeed, invalid blocked | ☐ Pass ☐ Fail | |
| 1.3 | Bulk Import | Import 10 vehicles via CSV | All imported, no duplicates | ☐ Pass ☐ Fail | |

---

### Phase 3: Customer Journey (Priority: HIGH)

| ID | Test Case | Steps | Expected | Status | Notes |
|----|-----------|-------|----------|--------|-------|
| 3.1 | Initialize Journey | Create lead → Auto-initialize | Journey starts at awareness | ☐ Pass ☐ Fail | |
| 3.2 | Complete Journey | Advance through all 22 stages | All transitions work | ☐ Pass ☐ Fail | |
| 3.3 | SLA Breach | Wait for SLA expiry | Status changes to breached | ☐ Pass ☐ Fail | |
| 3.4 | Funnel Analytics | View conversion report | Chart shows correct data | ☐ Pass ☐ Fail | |
| 3.5 | Touchpoint Tracking | Log call/email/visit | Touchpoints recorded | ☐ Pass ☐ Fail | |

---

### Phase 4-5: Sales & Experience (Priority: HIGH)

| ID | Test Case | Steps | Expected | Status | Notes |
|----|-----------|-------|----------|--------|-------|
| 4.1 | Lead Capture | Submit lead form | Lead created, auto-assigned | ☐ Pass ☐ Fail | |
| 4.2 | Lead Rotation | Create 5 leads | Fair distribution | ☐ Pass ☐ Fail | |
| 4.3 | Test Drive | Schedule appointment | Calendar updated, SMS sent | ☐ Pass ☐ Fail | |
| 4.4 | Quotation | Create quote with discount | Approval if > threshold | ☐ Pass ☐ Fail | |
| 4.5 | Deposit Payment | Record deposit | Vehicle status=allocated | ☐ Pass ☐ Fail | |
| 5.1 | NPS Survey | Trigger post-delivery | Survey sent, response recorded | ☐ Pass ☐ Fail | |
| 5.2 | Health Score | Calculate customer health | Score 0-100 calculated | ☐ Pass ☐ Fail | |
| 5.3 | Next Best Action | View recommendations | AI suggests next steps | ☐ Pass ☐ Fail | |

---

### Phase 6-7: Service & Trade-In (Priority: MEDIUM)

| ID | Test Case | Steps | Expected | Status | Notes |
|----|-----------|-------|----------|--------|-------|
| 6.1 | Service Appointment | Book maintenance | Appointment created | ☐ Pass ☐ Fail | |
| 6.2 | Repair Order | Create job card + line items | RO created, parts deducted | ☐ Pass ☐ Fail | |
| 6.3 | Service History | Complete service | Immutable history created | ☐ Pass ☐ Fail | |
| 6.4 | Warranty Claim | Submit claim | Workflow validation works | ☐ Pass ☐ Fail | |
| 7.1 | Trade-In Appraisal | Create appraisal | Checklist + photos tracked | ☐ Pass ☐ Fail | |
| 7.2 | Photo Upload | Upload 18 photos | All categories captured | ☐ Pass ☐ Fail | |
| 7.3 | Market Valuation | Calculate value | AI suggests price range | ☐ Pass ☐ Fail | |
| 7.4 | Approval Workflow | Submit for approval | Manager notified | ☐ Pass ☐ Fail | |

---

### Phase 8-9: Finance & AI (Priority: MEDIUM)

| ID | Test Case | Steps | Expected | Status | Notes |
|----|-----------|-------|----------|--------|-------|
| 8.1 | Loan Application | Create loan app | Application number generated | ☐ Pass ☐ Fail | |
| 8.2 | Monthly Payment | Calculate payment | Formula correct | ☐ Pass ☐ Fail | |
| 8.3 | Loan Approval | Approve with changes | Override amounts saved | ☐ Pass ☐ Fail | |
| 8.4 | Insurance Policy | Create policy | Auto-renewal enabled | ☐ Pass ☐ Fail | |
| 8.5 | Expiry Reminder | Check 30-day alert | Policies listed correctly | ☐ Pass ☐ Fail | |
| 9.1 | AI Insights | View insights dashboard | Insights prioritized | ☐ Pass ☐ Fail | |
| 9.2 | Demand Forecast | Generate forecast | Predictions with confidence | ☐ Pass ☐ Fail | |
| 9.3 | Churn Prediction | Identify high-risk | Risk scores calculated | ☐ Pass ☐ Fail | |
| 9.4 | Lifetime Journey | View 10-year timeline | All events aggregated | ☐ Pass ☐ Fail | |

---

### Phase 10: Mobile Workforce (Priority: HIGH)

| ID | Test Case | Steps | Expected | Status | Notes |
|----|-----------|-------|----------|--------|-------|
| 10.1 | Mobile Login | Login on mobile browser | Session created | ☐ Pass ☐ Fail | |
| 10.2 | Offline Mode | Disable network → Capture lead | Action queued | ☐ Pass ☐ Fail | |
| 10.3 | Sync Queue | Re-enable network | Actions sync automatically | ☐ Pass ☐ Fail | |
| 10.4 | Photo Capture | Take photo on mobile | Photo uploaded with metadata | ☐ Pass ☐ Fail | |
| 10.5 | Push Notification | Trigger notification | Alert received on device | ☐ Pass ☐ Fail | |
| 10.6 | Location Tracking | Check-in at showroom | Location recorded | ☐ Pass ☐ Fail | |

---

## 🔥 Critical Path Tests (Must Pass)

### Scenario 1: Complete Sales Flow (End-to-End)
**Duration:** 30 minutes  
**Priority:** CRITICAL

1. ☐ Capture lead from Facebook ads
2. ☐ Auto-assign to sales rep
3. ☐ Initialize journey at awareness
4. ☐ Schedule test drive
5. ☐ Create quotation
6. ☐ Record deposit payment
7. ☐ Allocate vehicle
8. ☐ Create loan application
9. ☐ Create insurance policy
10. ☐ Deliver vehicle
11. ☐ Send NPS survey
12. ☐ Verify revenue recognized

**Result:** ☐ PASS ☐ FAIL  
**Issues Found:** _______________

---

### Scenario 2: Service Center Flow (End-to-End)
**Duration:** 20 minutes  
**Priority:** CRITICAL

1. ☐ Customer books service appointment
2. ☐ Check-in on arrival
3. ☐ Create repair order with line items
4. ☐ Assign technician
5. ☐ Complete repair
6. ☐ Auto-deduct parts from inventory
7. ☐ Generate immutable service history
8. ☐ Collect payment
9. ☐ Send CSI survey

**Result:** ☐ PASS ☐ FAIL  
**Issues Found:** _______________

---

### Scenario 3: Mobile Offline-to-Online (End-to-End)
**Duration:** 15 minutes  
**Priority:** CRITICAL

1. ☐ Login on mobile device
2. ☐ Enable offline mode (airplane mode)
3. ☐ Capture 3 leads offline
4. ☐ Take 5 photos offline
5. ☐ Complete test drive form offline
6. ☐ Verify actions queued locally
7. ☐ Disable airplane mode
8. ☐ Wait for auto-sync
9. ☐ Verify all 8 actions synced
10. ☐ Check data integrity

**Result:** ☐ PASS ☐ FAIL  
**Issues Found:** _______________

---

## 🛡️ Zero Regression Tests (Must Pass)

### Verify No Impact on Other Modules

| Module | Test | Expected | Status |
|--------|------|----------|--------|
| Bella Spa (beauty_spa) | Login → Check dashboard | No Bella Auto menu visible | ☐ PASS ☐ FAIL |
| Bella Spa (babycare) | Query auto_vehicles table | Access denied or empty | ☐ PASS ☐ FAIL |
| Real Estate | Navigate /bella-auto route | 404 or access denied | ☐ PASS ☐ FAIL |
| CleanPro | Check CSS isolation | No style bleeding | ☐ PASS ☐ FAIL |
| Core Accounting | Create revenue entry | Accounting Outbox works | ☐ PASS ☐ FAIL |

**Overall Regression Status:** ☐ PASS ☐ FAIL

---

## 📊 Test Summary

**Total Test Cases:** 50+  
**Critical Path Scenarios:** 3  
**Regression Tests:** 5

**Completion Status:**
- Phase 0-1: ☐ Complete
- Phase 2-3: ☐ Complete
- Phase 4-5: ☐ Complete
- Phase 6-7: ☐ Complete
- Phase 8-9: ☐ Complete
- Phase 10: ☐ Complete
- Regression: ☐ Complete

**Overall Result:** ☐ APPROVED ☐ NEEDS FIXES

**Sign-Off:**
- QA Lead: _________________ Date: _______
- Product Owner: _________________ Date: _______
- Tech Lead: _________________ Date: _______

---

## 🐛 Bug Template

**Bug ID:** _______  
**Severity:** ☐ Critical ☐ High ☐ Medium ☐ Low  
**Phase:** _______  
**Test Case:** _______  
**Description:** _______________________________________________  
**Steps to Reproduce:**
1. _______________
2. _______________
3. _______________

**Expected:** _______________  
**Actual:** _______________  
**Screenshots:** (attach)  
**Browser:** _______________  
**Device:** _______________  
**Reported By:** _______________ Date: _______

---

**Testing Status:** ☐ In Progress ☐ Complete ☐ Blocked

**Last Updated:** _________________
