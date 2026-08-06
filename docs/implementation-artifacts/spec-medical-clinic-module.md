# Spec: Bella Healthcare Constitution v1.0 — Architecture Governance Specification

> **Trạng thái:** 🔒 **OFFICIALLY FROZEN ARCHITECTURE CONSTITUTION & GOVERNANCE FRAMEWORK v1.0**  
> **Quản trị Kiến trúc:** Architecture Governance Pipeline (Principles $\rightarrow$ ADRs $\rightarrow$ Reference Arch $\rightarrow$ Capability RFCs $\rightarrow$ Standards $\rightarrow$ Executable Arch)  
> **Chính sách phiên bản:** Semantic Versioning Governance (Major/Minor/Patch)  
> **Chuẩn tuân thủ:** ISO 27001, ISO 13485, HIPAA, HL7 FHIR, Bella EIP & EOS Compliant  

---

## 1. 7 Luật Kiến Trúc Bất Biến (Architecture Principles)

1. **Product không sở hữu Business Logic:** Logic nghiệp vụ 100% nằm ở tầng Capability.
2. **Không truy cập trực tiếp chéo Capability:** Đảm bảo ranh giới Bounded Context.
3. **Giao tiếp liên miền qua Event/API Contract:** Tuân thủ hợp đồng tại Event Contract Registry.
4. **Cấm ghi trực tiếp Sổ cái Kế toán:** Mọi bút toán tài chính phải qua Event Outbox của `AccountingEngineService`.
5. **Độc lập tầng Hiển thị:** Domain/Capability độc lập với UI Presentation Layer.
6. **Cấm dùng FHIR làm Internal Domain Model:** Internal Model bắt buộc dùng **Canonical Domain Model**.
7. **Shared Kernel là Nguồn Sự Thật Duy Nhất:** Dùng chung `Patient Identity`, `Practitioner`, `Facility`, `Department`, `Encounter`.

---

## 2. Danh Mục Tài Liệu Quản Trị Kiến Trúc (Governance Deliverables Checklist)

- [x] **Bella Healthcare Constitution v1.0 & Governance Framework**
- [ ] **Architecture Principles & ADR Repository (ADR-0001 đến ADR-0006)**
- [ ] **Reference Architecture Template (Khuôn mẫu Capability)**
- [ ] **Capability Specifications (Mini RFCs cho Clinical, Orders, LIS, RIS, Billing)**
- [ ] **Implementation Standards (Coding, DB, API, Event, Security)**
- [ ] **Executable Architecture Assets (Schemas, Reference Data, Seed Data, Contract Tests)**
