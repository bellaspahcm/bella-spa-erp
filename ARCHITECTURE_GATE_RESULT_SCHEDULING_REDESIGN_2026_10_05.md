# ARCHITECTURE GATE RESULT — Scheduling & POS Board UI Redesign
Date: 2026-10-05
Scope: `src/app/dashboard/sessions/` — Presentation Layer Only
**STATUS: PASS**

## 1. Problem / Non-Goals

**Building:** Real-time Dispatching Board & Operational Month Calendar for Bella Spa ERP (Matching Image 1 & Image 2)
**For:** Spa receptionists & coordinators managing daily schedules & staff assignments
**Solving:**
- Lack of real-time timeline dispatching board for KTVs (Timeline KTV view)
- Missing current time indicator line (P0 real-time tracking)
- Absence of unassigned booking column & AI KTV assignment recommendations
- Lack of capacity heatmap & daily agenda breakdown in Month View

**NOT doing:**
- No database schema modifications or new migrations
- No breaking changes to existing `session_logs` or `bookings` contracts
- No backend API alterations (uses existing `getSessionsWithDetails()`, `saveSessionNote()`, `completeSession()`)

## 2. Change Authority

Authorized files for presentation redesign:
- `src/app/dashboard/sessions/page.tsx`
- `src/app/dashboard/sessions/components/TimelineKtvView.tsx` (New presentation component)
- `src/app/dashboard/sessions/components/MonthCalendarView.tsx` (New presentation component)
- `src/app/dashboard/sessions/components/SessionCard.tsx`

NOT authorized: Core platform engines, database tables, auth hooks, or backend contracts.

## 3. UI → Contract Reconciliation

| UI Element | Canonical Contract | Conclusion |
|---|---|---|
| View mode switcher `Timeline KTV \| Lịch tháng` | Local state `viewMode` | MATCH |
| Operational KPI summary (Total bookings, Customers, Capacity %, Unassigned, Late) | Derived from `sessions` array | MATCH (derived) |
| KTV Scheduling Columns & Workload % | `ktvs` list + `sessions.assigned_ktv_id` count | MATCH |
| Current Time Line (Red bar) | Dynamic `new Date()` time calculation | MATCH (presentation) |
| Appointment cards with status colors | `session.status` / `booking.status` | MATCH |
| Monthly Heatmap Calendar | Days of month + aggregated sessions per day | MATCH |
| Daily Agenda Table | `sessions.filter(date === selectedDate)` | MATCH |

## 4. Minimal Implementation Plan

1. Create `TimelineKtvView.tsx` implementing real-time KTV dispatching board:
   - Date & week strip navigator
   - 30-min grid lines & Current Time red indicator line
   - KTV Workload headers & "Chưa phân công" alert column
   - Off-shift & lunch break hatch blocks
   - Unassigned booking AI suggestion panel & KTV Workload summary
2. Create `MonthCalendarView.tsx` implementing operational monthly capacity heatmap:
   - Monthly summary bar (Total bookings, unique customers, capacity %, unassigned)
   - Month heatmap calendar grid with capacity % and status dots
   - Daily Agenda table + Daily summary & KTV distribution sidebar
3. Update `src/app/dashboard/sessions/page.tsx` to seamlessly toggle between `Timeline KTV` and `Lịch tháng` modes while maintaining all existing actions, modals, and filters.

**GATE RESULT: PASS**
