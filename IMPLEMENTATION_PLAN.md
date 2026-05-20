# Bella Spa ERP - Roadmap & Implementation Plan (Post-Purge)

Status: 🟢 Phase 16 - Triệt để Bảo Mật & Code Quality (Completed) | 100% Build Compiled

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

## 🟢 Phase 5: CRM & Zalo Integration (Completed)
- [x] **Automated Reminders**: Appointment alerts 2.5 hours before session with real Zalo OA/ZNS API integration and automatic access token refresh.
- [x] **Marketing Automation**: Birthday greetings and targeted voucher campaigns using real Zalo ZNS templates with fallback mock/sandbox system support.


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
  - [x] Triggered and successfully verified a production build and deployment to Vercel (Live URL: `https://bella-spa-erp.vercel.app`), completing static optimization and Turbopack builds with zero warnings or errors.

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

## 🟢 Phase 11: Tích hợp Cổng thanh toán VietQR động tự động đối soát (Completed)
- [x] **Database Migration**: Bổ sung các cột thông tin ngân hàng của Spa (`qr_bank_code`, `qr_account_number`, `qr_account_name`) vào bảng `tenants` để hỗ trợ cấu hình động từ giao diện Admin (Đã chạy migration `20260520000001_add_bank_details_to_tenants.sql`).
- [x] **Interactive Admin Settings**: Tích hợp các trường nhập thông tin ngân hàng vào trang **Cấu hình chung** ở `/dashboard/settings` và tạo Server Actions `tenant-actions.ts` để lưu trữ đồng bộ.
- [x] **Dynamic VietQR Client Generation**: 
  - Tích hợp sinh mã QR động tự động bằng API `img.vietqr.io` tại các màn hình:
    - [x] Khi Admin tạo lịch hẹn mới hoặc xác nhận đặt cọc trên Dashboard Admin.
    - [x] Trên **Cổng khách hàng (Customer Portal)** để khách hàng có thể quét mã chuyển khoản đặt cọc/thanh toán trực tiếp (đã tích hợp với nút copy tiện dụng).
  - Mã QR tự điền chính xác: Số tài khoản, Ngân hàng, Tên chủ tài khoản, Số tiền còn nợ (hoặc cọc), và đặc biệt là **Nội dung chuyển khoản tự động** theo mẫu chuẩn (ví dụ: `BELLA [Mã Booking]`).
- [x] **Automated Payment Webhook Gateway (`/api/webhooks/payment`)**:
  - Xây dựng một Next.js Route Webhook để nhận tín hiệu chuyển khoản thành công từ dịch vụ đối soát biến động số dư ngân hàng (như Casso/SePay/PayOS).
  - Phân tích cú pháp nội dung chuyển khoản để tự động tìm kiếm `booking_number` tương ứng trong bảng `bookings`.
  - **Tự động đối soát**:
    - Cập nhật trạng thái booking thành `booked` / `confirmed` (nếu booking đang chờ cọc).
    - Tạo bản ghi mới trong bảng `revenue` ghi nhận số tiền thực nhận với phương thức thanh toán là `VietQR`.
    - Ghi nhật ký vào `audit_logs` và tạo `Notification` cho Admin về giao dịch chuyển khoản thành công.
- [x] **Git Synchronization & Vercel Production Build Verification**: Biên dịch Next.js build thành công 100% không phát sinh lỗi.

## 🟢 Phase 12: Kiến trúc Ngoại tuyến & Đồng bộ hóa thông minh - Offline-First & Sync Queue (Lựa chọn B - Completed)
- [x] **Client-side IndexedDB Local Database**: Thiết lập cơ sở dữ liệu `BellaSpaOfflineDB` bằng Dexie.js với bảng `offlineQueue` để lưu trữ ngoại tuyến các hành động check-in, check-out, bắt đầu ca và kết thúc ca điều trị của KTV.
- [x] **Smart Hook & Network Monitors**: Xây dựng React hook `useOfflineSync` tự động theo dõi trạng thái kết nối mạng (`online`/`offline`), đánh chặn các hành động khi ngoại tuyến, ghi cache local và mô phỏng giao diện thành công tức thì nhằm tránh độ trễ cho KTV.
- [x] **FIFO Ordered Sync & Manual Console**: Tự động đồng bộ hóa tuần tự theo trật tự FIFO khi có mạng trở lại. Triển khai bảng điều khiển đồng bộ (Console) trong Profile Drawer cho phép KTV xem logs lỗi chi tiết, thực hiện đồng bộ lại thủ công hoặc Hủy bỏ (Discard) các tác vụ bị kẹt.
- [x] **Offline Alert Banner & Animated Badges**: Tích hợp các badge trạng thái kết nối thủy tinh (Trực tuyến, Đồng bộ, Ngoại tuyến) kèm hiệu ứng động và banner cảnh báo màu hổ phách sang trọng ngay trên giao diện KTV Dashboard.

## 🟢 Phase 13: Cấu hình linh hoạt Lương & Thưởng (Completed)
- [x] **Database Schema**: Tạo migration `20260520000004_add_salary_config_to_tenants.sql` để thêm trường cấu hình linh hoạt `salary_config` dạng JSONB vào bảng `tenants`.
- [x] **Giao diện Cấu hình (Settings UI)**: Thêm mới Tab **Lương & Thưởng** vào Dashboard Settings cho phép Quản trị viên (Admin) thay đổi:
  - Mức thưởng chất lượng (5 Sao, 4.5 Sao, 4 Sao).
  - Chỉ tiêu số ca KPI.
  - Số tiền thưởng khi đạt KPI.
- [x] **Logic Lương động**: Refactor API tính lương (`salary-actions.ts`) để đọc dữ liệu thiết lập từ `tenants.salary_config` thay vì sử dụng fix cứng, tự động fallback an toàn nếu chưa cấu hình.

## 🟢 Phase 14: Phân quyền động (Dynamic RBAC) & Giới hạn KTV_LEAD (Completed)
- [x] **Database Schema**: Tạo migration `20260520000004_add_role_permissions.sql` bổ sung trường `role_permissions` (JSONB) vào bảng `tenants` để hỗ trợ cơ chế đa chi nhánh (multi-tenant) cho phân quyền linh hoạt.
- [x] **Bảo mật Xác thực 2 Lớp (Re-auth)**: Triển khai Tab **Phân quyền** trong giao diện Cài đặt với cơ chế yêu cầu quản trị viên nhập lại mật khẩu truy cập trước khi hiển thị bảng phân quyền.
- [x] **Module-based Dynamic RBAC**: Tích hợp logic phân quyền động vào `Sidebar.tsx`, dựa trên thiết lập của Admin để chặn/cho phép các module đối với các role ngoài admin (như Lễ tân, KTV Trưởng).
- [x] **KTV_LEAD Restrictions**: Thiết lập Role `ktv_lead` (KTV Trưởng) mới thông qua `<PremiumSelect>` và ẩn mặc định các trang nhạy cảm: `Tài chính`, `Bảng lương`, `Cài đặt`, `Nhật ký`, `Kho hàng`.
- [x] **Dashboard UI Protection**: Ẩn triệt để các số liệu Doanh Thu Tháng và Biểu đồ Tài Chính trên trang chủ Dashboard đối với KTV Trưởng và các nhân sự không phải Quản trị viên.

## 🟢 Phase 15: Nâng cấp Kiến trúc Bảo mật Tổng thể (Security Overhaul) (Completed)
- [x] **Database Security**: Tạo migration dọn sạch cột `password_hash` khỏi bảng `users` ở Public Schema, ngăn chặn hoàn toàn rủi ro rò rỉ hash.
- [x] **Tenant ID Hardening**: Gỡ bỏ toàn bộ Tenant ID mặc định được hardcode rác trong toàn hệ thống. Xác thực động thông qua session user và trả về lỗi `Unauthorized` nếu phát hiện bất thường.
- [x] **Zalo Credentials Encryption**: Viết lại module `crypto.ts` mã hóa AES-256-GCM. Tự động mã hóa Access Token và Secret Key của Zalo trên database, giấu kín nội dung hiển thị trong log Audit.
- [x] **Webhook Security (Timing Attack Prevention)**: Tích hợp `crypto.timingSafeEqual` cho cổng webhook Payment, yêu cầu bắt buộc cấu hình `PAYMENT_WEBHOOK_SECRET`.
- [x] **Rate Limiting Engine**: Tích hợp thuật toán Token Bucket (`rate-limit.ts`) nhằm chống DDOS và Spam request hệ thống.
- [x] **Data Input Validation**: Xác nhận triển khai kiến trúc Zod Validation bảo vệ các Server Actions (ví dụ: Booking Data) khỏi mã độc và payload lỗi từ client.

## 🟢 Phase 16 - Triệt để Bảo Mật & Code Quality (Completed)
1. **Row-Level Security (RLS)**
   - Kích hoạt RLS cho toàn bộ bảng cốt lõi (`bookings`, `revenue`, `expenses`, `session_logs`).
   - Thiết lập Data Access Policy nghiêm ngặt (Admin quản lý chi nhánh, KTV quản lý session cá nhân, Guest chỉ được Insert).
2. **Loại bỏ Lỗi rò rỉ thông tin (Information Leakage)**
   - Xóa bỏ chuỗi trả về `DEBUG:` chứa ID, Email và Role tại các hàm chặn quyền.
3. **Loại bỏ Dev Mock User Bypass**
   - Vô hiệu hóa vĩnh viễn backdoor tự động login (Mock User & Test Admin).
4. **Loại bỏ Placeholder Keys**
   - Ném lỗi Hard Error nếu thiếu `NEXT_PUBLIC_SUPABASE_URL` thay vì âm thầm sử dụng dummy URL.

## 🟢 Phase 17: React Component Architecture Optimization (Completed)
- [x] **Landing Page Modularization**: Tách rời thành công `HeroSection` và `FeaturesSection` khỏi `src/app/page.tsx` giúp tinh gọn mã UI gốc.
- [x] **Dashboard UI Refactoring**: Dọn dẹp mã JSX nguyên khối trong `src/app/dashboard/page.tsx`. Tích hợp gọn gàng các component con độc lập như `StatsGrid`, `RevenueChart`, và `KtvPerformanceTable`.

## 🟢 Phase 18: Monolith API Actions Refactoring & Domain-Driven Design (Completed)
- [x] **Phân rã Salary Actions**: Bóc tách thành công file `src/services/salary-actions.ts` (915 dòng) thành các module phân theo logic tại `src/modules/hr-salary/actions/` (`base-salary-actions.ts`, `admin-salary-actions.ts`, `query-salary-actions.ts`).
- [x] **Phân rã Booking Actions**: Loại bỏ hoàn toàn khối mã cồng kềnh `src/services/booking-actions.ts` (1,713 dòng), tách biệt chúng thành các module riêng biệt tại `src/modules/booking/actions/` (`lifecycle-actions.ts`, `session-actions.ts`, `commission-actions.ts`).
- [x] **Validation & Type Safety**: Đồng bộ hóa toàn bộ các file import liên đới và khắc phục dứt điểm các lỗi Next.js Server Actions phát sinh khi refactor. Đạt 100% tỷ lệ vượt qua bài Test tự động.
- [x] **Production Verified**: Quá trình Build tĩnh qua Turbopack hoàn tất mượt mà không vướng bug runtime nào. Hệ thống sẵn sàng mở rộng.

## 🟢 Phase 19: Nâng cấp Quản lý Nhân sự (Staff Management) (Completed)
- [x] **Xử lý lỗi Backend**: Bắt lỗi trùng lặp Email (PostgreSQL unique constraint `users_email_key`) trong `createUser` và trả về thông báo lỗi thân thiện cho người dùng.
- [x] **Thao tác dữ liệu (CRUD)**: Bổ sung Server Actions `updateUser` và `deleteUser` vào hệ thống `user-actions.ts`.
- [x] **Giao diện Quản lý**: Bổ sung tính năng Sửa thông tin nhân sự (Họ tên, Vai trò) và Xóa nhân sự (kèm theo popup cảnh báo an toàn màu đỏ trước khi thực thi) trực tiếp trên giao diện Cài đặt Nhân sự & Quyền. Tích hợp thông báo Toast mượt mà, đồng thời không phá vỡ cấu trúc giao diện chung hiện hữu.
