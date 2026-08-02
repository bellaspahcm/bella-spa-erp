# Đặc Tả Sản Phẩm: Bella EIP Partner Portal (BPP)
> **Bella EIP — Cổng Thông Tin Dành Cho Đối Tác & Cộng Tác Viên**

Tài liệu này đặc tả chức năng, giao diện (UI/UX) và phân quyền của **Partner Portal (BPP)**. Giao diện được tối ưu hóa siêu nhẹ, tập trung hoàn toàn vào hoạt động giới thiệu khách hàng, bán hàng, đối soát hoa hồng và nhận tài liệu hỗ trợ bán hàng của hệ thống phân phối bên ngoài.

---

## 1. Đối Tượng Sử Dụng (Personas)
* **Đại lý liên kết (F1, F2):** Các sàn phân phối thứ cấp ký hợp đồng liên kết bán hàng với chủ đầu tư.
* **Môi giới độc lập / Cộng tác viên (CTV):** Cá nhân tự do giới thiệu khách hàng để hưởng phí môi giới/hoa hồng.

---

## 2. 7 Phân Hệ Nghiệp Vụ Tác Nghiệp (Core Modules)

### 2.1. Trang Chủ & Bản Tin Sàn (Dashboard)
Hiển thị tổng quan các thông tin hỗ trợ bán hàng của đối tác:
* Thống kê tổng doanh số bán hàng tích lũy.
* Số lượng căn hộ giữ chỗ (Booking) đang chờ phê duyệt hoặc đã thành công.
* Tổng hoa hồng tích lũy và số tiền hoa hồng thực nhận đợt gần nhất.
* Bảng tin nhanh về các chính sách thưởng nóng, chính sách bán hàng mới của chủ đầu tư.

### 2.2. Bảng Hàng Dự Án (Inventory)
Cung cấp công cụ check giỏ hàng nhanh trên mobile:
* Xem trực quan sơ đồ căn hộ, tình trạng trống/cọc (Availability) thời gian thực của các dự án được phân phối.
* Tra cứu nhanh giá trần, file tính mẫu lịch thanh toán để gửi khách hàng.
* **Giới hạn:** Giao diện chỉ đọc (Read-only), đối tác không được phép chỉnh sửa bảng hàng hoặc khóa căn hành chính.

### 2.3. Quản Lý Lead & Khách Hàng (Lead)
* Xem danh sách lead được chủ đầu tư cấp (nếu có) hoặc danh sách khách hàng do chính đối tác tự khai báo trên hệ thống để giữ quyền chăm sóc khách hàng.
* Theo dõi trạng thái ghi nhận hồ sơ khách hàng nhằm tránh trùng lặp khách hàng (tranh chấp phí môi giới).

### 2.4. Đăng Ký Giữ Chỗ (Booking)
* Cho phép đại lý/CTV tạo yêu cầu giữ chỗ (Booking) căn hộ trống trực tiếp trên điện thoại.
* Chức năng tải lên (Upload) hình ảnh phiếu cọc, chứng từ chuyển khoản ngân hàng và hồ sơ khách hàng (CCCD, phiếu đăng ký nguyện vọng) để chuyển tiếp cho bộ phận kế toán/CSKH duyệt.
* Theo dõi tiến độ giao dịch thời gian thực.

### 2.5. Ví Hoa Hồng Đối Tác (Commission Wallet)
* Thống kê hoa hồng tạm tính dựa trên các giao dịch giữ cọc thành công.
* Đối soát dòng tiền hoa hồng: Xem chi tiết ngày duyệt giải ngân, tỷ lệ phí môi giới nhận được theo từng dự án, và các khoản khấu trừ thuế thu nhập cá nhân (nếu có).

### 2.6. Thư Viện Tài Liệu Bán Hàng (Documents)
Kho dữ liệu số được cấu hình bởi Admin dự án để đối tác tải nhanh về tư vấn khách:
* Brochure bán hàng, hình ảnh phối cảnh, video thiết kế căn hộ mẫu.
* Bảng hàng PDF chính thức, chính sách bán hàng hiện hành.
* Bộ tài liệu hướng dẫn bán hàng (Sales Kit) và tài liệu pháp lý dự án.

### 2.7. Thông Báo Dự Án (Notification)
* Nhận thông báo đẩy tức thời khi:
  * Có chính sách bán hàng hoặc bảng giá mới được ban hành.
  * Yêu cầu đặt cọc/booking của khách hàng được duyệt thành công.
  * Có thông báo đối soát và thanh toán hoa hồng định kỳ.

---

## 3. Quản Trị Tài Khoản & Bảo Mật (Profile)
* Cập nhật thông tin đại lý/cộng tác viên, thông tin số tài khoản ngân hàng nhận hoa hồng.
* Cấu hình đổi mật khẩu và quản lý danh sách các thiết bị đăng nhập tin cậy.

---

## 4. Các Giới Hạn Nghiệp Vụ (Bản Partner không có)
Để đảm bảo an toàn thông tin nội bộ của chủ đầu tư, Partner Portal **không tích hợp** các chức năng sau:
* ❌ Điểm danh, chấm công hàng ngày (Attendance) và quản lý phép.
* ❌ Trung tâm nhiệm vụ nội bộ (Task Center) và lịch họp công ty.
* ❌ Công cụ phân Lead xoay vòng của hệ thống (chỉ nhận lead được cấp trực tiếp hoặc tự khai báo khách hàng).
* ❌ Trực quan hóa sơ đồ tổ chức phòng ban (Org Chart) của doanh nghiệp.
