# Project DevLog: BELLA SPA ERP
* **📅 Date**: 2026-05-22
* **🏷️ Tags**: `#Project` `#DevLog` `#MultiBranch` `#Franchise` `#SupplyChain`

---

> 🎯 **Progress Summary**
> Hoàn thành trọn vẹn và xác minh toàn diện 3 giai đoạn nền tảng cốt lõi của Chiến lược mở rộng Chi nhánh & Franchise: Hệ thống tự động tính phí nhượng quyền (Franchise Royalty), Động cơ đối soát bù trừ tài chính liên chi nhánh (Inter-branch Clearing), và Chuỗi cung ứng Nội bộ & Lệnh chuyển kho (Inventory Transfer Order).

### 🛠️ Execution Details & Changes
* **Git Commits**: (N/A)
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
