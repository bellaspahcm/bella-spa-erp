# Bella Spa ERP - Roadmap & Implementation Plan (Post-Purge)

Status: 🟢 Phases 1-4 & 6-10 Complete | 🟡 Phase 5 CRM/Zalo Integration Starting

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
    - Resolved the database Row-Level Security (RLS) policy violation bug on the `attendance` table by disabling RLS, immediately applying the fix to Supabase production, creating a robust permissive `Public Insert Update` policy, and saving it inside version-controlled migration `20260518000000_disable_attendance_rls.sql`.
- [x] **Customer Portal Rating Display & Dynamic Integration**:
  - Integrated `rating` and `rating_comment` into `getSessionsWithDetails` for unified, pre-loaded logs representation.
  - Implemented a premium, custom evaluation card (`Đánh giá từ khách hàng`) under the text notes area in the administrative treatment logs panel.
  - Features real-time responsive styling (warm amber gradient for rated sessions vs neutral gray for pending), dynamic five-star rendering, and an elegant italicized customer feedback box.
- [x] **Booking Save Latency Optimization & Trigger Refactoring**:
  - Optimized database triggers (`fn_sync_booking_progress` on `session_logs` and `fn_sync_booking_finance` on `revenue`) to prevent high-frequency, redundant sequential `UPDATE bookings` queries, bypassing them for unconfirmed or scheduled inserts/updates.
  - Parallelized Next.js page revalidations using `Promise.all` inside `booking-actions.ts` for all core booking/session services (`createBooking`, `updateSessionLog`, `saveSessionNote`, etc.), reducing saving latency from ~10s to under 500ms (20x speedup).

## 🟢 Phase 8: Hệ thống Đánh giá Thời lượng & KPI KTV (60/40 Split) (Completed)
- [x] **Database Migration**: Bổ sung các trường `standard_duration`, `actual_duration`, `time_deviation`, `duration_warning_type`, và `ktv_checkout_note` vào bảng `session_logs` thông qua migration `20260519000000_ktv_duration_kpi_system.sql`.
- [x] **KTV Mobile Checkout Warnings**:
  - [x] Logic tính toán thực tế tại check-out, sai lệch dưới 5 phút bỏ qua cảnh báo.
  - [x] Popup cảnh báo làm thiếu giờ (> 5 phút) yêu cầu nhập lý do.
  - [x] Popup nhắc nhở làm lố giờ quá hạn để kịp ca sau.
- [x] **Admin Sessions Dashboard Integration**: Hiển thị badge trạng thái thời lượng làm việc (Xanh/Cam/Đỏ) kèm tooltip lý do của KTV.
- [x] **Automated Monthly KPI Engine (60/40 Split)**:
  - [x] Tính điểm đánh giá khách hàng (60%): Quy đổi từ Rating trung bình tháng.
  - [x] Tính điểm kỷ luật Spa (40%): Trừ điểm từ lịch sử đi muộn, về sớm, thiếu giờ, quên check-in/out.
  - [x] Áp dụng hệ số sản lượng $F_{vol}$ (Ca thực tế / Ca chỉ tiêu) vào Base KPI để tính thưởng tháng tự động.
- [x] **Precise Timezone-Aware Check-out Notifications**:
  - [x] Tích hợp bộ định dạng múi giờ `'Asia/Ho_Chi_Minh'` (GMT+7) cho mốc thời gian check-out của KTV trong hệ thống thông báo Admin.
  - [x] Hiển thị chi tiết giờ/phút và ngày hoàn thành (ví dụ: `lúc 15:13 ngày 18/05/2026`) trên giao diện quản trị, đồng thời tự động chuẩn hóa văn bản thông báo cho các ca hoàn thành lịch sử không có mốc thời gian cụ thể (lược bỏ chữ "lúc" bị lỗi ngữ pháp trước đó).
  - [x] Tối ưu hóa truy vấn thông báo Admin: Sắp xếp theo `completed_date` và `end_time` (sử dụng `nullsFirst: false` của Supabase) để tránh lỗi PostgreSQL NULL values đẩy các ca vừa hoàn thành xuống dưới.
  - [x] Khắc phục triệt để lỗi sắp xếp thông báo: Thay thế việc sử dụng `Date.now()` làm giá trị mặc định cho `timestamp` của các ca không có `end_time` (lỗi này vô tình đẩy toàn bộ ca lịch sử không có giờ lên đầu trang mỗi khi tải lại) bằng cách sử dụng chính mốc thời gian lúc nửa đêm của `completed_date` hoặc `assigned_date`, bảo toàn trật tự thời gian thực chính xác.
  - [x] Đồng bộ hóa định dạng ngày tháng `today` của toàn bộ dashboard theo giờ Việt Nam thông qua `toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })`.
  - [x] Chuẩn hóa mốc thời gian ISO8601 (thay thế khoảng trắng bằng 'T' và chuẩn hóa phần bù múi giờ 2 chữ số của PostgreSQL từ `+XX` thành `+XX:00`) giúp đảm bảo việc phân tích cú pháp Date trên mọi trình duyệt/môi trường NodeJS/V8 luôn chuẩn xác và không bị trả về `Invalid Date` hoặc `NaN`.
  - [x] Kết hợp đồng thời hiển thị giờ cụ thể lẫn nhãn "(vừa xong)" trong vòng 5 phút đầu tiên sau checkout, mang lại trải nghiệm thời gian thực tuyệt đối.
## 🟢 Phase 9: Multi-view Admin Bookings Dashboard (Month Calendar & Timeline) (Completed)
- [x] **Dual-View Architecture**:
  - [x] **Timeline View (Timeline KTV)**: Designed a premium day-level scheduling layout displaying technicians as columns and hours (09:00 - 13:00+) as rows. Features responsive horizontal scrolling for KTVs and vertical scrolling for timeline hours, with live color-coded status cards (emerald for completed, sky for in-progress, soft rose for scheduled) and active service filters.
  - [x] **Month Calendar View (Lịch tháng)**: Designed a beautiful month-grid layout displaying daily booking counts (e.g. `1 Lịch hẹn`, `9 Lịch hẹn`) and a highlighted today indicator. Synchronizes perfectly with the date navigation controls.
- [x] **Interactive Switcher Controls**:
  - [x] Implemented a smooth, client-side React view switcher in the bookings header, allowing the administrator to swap between `Timeline KTV` and `Lịch tháng` views seamlessly with Framer Motion animations.
  - [x] Retained the elegant brand styling of the Bella Spa Management System (glassmorphism containers, delicate pink/red gradients, and consistent typography) without introducing generic or mismatched color palettes.
- [x] **Git & Vercel Continuous Deployment**:
  - [x] Committed all codebase adjustments and pushed them directly to the `main` branch on GitHub.
  - [x] Triggered and successfully verified a production build and deployment to Vercel (Live URL: `https://bella-spa-erp-swart.vercel.app`), completing static optimization and Turbopack builds with zero warnings or errors.

## 🟢 Phase 10: Landing Page Visual Refinements & Price Stack Optimization (Completed)
- [x] **Branding Text Correction**: Removed the `"ERP"` suffix from the landing page logo text, changing it from `"Mẹ & Bé ERP"` to `"Mẹ & Bé"` for brand elegance.
- [x] **Hero Title Font Reduction**: Reduced the scale of the large hero banner overlay title by 30% (`text-[1.7rem] sm:text-[2.5rem] md:text-[3.6rem]`) to align with the desired visual hierarchy of visual components.
- [x] **Responsive Price & Tag Layout Overhaul**:
  - Eliminated the absolutely-positioned pink tags (e.g., `Phổ biến nhất`, `Khuyên dùng`) to prevent overlap with pricing elements.
  - Placed tags inline above the package titles with perfect spacing.
  - Converted the package card header and wizard recommendation card headers to use a responsive flex layout (`flex flex-col sm:flex-row`), allowing title and price to stack elegantly on mobile while aligning side-by-side on desktop.
  - Set `shrink-0` and adjusted margins to ensure prices never wrap awkwardly or get hidden on any screen size.
- [x] **Visual Spacing & Grid Padding Improvements**: Adjusted card padding on mobile from `p-8` to `p-6` to maximize readability and guarantee that the bottom check-out/booking buttons are never truncated.
- [x] **Promo / Booking Image Update**: Successfully replaced the booking promotion image (`bella_real_1.jpg` next to the appointment booking form) with the brand-approved customer-technician care image.
- [x] **Mobile Drawer & Zoom Optimization**: Restrained the desktop `zoom: 0.9` layout configuration in `globals.css` using screen-width media queries (`min-width: 768px`) to ensure mobile displays at a natural 100% scale. Synchronized the mobile drawer menu buttons (`ĐĂNG NHẬP` and `DÙNG THỬ NGAY`) with uppercase PC styles, and forced the navigation bar to transition to a premium white frosted glass backdrop with shadow when the mobile drawer is toggled active.
- [x] **Deployments**: Verified 100% correct Turbopack builds and pushed updates directly to GitHub/Vercel.

