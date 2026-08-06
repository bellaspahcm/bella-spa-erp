# Integration Catalog — External Systems Connectors

Tài liệu hướng dẫn kết nối, chuyển đổi giao thức và quy định hợp đồng dữ liệu đối với các hệ thống y tế quốc tế và nội địa thông qua lớp Anti-Corruption Layer (ACL).

---

## 🌐 External Connections Architecture

```
  [ External System ]
          │ (HL7 / FHIR / DICOM / SOAP)
          ▼
    [ FHIR/HL7 ACL ]  <--- Anti-Corruption Layer
          │ (Translates to internal commands)
          ▼
[ Encounter Context Core ]
```

---

## 🔌 Connectors Specifications

### 1. BHYT VNPT Connector (Bảo hiểm Y tế Việt Nam)
- **Giao thức**: REST API / SOAP XML.
- **Vai trò**: Gửi hồ sơ thanh toán xuất toán BHYT định dạng XML 79a/80a chuẩn Bộ Y Tế.
- **ACL Mapping**: Dịch dữ liệu hóa đơn `BillingSummary` thành định dạng XML cấu trúc chuẩn BHYT trước khi gửi sang cổng giám định VNPT.

### 2. HL7 / FHIR Connector (HIS / LIS Bệnh viện)
- **Giao thức**: HL7 v2.x MLLP / FHIR JSON over HTTP.
- **Vai trò**: Đồng bộ hồ sơ bệnh án điện tử (EHR) và kết quả xét nghiệm máu từ hệ thống LIS phòng lab.
- **ACL Mapping**:
  - Nhận FHIR `DiagnosticReport` ➔ Chuyển thành `LabResults` aggregate trong Encounter.

### 3. PACS / DICOM Connector (X-Ray / CT ConeBeam)
- **Giao thức**: DICOM DIMSE C-STORE / DICOMweb (WADO-RS).
- **Vai trò**: Nhận tệp hình ảnh chụp phim răng hàm từ máy chụp quanh chóp / Panorama.
- **ACL Mapping**:
  - Lưu trữ URL ảnh phim chụp răng vào `medicalImages` thuộc `EncounterAggregate`.
