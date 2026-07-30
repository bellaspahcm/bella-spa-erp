# Hướng Dẫn Liên Kết Endpoint Bella EOS với Bella EIP

Tài liệu này hướng dẫn chi tiết cách cấu hình, vận hành và xử lý sự cố kết nối giữa **Bella EOS (Enterprise Operating System)** và **Bella EIP (ERP Gateway)**, đảm bảo dữ liệu đồng bộ real-time, bộ đếm request (Request Counter / Audit Logs) hoạt động chính xác và AI Agents nhận đủ dữ liệu phân tích điều hành.

---

## 1. Yêu Cầu Trước Khi Cấu Hình

1. **Bella EIP Domain / Port**: 
   * **Môi trường Local**: Mặc định Bella EOS chạy ở cổng `3000`, Bella EIP chạy ở cổng `3001` (`http://localhost:3001`).
   * **Môi trường Production**: URL domain public (Ví dụ: `https://bella-spa-erp.vercel.app` hoặc domain tùy chỉnh).
2. **API Key Partner**: API key dạng `pk_live_...` được cấp riêng cho đối tác **BELLA EOS** trên Console EIP.

---

## 2. Bước 1: Lấy API Key Trên Console Bella EIP

1. Đăng nhập vào trang quản trị Bella EIP (`http://localhost:3001` hoặc Production URL).
2. Truy cập menu **Cấu hình hệ thống** ➔ **Đối tác API (Partner Management)**.
3. Chọn đối tác **BELLA EOS** (hoặc tạo mới với loại `Analytics` / `ERP`).
4. Tại tab **Tổng Quan**, tìm mục **Quản Lý API Key**:
   * Nhấp biểu tượng con mắt để xem hoặc bấm nút **Sao chép API Key** (`pk_live_...`).
   * Đảm bảo Trạng Thái đối tác ở mức **Hoạt Động**.

---

## 3. Bước 2: Điền Thông Tin Kết Nối Trên Bella EOS

1. Đăng nhập vào ứng dụng **Bella EOS** (`http://localhost:3000`).
2. Truy cập vào mục **Cấu hình tích hợp** ➔ **Bella EIP Link** (hoặc Cài đặt hệ thống / Settings).
3. Cấu hình 2 thông số sau:

| Trường Thông Tin | Giá Trị Cần Nhập (Local) | Giá Trị Cần Nhập (Production) |
| :--- | :--- | :--- |
| **EIP Endpoint URL** | `http://localhost:3001/api/v1/overview` | `https://<DOMAIN_EIP>/api/v1/overview` |
| **EIP API Key** | Mã API Key dạng `pk_live_...` lấy từ Bước 1 | Mã API Key dạng `pk_live_...` lấy từ Bước 1 |

> ⚠️ **Lưu ý quan trọng về Cổng kết nối (Port Management)**: 
> * Khi chạy dưới máy local, cả 2 ứng dụng đều dùng `npm run dev`. Next.js sẽ dành cổng `3000` cho EOS và tự động đẩy EIP sang cổng **`3001`**. 
> * Không nhập `localhost:3000` trong phần cài đặt EOS vì EOS sẽ gọi nhầm vào chính nó (trả về lỗi 404).

---

## 4. Bước 3: Kiểm Tra Kết Nối & Kiểm Tra Bộ Đếm Request

1. Bấm nút **"Kiểm tra kết nối Bella EIP"** trên màn hình EOS.
2. Khi kết nối thành công, EOS sẽ hiển thị thông báo màu xanh:
   ```text
   ✓ Kết nối Bella EIP thành công! HTTP 200
   Endpoint: http://localhost:3001/api/v1/overview
   HTTP Status: 200
   ```
3. Nhấp vào mục **"Xem dữ liệu trả về từ EIP"**, kết quả trả về phải dạng JSON chứa các thông số real-time từ Database:
   ```json
   {
     "success": true,
     "data": {
       "status": "active",
       "partner_id": "c9330647-9422-4d75-a7fa-32ae7efcd98e",
       "partner_name": "BELLA EOS",
       "tenant_id": "0e66365b-42b0-420e-acca-f7d7692e125e",
       "environment": "production",
       "timestamp": "2026-07-30T14:53:04.537Z",
       "customer_count": 3,
       "appointment_count": 4,
       "technician_count": 2,
       "staff_count": 11,
       "monthly_revenue": 13050000,
       "monthly_expenses": 0
     },
     "meta": {
       "request_id": "8d14e7c1-f9d6-4ee8-976e-028da3859043",
       "timestamp": "2026-07-30T14:53:04.537Z",
       "version": "v1"
     }
   }
   ```
4. Quay lại màn hình **Console Bella EIP** (Đối Tác BELLA EOS):
   * Tải lại trang (F5).
   * Kiểm tra mục **Thống Kê Nhanh**:
     * **Tổng Requests**: Nhảy lên `+1` (hoặc số request tương ứng đã bấm).
     * **Request Cuối Cùng**: Hiển thị thời gian vừa gửi request.
     * **Tỷ Lệ Lỗi**: `0%`.

---

## 5. Danh Sách Các Endpoint V1 Hỗ Trợ Tích Hợp

| Route Endpoint | Phương Thức | Mục Đích | Scopes Yêu Cầu |
| :--- | :--- | :--- | :--- |
| `/api/v1/overview` | `GET` / `POST` | Healthcheck & Lấy metrics tổng quan KTV, Khách hàng, Doanh thu | Scope công khai / `pos:read` |
| `/api/v1/analytics` | `GET` | Lấy dữ liệu dự báo & phân tích nâng cao (Executive Intelligence) | `analytics:read` |
| `/api/v1/orders` | `GET` / `POST` | Lấy danh sách hoặc đẩy đơn hàng CRM | `order:read` / `order:write` |
| `/api/v1/customers` | `GET` | Lấy danh sách hồ sơ khách hàng CRM | `pos:read` / `order:read` |

---

## 6. Kiến Trúc Luồng Dữ Liệu & Quy Chuẩn Lập Trình (Technical Standards)

### 6.1 Luồng Bảo Mật & Tách Biệt Database
* **Bảo mật tuyệt đối**: Bella EOS **không bao giờ truy cập trực tiếp vào DB của Bella EIP**.
* **Luồng giao tiếp**:
  `EOS UI / Agent Runner` ➔ `HTTP Request (Bearer Token API Key)` ➔ `EIP API Gateway (/api/v1/...)` ➔ `Xác thực API Key & Tenant ID` ➔ `EIP Internal Supabase Client` ➔ `DB Truy vấn Real-time` ➔ `Trả JSON bóc vỏ về EOS`.

### 6.2 Quy Định Vô Hiệu Hóa Cache (Bypass Next.js GET Cache)
* Tất cả cuộc gọi `fetch` từ Server-side của EOS sang EIP bắt buộc phải thêm tham số `{ cache: 'no-store' as RequestCache }`.
* **Lý do**: Next.js mặc định cache kết quả của các hàm `fetch` GET. Nếu không có `no-store`, các lần chạy quy trình tiếp theo sẽ lấy dữ liệu tĩnh cũ trong memory thay vì phát lệnh gọi mạng thực tế sang EIP.

### 6.3 Quy Định Bóc Vỏ API Response (Envelope Unwrapping)
* Phía EIP luôn đóng gói kết quả theo chuẩn: `{ success: true, data: { ... } }`.
* Phía EOS Proxy (`/api/eip/overview`) và Server Runner (`/api/orchestrator/run`) bắt buộc phải bóc lớp vỏ `.data` trước khi xử lý:
  ```typescript
  const unwrappedData = (eipJson && typeof eipJson === 'object' && 'data' in eipJson) 
    ? eipJson.data 
    : eipJson;
  ```
* Tránh lỗi đọc thuộc tính `undefined` (`liveEipData.technician_count`) hoặc bọc vỏ 2 lần (`result.data.data`).

### 6.4 Tích Hợp Song Song AI Reasoning (`/overview` + `/analytics`)
* Khi vận hành chiến dịch, Orchestrator của EOS tự động phát lệnh gọi song song:
  * `/overview`: Lấy số lượng KTV (`technician_count`), Lịch hẹn (`appointment_count`), Doanh thu (`monthly_revenue`).
  * `/analytics`: Lấy bức tranh dự báo (Revenue forecast, Operational efficiency, Customer churn, Financial health, Growth indicators).
* Toàn bộ dữ liệu này được hợp nhất thành `eipAnalytics` và nạp trực tiếp vào prompt của **AI CMO** (để đưa ra phản biện chiến lược) và **AI COO** (để phân bổ task DAG chuẩn xác).

---

## 7. Xử Lý Lỗi Thường Gặp & Incident Playbook

* **EOS báo 0 KTV mặc dù trong DB EIP có KTV**:
  - Check xem EIP URL trên EOS có trỏ nhầm sang cổng `3000` (gọi lại chính EOS) hoặc Production Vercel chưa deploy code mới không. Sửa thành `http://localhost:3001/api/v1/overview`.
  - Check xem có bị lọt lớp vỏ `.data` hay không (Xem mục 6.3).
* **Bộ đếm request vẫn bằng 0 nhưng EOS báo HTTP 200**:
  - Check EIP Endpoint URL đã bao gồm `/api/v1/overview` chưa.
  - Check định dạng IP address: PostgreSQL yêu cầu kiểu `INET` chuẩn. Hệ thống đã tự động sanitize về `NULL`.
  - Đảm bảo Supabase có Stored Procedure `public.log_api_request` với `SECURITY DEFINER`.
* **Lỗi HTTP 500 (SERVER_002 / Postgres 42804)**:
  - Do lệch kiểu trả về của Stored Procedure `validate_api_partner`. Ép kiểu `ap.partner_name::TEXT` trong migration script.
* **Lỗi HTTP 401 (AUTH_001)**: API Key không chính xác hoặc đã bị revoked. Bấm "Tạo Lại API Key" trên EIP Console và dán key mới vào EOS.
* **Lỗi HTTP 403 (AUTH_002 / AUTHZ_001 / INSUFFICIENT_PERMISSIONS)**: API Key thiếu scope (ví dụ gọi `/analytics` nhưng key không có `analytics:read`).

---

> 📖 **Tài liệu tham khảo liên quan**:
> - [Walkthrough Chi Tiết Sửa Lỗi Tích Hợp](file:///C:/Users/DELL/.gemini/antigravity-ide/brain/92dacf7a-e584-4401-bc51-53e868ddf02b/walkthrough.md)
> - [Nhật Ký Sự Cố API Gateway Counter](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/INCIDENTS/2026-07-30-api-gateway-counter-fix.md)
