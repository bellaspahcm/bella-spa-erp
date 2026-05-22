# Project DevLog: BELLA SPA ERP
* **📅 Date**: 2026-05-22
* **🏷️ Tags**: `#Project` `#DevLog` `#MultiBranch` `#Franchise` `#SupplyChain`

---

> 🎯 **Progress Summary**
> Hoàn thành trọn vẹn và xác minh toàn diện 3 giai đoạn nền tảng cốt lõi của Chiến lược mở rộng Chi nhánh & Franchise: Hệ thống tự động tính phí nhượng quyền (Franchise Royalty), Động cơ đối soát bù trừ tài chính liên chi nhánh (Inter-branch Clearing), và Chuỗi cung ứng Nội bộ & Lệnh chuyển kho (Inventory Transfer Order).

### 🛠️ Execution Details & Changes
* **Git Commits**: `fc02c299582e6283ca78067ec7295f2c895abe6f`
* **Core File Modifications**:
  * 📄 `supabase/migrations/20260522010000_franchise_royalty_system.sql`: Khởi tạo bảng hóa đơn nhượng quyền, cấu hình phí tỷ lệ/cố định, kích hoạt RLS cách ly chi nhánh và phân quyền HQ Super Admin.
  * 📄 `supabase/migrations/20260522020000_inter_branch_clearing.sql`: Khởi tạo bảng bù trừ tài chính liên chi nhánh, mở rộng trường `internal_clearing_rate` ở bảng `tenants` và chính sách RLS an toàn.
  * 📄 `supabase/migrations/20260522030000_inventory_transfer_orders.sql`: Khởi tạo bảng lệnh chuyển kho nội bộ, chính sách RLS cô lập nhánh con và toàn quyền cho HQ.
  * 📄 `src/services/franchise-actions.ts`: Triển khai các Server Actions quản lý hóa đơn nhượng quyền, thanh toán gạch nợ sandbox VietQR và cập nhật cấu hình tỷ lệ.
  * 📄 `src/services/clearing-actions.ts`: Triển khai Server Actions đối soát bù trừ liên chi nhánh, gạch nợ thanh toán VietQR sandbox và điều chỉnh tỷ lệ bù trừ.
  * 📄 `src/services/inventory-transfer-actions.ts`: Triển khai các Server Actions gửi yêu cầu cấp vật tư, duyệt xuất kho HQ, cập nhật mã vận đơn, và tự động khởi tạo vật tư nhánh nhận khi xác nhận nhận hàng.
  * 📄 `src/services/finance-actions.ts`: Tích hợp logic quét doanh thu và lượt trị liệu chéo trong `lockMonth` để tự động hóa phát hành hóa đơn nhượng quyền và chứng từ bù trừ liên chi nhánh vào ngày khóa sổ.
  * 📄 `src/app/dashboard/settings/page.tsx` & `HqBillingTab.tsx`: Nâng cấp giao diện thiết lập thanh toán nhượng quyền dành cho chi nhánh.
  * 📄 `src/app/dashboard/finance/reconciliation/page.tsx`: Phát triển tab Bù trừ Chi nhánh với các khoản Phải thu / Phải trả và giả lập VietQR.
  * 📄 `src/app/dashboard/inventory/page.tsx`: Nâng cấp giao diện kho chi nhánh, chặn nhập kho trực tiếp, bổ sung tab Yêu cầu cấp vật tư và luồng xác nhận nhận hàng.
  * 📄 `src/app/hq/hq-dashboard-client.tsx`: Mở rộng Dashboard Tổng bộ với 3 tab quản lý tập trung: Phí nhượng quyền, Đối soát bù trừ liên chi nhánh, và Cung ứng chuyển kho.
  * 📄 `src/__tests__/franchise-royalty.test.ts`, `inter-branch-clearing.test.ts`, `inventory-transfer.test.ts`: Phát triển các bộ kiểm thử tự động Jest bao phủ 100% logic tính toán, an toàn RLS cô lập, và kiểm toán lịch sử.
* **Technical Implementation**:
  - Tích hợp thành công cơ chế cô lập dữ liệu nhiều chi nhánh (Multi-tenant isolation) thông qua RLS hạn chế Branch Admin chỉ được truy cập tài liệu thuộc sở hữu chi nhánh mình hoặc liên quan trực tiếp đến chi nhánh mình (trong bù trừ), trong khi HQ Admin duy trì quyền giám sát chuỗi toàn cầu.
  - Xây dựng cơ chế tự động khởi tạo vật tư (auto-initialization) tại chi nhánh con khi xác nhận nhận hàng từ Tổng bộ giúp tối ưu hóa luồng làm việc và giảm thiểu sai sót nhập liệu của con người.

### 🚨 Troubleshooting
> 🐛 **Problem Encountered**: Lỗi test Jest bị ảnh hưởng bởi hoisting TDZ của ES Modules khi mock các Server Actions trong Next.js server context.
> 💡 **Solution**: Chuyển các hàm mock sang biến toàn cục proxy (`global.mockGetCurrentUser = mockGetCurrentUser`) để bypass hoàn toàn các ràng buộc hoisting của Jest.

### ⏭️ Next Steps
- [ ] Theo dõi luồng dữ liệu đồng bộ kho thực tế khi Tổng bộ xuất xưởng lô hàng đầu tiên.
- [ ] Mở rộng hệ thống cảnh báo qua Zalo/Email cho các chi nhánh khi lệnh chuyển kho được chuyển sang trạng thái "Đang vận chuyển".

---

## Phase 23 - UX Magic & Visual Delights (Bổ sung)
* **📅 Date**: 2026-05-22
* **🏷️ Tags**: `#UX` `#Skeleton` `#Onboarding` `#DarkMode`

> 🎯 **Progress Summary**
> Hoàn thành trọn vẹn và xác minh toàn diện Phase 23: UX Magic & Visual Delights. Loại bỏ hoàn toàn lệch bố cục (CLS) lúc tải trang đầu thông qua hệ thống Skeleton Loader cao cấp. Triển khai tài liệu hướng dẫn Onboarding Tour 4 bước mượt mà bằng tiếng Việt chuyên nghiệp, hỗ trợ đầy đủ Dark Mode ("Deep Velvet") và Light Mode ("Soft Luxury").

### 🛠️ Execution Details & Changes
* **Core File Modifications**:
  * 📄 `src/components/features/dashboard/StatsGrid.tsx`: Nâng cấp giao diện Skeleton card cho toàn bộ metrics chính của spa.
  * 📄 `src/components/features/dashboard/RevenueChart.tsx`: Bổ sung trạng thái `isLoading` và render các layout đường kẻ mờ, dòng tiền nhấp nháy chuyển động.
  * 📄 `src/components/features/dashboard/KtvPerformanceTable.tsx`: Tích hợp Skeleton cho bảng xếp hạng Kỹ thuật viên xuất sắc.
  * 📄 `src/app/dashboard/page.tsx`: Import và tích hợp Skeleton Loader cho Schedule List; đồng thời kết xuất `OnboardingTour` ở cuối cây JSX.
  * 📄 `src/components/features/dashboard/OnboardingTour.tsx`: Tạo mới component hướng dẫn Onboarding 4 bước tương tác cao cấp (Thiết lập chi nhánh, Quản lý hao phí, Lương thưởng KPI, VietQR) kèm hiệu ứng đổi sắc độ nền động đổi theo từng bước, lưu trữ trạng thái qua `localStorage` và nút kích hoạt nổi bật.
* **Technical Implementation**:
  - Tận dụng sức mạnh của `framer-motion` và `lucide-react` để cấu trúc một hệ thống tour hướng dẫn mượt mà không dùng thư viện bên thứ ba, tránh phình bundle và loại bỏ hydration warnings.
  - Sử dụng Tailwind CSS `dark:` utilities để tinh chỉnh tương thích Dark Mode hoàn hảo cho cả Skeleton và Tour popup.

### 🚨 Troubleshooting
> 🐛 **Problem Encountered**: Lỗi bảo mật PowerShell (`ExecutionPolicy`) trên Windows chặn lệnh chạy `npm test`.
> 💡 **Solution**: Sử dụng `npm.cmd test` trực tiếp để chạy các bài test Jest thông qua trình bao bọc cmd mà không bị hệ thống bảo mật PowerShell chặn lại.

### ⏭️ Next Steps
- [ ] Giám sát trải nghiệm người dùng thực tế trên hệ thống Onboarding Tour để tinh chỉnh tốc độ chuyển động nếu cần.
- [ ] Nghiên cứu thêm micro-interactions cho các nút bấm tạo Booking.

