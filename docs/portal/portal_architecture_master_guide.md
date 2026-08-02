# Bản Thiết Kế Tổng Thể: Portal Architecture & Product Specifications Suite
> **Bella EIP — Cổng Thông Tin Tác Nghiệp & Đối Tác Hợp Nhất**

Tài liệu này đóng vai trò là kiến trúc thượng tầng (Master Blueprint), đặc tả cấu trúc phân tách ba lớp giao diện người dùng và định hướng phân chia bộ tài liệu kỹ thuật trong hệ sinh thái Bella EIP.

---

## 1. Kiến Trúc Ba Lớp Giao Diện Người Dùng (3-Tier UI Architecture)

Để đảm bảo hiệu năng tối ưu, tính bảo mật dữ liệu và trải nghiệm người dùng gọn nhẹ, Bella EIP phân tách hệ thống thành 3 cổng giao tiếp hoàn toàn độc lập:

```
                          ┌──────────────────────────────┐
                          │     ERP DESKTOP CONSOLE      │
                          │ (Back-office / Admin / HQ)   │
                          └──────────────▲───────────────┘
                                         │
                  ┌──────────────────────┴──────────────────────┐
                  │                                             │
   ┌──────────────┴──────────────┐               ┌──────────────┴──────────────┐
   │    WORKFORCE PORTAL (PWA)   │               │     PARTNER PORTAL (PBP)    │
   │ (Employee & Field Managers) │               │ (Agencies / Brokers / Affs) │
   └─────────────────────────────┘               └─────────────────────────────┘
```

### 1.1. ERP Desktop Console (Hệ thống Quản trị Trung tâm)
* **Đối tượng:** Ban giám đốc, Kế toán, Nhân sự, Pháp lý, Admin hệ thống.
* **Đặc tính:** Giao diện Desktop Web đầy đủ tính năng, là trung tâm cấu hình và ra quyết định.
* **Phạm vi nghiệp vụ:** Cấu hình hệ thống, quản lý dự án, bảng hàng gốc, đối soát kế toán tài chính, phê duyệt giải ngân hoa hồng, tính lương nhân sự, thiết lập workflow phê duyệt và các báo cáo điều hành vĩ mô (BI Dashboards).

### 1.2. Workforce Portal (Cổng Tác Nghiệp Nội Bộ)
* **Đối tượng:** Nhân viên kinh doanh (Sale Agent), Trưởng nhóm kinh doanh (Team Lead), Giám đốc sàn.
* **Đặc tính:** Mobile PWA siêu nhẹ, hỗ trợ Bella AI nhúng sâu và Daily Brief cá nhân hóa.
* **Đặc tả chi tiết:** Xem tại [workforce_portal_specification.md](file:///C:/Users/DELL/.gemini/antigravity-ide/brain/fc236180-f5c5-4fcc-849b-6cd8d80a3e2d/workforce_portal_specification.md).

### 1.3. Partner Portal (Cổng Giao Tiếp Đối Tác Ngoài)
* **Đối tượng:** Đại lý phân phối F1/F2, Môi giới liên kết độc lập, Cộng tác viên (CTV).
* **Đặc tính:** Giao diện tối giản tập trung hoàn toàn vào tra cứu giỏ hàng, đặt giữ chỗ, upload chứng từ cọc và theo dõi ví hoa hồng đại lý.
* **Đặc tả chi tiết:** Xem tại [partner_portal_specification.md](file:///C:/Users/DELL/.gemini/antigravity-ide/brain/fc236180-f5c5-4fcc-849b-6cd8d80a3e2d/partner_portal_specification.md).

---

## 2. Bản Đồ Phân Chia Tài Liệu Kỹ Thuật (7-Document Partitioning)

Nhằm đảm bảo dự án có thể vận hành và bảo trì trong chu kỳ 10–20 năm, toàn bộ thiết kế hệ thống được phân tách thành 7 tập tài liệu độc lập, tránh hiện tượng chồng chéo thông tin:

```
                            [Master Suite Guide]
                                     │
       ┌───────────┬───────────┬─────┴─────┬───────────┬───────────┐
       ▼           ▼           ▼           ▼           ▼           ▼
   [Product]   [UI/UX]     [Backend]   [Database]  [Security]  [Offline]
```

### 1. Đặc Tả Sản Phẩm (Product Specification)
* **Trách nhiệm:** Định nghĩa đối tượng sử dụng (Personas), mô tả 12 phân hệ của Workforce Portal, 7 phân hệ của Partner Portal, phân quyền tác nghiệp và luồng màn hình thao tác của người dùng.
* **Tài liệu tham chiếu:** [workforce_portal_specification.md](file:///C:/Users/DELL/.gemini/antigravity-ide/brain/fc236180-f5c5-4fcc-849b-6cd8d80a3e2d/workforce_portal_specification.md) và [partner_portal_specification.md](file:///C:/Users/DELL/.gemini/antigravity-ide/brain/fc236180-f5c5-4fcc-849b-6cd8d80a3e2d/partner_portal_specification.md).

### 2. Đặc Tả Thiết Kế UI/UX (UI/UX Design Specification)
* **Trách nhiệm:** Định nghĩa hệ thống lưới (Layout Grid), Design System (Color, Typography, Tokens), các trạng thái Component di động (Active, Empty, Loading, Error) và tiêu chuẩn tiếp cận (Accessibility).

### 3. Đặc Tả Backend API (Backend API Specification)
* **Trách nhiệm:** Định nghĩa chi tiết các Endpoint RESTful (OpenAPI/Swagger), cấu trúc dữ liệu gửi/nhận (DTOs), các sự kiện nghiệp vụ (Event-Driven Bus) và các quy tắc kiểm tra tính hợp lệ của dữ liệu (Validation Rules).

### 4. Thiết Kế Cơ Sở Dữ Liệu (Database Design)
* **Trách nhiệm:** Sơ đồ quan hệ thực thể (ERD), cấu trúc bảng, kiểu dữ liệu, các ràng buộc toàn vẹn dữ liệu (Constraints) và thiết kế Index tối ưu hiệu năng truy vấn lớn.

### 5. Kiến Trúc Bảo Mật (Security Architecture)
* **Trách nhiệm:** Cơ chế xác thực tập trung (Auth), phân quyền truy cập nâng cao (RBAC & RLS đệ quy theo cây tổ chức), nhật ký kiểm toán (Audit Logs), bảo mật thiết bị tin cậy và quản lý phiên hoạt động (Sessions).

### 6. Kiến Trúc Đồng Bộ Ngoại Tuyến (Offline Architecture)
* **Trách nhiệm:** Cơ chế lưu trữ đệm IndexedDB tại trình duyệt di động, cấu trúc hàng đợi đồng bộ (Sync Queue), và thuật toán xử lý xung đột dữ liệu (Conflict Resolution) khi thiết bị kết nối mạng trở lại.

### 7. Đặc Tả Năng Lực AI (AI Capability Specification)
* **Trách nhiệm:** Đặc tả kỹ thuật các tác vụ AI nghiệp vụ: tạo Daily Brief mỗi sáng, tóm tắt lịch sử Lead, hỗ trợ viết tin nhắn/email chăm sóc khách hàng, chấm điểm chốt giao dịch và phát hiện rủi ro chậm trễ chăm sóc.
