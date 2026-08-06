# ADR-006: Canonical Data Model & FHIR Separation

> **Trạng thái:** ACCEPTED  
> **Ngày quyết định:** 2026-08-06  
> **Người đưa ra quyết định:** Enterprise Architecture Board & AI Agent  

## Bối Cảnh (Context)
HL7 FHIR là chuẩn giao tiếp y tế quốc tế phổ biến. Tuy nhiên, nếu ép buộc toàn bộ Database nội bộ của Bella ERP phải tuân theo cấu trúc FHIR JSON sẽ gây ra các vấn đề nghiêm trọng về hiệu năng truy vấn SQL, phức tạp hóa việc tính toán kế toán/doanh thu và làm tăng chi phí phát triển.

## Quyết Định (Decision)
Tách biệt hoàn toàn Dữ liệu Nội bộ và Dữ liệu Liên thông bên ngoài:
- **Internal Domain Model:** Bắt buộc sử dụng **Canonical Healthcare Domain Model** (được tối ưu cho Relational SQL Database PostgreSQL, RLS, và hiệu năng giao dịch).
- **External Interoperability:** Sử dụng **HL7 FHIR Adapter Layer** để chuyển đổi (Map) Dữ liệu Canonical sang chuẩn HL7 FHIR Resources (`Patient`, `Encounter`, `Observation`, `Condition`, `MedicationRequest`, `DiagnosticReport`) khi giao tiếp với hệ thống bên ngoài hoặc xuất dữ liệu liên thông.

## Hệ Quả (Consequences)
- **Tích cực:** Tối ưu hóa hiệu năng truy vấn SQL nội bộ, đảm bảo tính đơn giản trong lập trình nghiệp vụ trong khi vẫn sẵn sàng 100% cho việc kết nối HL7 FHIR bên ngoài.
- **Thách thức:** Cần duy trì các Mapper class chính xác giữa Canonical Model và FHIR Resources.
