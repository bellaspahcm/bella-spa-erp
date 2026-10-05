# ARCHITECTURE GATE RESULT — CRM Customer 360 UI Redesign
Date: 2026-10-05
Scope: `src/app/dashboard/customers/[id]/` — Presentation layer only
**STATUS: PASS**

## 1. Problem / Non-Goals

**Building:** Customer 360 detail page redesign following reference design (hình 5)
**For:** Spa staff using the CRM daily
**Solving:** Vertical scroll overload, poor information hierarchy, lack of Customer Intelligence summary
**First-version workflow:** Staff opens customer → sees 360 summary → selects booking context → manages appointments → views AI KTV recommendation → reviews session history (accordion) → checks payment

**NOT doing:**
- No new DB columns, no schema change
- No new API endpoints or server actions
- No new domain model
- No changes to `useCustomerDetailController.ts` business logic
- No changes to modal logic in `CustomerDetailModals.tsx`
- No AI recommendation engine (mock display only, data comes from existing `ktvs` prop)

## 2. Change Authority

Request: **UI redesign of Customer Detail page** → authorized to change **presentation layer only**:
- `src/app/dashboard/customers/[id]/page.tsx`
- `src/app/dashboard/customers/[id]/components/CustomerProfilePanel.tsx`
- `src/app/dashboard/customers/[id]/components/CustomerStatsPanel.tsx`
- `src/app/dashboard/customers/[id]/components/BookingSelectorPanel.tsx`
- `src/app/dashboard/customers/[id]/components/ActiveBookingPanel.tsx`
- `src/app/dashboard/customers/[id]/components/SessionHistoryPanel.tsx`
- `src/app/dashboard/customers/[id]/components/PaymentHistoryPanel.tsx`

NOT authorized: controller logic, server actions, DB, domain model, test files.

## 3. UI → Contract Reconciliation

| UI Element | Canonical Contract | Conclusion |
|---|---|---|
| Customer name, phone, gender, address, notes | `customer.name_mother`, `customer.phone`, `customer.gender_baby`, `customer.address`, `customer.notes` | MATCH |
| Status badge "Đang sử dụng dịch vụ" | Derived from `customer.allBookings` having active/in_progress bookings | MATCH |
| VIP badge | `customer.loyalty_points` threshold display | MATCH |
| Loyalty points (38 điểm) | `customer.loyalty_points` | MATCH |
| Tổng chi tiêu KPI | Sum of `booking.revenue` amounts across all bookings | MATCH (derived) |
| Tổng lượt điểm (lần đến) | Count of completed session_logs across all bookings | MATCH (derived) |
| Gói đang hoạt động count | `customer.allBookings.filter(active/in_progress)` | MATCH |
| Lần gần nhất | Latest `session_logs.check_in_at` across all bookings | MATCH (derived) |
| Lịch hẹn tiếp theo | `nextSession` from controller | MATCH |
| Service package cards in selector | `customer.allBookings` | MATCH |
| Progress 3/12 | `activeBooking.completed_sessions / activeBooking.total_sessions` | MATCH |
| Giá gốc / Đã thanh toán / Còn lại | `calculateBookingPaymentState(activeBooking)` | MATCH |
| KTV dropdown | `ktvs` prop + `activeBooking.assigned_ktv` | MATCH |
| AI KTV score display (100, 80.5, 72) | **Mock display** — no backend AI scoring. Skill score = skill fit approximation from `ktvs` list | DEFER (display mock, no new API) |
| Session history accordion | `sortedSessions` from controller | MATCH |
| Next session card | `nextSession` from controller | MATCH |
| Payment history | `activeBooking.revenue` | MATCH |
| "Ghi chú & hoạt động" (activity feed) | `customer.notes` + no activity feed table | DEFER (show notes only, no audit log feed in this scope) |
| Hình ảnh trước/sau | No `before_after_images` field in current schema | DEFER (placeholder only) |
| Tab navigation (Tổng quan, Dịch vụ, etc.) | All data available via existing props — tabs are presentation grouping | MATCH |

## 4. Minimal Implementation Plan

1. Redesign `page.tsx` — new layout with sticky customer header, tab navigation
2. Redesign `CustomerProfilePanel` — compact header with Customer Intelligence KPIs
3. Redesign `CustomerStatsPanel` — repurpose as Customer 360 Intelligence bar (6 KPIs)
4. Redesign `BookingSelectorPanel` — service package cards with status badges + progress
5. Redesign `ActiveBookingPanel` — navy card with primary CTA hierarchy
6. Redesign `SessionHistoryPanel` — accordion timeline pattern
7. Redesign `PaymentHistoryPanel` — expandable transaction rows

All existing handlers, props, and business logic from `useCustomerDetailController.ts` are preserved unchanged.

**GATE RESULT: PASS**
