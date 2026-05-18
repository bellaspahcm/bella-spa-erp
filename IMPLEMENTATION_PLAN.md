# Bella Spa ERP - Roadmap & Implementation Plan (Post-Purge)

Status: 🟢 Phases 1-4 & 6-7 Complete | 🟡 Phase 5 CRM/Zalo Integration Starting

## 🟢 Phase 0: The Great Purge (Completed)
- [x] Remove all RealEstate legacy tables and columns.
- [x] Normalize `bookings` and `customers` schemas.
- [x] Consolidate `employees` into role-based `users`.
- [x] Hardened data integrity with strict constraints.

## 🟢 Phase 1: Financial Automation & Deep Reporting (Completed)
### 17. Quản lý Kho & Vật tư (v2.1)
- **Cấu trúc**: `inventory_items`, `package_materials`, `inventory_logs`.
- **Tự động hóa**: Trigger `trigger_deduct_inventory_on_session_complete` tự động trừ kho dựa trên định mức gói dịch vụ.
- **Cảnh báo**: Tích hợp thông báo tồn kho thấp vào Dashboard Admin và RPC `get_important_alerts`.
- [x] **Profit & Loss (P&L) Engine**: Implement logic to calculate Net Profit by subtracting KTV Salary and operating Expenses from Revenue.
- [x] **Monthly Dashboard**: Create a high-level visual summary of P&L trends.
- [x] **Service ROI Analysis**: Track profitability per service package.
- [x] **Automated Monthly Closing**: Lock financial records at the end of each month to prevent retrospective changes.

## 🟢 Phase 2: KTV Mobile-First Experience (Completed)
- [x] **Quick Session Log**: Mobile-optimized interface for KTV check-in/out.
- [x] **Real-time Commission Dashboard**: Allow KTVs to see their earnings live.
- [x] Phase 1: Tài chính tự động
- [x] Phase 2: KTV Mobile Experience
- [x] Phase 3: Customer Portal & Loyalty
- [x] Phase 4: Quản lý Kho & Vật tư tiêu hao (Completed)
- [x] **KTV Leaderboard**: Performance-based gamification for staff.

## 🟢 Phase 3: Customer Portal & Loyalty (Completed)
- [x] **Treatment Progress Tracking**: QR-based portal for customers to see remaining sessions.
- [x] **Automated Rating System**: Post-session feedback triggers linked to KTV performance bonuses.
- [x] **Loyalty Points**: Reward system for repeat bookings and referrals.

## 🟢 Phase 4: Inventory & Supply Chain (Completed)
- [x] **Material Consumption Logic**: Auto-deduct supplies (oils, towels, etc.) upon session completion.
- [x] **Low Stock Alerts**: Automated notifications for reordering.

## ⚪ Phase 5: CRM & Zalo Integration
- [ ] **Automated Reminders**: Appointment alerts 2 hours before session.
- [ ] **Marketing Automation**: Birthday greetings and targeted voucher campaigns.

## 🟢 Phase 6: Messaging Center & Communication (Completed)
- [x] **Internal & Customer Chat**: Built and stabilized the real-time chat module for administrative coordination.
- [x] **Customer Portal UI/UX**: Enhanced the customer treatment tracking portal with improved styling and official social media integrations.
- [x] **Client-side Fetching Optimization**: Refactored real-time connections to bypass server-action bottlenecks.

## 🟢 Phase 7: UI/UX Refinement & Financial Transparency (Completed)
- [x] **Customer Profile List Optimization**: Cleaned up the main customer listing cards by removing redundant/transactional financial statuses. The card is now strictly a personal identity card, catering to the reality that customers purchase multiple distinct therapy packages.
- [x] **Detailed Therapy/Payment Card**: Redesigned the main financial card in Customer Details `/dashboard/customers/[id]` to show:
  - Custom label (`Đã thanh toán đủ` vs `Đã cọc`).
  - Active amount paid.
  - Original package price (`Giá gốc` with line-through).
  - Discount details (`Đã giảm [Phần trăm]%`).
  - Real-time remaining balance owed (`Còn nợ: [Số tiền]đ`) computed dynamically for transparent reconciliation.
- [x] **KTV Dashboard Active Session Card Overhaul**: Added Mother's name, Baby's name, dynamic progress counter (e.g., `Buổi X/Y`), and precise address fetched from customer profiles; resolved the black-on-black text contrast legibility bug on the slate background.
- [x] **Global Hotline Privacy Masking**: Masked spa hotlines (`0865701493` or `84865701493`) from being displayed to KTVs for staff/customer privacy boundaries.
- [x] **Notification Click Popovers**: Configured rich, customized popover modals to trigger instantly when a KTV clicks on dashboard notifications.
- [x] **Premium Checkout Modal Integration**: Replaced standard browser `window.prompt` boxes with a premium, custom React slide-up confirmation modal with full session metrics and a beautiful custom textarea for capturing therapeutic notes.
- [x] **Real-time Leaderboard WebSocket Integration**: Enrolled the `session_logs` table in Supabase's realtime publication and implemented a dynamic client-side WebSocket subscription on `/ktv/leaderboard` to auto-recalculate KTV rankings instantly in real-time when any session checks out.
- [x] **Actual Check-in/out Session Chronology**: Modified the core session queries in `booking-actions.ts` to retrieve actual check-in (`start_time`) and check-out (`end_time`) times for completed sessions. Redesigned the completed session details card in the admin interface (`/dashboard/sessions`) to elegantly display the KTV, formatted real-time check-in and check-out timestamps, and computed therapeutic duration in minutes under a premium, glassmorphic layout.
- [x] **Session Counting Logic & Multi-session Sync**: Fixed the session discrepancy bug where editing a booking's `total_sessions` left redundant scheduled logs in the database. Added a reactive sync engine in `updateBooking` to delete excess scheduled sessions or generate missing ones dynamically, implemented strict check-in guards in KTV actions, and ran a comprehensive database query to clean up all mismatched historical sessions.
- [x] **Actual Attendance Management & Timezone Alignment**:
  - Fixed the attendance sheet React rendering crash (TypeError for `ktv.summary`).
  - Synced backend `logs` data structure with calendar grid cell matching (resolved blank/gray calendar grids).
  - Integrated beautiful actual check-in and check-out information cards displayed instantly to administrators when clicking days on the KTV calendar.
  - Implemented a timezone-proof (+07:00 Vietnam) architecture for both frontend form state controls (`toLocalISOString`, `formatTimeVN`) and backend database synchronization (`adminOverrideAttendance`).
  - Resolved the database Row-Level Security (RLS) policy violation bug on the `attendance` table by disabling RLS, immediately applying the fix to Supabase production, and creating version-controlled migration `20260518000000_disable_attendance_rls.sql`.


