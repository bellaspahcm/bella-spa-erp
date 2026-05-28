# Bella Spa ERP - Franchise & Multi-Branch Expansion Blueprint

Tài liệu này xác lập cấu trúc kiến trúc, sự thay đổi mô hình dữ liệu, quy trình nghiệp vụ và phân quyền để làm tiền đề mở rộng hệ thống **Bella Spa ERP** từ mô hình đơn lẻ (Single Spa) sang mô hình **Chuỗi chi nhánh (Multi-branch)** và **Nhượng quyền thương hiệu (Franchise)**.

---

## 🏗️ 1. GENETICS & READINESS (TÍNH SẴN SÀNG CỦA HỆ THỐNG)

Hệ thống Bella Spa ERP đã được thiết kế nguyên bản với triết lý **Multi-Tenant (Đa khách thuê)**. Hầu hết các bảng dữ liệu cốt lõi đều sở hữu thuộc tính `tenant_id (UUID)`, đây là cơ sở pháp lý và công nghệ giúp phân tách dữ liệu tuyệt đối giữa các đơn vị mà không cần thay đổi cấu trúc cốt lõi.

### Trọng tâm sẵn có:
1. **Bảng `TENANTS`:** Đã được thiết kế sẵn để lưu trữ thông tin thực thể kinh doanh (chi nhánh hoặc hộ nhượng quyền).
2. **Cơ chế phân tách Tenant:** `tenant_id` được gán vào session người dùng ngay khi đăng nhập, hoạt động như một bộ lọc tự động trong các truy vấn cơ sở dữ liệu.

---

## 📊 2. THAY ĐỔI CẤU TRÚC DỮ LIỆU (DATABASE EXTENSIONS)

Để đáp ứng mô hình nhượng quyền, mô hình dữ liệu phẳng cần chuyển dịch sang mô hình **Phân cấp cây (Hierarchical Tree)**:

### 2.1 Cấu trúc Phân cấp bảng `tenants`
Mở rộng bảng `tenants` để hỗ trợ quan hệ cha-con và các điều khoản hợp đồng nhượng quyền:
* `id (UUID)`: Khóa chính.
* `name (VARCHAR)`: Tên chi nhánh / Tên pháp nhân nhượng quyền.
* `parent_tenant_id (UUID, FK -> tenants.id)`: Trường tự tham chiếu đến Tenant gốc (Tổng công ty - HQ). Nếu null, thực thể đó là HQ.
* `royalty_rate (DECIMAL(5,2))`: Phần trăm phí nhượng quyền hàng tháng trích từ doanh thu (ví dụ: `5.00` tương đương 5%).
* `franchise_agreement_date (DATE)`: Ngày ký kết hợp đồng nhượng quyền.
* `status (VARCHAR)`: Trạng thái hoạt động (`active` | `suspended` - tạm dừng do chậm đóng phí | `terminated` - hủy hợp đồng).

### 2.2 Địa phương hóa Bảng Giá Gói Dịch vụ
Tách biệt giá dịch vụ gốc của thương hiệu và giá bán lẻ thực tế tại địa phương thông qua bảng liên kết trung gian:

#### Bảng `tenant_packages` (Bảng giá chi nhánh):
```sql
id (UUID)
tenant_id (UUID, FK -> tenants.id)
package_id (UUID, FK -> packages.id)
local_price (DECIMAL) -- Giá bán thực tế của gói tại chi nhánh này
local_ktv_commission (DECIMAL) -- Hoa hồng KTV tương ứng tại chi nhánh này
is_active (BOOLEAN)
```
* **Ý nghĩa:** HQ giữ quyền định nghĩa cấu trúc gói dịch vụ (số buổi, vật tư tiêu hao tiêu chuẩn), nhưng các chi nhánh nhượng quyền được phép tùy biến giá bán lẻ và mức chiết khấu KTV phù hợp với mặt bằng kinh tế khu vực.

### 2.3 Phân rã Kho Vật tư (`inventory_items`)
* Trường `tenant_id` trong bảng `inventory_items` được sử dụng để cô lập tuyệt đối kho vật lý của từng chi nhánh.
* Quy trình trigger tự động trừ vật tư (`trigger_deduct_inventory_on_session_complete`) sẽ chỉ tra cứu định mức tiêu hao và trừ trực tiếp vào các mặt hàng thuộc cùng `tenant_id` thực hiện ca chăm sóc.

---

## 🔄 3. QUY TRÌNH NGHIỆP VỤ LIÊN CHI NHÁNH (PROCESS FLOWS)

### 3.1 Quy trình Bù trừ Tài chính khi tiêu dùng Liên chi nhánh (Inter-branch Redemption)
* **Tình huống:** Khách hàng mua gói liệu trình 15 buổi tắm bé tại Chi nhánh A (Doanh thu đã thu về Chi nhánh A), nhưng đến buổi thứ 5, khách hàng chuyển nơi ở và muốn thực hiện buổi tiếp theo tại Chi nhánh B.
* **Quy trình xử lý:**
  1. Chi nhánh B quét mã QR thẻ liệu trình của khách trên Customer Portal.
  2. Hệ thống kiểm tra tính hợp lệ của Booking tại chi nhánh A.
  3. Chi nhánh B thực hiện ca dịch vụ và nhấn **Hoàn thành**. Hệ thống ghi nhận session log có `tenant_id = Chi nhánh B` nhưng liên kết với `booking.tenant_id = Chi nhánh A`.
  4. Cuối tháng, hệ thống tự động chạy đối soát bù trừ nội bộ: **Chi nhánh A phải chuyển khoản thanh toán giá trị 1 ca thực tế cho Chi nhánh B** (theo đơn giá nội bộ được HQ quy định).

### 3.2 Quy trình Tính Phí Nhượng quyền tự động (Automated Royalty Processing)
* **Tần suất:** Hằng tháng (Vào ngày khóa sổ tài chính).
* **Quy trình xử lý:**
  1. Hệ thống tự động tính toán tổng doanh thu thực thu đã xác nhận (`status = confirmed`) trong bảng `revenue` của chi nhánh con.
  2. Áp dụng công thức: 
     $$\text{Phí nhượng quyền} = \text{Tổng Doanh thu thực thu} \times \text{Tỷ lệ Royalty Rate} (\%)$$
  3. Hệ thống tự động tạo một phiếu đề nghị thanh toán (Invoice) chuyển trực tiếp đến bảng điều khiển của Chủ chi nhánh con và gửi thông báo về HQ để theo dõi công nợ nhượng quyền.

### 3.3 Quy trình Chuyển kho Nội bộ (Supply Chain & Transfer Orders)
* Chi nhánh con không được phép tự ý sửa đổi số lượng tồn kho tăng lên mà không có chứng từ chứng minh nguồn gốc từ HQ (để đảm bảo chất lượng nguyên liệu chuẩn thương hiệu):
  1. Chi nhánh con tạo **Đơn yêu cầu cấp vật tư (Inventory Request)** trên hệ thống.
  2. Hệ thống chuyển yêu cầu đến bộ phận Kho vận của HQ.
  3. HQ duyệt, đóng gói và xuất kho tổng kèm mã vận đơn chuyển kho nội bộ.
  4. Khi hàng đến cơ sở, Admin chi nhánh con xác nhận **Đã nhận đủ hàng**, hệ thống tự động tăng số lượng tồn kho của chi nhánh con tương ứng và trừ kho tổng HQ.

---

## 🔐 4. PHÂN QUYỀN HỆ THỐNG ĐA CHI NHÁNH (RBAC SPECIFICATION)

Cấu trúc phân quyền mới mở rộng phạm vi kiểm soát theo từng tầng quản trị:

| Vai trò (Role) | Phạm vi truy cập (Data Scope) | Các nghiệp vụ được phép thực hiện |
| :--- | :--- | :--- |
| **Super Admin (Tổng công ty - HQ)** | Toàn hệ thống (Mọi Tenant) | - Xem báo cáo doanh thu P&L hợp nhất toàn quốc.<br>- Phê duyệt tạo chi nhánh mới, điều chỉnh tỷ lệ phí nhượng quyền.<br>- Quản lý danh mục gói dịch vụ gốc (`packages`).<br>- Định cấu hình quy trình tiêu hao nguyên vật liệu chuẩn. |
| **Branch Admin / Franchisee (Chủ chi nhánh)** | Chỉ trong phạm vi Chi nhánh (`tenant_id` của mình) | - Quản lý nhân viên, kỹ thuật viên thuộc cơ sở.<br>- Xem báo cáo tài chính P&L riêng của chi nhánh.<br>- Duyệt đối soát lương và KPI thưởng KTV của chi nhánh.<br>- Tạo yêu cầu nhập kho vật tư từ HQ. |
| **Branch Accountant / Staff (Lễ tân, kế toán)** | Chỉ trong phạm vi Chi nhánh (`tenant_id` của mình) | - Thực hiện đặt lịch hẹn, check-in/out, thu tiền mặt/chuyển khoản của khách tại cơ sở.<br>- Ghi nhận các phiếu chi chi phí vận hành cơ sở.<br>- Kiểm kho thực tế tại cơ sở hằng tuần. |
| **Kỹ thuật viên (KTV)** | Chỉ cá nhân KTV | - Xem lịch làm việc cá nhân được phân bổ.<br>- Thực hiện check-in/out và điền nhật ký chăm sóc cho ca làm việc.<br>- Theo dõi hoa hồng tích lũy và bảng xếp hạng thi đua cá nhân. |

---

## 📅 5. LỘ TRÌNH TRIỂN KHAI MỞ RỘNG (EXPANSION ROADMAP)

Để đưa hệ thống hiện tại lên quy mô chuỗi nhượng quyền, dự kiến cần trải qua 3 giai đoạn chính:

### Giai đoạn 1: Chuẩn hóa Hạ tầng & RLS (2 - 3 Tuần)
* Kích hoạt thuộc tính RLS trên toàn bộ 16 bảng của Supabase với điều kiện ràng buộc nâng cao:
  `USING (tenant_id = auth.jwt() ->> 'tenant_id')` hoặc cho phép các tài khoản có `role = 'super_admin'` đi qua bộ lọc.
* Triển khai giao diện quản lý danh sách chi nhánh dành riêng cho Super Admin tại HQ.

### Giai đoạn 2: Tích hợp Tài chính & Kho liên chi nhánh (3 - 4 Tuần)
* Xây dựng module đối soát bù trừ liên chi nhánh (Inter-branch clearing engine).
* Viết script PostgreSQL cron-job hoặc Edge Function tự động chốt doanh thu và tạo hóa đơn thu phí nhượng quyền (`Royalty Invoices`) vào ngày 1 hàng tháng.
* Thiết lập quy trình luân chuyển kho nội bộ (Transfer Orders).

### Giai đoạn 3: Kiểm thử & Phân tách Thương hiệu (1 - 2 Tuần)
* Chạy thử nghiệm giả lập (Simulation) với 1 Tổng công ty và 2 chi nhánh con hoạt động song song.
* Kiểm thử khả năng chịu tải, tính bảo mật cách ly dữ liệu và hiệu năng phân tích P&L tích hợp.
* Triển khai thực tế cho chi nhánh nhượng quyền đầu tiên.
