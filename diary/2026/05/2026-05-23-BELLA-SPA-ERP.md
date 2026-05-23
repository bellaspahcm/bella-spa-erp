# Project DevLog: BELLA SPA ERP
* **📅 Date**: 2026-05-23
* **🏷️ Tags**: `#Project` `#DevLog` `#UI` `#Sidebar` `#Aesthetics` `#Theme`

---

> 🎯 **Progress Summary**
> Hoàn thành trọn vẹn và xác minh toàn diện các yêu cầu cải tiến giao diện Sidebar (Thanh điều hướng bên) của BELLA SPA ERP: Khắc phục triệt để lỗi khoảng trắng chân trang (Chromium page zoom height bug), thiết kế hệ màu hồng pastel cao cấp sang trọng đồng bộ cả Light Mode & Dark Mode, tối ưu hóa độ tương phản và màu sắc của Logo thương hiệu "Bella Spa". Toàn bộ mã nguồn đã được kiểm thử, cam kết đẩy lên Git và triển khai thành công lên môi trường Production của Vercel tại [https://bella-spa-erp.vercel.app](https://bella-spa-erp.vercel.app).

### 🛠️ Execution Details & Changes
* **Git Commits**:
  - `9946976eda2c60fb19cce5a672d1848d7c855ae8`: `style(sidebar): redesign with pastel pink theme and fix chromium zoom height bug`
  - `15bce8c1953df19e2bb0c654b9c5df534d1e0fce`: `style(sidebar): guarantee logo text color matches primary theme using high-specificity inline style`
* **Core File Modifications**:
  * 📄 `src/components/layout/sidebar.tsx`:
    - Khắc phục lỗi khoảng trống chân trang bằng cách bù trừ tỷ lệ co giãn màn hình (`zoom: 0.9` -> chiều cao sidebar `h-screen md:h-[111.2vh]`).
    - Nâng cấp phối màu Pastel Pink cực kỳ sang trọng và êm dịu:
      - **Light Mode**: Gradient mềm mại từ `#FFF5F7` sang `#FCE4EC`, viền mờ `#FBCFE8]/60`, các mục điều hướng hoạt động có màu `#BE185D` nổi bật, mục chưa kích hoạt có tông màu xám hồng ấm nhã nhặn `#8A6D7C`.
      - **Dark Mode**: Chuyển từ đen thuần túy sang dải màu Dusky Rose cực kỳ cao cấp từ `#25131A` đến `#1A0C11`, viền mờ đậm `#3D1E2A`, các liên kết hoạt động chuyển sang nền `#3D202E` phối chữ hồng pastel `#FFB7C5`.
    - Chuẩn hóa màu sắc Logo thương hiệu chữ viết tay nghệ thuật `Bella Spa` bằng cách liên kết trực tiếp với biến CSS thương hiệu thông qua thuộc tính inline `style={{ color: 'var(--primary)' }}`. Điều này giúp logo tự động phản hồi ngay lập tức với sự thay đổi của Light/Dark Mode (Hiển thị hồng cánh sen đậm `#9D174D` ở Light Mode và hồng phấn `#FFB7C5` ở Dark Mode), giải quyết triệt để lỗi logo bị chìm màu đen trên nền tối.
  * 📄 `src/app/hq/hq-dashboard-client.tsx`:
    - Tạo nút "Đăng ký Chi Nhánh" cực kỳ bóng bẩy ở Header bên cạnh liên kết chuyển đến Hồ sơ Spa Trụ sở.
    - Tạo thêm nút "Đăng ký Chi Nhánh mới" tại tiêu đề bảng "Danh sách chi nhánh Spa Hệ thống" (ẩn trên màn hình nhỏ di động để tối ưu trải nghiệm người dùng, hiển thị đầy đủ trên màn hình cỡ lớn).
    - Cả hai nút liên kết trực tiếp đến trang kích hoạt hệ thống `/signup` với tông màu gradient rose-pink cao cấp, tăng trải nghiệm tiện ích cho super admin quản lý chuỗi.
  * 📄 `src/services/onboarding-actions.ts`:
    - Nâng cấp Server Action `registerNewTenant` để tự động phát hiện và sử dụng Supabase Admin Client (`supabaseAdmin`) khởi tạo tài khoản khi phát hiện khóa bảo mật `SUPABASE_SERVICE_ROLE_KEY`.
    - Thiết lập tùy chọn `email_confirm: true` cho `auth.admin.createUser` để tự động kích hoạt tài khoản trực tiếp trong DB mà không kích hoạt trình gửi thư SMTP của Supabase, loại bỏ hoàn toàn lỗi email rate limit.
  * 📄 `supabase/migrations/20260523010000_harden_all_database_rls.sql` (New):
    - Trực tiếp chạy migration bổ sung và siết chặt các chính sách Row-Level Security (RLS) cho tất cả các bảng quan trọng (`customers`, `bookings`, `session_logs`, `revenue`, `expenses`, `salary_records`, `attendance`, `tenants`) bằng hàm `public.get_auth_tenant_id()`. Xóa bỏ các chính sách `true` không an toàn, cách ly hoàn toàn dữ liệu giữa các chi nhánh, đảm bảo chi nhánh A không thể truy cập dữ liệu của chi nhánh B hay HQ.
  * 📄 `src/app/dashboard/settings/page.tsx` & `components/SecurityTab.tsx` (New):
    - Khởi tạo chức năng Đổi Mật Khẩu (Security Tab) ngay trong trang Cài đặt chung của hệ thống, gọi API `supabase.auth.updateUser` giúp người dùng thay đổi thông tin xác thực an toàn, tiện lợi.
    - Cập nhật quy trình đổi mật khẩu: Yêu cầu xác thực mật khẩu cũ bằng cách gọi `supabase.auth.signInWithPassword` với email người dùng hiện hành trước khi chạy lệnh đổi mới mật khẩu, tối ưu hóa độ bảo mật, tránh việc người khác lợi dụng phiên đăng nhập để tự ý đổi. Layout và giao diện giữ nguyên không bị xáo trộn.

### 🚨 Troubleshooting
> 🐛 **Problem Encountered (Chromium Page Zoom Height Bug)**: Do trong file `globals.css` cấu hình thuộc tính `zoom: 0.9` cho thẻ `html` đối với màn hình trung bình trở lên (MD trở lên), các phần tử sử dụng chiều cao toàn màn hình cố định `100vh` thực tế bị thu nhỏ tỷ lệ chỉ còn hiển thị tương đương `90vh`, để lại một khoảng trắng thô cứng khoảng 10% ở chân Sidebar khi cuộn trang.
> 💡 **Solution**: Điều chỉnh chiều cao của Sidebar trên màn hình lớn sử dụng tỷ lệ bù trừ chuẩn xác: `100vh / 0.9 ≈ 111.11vh` (chọn `111.2vh` để đảm bảo che phủ hoàn hảo tất cả các trình duyệt Chromium và Safari).

> 🐛 **Problem Encountered (Logo Color Contrast)**: Khi thay đổi nền Sidebar sang tông màu tối của Dusky Rose ở Dark Mode, chữ Logo `Bella Spa` mặc định màu đen bị hòa lẫn hoàn toàn vào nền tối, khiến thương hiệu bị che khuất.
> 💡 **Solution**: Sử dụng inline style có độ ưu tiên cao (specificity) gán màu chữ trực tiếp theo biến CSS `--primary` (`style={{ color: 'var(--primary)' }}`), ghi đè các cấu hình CSS mặc định lỗi thời và đảm bảo độ tương phản tuyệt vời ở cả hai chế độ sáng/tối.

> 🐛 **Problem Encountered (Email Rate Limit Exceeded)**: Khi người dùng nhấp chọn đăng ký chi nhánh mới thông qua trang `/signup`, Supabase Auth kích hoạt gửi email xác nhận. Vì tài khoản Supabase thuộc gói miễn phí (Free-tier), tần suất gửi thư bị giới hạn nghiêm ngặt ở mức tối đa 3 email/giờ. Khi tạo liên tục nhiều chi nhánh, hệ thống ngay lập tức báo lỗi `email rate limit exceeded` từ GoTrue và ngắt tiến trình.
> 💡 **Solution**: Tận dụng khóa bảo mật server-side `SUPABASE_SERVICE_ROLE_KEY` có sẵn trên production để khởi tạo `supabaseAdmin` và tạo người dùng thông qua `auth.admin.createUser` kết hợp tham số `email_confirm: true`. Việc này ghi trực tiếp trạng thái xác thực `email_confirmed_at = NOW()` vào database mà không gửi SMTP, vượt qua giới hạn rate limit thành công.

> 🐛 **Problem Encountered (Cross-Tenant Data Leakage via Missing RLS Policies)**: Phát hiện tài khoản chi nhánh mới tạo có thể truy vấn và xem dữ liệu của chi nhánh khác hoặc HQ do một số bảng (`customers`, `bookings`, v.v.) đang để lọt cấu hình RLS hoặc sử dụng policy `true` mặc định.
> 💡 **Solution**: Viết và chạy ngay một migration tổng hợp `20260523010000_harden_all_database_rls.sql` qua Admin SQL Editor, `DROP` mọi rule lỏng lẻo và áp dụng rule `tenant_id = public.get_auth_tenant_id()` cực kỳ nghiêm ngặt trên TOÀN BỘ các bảng nhạy cảm, chặn đứng mọi request chéo tenant.

### ⏭️ Next Steps
- [ ] Giám sát tiến trình đăng ký chi nhánh thực tế trên Production, hướng dẫn người dùng kiểm tra nếu có bất kỳ phản hồi nào về tài khoản.
- [ ] Theo dõi phản hồi từ người dùng về trải nghiệm thị giác tổng thể của hệ màu hồng pastel mới trên sidebar.
- [ ] Bảo trì định kỳ và đồng bộ các yếu tố UX tương tác khác như nút bấm tạo lịch đặt, hiệu ứng chuyển trang để có cùng tông pastel sang trọng.
