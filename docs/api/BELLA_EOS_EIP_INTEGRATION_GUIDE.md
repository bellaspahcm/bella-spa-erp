# Hướng Dẫn Liên Kết Endpoint Bella EOS với Bella EIP

Tài liệu này hướng dẫn chi tiết cách cấu hình và kiểm tra kết nối giữa **Bella EOS** và **Bella EIP (ERP Gateway)**, đảm bảo dữ liệu đồng bộ và bộ đếm request (Request Counter / Audit Logs) hoạt động chính xác.

---

## 1. Yêu Cầu Trước Khi Cấu Hình

1. **Bella EIP Domain**: URL trang EIP của bạn (Ví dụ: `https://bella-spa-erp.vercel.app` hoặc domain tùy chỉnh).
2. **API Key Partner**: API key dạng `pk_live_...` được cấp riêng cho đối tác **BELLA EOS** trên Console EIP.

---

## 2. Bước 1: Lấy API Key Trên Console Bella EIP

1. Đăng nhập vào trang quản trị Bella EIP.
2. Truy cập menu **Cấu hình hệ thống** ➔ **Đối tác API (Partner Management)**.
3. Chọn đối tác **BELLA EOS** (hoặc tạo mới với loại `Analytics` / `ERP`).
4. Tại tab **Tổng Quan**, tìm mục **Quản Lý API Key**:
   * Nhấp biểu tượng con mắt để xem hoặc bấm nút **Sao chép API Key** (`pk_live_...`).
   * Đảm bảo Trạng Thái đối tác ở mức **Hoạt Động**.

---

## 3. Bước 2: Điền Thông Tin Kết Nối Trên Bella EOS

1. Đăng nhập vào ứng dụng **Bella EOS**.
2. Truy cập vào mục **Cấu hình tích hợp** ➔ **Bella EIP Link**.
3. Cấu hình 2 thông số sau:

| Trường Thông Tin | Giá Trị Cần Nhập | Ví Dụ |
| :--- | :--- | :--- |
| **EIP Endpoint URL** | `https://<DOMAIN_EIP>/api/v1/overview` | `https://bella-spa-erp.vercel.app/api/v1/overview` |
| **EIP API Key** | Mã API Key dạng `pk_live_...` lấy từ Bước 1 | `pk_live_68f8a9c2...46e9` |

> ⚠️ **Lưu ý quan trọng**: Đường dẫn Endpoint bắt buộc phải kết thúc bằng `/api/v1/overview` để gọi đúng API Gateway Healthcheck. Không nhập email hoặc domain không có `/api/v1/...`.

---

## 4. Bước 3: Kiểm Tra Kết Nối & Kiểm Tra Bộ Đếm Request

1. Bấm nút **"Kiểm tra kết nối Bella EIP"** trên màn hình EOS.
2. Khi kết nối thành công, EOS sẽ hiển thị thông báo màu xanh:
   ```text
   ✓ Kết nối Bella EIP thành công! HTTP 200
   Endpoint: https://bella-spa-erp.vercel.app/api/v1/overview
   HTTP Status: 200
   ```
3. Nhấp vào mục **"Xem dữ liệu trả về từ EIP"**, kết quả trả về phải dạng JSON:
   ```json
   {
     "success": true,
     "data": {
       "status": "active",
       "partner_name": "BELLA EOS",
       "tenant_id": "tenant-uuid-1234",
       "environment": "production",
       "timestamp": "2026-07-30T11:08:00.000Z"
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

| Route Endpoint | Phương Thức | Mục Đích |
| :--- | :--- | :--- |
| `/api/v1/overview` | `GET` / `POST` | Healthcheck connection & Ghi nhận log request counter |
| `/api/v1/orders` | `GET` / `POST` | Lấy danh sách hoặc đẩy đơn hàng |
| `/api/v1/ai/coo-orchestrator` | `POST` | Gửi chỉ thị cho AI COO điều hành |

---

## 6. Xử Lý Lỗi Thường Gặp & Incident Playbook

* **Bộ đếm vẫn bằng 0 nhưng EOS báo HTTP 200**:
  - Check EIP Endpoint URL đã bao gồm `/api/v1/overview` chưa.
  - Check định dạng IP address: PostgreSQL yêu cầu kiểu `INET` chuẩn (không truyền chuỗi `"unknown"`). Hệ thống đã tự động sanitize về `NULL`.
  - Đảm bảo Supabase có Stored Procedure `public.log_api_request` với `SECURITY DEFINER` (Xem file migration `20260730130000_create_log_api_request_rpc.sql`).
* **Lỗi HTTP 500 (SERVER_002 / Postgres 42804)**:
  - Do lệch kiểu trả về của Stored Procedure `validate_api_partner`. Đã được sửa bằng cách ép kiểu `ap.partner_name::TEXT` trong file migration `20260730120000_fix_validate_api_partner_type_mismatch.sql`.
* **Lỗi HTTP 401 (AUTH_001)**: API Key không chính xác hoặc đã bị revoked. Bấm "Tạo Lại API Key" trên EIP Console và dán key mới vào EOS.
* **Lỗi HTTP 403 (AUTH_002 / AUTHZ_001)**: Đối tác đang ở trạng thái Inactive hoặc IP gửi request không nằm trong danh sách Whitelist IP.

> 📖 **Xem Nhật Ký Sự Cố Chi Tiết**: [docs/INCIDENTS/2026-07-30-api-gateway-counter-fix.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/INCIDENTS/2026-07-30-api-gateway-counter-fix.md)
