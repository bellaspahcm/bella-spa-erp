# Đặc Tả Sản Phẩm: Bella EIP Workforce Portal (BEWP)
> **Bella EIP — Cổng Thông Tin Nhân Sự Tác Nghiệp Di Động**

Tài liệu này đặc tả chức năng, trải nghiệm người dùng (UX) và phân quyền tác nghiệp dành cho nhân sự trực thuộc doanh nghiệp. Giao diện được tối ưu hóa cho thiết bị di động (Mobile PWA) với triết lý: *Mở lên là làm việc được ngay.*

---

## 1. Đối Tượng Sử Dụng (Personas)
* **Nhân viên kinh doanh (Sale Agent):** Tìm kiếm, tiếp nhận lead, chăm sóc khách hàng, chốt giữ chỗ, đặt cọc trên thực địa.
* **Trưởng nhóm kinh doanh (Team Lead):** Theo dõi hiệu suất, phân chia công việc, duyệt giữ chỗ và quản lý trực dự án của đội nhóm.
* **Quản lý sàn / Giám đốc chi nhánh:** Xem báo cáo thu gọn về hiệu suất, ngày công và hoạt động bán hàng của chi nhánh.

---

## 2. 12 Phân Hệ Nghiệp Vụ Cốt Lõi (Core Modules)

### 2.1. Trang Chủ & Bản Tin Sáng (Dashboard & Daily Brief)
Màn hình đầu tiên khi mở Portal, hiển thị tổng hợp công việc ngày qua trợ lý AI:
* **Bella AI Daily Brief:** Lời chào, danh sách tóm tắt lead mới phân bổ, lịch hẹn trong ngày, cảnh báo SLA và tiến độ chỉ tiêu doanh số tháng.
* **Chỉ số nhanh:** Lead mới (số lượng), Nhiệm vụ hôm nay, Lịch hẹn tiếp theo, Hoa hồng tạm tính tháng này.

### 2.2. Trung Tâm Nhiệm Vụ (Task Center)
* Danh sách việc cần làm (To-Do list) kiểu Microsoft To-Do.
* Các nhiệm vụ gồm: Task tự tạo và Task hệ thống tự động đẩy về (Ví dụ: *"Lead mới cần liên hệ trong 15 phút"*, *"Khách hàng đến hạn đóng tiền đợt 2"*).

### 2.3. Quản Lý Lead
* Giao diện thẻ trực quan phân loại lead theo trạng thái chăm sóc (*Mới phân, Đang liên hệ, Hẹn gặp, Site visit, Chốt cọc*).
* Thao tác nhanh: Gọi điện, nhắn tin Zalo, gửi email trực tiếp trên thẻ Lead. Xin chuyển lead hoặc báo mất lead.

### 2.4. Khách Hàng & Trục Hoạt Động (Customer & Activity Stream)
* Hồ sơ khách hàng, phân khúc tài chính và nhu cầu mua hàng/dịch vụ.
* Trục thời gian hoạt động (Activity Stream) tự động ghi nhận mọi sự kiện lịch sử chăm sóc từ lead mới đến khi ký hợp đồng.

### 2.5. Lịch Làm Việc (Calendar)
* Lịch cá nhân (Lịch hẹn gặp khách, lịch dẫn khách xem căn hộ mẫu/dự án).
* Lịch hoạt động tập thể (Lịch trực ca tại sa bàn, lịch trực sự kiện mở bán, lịch đào tạo chính sách bán hàng).

### 2.6. Điểm Danh & Chấm Công (Attendance)
* Check-in / Check-out điểm danh ngày công hàng ngày.
* Điểm danh thực địa bằng GPS kết hợp quét mã QR/Bluetooth Beacon tại bàn trực/nhà mẫu để chống gian lận.

### 2.7. Bảng Hàng & Kho (Inventory - Read Only)
* Tra cứu trực quan trạng thái giỏ hàng căn hộ (Trống, Đã giữ chỗ, Đã đặt cọc, Đã bán) theo Block/Tầng hoặc kho dịch vụ/phòng trống (Spa). Chỉ hỗ trợ xem, không có quyền sửa.

### 2.8. Giao Dịch Của Tôi (My Transactions)
* Danh sách hồ sơ giao dịch do chính mình thực hiện (Giữ chỗ, Đặt cọc, Hợp đồng, Tiến độ thanh toán dòng tiền của khách).

### 2.9. Trung Tâm Phê Duyệt Hợp Nhất (Approvals)
* Màn hình duyệt nhanh dành cho các cấp quản lý (Team Lead/Manager) để duyệt giữ chỗ/đặt cọc của khách hàng, đơn xin nghỉ phép của nhân viên, kèm phản hồi khi từ chối.

### 2.10. Hiệu Suất & Thi Đua (KPI & Performance)
* **My KPI:** Tiến độ phần trăm chỉ tiêu cá nhân trong tháng.
* **Leaderboard:** Bảng xếp hạng vinh danh Top doanh số, Top cuộc gọi để thúc đẩy cạnh tranh nội bộ.

### 2.11. Hoa Hồng Cá Nhân (Commission Wallet)
* Thống kê hoa hồng cá nhân: Hoa hồng tạm tính (đã chốt cọc), Hoa hồng được duyệt chi (đã ký HĐMB), Hoa hồng thực nhận và lịch sử giao dịch.

### 2.12. Kho Tài Liệu (Documents)
* Tải nhanh tài liệu giới thiệu bán hàng (Brochure), bảng giá hiện hành, chính sách ngân hàng liên kết, hồ sơ pháp lý dự án và cẩm nang FAQs.

---

## 3. Quản Trị Hồ Sơ & Bảo Mật (Profile & Security)
* Cập nhật thông tin cá nhân, cấu hình FaceID/Vân tay để đăng nhập nhanh.
* Kích hoạt xác thực 2 lớp (2FA).
* Kiểm soát phiên đăng nhập: Xem danh sách thiết bị đang kết nối và buộc đăng xuất các thiết bị khác từ xa.

---

## 4. Khả Năng Nhúng Bella AI Everywhere
Trợ lý AI được tích hợp xuyên suốt toàn bộ các module tác nghiệp:
* Tóm tắt lịch sử khách hàng tại màn hình Chi tiết Lead.
* Soạn thảo tin nhắn Zalo/Email mẫu tại màn hình Chi tiết khách hàng.
* Gợi ý bước xử lý tiếp theo dựa trên chỉ số phản hồi của khách hàng.
