# MEDICAL REFERENCE PRODUCT HARDENING PLAN
### Phiên bản: 1.1 | Ngày: 27/08/2026 | Trạng thái: GAP RECLASSIFIED (No Code Action Required)

> **Mục tiêu:** Xác minh tính tuân thủ ở runtime (Runtime Verification) của Bella Medical Clinic để chính thức đóng vai trò "Reference Product".
> **Phát hiện mới:** Forensic code chỉ ra `MedicalConsultationProductService` **đã tích hợp đầy đủ** H11 Audit Compliance contract. Do đó, kế hoạch này chuyển từ "viết thêm mã nguồn" sang "kiểm thử tích hợp thực tế với Live Database".

---

## 1. Phân tích hiện trạng & Tái phân loại (Gap Reclassified)

| Tiêu chuẩn tuân thủ | Hiện trạng | Khoảng trống | Giải pháp & Trạng thái |
| :--- | :--- | :--- | :--- |
| **Tenant Isolation** | ✅ Đầy đủ | Không | Verified qua unit tests. |
| **Contract Boundary** | ✅ Đầy đủ | Không | Verified qua unit tests. |
| **Auditability (H11)** | ✅ Đã tích hợp | Không có khoảng trống ở Product service. | **Reclassified:** Đã tích hợp `IAuditComplianceContract` tại `completeConsultation()`. Cần chạy integration test thực tế với Live DB để chứng minh audit record + evidence package được ghi nhận và bảo vệ tính toàn vẹn (tamper-evident). |

---

## 2. Thiết kế luồng Kiểm soát vết (Tamper-Evident Audit Flow)

Khi bác sĩ thực hiện hoàn tất phiên khám bệnh (Consultation):

```
Bác sĩ click "Hoàn tất khám"
       ↓
Hệ thống đóng gói SOAP Payload (Subjective, Objective, Assessment, Plan, chẩn đoán ICD-10)
       ↓
Tính toán SHA-256 Checksum trên SOAP Payload (Client/Service layer)
       ↓
Gửi payload & checksum qua Kernel Public Contract H11 (recordAuditEntry)
       ↓
Kernel sinh ra Audit Record chứa:
  - actorId, performerRole (PHYSICIAN)
  - patientId, encounterId, tenantId
  - clinicalDataHash (SHA-256)
  - timestamp bất biến (Immutable DB side)
       ↓
Trả về evidencePackageId và Fingerprint về Product Vertical để lưu trữ đối chiếu.
```

---

## 3. Các bước triển khai cụ thể (Implementation Steps)

### Bước 1: Khảo sát dịch vụ `MedicalConsultationProductService`
*   Đọc và phân tích file [`medical-consultation.service.ts`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/services/medical-consultation.service.ts) để tìm điểm tích hợp `auditContract`.

### Bước 2: Cập nhật hàm `completeConsultation`
*   Thực hiện wiring thực tế cuộc gọi sang `auditContract.recordAuditEntry()` trong `completeConsultation()` thay vì chỉ dùng mock trong test suite.
*   Thiết lập cấu trúc `clinicalDataHash` bằng cách băm payload SOAP lâm sàng thực tế:
    ```typescript
    const soapPayload = `${dto.encounterId}:${soapData.subjective}:${soapData.objective}`;
    const hash = crypto.createHash('sha256').update(soapPayload).digest('hex');
    ```

### Bước 3: Hardening Conformance Tests
*   Cập nhật [`bella-medical-conformance.integration.test.ts`](file:///d:/Antigravity/Projects/BELLA%20SPA%20ERP/src/products/bella-medical/__tests__/bella-medical-conformance.integration.test.ts#L198-L211) để đảm bảo việc gọi `completeConsultation` thực sự tính toán checksum đúng quy định lâm sàng.

---

## 4. Kế hoạch xác minh (Verification Plan)

### Kiểm thử tự động
*   Chạy test suite của Medical Clinic:
    ```bash
    npx jest src/products/bella-medical/ --runInBand
    ```
*   Đảm bảo 100% test cases (bao gồm Gate 10 Auditability) đều PASS và không dùng mock hoàn toàn cho luồng tính toán băm lâm sàng.

---

## 📅 Lịch sử tài liệu

- **27/08/2026 (v1.0):** Khởi tạo bản thảo kế hoạch hardening Medical Reference Product sau khi giải quyết xong các ADR.
