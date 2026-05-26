# Project DevLog: BELLA SPA ERP
* **📅 Date**: 2026-05-27
* **🏷️ Tags**: `#Project` `#DevLog` `#UX` `#Landing` `#Select` `#CSS` `#Layout` `#HQ` `#Contrast` `#Theme`

---

> 🎯 **Progress Summary**
> Đồng bộ hóa thành công danh sách tùy chọn của bộ chọn dịch vụ (`PremiumSelect`) trên biểu mẫu đăng ký tư vấn ("Hình 2") với các gói dịch vụ hiển thị ở bảng giá ("Hình 1") bằng cách sử dụng `useMemo` tính toán động từ `categories || serviceCategories`. Khắc phục triệt để lỗi tràn nội dung nhãn dài bằng Flexbox `min-w-0` và `shrink-0`. Ngoài ra, tối ưu hóa toàn diện giao diện trang Quản trị Cấp cao (HQ): nâng cấp độ tương phản vượt trội cho hộp thông tin gói dịch vụ & định mức hệ thống, đồng thời tích hợp trực tiếp công cụ chuyển đổi giao diện sáng/tối (`ThemeToggle`) lên thanh tiêu đề chính (mặc định là giao diện sáng), đảm bảo chất lượng hình ảnh sắc nét và tính tương thích tối đa.

### 🛠️ Execution Details & Changes
* **Git Commits**:
  - `192317bdf7538ec91bc31289139589d98f7318ec`: `fix(landing): dynamically synchronize consultation form dropdown options with selected landing packages to improve UX`
  - `5da94acf1ca7a27fa4b1b369fcd9a39783f06e57`: `fix(select): add min-w-0 on flex containers and shrink-0 on icons in PremiumSelect to prevent text overflow`
  - `52343c7df194f4bf12fb87d4681329c0fefef17e`: `fix(hq): resolve low text contrast in packages box and integrate ThemeToggle into header`
* **Core File Modifications**:
  * 📄 `src/app/page.tsx`:
    - Loại bỏ danh sách tĩnh và lỗi thời `serviceOptions` bị mã hóa cứng ở đầu component.
    - Định nghĩa lại `serviceOptions` động bằng `useMemo`, liên kết trực tiếp với dữ liệu `categories || serviceCategories` để luôn đồng nhất 100% với các thẻ gói dịch vụ đang được hiển thị thực tế (bất kể là dữ liệu tĩnh dự phòng hay được nạp động từ database Supabase).
    - Đồng bộ hóa các thao tác click đặt lịch hoặc đề xuất từ Service Wizard để tự động hiển thị chính xác trạng thái đã chọn trên bộ chọn `PremiumSelect` mà không yêu cầu khách chọn lại.
    - Nhập `useMemo` từ thư viện `'react'`.
  * 📄 `src/components/ui/PremiumSelect.tsx`:
    - Bổ sung `min-w-0` vào các thẻ div phân bổ theo Flexbox (`flex items-center gap-3 min-w-0`) ở cả nhãn hiển thị chính lẫn danh sách tùy chọn thả xuống (grouped & non-grouped).
    - Thêm thuộc tính `shrink-0` vào các biểu tượng `ChevronDown`, `Check` và icon tiền tố để cố định kích thước biểu tượng khi tiêu đề dài.
    - Định dạng `span` hiển thị nhãn trong danh sách thả xuống sử dụng thuộc tính `truncate` để kích hoạt dấu ba chấm `...` khi nội dung vượt quá giới hạn chiều rộng hộp chứa.
  * 📄 `src/app/hq/hq-dashboard-client.tsx`:
    - Nhập cấu trúc chuyển đổi giao diện `ThemeToggle` trực tiếp từ component chung.
    - Bố trí `ThemeToggle` lồng ghép khéo léo vào khu vực chức năng ở đầu thanh điều hướng (header) bên cạnh các nút đồng bộ và đăng xuất để người dùng thuận tiện chuyển đổi Light/Dark mode.
    - Cập nhật các biến CSS màu nền và chữ hỗ trợ chế độ tối (`dark:bg-[#11100F]`, `dark:bg-[#1C1B19]`, `dark:text-[#EFE9E1]`, `dark:text-[#CDBCAB]`) cho toàn bộ khung sườn trang HQ.
    - Khắc phục triệt để lỗi tương phản kém tại hộp thông tin gói dịch vụ & định mức hệ thống: điều chỉnh màu chữ tiêu đề, tăng độ đậm nhãn mô tả (`text-slate-500` ở light mode và `dark:text-[#CDBCAB]` ở dark mode), đồng thời tái thiết kế màu chữ các chỉ số giới hạn trong ca làm việc (`dark:text-[#EFE9E1]` và `dark:text-rose-400`) hiển thị cực kỳ rõ nét trên cả hai chế độ sáng tối.

### 🚨 Troubleshooting
> 🐛 **Problem Encountered (Missing Package Match)**: Khi khách hàng nhấp vào nút "Đặt lịch gói này ngay" hoặc sử dụng công cụ tư vấn đề xuất liệu trình và chuyển sang biểu mẫu tư vấn, bộ chọn dịch vụ "Dịch vụ quan tâm" vẫn trống và hiển thị placeholder mặc định `-- Chọn gói chăm sóc --`.
> 💡 **Solution**: Chuyển đổi `serviceOptions` từ tĩnh sang động bằng `useMemo` dựa trên `categories || serviceCategories` để đảm bảo tên giá trị của gói luôn trùng khớp tuyệt đối, giúp `PremiumSelect` tìm thấy và hiển thị tự động chính xác gói đã chọn.

> 🐛 **Problem Encountered (Text Overflow Bug)**: Một số gói dịch vụ có tên quá dài kèm giá tiền (ví dụ: `Combo Mẹ & Bé Hạnh Phúc (12.600.000đ)`) bị hiển thị tràn ra ngoài viền tròn của nút bấm bộ chọn `PremiumSelect` ở phần form, đè lên các cột kế bên.
> 💡 **Solution**: Trong Flexbox, các flex items mặc định có `min-width: auto`, ngăn chặn cơ chế `truncate` / `text-overflow: ellipsis` của thẻ con. Đã giải quyết triệt để bằng cách áp dụng `min-w-0` trên div cha bọc văn bản và `shrink-0` cho các biểu tượng lân cận.

> 🐛 **Problem Encountered (Low Text Contrast in HQ)**: Khi ở chế độ tối của bảng điều khiển cấp cao HQ, toàn bộ phần nhãn văn bản của gói dịch vụ & định mức bị chìm hoặc hiển thị đen kịt trên nền tối do ép thuộc tính màu chữ tĩnh của giao diện sáng (`text-slate-800`, `text-slate-600`), gây vô hình cho người dùng. Phần tiêu đề mô tả trên nền trắng cũng có tương phản quá kém.
> 💡 **Solution**: Bổ sung hệ mã màu tương phản hoàng gia Deep Velvet cho chế độ tối, chuyển đổi các giá trị văn bản sang `dark:text-[#EFE9E1]` và nhãn mô tả sang `dark:text-[#CDBCAB]`. Tích hợp trực tiếp công cụ `ThemeToggle` lên header để cho phép người dùng tùy chọn bật tắt giao diện sáng/tối dễ dàng theo nhu cầu.

### ⏭️ Next Steps
- [ ] Tiếp tục theo dõi phản hồi thực tế từ khách hàng về giao diện đặt lịch.
- [ ] Kiểm thử kỹ lưỡng hành vi đặt lịch trên các thiết bị di động để đảm bảo độ mượt mà khi cuộn và hiệu năng chuyển trang.
