# ADR-016: H7 — Imaging Engine: Healthcare Kernel vs. Product Layer

**Status:** APPROVED — Hướng B (Product Layer Only)  
**Date:** 2026-08-27  
**Author:** Kiến trúc sư trưởng  
**Context:** Reality Check 2026-08-27 phát hiện `imaging-engine/` là thư mục rỗng, không contract, không implementation, bị loại khỏi ACTIVE_ENGINES.

---

## Quyết định chính thức (Architecture Board Decision)

**Quyết định:** Chọn **Hướng B (Product Layer Only)**. 
Imaging capability sẽ được giữ hoàn toàn ở **Product layer / Service layer**; xóa bỏ placeholder `imaging-engine` khỏi Healthcare Kernel.

### Lý do quyết định:
1. **Sự khác biệt lớn về Workflow lâm sàng:** Bella Hospital cần tích hợp full-scale DICOM PACS / Modality Worklist; Bella Medical Clinic chỉ cần basic RIS; Bella Dental cần phim chụp X-Quang miệng / CBCT chuyên biệt. Việc áp đặt một interface Kernel chung (Generic contract) không tạo ra giá trị tái sử dụng mà ngược lại tăng độ phức tạp không đáng có (Vi phạm luật tối giản Law 7 của `AGENTS.md`).
2. **Quy tắc phân vùng độc lập:** "Không thuộc Kernel boundary ở thời điểm hiện tại; Product layer được phép tự do xây dựng capability độc lập."
3. **Mở rộng trong tương lai:** Product Layer Only không đồng nghĩa với "không bao giờ". Nếu sau này xuất hiện 3-5 sản phẩm dọc khác nhau có nhu cầu chia sẻ chung một contract chụp phim, quyết định này có thể được supersede bởi một ADR mới.

**Signed by:** Human Architect & Platform Team  
**Date:** 2026-08-27

---

## 1. Bối cảnh

Trong quá trình thiết kế Healthcare OS, Imaging (RIS/PACS) được đặt tên là H7 và có thư mục placeholder tại:

```
src/platform/healthcare/engines/imaging-engine/   ← EMPTY
```

Không có contract, không có service implementation, không có integration tests. Engine bị comment out trong `service-locator.ts` với note:

```typescript
// NOTE: The following contracts do not yet exist — add imports when contracts are created:
// import type { ImagingEngineContract } from './contracts/imaging-engine.contract';
```

Những gì thực sự tồn tại hiện nay nằm ở **Product/Service layer**, không phải Kernel:

- `src/services/healthcare/lis-ris-actions.ts` — CRUD actions cho `hc_imaging_orders`
- `src/services/healthcare/healthcare-actions.ts` — `getImagingOrdersAction()`, `createImagingOrderAction()`, `verifyImagingResultAction()`
- Database table: `hc_imaging_orders` (với fields: `order_type`, `dcm_study_uid`, `radiologist_id`, v.v.)

---

## 2. Câu hỏi kiến trúc cần trả lời

> **Imaging có phải Healthcare Kernel primitive dùng chung cho nhiều products không?**

Nếu **YES** → Build `ImagingEngineContract` + `ImagingEngineService` trong Kernel.  
Nếu **NO** → Imaging ở lại Product layer, xóa placeholder, tuyên bố rõ ràng.

---

## 3. Các lập luận cho từng hướng

### Hướng A: Imaging là Healthcare Kernel Primitive

**Lý do:**
- Nhiều healthcare products cần imaging: Bella Hospital (X-Ray, MRI), Bella Medical (diagnostic imaging), Bella Dental (dental X-Ray, CBCT)
- DICOM/RIS/PACS là standard trong healthcare — boundary rõ ràng
- Nếu mỗi product tự implement imaging → code duplication và inconsistent tenant isolation

**Contract sẽ bao gồm:**
- `createImagingOrder(input): Promise<ImagingOrder>` — tạo lệnh chụp với tenant isolation
- `updateImagingReport(imagingOrderId, report): Promise<void>` — radiologist ghi kết quả
- `getImagingOrders(tenantId, filter): Promise<ImagingOrder[]>` — query theo tenant
- `verifyImagingResult(imagingOrderId, actorId): Promise<void>` — clinical verification step
- `getImagingStats(tenantId): Promise<ImagingStats>` — RIS dashboard metrics

**Consumers identified:**
- Bella Medical Clinic — diagnostic imaging orders
- Bella Hospital — radiology department (X-Ray, CT, MRI, Ultrasound)
- Bella Dental — Dental X-Ray, CBCT (nếu applicable)

**Effort estimate:** Medium (contract + domain types + service implementation + 15-20 integration tests)

---

### Hướng B: Imaging là Product Capability, không phải Kernel

**Lý do:**
- Imaging workflow giữa Hospital, Medical, Dental rất khác nhau — không đủ common behavior để justify Kernel contract
- Hospital cần full DICOM PACS integration; Medical clinic chỉ cần basic RIS; Dental cần CBCT-specific formats
- Product-layer `lis-ris-actions.ts` đã đủ serve Medical/Hospital hiện tại
- AGENTS.md: "Do NOT build a capability in the Product layer first and plan to extract it into a Kernel later when its reusable nature is already apparent" — nhưng ngược lại cũng đúng: không force vào Kernel khi products có workflow quá khác nhau

**Hành động nếu chọn B:**
1. Xóa `src/platform/healthcare/engines/imaging-engine/` (placeholder)
2. Xóa `'imaging-engine'` khỏi `KNOWN_EXEMPTIONS` trong compliance test
3. Di chuyển/tái cấu trúc `lis-ris-actions.ts` thành Product-layer service được đặt tên rõ ràng hơn
4. Document rõ: *"Imaging is a Product capability. Each healthcare vertical owns its imaging workflow."*
5. Tuyên bố H7 là **Product-scope** (không phải H = Healthcare Kernel)

---

## 4. Evidence hiện có

| Evidence | Ủng hộ Hướng A | Ủng hộ Hướng B |
|---|---|---|
| `hc_imaging_orders` table shared across tenants | ✅ | |
| `dcm_study_uid` field (DICOM standard) | ✅ shared standard | |
| Existing code chỉ ở service layer, không có engine | | ✅ product-scope đủ |
| Hospital workflow khác Medical khác Dental | | ✅ |
| 2+ products đang dùng imaging data | ✅ | |
| Không có use case cross-product sharing imaging orders | | ✅ |

---

## 5. Câu hỏi cụ thể cho Kiến trúc sư trưởng

1. Bella Hospital và Bella Medical có cần **shared imaging order state** không? (Ví dụ: bác sĩ Medical gửi bệnh nhân đến Radiology của Hospital và muốn xem kết quả trong cùng một encounter)
2. Bella Dental có cần X-Ray/CBCT workflow tích hợp với Healthcare Kernel encounter không, hay chỉ cần standalone?
3. Có Industry #4 hoặc #5 nào trong roadmap cũng cần imaging không?

---

## 6. Quyết định

> **[x] Hướng B — Imaging stays Product layer, remove placeholder**

**Signed by:** Human Architect & Platform Team  
**Date:** 2026-08-27

---

## 7. Hành động tiếp theo sau quyết định

**Nếu chọn A:**
```
ADR-016 ACCEPTED
    ↓
ImagingEngineContract (contracts/)
    ↓
Domain types (engines/imaging-engine/domain/)
    ↓
ImagingEngineService (engines/imaging-engine/)
    ↓
Register in service-locator.ts + HealthcareServiceMap
    ↓
Integration tests (15+ cases, RLS + negative paths)
    ↓
Full Healthcare regression (imaging included)
    ↓
Healthcare Kernel "Partially Frozen" → "Fully Frozen" (nếu H12 cũng xong)
```

**Nếu chọn B:**
```
ADR-016 REJECTED
    ↓
Remove imaging-engine/ placeholder
    ↓
Remove KNOWN_EXEMPTIONS['imaging-engine']
    ↓
Rename/relocate lis-ris-actions.ts as Product service
    ↓
Update BELLA_SYSTEM_INDEX.md, progress_report
    ↓
Tuyên bố: "H7 = Product capability (not Kernel engine)"
    ↓
Healthcare Kernel claim = "11 active engines" (not H1-H12)
```
