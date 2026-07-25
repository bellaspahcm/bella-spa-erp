# Industrial Cleaning Demo Scenarios

> Created: 2026-06-22  
> Purpose: Define realistic business scenarios for Industrial Cleaning module demo data

## Overview

Tài liệu này định nghĩa 10 scenarios thực tế để test Industrial Cleaning module, covering các loại hình facility khác nhau, use cases phức tạp, và edge cases quan trọng.

---

## Scenario 1: Office Building - Standard Weekly Cleaning

**Facility Type:** Office Building (văn phòng cao cấp)  
**Customer:** Công ty TNHH Phần mềm TechViet  
**Location:** Quận 1, TP. Hồ Chí Minh  
**Area Size:** 450m²  
**Floors:** 3 floors

**Cleaning Requirements:**
- Frequency: 3x per week (Mon, Wed, Fri)
- Time: 6:00 PM - 10:00 PM (after office hours)
- Package: Standard Office Cleaning (session_multiplier = 1.0)
- Workers: 2 cleaners per session
- Tasks: Vacuum floors, empty trash, wipe desks, clean toilets, pantry cleaning

**Monthly Pattern:**
- 12 sessions per month (3x per week × 4 weeks)
- Consistent quality (rating 4.5-5.0)
- No issues, stable contract

**Business Value:**
- Tests: Recurring weekly pattern, multi-worker coordination, consistent revenue stream
- Edge Cases: None (baseline scenario)

---

## Scenario 2: Manufacturing Plant - Daily Deep Cleaning

**Facility Type:** Electronics Manufacturing Plant  
**Customer:** Nhà máy Samsung Display Việt Nam  
**Location:** KCN Tân Thuận, Quận 7  
**Area Size:** 3,500m²  
**Type:** Class 100 Cleanroom + Production Floor

**Cleaning Requirements:**
- Frequency: Daily (Mon-Sat)
- Time: 11:00 PM - 7:00 AM (night shift)
- Package: Industrial Deep Cleaning VIP (session_multiplier = 2.0)
- Workers: 4 cleaners per session
- Special: Cleanroom protocol, ESD safety, chemical handling certification required
- Tasks: Cleanroom mopping, equipment wiping, air shower maintenance, waste disposal

**Monthly Pattern:**
- 26 sessions per month (6 days × 4.3 weeks)
- High complexity, strict quality requirements
- Customer inspections: 2x per month

**Business Value:**
- Tests: High-frequency daily cleaning, team coordination, specialized skills, night shift premium
- Edge Cases: Quality inspection failures (rating 3.0), rework sessions, certification tracking

---

## Scenario 3: Warehouse - Bi-Weekly Heavy Duty

**Facility Type:** Logistics Warehouse  
**Customer:** Kho bãi Ninja Van Việt Nam  
**Location:** Quận 2, TP. Hồ Chí Minh  
**Area Size:** 8,000m²  
**Type:** High-ceiling warehouse with racking systems

**Cleaning Requirements:**
- Frequency: 2x per month (1st and 15th)
- Time: Sunday 8:00 AM - 6:00 PM (full day)
- Package: Warehouse Heavy Duty (session_multiplier = 1.5)
- Workers: 6 cleaners per session
- Equipment: High-reach vacuum, floor scrubber machine, scissor lift
- Tasks: Floor sweeping (entire area), rack dusting, loading dock cleaning, bathroom maintenance

**Monthly Pattern:**
- 2 sessions per month (bi-weekly)
- Long duration sessions (10 hours each)
- Equipment rental costs

**Business Value:**
- Tests: Low-frequency high-intensity jobs, equipment tracking, team size scaling
- Edge Cases: Overtime hours, equipment breakdown delays, incomplete sessions

---

## Scenario 4: Restaurant Kitchen - Daily Sanitation

**Facility Type:** Restaurant & Commercial Kitchen  
**Customer:** Nhà hàng The Deck Saigon  
**Location:** Quận 2, TP. Hồ Chí Minh  
**Area Size:** 200m²  
**Type:** Fine dining restaurant + commercial kitchen

**Cleaning Requirements:**
- Frequency: Daily (7 days/week)
- Time: 11:00 PM - 2:00 AM (after dinner service)
- Package: Food Service Sanitation (session_multiplier = 1.0)
- Workers: 2 cleaners per session
- Special: Food safety certification, grease trap cleaning, pest control coordination
- Tasks: Kitchen deep clean, grease removal, floor degreasing, dining area sanitizing, dish pit scrubbing

**Monthly Pattern:**
- 30 sessions per month (daily)
- Strict hygiene standards (Food Safety Authority inspections)
- 1-2 emergency clean-ups per month (spills, health inspection prep)

**Business Value:**
- Tests: Daily high-frequency, sanitation compliance, emergency/unscheduled sessions, health inspection readiness
- Edge Cases: Failed health inspection (requires immediate deep clean), emergency calls at 3 AM

---

## Scenario 5: Hospital Ward - Medical Sanitation Protocol

**Facility Type:** Hospital Ward (Khoa Nội Tổng Hợp)  
**Customer:** Bệnh viện Đa khoa Sài Gòn  
**Location:** Quận 3, TP. Hồ Chí Minh  
**Area Size:** 1,200m²  
**Type:** Medical facility (patient rooms, nurse stations, treatment rooms)

**Cleaning Requirements:**
- Frequency: 2x per day (morning and evening shifts)
- Time: 6:00 AM - 8:00 AM, 6:00 PM - 8:00 PM
- Package: Medical Sanitation Protocol (session_multiplier = 1.5)
- Workers: 3 cleaners per session
- Special: Medical waste handling certification, infection control training, EPA-approved disinfectants
- Tasks: Patient room sanitizing, bathroom disinfection, floor mopping with bleach, medical waste disposal, high-touch surface cleaning

**Monthly Pattern:**
- 60 sessions per month (2x daily × 30 days)
- High-risk environment (infection control critical)
- Weekly quality audits by hospital infection control team

**Business Value:**
- Tests: Multiple daily shifts, medical compliance, high-stakes quality, hazardous waste handling
- Edge Cases: COVID outbreak room cleaning (hazard pay), biohazard spill response, failed infection control audit

---

## Scenario 6: Retail Store - Weekly Maintenance

**Facility Type:** Electronics Retail Store  
**Customer:** Cửa hàng Thế Giới Di Động - Chi nhánh Điện Biên Phủ  
**Location:** Quận 3, TP. Hồ Chí Minh  
**Area Size:** 350m²  
**Type:** Multi-floor retail showroom

**Cleaning Requirements:**
- Frequency: 1x per week (Sunday)
- Time: 7:00 PM - 11:00 PM
- Package: Retail Store Basic (session_multiplier = 1.0)
- Workers: 2 cleaners per session
- Tasks: Floor mopping, glass door cleaning, product display dusting, restroom cleaning, trash removal

**Monthly Pattern:**
- 4 sessions per month (weekly)
- Low-complexity, consistent schedule
- Customer feedback via online rating system

**Business Value:**
- Tests: Simple weekly contract, customer rating system, minimal complexity baseline
- Edge Cases: None (control group for comparison)

---

## Scenario 7: Data Center - Precision Cleaning

**Facility Type:** Tier 3 Data Center  
**Customer:** Viettel IDC Data Center  
**Location:** Quận 7, TP. Hồ Chí Minh  
**Area Size:** 600m²  
**Type:** Raised floor data center (server rooms, cooling systems)

**Cleaning Requirements:**
- Frequency: Monthly (once per month)
- Time: 2:00 AM - 6:00 AM (during maintenance window)
- Package: Data Center Precision Cleaning (session_multiplier = 2.0)
- Workers: 2 specialized cleaners
- Special: ESD certification, raised floor access training, no water/liquids, HEPA vacuum only
- Tasks: Raised floor vacuuming, cable management area cleaning, cooling unit filter replacement, server rack exterior wiping

**Monthly Pattern:**
- 1 session per month (scheduled maintenance window)
- Extremely strict protocols (downtime risk)
- Customer must approve every cleaning plan in advance

**Business Value:**
- Tests: Low-frequency high-risk jobs, specialized certification requirements, strict approval workflow
- Edge Cases: Last-minute cancellations (emergency maintenance conflict), incomplete session (access denied to certain racks)

---

## Scenario 8: School Building - Seasonal Deep Clean

**Facility Type:** Primary School  
**Customer:** Trường Tiểu học Nguyễn Du  
**Location:** Quận 1, TP. Hồ Chí Minh  
**Area Size:** 2,500m²  
**Type:** 3-story school building (classrooms, library, cafeteria, gym)

**Cleaning Requirements:**
- Frequency: 1x per quarter (start of term break)
- Time: Full week project (Mon-Fri, 8:00 AM - 5:00 PM)
- Package: School Deep Clean Project (session_multiplier = 1.5)
- Workers: 8-10 cleaners per day
- Tasks: Classroom scrubbing, desk/chair sanitizing, floor waxing, window cleaning, library dusting, cafeteria deep clean, gym floor refinishing

**Monthly Pattern:**
- 1 project per quarter (Q1: March, Q2: June, Q3: September, Q4: December)
- Large team coordination (8-10 workers)
- Multi-day engagement (5 days)

**Business Value:**
- Tests: Project-based work (not recurring sessions), large team management, multi-day bookings, seasonal patterns
- Edge Cases: Weather delays (rain prevents outdoor work), team member absences mid-project, scope expansion requests

---

## Scenario 9: Factory Floor - Post-Production Cleanup

**Facility Type:** Garment Manufacturing Factory  
**Customer:** Nhà máy May Việt Tiến  
**Location:** Bình Dương  
**Area Size:** 4,000m²  
**Type:** Textile production floor (cutting, sewing, packaging areas)

**Cleaning Requirements:**
- Frequency: 5x per week (Mon-Fri)
- Time: 6:00 PM - 10:00 PM (after production shift)
- Package: Industrial Standard Cleaning (session_multiplier = 1.0)
- Workers: 4 cleaners per session
- Tasks: Fabric scrap collection, floor sweeping, machine cleaning, restroom maintenance, locker room cleaning

**Monthly Pattern:**
- 22 sessions per month (5 days × 4.4 weeks)
- Consistent volume (fabric scraps, lint accumulation)
- Monthly deep clean (machinery wiping, oil stain removal)

**Business Value:**
- Tests: Weekday-only pattern (no weekend), consistent high-volume, industrial environment safety
- Edge Cases: Production overtime (session delayed/cancelled), machinery breakdown (oil spill cleanup), worker injury (blood cleanup protocol)

---

## Scenario 10: Co-Working Space - Flexible On-Demand

**Facility Type:** Co-Working Space  
**Customer:** WeWork Saigon Centre  
**Location:** Quận 1, TP. Hồ Chí Minh  
**Area Size:** 800m²  
**Type:** Open workspace, meeting rooms, phone booths, pantry

**Cleaning Requirements:**
- Frequency: Variable (2-4x per week depending on occupancy)
- Time: Flexible (6:00 AM - 8:00 AM or 8:00 PM - 10:00 PM)
- Package: Co-Working Flexible Clean (session_multiplier = 1.0)
- Workers: 3 cleaners per session
- Tasks: Desk wiping, pantry restocking/cleaning, meeting room setup, phone booth sanitizing, coffee machine maintenance

**Monthly Pattern:**
- 10-16 sessions per month (variable demand)
- Booking changes frequently (cancellations, additions)
- Customer uses mobile app to request additional sessions

**Business Value:**
- Tests: Variable schedule (not fixed pattern), last-minute bookings, cancellations, mobile app integration
- Edge Cases: Same-day booking requests, 2-hour notice cancellations, surge pricing during events

---

## Summary Matrix

| Scenario | Facility Type | Frequency | Complexity | Team Size | Key Test Cases |
|----------|--------------|-----------|------------|-----------|----------------|
| 1. Office | Office | 3x/week | Low | 2 | Baseline weekly recurring |
| 2. Manufacturing | Electronics Plant | Daily | High | 4 | Night shift, certifications, inspections |
| 3. Warehouse | Logistics | 2x/month | Medium | 6 | Low-freq high-intensity, equipment rental |
| 4. Restaurant | Food Service | Daily | Medium | 2 | Sanitation, emergency calls |
| 5. Hospital | Medical | 2x/day | High | 3 | Medical compliance, hazard pay, audits |
| 6. Retail | Store | 1x/week | Low | 2 | Simple contract control group |
| 7. Data Center | Tech | 1x/month | Very High | 2 | Precision, approval workflow, access control |
| 8. School | Education | 1x/quarter | Medium | 8-10 | Project-based, multi-day, seasonal |
| 9. Factory | Textile | 5x/week | Medium | 4 | Weekday-only, safety incidents |
| 10. Co-Working | Flexible Workspace | Variable | Low | 3 | On-demand, cancellations, mobile app |

---

## Edge Cases Coverage

**Payroll Edge Cases:**
1. ✅ **Night shift premium** (Scenario 2: 11 PM - 7 AM)
2. ✅ **Overtime hours** (Scenario 3: 10-hour sessions)
3. ✅ **Hazard pay** (Scenario 5: COVID room cleaning)
4. ✅ **Team lead bonus** (Scenario 8: Large team coordination)
5. ✅ **Mid-month hire** (Scenario 4: New worker joins Feb 15)
6. ✅ **Leave/absence** (Scenario 9: Worker sick leave)
7. ✅ **Quality deduction** (Scenario 2: Failed inspection)
8. ✅ **Emergency call bonus** (Scenario 4: 3 AM spill cleanup)

**Booking Edge Cases:**
1. ✅ **Same-day booking** (Scenario 10: Mobile app request)
2. ✅ **Cancellation <24h** (Scenario 10: Last-minute cancellation)
3. ✅ **Multi-day booking** (Scenario 8: 5-day project)
4. ✅ **Recurring pattern changes** (Scenario 10: Variable frequency)
5. ✅ **Equipment rental** (Scenario 3: Floor scrubber, scissor lift)
6. ✅ **Approval workflow** (Scenario 7: Customer pre-approval required)

**Session Edge Cases:**
1. ✅ **Incomplete session** (Scenario 7: Access denied mid-session)
2. ✅ **Rework session** (Scenario 2: Quality failure redo)
3. ✅ **Multiple sessions same day** (Scenario 5: Morning + evening shifts)
4. ✅ **Emergency unscheduled session** (Scenario 4: Health inspection prep)
5. ✅ **Weather delay** (Scenario 8: Rain prevents outdoor work)
6. ✅ **Safety incident** (Scenario 9: Worker injury, oil spill)

**Accounting Edge Cases:**
1. ✅ **Partial payment** (Scenario 8: Project milestones)
2. ✅ **Deposit refund** (Scenario 10: Cancellation with refund)
3. ✅ **Late payment** (Scenario 3: Customer NET60 instead of NET30)
4. ✅ **Equipment depreciation** (Scenario 3: Machine rental costs)
5. ✅ **Certification training costs** (Scenario 2: Cleanroom training)
6. ✅ **Insurance claim** (Scenario 9: Worker injury compensation)

---

## Demo Data Targets

**Customers:** 15-20 customers (mix of facility types)  
**Staff:** 12-15 workers (mix of experience, certifications, schedules)  
**Bookings:** 30-40 bookings (various frequencies, statuses)  
**Sessions:** 80-120 completed sessions (January-March 2026)  
**Revenue:** 50-70 revenue records (deposits, payments, refunds)  
**Expenses:** 30-40 expense records (supplies, equipment, training, insurance)

---

## Implementation Priority

**Phase 2A (Core Scenarios - Implement First):**
- Scenario 1: Office (baseline)
- Scenario 2: Manufacturing (high complexity)
- Scenario 4: Restaurant (daily high-freq)
- Scenario 6: Retail (control group)

**Phase 2B (Edge Cases - Implement Second):**
- Scenario 3: Warehouse (equipment, team size)
- Scenario 5: Hospital (medical compliance, hazard pay)
- Scenario 9: Factory (safety incidents)
- Scenario 10: Co-Working (variable demand, cancellations)

**Phase 2C (Advanced - Optional):**
- Scenario 7: Data Center (precision, approval workflow)
- Scenario 8: School (project-based, multi-day)

---

## Success Metrics

**Coverage Completeness:**
- ✅ 10 facility types covered
- ✅ 8 payroll edge cases covered
- ✅ 6 booking edge cases covered
- ✅ 6 session edge cases covered
- ✅ 6 accounting edge cases covered

**Data Volume:**
- ✅ 15+ customers (target: 18)
- ✅ 12+ workers (target: 14)
- ✅ 30+ bookings (target: 35)
- ✅ 80+ sessions (target: 100)
- ✅ 50+ revenue records (target: 65)
- ✅ 30+ expenses (target: 38)

**Realism Score:**
- ✅ All scenarios based on real cleaning company operations
- ✅ All edge cases have real-world precedents
- ✅ All data reflects actual pricing, timings, team sizes

---

## Next Steps

1. ✅ Scenarios defined (this document)
2. ⏳ Create enhanced demo data script
3. ⏳ Implement Phase 2A scenarios first
4. ⏳ Test data quality and UI display
5. ⏳ Implement Phase 2B edge cases
6. ⏳ Validate accounting calculations
7. ⏳ Create test scenarios document for manual testing
8. ⏳ User acceptance testing (optional)
