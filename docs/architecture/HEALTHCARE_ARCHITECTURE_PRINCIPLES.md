# ⚖️ Tuyên Ngôn Các Luật Kiến Trúc Bất Biến: Bella Healthcare Meta-Platform

> **Tài liệu:** Healthcare Enterprise Architecture Principles  
> **Trạng thái:** 🔒 **OFFICIALLY FROZEN & CONSTITUTIONALLY BINDING**  
> **Áp dụng cho:** Bella EIP Meta-Platform, Bella Healthcare Platform & Tất cả Domain Platforms tương lai (`Medical`, `Dental`, `Hospital`, `Specialist Clinics`, `Retail`, `Manufacturing`...)

---

## 🏛️ Danh Mục 10 Luật Kiến Trúc Bất Biến (10 Invariant Architecture Rules)

### 1. Host Platform Inheritance (Luật Kế Thừa Nền Tảng Host)
- **Quy tắc:** Healthcare Domain Platform là một Domain Extension chạy trên **Bella Host Platform**. Healthcare kế thừa 100% các Platform Shared Services (`Auth & RBAC`, `Finance TT133`, `CRM`, `Inventory Core`, `Document Engine`, `Workflow Engine`, `Metadata Engine`, `Notification`, `Bella EOS AI`).
- **Cấm:** Không được xây dựng lại các thành phần dùng chung đã có của Host Platform.

### 2. Capability First Enforcement (Luật Bật/Tắt Capability Theo Manifest)
- **Quy tắc:** Core Bella Platform chỉ render UI, mở Route, hoặc thực thi Service Provider khi `manifest.enabledCapabilities.includes(...)` trả về `true`.
- **Cấm:** Nếu Capability chưa được đăng ký trong Manifest: Cấm render Menu, cấm kích hoạt Routing, cấm query Database.

### 3. Healthcare Shared Kernel Boundary (Luật Ranh Giới Shared Kernel)
- **Quy tắc:** Các thực thể hạt nhân như `Patient Identity` (mở rộng từ Core `customers`), `Practitioner`, `Facility`, `Department`, `Encounter` phải sử dụng **Healthcare Shared Kernel**.
- **Cấm:** Cấm bất kỳ Capability hay Product nào tự định nghĩa lại các hạt nhân này.

### 4. Zero Regression & Isolation Policy (Luật Cô Lập & Zero Regression)
- **Quy tắc:** Các tenant sản xuất hiện tại (`beauty_spa`, `babycare`, `real_estate`, `industrial_cleaning`, `bella_auto`) là **FROZEN & IMMUTABLE**.
- **Cấm:** Không bất kỳ tính năng, migration hay capability mới nào được phép làm thay đổi hành vi hoặc gây rủi ro phá vỡ cho các tenant hiện hữu.

### 5. Encounter EMR Aggregate Root (Luật Aggregate Root Lượt Khám)
- **Quy tắc:** `Encounter` là Aggregate Root duy nhất quản lý toàn bộ vòng đời lượt khám y tế. Các phân hệ LIS (Xét nghiệm), RIS (CĐHA), Pharmacy (Dược) chỉ tham chiếu ID lượt khám và tương tác qua Events/Orders.
- **Cấm:** Cấm nhúng vật lý Aggregate LIS, RIS hay Billing vào bên trong Encounter Aggregate.

### 6. Accounting Ledger Outbox Guard (Luật Ranh Giới Sổ Cái Kế Toán)
- **Quy tắc:** Tất cả các giao dịch viện phí, bảo hiểm, xuất thuốc đều phải phát Event Outbox kết nối `AccountingEngineService` để xử lý bút toán.
- **Cấm:** Cấm thực thi các lệnh SQL `INSERT/UPDATE` trực tiếp vào các bảng sổ cái `journal_entries` hoặc `journal_lines`.

### 7. Centralized Event Contract Registry & Semantic Versioning (Luật Event Registry Tập Trung)
- **Quy tắc:** Mọi Domain Event đều phải được khai báo tại **Event Contract Registry** tập trung với Schema JSON Validation và quản lý phiên bản Semantic Versioning (`EncounterStarted.v1`, `EncounterStarted.v2`).
- **Cấm:** Cấm tự ý sửa đổi Payload của Event `.v1` sau khi đã phát hành. Nếu thay đổi cấu trúc bắt buộc phải phát hành phiên bản `.v2`.

### 8. Platform Impact Assessment (PIA / PCZRA - Luật Đánh Giá Tác Động Nền Tảng)
- **Quy tắc:** Mọi Domain Platform mới (Healthcare, Retail, Manufacturing, Hospital...) **BẮT BUỘC** phải vượt qua Bảng Đánh Giá Tác Động Nền Tảng (PIA) trước khi được phép Merge mã nguồn hoặc Deploy sản xuất.

### 9. Additive Extension Policy (AEP - Luật Chính Sách Mở Rộng Cộng Dồn)
- **Quy tắc:** Mọi mở rộng kiến trúc trên Bella EIP Meta-Platform **CHỈ ĐƯỢC PHÉP THÊM (ADDITIVE ONLY)**. Không được thay thế (replace) hoặc sửa đổi (modify) hành vi của các Capability đã phát hành.

---

### 🎨 10. Universal Healthcare Experience Principle (UHEP - Luật Trải Nghiệm UI Giao Diện Tái Sử Dụng Dynamic)
- **Tuyên ngôn:** **`Product ≠ UI`**. Tất cả các sản phẩm y tế (`Bella Medical Clinic`, `Bella Dental Clinic`, `Bella Hospital`, `Bella Eye`, `Bella ENT`, `Bella Pediatrics`, `Bella Dermatology`...) **BẮT BUỘC** phải tái sử dụng chung 80–90% bộ **Universal Healthcare UI Framework** và **Component Library**.
- **Cơ chế hoạt động:** Sự khác biệt về hiển thị giữa các sản phẩm được quyết định động bằng **Product Manifest**, **Capability**, và **Metadata** (Tab hiển thị, Phân luồng Hàng đợi, Form khám chuyên khoa, Quyền thao tác).
- **Cấm:** **NGHIÊM CẤM FORK** hoặc nhân bản mã nguồn UI riêng rẽ cho từng sản phẩm y tế nếu không có lý do đặc biệt được phê duyệt qua ADR.
- **Cấu trúc Component 3 Tầng (3-Level UI Component Architecture):**
  - **Level 1 (Universal Healthcare Components):** `PatientCard`, `QueueView`, `EncounterHeader`, `ClinicalTimeline`, `OrderList`, `PrescriptionList`, `LabResult`, `BillingSummary`.
  - **Level 2 (Capability Components):** `ClinicalModule`, `LaboratoryModule`, `ImagingModule`, `PharmacyModule`, `BillingModule`, `InsuranceModule`, `OdontogramModule`, `AdmissionModule`.
  - **Level 3 (Product Manifest Driving UI Render):**
    - *Medical Clinic:* `enabledCapabilities: ["clinical", "queue", "pharmacy", "billing", "lis", "ris"]`
    - *Dental Clinic:* `enabledCapabilities: ["clinical", "chair", "odontogram", "pharmacy", "billing"]`
    - *Hospital:* `enabledCapabilities: ["clinical", "admission", "ward", "icu", "or", "billing", "lis", "ris"]`

---

## 🏁 Enterprise Lifecycle Pipeline:

$$\text{Vision} \rightarrow \text{Constitution} \rightarrow \text{ADRs} \rightarrow \text{Executable Spec} \rightarrow \text{PIA} \rightarrow \text{Code} \rightarrow \text{Unit Test} \rightarrow \text{Integration Test} \rightarrow \text{Regression Test} \rightarrow \text{Production}$$
