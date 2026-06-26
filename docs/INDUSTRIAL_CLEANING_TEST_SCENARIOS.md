# Industrial Cleaning Module - Test Scenarios

> Created: 2026-06-22  
> Purpose: Manual testing guide for Industrial Cleaning enhanced demo data  
> Reference: `docs/INDUSTRIAL_CLEANING_DEMO_SCENARIOS.md`

## Overview

Document này cung cấp 15 test cases để verify toàn bộ business flows của Industrial Cleaning module từ booking → assignment → completion → payment → salary → accounting.

---

## Pre-requisites

1. Run enhanced seed script:
   ```bash
   node --env-file=.env.local scripts/seed-cleaning-demo-v2.mjs
   ```

2. Login credentials:
   - **Admin:** admin@cleanpro-v2.com
   - **Lead:** lead@cleanpro-v2.com
   - **Supervisor:** supervisor@cleanpro-v2.com
   - **Worker 1:** worker1@cleanpro-v2.com (Senior, Cleanroom certified)
   - **Worker 2:** worker2@cleanpro-v2.com (Senior, Medical certified)

3. Set passwords via Supabase Auth dashboard first

---

## Test Case 1: Verify Module Vocabulary Display

**Objective:** Verify UI displays "Nhân viên vệ sinh" và "Ca làm việc" instead of "KTV" và "Buổi"

**Steps:**
1. Login as admin@cleanpro-v2.com
2. Navigate to Dashboard → Staff Management
3. Navigate to Dashboard → Salary
4. Navigate to Dashboard → Bookings

**Expected Results:**
- Staff tab: Vai trò hiển thị "Nhân viên vệ sinh" (NOT "Kỹ thuật viên")
- Salary tab: Label "Ca làm việc" (NOT "Buổi")
- Booking modal: Dropdown "Chọn nhân viên vệ sinh..." (NOT "Chọn kỹ thuật viên...")

**Status:** ☐ Pass ☐ Fail

---

## Test Case 2: Verify Blue Theme for Industrial Cleaning

**Objective:** Verify blue theme (#1E40AF) distinct from Bella pink and Beauty jade green

**Steps:**
1. Login as admin
2. Inspect browser DevTools → Styles
3. Check sidebar, buttons, badges colors

**Expected Results:**
- Primary color: #1E40AF (dark blue)
- Accent color: #3B82F6 (bright blue)
- NOT pink (#EC4899) or jade green (#10B981)

**Status:** ☐ Pass ☐ Fail

---

## Test Case 3: Verify Package Isolation

**Objective:** Industrial Cleaning tenant CANNOT see Bella/Beauty packages

**Steps:**
1. Login as admin
2. Navigate to Dashboard → Bookings → New Booking
3. Open package dropdown

**Expected Results:**
- ONLY see 3 cleaning packages:
  - Vệ sinh cơ bản (Basic Cleaning)
  - Vệ sinh tiêu chuẩn (Standard Cleaning)
  - Vệ sinh cao cấp (Premium VIP Cleaning)
- Should NOT see: "Chăm sóc Mẹ & Bé", "Beauty Spa" packages

**Status:** ☐ Pass ☐ Fail

---

## Test Case 4: Daily Cleaning Workflow - Restaurant (Scenario 4)

**Objective:** Test high-frequency daily cleaning workflow

**Customer:** Nhà hàng The Deck Saigon (phone: 0904444001)  
**Package:** Vệ sinh cơ bản (Basic, multiplier 1.0)  
**Frequency:** Daily (30 sessions/month)

**Steps:**
1. Navigate to Dashboard → Bookings
2. Find booking WO-2026-00XX for "Nhà hàng The Deck Saigon"
3. Verify booking details:
   - Status: in_progress (March)
   - Completed sessions: ~19-20 (65% of 30)
   - Worker: worker2@cleanpro-v2.com (Food Safety certified)
4. Navigate to Sessions tab
5. Check session logs for this booking
6. Verify ratings: mix of 4.0-5.0 (mostly 4.5-5.0)

**Expected Results:**
- Daily frequency pattern visible
- Sessions spread evenly across January-March
- Worker assigned has Food Safety certification
- Notes mention "Kitchen deep clean", "grease removal", etc.

**Status:** ☐ Pass ☐ Fail

---

## Test Case 5: Manufacturing Plant Night Shift (Scenario 2)

**Objective:** Test night shift premium and cleanroom certification

**Customer:** Samsung Display Việt Nam (phone: 0902222001)  
**Package:** Vệ sinh cao cấp VIP (Premium, multiplier 2.0)  
**Frequency:** Daily night shift (11 PM - 7 AM)

**Steps:**
1. Find booking for Samsung Display
2. Verify:
   - Package: Premium VIP (session_multiplier = 2.0)
   - Status: in_progress (March)
   - Worker: worker1@cleanpro-v2.com (Cleanroom + ESD certified)
3. Check metadata:
   - shift: 'night'
   - special_requirements: 'Cleanroom protocol, ESD safety'
4. Navigate to Salary tab
5. Find worker1's salary record for March
6. Verify session count uses multiplier 2.0 (1 physical session = 2.0 counted sessions)

**Expected Results:**
- Worker has Cleanroom + ESD certifications
- Sessions marked as 'night' shift
- Salary calculation: base + (sessions × 2.0 × commission)
- Higher KTV commission (300k vs 200k for basic)

**Status:** ☐ Pass ☐ Fail

---

## Test Case 6: Hospital Medical Sanitation - 2 Shifts Per Day (Scenario 5)

**Objective:** Test multi-shift same-day sessions

**Customer:** Bệnh viện Đa khoa Sài Gòn (phone: 0905555001)  
**Package:** Vệ sinh tiêu chuẩn (Standard, multiplier 1.5)  
**Frequency:** 2x/day (Morning 6-8 AM, Evening 6-8 PM = 60 sessions/month)

**Steps:**
1. Find bookings for Sài Gòn Hospital
2. Check March booking:
   - Status: in_progress
   - Completed sessions: ~45 (75% of 60)
3. Navigate to Sessions
4. Verify: Some days have 2 sessions (morning + evening)
5. Check worker2's salary (Medical Sanitation certified)

**Expected Results:**
- Sessions metadata shows shift: 'morning' or 'evening'
- Worker has Medical Sanitation certification
- Session multiplier 1.5 applied to salary calculations
- Notes mention "Patient room sanitizing", "Medical waste disposal"

**Status:** ☐ Pass ☐ Fail

---

## Test Case 7: Warehouse Heavy Duty - Equipment Rental (Scenario 3)

**Objective:** Test low-frequency high-intensity jobs with large team

**Customer:** Ninja Van Warehouse (phone: 0903333001)  
**Package:** Vệ sinh tiêu chuẩn (Standard, multiplier 1.5)  
**Frequency:** 2x/month (bi-weekly, full-day 10-hour sessions)

**Steps:**
1. Find bookings for Ninja Van
2. Verify:
   - Frequency: 2x/month (only 2 sessions in Jan, 2 in Feb, 1 in Mar so far)
   - Duration: 10 hours per session (600 minutes)
   - Team size: 6 workers (metadata)
3. Navigate to Expenses
4. Find equipment rental expenses:
   - Floor scrubber machine
   - Scissor lift rental

**Expected Results:**
- Low session count (2 per month) but high intensity
- Metadata shows equipment_needed: 'Floor scrubber, scissor lift'
- Corresponding equipment rental expenses in Expenses tab
- Large area: 8000m²

**Status:** ☐ Pass ☐ Fail

---

## Test Case 8: Co-Working Space Variable Demand (Scenario 10)

**Objective:** Test on-demand flexible scheduling

**Customer:** WeWork Saigon Centre (phone: 0910101001)  
**Package:** Vệ sinh cơ bản (Basic, multiplier 1.0)  
**Frequency:** Variable (2-4x/week, changes monthly)

**Steps:**
1. Find bookings for WeWork
2. Verify:
   - Contract type: 'on-demand'
   - Session count varies month to month
   - Booking metadata: booking_type: 'On-demand via mobile app'
3. Check if bookings have different patterns (not fixed weekly)

**Expected Results:**
- No fixed schedule (not exactly 12/month like Office scenario)
- Metadata shows 'Variable' frequency
- Contract type: 'on-demand' (not 'monthly' or 'annual')

**Status:** ☐ Pass ☐ Fail

---

## Test Case 9: Data Center Precision Cleaning (Scenario 7)

**Objective:** Test monthly high-risk precision cleaning

**Customer:** Viettel IDC Data Center (phone: 0907777001)  
**Package:** Vệ sinh cao cấp VIP (Premium, multiplier 2.0)  
**Frequency:** 1x/month (maintenance window 2 AM - 6 AM)

**Steps:**
1. Find bookings for Viettel IDC
2. Verify:
   - Frequency: 1x/month (only 1 session per month)
   - Shift: night (2 AM - 6 AM)
   - Worker: worker1@cleanpro-v2.com (ESD certified)
3. Check metadata:
   - special_requirements: 'ESD certification, raised floor access, approval workflow'
4. Verify March booking status: 'booked' (not completed yet - scheduled late March)

**Expected Results:**
- Very low frequency (1/month)
- Highest complexity (Premium package, multiplier 2.0)
- Requires specialized certification (ESD)
- Notes mention "Raised floor vacuuming", "No water/liquids", "HEPA vacuum"

**Status:** ☐ Pass ☐ Fail

---

## Test Case 10: Salary Calculation Verification - Session Multipliers

**Objective:** Verify salary engine correctly applies session_multiplier

**Test Data:**
- **Worker 1** (Hoàng Văn Tú): Works on Samsung (multiplier 2.0) + Viettel IDC (multiplier 2.0)
- **Worker 2** (Nguyễn Thị Mai): Works on Hospital (multiplier 1.5) + Restaurant (multiplier 1.0)

**Steps:**
1. Navigate to Dashboard → Salary
2. Select month: March 2026
3. Find Worker 1's salary record:
   - Base salary: 8,000,000 VND
   - Completed sessions: Count physical sessions from Samsung + Viettel
   - Session bonus: (physical_sessions × 2.0) × 300,000 (Premium commission)
4. Find Worker 2's salary record:
   - Base salary: 7,500,000 VND
   - Mix of 1.5× (Hospital) and 1.0× (Restaurant) sessions
   - Session bonus: (hospital_sessions × 1.5 × 250k) + (restaurant_sessions × 1.0 × 200k)
5. Verify total_salary = base + session_bonus + kpi_bonus - violations

**Expected Results:**
- Worker 1: Higher session_bonus due to 2.0× multiplier
- Worker 2: Mixed session_bonus from different multipliers
- Salary reconciliation report shows "AI Tính" matches "Kế toán chốt"
- No major discrepancies (Lệch lớn = 0)

**Status:** ☐ Pass ☐ Fail

---

## Test Case 11: Mid-Month Hire Pro-Rata Salary

**Objective:** Verify pro-rata base salary for mid-month hires

**Test Data:**
- **Worker 10** (Lý Thị Hằng): Hire date 2026-01-15 (mid-January)
- **Worker 12** (Phan Thị Xuân): Hire date 2026-02-15 (mid-February)
- **Worker 14** (Đinh Thị Thu): Hire date 2026-03-10 (mid-March)

**Steps:**
1. Navigate to Dashboard → Salary
2. Select month: January 2026
3. Find Worker 10's salary:
   - Hire date: 2026-01-15 (worked ~16 days in Jan, assuming 26 working days)
   - Base salary: 6,500,000 VND (full month)
   - Pro-rata base: (6,500,000 / 26) × 16 = ~4,000,000 VND
4. Repeat for Worker 12 (Feb) and Worker 14 (Mar)

**Expected Results:**
- Base salary is pro-rated based on actual working days
- Formula: (monthly_base / 26) × actualDays
- NOT full base salary for mid-month hires

**Status:** ☐ Pass ☐ Fail

---

## Test Case 12: Revenue Recognition - Deposits and Final Payments

**Objective:** Verify revenue flow from deposit → partial → final payment

**Test Data:**
- **Booking WO-2026-0001** (TechViet Office, Jan, completed)

**Steps:**
1. Navigate to Dashboard → Finance → Revenue
2. Filter by customer: TechViet
3. Find revenue records:
   - Record 1: Deposit (30% of full price), received on start_date, status: 'confirmed'
   - Record 2: Final payment (70% remaining), received on month+1 day 5, status: 'confirmed'
4. Verify amounts:
   - Deposit + Final = Full booking price
5. Check accounting outbox:
   - Revenue records should appear in outbox for ERP posting

**Expected Results:**
- Deposit: 30% of full_price, status: confirmed
- Remaining: 70% of full_price, status: confirmed
- Total revenue = booking.full_price
- All confirmed revenue in accounting outbox

**Status:** ☐ Pass ☐ Fail

---

## Test Case 13: Late Payment Fees

**Objective:** Verify late payment fee calculation (NET60 vs NET30)

**Test Data:**
- Every 10th booking has late payment (i % 10 === 0)
- Late fee: 2% of full price

**Steps:**
1. Navigate to Dashboard → Finance → Revenue
2. Find revenue records with revenue_type = 'late_fee'
3. Verify:
   - Amount: 2% of booking full_price
   - Notes mention "NET60 instead of NET30"
   - Received date: 2 months after booking start (not 1 month)
4. Check total revenue includes late fees

**Expected Results:**
- Late fee records exist for ~10% of completed bookings
- Amount = booking.full_price × 0.02
- Payment delayed by extra month (NET60)

**Status:** ☐ Pass ☐ Fail

---

## Test Case 14: Operating Expenses - Realistic Categories

**Objective:** Verify diverse expense categories and realistic amounts

**Steps:**
1. Navigate to Dashboard → Finance → Expenses
2. Filter by date: January-March 2026
3. Verify expense categories exist:
   - **Supplies**: Hóa chất vệ sinh, dụng cụ (4-5M per month)
   - **Equipment**: Máy hút bụi, máy chà sàn (6-18M, one-time)
   - **Transport**: Thuê xe vận chuyển (3-3.5M per month)
   - **Rent**: Kho chứa thiết bị (9M per month, fixed)
   - **Utilities**: Điện nước (1.8-2.1M per month)
   - **Training**: Cleanroom, Medical Sanitation training (3-5M per course)
   - **Insurance**: Bảo hiểm lao động (12M for Q1)
   - **Marketing**: Quảng cáo, hội chợ (3.5-5M)
   - **Professional Services**: Tư vấn pháp lý (8M)
4. Verify total expenses: ~38 records

**Expected Results:**
- All expense categories populated with realistic amounts
- Fixed monthly costs: Rent (9M), Transport (~3M), Utilities (~2M)
- Variable costs: Supplies, Equipment, Training
- One-time costs: Equipment purchases, Insurance (quarterly)
- Total matches business scale

**Status:** ☐ Pass ☐ Fail

---

## Test Case 15: P&L Report - Industrial Cleaning Module

**Objective:** Verify Profit & Loss calculation includes all revenue and expenses

**Steps:**
1. Navigate to Dashboard → Finance → Reports → P&L
2. Select period: Q1 2026 (Jan-Mar)
3. Verify P&L components:
   - **Total Revenue**: Sum of all confirmed revenue (deposits + payments + late fees)
   - **Operating Expenses**: Sum of approved expenses (supplies, rent, utilities, etc.)
   - **Salary Fund (Quỹ Lương KTV)**: 
     - Use saved salary_records.total_salary if record exists
     - Use pro-rata base_salary if no saved record yet
   - **Gross Profit**: Revenue - Operating Expenses - Salary Fund
   - **Net Profit**: Gross Profit - other deductions
4. Cross-check:
   - Only 'confirmed' revenue counted
   - Only 'approved' or 'paid' expenses counted
   - Salary fund respects saved records (no dynamic recalculation if status != draft)

**Expected Results:**
- P&L shows positive profit (demo data is profitable)
- Revenue > (Operating Expenses + Salary Fund)
- All calculations follow AGENTS.md rules:
  - Strict status filters (approved/paid expenses, confirmed revenue)
  - Saved salary records used as ground truth
  - Pro-rata for unsaved records only

**Status:** ☐ Pass ☐ Fail

---

## Summary Checklist

**Module Isolation & UI:**
- ☐ Test Case 1: Vocabulary display
- ☐ Test Case 2: Blue theme
- ☐ Test Case 3: Package isolation

**Business Workflows:**
- ☐ Test Case 4: Daily restaurant cleaning
- ☐ Test Case 5: Manufacturing night shift
- ☐ Test Case 6: Hospital 2-shift per day
- ☐ Test Case 7: Warehouse equipment rental
- ☐ Test Case 8: Co-working variable demand
- ☐ Test Case 9: Data center precision cleaning

**Payroll & Salary:**
- ☐ Test Case 10: Session multipliers
- ☐ Test Case 11: Mid-month hire pro-rata

**Accounting & Finance:**
- ☐ Test Case 12: Revenue recognition flow
- ☐ Test Case 13: Late payment fees
- ☐ Test Case 14: Operating expenses
- ☐ Test Case 15: P&L report

---

## Cleanup After Testing

To remove demo tenant and all data:

```bash
# Dry run first (see what will be deleted)
node --env-file=.env.local scripts/cleanup-cleaning-demo-v2.mjs

# Actually delete
node --env-file=.env.local scripts/cleanup-cleaning-demo-v2.mjs --confirm
```

---

## Test Results Template

**Date Tested:** _______________  
**Tester Name:** _______________  
**Environment:** Production / Staging / Dev  

**Pass Rate:** ___ / 15 (___%)

**Failures:** (List test case numbers and issues)
- Test Case #___: _______________________________
- Test Case #___: _______________________________

**Severity:** ☐ Critical ☐ Major ☐ Minor ☐ Cosmetic

**Notes:**
_________________________________________________
_________________________________________________
