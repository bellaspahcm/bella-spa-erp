# 🚨 INCIDENT REPORT & PLAYBOOK: API Gateway Request Counter & Validation Fix

> **Ngày xảy ra / Xử lý**: 2026-07-30  
> **Phân hệ bị ảnh hưởng**: API Gateway / Partner Management System (`BELLA EOS ↔ BELLA EIP Integration`)  
> **Trạng thái**: ✅ Sửa chữa hoàn tất (Resolved & Verified in Production)  

---

## 1. Tóm Tắt Hiện Tượng (Symptoms)

1. **Hiện tượng 1**: Kết nối từ Bella EOS báo lỗi HTTP 500 với thông tin `Failed to validate API partner` (code `SERVER_002`, details code `42804`).
2. **Hiện tượng 2**: Sau khi sửa lỗi HTTP 500, Bella EOS gửi kết nối thành công (HTTP 200 OK), nhưng trên Console Admin Bella EIP, thẻ **Thống Kê Nhanh (Quick Stats)** vẫn hiển thị:
   - `Tổng Requests: 0`
   - `Requests Lỗi: 0`
   - `Request Cuối Cùng: Chưa có request nào`

---

## 2. Nguyên Nhân Gốc Kỹ Thuật (Root Cause Analysis)

### 🔴 Lỗi 1: PostgreSQL Error 42804 (`datatype_mismatch`)
- **Vị trí**: Stored Procedure `public.validate_api_partner(p_api_key TEXT)` trong Supabase.
- **Nguyên nhân**: Hàm khai báo `RETURNS TABLE (..., partner_name TEXT, ...)`, nhưng câu lệnh `RETURN QUERY SELECT` lấy dữ liệu trực tiếp từ cột `ap.partner_name` kiểu `VARCHAR(255)`.
- **Cơ chế lỗi**: Trong PL/pgSQL strict type checking, việc trả kiểu `VARCHAR(255)` vào biến hứng `TEXT` mà không ép kiểu thủ công (`::TEXT`) sẽ bị ném lỗi `ERROR: 42804 structure of query does not match function result type`.

### 🔴 Lỗi 2: Bộ đếm Request kẹt ở 0 do RLS & INET Syntax Error 22P02
- **Vị trí**: `logAPIRequest` trong `src/lib/middleware/api-key.middleware.ts` & Trigger `trigger_increment_api_partner_stats`.
- **Nguyên nhân A (RLS Blocking)**:
  - `logAPIRequest` ban đầu gọi `createClient()` (dùng `anon` key công khai).
  - Bảng `public.api_request_logs` bật Row Level Security (RLS) chỉ cấp quyền `INSERT` cho `service_role`. Do đó, câu lệnh insert từ middleware bị từ chối ngầm.
- **Nguyên nhân B (PostgreSQL INET 22P02)**:
  - Hàm `getClientIP(req)` trả về chuỗi `"unknown"` khi không tìm thấy header IP (`x-forwarded-for`).
  - Khi chèn chuỗi `"unknown"` vào cột `ip_address` kiểu dữ liệu `INET`, PostgreSQL báo lỗi `ERROR 22P02: invalid input syntax for type inet: "unknown"`.
- **Hậu quả kép**:
  - Việc insert dòng log vào `api_request_logs` thất bại ngầm.
  - Trigger `trigger_increment_api_partner_stats` (chạy `AFTER INSERT ON api_request_logs`) **KHÔNG BAO GIỜ ĐƯỢC KÍCH HOẠT**, khiến `api_partners.total_requests_count` kẹt ở 0.

---

## 3. Giải Pháp Kỹ Thuật & Kiến Trúc Áp Dụng (Resolution)

### 🟢 Giải pháp 1: Ép kiểu dữ liệu rõ ràng cho Stored Procedure SQL
- Cập nhật hàm `public.validate_api_partner`:
  ```sql
  SELECT 
    ap.id AS partner_id,
    ap.tenant_id AS tenant_id,
    ap.partner_name::TEXT AS partner_name, -- Ép kiểu ::TEXT an toàn
    ...
  ```
- File Migration: [`supabase/migrations/20260730120000_fix_validate_api_partner_type_mismatch.sql`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260730120000_fix_validate_api_partner_type_mismatch.sql)

### 🟢 Giải pháp 2: Xây dựng RPC `log_api_request` với `SECURITY DEFINER` & Bắt lỗi INET
- Tạo Stored Procedure `public.log_api_request(...)`:
  - Khai báo `SECURITY DEFINER` để luôn thực thi với quyền Admin (bỏ qua rào cản RLS ngầm).
  - Sử dụng khối `BEGIN ... EXCEPTION WHEN OTHERS THEN v_inet_ip := NULL; END;` khi cast IP sang `INET`.
  - Phân quyền `GRANT EXECUTE ON FUNCTION public.log_api_request TO anon, service_role;`.
- File Migration: [`supabase/migrations/20260730130000_create_log_api_request_rpc.sql`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/supabase/migrations/20260730130000_create_log_api_request_rpc.sql)

### 🟢 Giải pháp 3: Cập nhật Middleware & IP Sanitization
- Trong [`src/lib/middleware/api-key.middleware.ts`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/lib/middleware/api-key.middleware.ts):
  - Thêm hàm `isValidIP(ip)` kiểm tra định dạng IPv4/IPv6 bằng Regex.
  - Trong `logAPIRequest`, chuyển sang gọi `supabase.rpc('log_api_request', ...)` bằng `getAdminSupabaseClient()`. Nếu IP không hợp lệ (`"unknown"`), tự động xóa field `ip_address` để Supabase chèn `NULL` an toàn.

---

## 4. Hướng Dẫn Xử Lý Khi Gặp Sự Cố Tương Tự Trong Tương Lai (Playbook)

Nếu bộ đếm request API của bất kỳ đối tác nào không nhảy hoặc báo lỗi kết nối:

1. **Bước 1 (Kiểm tra Supabase RPC log_api_request)**:
   Chạy query SQL kiểm tra trực tiếp việc ghi log và trigger:
   ```sql
   SELECT public.log_api_request(
     '<PARTNER_UUID>'::UUID,
     '<TENANT_UUID>'::UUID,
     'GET',
     '/api/v1/overview',
     200,
     50,
     FALSE, NULL, NULL, '127.0.0.1', 'curl/8.0', 'test_req_001'
   );
   ```
2. **Bước 2 (Kiểm tra bảng `api_partners`)**:
   ```sql
   SELECT id, partner_name, total_requests_count, last_request_at 
   FROM public.api_partners 
   WHERE id = '<PARTNER_UUID>';
   ```
   Nếu `total_requests_count` tăng `+1`, trigger hệ thống hoàn toàn bình thường.
3. **Bước 3 (Kiểm tra IP Sanitization)**:
   Đảm bảo các hàm ghi log không bao giờ truyền chuỗi ngẫu nhiên (ví dụ `"unknown"`, `"localhost"`) vào cột có kiểu `INET` trong PostgreSQL. Always sanitize sang `NULL` / `undefined`.

---
*Tài liệu được cập nhật tự động vào hệ thống Knowledge Storage Process của Bella ERP.*
