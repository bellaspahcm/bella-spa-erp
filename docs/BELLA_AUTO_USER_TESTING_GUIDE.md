# Bella Auto - User Testing Guide

**Version:** 1.0.0  
**Date:** August 3, 2026  
**Target Audience:** QA Team, Business Analysts, End Users  
**Test Environment:** Demo tenant `bella_auto_demo`

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Test Environment Setup](#test-environment-setup)
3. [Test Scenarios by Phase](#test-scenarios-by-phase)
4. [User Personas](#user-personas)
5. [Test Data](#test-data)
6. [Expected Results](#expected-results)
7. [Bug Reporting](#bug-reporting)
8. [Acceptance Criteria](#acceptance-criteria)

---

## Overview

### Testing Objectives

1. ✅ Verify all 11 phases work as designed
2. ✅ Validate zero regression on existing modules
3. ✅ Test user workflows end-to-end
4. ✅ Verify mobile/offline functionality
5. ✅ Validate data integrity and RLS
6. ✅ Test performance under load

### Testing Scope

**In Scope:**
- ✅ All 33 database tables
- ✅ All 40 service classes
- ✅ 22-stage customer journey
- ✅ Mobile workforce features
- ✅ AI/Analytics features
- ✅ Integration with core modules

**Out of Scope:**
- ❌ Third-party integrations (Phase 14)
- ❌ ML model training (Phase 12)
- ❌ Production data migration
- ❌ Performance stress testing (separate phase)

### Testing Timeline

| Week | Focus | Activities |
|------|-------|------------|
| Week 1 | Core Features | Phases 0-4 testing |
| Week 2 | Advanced Features | Phases 5-7 testing |
| Week 3 | Finance & AI | Phases 8-9 testing |
| Week 4 | Mobile & Integration | Phase 10 + end-to-end |

---

## Test Environment Setup

### Prerequisites

1. **Supabase Access**
   - URL: `https://your-project.supabase.co`
   - API Key: From `.env.local`
   - Role: `authenticated` with `bella_auto_demo` tenant

2. **Test User Accounts**
   ```
   Admin: admin@bella-auto-demo.com / password
   Sales: sales@bella-auto-demo.com / password
   Service Advisor: service@bella-auto-demo.com / password
   Technician: tech@bella-auto-demo.com / password
   Manager: manager@bella-auto-demo.com / password
   ```

3. **Browser Setup**
   - Chrome/Edge (latest version)
   - Firefox (latest version)
   - Safari (latest version for Mac/iOS)
   - Mobile browsers (iOS Safari, Chrome Mobile)

4. **Network Conditions**
   - Fast 3G (for mobile testing)
   - Offline mode (for PWA testing)
   - Normal connection (for desktop testing)

### Environment Verification

**Step 1: Verify Database Access**
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM auto_vehicles WHERE tenant_id = 'bella_auto_demo';
-- Expected: 0 or more records (no error)
```

**Step 2: Verify RLS Isolation**
```sql
-- Try to access another tenant's data (should fail)
SELECT COUNT(*) FROM auto_vehicles WHERE tenant_id = 'beauty_spa';
-- Expected: Error or 0 records (RLS blocking)
```

**Step 3: Verify User Roles**
```sql
-- Check your user role
SELECT auth.uid(), auth.email();
-- Expected: Your test user details
```

---

## Test Scenarios by Phase

### Phase 0 - Foundation & Module Isolation

#### Test Case 0.1: Module Registration
**Objective:** Verify Bella Auto module is registered and isolated

**Steps:**
1. Login as admin@bella-auto-demo.com
2. Navigate to dashboard
3. Verify `/bella-auto` route is accessible
4. Verify module menu appears
5. Verify tenant_id is `bella_auto_demo`

**Expected Results:**
- ✅ Bella Auto dashboard loads
- ✅ No errors in console
- ✅ Other modules (Spa, Real Estate) not visible
- ✅ CSS scoped to `html[data-tenant-module="bella_auto"]`

**Pass/Fail:** ___________

---

#### Test Case 0.2: RLS Isolation
**Objective:** Verify tenant isolation works correctly

**Steps:**
1. Login as admin@bella-auto-demo.com
2. Open browser DevTools → Network tab
3. Try to query: `SELECT * FROM auto_vehicles WHERE tenant_id = 'beauty_spa'`
4. Verify no data returns

**Expected Results:**
- ✅ No cross-tenant data visible
- ✅ RLS policy blocks query
- ✅ Error or empty result set

**Pass/Fail:** ___________

---

### Phase 1 - VIN Management & Inventory

#### Test Case 1.1: Create Vehicle
**Objective:** Create a new vehicle record

**Steps:**
1. Navigate to Vehicles → Add New
2. Enter vehicle details:
   - VIN: `1HGCM82633A123456`
   - Make: `Honda`
   - Model: `Accord`
   - Year: `2023`
   - Color: `Pearl White`
   - Purchase Price: `800,000,000 VND`
3. Click Save

**Expected Results:**
- ✅ Vehicle created successfully
- ✅ VIN is unique (no duplicates)
- ✅ Status set to `in_transit` by default
- ✅ Vehicle appears in inventory list

**Pass/Fail:** ___________

---

#### Test Case 1.2: Vehicle State Machine
**Objective:** Test vehicle status transitions

**Steps:**
1. Select the vehicle created in 1.1
2. Transition: `in_transit` → `warehouse`
3. Transition: `warehouse` → `showroom`
4. Transition: `showroom` → `allocated`
5. Try invalid transition: `allocated` → `in_transit` (should fail)

**Expected Results:**
- ✅ Valid transitions succeed
- ✅ Invalid transitions blocked
- ✅ Status history recorded
- ✅ Audit trail shows who/when

**Pass/Fail:** ___________

---

#### Test Case 1.3: Bulk Import
**Objective:** Import vehicles from Excel/CSV

**Test Data:** Create CSV file `vehicles.csv`:
```csv
vin,make,model,year,color,purchase_price
1HGCM82633A111111,Honda,Accord,2023,White,800000000
1HGCM82633A222222,Honda,CR-V,2023,Black,950000000
1HGCM82633A333333,Toyota,Camry,2023,Silver,850000000
```

**Steps:**
1. Navigate to Vehicles → Import
2. Upload `vehicles.csv`
3. Review preview
4. Confirm import

**Expected Results:**
- ✅ 3 vehicles imported
- ✅ No duplicate VINs
- ✅ All fields mapped correctly
- ✅ Import summary displayed

**Pass/Fail:** ___________

---

### Phase 2 - Customer 360 Extension

#### Test Case 2.1: Link Vehicle to Customer
**Objective:** Associate vehicle with customer

**Steps:**
1. Create or select existing customer
2. Navigate to Customer → Automotive Tab
3. Link vehicle by VIN
4. Verify ownership history

**Expected Results:**
- ✅ Vehicle linked to customer
- ✅ Ownership start date recorded
- ✅ Customer profile shows vehicle
- ✅ Vehicle shows owner info

**Pass/Fail:** ___________

---

### Phase 3 - Customer Journey (22 Stages)

#### Test Case 3.1: Initialize Journey
**Objective:** Start customer journey from lead

**Steps:**
1. Create new lead via Lead Capture form
2. Assign to sales rep
3. Verify journey initialized at `awareness` stage
4. Check SLA timer started

**Expected Results:**
- ✅ Journey record created
- ✅ Current stage = `awareness`
- ✅ SLA status = `on_time`
- ✅ Assigned sales rep notified

**Pass/Fail:** ___________

---

#### Test Case 3.2: Journey Stage Transitions
**Objective:** Test full journey flow

**Steps:**
1. Start at `awareness` stage
2. Advance through stages:
   - `awareness` → `consideration`
   - `consideration` → `first_contact`
   - `first_contact` → `showroom_visit`
   - `showroom_visit` → `test_drive`
   - `test_drive` → `quotation`
   - `quotation` → `deposit`
   - Continue to `vehicle_delivered`

**Expected Results:**
- ✅ All transitions succeed
- ✅ Stage history recorded
- ✅ Timestamps accurate
- ✅ Funnel analytics update

**Pass/Fail:** ___________

---

#### Test Case 3.3: SLA Monitoring
**Objective:** Test SLA breach detection

**Steps:**
1. Create journey with short SLA (for testing)
2. Wait for SLA to expire
3. Check SLA status changes to `at_risk`
4. Continue waiting
5. Verify status changes to `breached`
6. Check manager notification sent

**Expected Results:**
- ✅ SLA countdown visible
- ✅ `at_risk` alert at 80% of SLA
- ✅ `breached` status after 100%
- ✅ Manager email sent
- ✅ Dashboard shows breached journeys

**Pass/Fail:** ___________

---

#### Test Case 3.4: Journey Analytics
**Objective:** Verify funnel and heatmap reports

**Steps:**
1. Navigate to Analytics → Journey Funnel
2. View conversion rates per stage
3. Navigate to Analytics → Journey Heatmap
4. View average time per stage
5. Identify bottlenecks

**Expected Results:**
- ✅ Funnel chart displays correctly
- ✅ Conversion % calculated
- ✅ Heatmap shows time distribution
- ✅ Bottleneck stages highlighted
- ✅ Export to CSV works

**Pass/Fail:** ___________

---

### Phase 4 - Lead & Sales Center

#### Test Case 4.1: Lead Capture from Ads
**Objective:** Capture lead from Facebook/Google ads

**Steps:**
1. Navigate to Leads → Capture
2. Fill form with lead details:
   - Name: `Nguyen Van A`
   - Phone: `0912345678`
   - Email: `nguyenvana@example.com`
   - Source: `facebook_ads`
   - Interested Vehicle: `Honda Accord 2023`
3. Submit form

**Expected Results:**
- ✅ Lead created with unique ID
- ✅ Auto-assigned to sales rep (Round Robin)
- ✅ Journey initialized at `awareness`
- ✅ Sales rep receives notification
- ✅ Lead score calculated

**Pass/Fail:** ___________

---

#### Test Case 4.2: Lead Rotation (Smart Allocation)
**Objective:** Test smart lead assignment

**Test Data:**
- Sales A: 5 leads, 80% conversion
- Sales B: 3 leads, 60% conversion
- Sales C: 8 leads, 70% conversion

**Steps:**
1. Create 3 new leads consecutively
2. Check assignment algorithm
3. Verify Sales B gets priority (lowest load + decent conversion)

**Expected Results:**
- ✅ Smart allocation considers load + performance
- ✅ Fair distribution over time
- ✅ Manual override available
- ✅ Assignment history tracked

**Pass/Fail:** ___________

---

#### Test Case 4.3: Test Drive Scheduling
**Objective:** Schedule test drive appointment

**Steps:**
1. Navigate to lead/customer
2. Click "Schedule Test Drive"
3. Select:
   - Vehicle: `Honda Accord 2023`
   - Date: `2026-08-15`
   - Time: `10:00 AM`
   - Sales Rep: Auto-assigned
4. Confirm booking

**Expected Results:**
- ✅ Appointment created
- ✅ Calendar shows booking
- ✅ Customer receives SMS reminder
- ✅ Journey advances to `test_drive` stage
- ✅ Test drive form available

**Pass/Fail:** ___________

---

#### Test Case 4.4: Quotation Creation
**Objective:** Create quotation with approval workflow

**Steps:**
