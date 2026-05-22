# Project DevLog: BELLA SPA ERP
* **📅 Date**: 2026-05-21
* **🏷️ Tags**: `#Project` `#DevLog`

---

> 🎯 **Progress Summary**
> Vá thành công các lỗ hổng bảo mật nghiêm trọng liên quan đến RLS bằng hàm SECURITY DEFINER và tích hợp Rate Limiting chống spam đặt lịch sử dụng Token Bucket an toàn.

### 🛠️ Execution Details & Changes
* **Git Commits**: (N/A)
* **Core File Modifications**:
  * 📄 `supabase/migrations/20260521000004_harden_rls_and_tenant.sql`: Tạo hàm helper phòng chống đệ quy RLS, bật RLS và thiết lập policy cho bảng `customers`, `users`, và `salary_records`, hardening policy `Guest tạo bookings`.
  * 📄 `src/modules/booking/actions/lifecycle-actions.ts`: Tích hợp rate limit thuật toán Token Bucket dựa trên Client IP (5 requests / 10 phút) vào Server Action `createBooking` kèm cơ chế fallback an toàn.
  * 📄 `src/__tests__/rate-limit.test.ts`: Viết các test case độc lập bằng Jest để kiểm thử tính chính xác của thuật toán Token Bucket (depletion, refill, cap, isolation).
* **Technical Implementation**:
  - Triển khai thành công các hàm `SECURITY DEFINER` (`is_admin()`, `get_auth_tenant_id()`, `is_valid_tenant()`) chạy với đặc quyền admin để triệt tiêu lỗi vòng lặp đệ quy RLS (Infinite Recursion Loop) trong PostgreSQL khi các chính sách bảo mật truy vấn dữ liệu từ chính bảng đó.
  - Sử dụng dynamic `await import('next/headers')` và `await import('@/lib/rate-limit')` để đọc IP Client qua headers Next.js (`x-forwarded-for`/`x-real-ip`) phục vụ giới hạn lượt request an toàn.

### 🚨 Troubleshooting
> 🐛 **Problem Encountered**: PowerShell Execution Policy ngăn cản chạy lệnh `npm run test` (lỗi không load được `npm.ps1`).
> 💡 **Solution**: Chạy trực tiếp qua `npm.cmd run test` hoặc `npm.cmd run build` trên môi trường Windows PowerShell.

### ⏭️ Next Steps
- [ ] Giám sát nhật ký hoạt động hệ thống (Vercel Serverless Logs) để theo dõi các hành vi đặt lịch spam.
- [ ] Tiếp tục duy trì thói quen bật RLS khi tạo bảng mới chứa thông tin nhạy cảm.
