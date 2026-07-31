# HIẾN PHÁP KIẾN TRÚC DOANH NGHIỆP BELLA EIP (Bella EIP Enterprise Architecture Constitution)

## 📋 Tuyên Ngôn Kiến Trúc: Evolutionary Architecture & Production Safety First

Tài liệu này đóng vai trò là **Hiến pháp Kiến trúc Doanh nghiệp (Enterprise Architecture Constitution)** dẫn dắt sự phát triển mã nguồn của Bella EIP cho mục tiêu vận hành bền vững 10–15 năm.

---

## 🛡️ 12 ĐIỀU BẤT BIẾN CỦA BELLA EIP (12 INVARIANT ARCHITECTURE PRINCIPLES)

> [!IMPORTANT]
> **1. Production Safety First (An Toàn Sản Xuất Là Số 1):**
> Giữ nguyên cấu trúc mã nguồn `beauty_spa` và `babycare` đang vận hành. Không thực hiện refactor kiến trúc hoặc thay đổi hành vi nghiệp vụ của Beauty Spa và BabyCare để phục vụ việc phát triển Real Estate. Chỉ cho phép các thay đổi độc lập như sửa lỗi (bug fixes), vá bảo mật (security patches), tối ưu hiệu năng (performance) hoặc bảo trì cần thiết.
> 
> **2. Principle-Based Shared Layer & Rule of Three:**
> Không vội vã tạo module dùng chung trước khi có ít nhất 3 phân hệ ngành sử dụng ổn định sau 6–12 tháng. Thành phần nằm ở `Shared Layer` phải thỏa mãn 3 điều kiện: Stateless (không lưu trạng thái), không chứa quy tắc nghiệp vụ ngành (No Business Domain Rules) và đã được chứng minh tái sử dụng thực tế. (Cho phép các utility service stateless như `CurrencyFormatterService`, `ImageResizeService`, `SlugService`).
> 
> **3. Direct Call by Default (Mã Nguồn Đơn Giản & Trực Tiếp):**
> Lời gọi hàm trực tiếp là mặc định (dễ đọc, dễ trace, dễ debug). Chỉ áp dụng `Domain Events` không đồng bộ khi thực sự cần thiết (cho Notification, Audit Log, Background Analytics, Cache Invalidation).
> 
> **4. Backward Compatibility & Public Data Contracts:**
> Mọi Public API (REST, Supabase RPC), Events, Queue Messages, Public DTOs đều phải đánh phiên bản theo chuẩn Semantic Versioning (`MAJOR.MINOR.PATCH`). Không thay đổi API hay Schema công khai nếu không có kế hoạch tương thích ngược và deprecation rõ ràng.
> 
> **5. Database Evolution & Online-Compatible Migration Only:**
> Cơ sở dữ liệu chỉ tiến hóa qua các bản Migration online-compatible (`ADD COLUMN IF NOT EXISTS`) và có khả năng Rollback an toàn 100%. Tuyệt đối không xóa/sửa cột đang chạy thực tế mà chưa có chiến lược chuyển đổi dữ liệu an toàn.
> 
> **6. Observability & Configuration as Data:**
> Mọi phân hệ mới bắt buộc phải có Logging, Audit Log, Metrics, Tracing. Mọi quy tắc hoa hồng, quy trình duyệt, giảm giá, thuế phải được cấu hình dưới dạng dữ liệu (Configuration as Data), tuyệt đối không hardcode logic phân nhánh theo Tenant (`if (tenant == "A")`).
> 
> **7. Unidirectional Dependencies Only (Phụ Thuộc Một Chiều Bất Biến):**
> Luồng phụ thuộc giữa các tầng chỉ đi một chiều: `Verticals` ➔ `Shared` ➔ `Platform` ➔ `Infrastructure`. Tuyệt đối cấm phụ thuộc ngược dòng (Reverse Dependency) và phụ thuộc vòng (Circular Dependency = 0).
> 
> **8. Data & Domain Ownership (Không Truy Cập Trực Tiếp Cơ Sở Dữ Liệu Ngành Khác):**
> Mỗi Vertical hoàn toàn sở hữu Dữ liệu (Tables/DB Schemas) và Mã nguồn (Repositories, Services, Workflow, Policies, Permissions, Migrations, Tests, README). Các Vertical tuyệt đối không được truy cập trực tiếp dữ liệu nội bộ của nhau (ví dụ: cấm `SELECT * FROM beauty_spa.customers` từ `real_estate`). Giao tiếp bắt buộc qua Public Interfaces, Application Services, APIs hoặc Events.
> 
> **9. Tenant-First & Security by Default:**
> Mọi module mới bắt buộc phải kế thừa Authentication, RBAC, Row-Level Security (RLS), Audit Log, Tenant Isolation (`tenant_id`), cache key theo tenant và queue context theo tenant. Tuyệt đối không có bất kỳ module hay endpoint nào được phép bypass kiểm tra an ninh dữ liệu.
> 
> **10. Business-Agnostic Platform & Anti-Corruption Layer (ACL):**
> Tầng Platform hoàn toàn Stateless (để mở rộng hàng ngang) và Business-Agnostic (chỉ cung cấp các năng lực kỹ thuật như Workflow, Notification, Storage, Identity, Queue; tuyệt đối không chứa quy tắc nghiệp vụ của bất kỳ Vertical nào). Mọi kết nối bên ngoài bắt buộc đi qua Anti-Corruption Layer (ACL ➔ Adapter ➔ Facade ➔ Translator) để bảo vệ domain nội bộ.
> 
> **11. Testing Pyramid & Idempotency by Design:**
> Mọi capability mới phải có Unit Test; các điểm tích hợp phải có Integration hoặc Contract Test (không phụ thuộc duy nhất vào E2E). Các thao tác có khả năng retry hoặc xử lý bất đồng bộ (Thanh toán, Booking, Invoice, Webhook, Queue) bắt buộc phải được thiết kế Idempotent (chống xử lý lặp qua Idempotency Key / Unique Constraints).
> 
> **12. Resilience by Design & Failure Recovery:**
> Mọi capability tích hợp với hệ thống bên ngoài (MISA, SAP, VNPT, Stripe, Zalo) bắt buộc phải được thiết kế để chịu lỗi: Timeout, Retry with Exponential Backoff, Circuit Breaker, Dead Letter Queue (DLQ), Graceful Degradation và Idempotency.

---

## 🔄 VÒNG ĐỜI TIẾN HÓA NĂNG LỰC (CAPABILITY EVOLUTION LIFECYCLE)

Mọi tính năng/năng lực trong hệ thống tiến hóa theo 5 giai đoạn tự nhiên:
```
[1. Experimental] ➔ [2. Vertical Only] ➔ [3. Multi-Vertical] ➔ [4. Shared Layer] ➔ [5. Platform / Stable]
```

---

## 🏛️ Sơ Đồ Kiến Trúc 4 Tầng Cốt Lõi (4-Layer Target Architecture)

```
┌────────────────────────────────────────────────────────────────────────┐
│                          1. VERTICALS LAYER                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐  │
│  │  beauty_spa  │  │   babycare   │  │   real_estate (Vertical Mới) │  │
│  └──────────────┘  └──────────────┘  └──────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Import 1 chiều qua Shared)
┌───────────────────────────────────▼────────────────────────────────────┐
│                           2. SHARED LAYER                              │
│  (Thỏa mãn: Stateless + No Business Domain Rules + Proven Reusable)    │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │ shared/types │ value_objects│ validation   │ constants / utils   │  │
│  ├──────────────┼──────────────┼──────────────┼─────────────────────┤  │
│  │ interfaces   │ stateless_srv│ [Rule of 3]  │ [Rule of 3]         │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Import 1 chiều qua Platform)
┌───────────────────────────────────▼────────────────────────────────────┐
│                         3. PLATFORM LAYER                              │
│  (Stateless & Business-Agnostic: Không chứa Business Logic của Vertical) │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │ Identity     │ Authorization│ Configuration│ Workflow Engine     │  │
│  ├──────────────┼──────────────┼──────────────┼─────────────────────┤  │
│  │ Notification │ Audit        │ Observability│ ACL & Integrations  │  │
│  ├──────────────┼──────────────┼──────────────┼─────────────────────┤  │
│  │ Reporting    │ Feature Flags│ Scheduler /  │ Cache / Secrets /   │  │
│  │ & Analytics  │              │ Job Runner   │ Platform Services   │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (Import 1 chiều qua Infrastructure)
┌───────────────────────────────────▼────────────────────────────────────┐
│                       4. INFRASTRUCTURE LAYER                          │
│  ┌──────────────┬──────────────┬──────────────┬─────────────────────┐  │
│  │ PostgreSQL DB│ Redis Cache  │ Object S3    │ Message Queue       │  │
│  ├──────────────┼──────────────┼──────────────┼─────────────────────┤  │
│  │ Search Engine│ Secrets Mgmt │ Monitoring   │ External SDKs       │  │
│  └──────────────┴──────────────┴──────────────┴─────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🏢 CHI TIẾT 15 PHÂN HỆ NGHIỆP VỤ REAL ESTATE ERP (`src/modules/real_estate/`)

### 👥 Module 1: Organization & Multi-Layer RLS
- **Cấu trúc Doanh nghiệp:** `Company (Chủ đầu tư)` ➔ `Floor (Sàn A, Sàn B)` ➔ `Team (Team 1, Team 2)` ➔ `Employee (Sale)`.
- **Phân quyền RLS 4 Lớp:**
  - `Sale`: Chỉ truy vấn Khách của mình, Booking của mình, Hoa hồng của mình.
  - `Team Lead`: Xem toàn bộ dữ liệu thuộc Team mình quản lý.
  - `Giám đốc Sàn`: Xem toàn bộ dữ liệu thuộc Sàn phân phối của mình.
  - `CEO / Ban Điều Hành`: Toàn quyền xem báo cáo toàn hệ thống (Global Scope).

### 🏢 Module 2 & 3: Project Center & Inventory Engine
- **Quản lý Cấu trúc Dự án (Tree Structure):** `Project` (Vinhomes Green Paradise, Vinhomes Saigon Park, Elyse Island...) ➔ `Phase` ➔ `Block / Zone` ➔ `Floors` ➔ `Products`.
- **Loại Sản Phẩm:** Căn hộ, Nhà phố, Shophouse.
- **Ma Trận Căn (Inventory State Machine):** `Available` (Tự do) ➔ `Booked` (Giữ chỗ) ➔ `Deposited` (Đã cọc) ➔ `Contracted` (Đã ký HĐMB) ➔ `Paid` (Đã thanh toán đủ) ➔ `Handed Over` (Đã bàn giao) | `Cancelled` (Hủy).
- **Thuộc tính chi tiết:** Mã căn, diện tích tim tường/thông thủy, view, hướng, đơn giá/m², VAT, phí bảo trì, chiết khấu chính sách, timeline lịch sử giá & giao dịch.

### 👤 Module 4: 360 Customer Lifecycle Center
- **Hành trình Khách hàng:** `Lead` ➔ `Interested` (Quan tâm) ➔ `Booking` (Giữ chỗ) ➔ `Deposit` (Đã cọc) ➔ `Contract` (Chủ HĐMB) ➔ `Owner` (Đã nhận nhà).
- **Hồ sơ Pháp lý:** CCCD/Passport, Mã số thuế, Nguồn Lead, Sale phụ trách, File hợp đồng & biên bản đính kèm.

### 📝 Module 5 & 6: Reservation Center (Booking & Deposit Workflows)
- **Workflow Booking:** Giữ chỗ ➔ Sinh Phiếu Booking ➔ Nộp tiền giữ chỗ ➔ Kế toán xác nhận ➔ Khóa căn tạm thời (Timer 24h-48h). Hết hạn không cọc: Hệ thống tự động `Auto-Release` về `Available`. Hỗ trợ `Transfer Booking` sang Sale/Khách khác.
- **Workflow Deposit:** Chốt cọc ➔ Ký phiếu cọc ➔ Thu tiền cọc ➔ In biên lai ➔ Chuyển trạng thái căn sang `Deposited`.

### 📜 Module 7 & 8: Contract & Payment Schedule Engine
- **Hợp Đồng Mua Bán (HĐMB):** Số HĐMB, thông tin khách, tổng giá bán + VAT (10%) + KPBT (2%) - Chiết khấu/Voucher.
- **Tiến Độ Thanh Toán (Payment Milestones):** Sinh lịch thanh toán đợt 1, 2, 3... Theo dõi `Due Date`, `Actual Date`, Status, Lãi phạt trả chậm (`Penalty Interest`).

### 💰 Module 9 & 10: Finance & Commission Engine
- **Quản lý Dòng tiền:** Thu tiền Booking ➔ Thu tiền cọc ➔ Thu thanh toán tiến độ ➔ Phạt trả chậm ➔ Hoàn tiền Booking hủy hợp lệ.
- **Tính Hoa Hồng Sale (Commission Engine):** Tính theo dự án, loại SP, Sàn, Team, Sale. Hỗ trợ hoa hồng tầng (Sale trực tiếp, Team Lead, Giám đốc Sàn). Điều kiện giải ngân: Chỉ chi khi HĐMB đã ký và Khách đóng đủ % tiến độ quy định (ví dụ >= 70%).

### 📊 Module 11 & 12: TT133 Accounting Outbox & e-Invoice Center
- **Tự động sinh bút toán Kế toán BĐS (Accounting Outbox):**
  - **Booking:** Nợ 111/112 - Có 3388 (Tiền giữ chỗ).
  - **Chốt cọc:** Nợ 3388 - Có 321/3388 (Tiền đặt cọc).
  - **Ký HĐMB:** Nợ 131 - Có 131 (Công nợ phải thu chi tiết căn).
  - **Thanh toán đợt:** Nợ 112 - Có 131 (Giảm công nợ).
  - **Bàn giao căn:** Nợ 131 - Có 511, Có 3331 (Ghi nhận Doanh thu) & Nợ 632 - Có 154/155 (Giá vốn).
  - **Chi hoa hồng:** Nợ 6421 - Có 111/112/334 (Chi phí bán hàng).
- **Tích hợp Hóa đơn Điện tử (Integration ACL):** Kết nối MISA meInvoice, VNPT Invoice, Viettel S-Invoice phát hành hóa đơn theo đợt thanh toán.

### 🔑 Module 13, 14 & 15: Handover, Marketing & Executive BI Dashboard
- **Handover Center:** Thông báo nghiệm thu ➔ Biên bản nghiệm thu (Checklist Defects) ➔ Bàn giao chìa khóa ➔ Bảo hành.
- **Marketing Center:** Thống kê hiệu quả Ads (FB/Google/TikTok) ➔ Thống kê ROAS, CAC, Cost/Booking, Cost/Deposit, Cost/Contract.
- **Executive BI Dashboard (CEO View):** 1-View Real-time BI Dashboard: Giá trị tồn kho toàn dự án, % Đã bán, Dòng tiền đã thu / Phải thu / Quá hạn, Doanh thu kế toán đã ghi nhận, Top Sàn & Top Sale.

---

## 🚧 3 HÀNG RÀO BẢO VỆ AN TOÀN SẢN XUẤT (3 PRODUCTION SAFETY BARRIERS)

### 1. Architecture CI Tests (Chống Trôi Kiến Trúc - Architectural Drift Guard)
Tích hợp test tự động trong CI (`npm run test:architecture`) để đảm bảo:
- **Zero Cross Imports:** Không phát sinh bất kỳ import nào từ `beauty_spa` ➔ `real_estate` hoặc ngược lại.
- **Zero Reverse Dependencies:** Không phát sinh phụ thuộc ngược dòng từ Platform ➔ Verticals.
- **Zero Circular Dependencies:** Tổng số phụ thuộc vòng (`Circular Dependency`) = 0.

### 2. Tenant Canary Rollout Strategy (Phát Hành Từng Phần Theo Tenant)
- Kích hoạt phân hệ `real_estate` theo cơ chế Canary/Tenant-level entitlement (`tenant_modules = ['real_estate']`).
- Không bao giờ bật tính năng mới đồng loạt cho toàn bộ các Tenant cùng một lúc.

### 3. Staging Migration & Rollback Dry-Run (Kiểm Chứng Database Staging)
- Mọi file SQL Migration và Script Rollback bắt buộc phải được thử nghiệm thành công 100% trên môi trường Staging (sao chép dữ liệu thực từ Production) trước khi triển khai sản xuất.

---

## 📈 CHỈ SỐ CAM KẾT MỤC TIÊU VẬN HÀNH (OPERATIONAL SLOs & KPIs)

### System Operational SLOs (Chỉ Số Vận Hành Hệ Thống)
- **Availability:** `99.9%`
- **MTTR (Mean Time to Recovery):** `< 30 phút`
- **Deployment Success Rate:** `99%`

### Engineering Quality KPIs
1. **100% Pass Critical Tests:** Lệnh `npm run test:critical` đỗ 100% test cases của Beauty Spa & BabyCare.
2. **Architecture CI Test Pass:** Lệnh `npm run test:architecture` xác nhận Circular Dependency = 0 và Cross-Vertical Import = 0.
3. **Documentation Lifecycle:** Mọi module bắt buộc phải có `README.md`, `Architecture Diagram`, `ADR`, `Migration note`, `Rollback guide` và `Runbook`.
4. **Security by Default Pass:** 100% API endpoints & RPCs kế thừa RLS và Auth tenant-isolation.
5. **API Performance Overhead Guard:** Độ trễ API P95 không được tăng vượt quá 10% (`P95 Overhead < 10%`).
6. **Database Migration Safety:** Migration đạt tiêu chuẩn online-compatible và kiểm chứng Rollback dry-run 100% thành công trên Staging.
