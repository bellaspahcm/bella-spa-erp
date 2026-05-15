# 📋 Kế hoạch Chuẩn hóa Dữ liệu & Vận hành Bella Spa ERP (v1.9)

## 🎯 Mục tiêu chính
1.  **Chuẩn hóa định danh:** Chuyển đổi toàn bộ logic "Tên dịch vụ/gói" sang "Mã dịch vụ/gói" (ID-based).
2.  **Tự động hóa tính toán:** Chuyển logic tính số dư, doanh thu, số buổi từ Server Actions sang Database Triggers.
3.  **Đảm bảo tài chính:** Liên kết 100% chi phí/doanh thu với thực thể Booking gốc qua Foreign Keys.
4.  **Bảo mật:** Siết chặt RLS và cơ chế khóa dữ liệu (Immutability).

---

## 🛠️ Lộ trình thực hiện

### 1. Giai đoạn 1: Chuẩn hóa Cấu trúc Database (Database Normalization)
*   **1.1. Khởi tạo danh mục dịch vụ:** 
    *   Tạo bảng `packages` và `services`.
    *   Cấu hình đơn giá và số buổi chuẩn cho từng gói.
*   **1.2. Refactor bảng Bookings:** 
    *   Thêm cột `package_id` tham chiếu đến bảng danh mục.
    *   Migrate dữ liệu cũ từ `package_name` sang `package_id`.
*   **1.3. Hệ thống Database Triggers:** 
    *   `fn_update_booking_progress()`: Tự động đếm lại buổi khi `session_logs` thay đổi.
    *   `fn_calculate_financial_balance()`: Tự động tính nợ/dư dựa trên `revenue`.

### 2. Giai đoạn 2: Củng cố Logic Nghiệp vụ (Logic Hardening)
*   **2.1. Server Actions Refactor:** 
    *   Cập nhật `booking-actions.ts` để đọc cấu hình từ bảng `packages`.
    *   Chuẩn hóa luồng `recordRemainingPayment` (Auto-confirm revenue).
*   **2.2. Salary Logic Enhancement:** 
    *   Gán `session_log_ids` vào `salary_records` để đối soát 1-1.

### 3. Giai đoạn 3: Chuẩn hóa Giao diện & Trải nghiệm (UI/UX Standardization)
*   **3.1. Audit & Replace:** Thay thế hoàn toàn `<select>` gốc bằng `PremiumSelect`.
*   **3.2. Dashboard Accuracy:** Chuyển các thẻ thống kê Admin sang sử dụng SQL Views/Functions để đảm bảo số liệu real-time.
*   **3.3. Financial Reconciliation UI:** Xây dựng màn hình đối soát để phát hiện sai lệch dữ liệu.

### 4. Giai đoạn 4: Bảo mật & Kiểm thử (Security & Validation)
*   **4.1. RLS Policy Audit:** Siết chặt quyền truy cập trên 16 bảng.
*   **4.2. Data Integrity Script:** Rà soát và dọn dẹp các dữ liệu không nhất quán.

---

## 📈 Trạng thái thực hiện
- [x] **Giai đoạn 1**: Hoàn tất (Database Normalization & Triggers)
- [x] **Giai đoạn 2**: Hoàn tất (Logic Hardening & Server Actions Refactor)
- [x] **Giai đoạn 3**: Hoàn tất (Đã tích hợp BookingModal, Dynamic Packages UI, UI Standardization và Customer Portal/Messaging Center)
- [x] **Giai đoạn 4**: Hoàn tất (Đã xác nhận & Triển khai các cấu hình Audit/Security/Chat RLS)

---
**Ngày khởi tạo:** 15/05/2026
**Người lập kế hoạch:** Antigravity AI Agent
