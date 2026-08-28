# BELLA HEALTHCARE — PRODUCT CONFORMANCE MATRIX & EVIDENCE MAP
### Phiên bản: 1.2 | Ngày: 27/08/2026 | Trạng thái: ACTIVE

> **Mục đích:** Tài liệu này chứng minh tính tuân thủ (conformance) của các sản phẩm dọc (Product Verticals) đối với Platform Core và Healthcare Kernel bằng bằng chứng cụ thể trong mã nguồn và kiểm thử.
> **Nguyên tắc:** Mỗi ô đánh giá phải đi kèm đường dẫn tệp tin và các trường hợp kiểm thử (test cases) cụ thể làm bằng chứng, loại bỏ tuyên bố suông.

---

## 📊 Ma trận tuân thủ & Bản đồ bằng chứng (Conformance Matrix & Evidence Map)

| Tiêu chuẩn kiểm soát (Architectural Invariant) | Bella Medical Clinic | Bella Hospital | Bella Dental | Cơ chế & Bằng chứng xác minh (Verification Evidence) |
| :--- | :---: | :---: | :---: | :--- |
| **1. Tenant Isolation** | ✅ | ✅ | ✅ | **Cơ chế:** Bắt buộc truyền `tenantId` trong DTO/Service call.<br>• [Medical Test (Gate 3)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/__tests__/bella-medical-conformance.integration.test.ts#L131-L142)<br>• [Hospital Test (Gate 3)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts#L89-L100)<br>• [Dental Test (Gate 3)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts#L101-L113) |
| **2. RLS Compliance** | ✅ | ✅ | ✅ | **Cơ chế:** RLS policies được kích hoạt trên toàn bộ các bảng đặc thù của Product (ví dụ: `dental_*` tables).<br>• [Dental SQL Migrations](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/products/dental/DB_MIGRATION_PLAN.md)<br>• [Dental Test (Gate 4)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts#L114-L127) |
| **3. Contract Compliance** | ✅ | ✅ | ✅ | **Cơ chế:** Chỉ gọi API/Service của Kernel thông qua Public Contracts định nghĩa tại `src/platform/healthcare/contracts/`. Không trực tiếp import code nội bộ của Kernel engines.<br>• [Medical Test (Gate 2)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/__tests__/bella-medical-conformance.integration.test.ts#L114-L129)<br>• [Hospital Test (Gate 2)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts#L74-L87)<br>• [Dental Test (Gate 2)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts#L88-L100) |
| **4. Zero Kernel Mutation** | ✅ | ✅ | ✅ | **Cơ chế:** Quá trình xây dựng product không tạo bất cứ thay đổi/fork nào đối với schema hay logic của core platform. Được chứng minh bằng CI Diff check.<br>• [Dental Manifest Proof](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/products/dental/PRODUCT_MANIFEST.md)<br>• [Logistics Enforcement Baseline](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/docs/CURRENT_STATE.md#L305-L312) |
| **5. Product Customization** | ✅ | ✅ | ✅ | **Cơ chế:** Custom logic nằm ở Product service layer, không mutated hay bypass Kernel invariants.<br>• [Medical Test (Gate 5)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/__tests__/bella-medical-conformance.integration.test.ts#L144-L158)<br>• [Hospital Test (Gate 5)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts#L115-L122)<br>• [Dental Test (Gate 5)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts#L120-L145) |
| **6. Auditability** | ⚠️ | ⚠️ | ✅ | **Cơ chế:** Issue bằng chứng băm SHA-256 (tamper-evident audit package) ghi nhận các thay đổi trạng thái nhạy cảm.<br>• [Dental Complete Procedure Test (Gate 10)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts#L173-L191)<br>• [Medical Complete Consultation Test (Gate 10)](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/__tests__/bella-medical-conformance.integration.test.ts#L198-L211)<br>• **Ghi chú:** Medical & Hospital đã tích hợp băm trong test, nhưng ở production code thực tế cần kiểm tra sâu hơn về tính bất biến (immutability) của record lưu trữ. |

---

## 🔬 Chi tiết & Bằng chứng thực tế từng Invariant

### Invariant 1: Tenant Isolation & Inbound DTO Validation
*   **Medical:** Lớp [`MedicalConsultationProductService`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/services/medical-consultation.service.ts) bắt buộc kiểm tra `tenantId` tại mọi điểm command entry. Test [Gate 3](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/__tests__/bella-medical-conformance.integration.test.ts#L131-L142) verify việc ném lỗi `TENANT_ISOLATION_VIOLATION`.
*   **Hospital:** Lớp [`HospitalAdmissionProductService`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-hospital/services/hospital-admission.service.ts) ném lỗi `TENANT_ISOLATION_VIOLATION` nếu `tenantId` trống trước khi chuyển giao tiếp cho `admissionContract` (xem [Gate 3 Test](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-hospital/__tests__/bella-hospital-conformance.integration.test.ts#L89-L100)).
*   **Dental:** Lớp [`DentalChairProductService`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/services/dental-chair.service.ts) kiểm tra `tenantId` bắt buộc khi đặt lịch (reserveDentalChair) và khi hoàn tất dịch vụ (completeDentalProcedure) (xem [Gate 3 Test](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/__tests__/bella-dental-conformance.integration.test.ts#L101-L113)).

### Invariant 3: Public Contract Compliance (No Direct Imports)
*   Tất cả các sản phẩm dọc giao tiếp với Kernel **duy nhất** qua các TypeScript contracts tại `src/platform/healthcare/contracts/`.
*   **Mã nguồn chứng minh:**
    *   Dental: [`dental-chair.service.ts`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-dental/services/dental-chair.service.ts#L14-L17) chỉ import `ITemporalContract`, `IAuditComplianceContract`, và `ICdsContract`.
    *   Hospital: [`hospital-admission.service.ts`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-hospital/services/hospital-admission.service.ts#L13-L22) chỉ import `AdmissionEngineContract` và `IClinicalAuditContract`.

### Invariant 6: Tamper-Evident Auditability vs. "Legal Proof"
> ⚠️ **Lưu ý quan trọng cho DD/Investor:**
> Chúng ta gọi đây là **Tamper-Evident Audit Evidence** (Bằng chứng kiểm tra băm bảo vệ tính toàn vẹn) thay vì bằng chứng pháp lý (legal proof). Chữ "pháp lý" yêu cầu chuỗi xác thực danh tính đầy đủ (identity provenance) và hạ tầng băm/chữ ký số bất biến tuyệt đối.
>
> **Quy trình hoạt động (enforced in Dental & Medical):**
> 1. Xảy ra sự kiện lâm sàng (ví dụ: hoàn thành thủ thuật răng).
> 2. Đóng gói payload sự kiện chuẩn hóa (chứa tenant, patient, actor, action, rule checksum).
> 3. Tính toán mã băm SHA-256 trên payload.
> 4. Ghi nhận băm này thông qua `AuditComplianceContract` hoặc `ClinicalAuditContract`.
> 5. Trả về Fingerprint để client đối chiếu, phát hiện nếu dữ liệu bị thay đổi trái phép (tamper-evident).

---

## 📅 Lịch sử thay đổi tài liệu này

| Ngày | Phiên bản | Mô tả |
|---|---|---|
| 27/08/2026 | 1.0 | Khởi tạo ma trận tuân thủ kiến trúc (Design intent). |
| 27/08/2026 | 1.2 | **Evidence Hardening Pass**: Thêm link trực tiếp đến các file code, test cases, schema specs. Làm rõ định nghĩa "Tamper-Evident Auditability" thay vì "Bằng chứng pháp lý" để tránh overclaim. Sửa đổi Gate 5 placeholder test cho Hospital. |
