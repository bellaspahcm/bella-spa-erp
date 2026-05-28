# 📔 Nhật ký Phát triển & Bảo trì Tổng hợp (Development & Maintenance Log)
**Dự án**: Bella Spa Enterprise Resource Planning (ERP) System  
**Ngày cập nhật**: 29/05/2026  
**Mục tiêu**: Gom và tổng hợp tất cả các nhật ký làm việc hàng ngày của AI Agent và nhà phát triển để giúp việc tra cứu lịch sử được dễ dàng, tránh làm tràn context của AI Coding.

---

## 📅 Nhật ký Chi tiết Theo Ngày

### 🟢 Ngày 29/05/2026: Tích hợp nút Refresh (F5)
* **Nghiệp vụ thực hiện**:
  * Tích hợp nút làm mới dữ liệu (tương tự chức năng F5 của trình duyệt) trực quan và đồng bộ trên cả hai giao diện Kỹ thuật viên (KTV) và cổng thông tin Khách hàng (Portal).
  * Giúp KTV và Khách hàng chủ động reload cập nhật trạng thái dữ liệu mới nhất (Điểm danh, Check-in/out, Đánh giá ca làm, Tiến độ gói dịch vụ) mà không cần tải lại thủ công bằng trình duyệt.
* **Kỹ thuật**:
  * Chèn nút bấm tròn làm mới trang với biểu tượng `RefreshCw` ở Header góc phải trên cùng (cạnh nút Profile Settings) trên KTV Dashboard (`src/app/ktv/dashboard/page.tsx`).
  * Điều chỉnh bố cục tiêu đề chào mừng của Khách hàng thành `flex justify-between items-center` và bổ sung nút Refresh tinh tế phía bên phải trên Customer Portal (`src/app/portal/[token]/page.tsx`).
  * Sử dụng API `window.location.reload()`.
  * Chạy biên dịch TypeScript và chạy qua thành công **445/445** ca test Jest an toàn 100%.

### 🟢 Ngày 28/05/2026: Kiểm toán QA & QA Nghiệm thu 3 Lớp
* **Nghiệp vụ thực hiện**:
  * Thực hiện cuộc kiểm toán toàn diện & QA nghiệm thu 3 lớp cực kỳ nghiêm ngặt trên hệ thống Bella Spa ERP.
  * Khắc phục lỗi tự động phóng to (auto-zoom) khó chịu của iOS Safari khi người dùng click nhập dữ liệu trên PWA mobile.
* **Kỹ thuật**:
  * Tạo mới **7 bộ test tự động Jest** (`state-machine`, `transaction-safety`, `idempotency`, `concurrency`, `edge-cases`, `cross-module-integrity`, `security-hardening`) nâng tổng số test lên 445 pass hoàn hảo.
  * Cấu hình quy tắc CSS tối ưu trong `globals.css` (bọc trong `@media (max-width: 767px)`) đặt thuộc tính `font-size: 16px !important` cho tất cả các phần tử `input`, `textarea` và `select` trên màn hình nhỏ.
  * Nâng cấp **2 bộ test E2E Playwright** (`06-cross-module-verification` và `07-security-boundary`) chạy pass hoàn hảo trên Cloud Staging DB thực tế.
  * Xây dựng báo cáo kiểm toán HTML cao cấp phong cách Rose Spa sang trọng.

### 🟢 Ngày 27/05/2026: Tối ưu UI Đăng ký Đổi ca & Theme Switcher
* **Nghiệp vụ thực hiện**:
  * Khắc phục triệt để lỗi giao diện cắt chữ ThemeToggle (nút chuyển giao diện Sáng/Tối) trên PC và Mobile.
  * Tối ưu hóa UI đăng ký nghỉ phép và đổi ca của KTV để hiển thị lịch làm thay chính xác.
* **Kỹ thuật**:
  * Điều chỉnh cấu trúc CSS và layout flexbox của ThemeToggle để không bị cắt chữ hoặc tràn màn hình ở các độ phân giải responsive khác nhau.
  * Cập nhật logic timeline của Admin để ưu tiên sử dụng `s.completed_by_ktv_id` (KTV làm thay) khi hiển thị phân ca ngày, tự động đồng bộ hóa lịch của KTV Bella làm thay KTV Thúy Vân.

### 🟢 Ngày 26/05/2026: AI Agent Infrastructure & Salary Reconciliation
* **Nghiệp vụ thực hiện**:
  * Xây dựng cơ sở hạ tầng AI Agent (AI COO Service) hỗ trợ tính toán lương, đối soát và tự động phát hiện dị thường tài chính.
* **Kỹ thuật**:
  * Viết các function database an toàn và phân quyền RLS cho phép `service_role` của AI gọi RPC thực thi đối soát chéo.
  * Phát triển màn hình và Server Actions Đối soát lương KTV (`salary_reconciliation`).

### 🟢 Ngày 25/05/2026: Hệ thống Kế toán Kép (Dual-mode Accounting) & Period Closing
* **Nghiệp vụ thực hiện**:
  * Tích hợp hệ thống kế toán kép tự động đồng bộ dòng tiền với sổ cái (General Ledger) và báo cáo tài chính P&L.
  * Hỗ trợ chức năng khóa kỳ kế toán theo tháng và tự động phân bổ chi phí lương KTV tạm tính lũy kế.
* **Kỹ thuật**:
  * Tạo bảng `accounting_outbox`, `accounting_periods` và cài đặt trigger tự động đẩy giao dịch vào sổ cái.
  * Xây dựng báo cáo Cash Flow Statement (Lưu chuyển tiền tệ) và Consolidated P&L (Báo cáo kết quả kinh doanh hợp nhất) thời gian thực của các chi nhánh.

### 🟢 Ngày 22/05/2026: Hệ thống Nhượng quyền & Chế độ Ngoại tuyến (Offline Mode)
* **Nghiệp vụ thực hiện**:
  * Thiết lập cấu trúc Đa chi nhánh (Multi-tenant) độc lập dữ liệu nhưng đồng quy dòng tiền Royalty (Phí nhượng quyền) 10% về tổng bộ HQ.
  * Phát triển tính năng Đồng bộ Ngoại tuyến (Offline Sync / Dexie DB) cho KTV làm việc tại vùng mất sóng mạng 4G.
* **Kỹ thuật**:
  * Cài đặt RLS thắt chặt trên toàn bộ 16 bảng dữ liệu của Supabase.
  * Viết hook `useOfflineSync` và database Dexie trên trình duyệt di động để lưu tạm các thao tác Check-in, Bắt đầu ca, Kết thúc ca của KTV khi không có mạng, tự động đồng bộ khi có kết nối trở lại.

### 🟢 Ngày 21/05/2026: Tích điểm Loyalty & Đối soát Tài chính chi tiết
* **Nghiệp vụ thực hiện**:
  * Triển khai hệ thống Tích điểm Loyalty tự động cho mẹ bầu sau mỗi giao dịch thanh toán thành công (Tỷ lệ 100.000đ = 1 điểm).
  * Nâng cấp màn hình Đối soát tài chính với nút "Điều tra lệch" và hỗ trợ ghi nhận số tiền âm (Refund) để cân bằng sổ cái đối soát.
* **Kỹ thuật**:
  * Tạo trigger database `trg_calculate_loyalty_points` trên bảng `revenue`.
  * Viết script chạy Retroactive tự động cập nhật điểm thưởng lịch sử cho toàn bộ 27 khách hàng cũ.
  * Tạo liên kết điều tra trực tiếp từ trang đối soát tài chính về trang chi tiết khách hàng và lịch sử thanh toán chi tiết.

---

## 📌 Các quy tắc & bài học kỹ thuật cốt lõi tích lũy

1. **Zero Silent Database Failures (Chặn đứng nuốt lỗi DB):**
   - Tất cả các Server Actions hoặc DB mutations bắt buộc phải re-throw lỗi hoặc trả về explicit error status để các test suites tự động hoặc caller components có thể dừng ngay tiến trình khi có lỗi xảy ra.
2. **Quy tắc Font 16px trên Mobile:**
   - Cưỡng chế `font-size: 16px !important` cho tất cả các phần tử `input`, `textarea` và `select` trên màn hình di động (`max-width: 767px`) để tránh lỗi auto-zoom khó chịu của Safari iOS khi click nhập dữ liệu.
3. **Database Payload Typing nghiêm ngặt:**
   - Luôn sử dụng kiểu dữ liệu tự động tạo từ Supabase (ví dụ: `Database['public']['Tables']['attendance']['Insert']`) thay vì `as any` để TypeScript compiler (`npx tsc --noEmit`) tự động bắt lỗi sai cột/mismatch kiểu khi build.
