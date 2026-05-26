# Project DevLog: BELLA SPA ERP
* **📅 Date**: 2026-05-27
* **🏷️ Tags**: `#Project` `#DevLog` `#UX` `#Landing` `#Select` `#CSS` `#Layout`

---

> 🎯 **Progress Summary**
> Đồng bộ hóa thành công danh sách tùy chọn của bộ chọn dịch vụ (`PremiumSelect`) trên biểu mẫu đăng ký tư vấn ("Hình 2") với các gói dịch vụ hiển thị ở bảng giá ("Hình 1") bằng cách sử dụng `useMemo` tính toán động từ `categories || serviceCategories`. Đồng thời khắc phục triệt để lỗi tràn nội dung (text overflow) của các tùy chọn có nhãn dài bằng việc tinh chỉnh cấu trúc flexbox và áp dụng cơ chế tự động hiển thị dấu ba chấm (`truncate`), nâng cao tối đa tính chuyên nghiệp và trải nghiệm người dùng trên Landing Page.

### 🛠️ Execution Details & Changes
* **Git Commits**:
  - `192317bdf7538ec91bc31289139589d98f7318ec`: `fix(landing): dynamically synchronize consultation form dropdown options with selected landing packages to improve UX`
  - `5da94acf1ca7a27fa4b1b369fcd9a39783f06e57`: `fix(select): add min-w-0 on flex containers and shrink-0 on icons in PremiumSelect to prevent text overflow`
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

### 🚨 Troubleshooting
> 🐛 **Problem Encountered (Missing Package Match)**: Khi khách hàng nhấp vào nút "Đặt lịch gói này ngay" hoặc sử dụng công cụ tư vấn đề xuất liệu trình và chuyển sang biểu mẫu tư vấn, bộ chọn dịch vụ "Dịch vụ quan tâm" vẫn trống và hiển thị placeholder mặc định `-- Chọn gói chăm sóc --`.
> 💡 **Solution**: Chuyển đổi `serviceOptions` từ tĩnh sang động bằng `useMemo` dựa trên `categories || serviceCategories` để đảm bảo tên giá trị của gói luôn trùng khớp tuyệt đối, giúp `PremiumSelect` tìm thấy và hiển thị tự động chính xác gói đã chọn.

> 🐛 **Problem Encountered (Text Overflow Bug)**: Một số gói dịch vụ có tên quá dài kèm giá tiền (ví dụ: `Combo Mẹ & Bé Hạnh Phúc (12.600.000đ)`) bị hiển thị tràn ra ngoài viền tròn của nút bấm bộ chọn `PremiumSelect` ở phần form, đè lên các cột kế bên.
> 💡 **Solution**: Trong Flexbox, các flex items mặc định có `min-width: auto`, ngăn chặn cơ chế `truncate` / `text-overflow: ellipsis` của thẻ con. Đã giải quyết triệt để bằng cách áp dụng `min-w-0` trên div cha bọc văn bản và `shrink-0` cho các biểu tượng lân cận.

### ⏭️ Next Steps
- [ ] Tiếp tục theo dõi phản hồi thực tế từ khách hàng về giao diện đặt lịch.
- [ ] Kiểm thử kỹ lưỡng hành vi đặt lịch trên các thiết bị di động để đảm bảo độ mượt mà khi cuộn và hiệu năng chuyển trang.
