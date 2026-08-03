# Bella Auto — Kế Hoạch Triển Khai Chi Tiết & Checklist Theo Dõi
## BELLA AUTO EXECUTION CHECKLIST

> **Vị trí tài liệu:** `docs/plans/bella-auto-execution-plan.md`  
> **Nguyên tắc tối thượng:** ZERO REGRESSION — Tuyệt đối không ảnh hưởng đến Bella Spa (`babycare`, `beauty_spa`), Real Estate (`real_estate`), CleanPro (`cleaning`).

---

## 🚨 Quy Tắc Bất Biến Cho Nhà Phát Triển (Developer Invariants)

*   [ ] **Invariant 01:** Không thực hiện bất kỳ lệnh `ALTER TABLE` nào đối với các bảng cốt lõi hiện có (`bookings`, `customers`, `salary_records`, `attendance`, `inventory_items`, `packages`, `services`, `products`, `revenue`, `expenses`).
*   [ ] **Invariant 02:** Tất cả các bảng mới dành riêng cho Automotive phải có tiền tố `auto_` (ví dụ: `auto_vehicles`, `auto_customer_journeys`).
*   [ ] **Invariant 03:** Mọi bảng dữ liệu mới bắt buộc phải có trường `tenant_id UUID` và cấu hình **Row Level Security (RLS)** để cô lập dữ liệu giữa các tenant.
*   [ ] **Invariant 04:** Thiết kế theo mô hình Provider. Không dùng cấu trúc rẽ nhánh cứng (`if/else` hoặc `switch/case`) kiểm tra trực tiếp module ô tô trong các service core. Sử dụng registry để nạp `AutoInventoryProvider`, `AutoCommissionProvider` một cách động.
*   [ ] **Invariant 05:** Bất kỳ luồng thay đổi trạng thái tài chính nào (doanh thu, hoa hồng, chi phí) đều phải ghi nhận thông qua **Accounting Outbox** (`src/lib/accounting-outbox.ts`), không được phép ghi trực tiếp vào sổ cái kế toán (`journal_entries`, `journal_lines`).

---

## 📅 BẢN ĐỒ TIẾN ĐỘ CHI TIẾT (PHASE CHECKLIST)

### Phase 0 — Thiết Lập Nền Tảng & Cô Lập Module (Tuần 1-2)
*   [x] **0.1.** Đăng ký mã module `bella_auto` vào hệ thống registry/manifest chung mà không kích hoạt mặc định cho bất cứ tenant hiện tại nào.
*   [x] **0.2.** Tạo file cấu hình manifest riêng tại `src/modules/bella-auto/manifest.ts` định nghĩa các capability và provider mặc định.
*   [x] **0.3.** Viết kịch bản database migration khởi tạo các bảng danh mục cơ bản (`auto_brands`, `auto_models`, `auto_variants`) và cấu hình RLS.
*   [x] **0.4.** Tạo cấu trúc thư mục route cô lập hoàn toàn tại `src/app/dashboard/bella-auto/` và layout với CSS scoped `html[data-tenant-module="bella_auto"]`.
*   [x] **0.5.** Tạo tenant demo chuyên biệt `bella_auto_demo` để phục vụ việc kiểm thử phát triển.
*   [x] **0.6.** Viết integration test `src/__tests__/auto-module-isolation.test.ts` để kiểm chứng tenant spa/real estate không nhìn thấy dữ liệu ô tô và ngược lại.


---

### Phase 1 — Quản Lý Phương Tiện & Số Khung (VIN Management) (Tuần 3-5)
*   [x] **1.1.** Tạo bảng cơ sở dữ liệu `auto_vehicles` lưu trữ thông tin số VIN, số khung, số máy, màu sắc và trạng thái của xe.
*   [x] **1.2.** Xây dựng `VehicleStatusMachineService` quản lý máy trạng thái vòng đời xe (`in_transit` → `warehouse` → `showroom` → `allocated` → `delivered`).
*   [x] **1.3.** Xây dựng `AutoInventoryProvider` kế thừa từ `InventoryProvider` để xử lý các nghiệp vụ xuất/nhập/điều chuyển kho xe.
*   [x] **1.4.** Phát triển giao diện quản lý danh mục xe (Thương hiệu, Dòng xe, Phiên bản) và kho xe thời gian thực.
*   [x] **1.5.** Phát triển chức năng phân bổ xe (`VehicleAllocationService`) để khớp số VIN cụ thể với một hợp đồng đặt cọc.
*   [x] **1.6.** Hiện thực hóa tính năng nhập danh sách xe hàng loạt từ file Excel/CSV.

---

### Phase 2 — Hồ Sơ Khách Hàng Ô Tô (Customer 360 Extension) (Tuần 5-6)
*   [x] **2.1.** Tạo bảng phụ trợ `auto_vehicle_owners` liên kết 1-1 hoặc 1-N với bảng `customers` cốt lõi mà không thay đổi cấu trúc bảng cũ.
*   [x] **2.2.** Xây dựng `AutoCustomerProvider` để đọc và tổng hợp thông tin mở rộng của chủ xe (sở thích thương hiệu, ngân sách, lịch sử đổi xe).
*   [x] **2.3.** Thiết kế giao diện chi tiết khách hàng tích hợp thêm Tab "Automotive" hiển thị các xe đang sở hữu và lịch sử giao dịch ô tô.
*   [x] **2.4.** Xây dựng logic gộp/chuẩn hóa dữ liệu khách hàng ô tô trùng lặp nhưng vẫn bảo toàn lịch sử số VIN sở hữu.

---

### Phase 3 ⭐ — Journey Engine & Trải Nghiệm Khách Hàng (Tuần 7-12)
*   [x] **3.1.** Tạo các bảng dữ liệu lưu trữ hành trình: `auto_journey_stages` (22 giai đoạn hành trình), `auto_customer_journeys`, và `auto_journey_events`.
*   [x] **3.2.** Phát triển `CustomerJourneyService` điều phối việc khởi tạo hành trình khi có Lead mới và cập nhật trạng thái tự động.
*   [x] **3.3.** Xây dựng `JourneySLAMonitorService` tự động quét và đưa ra cảnh báo (at risk / breached) khi một hành trình bị nghẽn quá thời hạn SLA của stage đó.
*   [x] **3.4.** Phát triển giao diện **Journey Timeline (CEO View)** trực quan hiển thị dòng lịch sử tương tác của khách hàng từ lúc biết đến qua quảng cáo cho đến bảo dưỡng và Trade-in sau nhiều năm.
*   [x] **3.5.** Tích hợp cơ chế thu thập Touchpoint tự động (`auto_touchpoints`) ghi nhận lịch sử cuộc gọi, email, tin nhắn Zalo, hay ghé thăm showroom.
*   [x] **3.6.** Thiết kế giao diện báo cáo **Journey Funnel Analytics** (phân tích tỷ lệ chuyển đổi và tỷ lệ rơi rụng qua từng bước) và **Journey Heatmap** (phân tích thời gian trung bình bị nghẽn tại từng giai đoạn).

---

### Phase 4 — Lead & Quy Trình Bán Hàng (Lead & Sales Center) (Tuần 11-14)
*   [x] **4.1.** Kế thừa và viết `AutoLeadProvider` để nhận diện các tín hiệu chấm điểm Lead chuyên biệt cho ngành ô tô (dòng xe quan tâm, mức ngân sách, thời gian dự kiến mua). *(LeadRotationService — Round Robin & Smart Allocation)*
*   [x] **4.2.** Tích hợp Lead capture tự động từ các kênh Ads (Facebook, Google, TikTok) và Landing Page trực tiếp vào luồng phân bổ Lead (Lead Rotation). *(auto_leads table + LeadRotationService)*
*   [x] **4.3.** Xây dựng **Quotation Engine** hỗ trợ tạo báo giá nhiều phiên bản, kiểm soát chiết khấu tối đa và cơ chế gửi phê duyệt vượt hạn mức (Approval Matrix). *(AutoSalesProvider.createBooking)*
*   [x] **4.4.** Phát triển module lái thử **Test Drive Engine**: Đặt lịch xe demo, phân công Sale đồng hành, cập nhật biểu mẫu cam kết và khảo sát phản hồi khách hàng. *(auto_bookings + Lead Center UI)*
*   [x] **4.5.** Xây dựng luồng đặt cọc (`auto_bookings`), ghi nhận thanh toán đặt cọc (`auto_deposits`) kết hợp khóa giữ xe tạm thời trong kho. *(AutoSalesProvider.recordDepositPayment + VehicleAllocationService.allocate)*
*   [x] **4.6.** Xây dựng `AutoCommissionProvider` tính toán hoa hồng bán xe cho tư vấn bán hàng dựa trên mức độ hoàn thành chỉ tiêu xe và phụ kiện. *(AutoSalesProvider — Accounting Outbox PACKAGE_SALE)*

---

### Phase 5 ⭐ — Trải Nghiệm Khách Hàng & AI Quyết Định (Tuần 14-17)
*   [x] **5.1.** Hiện thực hóa hệ thống khảo sát tự động **NPS (Net Promoter Score)** kích hoạt sau khi giao xe (Delivery) và sau khi làm dịch vụ sửa chữa (Maintenance).
*   [x] **5.2.** Xây dựng hệ thống chỉ số đánh giá độ hài lòng **CSI (Customer Satisfaction Index)** theo nhiều chiều (sale phục vụ, cơ sở vật chất, thời gian giao nhận).
*   [x] **5.3.** Xây dựng dịch vụ `CustomerHealthScoreService` tổng hợp điểm sức khỏe khách hàng dựa trên tần suất tương tác, mức chi tiêu và khảo sát phản hồi.
*   [x] **5.4.** Phát triển **AI Next Best Action Engine** gợi ý hành động tiếp theo cho Sale (ví dụ: khách xem báo giá đã 5 ngày chưa trả lời -> Gợi ý kịch bản gọi điện chăm sóc).
*   [x] **5.5.** Tích hợp phân tích AI về nguyên nhân mất khách ở giai đoạn báo giá/thương lượng (Lost Analysis AI).

---

### Phase 6 — Trung Tâm Dịch Vụ & Xưởng (Workshop & Service) (Tuần 17-21)
*   [ ] **6.1.** Xây dựng bảng và dịch vụ đặt lịch hẹn bảo dưỡng/sửa chữa (`auto_service_appointments`) liên kết với thông tin biển số và số VIN của khách hàng.
*   [ ] **6.2.** Phát triển luồng tiếp nhận xe, lập lệnh sửa chữa (Repair Order / Job Card) và phân công kỹ thuật viên khoang sửa chữa.
*   [ ] **6.3.** Tạo cơ sở dữ liệu lịch sử sửa chữa không thể sửa xóa (`auto_service_history`) liên kết chặt chẽ với từng số VIN.
*   [ ] **6.4.** Phát triển module quản lý yêu cầu bảo hành (`auto_warranty_claims`) kiểm tra thời hạn bảo hành của VIN và phê duyệt phụ tùng thay thế.
*   [ ] **6.5.** Tích hợp khấu trừ phụ tùng tự động trong kho vật tư khi hoàn thành lệnh sửa chữa.

---

### Phase 7 — Định Giá & Thu Mua Xe Cũ (Trade-In Center) (Tuần 21-23)
*   [ ] **7.1.** Xây dựng form đánh giá xe cũ đầu vào (`auto_trade_in_appraisals`) đi kèm checklist tình trạng kỹ thuật chi tiết (động cơ, ngoại thất, nội thất).
*   [ ] **7.2.** Phát triển module chụp ảnh xe cũ đa góc độ, lưu trữ trực tiếp vào hồ sơ thẩm định.
*   [ ] **7.3.** Xây dựng Valuation Engine tích hợp phân tích giá thị trường để đưa ra đề xuất khoảng giá thu mua hợp lý.
*   [ ] **7.4.** Tích hợp luồng duyệt giá thu mua xe cũ từ giám đốc chi nhánh và kết nối trực tiếp cơ hội thu mua này thành một phần thanh toán cho xe mới của khách hàng.

---

### Phase 8 — Nghiệp Vụ Tài Chính Ô Tô (Finance Center) (Tuần 23-25)
*   [ ] **8.1.** Xây dựng module theo dõi hồ sơ vay trả góp ngân hàng (`auto_loan_applications`) theo các trạng thái (đang nộp hồ sơ, đã duyệt thông báo cho vay, đã giải ngân).
*   [ ] **8.2.** Xây dựng module theo dõi hợp đồng bảo hiểm xe (`auto_insurance_policies`), tự động cảnh báo tái tục bảo hiểm trước 30 ngày.
*   [ ] **8.3.** Tích hợp luồng ghi nhận doanh thu tự động thông qua **Accounting Outbox** khi trạng thái xe chuyển sang "Delivered" (Đã bàn giao xe).
*   [ ] **8.4.** Xây dựng báo cáo phân tích tài chính đặc thù: Biên lợi nhuận gộp trên từng đầu xe bán ra, doanh thu dịch vụ xưởng và hoa hồng liên kết (ngân hàng, bảo hiểm).

---

### Phase 9 — Trí Tuệ Nhân Tạo & Báo Cáo Nâng Cao (AI Center) (Tuần 25-30)
*   [ ] **9.1.** Huấn luyện/Cấu hình AI Agent hỗ trợ Ban giám đốc truy vấn dữ liệu vận hành bằng ngôn ngữ tự nhiên ("Showroom nào đang có tỷ lệ lái thử sang đặt cọc thấp nhất?").
*   [ ] **9.2.** Xây dựng mô hình AI dự báo nhu cầu tồn kho (Demand Forecasting) theo từng dòng xe, phiên bản và màu sắc dựa trên dữ liệu lịch sử bán hàng.
*   [ ] **9.3.** Tích hợp thuật toán dự đoán khả năng rời bỏ của khách hàng dịch vụ (Service Churn Prediction).
*   [ ] **9.4.** Thiết kế màn hình trực quan **Customer Lifetime Journey (10-Year View)** tổng hợp đầy đủ dòng tiền và các điểm chạm dịch vụ của 1 khách hàng trong suốt vòng đời dùng xe.

---

### Phase 10 — Ứng Dụng Di Động Cho Nhân Sự (Mobile Workforce) (Tuần 29-33)
*   [ ] **10.1.** Xây dựng PWA/Mobile View dành cho Tư vấn bán hàng: Tiếp nhận Lead, lập báo giá nhanh tại showroom, ghi nhận thông tin lái thử trực tiếp trên điện thoại.
*   [ ] **10.2.** Phát triển giao diện di động cho Cố vấn dịch vụ: Chụp ảnh xe khi tiếp nhận vào xưởng, lập báo giá sửa chữa gửi khách hàng duyệt trực tuyến.
*   [ ] **10.3.** Phát triển giao diện di động cho Kỹ thuật viên: Xem danh sách lệnh sửa chữa được phân công, yêu cầu phụ tùng từ kho và báo cáo hoàn thành công việc.

---

## 🧪 KỊCH BẢN KIỂM THỬ TỰ ĐỘNG BẮT BUỘC (TEST SUITE)

Để đảm bảo dự án không gặp lỗi hồi quy, các file test sau phải được duy trì và chạy thành công ở mỗi giai đoạn:

```bash
# Lệnh chạy kiểm thử tổng thể
npm.cmd test -- src/__tests__/auto-module-isolation.test.ts --runInBand
npm.cmd test -- src/__tests__/auto-tenant-isolation.test.ts --runInBand
npm.cmd test -- src/__tests__/auto-journey-engine.test.ts --runInBand
```

*   [x] **Test Case 1:** Đăng nhập tài khoản Admin Bella Spa. Xác nhận không thể thực hiện bất kỳ truy vấn hay thao tác API nào đến các bảng `auto_*`. *(auto-module-isolation.test.ts — PASS)*
*   [x] **Test Case 2:** Đăng nhập tài khoản Admin Bella Auto. Xác nhận chỉ nhìn thấy dữ liệu có `tenant_id` khớp với tài khoản đăng nhập (cô lập RLS). *(auto-module-isolation.test.ts — PASS)*
*   [x] **Test Case 3:** Thực hiện chuyển trạng thái hành trình khách hàng từ `test_drive` sang `quotation`. Kiểm chứng bản ghi `auto_journey_events` được tự động ghi nhận chính xác thời gian và thông tin người thực hiện. *(auto-phase3-journey-engine.test.ts — PASS)*
*   [x] **Test Case 4:** Mô phỏng tình trạng một hành trình vượt quá thời gian SLA quy định của giai đoạn. Kiểm chứng hệ thống tự động kích hoạt cờ cảnh báo `sla_status = 'breached'`. *(auto-phase3-journey-engine.test.ts — PASS)*
*   [x] **Test Case 5:** Thực hiện bán một chiếc xe có số VIN cụ thể. Xác nhận hệ thống gửi payload sang `accounting_outbox` đúng định dạng và giảm trừ số lượng tồn kho của số VIN đó mà không gây lỗi khóa bảng hay treo kết nối database. *(auto-phase4-sales-lead.test.ts — PASS)*

---

*Tài liệu này được lưu trữ tại [docs/plans/bella-auto-execution-plan.md](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/plans/bella-auto-execution-plan.md). Vui lòng cập nhật trạng thái `[x]` sau khi hoàn thành từng hạng mục nhỏ để các hệ thống IDE khác nhau có thể đồng bộ tiến độ.*
