# ARCHITECTURE GATE RESULT: Beauty Spa Sessions Page Redesign (Customer Treatment Cards)

**Date:** 2026-10-05  
**Target:** `src/app/dashboard/sessions/`  
**Status:** PASS  

---

## 1. Process Gate Assessment
- **Context:** Redesigning `/dashboard/sessions` to serve as a dedicated **Customer Treatment Card & Detail Management Page** (Quản lý Thẻ liệu trình của khách hàng), separating it from `/dashboard/bookings` (Lịch hẹn & POS).
- **Scope:** Product UI in `src/app/dashboard/sessions/`.
- **Kernel Impact:** ZERO changes to Healthcare OS Kernel (H1-H12) or Logistics OS Kernel (E7.1-E7.3).

---

## 2. Product Manifest & Scope
- **Feature:** Customer Treatment Cards Portal & Detail View (Quản lý & Chi tiết Thẻ liệu trình Khách hàng).
- **Capabilities:**
  1. Summary metrics: Total active treatment cards, cards near completion, sessions executed this month, remaining debt cards.
  2. Filter & Search: Search by customer name, phone, treatment package name; filter by card status (`in_progress`, `completed`, `paused`, `debt`).
  3. Treatment Card Grid / Cards List:
     - Customer identity badge (Name, Phone, Monogram avatar, Link to customer detail).
     - Package details (Package title, total sessions, completed sessions, progress bar, gift sessions).
     - Next scheduled session date & KTV assigned.
     - Payment state (Full price, prepaid, remaining balance).
  4. Detailed Card View Modal / Drawer:
     - Complete session timeline breakdown (Buổi 1 to Buổi N).
     - Per-session details: Completion date, KTV performer, progress notes, ratings, duration warnings.
     - Actions: Perform next session, save session notes, reuse package, open POS / billing.

---

## 3. Ownership Map
- **Data Owner:** Core Order / Session Services (`src/core/services/order`).
- **Tables Used:** `bookings` (treatment cards), `session_logs` (treatment session entries), `customers` (customer profile), `users` (KTV staff), `packages` (service package metadata).

---

## 4. Contract Dependency Map
`Product UI (src/app/dashboard/sessions/page.tsx)`  
  └── `session-query-actions.ts` (`getSessionsWithDetails`, `getSessionLogs`)  
  └── `lifecycle-actions.ts` (`completeSession`, `saveSessionNote`, `reusePackage`)  
  └── `Supabase DB (bookings, session_logs, customers)`

---

## 5. Decision & Authorization
- **Result:** `PASS`
- **Action:** Proceed with implementation of `TreatmentCardView`, `TreatmentCardDetailModal`, and update `/dashboard/sessions/page.tsx`.
